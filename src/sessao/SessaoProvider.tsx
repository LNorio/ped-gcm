/**
 * Sessão da aplicação (RF-03, RF-04): estado de autenticação, acesso do usuário e filial
 * selecionada, compartilhados por contexto.
 *
 * O provider fica FORA do roteador: ele não navega, apenas expõe o estado; quem decide a tela
 * (login, sem acesso, aplicação) é a camada de rotas. Ao montar com token salvo, consulta
 * `GET /ped/acesso`; ouve `EVENTO_SESSAO_EXPIRADA` (401 em chamadas autenticadas) para encerrar a
 * sessão com a mensagem padrão.
 *
 * Ao obter o acesso (restauração ou login), avisa `acessoObtido` antes de aplicar o estado, para que a
 * tela que vai abrir possa antecipar as próprias consultas (ex.: o Início). Como essas consultas saem
 * antes de a sessão autenticada aparecer, um 401 delas que chegue nesse intervalo só encerra a sessão
 * logo depois de a sessão autenticada ser exibida (o fluxo visto é o mesmo de sempre: a tela abre e
 * volta ao login com o aviso de sessão expirada).
 */

import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ApiError, EVENTO_SESSAO_EXPIRADA, mensagemDeErro, mensagemPadraoPorStatus } from '../services/api'
import { entrar as entrarServico, obterAcesso } from '../services/autenticacao'
import { limparToken, obterToken } from '../services/sessao'
import { avisarAcessoObtido } from './acessoObtido'
import type { Acesso, Filial } from '../types/dominio'
import { TODAS_AS_FILIAIS } from './filial'

/**
 * - `anonimo`: sem token; exibir login.
 * - `carregando`: há token salvo e o acesso está sendo consultado.
 * - `autenticado`: token válido e usuário com perfil no PED.
 * - `sem-acesso`: token válido, mas usuário sem perfil no PED (`acesso.perfil === null`).
 */
export type EstadoSessao = 'anonimo' | 'carregando' | 'autenticado' | 'sem-acesso'

/** Filial em uso: uma filial da lista do usuário, `'todas'` (quem tem todas as filiais) ou `null`. */
export type FilialSelecionada = Filial | 'todas' | null

export interface Sessao {
  estado: EstadoSessao
  acesso: Acesso | null
  /** Mensagem em pt-BR da última falha (login recusado, sessão expirada...); `null` quando não há. */
  erro: string | null
  filialSelecionada: FilialSelecionada
  /** Autentica e carrega o acesso. Rejeita com o erro original (`ApiError`), já refletido em `erro`. */
  entrar: (usuario: string, senha: string) => Promise<void>
  sair: () => void
  /** Seleciona uma filial pelo código ou `'todas'` (somente para quem tem todas as filiais). */
  selecionarFilial: (codigo: string) => void
  /**
   * Lê de novo o acesso (`GET /ped/acesso`) e o substitui sem passar por `carregando` — ex.: depois de criar
   * ou alterar um tipo e ao abrir os cadastros, para o campo Tipo listar os tipos atuais. Mantém a filial
   * selecionada se ela continuar no acesso. Nunca rejeita: em falha mantém o acesso anterior (o 401 segue o
   * fluxo de sessão expirada); com chamadas concorrentes, vale a mais recente.
   */
  recarregarAcesso: () => Promise<void>
}

// Contexto e hook ficam neste arquivo por contrato dos testes (F2.1) e do `ProvedorSessaoFalso`.
// oxlint-disable-next-line react/only-export-components
export const SessaoContexto = createContext<Sessao | undefined>(undefined)

interface DadosSessao {
  estado: EstadoSessao
  acesso: Acesso | null
  erro: string | null
  filialSelecionada: FilialSelecionada
}

const SESSAO_ANONIMA: DadosSessao = { estado: 'anonimo', acesso: null, erro: null, filialSelecionada: null }

