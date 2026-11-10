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
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  aplicarMetasPendentesApi,
  indicadoresComMetaPendenteApi,
  respostaErrosPorFilial,
  respostaMetasPendentesApi,
  rotaListarIndicadoresComMetaPendente,
  type CorpoMetasPendentesApiFalso,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

/**
 * F6.12 — "Definir metas pendentes" (integração: /indicadores com a aplicação completa; só a rede é
 * simulada). `PUT /api/ped/indicadores-cadastro/{id}/metas-filiais` com `{ "metas por filial": [...] }`
 * só com as filiais preenchidas; 200 `{ mensagem, "filiais definidas", "filiais sem meta" }`; 400 com
 * `erros` por filial; 404; 403.
 *
 * Ticket médio por filial (id 8): 100 MATRIZ com meta; 101 CAMPO GRANDE e 102 DOURADOS pendentes.
 * Ao salvar: a modal fecha, aparece "Metas definidas." e a lista é recarregada (a etiqueta
 * "Meta pendente em N filiais" diminui ou some e os alertas são atualizados).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_PUT = `${ROTA}/8/metas-filiais`
const ITEM = 'Definir metas pendentes'
const TICKET = 'Ticket médio por filial'

describe('F6.12 — Definir metas pendentes (integração: /indicadores)', () => {
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

  interface Opcoes {
    perfil?: 'admin' | 'validador'
    lista?: IndicadorApiFalso[]
    /** Resposta própria do PUT; sem ela, a rota grava as metas na lista e responde 200. */
    aoDefinir?: () => Response | Promise<Response>
  }

  function simularSessao(opcoes: Opcoes = {}) {
    const acesso = acessoApi({ perfil: opcoes.perfil ?? 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = opcoes.lista ?? indicadoresComMetaPendenteApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetaPendente(() => lista),
      [`PUT ${ROTA_PUT}`]: (init) => {
        if (opcoes.aoDefinir) return opcoes.aoDefinir()
        const corpo = JSON.parse(String(init?.body)) as CorpoMetasPendentesApiFalso
        lista = lista.map((i) => (i.id === 8 ? aplicarMetasPendentesApi(i, corpo['metas por filial']) : i))
        const restantes = lista.find((i) => i.id === 8)?.['filiais sem meta'] ?? []
        return respostaJson(respostaMetasPendentesApi(corpo['metas por filial'].map((m) => m.filial), restantes))
      },
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const modal = () => screen.getByRole('dialog', { name: 'Definir metas pendentes' })
  const campo = (rotulo: string) => within(modal()).getByRole('textbox', { name: `Meta da filial ${rotulo}` })
  const salvar = () => within(modal()).getByRole('button', { name: 'Salvar metas' })
  const linhaDoTicket = () => within(screen.getByRole('table', { name: 'Indicadores' })).getByText(TICKET).closest('tr')!

  async function abrirTela() {
    renderizarApp('/indicadores')
    return screen.findByRole('table', { name: 'Indicadores' })
  }

  async function abrirModal(user: Usuario) {
    await escolherAcao(user, rotuloAcoesIndicador(TICKET), ITEM)
    return modal()
  }

  async function selecionarFilialNoCabecalho(user: Usuario, rotulo: string) {
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    await user.selectOptions(seletor, within(seletor).getByRole('option', { name: rotulo }))
  }

  it('Admin, visão "Todas as filiais": a modal lista só as filiais sem meta; salvar uma faz o PUT, fecha, notifica e recarrega ("Meta pendente em 1 filial")', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()
    expect(within(linhaDoTicket()).getByText('Meta pendente em 2 filiais')).toBeInTheDocument()

    const dialogo = await abrirModal(user)
    expect(dialogo).toHaveTextContent(TICKET)
    const grupo = within(dialogo).getByRole('group', { name: 'Filiais sem meta' })
    expect(within(grupo).getAllByRole('textbox')).toHaveLength(2)
    expect(within(dialogo).queryByRole('textbox', { name: 'Meta da filial 100 - MATRIZ' })).not.toBeInTheDocument()

    await user.type(campo('101 - CAMPO GRANDE'), '1.200,50')
    const consultasAntes = gets(chamadas).length
    await user.click(salvar())

    await screen.findByText('Metas definidas.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(ROTA_PUT)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ 'metas por filial': [{ filial: '101', meta: 1200.5 }] })
    await waitFor(() => expect(gets(chamadas).length).toBeGreaterThan(consultasAntes))
    await waitFor(() => expect(within(linhaDoTicket()).getByText('Meta pendente em 1 filial')).toBeInTheDocument())
  })

  it('preencher todas as pendentes tira a etiqueta, a ação e o sinal da aba (único alerta)', async () => {
    const user = usuarioRapido()
    // Só Cobertura de visitas (sem alertas) e Ticket médio: a pendência por filial é o único alerta.
    simularSessao({ lista: indicadoresComMetaPendenteApi().filter((i) => i.id === 1 || i.id === 8) })
    await abrirTela()
    const linkIndicadores = within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Indicadores/ })
    await waitFor(() => expect(within(linkIndicadores).getByRole('img', { name: 'Com alertas' })).toBeInTheDocument())

    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '980')
    await user.type(campo('102 - DOURADOS'), '1100')
    await user.click(salvar())

    await screen.findByText('Metas definidas.')
    await waitFor(() => expect(within(linhaDoTicket()).queryByText(/^Meta pendente em/)).not.toBeInTheDocument())
    await waitFor(() => expect(within(linkIndicadores).queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument())
    await user.click(within(linhaDoTicket()).getByRole('button', { name: rotuloAcoesIndicador(TICKET) }))
    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: ITEM })).not.toBeInTheDocument()
  })

  it('com a filial 102 no cabeçalho, a modal tem um campo só para ela e o PUT leva só a 102', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()
    await selecionarFilialNoCabecalho(user, '102 - DOURADOS')

    const dialogo = await abrirModal(user)
    expect(within(dialogo).getAllByRole('textbox')).toHaveLength(1)
    await user.type(campo('102 - DOURADOS'), '640')
    await user.click(salvar())

    await screen.findByText('Metas definidas.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ 'metas por filial': [{ filial: '102', meta: 640 }] })
  })

  it('o Validador também define as metas pendentes', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ perfil: 'validador' })
    await abrirTela()

    await abrirModal(user)
    await user.type(campo('102 - DOURADOS'), '50')
    await user.click(salvar())

    await screen.findByText('Metas definidas.')
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('sem nenhuma filial preenchida: "Informe a meta de ao menos uma filial." e nenhum PUT', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()
    await abrirModal(user)

    await user.click(salvar())

    expect(within(modal()).getByText('Informe a meta de ao menos uma filial.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('400 com erros por filial: mensagem geral no alerta, erro no campo da filial e a modal continua aberta com os valores', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({
      aoDefinir: () =>
        respostaErrosPorFilial([
          { filial: '101', mensagem: 'a filial 101 ja tem meta' },
          { filial: '102', mensagem: 'a meta da filial 102 ("1.500") e ambigua: envie como numero (1500) ou com virgula decimal' },
        ]),
    })
    await abrirTela()
    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '10')
    await user.type(campo('102 - DOURADOS'), '20')
    const consultasAntes = gets(chamadas).length

    await user.click(salvar())

    await waitFor(() => expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true'))
    // O alerta geral (Aviso) é o primeiro da modal; os erros de campo também são role="alert".
    expect(within(modal()).getAllByRole('alert')[0]).toHaveTextContent('a filial 101 ja tem meta')
    expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('a filial 101 ja tem meta')
    expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('101 - CAMPO GRANDE')).toHaveValue('10')
    expect(campo('102 - DOURADOS')).toHaveValue('20')
    expect(screen.queryByText('Metas definidas.')).not.toBeInTheDocument()
    expect(gets(chamadas)).toHaveLength(consultasAntes)
  })

  it('depois do 400, editar o campo da filial limpa o erro dela', async () => {
    const user = usuarioRapido()
    simularSessao({ aoDefinir: () => respostaErrosPorFilial([{ filial: '101', mensagem: 'a filial 101 ja tem meta' }]) })
    await abrirTela()
    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '10')
    await user.click(salvar())
    await waitFor(() => expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true'))

    await user.type(campo('101 - CAMPO GRANDE'), '5')

    expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    [404, 'indicador nao encontrado'],
    [403, 'voce nao tem permissao'],
  ])('%i: a mensagem da API aparece na modal, que continua aberta', async (status, mensagem) => {
    const user = usuarioRapido()
    simularSessao({ aoDefinir: () => respostaErro(status, mensagem) })
    await abrirTela()
    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '10')

    await user.click(salvar())

    expect(await within(modal()).findByRole('alert')).toHaveTextContent(mensagem)
    expect(campo('101 - CAMPO GRANDE')).toHaveValue('10')
  })

  it('"Cancelar" fecha a modal sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()
    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '10')

    await user.click(within(modal()).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('clique duplo em "Salvar metas" faz um único PUT', async () => {
    const user = usuarioRapido()
    let liberar: (resposta: Response) => void = () => {}
    const chamadas = simularSessao({ aoDefinir: () => new Promise<Response>((resolver) => (liberar = resolver)) })
    await abrirTela()
    await abrirModal(user)
    await user.type(campo('101 - CAMPO GRANDE'), '10')

    await user.dblClick(salvar())
    await waitFor(() => expect(puts(chamadas)).toHaveLength(1))
    liberar(respostaJson(respostaMetasPendentesApi(['101'], ['102'])))

    await screen.findByText('Metas definidas.')
    expect(puts(chamadas)).toHaveLength(1)
  })
})
