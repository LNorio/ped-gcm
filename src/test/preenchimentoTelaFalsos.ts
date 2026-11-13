/**
 * API falsa da tela do Preenchimento (F9.2 a F9.8 — RF-60 a RF-70), para os testes de integração da
 * aba Preenchimento. Reaproveita as respostas de `preenchimentoFalsos.ts` (que não deve ser alterado)
 * e guarda o estado dos lançamentos, para que a recarga depois de um `PUT` mostre os valores gravados.
 * Somente `fetch` é simulado (ver `apiFalsa.ts`).
 *
 * Rotas respondidas por `criarApiPreenchimentoFalsa`:
 * - `GET /api/ped/preenchimento`                    sem `mes_de_referencia` (ou com o mês aberto,
 *                                                    `2026-10`) → a tela do mês aberto, com o estado
 *                                                    atual dos lançamentos; outro mês passado → a tela
 *                                                    de mês fechado (`telaMesFechadoApi`) daquele mês;
 *                                                    mês futuro (depois de `2026-11`) → `400`. A `filial`
 *                                                    da resposta é a da query (com o nome de `FILIAIS_API`);
 * - `GET /api/ped/preenchimento/meses`              `ano=2026` → janeiro a setembro fechados, outubro
 *                                                    aberto (pendentes = apontamentos sem valor) e
 *                                                    novembro/dezembro futuros; outro ano → 12 fechados;
 * - `PUT /api/ped/preenchimento`                    lança (sem valor antes) ou corrige (com valor) cada
 *                                                    item e responde `{ mensagem, lancados, corrigidos }`;
 *                                                    `respostaPut` substitui a resposta (ex.: um `400`);
 * - `GET /api/ped/apontamentos/{5|7|9}/historico`   o histórico do apontamento (9: correção e lançamento);
 * - `GET /api/ped/periodo`, `/periodo/historico` e `/api/ped/metas`: respostas padrão, para que as áreas
 *   das outras atividades da F9 (abertura de período e metas) não falhem nos testes desta tela.
 */
import type { ApontamentoPreenchimento, TelaPreenchimento, TipoPreenchimento } from '../types/dominio'
import {
  FILIAIS_API,
  acessoApi,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type FetchFalso,
  type RotaFalsa,
} from './apiFalsa'
import {
  APONTAMENTO_INADIMPLENCIA_API,
  APONTAMENTO_VISITAS_API,
  APONTAMENTO_VITRINE_API,
  historicoApontamentoApi,
  historicoPeriodosApi,
  janelaMetasApi,
  mesesPreenchimentoApi,
  periodoApi,
  telaMesFechadoApi,
  telaPreenchimentoApi,
  type ApontamentoPreenchimentoApiFalso,
  type HistoricoLancamentoApiFalso,
  type TelaPreenchimentoApiFalsa,
} from './preenchimentoFalsos'

/** Mês aberto do cenário (`AAAA-MM`). */
export const MES_ABERTO_FALSO = '2026-10'

export const ROTA_PREENCHIMENTO = '/api/ped/preenchimento'
export const ROTA_MESES = '/api/ped/preenchimento/meses'

/** Corpo do `PUT /api/ped/preenchimento` como enviado pelo front. */
export interface CorpoPreenchimentoEnviado {
  filial: string
  'mes de referencia': string
  itens: Array<{ 'id apontamento': number; valor: number | boolean; motivo?: string }>
}

export interface OpcoesApiPreenchimentoFalsa {
  /** Tela inicial do mês aberto. Padrão: `telaPreenchimentoApi()`. */
  tela?: TelaPreenchimentoApiFalsa
  /** Substitui a resposta do `PUT` (ex.: `() => respostaJson({ mensagem, erros }, 400)`). */
  respostaPut?: RotaFalsa
  /** Históricos por id de apontamento. Padrão: 9 → `historicoApontamentoApi()`; 5 → um lançamento; 7 → vazio. */
  historicos?: Record<number, HistoricoLancamentoApiFalso[]>
}

export interface ApiPreenchimentoFalsa {
  rotas: Record<string, RotaFalsa>
  /** Estado atual da tela do mês aberto (depois dos lançamentos gravados). */
  tela: () => TelaPreenchimentoApiFalsa
}

function copiar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

function apontamentosDe(tela: TelaPreenchimentoApiFalsa): ApontamentoPreenchimentoApiFalso[] {
  return tela.tipos.flatMap((tipo) => tipo.apontamentos ?? [])
}

function nomeDaFilial(codigo: string): string | null {
  return FILIAIS_API.find((filial) => filial.filial === codigo)?.['nome filial'] ?? null
}

