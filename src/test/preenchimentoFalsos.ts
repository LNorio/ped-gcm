/**
 * Respostas da API da fase Preenchimento (F9 — RF-60 a RF-76) no formato do back-end (chaves com
 * espaço), para os testes da F9. Ver `docs/backend/API (27).md`, seções "Período aberto",
 * "fase 2 ... Preenchimento" e "Metas no preenchimento (RF-71 a RF-74)", e
 * `docs/backend/FRONT-PED-mudancas (1).md`, item 6 (reabertura de mês).
 *
 * Cenário padrão (filial 101 — CAMPO GRANDE, mês aberto outubro/2026, aberto por Ana Costa em
 * 01/10/2026 08:00, não é reabertura):
 * - meses de 2026 (`mesesPreenchimentoApi`): janeiro a setembro `fechado`, outubro `aberto` com
 *   1 pendente, novembro e dezembro `futuro`;
 * - tela do mês (`telaPreenchimentoApi`), progresso 2 de 3:
 *   - tipo 1 Comercial (2): (5) "Visitas a clientes" Numeral, Preenchido, 1234.56, indicador
 *     "Cobertura de clientes", dashboard "PED Comercial" (mensal), sem imagens; (7) "Vitrine montada"
 *     Booleano, Pendente, sem valor, sem indicadores nem dashboards;
 *   - tipo 2 Financeiro (1): (9) "Inadimplência" Porcentagem, Corrigido, 80, indicador "Inadimplência",
 *     dashboard "PED Gerentes" (trimestral) e imagem congelada IMG-000012 (PED Gerentes · 3º tri/2026);
 * - histórico do apontamento 9 (`historicoApontamentoApi`): correção 75 → 80 (Ana Costa, "digitação
 *   errada", 20/10/2026 10:00) e lançamento de 75 (Fulano, 05/10/2026 09:00);
 * - histórico de aberturas (`historicoPeriodosApi`): outubro (Ana Costa, 01/10/2026 08:00), agosto
 *   reaberto (Admin PED, 20/09/2026 14:00) e setembro (Admin PED, 01/09/2026 07:00);
 * - "Editar metas" (`janelaMetasApi`), mês aberto e editável: (12) "Cobertura de clientes" (Comercial,
 *   apontamento 5) meta do cadastro 1500 (geral), vigente 2000.25, ajustada; (13) "Faturamento"
 *   (Comercial, dado externo 3) meta do cadastro 500000 (filial), vigente 500000, sem ajuste.
 *
 * Formatos conforme as respostas reais do back-end (F9.13*, `docs/backend/exemplos-reais/`):
 * - meses: `{ filial, ano, "periodo aberto", meses: [{ mes: "AAAA-MM-01", situacao, pendentes }] }`
 *   (`pendentes` `null` fora do mês aberto);
 * - apontamento do preenchimento: `id`, `nome`, `descricao`, `"tipo de valor"`, `situacao`, `valor`,
 *   `"lancado em"` (não exibido), `indicadores` (nomes), `dashboards` (`{ id, nome, periodicidade }`) e
 *   `"imagens congeladas"` (`{ codigo, dashboard, periodo }`);
 * - histórico de aberturas e do apontamento: lista pura (o serviço também aceita `{ historico }`);
 * - "Editar metas": `{ filial, "mes de referencia", "situacao do mes", editavel, indicadores, quantidade }`,
 *   com `composicao` como lista de nomes dos itens (ex.: `["Visitas a clientes"]`).
 */

export type ValorLancamentoApi = number | boolean | string | null

export interface PeriodoApiFalso {
  'mes de referencia': string
  'aberto por'?: string | null
  'aberto em'?: string | null
  reaberto?: boolean | null
}

export function periodoApi(sobrescrever: Partial<PeriodoApiFalso> = {}): PeriodoApiFalso {
  return {
    'mes de referencia': '2026-10-01',
    'aberto por': 'Ana Costa',
    'aberto em': '2026-10-01 08:00:00',
    reaberto: false,
    ...sobrescrever,
  }
}

export function historicoPeriodosApi(): PeriodoApiFalso[] {
  return [
    periodoApi(),
    { 'mes de referencia': '2026-08-01', 'aberto por': 'Admin PED', 'aberto em': '2026-09-20 14:00:00', reaberto: true },
    { 'mes de referencia': '2026-09-01', 'aberto por': 'Admin PED', 'aberto em': '2026-09-01 07:00:00', reaberto: false },
  ]
}

