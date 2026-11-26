/**
 * Dados falsos de `GET /api/ped/alertas-menu` (F2.12 — alertas das abas do menu desde o login).
 *
 * Exemplos copiados de `docs/backend/FRONT-alertas-menu.md` (guia para o front, 19/11/2026) e da seção
 * "Alertas das abas do menu" de `docs/backend/API (31).md`. Formato da API:
 * `{ "abas": { "<aba>": { "total": n, "itens": [{ "codigo", "quantidade", "descricao" }] } } }`.
 *
 * - Admin e Validador recebem as 9 abas; o Preenchedor só `inicio`, `apontamentos`, `dados-externos` e
 *   `preenchimento` (a aba que o perfil não acessa não vem).
 * - `dados-externos` só tem alerta para o Admin; `integracao pendente` de `indicadores` vale também para o
 *   Validador (decisão do negócio de 19/11/2026).
 */
import { respostaJson, type RotaFalsa } from './apiFalsa'

export const ROTA_ALERTAS_MENU = '/api/ped/alertas-menu'
export const CHAVE_ROTA_ALERTAS_MENU = `GET ${ROTA_ALERTAS_MENU}`

export interface ItemAlertaMenuApiFalso {
  codigo: string
  quantidade: number
  descricao: string | null
}

export interface AbaAlertaMenuApiFalsa {
  total: number
  itens: ItemAlertaMenuApiFalso[]
}

export interface AlertasMenuApiFalsa {
  abas: Record<string, AbaAlertaMenuApiFalsa>
}

const SEM_ALERTA = (): AbaAlertaMenuApiFalsa => ({ total: 0, itens: [] })

/** Exemplo encurtado do guia (`FRONT-alertas-menu.md`, seção "A rota"). */
export function alertasMenuGuiaApi(): AlertasMenuApiFalsa {
  return {
    abas: {
      inicio: { total: 0, itens: [] },
      'dados-externos': {
        total: 4,
        itens: [{ codigo: 'integracao pendente', quantidade: 4, descricao: '4 dados externos sem integração configurada' }],
      },
      indicadores: {
        total: 3,
        itens: [
          { codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' },
          { codigo: 'integracao pendente', quantidade: 1, descricao: '1 indicador com integração da meta pendente' },
        ],
      },
    },
  }
}

/** Exemplo completo do Admin (`API (31).md`, seção "Alertas das abas do menu"): as 9 abas na ordem do menu. */
export function alertasMenuAdminApi(): AlertasMenuApiFalsa {
  return {
    abas: {
      inicio: SEM_ALERTA(),
      tipos: SEM_ALERTA(),
      apontamentos: SEM_ALERTA(),
      'dados-externos': {
        total: 4,
        itens: [{ codigo: 'integracao pendente', quantidade: 4, descricao: '4 dados externos sem integração configurada' }],
      },
      indicadores: {
        total: 6,
        itens: [
          { codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' },
          { codigo: 'meta pendente por filial', quantidade: 3, descricao: '3 indicadores com filial sem meta' },
          { codigo: 'integracao pendente', quantidade: 1, descricao: '1 indicador com integração da meta pendente' },
        ],
      },
      faixas: SEM_ALERTA(),
      dashboards: SEM_ALERTA(),
      preenchimento: SEM_ALERTA(),
      fechamentos: SEM_ALERTA(),
    },
  }
}

/** Validador: as 9 abas; `indicadores` com `integracao pendente` (19/11/2026) e `dados-externos` com `total: 0`. */
export function alertasMenuValidadorApi(): AlertasMenuApiFalsa {
  return {
    abas: {
      inicio: SEM_ALERTA(),
      tipos: SEM_ALERTA(),
      apontamentos: SEM_ALERTA(),
      'dados-externos': SEM_ALERTA(),
      indicadores: {
        total: 3,
        itens: [
          { codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' },
          { codigo: 'integracao pendente', quantidade: 1, descricao: '1 indicador com integração da meta pendente' },
        ],
      },
      faixas: SEM_ALERTA(),
      dashboards: SEM_ALERTA(),
      preenchimento: SEM_ALERTA(),
      fechamentos: SEM_ALERTA(),
    },
  }
}

/** Preenchedor: só as 4 abas do menu dele, todas sem alerta. */
export function alertasMenuPreenchedorApi(): AlertasMenuApiFalsa {
  return {
    abas: {
      inicio: SEM_ALERTA(),
      apontamentos: SEM_ALERTA(),
      'dados-externos': SEM_ALERTA(),
      preenchimento: SEM_ALERTA(),
    },
  }
}

/** Admin sem nenhum alerta (as 9 abas com `total: 0`). */
export function alertasMenuAdminSemAlertasApi(): AlertasMenuApiFalsa {
  return {
    abas: {
      inicio: SEM_ALERTA(),
      tipos: SEM_ALERTA(),
      apontamentos: SEM_ALERTA(),
      'dados-externos': SEM_ALERTA(),
      indicadores: SEM_ALERTA(),
      faixas: SEM_ALERTA(),
      dashboards: SEM_ALERTA(),
      preenchimento: SEM_ALERTA(),
      fechamentos: SEM_ALERTA(),
    },
  }
}

/** Resposta padrão usada por `simularApi` quando o teste não configura a rota: nenhuma aba. */
export function alertasMenuVazioApi(): AlertasMenuApiFalsa {
  return { abas: {} }
}

export type PerfilAlertasMenuFalso = 'admin' | 'validador' | 'preenchedor'

/** Rota falsa de `GET /api/ped/alertas-menu` com o exemplo do perfil. */
export function rotaAlertasMenuFalsa(perfil: PerfilAlertasMenuFalso): RotaFalsa {
  return () => {
    if (perfil === 'validador') return respostaJson(alertasMenuValidadorApi())
    if (perfil === 'preenchedor') return respostaJson(alertasMenuPreenchedorApi())
    return respostaJson(alertasMenuAdminApi())
  }
}

/** 429 do limite de chamadas (`throttle:ped-alertas`): corpo com o tempo e cabeçalho `Retry-After`. */
export function respostaLimiteAlertasMenu(segundos: number): Response {
  return new Response(
    JSON.stringify({ mensagem: 'Muitas consultas. Tente novamente em instantes.', 'segundos para tentar novamente': segundos }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(segundos) } },
  )
}

/** Mensagem genérica do 500 da rota (`API (31).md`). */
export const MENSAGEM_ERRO_ALERTAS_MENU = 'erro ao consultar os alertas do menu'
