import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  ROTA_MESES,
  ROTA_PREENCHIMENTO,
  criarApiPreenchimentoFalsa,
  getsDe,
  simularSessaoPreenchimento,
} from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const AVISO_CONSULTA =
  'Somente consulta: o único período aberto para preenchimento é 10/2026. Os demais meses não aceitam lançamentos nem correções.'

/**
 * Mês de competência e ano na aba Preenchimento (F9.3 — RF-61, RF-62). Fluxo completo com a rede
 * simulada: a tela começa no mês aberto (outubro/2026); escolher outro mês consulta a tela dele, que
 * fica somente para consulta (sem campos de valor, sem "Corrigir" e sem "Salvar lançamentos") e indica
 * o mês aberto; "Ir para o período aberto" volta; o ano muda por setas ou digitação.
 * Preenchedor da filial 101. Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.3 — Seletor de mês de competência e consulta (integração: /preenchimento)', () => {
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

  const grupoMeses = () => screen.getByRole('group', { name: 'Mês de competência' })
  const botaoMes = (nome: string) => within(grupoMeses()).getByRole('button', { name: new RegExp(`^${nome}`) })
  const resumo = () => screen.getByRole('region', { name: 'Resumo do mês' })

  async function abrirTela() {
    const sessao = simularSessaoPreenchimento(fetchFalso, 'preenchedor')
    renderizarApp('/preenchimento')
    await screen.findByRole('region', { name: 'Resumo do mês' })
    await waitFor(() => expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12))
    return sessao
  }

  it('mostra os 12 meses de 2026: outubro aberto com 1 pendente e selecionado, setembro fechado, novembro e dezembro desabilitados', async () => {
    await abrirTela()

    expect(within(botaoMes('Outubro')).getByText('aberto')).toBeInTheDocument()
    expect(within(botaoMes('Outubro')).getByText('1 pendente')).toBeInTheDocument()
    expect(botaoMes('Outubro')).toHaveAttribute('aria-pressed', 'true')
    expect(within(botaoMes('Setembro')).getByText('fechado · consulta')).toBeInTheDocument()
    expect(botaoMes('Novembro')).toBeDisabled()
    expect(botaoMes('Dezembro')).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: 'Ano' })).toHaveValue(2026)
    expect(screen.queryByRole('button', { name: 'Ir para o período aberto' })).not.toBeInTheDocument()
  })

  it('escolher setembro consulta mes_de_referencia=2026-09 e a aba fica somente para consulta, indicando o mês aberto', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()
    expect(screen.getByRole('button', { name: 'Salvar lançamentos' })).toBeInTheDocument()

    await user.click(botaoMes('Setembro'))

    await waitFor(() => expect(within(resumo()).getByText('Competência: 09/2026')).toBeInTheDocument())
    expect(getsDe(chamadas, ROTA_PREENCHIMENTO).at(-1)?.url.searchParams.get('mes_de_referencia')).toBe('2026-09')
    expect(getsDe(chamadas, ROTA_PREENCHIMENTO).at(-1)?.url.searchParams.get('filial')).toBe('101')
    expect(within(resumo()).getByText('Fechado')).toBeInTheDocument()
    expect(within(resumo()).getByRole('note')).toHaveTextContent(AVISO_CONSULTA)
    expect(botaoMes('Setembro')).toHaveAttribute('aria-pressed', 'true')
    expect(botaoMes('Outubro')).toHaveAttribute('aria-pressed', 'false')

    // Somente consulta (RF-62): nem campos de valor, nem "Corrigir", nem "Salvar lançamentos".
    expect(screen.queryByRole('textbox', { name: /^Valor de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^Valor de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar lançamentos' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Vitrine montada' })).getByText('Não lançado')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Visitas a clientes' })).getByText('1.000,00')).toBeInTheDocument()
  })

  it('"Ir para o período aberto" volta ao mês aberto, com os campos e "Salvar lançamentos"', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await user.click(botaoMes('Setembro'))
    await waitFor(() => expect(within(resumo()).getByText('Competência: 09/2026')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Ir para o período aberto' }))

    await waitFor(() => expect(within(resumo()).getByText('Competência: 10/2026')).toBeInTheDocument())
    expect(botaoMes('Outubro')).toHaveAttribute('aria-pressed', 'true')
    expect(within(resumo()).queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar lançamentos' })).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Vitrine montada' })).getByRole('group', { name: 'Valor de Vitrine montada' })).toBeInTheDocument()
  })

  it('"Ano anterior" consulta os meses de 2025 (todos fechados); escolher março consulta mes_de_referencia=2025-03', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))

    await waitFor(() => expect(getsDe(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('ano')).toBe('2025'))
    await waitFor(() => expect(within(grupoMeses()).getAllByText('fechado · consulta')).toHaveLength(12))
    expect(screen.getByRole('spinbutton', { name: 'Ano' })).toHaveValue(2025)
    expect(screen.getByRole('button', { name: 'Ir para o período aberto' })).toBeInTheDocument()

    await user.click(botaoMes('Março'))

    await waitFor(() => expect(within(resumo()).getByText('Competência: 03/2025')).toBeInTheDocument())
    expect(getsDe(chamadas, ROTA_PREENCHIMENTO).at(-1)?.url.searchParams.get('mes_de_referencia')).toBe('2025-03')
    expect(screen.queryByRole('button', { name: 'Salvar lançamentos' })).not.toBeInTheDocument()
  })

  it('digitar o ano 2024 consulta os meses de 2024', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()
    const campoAno = screen.getByRole('spinbutton', { name: 'Ano' })

    await user.clear(campoAno)
    await user.type(campoAno, '2024')

    await waitFor(() => expect(getsDe(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('ano')).toBe('2024'))
    expect(getsDe(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('filial')).toBe('101')
  })

  it('"Próximo ano" fica desabilitado no ano atual', async () => {
    await abrirTela()

    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled()
  })

  // Revisão da F9 em 13/11/2026: o erro ao trocar de mês ou de ano aparece com "Tentar novamente" e o
  // seletor continua disponível (outro mês, "Ir para o período aberto" e as setas de ano).
  describe('erro ao trocar o mês ou o ano', () => {
    const MENSAGEM_ERRO_TELA = 'Falha ao consultar o preenchimento.'
    const MENSAGEM_ERRO_MESES = 'Falha ao consultar os meses.'

    /** Sessão do Preenchedor em que a tela de setembro/2026 (enquanto `falhar()`) responde 500. */
    async function abrirTelaComFalhaEmSetembro(falhar: () => boolean) {
      const api = criarApiPreenchimentoFalsa()
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'preenchedor', 'todas as filiais': false, filiais: [FILIAIS_API[1]] })),
        ...api.rotas,
        [`GET ${ROTA_PREENCHIMENTO}`]: (init, url) =>
          falhar() && url.searchParams.get('mes_de_referencia') === '2026-09'
            ? respostaErro(500, MENSAGEM_ERRO_TELA)
            : api.rotas[`GET ${ROTA_PREENCHIMENTO}`](init, url),
      })
      renderizarApp('/preenchimento')
      await screen.findByRole('region', { name: 'Resumo do mês' })
      await waitFor(() => expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12))
      return chamadas
    }

    /** Sessão do Preenchedor em que os meses de 2025 (enquanto `falhar()`) respondem 500. */
    async function abrirTelaComFalhaEm2025(falhar: () => boolean) {
      const api = criarApiPreenchimentoFalsa()
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'preenchedor', 'todas as filiais': false, filiais: [FILIAIS_API[1]] })),
        ...api.rotas,
        [`GET ${ROTA_MESES}`]: (init, url) =>
          falhar() && url.searchParams.get('ano') === '2025' ? respostaErro(500, MENSAGEM_ERRO_MESES) : api.rotas[`GET ${ROTA_MESES}`](init, url),
      })
      renderizarApp('/preenchimento')
      await screen.findByRole('region', { name: 'Resumo do mês' })
      await waitFor(() => expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12))
      return chamadas
    }

    it('erro ao escolher um mês: alerta com "Tentar novamente" e o seletor de mês continua disponível', async () => {
      const user = usuarioRapido()
      await abrirTelaComFalhaEmSetembro(() => true)

      await user.click(botaoMes('Setembro'))

      expect(await screen.findByText(MENSAGEM_ERRO_TELA)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12)
      expect(screen.getByRole('button', { name: 'Ir para o período aberto' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ano anterior' })).toBeInTheDocument()
    })

    it('depois do erro ao escolher um mês, dá para escolher outro mês', async () => {
      const user = usuarioRapido()
      await abrirTelaComFalhaEmSetembro(() => true)
      await user.click(botaoMes('Setembro'))
      await screen.findByText(MENSAGEM_ERRO_TELA)

      await user.click(botaoMes('Agosto'))

      await waitFor(() => expect(within(resumo()).getByText('Competência: 08/2026')).toBeInTheDocument())
      expect(screen.queryByText(MENSAGEM_ERRO_TELA)).not.toBeInTheDocument()
      expect(botaoMes('Agosto')).toHaveAttribute('aria-pressed', 'true')
    })

    it('depois do erro ao escolher um mês, "Ir para o período aberto" volta ao mês aberto', async () => {
      const user = usuarioRapido()
      await abrirTelaComFalhaEmSetembro(() => true)
      await user.click(botaoMes('Setembro'))
      await screen.findByText(MENSAGEM_ERRO_TELA)

      await user.click(screen.getByRole('button', { name: 'Ir para o período aberto' }))

      await waitFor(() => expect(within(resumo()).getByText('Competência: 10/2026')).toBeInTheDocument())
      expect(screen.queryByText(MENSAGEM_ERRO_TELA)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar lançamentos' })).toBeInTheDocument()
    })

    it('"Tentar novamente" depois do erro ao escolher um mês consulta de novo o mesmo mês', async () => {
      const user = usuarioRapido()
      let falhar = true
      const chamadas = await abrirTelaComFalhaEmSetembro(() => falhar)
      await user.click(botaoMes('Setembro'))
      await screen.findByText(MENSAGEM_ERRO_TELA)

      falhar = false
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      await waitFor(() => expect(within(resumo()).getByText('Competência: 09/2026')).toBeInTheDocument())
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO).at(-1)?.url.searchParams.get('mes_de_referencia')).toBe('2026-09')
    })

    it('erro ao mudar o ano: alerta com "Tentar novamente" e as setas de ano continuam disponíveis', async () => {
      const user = usuarioRapido()
      await abrirTelaComFalhaEm2025(() => true)

      await user.click(screen.getByRole('button', { name: 'Ano anterior' }))

      expect(await screen.findByText(MENSAGEM_ERRO_MESES)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ano anterior' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeEnabled()
    })

    it('"Tentar novamente" depois do erro ao mudar o ano consulta de novo os meses do mesmo ano', async () => {
      const user = usuarioRapido()
      let falhar = true
      const chamadas = await abrirTelaComFalhaEm2025(() => falhar)
      await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
      await screen.findByText(MENSAGEM_ERRO_MESES)
      const consultas2025 = getsDe(chamadas, ROTA_MESES).filter((c) => c.url.searchParams.get('ano') === '2025').length

      falhar = false
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      await waitFor(() => expect(within(grupoMeses()).getAllByText('fechado · consulta')).toHaveLength(12))
      expect(getsDe(chamadas, ROTA_MESES).filter((c) => c.url.searchParams.get('ano') === '2025')).toHaveLength(consultas2025 + 1)
      expect(screen.queryByText(MENSAGEM_ERRO_MESES)).not.toBeInTheDocument()
    })

    it('depois do erro ao mudar o ano, "Próximo ano" volta aos meses de 2026', async () => {
      const user = usuarioRapido()
      await abrirTelaComFalhaEm2025(() => true)
      await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
      await screen.findByText(MENSAGEM_ERRO_MESES)

      await user.click(screen.getByRole('button', { name: 'Próximo ano' }))

      await waitFor(() => expect(within(botaoMes('Outubro')).getByText('aberto')).toBeInTheDocument())
      expect(screen.getByRole('spinbutton', { name: 'Ano' })).toHaveValue(2026)
      expect(screen.queryByText(MENSAGEM_ERRO_MESES)).not.toBeInTheDocument()
    })
  })
})
