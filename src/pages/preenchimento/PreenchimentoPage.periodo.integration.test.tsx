import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import {
  ABERTO_POR_FALSO,
  DATA_ATUAL_FALSA,
  MENSAGEM_MES_JA_ABERTO,
  criarApiPeriodoFalsa,
} from '../../test/periodoFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA_ABRIR = '/api/ped/periodo/abrir'
const ROTA_PREENCHIMENTO = '/api/ped/preenchimento'

/**
 * "Abrir outro mês" na aba Preenchimento (F9.11 — RF-75, RF-76, RNF-07). Fluxo completo: tela +
 * diálogos + serviço (`periodoService`), só a rede simulada (`criarApiPeriodoFalsa`, estado coerente
 * entre `GET /periodo`, `/periodo/historico`, `POST /periodo/abrir`, `/preenchimento` e
 * `/preenchimento/meses`).
 *
 * - Na área de ações do topo, o botão "Abrir outro mês" aparece só para o Admin (`abrir-periodo`);
 *   o botão "Histórico de aberturas" aparece para todos os perfis (a rota é de qualquer perfil).
 * - O diálogo "Abrir outro mês" recebe o mês aberto atual; o Admin escolhe Ano e Mês, vê o impacto e
 *   confirma em "Abrir mês" → `POST /api/ped/periodo/abrir` `{ "mes de referencia": "AAAA-MM-01" }`.
 * - No sucesso, o diálogo fecha, a notificação "Período aberto: MM/AAAA." aparece e a página recarrega
 *   e passa para o novo mês aberto (nova consulta de `GET /api/ped/preenchimento` sem mês ou com o mês
 *   novo); o próximo "Abrir outro mês" já mostra o período novo.
 * - Erro (400 ou outro) mostra a mensagem da API dentro do diálogo, que continua aberto.
 *
 * Sessão: filial única 101 (CAMPO GRANDE), já selecionada. Relógio fixo em 13/11/2026 (só `Date`).
 * A lista de apontamentos não é verificada aqui (F9.5).
 */
