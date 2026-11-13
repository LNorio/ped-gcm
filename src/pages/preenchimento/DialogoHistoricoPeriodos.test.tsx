import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { historicoPeriodosApi } from '../../test/preenchimentoFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoPeriodos, type DialogoHistoricoPeriodosProps } from './DialogoHistoricoPeriodos'

const ROTA = '/api/ped/periodo/historico'

/**
 * "Histórico de aberturas" (F9.11 — RF-76: "cada abertura registra o mês, o usuário e a data"). O
 * diálogo consulta sozinho `GET /api/ped/periodo/historico` (`listarHistoricoPeriodos`) ao abrir e
 * mostra a tabela "Aberturas de período" na ordem da API (mais recente primeiro), com as colunas
 * "Mês" ("MM/AAAA", com a etiqueta "Reaberto" quando a linha é reabertura), "Aberto por" e
 * "Aberto em" ("dd/mm/aaaa hh:mm"); campos ausentes viram "—". Somente leitura.
 *
 * Histórico padrão (`historicoPeriodosApi`): 10/2026 (Ana Costa, 01/10/2026 08:00), 08/2026 reaberto
 * (Admin PED, 20/09/2026 14:00) e 09/2026 (Admin PED, 01/09/2026 07:00).
 */
describe('F9.11 — DialogoHistoricoPeriodos (registro de quem abriu cada mês e quando)', () => {
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

  function renderizar(props: Partial<DialogoHistoricoPeriodosProps> = {}, rotas: Record<string, RotaFalsa> = {}) {
    const chamadas: ChamadaRegistrada[] = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(historicoPeriodosApi()),
      ...rotas,
    })
    const onFechar = props.onFechar ?? vi.fn()
    render(<DialogoHistoricoPeriodos aberto={props.aberto ?? true} onFechar={onFechar} />)
    return { chamadas, onFechar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de aberturas de período' })
  const consultas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const linhasDeDados = (tabela: HTMLElement) => within(tabela).getAllByRole('row').slice(1)
  const textosDaLinha = (linha: HTMLElement) =>
    within(linha)
      .getAllByRole('cell')
      .map((celula) => celula.textContent?.trim())

  it('com aberto=false não renderiza nada nem consulta a API', () => {
    const { chamadas } = renderizar({ aberto: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(consultas(chamadas)).toHaveLength(0)
  })

  it('mostra "Carregando histórico..." enquanto consulta', async () => {
    renderizar({}, { [`GET ${ROTA}`]: () => new Promise<Response>(() => {}) })

    expect(await within(dialogo()).findByText('Carregando histórico...')).toBeInTheDocument()
  })

  it('consulta o histórico uma vez e mostra as aberturas na ordem da API, com mês, usuário e data', async () => {
    const { chamadas } = renderizar()

    const tabela = await within(dialogo()).findByRole('table', { name: 'Aberturas de período' })

    expect(consultas(chamadas)).toHaveLength(1)
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(['Mês', 'Aberto por', 'Aberto em'])
    const linhas = linhasDeDados(tabela)
    expect(linhas).toHaveLength(3)
    expect(textosDaLinha(linhas[0])).toEqual(['10/2026', 'Ana Costa', '01/10/2026 08:00'])
    expect(within(linhas[1]).getByText('08/2026')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('Admin PED')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('20/09/2026 14:00')).toBeInTheDocument()
    expect(textosDaLinha(linhas[2])).toEqual(['09/2026', 'Admin PED', '01/09/2026 07:00'])
  })

  it('a etiqueta "Reaberto" aparece só na linha que é reabertura', async () => {
    renderizar()

    const tabela = await within(dialogo()).findByRole('table', { name: 'Aberturas de período' })
    const linhas = linhasDeDados(tabela)

    expect(within(linhas[1]).getByText('Reaberto')).toBeInTheDocument()
    expect(within(linhas[0]).queryByText('Reaberto')).not.toBeInTheDocument()
    expect(within(linhas[2]).queryByText('Reaberto')).not.toBeInTheDocument()
  })

  it('sem "aberto por" e "aberto em" (null), mostra "—"', async () => {
    renderizar({}, {
      [`GET ${ROTA}`]: () => respostaJson([{ 'mes de referencia': '2026-07-01', 'aberto por': null, 'aberto em': null }]),
    })

    const tabela = await within(dialogo()).findByRole('table', { name: 'Aberturas de período' })

    expect(textosDaLinha(linhasDeDados(tabela)[0])).toEqual(['07/2026', '—', '—'])
  })

  it('histórico vazio mostra "Nenhuma abertura registrada."', async () => {
    renderizar({}, { [`GET ${ROTA}`]: () => respostaJson([]) })

    expect(await within(dialogo()).findByText('Nenhuma abertura registrada.')).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro na consulta mostra a mensagem como alerta e "Tentar novamente" consulta de novo', async () => {
    const user = usuarioRapido()
    let tentativas = 0
    const { chamadas } = renderizar({}, {
      [`GET ${ROTA}`]: () => {
        tentativas += 1
        return tentativas === 1 ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoPeriodosApi())
      },
    })

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')

    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(dialogo()).findByRole('table', { name: 'Aberturas de período' })).toBeInTheDocument()
    expect(consultas(chamadas)).toHaveLength(2)
    expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Fechar" chama onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()
    await within(dialogo()).findByRole('table', { name: 'Aberturas de período' })

    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))

    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1))
  })
})