function dadosIniciais(): DadosSessao {
  return obterToken() ? { ...SESSAO_ANONIMA, estado: 'carregando' } : SESSAO_ANONIMA
}

function filialInicial(acesso: Acesso): FilialSelecionada {
  if (acesso.todasAsFiliais) return 'todas'
  return acesso.filiais[0] ?? null
}

function dadosComAcesso(acesso: Acesso): DadosSessao {
  return {
    estado: acesso.perfil === null ? 'sem-acesso' : 'autenticado',
    acesso,
    erro: null,
    filialSelecionada: filialInicial(acesso),
  }
}

/** Filial em uso após reler o acesso: a mesma, se continua disponível; senão, a inicial do novo acesso. */
function filialPreservada(atual: FilialSelecionada, acesso: Acesso): FilialSelecionada {
  if (atual === TODAS_AS_FILIAIS) return acesso.todasAsFiliais ? TODAS_AS_FILIAIS : filialInicial(acesso)
  if (atual !== null) {
    const mesma = acesso.filiais.find((filial) => filial.codigo === atual.codigo)
    if (mesma) return mesma
  }
  return filialInicial(acesso)
}

/** Sessão expirada: volta ao anônimo com a mensagem padrão (sem efeito se já está anônima). */
function expirar(atual: DadosSessao): DadosSessao {
  return atual.estado === 'anonimo' ? atual : { ...SESSAO_ANONIMA, erro: mensagemPadraoPorStatus(401) }
}