describe('F9.11 — Abrir outro mês (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DATA_ATUAL_FALSA)
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(
    perfil: 'admin' | 'validador' | 'preenchedor' = 'admin',
    rotasExtras: Record<string, RotaFalsa> = {},
    api = criarApiPeriodoFalsa(),
  ) {
    const acesso = acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]], 'periodo aberto': '2026-10-01' })
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const postsAbrir = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA_ABRIR)
  const getsPreenchimento = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_PREENCHIMENTO)
  const dialogoAbrir = () => screen.getByRole('dialog', { name: 'Abrir outro mês' })

  /** Abre a aba e espera a área de ações (o "Histórico de aberturas" aparece para todos os perfis). */
  async function abrirTela(chamadas: ChamadaRegistrada[]) {
    renderizarApp('/preenchimento')
    await screen.findByRole('button', { name: 'Histórico de aberturas' })
    await waitFor(() => expect(getsPreenchimento(chamadas).length).toBeGreaterThan(0))
  }

  async function escolherMes(user: Usuario, ano: string, mes: string) {
    await user.click(await screen.findByRole('button', { name: 'Abrir outro mês' }))
    const dialogo = dialogoAbrir()
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Ano' }), ano)
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Mês' }), mes)
    return dialogo
  }

  describe('permissão (só o Admin abre outro mês)', () => {
    it('o Admin vê "Abrir outro mês" na área de ações', async () => {
      const { chamadas } = simularSessao('admin')
      await abrirTela(chamadas)

      expect(screen.getByRole('button', { name: 'Abrir outro mês' })).toBeInTheDocument()
    })

    it.each(['validador', 'preenchedor'] as const)('o %s não vê "Abrir outro mês"', async (perfil) => {
      const { chamadas } = simularSessao(perfil)
      await abrirTela(chamadas)

      expect(screen.queryByRole('button', { name: 'Abrir outro mês' })).not.toBeInTheDocument()
      expect(postsAbrir(chamadas)).toHaveLength(0)
    })
  })

  describe('confirmação e abertura de um mês novo', () => {
    it('o diálogo mostra o período aberto atual (10/2026) e não deixa escolher o mês aberto nem o futuro', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela(chamadas)

      await user.click(screen.getByRole('button', { name: 'Abrir outro mês' }))

      const dialogo = dialogoAbrir()
      expect(within(dialogo).getByText('Período aberto: 10/2026.')).toBeInTheDocument()
      const mes = within(dialogo).getByRole('combobox', { name: 'Mês' })
      expect(within(mes).getByRole('option', { name: 'Outubro' })).toBeDisabled()
      expect(within(mes).getByRole('option', { name: 'Dezembro' })).toBeDisabled()
      expect(within(mes).getByRole('option', { name: 'Novembro' })).toBeEnabled()
    })

    it('"Cancelar" fecha o diálogo sem chamar a API', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela(chamadas)

      const dialogo = await escolherMes(user, '2026', 'Novembro')
      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(postsAbrir(chamadas)).toHaveLength(0)
    })

    it('abre 11/2026: avisa que 10/2026 passa a ser só consulta, envia o POST, notifica "Período aberto" e passa para o novo mês', async () => {
      const user = usuarioRapido()
      const { chamadas, api } = simularSessao()
      await abrirTela(chamadas)

      const dialogo = await escolherMes(user, '2026', 'Novembro')
      expect(
        within(dialogo).getByText(
          'O período 10/2026 será fechado para preenchimento e passará a ser só consulta. 11/2026 passará a ser o único período aberto, para todas as filiais. Os lançamentos já feitos continuam disponíveis para consulta.',
        ),
      ).toBeInTheDocument()
      const consultasAntes = chamadas.length

      await user.click(within(dialogo).getByRole('button', { name: 'Abrir mês' }))

      const notificacao = await screen.findByText('Período aberto: 11/2026.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(postsAbrir(chamadas)).toHaveLength(1)
      expect(corpoDaChamada(postsAbrir(chamadas)[0])).toEqual({ 'mes de referencia': '2026-11-01' })
      expect(api.mesAberto()).toBe('2026-11-01')

      // A página recarrega e passa para o novo mês aberto.
      await waitFor(() => {
        const depois = chamadas.slice(consultasAntes).filter((c) => c.metodo === 'GET' && c.caminho === ROTA_PREENCHIMENTO)
        expect(depois.length).toBeGreaterThan(0)
        expect([null, '2026-11']).toContain(depois.at(-1)!.url.searchParams.get('mes_de_referencia'))
      })

      // O próximo "Abrir outro mês" já parte do período novo.
      await user.click(screen.getByRole('button', { name: 'Abrir outro mês' }))
      expect(await within(dialogoAbrir()).findByText('Período aberto: 11/2026.')).toBeInTheDocument()
    })

    it('o histórico de aberturas passa a mostrar a nova abertura, com quem abriu e quando', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela(chamadas)

      const dialogo = await escolherMes(user, '2026', 'Novembro')
      await user.click(within(dialogo).getByRole('button', { name: 'Abrir mês' }))
      await screen.findByText('Período aberto: 11/2026.')

      await user.click(screen.getByRole('button', { name: 'Histórico de aberturas' }))

      const historico = screen.getByRole('dialog', { name: 'Histórico de aberturas de período' })
      const tabela = await within(historico).findByRole('table', { name: 'Aberturas de período' })
      const primeira = within(tabela).getAllByRole('row')[1]
      expect(within(primeira).getByText('11/2026')).toBeInTheDocument()
      expect(within(primeira).getByText(ABERTO_POR_FALSO)).toBeInTheDocument()
      expect(within(primeira).getByText('13/11/2026 12:00')).toBeInTheDocument()
      expect(within(primeira).queryByText('Reaberto')).not.toBeInTheDocument()
    })
  })

  describe('erros da abertura', () => {
    it('400 da API: a mensagem aparece no diálogo, que continua aberto, sem notificação', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao('admin', {
        [`POST ${ROTA_ABRIR}`]: () => respostaErro(400, MENSAGEM_MES_JA_ABERTO),
      })
      await abrirTela(chamadas)

      const dialogo = await escolherMes(user, '2026', 'Novembro')
      await user.click(within(dialogo).getByRole('button', { name: 'Abrir mês' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_MES_JA_ABERTO)
      expect(dialogoAbrir()).toBeInTheDocument()
      expect(screen.queryByText('Período aberto: 11/2026.')).not.toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Abrir mês' })).toBeEnabled()
    })

    it('erro do servidor (500): a mensagem aparece no diálogo e é possível tentar de novo', async () => {
      const user = usuarioRapido()
      let tentativas = 0
      const api = criarApiPeriodoFalsa()
      const { chamadas } = simularSessao(
        'admin',
        {
          [`POST ${ROTA_ABRIR}`]: (init, url) => {
            tentativas += 1
            return tentativas === 1 ? respostaErro(500, 'Falha ao abrir o período.') : api.rotas[`POST ${ROTA_ABRIR}`](init, url)
          },
        },
        api,
      )
      await abrirTela(chamadas)

      const dialogo = await escolherMes(user, '2026', 'Novembro')
      await user.click(within(dialogo).getByRole('button', { name: 'Abrir mês' }))
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falha ao abrir o período.')

      await user.click(within(dialogo).getByRole('button', { name: 'Abrir mês' }))

      expect(await screen.findByText('Período aberto: 11/2026.')).toBeInTheDocument()
      expect(postsAbrir(chamadas)).toHaveLength(2)
    })
  })
})
