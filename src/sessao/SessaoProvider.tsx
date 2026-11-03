/**
 * Sessão da aplicação (RF-03, RF-04): estado de autenticação, acesso do usuário e filial
 * selecionada, compartilhados por contexto.
 *
 * O provider fica FORA do roteador: ele não navega, apenas expõe o estado; quem decide a tela
 * (login, sem acesso, aplicação) é a camada de rotas. Ao montar com token salvo, consulta
 * `GET /ped/acesso`; ouve `EVENTO_SESSAO_EXPIRADA` (401 em chamadas autenticadas) para encerrar a
 * sessão com a mensagem padrão.
 */

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, EVENTO_SESSAO_EXPIRADA, mensagemPadraoPorStatus } from '../services/api'
import { entrar as entrarServico, obterAcesso } from '../services/autenticacao'
import { limparToken, obterToken } from '../services/sessao'
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
}

// Contexto e hook ficam neste arquivo por contrato dos testes (F2.1) e do `ProvedorSessaoFalso`.
// oxlint-disable-next-line react/only-export-components
export const SessaoContexto = createContext<Sessao | undefined>(undefined)

const MENSAGEM_ERRO_INESPERADO = 'Não foi possível concluir a operação. Tente novamente.'

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

function mensagemDe(erro: unknown): string {
  return erro instanceof ApiError ? erro.mensagem : MENSAGEM_ERRO_INESPERADO
}

/** 401 ao restaurar: o cliente HTTP já disparou `EVENTO_SESSAO_EXPIRADA`, que preencheu `erro`. */
function ehSessaoExpirada(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 401
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<DadosSessao>(dadosIniciais)
  const montado = useRef(false)

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
        if (ativo) setDados(dadosComAcesso(acesso))
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
        setDados({ ...SESSAO_ANONIMA, erro: mensagemDe(erro) })
      })

    return () => {
      ativo = false
    }
  }, [])

  // Sessão expirada sinalizada pelo cliente HTTP (401 em chamada autenticada).
  // Com a sessão já anônima (após sair ou nunca autenticada) não há o que expirar: o estado é
  // mantido e nenhuma mensagem é exibida. Em `carregando` (401 na restauração) a mensagem é exposta.
  useEffect(() => {
    const aoExpirar = () => {
      limparToken()
      setDados((atual) =>
        atual.estado === 'anonimo' ? atual : { ...SESSAO_ANONIMA, erro: mensagemPadraoPorStatus(401) },
      )
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
      if (montado.current) setDados(dadosComAcesso(acesso))
    } catch (erro) {
      limparToken()
      if (montado.current) setDados({ ...SESSAO_ANONIMA, erro: mensagemDe(erro) })
      throw erro
    }
  }, [])

  const sair = useCallback((): void => {
    limparToken()
    setDados(SESSAO_ANONIMA)
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
    () => ({ ...dados, entrar, sair, selecionarFilial }),
    [dados, entrar, sair, selecionarFilial],
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