export type SituacaoMesApi = 'aberto' | 'fechado' | 'futuro'

export interface MesPreenchimentoApiFalso {
  /** Formato antigo (ainda aceito pelo serviço). */
  'mes de referencia'?: string
  /** Formato real: data `AAAA-MM-DD` (dia 01); o número de 1 a 12 é o formato antigo. */
  mes?: string | number
  situacao: SituacaoMesApi | string
  pendentes?: number | null
}

/** Envelope real de `GET /api/ped/preenchimento/meses`. */
export interface MesesPreenchimentoApiFalsos {
  filial: string
  ano: number
  'periodo aberto': string | null
  meses: MesPreenchimentoApiFalso[]
}

/**
 * Os 12 meses do ano no formato real (`mes: "AAAA-MM-01"`): antes de `mesAberto` fechados, `mesAberto`
 * aberto (com `pendentes`), depois futuros; `pendentes` `null` fora do mês aberto. `mesAberto` fora de
 * 1 a 12 (ex.: 13) = nenhum mês aberto no ano (`"periodo aberto"` `null`).
 */
export function mesesPreenchimentoApi(ano = 2026, mesAberto = 10, pendentes = 1, filial = '101'): MesesPreenchimentoApiFalsos {
  const referencia = (mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`
  const meses = Array.from({ length: 12 }, (_, indice): MesPreenchimentoApiFalso => {
    const mes = indice + 1
    if (mes < mesAberto) return { mes: referencia(mes), situacao: 'fechado', pendentes: null }
    if (mes === mesAberto) return { mes: referencia(mes), situacao: 'aberto', pendentes }
    return { mes: referencia(mes), situacao: 'futuro', pendentes: null }
  })
  return { filial, ano, 'periodo aberto': mesAberto >= 1 && mesAberto <= 12 ? referencia(mesAberto) : null, meses }
}

export interface DashboardDoApontamentoApiFalso {
  id?: number | null
  nome: string
  periodicidade?: string | null
}

export interface ImagemCongeladaApiFalsa {
  codigo?: string | null
  dashboard?: string | null
  periodo?: string | null
}

export interface ApontamentoPreenchimentoApiFalso {
  id: number
  nome: string
  descricao?: string | null
  'tipo de valor': string
  situacao: string
  valor?: ValorLancamentoApi
  /** Data/hora do lançamento (formato real, ex.: `"2026-10-03 11:15:00-04:00"`); não é exibida. */
  'lancado em'?: string | null
  indicadores?: unknown
  dashboards?: unknown
  'imagens congeladas'?: unknown
}

export const APONTAMENTO_VISITAS_API: ApontamentoPreenchimentoApiFalso = {
  id: 5,
  nome: 'Visitas a clientes',
  descricao: 'Visitas feitas no mês',
  'tipo de valor': 'Numeral',
  situacao: 'Preenchido',
  valor: 1234.56,
  'lancado em': '2026-10-03 11:15:00-04:00',
  indicadores: ['Cobertura de clientes'],
  dashboards: [{ id: 1, nome: 'PED Comercial', periodicidade: 'mensal' }],
  'imagens congeladas': [],
}

export const APONTAMENTO_VITRINE_API: ApontamentoPreenchimentoApiFalso = {
  id: 7,
  nome: 'Vitrine montada',
  descricao: null,
  'tipo de valor': 'Booleano',
  situacao: 'Pendente',
  valor: null,
  'lancado em': null,
  indicadores: [],
  dashboards: [],
  'imagens congeladas': [],
}

export const APONTAMENTO_INADIMPLENCIA_API: ApontamentoPreenchimentoApiFalso = {
  id: 9,
  nome: 'Inadimplência',
  descricao: null,
  'tipo de valor': 'Porcentagem',
  situacao: 'Corrigido',
  valor: 80,
  'lancado em': '2026-10-20 10:00:00-04:00',
  indicadores: ['Inadimplência'],
  dashboards: [{ id: 2, nome: 'PED Gerentes', periodicidade: 'trimestral' }],
  'imagens congeladas': [{ codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' }],
}

export interface TipoPreenchimentoApiFalso {
  id: number
  nome: string
  quantidade?: number | null
  apontamentos?: ApontamentoPreenchimentoApiFalso[] | null
}

export interface TelaPreenchimentoApiFalsa {
  filial: string | number
  'nome filial'?: string | null
  'mes de referencia': string
  'situacao do mes': string
  editavel?: boolean | null
  'periodo aberto'?: string | null
  'aberto por'?: string | null
  'aberto em'?: string | null
  progresso?: { preenchidos: number; total: number } | null
  tipos: TipoPreenchimentoApiFalso[]
}

export function telaPreenchimentoApi(sobrescrever: Partial<TelaPreenchimentoApiFalsa> = {}): TelaPreenchimentoApiFalsa {
  return {
    filial: '101',
    'nome filial': 'CAMPO GRANDE',
    'mes de referencia': '2026-10-01',
    'situacao do mes': 'aberto',
    editavel: true,
    'periodo aberto': '2026-10-01',
    'aberto por': 'Ana Costa',
    'aberto em': '2026-10-01 08:00:00',
    progresso: { preenchidos: 2, total: 3 },
    tipos: [
      { id: 1, nome: 'Comercial', quantidade: 2, apontamentos: [APONTAMENTO_VISITAS_API, APONTAMENTO_VITRINE_API] },
      { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [APONTAMENTO_INADIMPLENCIA_API] },
    ],
    ...sobrescrever,
  }
}

/** Tela de um mês fechado (setembro/2026): só consulta; o apontamento 7 aparece "Nao lancado". */
export function telaMesFechadoApi(): TelaPreenchimentoApiFalsa {
  return telaPreenchimentoApi({
    'mes de referencia': '2026-09-01',
    'situacao do mes': 'fechado',
    editavel: false,
    tipos: [
      {
        id: 1,
        nome: 'Comercial',
        quantidade: 2,
        apontamentos: [{ ...APONTAMENTO_VISITAS_API, valor: 1000 }, { ...APONTAMENTO_VITRINE_API, situacao: 'Nao lancado' }],
      },
      { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [{ ...APONTAMENTO_INADIMPLENCIA_API, situacao: 'Preenchido' }] },
    ],
  })
}

export interface HistoricoLancamentoApiFalso {
  acao: string
  'valor anterior'?: ValorLancamentoApi
  'valor novo'?: ValorLancamentoApi
  usuario?: string | null
  motivo?: string | null
  data: string
}

export function historicoApontamentoApi(): HistoricoLancamentoApiFalso[] {
  return [
    { acao: 'correcao', 'valor anterior': 75, 'valor novo': 80, usuario: 'Ana Costa', motivo: 'digitação errada', data: '2026-10-20 10:00:00' },
    { acao: 'lancamento', 'valor anterior': null, 'valor novo': 75, usuario: 'Fulano', motivo: null, data: '2026-10-05 09:00:00' },
  ]
}

export interface IndicadorMetaApiFalso {
  id: number
  nome: string
  tipos?: unknown
  composicao?: unknown
  sentido?: string | null
  'meta do cadastro'?: number | string | null
  'meta do cadastro origem'?: string | null
  'meta vigente'?: number | string | null
  ajustada?: boolean | null
}

export const INDICADOR_META_COBERTURA_API: IndicadorMetaApiFalso = {
  id: 12,
  nome: 'Cobertura de clientes',
  tipos: ['Comercial'],
  composicao: ['Visitas a clientes'],
  sentido: 'maior_melhor',
  'meta do cadastro': 1500,
  'meta do cadastro origem': 'geral',
  'meta vigente': 2000.25,
  ajustada: true,
}

export const INDICADOR_META_FATURAMENTO_API: IndicadorMetaApiFalso = {
  id: 13,
  nome: 'Faturamento',
  tipos: ['Comercial'],
  composicao: ['Faturamento'],
  sentido: 'maior_melhor',
  'meta do cadastro': 500000,
  'meta do cadastro origem': 'filial',
  'meta vigente': 500000,
  ajustada: false,
}

export interface JanelaMetasApiFalsa {
  filial?: string
  'mes de referencia'?: string
  'situacao do mes': string
  editavel?: boolean | null
  indicadores: IndicadorMetaApiFalso[]
  quantidade?: number
}

/** Janela no formato real; `quantidade` acompanha os indicadores, salvo se sobrescrita. */
export function janelaMetasApi(sobrescrever: Partial<JanelaMetasApiFalsa> = {}): JanelaMetasApiFalsa {
  const janela: JanelaMetasApiFalsa = {
    filial: '101',
    'mes de referencia': '2026-10-01',
    'situacao do mes': 'aberto',
    editavel: true,
    indicadores: [INDICADOR_META_COBERTURA_API, INDICADOR_META_FATURAMENTO_API],
    ...sobrescrever,
  }
  return { ...janela, quantidade: sobrescrever.quantidade ?? janela.indicadores.length }
}