export function criarApiPreenchimentoFalsa(opcoes: OpcoesApiPreenchimentoFalsa = {}): ApiPreenchimentoFalsa {
  let tela = copiar(opcoes.tela ?? telaPreenchimentoApi())
  const historicos: Record<number, HistoricoLancamentoApiFalso[]> = opcoes.historicos ?? {
    [APONTAMENTO_INADIMPLENCIA_API.id]: historicoApontamentoApi(),
    [APONTAMENTO_VISITAS_API.id]: [
      { acao: 'lancamento', 'valor anterior': null, 'valor novo': 1234.56, usuario: 'Fulano', motivo: null, data: '2026-10-03 11:15:00' },
    ],
    [APONTAMENTO_VITRINE_API.id]: [],
  }

  const pendentes = () => apontamentosDe(tela).filter((a) => a.valor === null || a.valor === undefined).length

  const comFilial = (resposta: TelaPreenchimentoApiFalsa, url: URL): TelaPreenchimentoApiFalsa => {
    const filial = url.searchParams.get('filial') ?? String(resposta.filial)
    return { ...resposta, filial, 'nome filial': nomeDaFilial(filial) ?? resposta['nome filial'] ?? null }
  }

  const getTela: RotaFalsa = (_init, url) => {
    const mes = url.searchParams.get('mes_de_referencia')
    if (mes === null || mes === MES_ABERTO_FALSO) return respostaJson(comFilial(tela, url))
    if (mes > '2026-11') return respostaErro(400, 'Mês futuro não pode ser consultado.')
    return respostaJson(comFilial({ ...telaMesFechadoApi(), 'mes de referencia': `${mes}-01` }, url))
  }

  const getMeses: RotaFalsa = (_init, url) => {
    const ano = Number(url.searchParams.get('ano'))
    if (ano === 2026) return respostaJson(mesesPreenchimentoApi(2026, 10, pendentes()))
    return respostaJson(mesesPreenchimentoApi(ano, 13))
  }

  const putPreenchimento: RotaFalsa = (init) => {
    const corpo = JSON.parse(String(init?.body)) as CorpoPreenchimentoEnviado
    const nova = copiar(tela)
    let lancados = 0
    let corrigidos = 0
    for (const item of corpo.itens) {
      const apontamento = apontamentosDe(nova).find((a) => a.id === item['id apontamento'])
      if (!apontamento) return respostaErro(400, `Apontamento ${item['id apontamento']} não encontrado.`)
      if (apontamento.valor === null || apontamento.valor === undefined) {
        lancados += 1
        apontamento.situacao = 'Preenchido'
      } else {
        corrigidos += 1
        apontamento.situacao = 'Corrigido'
      }
      apontamento.valor = item.valor
    }
    const total = apontamentosDe(nova).length
    nova.progresso = { preenchidos: total - apontamentosDe(nova).filter((a) => a.valor === null || a.valor === undefined).length, total }
    tela = nova
    return respostaJson({ mensagem: 'preenchimento salvo', lancados, corrigidos })
  }

  const rotasHistorico = Object.fromEntries(
    Object.entries(historicos).map(([id, historico]): [string, RotaFalsa] => [
      `GET /api/ped/apontamentos/${id}/historico`,
      () => respostaJson(historico),
    ]),
  )

  return {
    rotas: {
      [`GET ${ROTA_PREENCHIMENTO}`]: getTela,
      [`GET ${ROTA_MESES}`]: getMeses,
      [`PUT ${ROTA_PREENCHIMENTO}`]: opcoes.respostaPut ?? putPreenchimento,
      ...rotasHistorico,
      'GET /api/ped/periodo': () => respostaJson(periodoApi()),
      'GET /api/ped/periodo/historico': () => respostaJson(historicoPeriodosApi()),
      'GET /api/ped/metas': () => respostaJson(janelaMetasApi()),
    },
    tela: () => tela,
  }
}

// ---------------------------------------------------------------------------
// Mesmo cenário no formato do domínio (já convertido pelo serviço), para os testes unitários dos
// componentes da tela.
// ---------------------------------------------------------------------------

export const APONTAMENTO_VISITAS: ApontamentoPreenchimento = {
  id: 5,
  nome: 'Visitas a clientes',
  descricao: 'Visitas feitas no mês',
  tipoValor: 'numeral',
  situacao: 'preenchido',
  valor: 1234.56,
  indicadores: [{ id: null, nome: 'Cobertura de clientes' }],
  dashboards: [{ id: 1, nome: 'PED Comercial', periodicidade: 'mensal' }],
  imagensCongeladas: [],
}

export const APONTAMENTO_VITRINE: ApontamentoPreenchimento = {
  id: 7,
  nome: 'Vitrine montada',
  descricao: null,
  tipoValor: 'booleano',
  situacao: 'pendente',
  valor: null,
  indicadores: [],
  dashboards: [],
  imagensCongeladas: [],
}

