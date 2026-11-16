import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import metasReais from '../../../docs/backend/exemplos-reais/metas.json'
import mesesReais from '../../../docs/backend/exemplos-reais/preenchimento-meses.json'
import telaReal from '../../../docs/backend/exemplos-reais/preenchimento.json'
import { limparToken } from '../../services/sessao'
import { acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { historicoPeriodosApi, periodoApi } from '../../test/preenchimentoFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const MENSAGEM_RESPOSTA_INVALIDA = 'Resposta inválida do servidor.'

/**
 * Aba Preenchimento contra as respostas reais do back-end (F9.13* — F9.1, F9.3, F9.9). Só a rede é
 * simulada; `GET /api/ped/preenchimento/meses`, `GET /api/ped/preenchimento` e `GET /api/ped/metas`
 * respondem com os JSONs de `docs/backend/exemplos-reais/` (enviados pelo usuário em 16/11/2026).
 * Motivo: contra o servidor real, a aba mostrava "Resposta inválida do servidor." porque o serviço não
 * aceitava o mês em data (`mes: "AAAA-MM-DD"`).
 *
 * Preenchedor da filial 100 ("Filial 100"); relógio fixo em 16/11/2026 (só `Date`).
 */
describe('F9.13* — Preenchimento com as respostas reais do back-end (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0))
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(
          acessoApi({
            filiais: [{ filial: '100', 'nome filial': 'Filial 100' }],
            tipos: [
              { id: 1, nome: 'Comercial' },
              { id: 7, nome: 'Contabilidade' },
              { id: 2, nome: 'Financeiro' },
              { id: 4, nome: 'Tecnologia da Informação' },
            ],
          }),
        ),
      'GET /api/ped/periodo': () => respostaJson(periodoApi({ 'aberto por': null, 'aberto em': '2026-10-30 15:06:23-04:00' })),
      'GET /api/ped/periodo/historico': () => respostaJson(historicoPeriodosApi()),
      'GET /api/ped/preenchimento/meses': () => respostaJson(mesesReais),
      'GET /api/ped/preenchimento': () => respostaJson(telaReal),
      'GET /api/ped/metas': () => respostaJson(metasReais),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const grupoMeses = () => screen.getByRole('group', { name: 'Mês de competência' })
  const botaoMes = (nome: string) => within(grupoMeses()).getByRole('button', { name: new RegExp(`^${nome}`) })

  async function abrirTela() {
    renderizarApp('/preenchimento')
    await screen.findByRole('region', { name: 'Resumo do mês' })
    await waitFor(() => expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12))
  }

  it('mostra os 12 meses sem "Resposta inválida do servidor.": outubro aberto com 10 pendentes, novembro fechado para consulta e dezembro futuro', async () => {
    await abrirTela()

    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
    expect(within(botaoMes('Outubro')).getByText('aberto')).toBeInTheDocument()
    expect(within(botaoMes('Outubro')).getByText('10 pendentes')).toBeInTheDocument()
    expect(botaoMes('Outubro')).toHaveAttribute('aria-pressed', 'true')
    expect(within(botaoMes('Setembro')).getByText('fechado · consulta')).toBeInTheDocument()
    expect(within(botaoMes('Novembro')).getByText('fechado · consulta')).toBeInTheDocument()
    expect(botaoMes('Novembro')).toBeEnabled()
    expect(botaoMes('Dezembro')).toBeDisabled()
  })

  it('mostra os tipos e os apontamentos da tela real, com os indicadores pelos nomes', async () => {
    const user = usuarioRapido()
    await abrirTela()

    const abas = await screen.findByRole('tablist', { name: 'Tipos de apontamento' })
    expect(within(abas).getAllByRole('tab').map((aba) => aba.textContent?.replace(/\s*\d+$/, ''))).toEqual([
      'Comercial',
      'Contabilidade',
      'Financeiro',
      'Tecnologia da Informação',
    ])

    await user.click(within(abas).getByRole('tab', { name: /^Financeiro/ }))

    const apontamento = await screen.findByRole('article', { name: 'Documento não fiscal' })
    expect(within(apontamento).getByText('Indicadores: Indicadores de Financeiro')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('"Editar metas (3)" abre a janela larga com os três indicadores reais e a meta vigente em pt-BR', async () => {
    const user = usuarioRapido()
    await abrirTela()

    await user.click(await screen.findByRole('button', { name: 'Editar metas (3)' }))

    const dialogo = screen.getByRole('dialog', { name: 'Editar metas' })
    expect(dialogo).toHaveClass('dialogo--largo')
    const tabela = within(dialogo).getByRole('table', { name: 'Metas dos indicadores' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Indicador', 'Meta vigente', 'Nova meta', 'Motivo'])
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas.map((l) => within(l).getAllByRole('cell')[0]?.textContent)).toEqual(['Indicadores de Financeiro', 'teste 2', 'teste externo'])
    expect(within(linhas[0]).getAllByRole('cell')[1]).toHaveTextContent('4,00')
    expect(within(linhas[1]).getAllByRole('cell')[1]).toHaveTextContent('300,00')
  })
})
