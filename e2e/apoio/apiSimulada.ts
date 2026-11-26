/**
 * Back-end simulado dos testes E2E (a API real não está disponível nos testes).
 *
 * Reaproveita as rotas falsas dos testes de integração (`src/test/*Falsos.ts`, formato
 * `RotaFalsa = (init, url) => Response`) e os exemplos reais de `docs/backend/exemplos-reais/`: cada
 * requisição do navegador para `/api/**` é interceptada por `page.route`, convertida em `(init, url)`,
 * respondida pela rota falsa da chave `"MÉTODO /caminho"` e devolvida ao navegador.
 *
 * - Rotas sem simulação respondem 404 "Rota não simulada" e ficam em `naoSimuladas` (os specs verificam
 *   que a lista termina vazia nas telas cobertas).
 * - `GET /api/ped/alertas-menu` sem rota configurada responde `{ "abas": {} }` (como `simularApi`).
 * - Todas as chamadas ficam em `chamadas`, para conferir método, query, corpo e cabeçalhos.
 *
 * Só `src/test/apiFalsa.ts` (tipos do Vitest apenas) e os arquivos `*Falsos.ts` sem dependência de
 * runtime do Vitest/Testing Library são importados (não importar `sessaoFalsa`, `pdfFalsos`,
 * `previaFalsos`, `menuAcoes`, `usuario` nem `setup`).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page, Request } from '@playwright/test'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson, type AcessoApiFalso, type RotaFalsa } from '../../src/test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../src/test/apontamentosFalsos'
import { dadosExternosAdminApi, identificadoresApi, rotaIntegracoesPendentes, rotaListarDadosExternos } from '../../src/test/dadosExternosFalsos'
import {
  DASHBOARD_SUPERVISORES_API,
  dashboardsApi,
  previaTarefaApi,
  respostaGravacaoApi,
  rotaListarDashboards,
  rotaVinculos,
  tarefaBitrixGravacaoApi,
  type DashboardApiFalso,
} from '../../src/test/dashboardsFalsos'
import { criarApiFaixasFalsa } from '../../src/test/faixasFalsos'
import { indicadoresApi, rotaListarIndicadores } from '../../src/test/indicadoresFalsos'
import { rotaInicioFalsa } from '../../src/test/inicioFalsos'
import { criarApiPreenchimentoFalsa, telaComPedidosApi } from '../../src/test/preenchimentoTelaFalsos'
import { colaboradoresApi, gruposApi, tiposApi, type TipoApontamentoApiFalso } from '../../src/test/tiposFalsos'

export type Perfil = 'admin' | 'validador' | 'preenchedor'

export const TOKEN = 'token-e2e'

/** Lê um exemplo real do back-end (`docs/backend/exemplos-reais/<nome>.json`). */
export function exemploReal(nome: string): unknown {
  const caminho = fileURLToPath(new URL(`../../docs/backend/exemplos-reais/${nome}.json`, import.meta.url))
  return JSON.parse(readFileSync(caminho, 'utf8')) as unknown
}

/** PDF mínimo válido (uma página em branco), servido no lugar do PDF gerado pelo back-end. */
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
)

export interface ChamadaE2E {
  metodo: string
  caminho: string
  url: URL
  corpo: unknown
  cabecalhos: Record<string, string>
}

