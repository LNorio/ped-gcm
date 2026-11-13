import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { ABERTO_POR_FALSO, DATA_ATUAL_FALSA, MENSAGEM_MES_FUTURO, criarApiPeriodoFalsa } from '../../test/periodoFalsos'
import { janelaMetasApi } from '../../test/preenchimentoFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA_ABRIR = '/api/ped/periodo/abrir'
const ROTA_PREENCHIMENTO = '/api/ped/preenchimento'

/**
 * Reabertura de mês passado já fechado (F9.12 — RF-76; A-06 resolvida em 06/11/2026). O Admin usa o
 * mesmo "Abrir outro mês" e escolhe um mês anterior ao aberto; a confirmação indica a reabertura e
 * avisa "Isto fechará o preenchimento de <mês atual>" (um mês aberto por vez). `POST
 * /api/ped/periodo/abrir` responde `201` com `"periodo reaberto"`; a notificação diz
 * "Período reaberto: MM/AAAA." e a página recarrega e passa para o mês reaberto. O histórico mostra a
 * linha nova com a etiqueta "Reaberto".
 *
 * Sessão: filial única 101 (CAMPO GRANDE). Mês aberto: 10/2026. Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.12 — Reabrir mês passado já fechado (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DATA_ATUAL_FALSA)
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]], 'periodo aberto': '2026-10-01' })
    const api = criarApiPeriodoFalsa()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const postsAbrir = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA_ABRIR)
  const getsPreenchimento = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_PREENCHIMENTO)
  const dialogoAbrir = () => screen.getByRole('dialog', { name: 'Abrir outro mês' })

  async function abrirTela(chamadas: ChamadaRegistrada[]) {
    renderizarApp('/preenchimento')
    await screen.findByRole('button', { name: 'Histórico de aberturas' })
    await waitFor(() => expect(getsPreenchimento(chamadas).length).toBeGreaterThan(0))
  }

  async function escolherMes(user: Usuario, ano: string, mes: string) {
    await user.click(await screen.findByRole('button', { name: 'Abrir outro mês' }))
    const dialogo = dialogoAbrir()
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Ano' }), ano)
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Mês' }), mes)
    return dialogo
  }

  it.each(['validador', 'preenchedor'] as const)('o %s não tem como reabrir mês (sem "Abrir outro mês")', async (perfil) => {
    const { chamadas } = simularSessao(perfil)
    await abrirTela(chamadas)

    expect(screen.queryByRole('button', { name: 'Abrir outro mês' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reabrir/i })).not.toBeInTheDocument()
  })

  it('reabre 08/2026: indica a reabertura, avisa que fechará 10/2026, envia o POST, notifica "Período reaberto" e passa para o mês reaberto', async () => {
    const user = usuarioRapido()
    const { chamadas, api } = simularSessao()
    await abrirTela(chamadas)

    const dialogo = await escolherMes(user, '2026', 'Agosto')
    expect(within(dialogo).getByText('Reabertura')).toBeInTheDocument()
    expect(
      within(dialogo).getByText(
        'Reabertura de mês já fechado: 08/2026 voltará a aceitar lançamentos e correções, para todas as filiais. Isto fechará o preenchimento de 10/2026, que passará a ser só consulta.',
      ),
    ).toBeInTheDocument()
    const consultasAntes = chamadas.length

    await user.click(within(dialogo).getByRole('button', { name: 'Reabrir mês' }))

    const notificacao = await screen.findByText('Período reaberto: 08/2026.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(postsAbrir(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(postsAbrir(chamadas)[0])).toEqual({ 'mes de referencia': '2026-08-01' })
    expect(api.mesAberto()).toBe('2026-08-01')

    await waitFor(() => {
      const depois = chamadas.slice(consultasAntes).filter((c) => c.metodo === 'GET' && c.caminho === ROTA_PREENCHIMENTO)
      expect(depois.length).toBeGreaterThan(0)
      expect([null, '2026-08']).toContain(depois.at(-1)!.url.searchParams.get('mes_de_referencia'))
    })

    // O mês reaberto passa a ser o aberto: o próximo diálogo parte dele e já não oferece agosto.
    await user.click(screen.getByRole('button', { name: 'Abrir outro mês' }))
    expect(await within(dialogoAbrir()).findByText('Período aberto: 08/2026.')).toBeInTheDocument()
    expect(within(within(dialogoAbrir()).getByRole('combobox', { name: 'Mês' })).getByRole('option', { name: 'Agosto' })).toBeDisabled()
  })

  it('reabre um mês de outro ano (03/2019)', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao()
    await abrirTela(chamadas)

    const dialogo = await escolherMes(user, '2019', 'Março')
    await user.click(within(dialogo).getByRole('button', { name: 'Reabrir mês' }))

    expect(await screen.findByText('Período reaberto: 03/2019.')).toBeInTheDocument()
    expect(corpoDaChamada(postsAbrir(chamadas)[0])).toEqual({ 'mes de referencia': '2019-03-01' })
  })

  it('o histórico de aberturas mostra a reabertura com a etiqueta "Reaberto", quem reabriu e quando', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao()
    await abrirTela(chamadas)

    const dialogo = await escolherMes(user, '2026', 'Agosto')
    await user.click(within(dialogo).getByRole('button', { name: 'Reabrir mês' }))
    await screen.findByText('Período reaberto: 08/2026.')

    await user.click(screen.getByRole('button', { name: 'Histórico de aberturas' }))

    const historico = screen.getByRole('dialog', { name: 'Histórico de aberturas de período' })
    const tabela = await within(historico).findByRole('table', { name: 'Aberturas de período' })
    const primeira = within(tabela).getAllByRole('row')[1]
    expect(within(primeira).getByText('08/2026')).toBeInTheDocument()
    expect(within(primeira).getByText('Reaberto')).toBeInTheDocument()
    expect(within(primeira).getByText(ABERTO_POR_FALSO)).toBeInTheDocument()
    expect(within(primeira).getByText('13/11/2026 12:00')).toBeInTheDocument()
  })

  // Revisão da F9 em 13/11/2026: reabrir o mês que já está na tela (consultado como fechado) precisa
  // atualizar a janela "Editar metas", que passa a ser editável.
  it('reabrir o mês fechado que está na tela consulta de novo a janela de metas, que passa a ser editável', async () => {
    const user = usuarioRapido()
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': false, filiais: [FILIAIS_API[1]], 'periodo aberto': '2026-10-01' })
    const api = criarApiPeriodoFalsa()
    // Janela de metas coerente com o período: editável só no mês aberto no momento da consulta.
    const metas: RotaFalsa = (_init, url) => {
      const aberto = `${url.searchParams.get('mes_de_referencia')}-01` === api.mesAberto()
      return respostaJson(janelaMetasApi({ 'situacao do mes': aberto ? 'aberto' : 'fechado', editavel: aberto }))
    }
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      'GET /api/ped/metas': metas,
    })
    const getsMetasAgosto = () =>
      chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/metas' && c.url.searchParams.get('mes_de_referencia') === '2026-08')
    const janelaMetas = () => screen.getByRole('dialog', { name: 'Editar metas' })
    const grupoMeses = () => screen.getByRole('group', { name: 'Mês de competência' })
    await abrirTela(chamadas)
    await waitFor(() => expect(within(grupoMeses()).getAllByRole('button')).toHaveLength(12))

    // Consulta agosto (fechado): a janela de metas é só de consulta.
    await user.click(within(grupoMeses()).getByRole('button', { name: /^Agosto/ }))
    await waitFor(() => expect(getsMetasAgosto()).toHaveLength(1))
    await user.click(await screen.findByRole('button', { name: 'Editar metas (2)' }))
    expect(within(janelaMetas()).getByText('Somente consulta: o ajuste de meta só é permitido no mês aberto.')).toBeInTheDocument()
    await user.click(within(janelaMetas()).getByRole('button', { name: 'Fechar' }))

    // Reabre agosto, o mês que está na tela.
    const dialogo = await escolherMes(user, '2026', 'Agosto')
    await user.click(within(dialogo).getByRole('button', { name: 'Reabrir mês' }))
    await screen.findByText('Período reaberto: 08/2026.')
    await screen.findByRole('button', { name: 'Salvar lançamentos' })

    await waitFor(() => expect(getsMetasAgosto()).toHaveLength(2))
    await user.click(await screen.findByRole('button', { name: 'Editar metas (2)' }))
    expect(await within(janelaMetas()).findByRole('textbox', { name: 'Nova meta de Faturamento' })).toBeInTheDocument()
    expect(within(janelaMetas()).queryByText('Somente consulta: o ajuste de meta só é permitido no mês aberto.')).not.toBeInTheDocument()
    expect(within(janelaMetas()).getByRole('button', { name: 'Salvar metas' })).toBeInTheDocument()
  })

  it('400 na reabertura: a mensagem da API aparece no diálogo, que continua aberto', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao('admin', {
      [`POST ${ROTA_ABRIR}`]: () => respostaErro(400, MENSAGEM_MES_FUTURO),
    })
    await abrirTela(chamadas)

    const dialogo = await escolherMes(user, '2026', 'Agosto')
    await user.click(within(dialogo).getByRole('button', { name: 'Reabrir mês' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_MES_FUTURO)
    expect(dialogoAbrir()).toBeInTheDocument()
    expect(screen.queryByText('Período reaberto: 08/2026.')).not.toBeInTheDocument()
  })
})
