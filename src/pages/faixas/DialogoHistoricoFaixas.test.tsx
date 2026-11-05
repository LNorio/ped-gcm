import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { TABELA_COMERCIAL_101_API, historicoFaixasApi, versaoFaixasApi } from '../../test/faixasFalsos'
import { usuarioRapido } from '../../test/usuario'
import { formatarMoeda, formatarPercentual } from '../../utils/formato'
import { DialogoHistoricoFaixas, type DialogoHistoricoFaixasProps } from './DialogoHistoricoFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const ROTA = '/api/ped/faixas/1'
const COLUNAS = ['Versão', 'Motivo', 'Data', 'Autor', 'Faixas', 'Ações']

/**
 * O diálogo consulta sozinho o histórico (`listarHistoricoFaixas`) ao abrir e as faixas de cada versão
 * (`obterFaixasDaVersao`) quando o usuário pede, como o `DialogoHistoricoMetas` (F6.8). Somente
 * leitura (RNF-01): não há ação de editar nem de excluir versões.
 */
describe('F8.5 — DialogoHistoricoFaixas (histórico de versões — RF-45, RNF-01)', () => {
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

  function renderizar(props: Partial<DialogoHistoricoFaixasProps> = {}, rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/historico`]: () => respostaJson(historicoFaixasApi()),
      [`GET ${ROTA}/versoes/1`]: () => respostaJson(versaoFaixasApi(1)),
      [`GET ${ROTA}/versoes/2`]: () => respostaJson(versaoFaixasApi(2)),
      ...rotas,
    })
    const onFechar = props.onFechar ?? vi.fn()
    render(<DialogoHistoricoFaixas tabela={props.tabela === undefined ? COMERCIAL_101 : props.tabela} onFechar={onFechar} />)
    return { chamadas, onFechar }
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de versões' })
  const tabela = () => within(dialogo()).getByRole('table', { name: 'Versões' })
  const linhas = () => within(tabela()).getAllByRole('row').slice(1)
  const valoresDasFaixas = (elemento: HTMLElement) =>
    within(elemento)
      .getAllByRole('row')
      .slice(1)
      .map((linha) => within(linha).getAllByRole('cell').map((c) => c.textContent))

  it('com tabela null não renderiza nada nem consulta a API', () => {
    const { chamadas } = renderizar({ tabela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas).toHaveLength(0)
  })

  it('abre "Histórico de versões" com o nome da tabela, anuncia o carregamento e consulta GET .../{id}/historico', async () => {
    const { chamadas } = renderizar()

    expect(dialogo()).toHaveTextContent('PED Comercial · Filial 101')
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Carregando histórico...')

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas, `${ROTA}/historico`)).toHaveLength(1)
  })

  it('lista versão, etiqueta "Vigente", motivo, data (dd/mm/aaaa hh:mm), autor e quantidade de faixas, na ordem da API (mais recente primeiro)', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
    expect(linhas()).toHaveLength(2)
    const [v2, v1] = linhas()
    expect(within(v2).getByText('v2')).toBeInTheDocument()
    expect(within(v2).getByText('Vigente')).toBeInTheDocument()
    expect(within(v2).getByText('Reajuste do trimestre')).toBeInTheDocument()
    expect(within(v2).getByText('20/10/2026 15:30')).toBeInTheDocument()
    expect(within(v2).getByText('Ana Costa')).toBeInTheDocument()
    expect(within(v2).getByText('3 faixas')).toBeInTheDocument()
    expect(within(v1).getByText('v1')).toBeInTheDocument()
    expect(within(v1).queryByText('Vigente')).not.toBeInTheDocument()
    expect(within(v1).getByText('Cadastro inicial')).toBeInTheDocument()
    expect(within(v1).getByText('01/09/2026 10:00')).toBeInTheDocument()
    expect(within(v1).getByText('Maria Souza')).toBeInTheDocument()
    expect(within(v1).getByText('2 faixas')).toBeInTheDocument()
  })

  it('"Ver faixas da versão v1" consulta GET .../versoes/1 e mostra as faixas daquela versão; o botão passa a "Ocultar faixas da versão v1"', async () => {
    const user = usuarioRapido()
    const { chamadas } = renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))

    const faixas = await within(dialogo()).findByRole('table', { name: 'Faixas da versão v1' })
    expect(within(faixas).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['De (R$)', 'Até (R$)', 'Alíquota (%)'])
    expect(valoresDasFaixas(faixas)).toEqual([
      [formatarMoeda(0), formatarMoeda(1000), formatarPercentual(0)],
      [formatarMoeda(1000.01), formatarMoeda(3000), formatarPercentual(2)],
    ])
    expect(gets(chamadas, `${ROTA}/versoes/1`)).toHaveLength(1)
    expect(within(dialogo()).getByRole('button', { name: 'Ocultar faixas da versão v1' })).toBeInTheDocument()
  })

  it('"Ocultar faixas da versão v1" fecha as faixas; ver de novo não consulta outra vez', async () => {
    const user = usuarioRapido()
    const { chamadas } = renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())
    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))
    await within(dialogo()).findByRole('table', { name: 'Faixas da versão v1' })

    await user.click(within(dialogo()).getByRole('button', { name: 'Ocultar faixas da versão v1' }))
    expect(within(dialogo()).queryByRole('table', { name: 'Faixas da versão v1' })).not.toBeInTheDocument()

    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))
    expect(await within(dialogo()).findByRole('table', { name: 'Faixas da versão v1' })).toBeInTheDocument()
    expect(gets(chamadas, `${ROTA}/versoes/1`)).toHaveLength(1)
  })

  it('as faixas de mais de uma versão podem ficar abertas ao mesmo tempo', async () => {
    const user = usuarioRapido()
    renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v2' }))
    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))

    expect(await within(dialogo()).findByRole('table', { name: 'Faixas da versão v2' })).toBeInTheDocument()
    expect(await within(dialogo()).findByRole('table', { name: 'Faixas da versão v1' })).toBeInTheDocument()
  })

  it('falha ao consultar as faixas de uma versão: alerta com a mensagem da API, sem fechar o histórico', async () => {
    const user = usuarioRapido()
    renderizar({}, { [`GET ${ROTA}/versoes/1`]: () => respostaErro(404, 'Versão não encontrada.') })
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Versão não encontrada.')
    expect(tabela()).toBeInTheDocument()
  })

  it('somente leitura: não há ações de editar ou excluir versões', async () => {
    renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    const botoes = within(dialogo())
      .getAllByRole('button')
      .map((b) => b.textContent?.trim() || b.getAttribute('aria-label'))
    expect(botoes.filter((nome) => /editar|excluir|apagar|remover/i.test(nome ?? ''))).toEqual([])
  })

  it('sem versões: "Nenhuma versão registrada." no lugar da tabela', async () => {
    renderizar({}, { [`GET ${ROTA}/historico`]: () => respostaJson([]) })

    expect(await within(dialogo()).findByText('Nenhuma versão registrada.')).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('table', { name: 'Versões' })).not.toBeInTheDocument()
  })

  it('erro no histórico: alerta com a mensagem da API e "Tentar novamente" consulta de novo', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = renderizar(
      {},
      { [`GET ${ROTA}/historico`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoFaixasApi())) },
    )

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')
    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas, `${ROTA}/historico`)).toHaveLength(2)
  })

  it('"Fechar" e Esc chamam onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
  })
})
