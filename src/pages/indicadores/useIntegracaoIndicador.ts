/**
 * Modal da integração da meta via API do indicador (F6.11 — contrato proposto, seção 5 de
 * `docs/propostas-backend/PROPOSTA-meta-por-filial.md`), usada pela `IndicadoresPage` (só Admin).
 *
 * Reaproveita a modal da integração do dado externo (`DialogoConcluirConstrucao`, modo `configurar`,
 * `tipoAlvo: 'indicador'`) e os mesmos recursos da aba Dados Externos:
 * - `abrir(indicador)`: monta o alvo `{ id, nome, ...indicador.integracao }` (com `mapeamentoSaida`, `null`
 *   no formato antigo da saída ou sem integração salva) e consulta, a cada
 *   abertura, os identificadores existentes (`listarIdentificadores`; falha = sem sugestões) e as
 *   variáveis (`useVariaveisIntegracao`, 1 GET por abertura);
 * - `confirmar(dados)`: chama `atualizarIntegracao` com os quatro campos e o `mapeamento` da modal (do `useIndicadores`, que grava e recarrega a lista)
 *   uma única vez por envio (clique duplo ignorado); no sucesso fecha a modal e chama `onSalva`; no erro
 *   deixa a modal aberta com a mensagem geral (`erro`) e os erros por campo (`errosDaIntegracao`);
 * - `fechar()`: ignorado durante a gravação; não chama a API.
 */
import { useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { errosDaIntegracao, listarIdentificadores } from '../../services/dadosExternosService'
import type { ErroIntegracao, IdentificadorColeta, Indicador, IntegracaoDadoExterno } from '../../types/dominio'
import type { AlvoIntegracao, DadosConclusaoConstrucao } from '../dados-externos/DialogoConcluirConstrucao'
import { useVariaveisIntegracao } from '../dados-externos/useVariaveisIntegracao'

const SEM_ERROS_CAMPOS: ErroIntegracao[] = []

export interface UseIntegracaoIndicadorOpcoes {
  /** Grava a integração (PUT) e recarrega a lista; rejeita com a `ApiError` em caso de falha. */
  atualizarIntegracao: (id: number, integracao: IntegracaoDadoExterno) => Promise<void>
  /** Chamado depois de gravar com sucesso (a modal já foi fechada). */
  onSalva: () => void
}

/** Alvo da modal a partir do indicador; sem `integracao` (não deveria ocorrer), campos vazios. */
function paraAlvo(indicador: Indicador): AlvoIntegracao {
  const integracao = indicador.integracao
  return {
    id: indicador.id,
    nome: indicador.nome,
    identificador: integracao?.identificador ?? null,
    url: integracao?.url ?? null,
    parametrosSaida: integracao?.parametrosSaida ?? null,
    parametrosEntrada: integracao?.parametrosEntrada ?? null,
    mapeamentoSaida: integracao?.mapeamentoSaida ?? null,
  }
}

export function useIntegracaoIndicador({ atualizarIntegracao, onSalva }: UseIntegracaoIndicadorOpcoes) {
  const [alvo, setAlvo] = useState<AlvoIntegracao | null>(null)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [errosCampos, setErrosCampos] = useState<ErroIntegracao[]>(SEM_ERROS_CAMPOS)
  const [identificadores, setIdentificadores] = useState<IdentificadorColeta[]>([])
  const variaveis = useVariaveisIntegracao()
  const gravandoRef = useRef(false)
  const consultaIdentificadoresRef = useRef(0)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  function limparErros() {
    setErro(null)
    setErrosCampos(SEM_ERROS_CAMPOS)
  }

  /** Consulta os identificadores existentes; uma resposta antiga ou com falha não deixa sugestões. */
  function carregarIdentificadores() {
    const consulta = ++consultaIdentificadoresRef.current
    const vigente = () => montadoRef.current && consulta === consultaIdentificadoresRef.current
    setIdentificadores([])
    listarIdentificadores().then(
      (lista) => {
        if (vigente()) setIdentificadores(lista)
      },
      () => {
        if (vigente()) setIdentificadores([])
      },
    )
  }

  function abrir(indicador: Indicador) {
    limparErros()
    setAlvo(paraAlvo(indicador))
    carregarIdentificadores()
    variaveis.carregar()
  }

  function fechar() {
    if (gravandoRef.current) return
    setAlvo(null)
    limparErros()
    variaveis.descartar()
  }

  /** Os quatro campos e o mapeamento da saída vão à API; `variaveisUsadas` fica na tela. */
  async function confirmar({ identificador, url, parametrosSaida, parametrosEntrada, mapeamento }: DadosConclusaoConstrucao) {
    if (gravandoRef.current || alvo === null) return
    gravandoRef.current = true
    setGravando(true)
    limparErros()
    try {
      await atualizarIntegracao(alvo.id, { identificador, url, parametrosSaida, parametrosEntrada, mapeamento })
      if (!montadoRef.current) return
      setAlvo(null)
      variaveis.descartar()
      onSalva()
    } catch (falha) {
      if (montadoRef.current) {
        setErro(mensagemDeErro(falha))
        setErrosCampos(errosDaIntegracao(falha))
      }
    } finally {
      gravandoRef.current = false
      if (montadoRef.current) setGravando(false)
    }
  }

  return { alvo, gravando, erro, errosCampos, identificadores, variaveis, abrir, fechar, confirmar }
}
