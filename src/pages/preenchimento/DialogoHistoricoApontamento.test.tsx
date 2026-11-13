import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { historicoApontamentoApi } from '../../test/preenchimentoFalsos'
import { APONTAMENTO_INADIMPLENCIA, APONTAMENTO_VISITAS, APONTAMENTO_VITRINE } from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoApontamento, type DialogoHistoricoApontamentoProps } from './DialogoHistoricoApontamento'

const ROTA_9 = '/api/ped/apontamentos/9/historico'
const COLUNAS = ['Data', 'Ação', 'Valor anterior', 'Valor novo', 'Usuário', 'Motivo']

/**
 * Diálogo "Histórico do apontamento" (F9.7 — RF-69, RNF-01, RNF-03). Consulta sozinho, ao abrir,
 * `listarHistoricoApontamento(apontamento.id, { filial, mesDeReferencia })` e mostra a tabela
 * "Lançamentos e correções" (Data dd/mm/aaaa hh:mm, Ação Lançamento/Correção, Valor anterior, Valor
 * novo, Usuário, Motivo; "—" quando vazio), na ordem da API (mais recente primeiro). Somente leitura:
 * nenhuma ação de editar ou excluir.
 */
describe('F9.7 — DialogoHistoricoApontamento (histórico de lançamento e correções)', () => {
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

  function renderizar(props: Partial<DialogoHistoricoApontamentoProps> = {}, rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA_9}`]: () => respostaJson(historicoApontamentoApi()),
      ...rotas,
    })
    const onFechar = props.onFechar ?? vi.fn()
    render(
      <DialogoHistoricoApontamento
        apontamento={props.apontamento === undefined ? APONTAMENTO_INADIMPLENCIA : props.apontamento}
        filial={props.filial ?? '101'}
        mesDeReferencia={props.mesDeReferencia ?? '2026-10-01'}
        onFechar={onFechar}
      />,
    )
    return { chamadas, onFechar }
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico do apontamento' })
  const tabela = () => within(dialogo()).getByRole('table', { name: 'Lançamentos e correções' })
  const celulas = () =>
    within(tabela())
      .getAllByRole('row')
      .slice(1)
      .map((linha) => within(linha).getAllByRole('cell').map((c) => c.textContent))

  it('com apontamento null não renderiza nada nem consulta a API', () => {
    const { chamadas } = renderizar({ apontamento: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas).toHaveLength(0)
  })

  it('abre com o nome do apontamento, anuncia o carregamento e consulta GET .../{id}/historico com filial e mês (AAAA-MM)', async () => {
    const { chamadas } = renderizar()

    expect(dialogo()).toHaveTextContent('Inadimplência')
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Carregando histórico...')

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas, ROTA_9)).toHaveLength(1)
    expect(gets(chamadas, ROTA_9)[0].url.searchParams.get('filial')).toBe('101')
    expect(gets(chamadas, ROTA_9)[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10')
  })

  it('colunas Data, Ação, Valor anterior, Valor novo, Usuário e Motivo', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
  })

  it('linhas na ordem da API (mais recente primeiro), com data dd/mm/aaaa hh:mm, ação por extenso, valores formatados e "—" no vazio', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(celulas()).toEqual([
      ['20/10/2026 10:00', 'Correção', '75,00%', '80,00%', 'Ana Costa', 'digitação errada'],
      ['05/10/2026 09:00', 'Lançamento', '—', '75,00%', 'Fulano', '—'],
    ])
  })

  it('Numeral: valores com vírgula decimal e ponto de milhar', async () => {
    renderizar(
      { apontamento: APONTAMENTO_VISITAS },
      {
        'GET /api/ped/apontamentos/5/historico': () =>
          respostaJson([
            { acao: 'correcao', 'valor anterior': 1000, 'valor novo': 1234.56, usuario: 'Ana Costa', motivo: 'conferência', data: '2026-10-04 08:30:00' },
          ]),
      },
    )

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(celulas()).toEqual([['04/10/2026 08:30', 'Correção', '1.000,00', '1.234,56', 'Ana Costa', 'conferência']])
  })

  it('Booleano: valores Sim/Não', async () => {
    renderizar(
      { apontamento: { ...APONTAMENTO_VITRINE, situacao: 'corrigido', valor: false } },
      {
        'GET /api/ped/apontamentos/7/historico': () =>
          respostaJson([
            { acao: 'correcao', 'valor anterior': true, 'valor novo': false, usuario: 'Ana Costa', motivo: 'vitrine desmontada', data: '2026-10-06 10:00:00' },
            { acao: 'lancamento', 'valor anterior': null, 'valor novo': true, usuario: 'Fulano', motivo: null, data: '2026-10-02 09:00:00' },
          ]),
      },
    )

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(celulas()).toEqual([
      ['06/10/2026 10:00', 'Correção', 'Sim', 'Não', 'Ana Costa', 'vitrine desmontada'],
      ['02/10/2026 09:00', 'Lançamento', '—', 'Sim', 'Fulano', '—'],
    ])
  })

  it('consulta a filial e o mês recebidos (ex.: consulta de setembro na filial 102)', async () => {
    const { chamadas } = renderizar({ filial: '102', mesDeReferencia: '2026-09-01' })

    await waitFor(() => expect(gets(chamadas, ROTA_9)).toHaveLength(1))
    expect(gets(chamadas, ROTA_9)[0].url.searchParams.get('filial')).toBe('102')
    expect(gets(chamadas, ROTA_9)[0].url.searchParams.get('mes_de_referencia')).toBe('2026-09')
  })

  it('histórico vazio: "Nenhum lançamento registrado."', async () => {
    renderizar({}, { [`GET ${ROTA_9}`]: () => respostaJson([]) })

    expect(await within(dialogo()).findByText('Nenhum lançamento registrado.')).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro da API: alerta com a mensagem e "Tentar novamente" consulta de novo', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = renderizar({}, {
      [`GET ${ROTA_9}`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoApontamentoApi())),
    })

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')

    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(gets(chamadas, ROTA_9)).toHaveLength(2)
  })

  it('somente leitura (RNF-01): nenhuma ação de editar ou excluir', async () => {
    renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    expect(within(dialogo()).queryByRole('button', { name: /editar|excluir|apagar/i })).not.toBeInTheDocument()
  })

  it('"Fechar" chama onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()

    await waitFor(() => expect(tabela()).toBeInTheDocument())
    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))

    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})
