/**
 * Fixtures de "Editar metas" no Preenchimento (F9.9 — RF-71 a RF-73, RN-07) e do histórico de ajustes
 * de meta do mês (F9.10 — RF-74, RNF-01). Complementam `preenchimentoFalsos.ts` (que não muda).
 *
 * Cenário padrão (filial 101 — CAMPO GRANDE, outubro/2026 aberto):
 * - (12) "Cobertura de clientes" — Comercial, apontamento 5; meta do cadastro 1500 (geral), vigente
 *   2000.25, ajustada;
 * - (13) "Faturamento" — Comercial, dado externo 3; meta do cadastro 500000 (filial), vigente 500000;
 * - (14) "Inadimplência" — Financeiro, apontamento 9; meta do cadastro 5 (geral), vigente 5 (só em
 *   `janelaMetasComFinanceiroApi`, para o filtro por tipo).
 *
 * Histórico de metas do indicador 12 na filial 101 em 10/2026 (`historicoMetaPreenchimentoApi`), do
 * mais recente ao mais antigo: 1.800,00 → 2.000,25 (Ana Costa, "sazonalidade", 20/10/2026 14:30) e
 * 1.500,00 → 1.800,00 (Fulano, "campanha de clientes", 05/10/2026 09:00).
 */
import type { IndicadorMetaPreenchimento, JanelaMetas } from '../types/dominio'
import { respostaErro, respostaJson, type RotaFalsa } from './apiFalsa'
import {
  INDICADOR_META_COBERTURA_API,
  INDICADOR_META_FATURAMENTO_API,
  janelaMetasApi,
  type IndicadorMetaApiFalso,
  type JanelaMetasApiFalsa,
} from './preenchimentoFalsos'

// ---------------------------------------------------------------------------
// Domínio (testes unitários dos componentes)
// ---------------------------------------------------------------------------

export const INDICADOR_META_COBERTURA: IndicadorMetaPreenchimento = {
  id: 12,
  nome: 'Cobertura de clientes',
  tipos: ['Comercial'],
  composicao: { tipo: 'apontamentos', itens: [{ id: 5, nome: 'Visitas a clientes', ativo: true }] },
  sentido: 'maior_melhor',
  metaDoCadastro: 1500,
  metaDoCadastroOrigem: 'geral',
  metaVigente: 2000.25,
  ajustada: true,
}

export const INDICADOR_META_FATURAMENTO: IndicadorMetaPreenchimento = {
  id: 13,
  nome: 'Faturamento',
  tipos: ['Comercial'],
  composicao: { tipo: 'dado_externo', itens: [{ id: 3, nome: 'Faturamento (ERP)', ativo: true }] },
  sentido: 'maior_melhor',
  metaDoCadastro: 500000,
  metaDoCadastroOrigem: 'filial',
  metaVigente: 500000,
  ajustada: false,
}

export const INDICADOR_META_INADIMPLENCIA: IndicadorMetaPreenchimento = {
  id: 14,
  nome: 'Inadimplência',
  tipos: ['Financeiro'],
  composicao: { tipo: 'apontamentos', itens: [{ id: 9, nome: 'Títulos em atraso', ativo: true }] },
  sentido: 'menor_melhor',
  metaDoCadastro: 5,
  metaDoCadastroOrigem: 'geral',
  metaVigente: 5,
  ajustada: false,
}

/** Janela do mês aberto (editável) com os indicadores 12, 13 e 14. */
export function janelaMetas(sobrescrever: Partial<JanelaMetas> = {}): JanelaMetas {
  return {
    situacaoDoMes: 'aberto',
    editavel: true,
    indicadores: [INDICADOR_META_COBERTURA, INDICADOR_META_FATURAMENTO, INDICADOR_META_INADIMPLENCIA],
    ...sobrescrever,
  }
}

// ---------------------------------------------------------------------------
// API (testes de integração)
// ---------------------------------------------------------------------------

