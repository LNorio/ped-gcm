import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { INDICADOR_META_COBERTURA, historicoMetaPreenchimentoApi } from '../../test/metasPreenchimentoFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoMetaPreenchimento, type DialogoHistoricoMetaPreenchimentoProps } from './DialogoHistoricoMetaPreenchimento'

const ROTA = '/api/ped/indicadores-cadastro/12/metas-historico'
const COLUNAS = ['Data', 'De', 'Para', 'Usuário', 'Motivo']

/**
 * Histórico de ajustes de meta de um indicador no Preenchimento
 * (`src/pages/preenchimento/DialogoHistoricoMetaPreenchimento.tsx` — RF-74, RNF-01).
 *
 * - Props `{ indicador: IndicadorMetaPreenchimento | null; filial; nomeFilial?; mesDeReferencia; onFechar }`;
 *   `null` = fechado, sem consultar a API.
 * - Diálogo "Histórico de metas" com o nome do indicador, a filial ("{código} - {nome}") e o mês (MM/AAAA).
 * - Consulta sozinho `listarHistoricoMetas(id, { filial, mesDeReferencia })` → `GET .../{id}/metas-historico
 *   ?filial=&mes_de_referencia=AAAA-MM` ("Carregando histórico..."), de novo quando filial ou mês mudam.
 * - Tabela "Histórico de metas" com Data (dd/mm/aaaa hh:mm), De, Para (pt-BR, 2 casas; `de` nulo → "—"),
 *   Usuário e Motivo, na ordem da API (mais recente primeiro).
 * - Vazio: "Nenhum ajuste de meta neste mês."; erro: alerta com a mensagem e "Tentar novamente".
 * - Somente leitura (RNF-01). "Fechar" e Esc chamam `onFechar`.
 */
describe('F9.10 — DialogoHistoricoMetaPreenchimento (histórico de ajustes de meta do mês — RF-74, RNF-01)', () => {
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

  function renderizar(props: Partial<DialogoHistoricoMetaPreenchimentoProps> = {}, rota: RotaFalsa = () => respostaJson(historicoMetaPreenchimentoApi())) {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rota })
    const onFechar = props.onFechar ?? vi.fn()
    const utils = render(
      <DialogoHistoricoMetaPreenchimento
        indicador={props.indicador === undefined ? INDICADOR_META_COBERTURA : props.indicador}
        filial={props.filial ?? '101'}
        nomeFilial={props.nomeFilial === undefined ? 'CAMPO GRANDE' : props.nomeFilial}
        mesDeReferencia={props.mesDeReferencia ?? '2026-10-01'}
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

  it('abre com o indicador, a filial e o mês; anuncia o carregamento e consulta com filial e mes_de_referencia (AAAA-MM)', async () => {
    const { chamadas } = renderizar()

    expect(dialogo()).toHaveTextContent('Cobertura de clientes')
    expect(dialogo()).toHaveTextContent('101 - CAMPO GRANDE')
    expect(dialogo()).toHaveTextContent('10/2026')
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Carregando histórico...')

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.searchParams.get('filial')).toBe('101')
    expect(gets(chamadas)[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10')
  })

  it('tabela com Data, De, Para, Usuário e Motivo, uma linha por ajuste, na ordem da API', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
    expect(linhas()).toHaveLength(2)
    expect(celulas(linhas()[0])).toEqual(['20/10/2026 14:30', '1.800,00', '2.000,25', 'Ana Costa', 'sazonalidade'])
    expect(celulas(linhas()[1])).toEqual(['05/10/2026 09:00', '1.500,00', '1.800,00', 'Fulano', 'campanha de clientes'])
  })

  it('"De" nulo é exibido como "—"', async () => {
    renderizar({}, () =>
      respostaJson([{ data: '2026-10-02 08:00:00', filial: '101', 'mes de referencia': '2026-10-01', de: null, para: 1800, usuario: 'Fulano', motivo: 'primeiro ajuste' }]),
    )

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(celulas(linhas()[0])).toEqual(['02/10/2026 08:00', '—', '1.800,00', 'Fulano', 'primeiro ajuste'])
  })

  it('sem o nome da filial mostra só o código', async () => {
    renderizar({ nomeFilial: null })

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(dialogo()).toHaveTextContent('101')
    expect(dialogo()).not.toHaveTextContent('CAMPO GRANDE')
  })

  it('quando o mês muda com o diálogo aberto, consulta de novo com o novo mês', async () => {
    const { chamadas, rerender, onFechar } = renderizar()
    await waitFor(() => expect(linhas()).toHaveLength(2))

    rerender(
      <DialogoHistoricoMetaPreenchimento indicador={INDICADOR_META_COBERTURA} filial="101" nomeFilial="CAMPO GRANDE" mesDeReferencia="2026-09-01" onFechar={onFechar} />,
    )

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(gets(chamadas)[1].url.searchParams.get('mes_de_referencia')).toBe('2026-09')
  })

  it('sem ajustes mostra "Nenhum ajuste de meta neste mês." e não mostra a tabela', async () => {
    renderizar({}, () => respostaJson([]))

    expect(await within(dialogo()).findByText('Nenhum ajuste de meta neste mês.')).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro na consulta: alerta com a mensagem e "Tentar novamente", que repete a consulta', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = renderizar({}, () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoMetaPreenchimentoApi())))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()

    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas)).toHaveLength(2)
    expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('somente leitura: nenhum botão de editar ou excluir nem campo de texto', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())

    expect(within(dialogo()).queryByRole('button', { name: /editar|excluir|remover/i })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('textbox')).not.toBeInTheDocument()
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
