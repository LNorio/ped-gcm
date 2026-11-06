import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { DASHBOARD_COMERCIAL_API, historicoDashboardApi } from '../../test/dashboardsFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoDashboard } from './DialogoHistoricoDashboard'

const ROTA = '/api/ped/dashboards'
const COMERCIAL = paraDashboard(DASHBOARD_COMERCIAL_API)

describe('F7.9 — DialogoHistoricoDashboard: histórico de modificações (RF-57, RNF-01)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar(dashboard = COMERCIAL) {
    const onFechar = vi.fn()
    render(<DialogoHistoricoDashboard dashboard={dashboard} onFechar={onFechar} />)
    return { onFechar }
  }

  const registros = () => within(screen.getByRole('list', { name: 'Modificações de PED Comercial' })).getAllByRole('listitem')

  it('com dashboard null não renderiza nada nem consulta', () => {
    const chamadas = simularApi(fetchFalso, {})
    render(<DialogoHistoricoDashboard dashboard={null} onFechar={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas).toHaveLength(0)
  })

  it('abre "Histórico de modificações" com o nome do dashboard e consulta GET .../{id}/historico', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()) })
    renderizar()

    const dialogo = screen.getByRole('dialog', { name: 'Histórico de modificações' })
    expect(dialogo).toHaveAccessibleDescription('PED Comercial')
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].caminho).toBe(`${ROTA}/1/historico`)
  })

  it('cada registro mostra data, ação, usuário, a lista das alterações e a tarefa como "Tarefa #{número}", na ordem da API (RF-57)', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()) })
    renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    const [edicao, conclusao, cadastro] = registros()
    expect(registros()).toHaveLength(3)
    for (const texto of [
      '20/10/2026 15:30',
      'Edição',
      'Ana Costa',
      'Pontos de Cobertura de visitas: 50 → 40 pts',
      'Indicador incluído: Faturamento líquido mensal (60 pts)',
    ]) {
      expect(within(edicao).getByText(texto)).toBeInTheDocument()
    }
    expect(within(edicao).queryByText(/Tarefa/)).not.toBeInTheDocument()
    expect(within(edicao).queryByText('Aguardando envio ao Bitrix')).not.toBeInTheDocument()
    expect(within(conclusao).getByText('Construção concluída')).toBeInTheDocument()
    expect(within(conclusao).getByText('Maria Souza')).toBeInTheDocument()
    expect(within(conclusao).getByText('Tarefa #31')).toBeInTheDocument()
    expect(within(cadastro).getByText('Cadastro')).toBeInTheDocument()
    expect(within(cadastro).getByText('01/09/2026 10:00')).toBeInTheDocument()
    expect(within(cadastro).getByText('Tarefa #31')).toBeInTheDocument()
    expect(within(cadastro).getByText('Observação: Usar a régua de faixas do ano passado.')).toBeInTheDocument()
  })

  it.each([
    ['cadastro', 'Cadastro'],
    ['edicao', 'Edição'],
    ['desativado', 'Desativado'],
    ['reativado', 'Reativado'],
    ['concluida', 'Construção/Modificação concluída'],
  ])('sem "acao descricao", a ação "%s" aparece como "%s"', async (acao, rotulo) => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: () => respostaJson([{ acao, data: '2026-11-01 08:00:00', usuario: 'Ana Costa' }]),
    })
    renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    expect(within(registros()[0]).getByText(rotulo)).toBeInTheDocument()
  })

  it('tarefa ainda não enviada ao Bitrix24 ("tarefa bitrix" com id null): o histórico carrega e o registro mostra "Aguardando envio ao Bitrix", sem número', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: () =>
        respostaJson([
          {
            acao: 'cadastro',
            'acao descricao': 'Cadastro',
            data: '2026-11-05 16:28:43',
            usuario: 'master',
            alteracoes: [],
            'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' },
            observacao: null,
          },
        ]),
    })
    renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    const [cadastro] = registros()
    expect(within(cadastro).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(cadastro).queryByText(/#/)).not.toBeInTheDocument()
    expect(within(cadastro).queryByText(/null/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tarefa com número e status "aguardando_envio" mostra "Aguardando envio ao Bitrix" no lugar do número', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: () =>
        respostaJson([
          {
            acao: 'edicao',
            data: '2026-11-05 16:28:43',
            usuario: 'master',
            'tarefa bitrix': { id: '328441', status: 'aguardando_envio', titulo: '[PED] Modificar dashboard: teste' },
          },
        ]),
    })
    renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    const [edicao] = registros()
    expect(within(edicao).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(edicao).queryByText(/328441/)).not.toBeInTheDocument()
  })

  it('somente leitura: além de fechar, não há ações (RNF-01)', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()) })
    renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    const dialogo = screen.getByRole('dialog', { name: 'Histórico de modificações' })
    for (const botao of within(dialogo).getAllByRole('button')) expect(botao).toHaveAccessibleName('Fechar')
  })

  it('sem registros mostra "Nenhum registro de modificação para este dashboard."', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([]) })
    renderizar()

    expect(await screen.findByText('Nenhum registro de modificação para este dashboard.')).toBeInTheDocument()
  })

  it('anuncia "Carregando histórico..." e, em erro, mostra o alerta com "Tentar novamente", que repete a consulta', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoDashboardApi())),
    })
    renderizar()

    expect(screen.getByText('Carregando histórico...').closest('[role="status"]')).not.toBeNull()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })
    expect(chamadas).toHaveLength(2)
  })

  it('"Fechar" e Esc chamam onFechar', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()) })
    const { onFechar } = renderizar()
    await screen.findByRole('list', { name: 'Modificações de PED Comercial' })

    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fechar' })[0])
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
  })
})
