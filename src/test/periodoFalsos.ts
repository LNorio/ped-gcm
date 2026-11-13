/**
 * API falsa da abertura de período (F9.11 — RF-75, RF-76; F9.12 — reabertura de mês passado), para os
 * testes de integração da aba Preenchimento. Contrato: `docs/backend/API (28).md`, seção "Período
 * aberto". Somente `fetch` é simulado (ver `apiFalsa.ts`).
 *
 * `criarApiPeriodoFalsa` guarda o mês aberto e o histórico de aberturas e responde, de forma coerente
 * com esse estado:
 * - `GET  /api/ped/periodo`               o mês aberto (`periodoApi`, de `preenchimentoFalsos.ts`);
 * - `GET  /api/ped/periodo/historico`     as aberturas, da mais recente para a mais antiga;
 * - `POST /api/ped/periodo/abrir`         recusa o mês já aberto e o mês futuro (posterior a
 *                                          `MES_ATUAL_FALSO`) com `400`; senão abre (`"periodo aberto"`)
 *                                          ou reabre um mês passado (`"periodo reaberto"`), registra a
 *                                          abertura por `ABERTO_POR_FALSO` e responde `201`;
 * - `GET  /api/ped/preenchimento`         a tela do mês pedido (`mes_de_referencia`) ou, sem ele, a do
 *                                          mês aberto (`telaPreenchimentoApi`), aberta ou fechada;
 * - `GET  /api/ped/preenchimento/meses`   os 12 meses do ano: antes do aberto `fechado`, o aberto
 *                                          `aberto`, depois dele `fechado` até o mês atual e `futuro`
 *                                          depois do mês atual.
 *
 * O "mês atual" do cenário é novembro/2026 (`MES_ATUAL_FALSO`); os testes fixam o relógio em
 * 13/11/2026 (`DATA_ATUAL_FALSA`) com `vi.useFakeTimers({ toFake: ['Date'] })`.
 */
import { respostaErro, respostaJson, type RotaFalsa } from './apiFalsa'
import {
  historicoPeriodosApi,
  periodoApi,
  telaPreenchimentoApi,
  type MesPreenchimentoApiFalso,
  type PeriodoApiFalso,
} from './preenchimentoFalsos'

/** Data "de hoje" dos testes de abertura de período (13/11/2026 12:00, horário local). */
export const DATA_ATUAL_FALSA = new Date(2026, 10, 13, 12, 0, 0)
/** Mês atual do cenário (`AAAA-MM-01`): meses posteriores são futuros. */
export const MES_ATUAL_FALSO = '2026-11-01'
/** Quem aparece como autor das aberturas feitas pela API falsa. */
export const ABERTO_POR_FALSO = 'Admin PED'
/** Data registrada nas aberturas feitas pela API falsa. */
export const ABERTO_EM_FALSO = '2026-11-13 12:00:00'

export const MENSAGEM_MES_JA_ABERTO = 'O mês informado já é o período aberto.'
export const MENSAGEM_MES_FUTURO = 'Não é possível abrir um mês futuro.'

export interface ApiPeriodoFalsa {
  rotas: Record<string, RotaFalsa>
  /** Mês aberto no momento (`AAAA-MM-01`). */
  mesAberto: () => string
  /** Histórico atual (mais recente primeiro). */
  historico: () => PeriodoApiFalso[]
}

export interface OpcoesApiPeriodoFalsa {
  /** Mês aberto inicial (`AAAA-MM-01`). Padrão: `2026-10-01` (aberto por Ana Costa). */
  mesAberto?: string
  /** Histórico inicial. Padrão: `historicoPeriodosApi()` (outubro, agosto reaberto, setembro). */
  historico?: PeriodoApiFalso[]
}

/** `AAAA-MM`, `AAAA-MM-DD` ou `AAAA-MM-DD hh:mm:ss` → `AAAA-MM-01`. */
function inicioDoMes(texto: string): string {
  return `${texto.slice(0, 7)}-01`
}

function lerCorpo(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {}
  const corpo: unknown = JSON.parse(init.body)
  return typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {}
}

export function criarApiPeriodoFalsa(opcoes: OpcoesApiPeriodoFalsa = {}): ApiPeriodoFalsa {
  const historicoInicial = opcoes.historico ?? historicoPeriodosApi()
  let historico: PeriodoApiFalso[] = historicoInicial.map((linha) => ({ ...linha }))
  let periodo: PeriodoApiFalso = opcoes.mesAberto
    ? periodoApi({ 'mes de referencia': opcoes.mesAberto })
    : { ...(historico[0] ?? periodoApi()) }

  function telaDoMes(mes: string) {
    const aberto = mes === periodo['mes de referencia']
    return telaPreenchimentoApi({
      'mes de referencia': mes,
      'situacao do mes': aberto ? 'aberto' : 'fechado',
      editavel: aberto,
      'periodo aberto': periodo['mes de referencia'],
      'aberto por': periodo['aberto por'] ?? null,
      'aberto em': periodo['aberto em'] ?? null,
    })
  }

  function mesesDoAno(ano: number): { ano: number; meses: MesPreenchimentoApiFalso[] } {
    const meses = Array.from({ length: 12 }, (_, indice): MesPreenchimentoApiFalso => {
      const referencia = `${ano}-${String(indice + 1).padStart(2, '0')}-01`
      if (referencia === periodo['mes de referencia']) return { 'mes de referencia': referencia, situacao: 'aberto', pendentes: 1 }
      if (referencia > MES_ATUAL_FALSO) return { 'mes de referencia': referencia, situacao: 'futuro' }
      return { 'mes de referencia': referencia, situacao: 'fechado' }
    })
    return { ano, meses }
  }

  const rotas: Record<string, RotaFalsa> = {
    'GET /api/ped/periodo': () => respostaJson({ ...periodo }),
    'GET /api/ped/periodo/historico': () => respostaJson(historico.map((linha) => ({ ...linha }))),
    'POST /api/ped/periodo/abrir': (init) => {
      const enviado = lerCorpo(init)['mes de referencia']
      if (typeof enviado !== 'string') return respostaErro(400, 'Informe o mês de referência.')
      const mes = inicioDoMes(enviado)
      if (mes === periodo['mes de referencia']) return respostaErro(400, MENSAGEM_MES_JA_ABERTO)
      if (mes > MES_ATUAL_FALSO) return respostaErro(400, MENSAGEM_MES_FUTURO)
      const reaberto = mes < periodo['mes de referencia']
      periodo = { 'mes de referencia': mes, 'aberto por': ABERTO_POR_FALSO, 'aberto em': ABERTO_EM_FALSO, reaberto }
      historico = [{ ...periodo }, ...historico]
      return respostaJson(
        { mensagem: reaberto ? 'periodo reaberto' : 'periodo aberto', 'mes de referencia': mes, reaberto },
        201,
      )
    },
    'GET /api/ped/preenchimento': (_init, url) => {
      const pedido = url.searchParams.get('mes_de_referencia')
      return respostaJson(telaDoMes(pedido ? inicioDoMes(pedido) : periodo['mes de referencia']))
    },
    'GET /api/ped/preenchimento/meses': (_init, url) => {
      const ano = Number(url.searchParams.get('ano') ?? periodo['mes de referencia'].slice(0, 4))
      return respostaJson(mesesDoAno(ano))
    },
  }

  return {
    rotas,
    mesAberto: () => periodo['mes de referencia'],
    historico: () => historico.map((linha) => ({ ...linha })),
  }
}
