import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { acessoApi, respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { criarApiMetasFalsa, historicoMetaPreenchimentoApi } from '../../test/metasPreenchimentoFalsos'
import { historicoPeriodosApi, janelaMetasApi, mesesPreenchimentoApi, periodoApi, telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA_HISTORICO_12 = '/api/ped/indicadores-cadastro/12/metas-historico'
const ROTA_HISTORICO_13 = '/api/ped/indicadores-cadastro/13/metas-historico'

/**
 * Histórico de ajustes de meta no Preenchimento (F9.10 — RF-74, RNF-01).
 *
 * Na janela "Editar metas" (F9.9), cada indicador ajustado oferece "Histórico de {nome}"; o diálogo
 * "Histórico de metas" abre por cima da janela e consulta `GET /api/ped/indicadores-cadastro/{id}/
 * metas-historico?filial=&mes_de_referencia=AAAA-MM` com a filial e o mês da tela, listando data, de,
 * para, usuário e motivo. Fechar o histórico volta à janela "Editar metas", que continua aberta.
 *
 * Preenchedor da filial 101, outubro/2026 aberto; indicador 12 "Cobertura de clientes" ajustado e
 * 13 "Faturamento" sem ajuste (`janelaMetasApi`).
 */
describe('F9.10 — Histórico de ajustes de meta no Preenchimento (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(rotasExtras: Record<string, RotaFalsa> = {}) {
    const api = criarApiMetasFalsa(janelaMetasApi())
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      'GET /api/ped/periodo': () => respostaJson(periodoApi()),
      'GET /api/ped/periodo/historico': () => respostaJson(historicoPeriodosApi()),
      'GET /api/ped/preenchimento/meses': () => respostaJson(mesesPreenchimentoApi()),
      'GET /api/ped/preenchimento': () => respostaJson(telaPreenchimentoApi()),
      [`GET ${ROTA_HISTORICO_12}`]: () => respostaJson(historicoMetaPreenchimentoApi()),
      [`GET ${ROTA_HISTORICO_13}`]: () =>
        respostaJson([{ data: '2026-10-21 10:00:00', filial: '101', 'mes de referencia': '2026-10-01', de: 500000, para: 520000, usuario: 'Fulano', motivo: 'reforma da loja' }]),
      ...api.rotas,
      ...rotasExtras,
    })
  }

  const getsHistorico = (chamadas: ChamadaRegistrada[], rota: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === rota)
  const janela = () => screen.getByRole('dialog', { name: 'Editar metas' })
  const historico = () => screen.getByRole('dialog', { name: 'Histórico de metas' })
  const tabelaHistorico = () => within(historico()).getByRole('table', { name: 'Histórico de metas' })
  const linhasHistorico = () => within(tabelaHistorico()).getAllByRole('row').slice(1)
  const celulas = (linha: HTMLElement) => within(linha).getAllByRole('cell').map((c) => c.textContent)

  async function abrirJanela(user: Usuario) {
    renderizarApp('/preenchimento')
    await user.click(await screen.findByRole('button', { name: 'Editar metas (2)' }))
    return janela()
  }

  it('o indicador ajustado oferece "Histórico de {nome}"; o sem ajuste, não', async () => {
    const user = usuarioRapido()
    simularSessao()

    await abrirJanela(user)

    expect(within(janela()).getByRole('button', { name: 'Histórico de Cobertura de clientes' })).toBeInTheDocument()
    expect(within(janela()).queryByRole('button', { name: 'Histórico de Faturamento' })).not.toBeInTheDocument()
  })

  it('abre "Histórico de metas" filtrado pela filial e pelo mês da tela, com data, de, para, usuário e motivo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirJanela(user)

    await user.click(within(janela()).getByRole('button', { name: 'Histórico de Cobertura de clientes' }))

    expect(historico()).toHaveTextContent('Cobertura de clientes')
    await waitFor(() => expect(linhasHistorico()).toHaveLength(2))
    expect(within(tabelaHistorico()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Data', 'De', 'Para', 'Usuário', 'Motivo'])
    expect(celulas(linhasHistorico()[0])).toEqual(['20/10/2026 14:30', '1.800,00', '2.000,25', 'Ana Costa', 'sazonalidade'])
    expect(celulas(linhasHistorico()[1])).toEqual(['05/10/2026 09:00', '1.500,00', '1.800,00', 'Fulano', 'campanha de clientes'])

    const consulta = getsHistorico(chamadas, ROTA_HISTORICO_12)
    expect(consulta).toHaveLength(1)
    expect(consulta[0].url.searchParams.get('filial')).toBe('101')
    expect(consulta[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10')
  })

  it('fechar o histórico volta à janela "Editar metas", que continua aberta com o que foi digitado', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirJanela(user)
    await colar(user, within(janela()).getByRole('textbox', { name: 'Motivo do ajuste de Faturamento' }), 'reforma da loja')

    await user.click(within(janela()).getByRole('button', { name: 'Histórico de Cobertura de clientes' }))
    await waitFor(() => expect(linhasHistorico()).toHaveLength(2))
    await user.click(within(historico()).getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog', { name: 'Histórico de metas' })).not.toBeInTheDocument()
    expect(janela()).toBeInTheDocument()
    expect(within(janela()).getByRole('textbox', { name: 'Motivo do ajuste de Faturamento' })).toHaveValue('reforma da loja')
  })

  // Revisão da F9 em 13/11/2026: com os dois diálogos abertos, o Esc fecha só o de cima.
  it('Esc no "Histórico de metas" fecha só o histórico; "Editar metas" continua aberta com os valores digitados', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirJanela(user)
    await user.type(within(janela()).getByRole('textbox', { name: 'Nova meta de Faturamento' }), '520000')
    await colar(user, within(janela()).getByRole('textbox', { name: 'Motivo do ajuste de Faturamento' }), 'reforma da loja')

    await user.click(within(janela()).getByRole('button', { name: 'Histórico de Cobertura de clientes' }))
    await waitFor(() => expect(linhasHistorico()).toHaveLength(2))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Histórico de metas' })).not.toBeInTheDocument()
    expect(janela()).toBeInTheDocument()
    expect(within(janela()).getByRole('textbox', { name: 'Nova meta de Faturamento' })).toHaveValue('520000')
    expect(within(janela()).getByRole('textbox', { name: 'Motivo do ajuste de Faturamento' })).toHaveValue('reforma da loja')
  })

  it('depois de ajustar um indicador, ele passa a oferecer o histórico', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirJanela(user)

    await user.type(within(janela()).getByRole('textbox', { name: 'Nova meta de Faturamento' }), '520000')
    await colar(user, within(janela()).getByRole('textbox', { name: 'Motivo do ajuste de Faturamento' }), 'reforma da loja')
    await user.click(within(janela()).getByRole('button', { name: 'Salvar metas' }))
    await screen.findByText('Metas ajustadas.')

    await user.click(await screen.findByRole('button', { name: 'Editar metas (2)' }))
    await user.click(await within(janela()).findByRole('button', { name: 'Histórico de Faturamento' }))

    await waitFor(() => expect(linhasHistorico()).toHaveLength(1))
    expect(celulas(linhasHistorico()[0])).toEqual(['21/10/2026 10:00', '500.000,00', '520.000,00', 'Fulano', 'reforma da loja'])
    expect(getsHistorico(chamadas, ROTA_HISTORICO_13)).toHaveLength(1)
  })

  it('erro na consulta do histórico: alerta com a mensagem e "Tentar novamente"; a janela de metas não é afetada', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simularSessao({
      [`GET ${ROTA_HISTORICO_12}`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoMetaPreenchimentoApi())),
    })
    await abrirJanela(user)

    await user.click(within(janela()).getByRole('button', { name: 'Histórico de Cobertura de clientes' }))

    expect(await within(historico()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')
    falhar = false
    await user.click(within(historico()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(linhasHistorico()).toHaveLength(2))
    expect(getsHistorico(chamadas, ROTA_HISTORICO_12)).toHaveLength(2)
    expect(within(janela()).queryByRole('alert')).not.toBeInTheDocument()
  })
})
