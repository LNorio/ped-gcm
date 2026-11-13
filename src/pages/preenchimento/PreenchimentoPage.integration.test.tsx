import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { cabecalhoDaChamada, respostaErro, respostaJson } from '../../test/apiFalsa'
import { telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { ROTA_MESES, ROTA_PREENCHIMENTO, getsDe, simularSessaoPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const PEDIDO_FILIAL = 'Selecione uma filial no cabeçalho para preencher os apontamentos.'

/**
 * Aba Preenchimento exige filial (F9.2 — RF-60). Fluxo completo: tela + cabeçalho + hook + serviço, só a
 * rede simulada (`simularSessaoPreenchimento`).
 * - Admin com "Todas as filiais" no cabeçalho: só o título "Preenchimento" e o pedido de escolha da
 *   filial, sem consultar o preenchimento;
 * - ao escolher uma filial, a tela do mês aberto daquela filial é carregada (e recarregada a cada troca);
 * - Validador e Preenchedor usam a própria filial e veem a tela direto.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.2 — Aba Preenchimento: filial obrigatória (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
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

  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
  const resumo = () => screen.findByRole('region', { name: 'Resumo do mês' })

  describe('Admin', () => {
    it('com "Todas as filiais": título "Preenchimento", pedido de escolha da filial e nenhuma consulta do preenchimento', async () => {
      const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'admin')

      renderizarApp('/preenchimento')

      expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(await screen.findByText(PEDIDO_FILIAL)).toBeInTheDocument()
      await new Promise((resolver) => setTimeout(resolver, 50))
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(0)
      expect(getsDe(chamadas, ROTA_MESES)).toHaveLength(0)
      expect(screen.queryByRole('region', { name: 'Resumo do mês' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Mês de competência' })).not.toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('escolher a filial 101 no cabeçalho carrega o mês aberto dela (sem mês na query), com o Bearer, e some o pedido', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'admin')
      renderizarApp('/preenchimento')
      await screen.findByText(PEDIDO_FILIAL)

      await user.selectOptions(seletorFilial(), '101')

      expect(within(await resumo()).getByText('Filial 101 — CAMPO GRANDE')).toBeInTheDocument()
      expect(screen.queryByText(PEDIDO_FILIAL)).not.toBeInTheDocument()
      const tela = getsDe(chamadas, ROTA_PREENCHIMENTO)
      expect(tela).toHaveLength(1)
      expect(tela[0].url.searchParams.get('filial')).toBe('101')
      expect(tela[0].url.searchParams.has('mes_de_referencia')).toBe(false)
      expect(cabecalhoDaChamada(tela[0], 'Authorization')).toBe('Bearer token-salvo')
      await waitFor(() => expect(getsDe(chamadas, ROTA_MESES)).toHaveLength(1))
      expect(getsDe(chamadas, ROTA_MESES)[0].url.searchParams.get('filial')).toBe('101')
      expect(getsDe(chamadas, ROTA_MESES)[0].url.searchParams.get('ano')).toBe('2026')
      expect(await screen.findByRole('article', { name: 'Visitas a clientes' })).toBeInTheDocument()
    })

    it('trocar para a filial 102 consulta de novo com ela; voltar a "Todas as filiais" volta ao pedido de escolha', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'admin')
      renderizarApp('/preenchimento')
      await screen.findByText(PEDIDO_FILIAL)
      await user.selectOptions(seletorFilial(), '101')
      await resumo()

      await user.selectOptions(seletorFilial(), '102')

      await waitFor(() => expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(2))
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO)[1].url.searchParams.get('filial')).toBe('102')
      await waitFor(() =>
        expect(within(screen.getByRole('region', { name: 'Resumo do mês' })).getByText('Filial 102 — DOURADOS')).toBeInTheDocument(),
      )

      await user.selectOptions(seletorFilial(), 'todas')

      expect(await screen.findByText(PEDIDO_FILIAL)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Resumo do mês' })).not.toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(2)
    })
  })

  describe.each(['validador', 'preenchedor'] as const)('%s (filial única 101)', (perfil) => {
    it('usa a própria filial: carrega a tela direto, sem pedir a escolha', async () => {
      const { chamadas } = simularSessaoPreenchimento(fetchFalso, perfil)

      renderizarApp('/preenchimento')

      expect(within(await resumo()).getByText('Filial 101 — CAMPO GRANDE')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(screen.queryByText(PEDIDO_FILIAL)).not.toBeInTheDocument()
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO)[0].url.searchParams.get('filial')).toBe('101')
    })
  })

  it('o parâmetro ?dashboard= da URL (vindo da aba Dashboards) é ignorado: mesma consulta, sem filtro', async () => {
    const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'preenchedor')

    renderizarApp('/preenchimento?dashboard=2')

    await resumo()
    const query = getsDe(chamadas, ROTA_PREENCHIMENTO)[0].url.searchParams
    expect(query.has('dashboard')).toBe(false)
    expect(query.has('mes_de_referencia')).toBe(false)
    expect(await screen.findAllByRole('article')).toHaveLength(3)
  })

  it('erro ao carregar: alerta com a mensagem e "Tentar novamente" carrega a tela', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'preenchedor', {
      rotasExtras: {
        [`GET ${ROTA_PREENCHIMENTO}`]: () =>
          falhar ? respostaErro(500, 'Falha ao consultar o preenchimento.') : respostaJson(telaPreenchimentoApi()),
      },
    })
    renderizarApp('/preenchimento')

    expect(await screen.findByText('Falha ao consultar o preenchimento.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('article', { name: 'Visitas a clientes' })).toBeInTheDocument()
    expect(getsDe(chamadas, ROTA_PREENCHIMENTO).length).toBeGreaterThanOrEqual(2)
  })

  it('sessão expirada (401) ao carregar volta ao login', async () => {
    simularSessaoPreenchimento(fetchFalso, 'preenchedor', {
      rotasExtras: { [`GET ${ROTA_PREENCHIMENTO}`]: () => respostaErro(401) },
    })

    renderizarApp('/preenchimento')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
  })
})