/** Acesso de cada perfil: Admin e Validador com todas as filiais; Preenchedor só com a 101. */
export function acessoDoPerfil(perfil: Perfil): AcessoApiFalso {
  return perfil === 'preenchedor'
    ? acessoApi({ perfil, nome: 'Fulano', tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
    : acessoApi({ perfil, nome: 'Fulano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
}

/**
 * Rotas de todas as abas para o perfil, com estado (os cadastros entram nas listas seguintes). Cada
 * mapa é consultado no momento da chamada: rotas acrescentadas depois (ex.: imagens geradas) valem.
 */
function rotasDoSistema(perfil: Perfil): Record<string, RotaFalsa>[] {
  let tipos: TipoApontamentoApiFalso[] = tiposApi()
  let dashboards: DashboardApiFalso[] = dashboardsApi()
  const faixas = criarApiFaixasFalsa()
  const preenchimento = criarApiPreenchimentoFalsa({ tela: telaComPedidosApi() })

  const fechamentosReais = exemploReal('fechamentos')
  const previaReal = exemploReal('previa')
  const imagensReais = exemploReal('imagens')

  const base: Record<string, RotaFalsa> = {
    'GET /api/ped/acesso': () => respostaJson(acessoDoPerfil(perfil)),
    'GET /api/ped/inicio': rotaInicioFalsa(perfil),

    // Tipos (F3)
    'GET /api/ped/tipos-apontamento': () => respostaJson(tipos),
    'GET /api/ped/grupos': () => respostaJson(gruposApi()),
    'POST /api/ped/tipos-apontamento': (init) => {
      const corpo = JSON.parse(String(init?.body)) as { nome: string; grupos: number[]; usuarios: number[] }
      const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
      const nomesUsuarios = new Map(colaboradoresApi().map((c) => [c['id colaborador'], c.nome]))
      tipos = [
        ...tipos,
        {
          id: 10,
          nome: corpo.nome,
          origem: 'Personalizado',
          'quantidade usuarios': corpo.usuarios.length,
          'quantidade apontamentos': 0,
          grupos: corpo.grupos.map((id) => ({ id, nome: nomesGrupos.get(id) ?? '' })),
          usuarios: corpo.usuarios.map((id) => ({ id, nome: nomesUsuarios.get(id) ?? '' })),
        },
      ]
      return respostaJson({ mensagem: 'tipo cadastrado' }, 201)
    },

    // Apontamentos (F4), dados externos (F5) e indicadores (F6)
    'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
    'GET /api/ped/dados-externos-cadastro': rotaListarDadosExternos(dadosExternosAdminApi),
    'GET /api/ped/dados-externos-cadastro/integracoes-pendentes': rotaIntegracoesPendentes(dadosExternosAdminApi),
    'GET /api/ped/dados-externos-cadastro/identificadores': () => respostaJson(identificadoresApi()),
    'GET /api/ped/indicadores-cadastro': rotaListarIndicadores(indicadoresApi),

    // Dashboards (F7): vínculos por tipo (filiais, cargos, colaboradores) — usados também por Tipos
    'GET /api/ped/vinculos': rotaVinculos(),
    'GET /api/ped/dashboards': rotaListarDashboards(() => dashboards),
    'POST /api/ped/dashboards/previa-tarefa': (init) => {
      const { nome } = JSON.parse(String(init?.body)) as { nome: string }
      return respostaJson(previaTarefaApi(nome))
    },
    'POST /api/ped/dashboards': () => {
      dashboards = [...dashboards, { ...DASHBOARD_SUPERVISORES_API }]
      return respostaJson(
        respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: PED Supervisores', null)),
        201,
      )
    },

    // Fechamentos e imagens (F10): exemplos reais do back-end
    'GET /api/ped/fechamentos': () => respostaJson(fechamentosReais),
    'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaReal),
    'GET /api/ped/fechamentos/2/previa/pdf': () =>
      new Response(PDF_MINIMO, { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    'GET /api/ped/imagens': () => respostaJson(imagensReais),
  }

  return [base, faixas.rotas, preenchimento.rotas]
}

export interface ApiSimulada {
  chamadas: ChamadaE2E[]
  naoSimuladas: string[]
  /** Acrescenta ou substitui rotas (prioridade sobre as do sistema). */
  definir(rotas: Record<string, RotaFalsa>): void
  /** Chamadas com o método e o caminho informados. */
  de(metodo: string, caminho: string): ChamadaE2E[]
}

function lerCorpo(requisicao: Request): { texto: string | undefined; json: unknown } {
  const texto = requisicao.postData() ?? undefined
  if (texto === undefined) return { texto, json: undefined }
  try {
    return { texto, json: JSON.parse(texto) as unknown }
  } catch {
    return { texto, json: undefined }
  }
}

/**
 * Instala a API simulada na página. Com `logado`, a aba já abre com um token salvo (como um usuário que
 * recarrega a página); o token é semeado uma única vez, para que o "Sair" não seja desfeito na recarga.
 */
export async function instalarApi(page: Page, perfil: Perfil, opcoes: { logado?: boolean } = {}): Promise<ApiSimulada> {
  const mapas = rotasDoSistema(perfil)
  const extras: Record<string, RotaFalsa> = {}
  const chamadas: ChamadaE2E[] = []
  const naoSimuladas: string[] = []

  if (opcoes.logado ?? true) {
    await page.addInitScript((token) => {
      if (sessionStorage.getItem('e2e.semeado') === null) {
        sessionStorage.setItem('e2e.semeado', '1')
        sessionStorage.setItem('ped.token', token)
      }
    }, TOKEN)
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const requisicao = route.request()
      const url = new URL(requisicao.url())
      const metodo = requisicao.method().toUpperCase()
      const chave = `${metodo} ${url.pathname}`
      const { texto, json } = lerCorpo(requisicao)
      const cabecalhos = await requisicao.allHeaders()

      let rota: RotaFalsa | undefined = extras[chave]
      for (let i = mapas.length - 1; !rota && i >= 0; i -= 1) rota = mapas[i][chave]

      let resposta: Response
      if (rota) {
        chamadas.push({ metodo, caminho: url.pathname, url, corpo: json, cabecalhos })
        resposta = await rota({ method: metodo, headers: cabecalhos, body: texto }, url)
      } else if (chave === 'GET /api/ped/alertas-menu') {
        resposta = respostaJson({ abas: {} })
      } else {
        chamadas.push({ metodo, caminho: url.pathname, url, corpo: json, cabecalhos })
        naoSimuladas.push(`${chave}${url.search}`)
        resposta = respostaErro(404, `Rota não simulada: ${chave}`)
      }

      const corpo = Buffer.from(await resposta.arrayBuffer())
      const cabecalhosResposta: Record<string, string> = {}
      resposta.headers.forEach((valor, nome) => {
        cabecalhosResposta[nome] = valor
      })
      // 204/304 não podem ter corpo.
      await route.fulfill({ status: resposta.status, headers: cabecalhosResposta, body: resposta.status === 204 ? undefined : corpo })
    },
  )

  return {
    chamadas,
    naoSimuladas,
    definir(rotas) {
      Object.assign(extras, rotas)
    },
    de(metodo, caminho) {
      return chamadas.filter((chamada) => chamada.metodo === metodo && chamada.caminho === caminho)
    },
  }
}
