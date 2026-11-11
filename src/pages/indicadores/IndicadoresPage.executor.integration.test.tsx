import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import {
  ERRO_ULTIMA_CONSULTA_META,
  META_VIA_API_COMPLETA,
  comoValidadorRecebe,
  indicadoresComExecutorApi,
  rotaListarIndicadoresComFonteDaMeta,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

/**
 * F6.11 — Executor das integrações na aba Indicadores (integração: /indicadores com a aplicação
 * completa; só a rede é simulada). Fase 2: `docs/backend/FRONT-meta-via-api-fase2.md` e
 * `docs/backend/API (27).md`, seção "Executor das integrações" (11/11/2026).
 *
 * - Admin: nos detalhes da fonte `integracao`, "Última consulta" (dd/mm/aaaa hh:mm ou "Nenhuma consulta
 *   ainda") e, com erro, "Erro da última consulta" com o texto do back-end; a etiqueta "Erro na consulta
 *   da meta" continua.
 * - Validador (não recebe os campos do Admin): sem "Última consulta"/"Erro da última consulta", mas com
 *   as etiquetas da situação e "Meta pendente em N filiais".
 * - `filiais sem meta` da fonte `integracao` depois da primeira consulta → "Meta pendente em N filiais";
 *   "Definir metas pendentes" não aparece para indicadores `terceiro`.
 * - Topo `"meta via api".integracao: true` (executor ligado): a lista carrega normalmente.
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.11 — Executor das integrações (integração: /indicadores)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simular(perfil: 'admin' | 'validador' = 'admin') {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    const lista = () => (perfil === 'admin' ? indicadoresComExecutorApi() : indicadoresComExecutorApi().map(comoValidadorRecebe))
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComFonteDaMeta(lista, META_VIA_API_COMPLETA),
      'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
      'GET /api/ped/dados-externos-cadastro': rotaListarDadosExternos(dadosExternosApi),
    })
  }

  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!
  /** Etiquetas da coluna Nome (a coluna Composição também usa etiquetas). */
  const etiquetas = (nome: string) =>
    [...within(linha(nome)).getAllByRole('cell')[0].querySelectorAll('.etiqueta')].map((e) => e.textContent?.trim())

  async function abrirTela() {
    renderizarApp('/indicadores')
    await within(await screen.findByRole('table', { name: 'Indicadores' })).findByText('Ticket com meta da TI')
  }

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesIndicador(nome), 'Ver detalhes')
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    if (!proxima || !proxima.classList.contains('tabela__detalhes')) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return proxima
  }

  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    return termo.nextElementSibling as HTMLElement
  }

  describe('Admin', () => {
    it('consultado: "Última consulta" 11/11/2026 02:30, "Meta pendente em 2 filiais" e sem "Definir metas pendentes"', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      expect(etiquetas('Ticket com meta da TI')).toEqual(['Meta pendente em 2 filiais'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Ticket com meta da TI'))).not.toContain('Definir metas pendentes')

      const detalhes = await verDetalhes(user, 'Ticket com meta da TI')
      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^11\/11\/2026 02:30$/)
      expect(within(detalhes).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
    })

    it('com erro: etiqueta "Erro na consulta da meta" e, nos detalhes, a última consulta bem-sucedida e o erro', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      expect(etiquetas('Positivação com meta da TI')).toEqual(['Erro na consulta da meta'])

      const detalhes = await verDetalhes(user, 'Positivação com meta da TI')
      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^10\/11\/2026 02:30$/)
      expect(valorDetalhe(detalhes, 'Erro da última consulta')).toHaveTextContent(ERRO_ULTIMA_CONSULTA_META)
    })

    it('aguardando a primeira consulta: "Nenhuma consulta ainda"', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      const detalhes = await verDetalhes(user, 'Novos clientes com meta da TI')

      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^Nenhuma consulta ainda$/)
    })
  })

  describe('Validador', () => {
    it('vê as etiquetas (situação e filiais sem meta), mas não "Última consulta" nem "Erro da última consulta"', async () => {
      const user = usuarioRapido()
      simular('validador')
      await abrirTela()

      expect(etiquetas('Ticket com meta da TI')).toEqual(['Meta pendente em 2 filiais'])
      expect(etiquetas('Positivação com meta da TI')).toEqual(['Erro na consulta da meta'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Ticket com meta da TI'))).not.toContain('Definir metas pendentes')

      for (const nome of ['Ticket com meta da TI', 'Positivação com meta da TI']) {
        const detalhes = await verDetalhes(user, nome)
        expect(within(detalhes).queryByText('Última consulta', { selector: 'dt' })).not.toBeInTheDocument()
        expect(within(detalhes).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
        expect(within(detalhes).queryByText(ERRO_ULTIMA_CONSULTA_META)).not.toBeInTheDocument()
      }
    })
  })
})