/** 401 ao restaurar: o cliente HTTP já disparou `EVENTO_SESSAO_EXPIRADA`, que preencheu `erro`. */
function ehSessaoExpirada(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 401
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<DadosSessao>(dadosIniciais)
  const montado = useRef(false)
  // Sessão autenticada já aplicada (`setDados`), mas ainda não exibida; e expiração que chegou nesse meio-tempo.
  const autenticacaoPendente = useRef(false)
  const expiracaoAdiada = useRef(false)
  // Muda a cada sessão autenticada aplicada, para o efeito abaixo rodar a cada novo login — inclusive com o
  // estado já `autenticado` (novo login sem sair antes, logins concorrentes).
  const [versaoAutenticacao, setVersaoAutenticacao] = useState(0)

  /** Monta o estado autenticado e, se o usuário tem perfil, avisa quem antecipa as consultas da tela. */
  const dadosAoObterAcesso = useCallback((acesso: Acesso): DadosSessao => {
    const novos = dadosComAcesso(acesso)
    if (novos.estado === 'autenticado') {
      autenticacaoPendente.current = true
      setVersaoAutenticacao((versao) => versao + 1)
      avisarAcessoObtido({ acesso, filialSelecionada: novos.filialSelecionada })
    }
    return novos
  }, [])

  // A sessão autenticada (de cada novo login) entrou na tela: deixa de estar pendente. Efeito de layout
  // (síncrono ao commit) para que um 401 que chegue logo depois já encerre a sessão na hora, sem depender
  // de quando os efeitos passivos rodam.
  useLayoutEffect(() => {
    if (dados.estado === 'autenticado') autenticacaoPendente.current = false
  }, [dados.estado, versaoAutenticacao])

  // A sessão autenticada foi exibida: aplica a expiração adiada, se houver.
  useEffect(() => {
    if (dados.estado !== 'autenticado' || autenticacaoPendente.current || !expiracaoAdiada.current) return
    expiracaoAdiada.current = false
    setDados(expirar)
  }, [dados.estado, versaoAutenticacao])

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Restauração da sessão ao montar com token salvo (recarga da página).
  useEffect(() => {
    if (!obterToken()) return
    let ativo = true

    obterAcesso()
      .then((acesso) => {
        if (ativo) setDados(dadosAoObterAcesso(acesso))
      })
      .catch((erro: unknown) => {
        if (!ativo) return
        limparToken()
        if (ehSessaoExpirada(erro)) {
          // 401: mensagem já definida pelo ouvinte do evento de sessão expirada.
          setDados((atual) => ({ ...SESSAO_ANONIMA, erro: atual.erro }))
          return
        }
        // 403/rede/5xx: volta ao login informando o motivo; o usuário entra novamente.
        setDados({ ...SESSAO_ANONIMA, erro: mensagemDeErro(erro) })
      })

    return () => {
      ativo = false
    }
  }, [dadosAoObterAcesso])

  // Sessão expirada sinalizada pelo cliente HTTP (401 em chamada autenticada).
  // Com a sessão já anônima (após sair ou nunca autenticada) não há o que expirar: o estado é
  // mantido e nenhuma mensagem é exibida. Em `carregando` (401 na restauração) a mensagem é exposta.
  useEffect(() => {
    const aoExpirar = () => {
      limparToken()
      // 401 de uma consulta antecipada, antes de a sessão autenticada aparecer: aplica logo depois.
      if (autenticacaoPendente.current) {
        expiracaoAdiada.current = true
        return
      }
      setDados(expirar)
    }
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar)
    return () => {
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar)
    }
  }, [])

  const entrar = useCallback(async (usuario: string, senha: string): Promise<void> => {
    try {
      await entrarServico(usuario, senha)
      const acesso = await obterAcesso()
      if (montado.current) setDados(dadosAoObterAcesso(acesso))
    } catch (erro) {
      limparToken()
      if (montado.current) setDados({ ...SESSAO_ANONIMA, erro: mensagemDeErro(erro) })
      throw erro
    }
  }, [dadosAoObterAcesso])

  const sair = useCallback((): void => {
    limparToken()
    // Uma expiração adiada não sobrevive ao sair: não pode derrubar o próximo login.
    autenticacaoPendente.current = false
    expiracaoAdiada.current = false
    setDados(SESSAO_ANONIMA)
  }, [])

  // Versão da última releitura do acesso: respostas de releituras anteriores são descartadas.
  const versaoReleitura = useRef(0)

  const recarregarAcesso = useCallback(async (): Promise<void> => {
    if (!obterToken()) return
    const versao = ++versaoReleitura.current
    try {
      const acesso = await obterAcesso()
      if (!montado.current || versao !== versaoReleitura.current) return
      setDados((atual) => {
        // Sem sessão aberta (saiu, expirou ou ainda restaurando): nada a substituir.
        if (atual.estado === 'anonimo' || atual.estado === 'carregando') return atual
        return {
          ...atual,
          estado: acesso.perfil === null ? 'sem-acesso' : 'autenticado',
          acesso,
          filialSelecionada: filialPreservada(atual.filialSelecionada, acesso),
        }
      })
    } catch {
      // 401: o cliente HTTP já disparou `EVENTO_SESSAO_EXPIRADA`. Demais falhas: mantém o acesso anterior.
    }
  }, [])

  const selecionarFilial = useCallback((codigo: string): void => {
    setDados((atual) => {
      if (!atual.acesso) return atual
      if (codigo === TODAS_AS_FILIAIS) {
        return atual.acesso.todasAsFiliais ? { ...atual, filialSelecionada: TODAS_AS_FILIAIS } : atual
      }
      const filial = atual.acesso.filiais.find((item) => item.codigo === codigo)
      return filial ? { ...atual, filialSelecionada: filial } : atual
    })
  }, [])

  const valor = useMemo<Sessao>(
    () => ({ ...dados, entrar, sair, selecionarFilial, recarregarAcesso }),
    [dados, entrar, sair, selecionarFilial, recarregarAcesso],
  )

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>
}

/** Acesso à sessão. Deve ser usado dentro de `SessaoProvider`. */
// oxlint-disable-next-line react/only-export-components
export function useSessao(): Sessao {
  const sessao = useContext(SessaoContexto)
  if (sessao === undefined) throw new Error('useSessao deve ser usado dentro de SessaoProvider')
  return sessao
}