export const INDICADOR_META_INADIMPLENCIA_API: IndicadorMetaApiFalso = {
  id: 14,
  nome: 'Inadimplência',
  tipos: ['Financeiro'],
  composicao: { tipo: 'apontamentos', itens: [{ id: 9, nome: 'Títulos em atraso', ativo: true }] },
  sentido: 'menor_melhor',
  'meta do cadastro': 5,
  'meta do cadastro origem': 'geral',
  'meta vigente': 5,
  ajustada: false,
}

/** Janela do mês aberto com um indicador do tipo Financeiro além dos dois do Comercial. */
export function janelaMetasComFinanceiroApi(): JanelaMetasApiFalsa {
  return janelaMetasApi({ indicadores: [INDICADOR_META_COBERTURA_API, INDICADOR_META_FATURAMENTO_API, INDICADOR_META_INADIMPLENCIA_API] })
}

export interface HistoricoMetaPreenchimentoApiFalso {
  data: string
  filial: string
  'mes de referencia': string
  de: number | null
  para: number
  usuario: string
  motivo: string
}

/** Ajustes da meta do indicador 12 na filial 101 em outubro/2026, do mais recente ao mais antigo. */
export function historicoMetaPreenchimentoApi(): HistoricoMetaPreenchimentoApiFalso[] {
  return [
    { data: '2026-10-20 14:30:00', filial: '101', 'mes de referencia': '2026-10-01', de: 1800, para: 2000.25, usuario: 'Ana Costa', motivo: 'sazonalidade' },
    { data: '2026-10-05 09:00:00', filial: '101', 'mes de referencia': '2026-10-01', de: 1500, para: 1800, usuario: 'Fulano', motivo: 'campanha de clientes' },
  ]
}

/** Mensagem do 403 do `PUT /api/ped/metas` para indicador da fonte `integracao` (meta via API). */
export const MENSAGEM_403_META_INTEGRACAO = 'o indicador 15 tem a meta definida pela integracao e nao pode ser ajustado'
/** Mensagem do 400 do `PUT /api/ped/metas` para indicador sem meta cadastrada para a filial. */
export const MENSAGEM_400_SEM_META_FILIAL = 'o indicador 13 nao tem meta cadastrada para a filial'

interface ItemPutMetas {
  'id indicador': number
  meta: number
  motivo: string
}

interface CorpoPutMetas {
  filial: string
  'mes de referencia': string
  itens: ItemPutMetas[]
}

export interface ApiMetasFalsa {
  /** Rotas `GET /api/ped/metas` e `PUT /api/ped/metas`. */
  rotas: Record<string, RotaFalsa>
  /** Estado atual dos indicadores (após os ajustes aceitos). */
  indicadores: () => IndicadorMetaApiFalso[]
}

/**
 * API falsa de "Editar metas": o `GET` devolve o estado atual (com `situacao do mes` e `editavel` da
 * janela inicial); o `PUT` aceito marca os itens como `ajustada` com a nova `meta vigente` e responde
 * `{ mensagem: "metas ajustadas", ajustadas }`. `respostaPut` substitui a resposta do `PUT` (ex.: 400, 403).
 */
export function criarApiMetasFalsa(
  janelaInicial: JanelaMetasApiFalsa = janelaMetasApi(),
  respostaPut?: (corpo: CorpoPutMetas) => Response | Promise<Response>,
): ApiMetasFalsa {
  let indicadores = janelaInicial.indicadores.map((indicador) => ({ ...indicador }))
  return {
    indicadores: () => indicadores,
    rotas: {
      'GET /api/ped/metas': () => respostaJson({ ...janelaInicial, indicadores }),
      'PUT /api/ped/metas': (init) => {
        const corpo = JSON.parse(String(init?.body ?? '{}')) as CorpoPutMetas
        if (respostaPut) return respostaPut(corpo)
        if (!Array.isArray(corpo.itens)) return respostaErro(400, 'itens obrigatorios')
        indicadores = indicadores.map((indicador) => {
          const item = corpo.itens.find((i) => i['id indicador'] === indicador.id)
          return item ? { ...indicador, 'meta vigente': item.meta, ajustada: true } : indicador
        })
        return respostaJson({ mensagem: 'metas ajustadas', ajustadas: corpo.itens.length })
      },
    },
  }
}
