/**
 * Hook da aba Preenchimento (F9.2, F9.3, F9.6 — RF-60 a RF-67).
 *
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`); sem filial (`'todas'` ou `null`),
 *   nada é consultado e a tela fica `null` (RF-60). Trocar a filial recomeça do mês aberto.
 * - A tela começa no mês aberto (`obterPreenchimento({ filial })`, sem mês) e os meses são os do ano do
 *   período aberto (`listarMesesPreenchimento`). `selecionarMes` consulta a tela de outro mês;
 *   `mudarAno` consulta só os meses; `irParaPeriodoAberto` volta ao mês aberto e ao ano dele.
 * - Erro dos meses fica em `erroMeses`, sem derrubar a tela. Erro da tela não apaga o ano, os meses
 *   nem o período aberto (o último conhecido fica guardado), para o seletor continuar disponível.
 * - `salvar(itens)` envia um único `PUT` com a filial e o mês da tela; no sucesso recarrega a tela e os
 *   meses (só se a filial do cabeçalho ainda for a da gravação) e resolve com o resultado; na falha rejeita com a `ApiError` original, sem recarregar.
 * - Proteção de corrida por contador: só a última consulta de cada tipo (tela/meses) é aplicada.
 *
 * Integração (outras atividades da F9): `recarregar()` repete as consultas da tela e dos meses (ex.:
 * depois de ajustar metas ou abrir um período); `codigoFilial`, `tela`, `mesSelecionado` e
 * `periodoAberto` dão o contexto para os diálogos de metas e de período. `onTelaRecebida` (opcional) é
 * chamado com cada tela aplicada e a anterior, antes da renderização, para a página antecipar consultas
 * que dependem da tela (ex.: a janela de metas).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, mensagemDeErro } from '../../services/api'
import {
  listarMesesPreenchimento,
  MENSAGEM_FILIAL_OBRIGATORIA,
  obterPreenchimento,
  salvarPreenchimento,
  type ResultadoPreenchimento,
} from '../../services/preenchimentoService'
import { useSessao } from '../../sessao/SessaoProvider'
import type { ItemPreenchimento, MesPreenchimento, TelaPreenchimento } from '../../types/dominio'
import { anoDaData, mesDeCompetencia } from './regrasPreenchimento'

export interface UsePreenchimentoResultado {
  /** Filial do cabeçalho; `null` sem filial ("Todas as filiais"). */
  codigoFilial: string | null
  /** Tela do mês consultado; `null` sem filial, antes da primeira carga ou após erro de carga. */
  tela: TelaPreenchimento | null
  /** `true` enquanto a tela está sendo consultada. */
  carregando: boolean
  /** Mensagem do erro de carga da tela. */
  erro: string | null
  /** Repete as consultas da tela (mesmo mês) e dos meses (mesmo ano). Nunca rejeita. */
  recarregar: () => Promise<void>
  /** Ano exibido no seletor; `null` antes da primeira carga. */
  ano: number | null
  /** Os 12 meses do ano exibido. */
  meses: MesPreenchimento[]
  carregandoMeses: boolean
  erroMeses: string | null
  /** Mês da tela (`AAAA-MM-01`). */
  mesSelecionado: string | null
  /** Mês aberto para preenchimento (`AAAA-MM-01`), informado pela tela. */
  periodoAberto: string | null
  /** Consulta a tela do mês (`AAAA-MM-01`). */
  selecionarMes: (mes: string) => void
  /** Consulta os meses do ano (a tela continua a do mês selecionado). */
  mudarAno: (ano: number) => void
  /** Volta à tela do mês aberto e ao ano dele. */
  irParaPeriodoAberto: () => void
  /** Lançamento/correção em lote na filial e mês da tela. Rejeita com a `ApiError` original. */
  salvar: (itens: ItemPreenchimento[]) => Promise<ResultadoPreenchimento>
}

const SEM_MESES: MesPreenchimento[] = []

export interface OpcoesUsePreenchimento {
  /**
   * Chamado quando uma tela recebida é aplicada, com a tela anterior (`null` na primeira da filial ou
   * depois de um erro). Roda no mesmo lote de atualização em que a tela passa a valer.
   */
  onTelaRecebida?: (tela: TelaPreenchimento, anterior: TelaPreenchimento | null) => void
}

type ResultadoTela = { tela: TelaPreenchimento } | { erro: string }

/** Tela do mês (`null` = mês aberto); a falha vira a mensagem em pt-BR (nunca rejeita). */
async function consultarPreenchimento(filial: string, mes: string | null): Promise<ResultadoTela> {
  try {
    return { tela: await obterPreenchimento(mes === null ? { filial } : { filial, mesDeReferencia: mes }) }
  } catch (falha) {
    return { erro: mensagemDeErro(falha) }
  }
}