export const APONTAMENTO_INADIMPLENCIA: ApontamentoPreenchimento = {
  id: 9,
  nome: 'Inadimplência',
  descricao: null,
  tipoValor: 'porcentagem',
  situacao: 'corrigido',
  valor: 80,
  indicadores: [{ id: null, nome: 'Inadimplência' }],
  dashboards: [{ id: 2, nome: 'PED Gerentes', periodicidade: 'trimestral' }],
  imagensCongeladas: [{ codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' }],
}

/** Apontamento Numeral pendente, para os testes de lote com mais de um item. */
export const APONTAMENTO_PEDIDOS: ApontamentoPreenchimento = {
  id: 11,
  nome: 'Pedidos digitados',
  descricao: null,
  tipoValor: 'numeral',
  situacao: 'pendente',
  valor: null,
  indicadores: [],
  dashboards: [],
  imagensCongeladas: [],
}

/** Tipos do cenário padrão: Comercial (Visitas, Vitrine) e Financeiro (Inadimplência). */
export function tiposPreenchimento(): TipoPreenchimento[] {
  return [
    { id: 1, nome: 'Comercial', quantidade: 2, apontamentos: [APONTAMENTO_VISITAS, APONTAMENTO_VITRINE] },
    { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [APONTAMENTO_INADIMPLENCIA] },
  ]
}

/** Tela do mês aberto (outubro/2026, filial 101 — CAMPO GRANDE), no formato do domínio. */
export function telaPreenchimento(sobrescrever: Partial<TelaPreenchimento> = {}): TelaPreenchimento {
  return {
    filial: '101',
    nomeFilial: 'CAMPO GRANDE',
    mesDeReferencia: '2026-10-01',
    situacaoDoMes: 'aberto',
    editavel: true,
    periodoAberto: '2026-10-01',
    abertoPor: 'Ana Costa',
    abertoEm: '2026-10-01 08:00:00',
    progresso: { preenchidos: 2, total: 3 },
    tipos: tiposPreenchimento(),
    ...sobrescrever,
  }
}

/** Tela de um mês fechado (setembro/2026), só consulta. */
export function telaMesFechado(sobrescrever: Partial<TelaPreenchimento> = {}): TelaPreenchimento {
  return telaPreenchimento({
    mesDeReferencia: '2026-09-01',
    situacaoDoMes: 'fechado',
    editavel: false,
    tipos: [
      {
        id: 1,
        nome: 'Comercial',
        quantidade: 2,
        apontamentos: [{ ...APONTAMENTO_VISITAS, valor: 1000 }, { ...APONTAMENTO_VITRINE, situacao: 'nao_lancado' }],
      },
      { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [{ ...APONTAMENTO_INADIMPLENCIA, situacao: 'preenchido' }] },
    ],
    ...sobrescrever,
  })
}

// ---------------------------------------------------------------------------
// Integração: sessão + API falsa da tela
// ---------------------------------------------------------------------------

/** Apontamento Numeral pendente no formato da API (mesmo cenário de `APONTAMENTO_PEDIDOS`). */
export const APONTAMENTO_PEDIDOS_API: ApontamentoPreenchimentoApiFalso = {
  id: 11,
  nome: 'Pedidos digitados',
  descricao: null,
  'tipo de valor': 'Numeral',
  situacao: 'Pendente',
  valor: null,
  indicadores: [],
  dashboards: [],
  'imagens congeladas': [],
}

/** Tela do mês aberto com um segundo pendente (Pedidos digitados, Numeral) no tipo Comercial: progresso 2 de 4. */
export function telaComPedidosApi(): TelaPreenchimentoApiFalsa {
  return telaPreenchimentoApi({
    progresso: { preenchidos: 2, total: 4 },
    tipos: [
      { id: 1, nome: 'Comercial', quantidade: 3, apontamentos: [APONTAMENTO_VISITAS_API, APONTAMENTO_VITRINE_API, APONTAMENTO_PEDIDOS_API] },
      { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [APONTAMENTO_INADIMPLENCIA_API] },
    ],
  })
}

export type PerfilPreenchimento = 'admin' | 'validador' | 'preenchedor'

export interface OpcoesSessaoPreenchimento extends OpcoesApiPreenchimentoFalsa {
  /** Rotas que substituem as da API falsa (ex.: um erro no `GET` da tela). */
  rotasExtras?: Record<string, RotaFalsa>
}

/**
 * Simula a sessão (token salvo + `GET /api/ped/acesso`) e a API da tela. O Admin tem acesso a todas as
 * filiais (o cabeçalho começa em "Todas as filiais"); o Validador e o Preenchedor, só à filial 101.
 */
export function simularSessaoPreenchimento(fetchFalso: FetchFalso, perfil: PerfilPreenchimento, opcoes: OpcoesSessaoPreenchimento = {}) {
  const acesso =
    perfil === 'admin'
      ? acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
      : acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
  const api = criarApiPreenchimentoFalsa(opcoes)
  const chamadas = simularApi(fetchFalso, {
    'GET /api/ped/acesso': () => respostaJson(acesso),
    ...api.rotas,
    ...opcoes.rotasExtras,
  })
  return { chamadas, api }
}

/** Chamadas `GET` de um caminho. */
export function getsDe(chamadas: ChamadaRegistrada[], caminho: string): ChamadaRegistrada[] {
  return chamadas.filter((chamada) => chamada.metodo === 'GET' && chamada.caminho === caminho)
}

/** Chamadas `PUT /api/ped/preenchimento`. */
export function putsPreenchimento(chamadas: ChamadaRegistrada[]): ChamadaRegistrada[] {
  return chamadas.filter((chamada) => chamada.metodo === 'PUT' && chamada.caminho === ROTA_PREENCHIMENTO)
}
