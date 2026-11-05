import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { INDICADOR_FATURAMENTO_API, historicoMetasApi, rotaHistoricoMetas } from '../../test/indicadoresFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoMetas, type DialogoHistoricoMetasProps } from './DialogoHistoricoMetas'

const FATURAMENTO = paraIndicador(INDICADOR_FATURAMENTO_API)
const ROTA = '/api/ped/indicadores-cadastro/3/metas-historico'
const COLUNAS = ['Data', 'Filial', 'Mês', 'De', 'Para', 'Usuário', 'Motivo']

/**
 * O diálogo consulta o histórico por conta própria (`listarHistoricoMetas`) ao abrir e sempre que a
 * filial muda, para oferecer "Tentar novamente" sem depender da página.
 */
describe('F6.8 — DialogoHistoricoMetas (histórico de alterações de meta — RF-39, RNF-01)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  function renderizar(props: Partial<DialogoHistoricoMetasProps> = {}, rota: (init: RequestInit | undefined, url: URL) => Response | Promise<Response> = rotaHistoricoMetas()) {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rota })
    const onFechar = props.onFechar ?? vi.fn()
    const utils = render(
      <DialogoHistoricoMetas
        indicador={props.indicador === undefined ? FATURAMENTO : props.indicador}
        filial={props.filial === undefined ? 'todas' : props.filial}
        onFechar={onFechar}
      />,
    )
    return { ...utils, chamadas, onFechar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de metas' })
  const tabela = () => within(dialogo()).getByRole('table', { name: 'Histórico de metas' })
  const linhas = () => within(tabela()).getAllByRole('row').slice(1)
  const celulas = (linha: HTMLElement) => within(linha).getAllByRole('cell').map((c) => c.textContent)

  it('com indicador null não renderiza nada nem consulta a API', () => {
    const { chamadas } = renderizar({ indicador: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gets(chamadas)).toHaveLength(0)
  })

  it('abre "Histórico de metas" com o nome do indicador, anuncia o carregamento e consulta GET .../{id}/metas-historico sem filial quando a filial é "todas"', async () => {
    const { chamadas } = renderizar({ filial: 'todas' })

    expect(dialogo()).toHaveTextContent('Faturamento líquido mensal')
    expect(within(dialogo()).getByText('Todas as filiais')).toBeInTheDocument()
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Carregando histórico...')

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('tabela com as colunas Data, Filial, Mês, De, Para, Usuário e Motivo e uma linha por ajuste, na ordem da API (mais recente primeiro)', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
    expect(linhas()).toHaveLength(3)
    expect(celulas(linhas()[0])).toEqual(['28/10/2026 09:12', '101', '10/2026', '1.500.000,50', '1.600.000,00', 'Ana Costa', 'Sazonalidade de outubro'])
    expect(celulas(linhas()[1])).toEqual(['15/10/2026 16:40', '102', '10/2026', '1.500.000,50', '1.200.000,00', 'Beltrano', 'Reforma na loja'])
  })

  it('"De" nulo (primeiro ajuste) é exibido como "—"', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(celulas(linhas()[2])).toEqual(['02/09/2026 08:05', '101', '09/2026', '—', '1.450.000,00', 'Maria Souza', 'Ajuste inicial'])
  })

  it('com a filial do cabeçalho, envia filial na query, mostra "Filial 101" e lista só os ajustes devolvidos', async () => {
    const { chamadas } = renderizar({ filial: '101' })

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(gets(chamadas)[0].url.searchParams.get('filial')).toBe('101')
    expect(within(dialogo()).getByText('Filial 101')).toBeInTheDocument()
    expect(linhas()).toHaveLength(2)
    expect(linhas().map((l) => celulas(l)[1])).toEqual(['101', '101'])
  })

  it('quando a filial muda com o diálogo aberto, consulta de novo com a nova filial', async () => {
    const { chamadas, rerender, onFechar } = renderizar({ filial: '101' })
    await waitFor(() => expect(linhas()).toHaveLength(2))

    rerender(<DialogoHistoricoMetas indicador={FATURAMENTO} filial="102" onFechar={onFechar} />)

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(gets(chamadas)[1].url.searchParams.get('filial')).toBe('102')
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(celulas(linhas()[0])[5]).toBe('Beltrano')
  })

  it('sem ajustes mostra "Nenhuma alteração de meta registrada." e não mostra a tabela', async () => {
    renderizar({}, () => respostaJson([]))

    expect(await within(dialogo()).findByText('Nenhuma alteração de meta registrada.')).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro na consulta: Aviso de erro com a mensagem e "Tentar novamente", que repete a consulta', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = renderizar({}, (_init, url) => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : rotaHistoricoMetas()(_init, url)))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()

    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas)).toHaveLength(2)
    expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('o histórico é somente leitura: nenhum botão de editar ou excluir', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(within(dialogo()).queryByRole('button', { name: /editar|excluir|remover/i })).not.toBeInTheDocument()
  })

  it('"Fechar" e Esc chamam onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()
    await waitFor(() => expect(tabela()).toBeInTheDocument())

    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('resposta atrasada da filial anterior não sobrescreve a atual (proteção de corrida)', async () => {
    let liberarAntiga: () => void = () => {}
    const { rerender, onFechar } = renderizar({ filial: '101' }, (_init, url) => {
      if (url.searchParams.get('filial') === '101') {
        return new Promise<Response>((resolve) => {
          liberarAntiga = () => resolve(respostaJson(historicoMetasApi().filter((h) => h.filial === '101')))
        })
      }
      return respostaJson(historicoMetasApi().filter((h) => h.filial === '102'))
    })

    rerender(<DialogoHistoricoMetas indicador={FATURAMENTO} filial="102" onFechar={onFechar} />)
    await waitFor(() => expect(linhas()).toHaveLength(1))

    liberarAntiga()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(linhas()).toHaveLength(1)
    expect(celulas(linhas()[0])[1]).toBe('102')
  })
})