export function usePreenchimento({ onTelaRecebida }: OpcoesUsePreenchimento = {}): UsePreenchimentoResultado {
  const { filialSelecionada } = useSessao()
  const codigoFilial = filialSelecionada === null || filialSelecionada === 'todas' ? null : filialSelecionada.codigo

  const [tela, setTela] = useState<TelaPreenchimento | null>(null)
  const [carregando, setCarregando] = useState(codigoFilial !== null)
  const [erro, setErro] = useState<string | null>(null)
  const [ano, setAno] = useState<number | null>(null)
  const [meses, setMeses] = useState<MesPreenchimento[]>(SEM_MESES)
  const [carregandoMeses, setCarregandoMeses] = useState(false)
  const [erroMeses, setErroMeses] = useState<string | null>(null)
  /** Mês pedido em `selecionarMes`; `null` = o mês aberto (consulta sem mês). */
  const [mesConsulta, setMesConsulta] = useState<string | null>(null)
  /**
   * Último período aberto conhecido (`AAAA-MM-01`), da última tela recebida da filial. Fica guardado
   * quando a consulta da tela falha, para o seletor continuar com o período aberto.
   */
  const [periodoConhecido, setPeriodoConhecido] = useState<string | null>(null)

  const montadoRef = useRef(false)
  const filialRef = useRef(codigoFilial)
  const telaRef = useRef<TelaPreenchimento | null>(null)
  const anoRef = useRef<number | null>(null)
  const mesConsultaRef = useRef<string | null>(null)
  const requisicaoTelaRef = useRef(0)
  const requisicaoMesesRef = useRef(0)
  const onTelaRecebidaRef = useRef(onTelaRecebida)

  useEffect(() => {
    onTelaRecebidaRef.current = onTelaRecebida
  }, [onTelaRecebida])

  const definirTela = useCallback((valor: TelaPreenchimento | null) => {
    telaRef.current = valor
    setTela(valor)
  }, [])

  const definirAno = useCallback((valor: number | null) => {
    anoRef.current = valor
    setAno(valor)
  }, [])

  const definirMesConsulta = useCallback((valor: string | null) => {
    mesConsultaRef.current = valor
    setMesConsulta(valor)
  }, [])

  const carregarMeses = useCallback(async (filial: string, anoAlvo: number): Promise<void> => {
    requisicaoMesesRef.current += 1
    const numero = requisicaoMesesRef.current
    const atual = () => montadoRef.current && numero === requisicaoMesesRef.current
    setCarregandoMeses(true)
    try {
      const lista = await listarMesesPreenchimento(anoAlvo, filial)
      if (!atual()) return
      setMeses(lista)
      setErroMeses(null)
    } catch (falha) {
      if (!atual()) return
      setMeses(SEM_MESES)
      setErroMeses(mensagemDeErro(falha))
    } finally {
      if (atual()) setCarregandoMeses(false)
    }
  }, [])

  /**
   * Aplica a resposta da tela. Com `definirAnoDoPeriodo`, o ano passa a ser o do período aberto da tela
   * recebida e os meses desse ano são consultados.
   */
  const aplicarTela = useCallback(
    (filial: string, resultado: ResultadoTela, definirAnoDoPeriodo: boolean) => {
      setCarregando(false)
      if ('erro' in resultado) {
        definirTela(null)
        setErro(resultado.erro)
        return
      }
      const recebida = resultado.tela
      const anterior = telaRef.current
      definirTela(recebida)
      onTelaRecebidaRef.current?.(recebida, anterior)
      setErro(null)
      setPeriodoConhecido(mesDeCompetencia(recebida.periodoAberto))
      if (!definirAnoDoPeriodo) return
      const anoDoPeriodo = anoDaData(recebida.periodoAberto) ?? anoDaData(recebida.mesDeReferencia)
      if (anoDoPeriodo === null) return
      definirAno(anoDoPeriodo)
      void carregarMeses(filial, anoDoPeriodo)
    },
    [carregarMeses, definirAno, definirTela],
  )

  /**
   * Consulta a tela do mês (`null` = mês aberto) e aplica a resposta só se ainda for a última consulta
   * (`aplicarTela`). Quem chama marca `carregando` (o efeito da filial já o faz na renderização; os
   * demais, por `consultarTela`).
   */
  const carregarTela = useCallback(
    (filial: string, mes: string | null, definirAnoDoPeriodo: boolean): Promise<void> => {
      requisicaoTelaRef.current += 1
      const numero = requisicaoTelaRef.current
      return consultarPreenchimento(filial, mes).then((resultado) => {
        if (montadoRef.current && numero === requisicaoTelaRef.current) aplicarTela(filial, resultado, definirAnoDoPeriodo)
      })
    },
    [aplicarTela],
  )

  /** `carregarTela` a partir de uma ação (troca de mês, recarga, gravação): marca `carregando` antes. */
  const consultarTela = useCallback(
    (filial: string, mes: string | null, definirAnoDoPeriodo: boolean): Promise<void> => {
      setCarregando(true)
      return carregarTela(filial, mes, definirAnoDoPeriodo)
    },
    [carregarTela],
  )

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Filial do cabeçalho: recomeça do mês aberto; sem filial, limpa tudo sem consultar. O estado é
  // reiniciado na própria renderização (valor anterior guardado em estado) e as refs, no efeito.
  const [filialAnterior, setFilialAnterior] = useState(codigoFilial)
  if (filialAnterior !== codigoFilial) {
    setFilialAnterior(codigoFilial)
    setTela(null)
    setAno(null)
    setMesConsulta(null)
    setPeriodoConhecido(null)
    setErro(null)
    setMeses(SEM_MESES)
    setErroMeses(null)
    setCarregandoMeses(false)
    setCarregando(codigoFilial !== null)
  }

  useEffect(() => {
    filialRef.current = codigoFilial
    telaRef.current = null
    anoRef.current = null
    mesConsultaRef.current = null
    requisicaoTelaRef.current += 1
    requisicaoMesesRef.current += 1
    if (codigoFilial !== null) void carregarTela(codigoFilial, null, true)
  }, [codigoFilial, carregarTela])

  const recarregar = useCallback(async (): Promise<void> => {
    const filial = filialRef.current
    if (filial === null) return
    const anoAtual = anoRef.current
    await Promise.all([
      consultarTela(filial, mesConsultaRef.current, anoAtual === null),
      anoAtual === null ? Promise.resolve() : carregarMeses(filial, anoAtual),
    ])
  }, [carregarMeses, consultarTela])

  const selecionarMes = useCallback(
    (mes: string) => {
      const filial = filialRef.current
      if (filial === null) return
      definirMesConsulta(mes)
      void consultarTela(filial, mes, false)
    },
    [consultarTela, definirMesConsulta],
  )

  const mudarAno = useCallback(
    (novoAno: number) => {
      const filial = filialRef.current
      if (filial === null) return
      definirAno(novoAno)
      void carregarMeses(filial, novoAno)
    },
    [carregarMeses, definirAno],
  )

  const irParaPeriodoAberto = useCallback(() => {
    const filial = filialRef.current
    if (filial === null) return
    definirMesConsulta(null)
    void consultarTela(filial, null, true)
  }, [consultarTela, definirMesConsulta])

  const salvar = useCallback(
    async (itens: ItemPreenchimento[]): Promise<ResultadoPreenchimento> => {
      const filial = filialRef.current
      const atual = telaRef.current
      if (filial === null || atual === null) throw new ApiError(400, MENSAGEM_FILIAL_OBRIGATORIA)
      const resultado = await salvarPreenchimento({ filial, mesDeReferencia: atual.mesDeReferencia, itens })
      // Recarrega a tela (mesmo mês) e os meses (pendentes do mês aberto), só se a filial do cabeçalho
      // ainda for a da gravação: com outra filial, a tela e os meses já são os dela.
      if (!montadoRef.current || filialRef.current !== filial) return resultado
      void consultarTela(filial, mesConsultaRef.current, false)
      if (anoRef.current !== null) void carregarMeses(filial, anoRef.current)
      return resultado
    },
    [carregarMeses, consultarTela],
  )

  const semFilial = codigoFilial === null
  const telaAtual = semFilial ? null : tela

  return {
    codigoFilial,
    tela: telaAtual,
    carregando: semFilial ? false : carregando,
    erro: semFilial ? null : erro,
    recarregar,
    ano: semFilial ? null : ano,
    meses: semFilial ? SEM_MESES : meses,
    carregandoMeses: semFilial ? false : carregandoMeses,
    erroMeses: semFilial ? null : erroMeses,
    mesSelecionado: semFilial ? null : (mesConsulta ?? mesDeCompetencia(telaAtual?.mesDeReferencia)),
    periodoAberto: semFilial ? null : (mesDeCompetencia(telaAtual?.periodoAberto) ?? periodoConhecido),
    selecionarMes,
    mudarAno,
    irParaPeriodoAberto,
    salvar,
  }
}
