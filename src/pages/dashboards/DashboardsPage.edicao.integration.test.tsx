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
import { respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import {
  DASHBOARD_GERENTES_API,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API,
  dadosExternosParaDashboardApi,
  dashboardsApi,
  detalheDashboardApi,
  indicadoresParaDashboardApi,
  respostaGravacaoApi,
  respostaRealDetalheDashboardApi,
  rotaListarDashboards,
  rotaVinculos,
  tarefaBitrixGravacaoApi,
  tarefasDashboardApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const CAIXA = 'Enviar tarefa à TI para realizar as modificações'
const BLOCO = 'Tarefa de modificação que será enviada ao Bitrix24'

describe('F7.8 — Edição de dashboard com "Enviar tarefa à TI para realizar as modificações" (integração: /dashboards)', () => {
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
    aoEditar?: () => Response
    aoDetalhar?: () => Response
    /** "id bitrix" da tarefa de modificação devolvida no PUT com envio; `null` (padrão) = na fila (`aguardando_envio`). */
    idTarefa?: number | string | null
  }

  function simularSessao({ perfil = 'validador', aoEditar, aoDetalhar, idTarefa = null }: Opcoes = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista: DashboardApiFalso[] = dashboardsApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      [`GET ${ROTA}/2`]: aoDetalhar ?? (() => respostaJson(detalheDashboardApi(DASHBOARD_GERENTES_API))),
      [`GET ${ROTA}/2/tarefas`]: () => respostaJson(tarefasDashboardApi()),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': rotaVinculos(),
      [`PUT ${ROTA}/2`]: (init) => {
        if (aoEditar) return aoEditar()
        const corpo = JSON.parse(String(init?.body)) as { nome: string; 'enviar tarefa ti'?: boolean }
        const enviar = corpo['enviar tarefa ti'] === true
        lista = lista.map((d) =>
          d.id === 2
            ? { ...d, nome: corpo.nome, situacao: enviar ? ('em_modificacao' as const) : d.situacao, 'ultima alteracao': '2026-11-05 10:00:00' }
            : d,
        )
        const atualizado = lista.find((d) => d.id === 2)!
        return respostaJson(respostaGravacaoApi(atualizado, enviar ? tarefaBitrixGravacaoApi(`[PED] Modificar dashboard: ${corpo.nome}`, idTarefa) : null))
      },
    })
  }

  const caixa = (dialogo: HTMLElement) => within(dialogo).getByRole('checkbox', { name: (n) => n.startsWith(CAIXA) })

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function abrirEdicao(user: Usuario) {
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    await escolherAcao(user, rotuloAcoesDashboard('PED Gerentes'), 'Editar')
    const dialogo = screen.getByRole('dialog', { name: 'Editar dashboard' })
    await waitFor(() => expect(within(dialogo).getByRole('textbox', { name: 'Nome do dashboard' })).toHaveValue('PED Gerentes'))
    return dialogo
  }

  async function renomear(user: Usuario, dialogo: HTMLElement, nome: string) {
    const campo = within(dialogo).getByRole('textbox', { name: 'Nome do dashboard' })
    await user.clear(campo)
    await colar(user, campo, nome)
  }

  it('Validador abre "Editar": consulta o detalhe e as tarefas; diálogo largo preenchido, pontuação só leitura e tarefas anteriores', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirEdicao(user)

    expect(dialogo).toHaveClass('dialogo--largo')
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === `${ROTA}/2`)).toBe(true)
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === `${ROTA}/2/tarefas`)).toBe(true)
    expect(within(dialogo).getByRole('textbox', { name: 'Pontuação base máxima' })).toHaveAttribute('readonly')
    expect(within(dialogo).getByRole('textbox', { name: 'Pontuação base máxima' })).toHaveValue('50 pts')
    expect(within(dialogo).getByRole('textbox', { name: 'Pontos base de Custo de frete por entrega neste dashboard' })).toHaveValue('20')
    const tarefas = 'Tarefas anteriores: Modificação #25 · 10/09/2026 14:00 | Construção #21 · 01/08/2026 10:00'
    expect(
      within(dialogo).getByText(
        (_conteudo, elemento) =>
          elemento?.textContent === tarefas && Array.from(elemento.children).every((filho) => filho.textContent !== tarefas),
      ),
    ).toBeInTheDocument()
    expect(caixa(dialogo)).not.toBeChecked()
    expect(within(dialogo).queryByRole('region', { name: BLOCO })).not.toBeInTheDocument()
  })

  it('"Salvar alterações": PUT com "enviar tarefa ti": false → "Dashboard atualizado." e a lista mostra o novo nome, ainda ativo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirEdicao(user)

    await renomear(user, dialogo, 'PED Gerentes de Loja')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    const notificacao = await screen.findByText('Dashboard atualizado.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/2`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      nome: 'PED Gerentes de Loja',
      periodicidade: 'mensal',
      'pontuacao base maxima': 50,
      'tipo de vinculo': 'cargos',
      'itens vinculados': ['Gerente de Loja'],
      indicadores: [
        { 'id indicador': 3, 'pontos base': 30 },
        { 'id indicador': 6, 'pontos base': 20 },
      ],
      'indicador base da faixa': 3,
      'formula de pontuacao': 'Atingimento médio ponderado pelos pontos base.',
      'observacao para ti': 'Usar a mesma régua do PED Comercial.',
      'enviar tarefa ti': false,
    })
    const tabela = screen.getByRole('table', { name: 'Dashboards' })
    await waitFor(() => expect(within(tabela).getByText('PED Gerentes de Loja')).toBeInTheDocument())
    expect(within(within(tabela).getByText('PED Gerentes de Loja').closest('tr')!).getByText('Ativo')).toBeInTheDocument()
  })

  it('com "Enviar tarefa à TI…": bloco da tarefa de modificação com o título; PUT com "enviar tarefa ti": true e a observação → notificação e "Em modificação (TI)" na lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ perfil: 'admin' })
    const dialogo = await abrirEdicao(user)

    await user.click(caixa(dialogo))
    const bloco = within(within(dialogo).getByRole('region', { name: BLOCO }))
    expect(bloco.getByText('Ao enviar, o dashboard fica inativo (em modificação) até a TI concluir a tarefa.')).toBeInTheDocument()
    expect(bloco.getByText('[PED] Modificar dashboard: PED Gerentes')).toBeInTheDocument()
    await colar(user, bloco.getByRole('textbox', { name: 'Observação para a TI (opcional)' }), 'Ajustar a régua de pontos.')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e enviar tarefa à TI' }))

    expect(await screen.findByText('Dashboard atualizado. A tarefa para a TI será criada no Bitrix em instantes.')).toBeInTheDocument()
    expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({ 'enviar tarefa ti': true, 'observacao para ti': 'Ajustar a régua de pontos.' })
    expect(chamadas.some((c) => c.caminho === `${ROTA}/previa-tarefa`)).toBe(false)
    const tabela = screen.getByRole('table', { name: 'Dashboards' })
    await waitFor(() =>
      expect(within(within(tabela).getByText('PED Gerentes').closest('tr')!).getByText('Em modificação (TI)')).toBeInTheDocument(),
    )
  })

  it('PUT com envio e tarefa já criada no Bitrix (status "enviada", "id bitrix" "328441"): "Dashboard atualizado. Tarefa #328441 criada no Bitrix para a equipe de TI."', async () => {
    const user = usuarioRapido()
    simularSessao({ perfil: 'admin', idTarefa: '328441' })
    const dialogo = await abrirEdicao(user)

    await user.click(caixa(dialogo))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e enviar tarefa à TI' }))

    const notificacao = await screen.findByText('Dashboard atualizado. Tarefa #328441 criada no Bitrix para a equipe de TI.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
  })

  it('PUT com envio sem "tarefa" na resposta: "Dashboard atualizado. A tarefa para a TI será criada no Bitrix em instantes."', async () => {
    const user = usuarioRapido()
    simularSessao({ perfil: 'admin', aoEditar: () => respostaJson(respostaGravacaoApi({ ...DASHBOARD_GERENTES_API, situacao: 'em_modificacao' }, null)) })
    const dialogo = await abrirEdicao(user)

    await user.click(caixa(dialogo))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e enviar tarefa à TI' }))

    expect(await screen.findByText('Dashboard atualizado. A tarefa para a TI será criada no Bitrix em instantes.')).toBeInTheDocument()
  })

  it('base gravada fora dos indicadores vinculados (dado antigo): o campo abre vazio, salvar exige escolher e o PUT leva o id escolhido', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({
      aoDetalhar: () => respostaJson({ ...detalheDashboardApi(DASHBOARD_GERENTES_API), 'indicador base da faixa': 1 }),
    })
    const dialogo = await abrirEdicao(user)
    const base = within(dialogo).getByRole('combobox', { name: 'Indicador base da faixa' })

    await waitFor(() =>
      expect(within(base).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
        'Selecione',
        'Faturamento líquido mensal',
        'Custo de frete por entrega',
      ]),
    )
    expect(base).toHaveValue('')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))
    expect(within(dialogo).getByText('Selecione o indicador base da faixa.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)

    await user.selectOptions(base, 'Custo de frete por entrega')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({ 'indicador base da faixa': 6, 'enviar tarefa ti': false })
  })

  it('erro no PUT: alerta com a mensagem da API dentro do diálogo, que continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao({ aoEditar: () => respostaErro(400, 'O indicador Capacitação está inativo e não pode ser incluído.') })
    const dialogo = await abrirEdicao(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O indicador Capacitação está inativo e não pode ser incluído.')
    expect(screen.getByRole('dialog', { name: 'Editar dashboard' })).toBeInTheDocument()
  })

  describe('vínculo pelos códigos de "vinculos" (resposta real: "itens vinculados" traz o rótulo "100 - Filial 100")', () => {
    /** Sessão com a listagem e o detalhe reais de 05/11/2026 (dashboard "teste", id 1, por filial 100). */
    function simularSessaoReal() {
      const acesso = acessoApi({ perfil: 'validador', 'todas as filiais': true, filiais: FILIAIS_API })
      const lista = RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API.map((d) => ({ ...d, 'itens vinculados': [...d['itens vinculados']] }))
      return simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acesso),
        [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
        [`GET ${ROTA}/1`]: () => respostaJson(respostaRealDetalheDashboardApi()),
        [`GET ${ROTA}/1/tarefas`]: () => respostaJson([]),
        'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
        'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
        'GET /api/ped/vinculos': rotaVinculos(),
        [`PUT ${ROTA}/1`]: () => respostaJson(respostaGravacaoApi(lista[0], null)),
      })
    }

    async function abrirEdicaoReal(user: Usuario) {
      renderizarApp('/dashboards')
      await screen.findByRole('table', { name: 'Dashboards' })
      await escolherAcao(user, rotuloAcoesDashboard('teste'), 'Editar')
      const dialogo = screen.getByRole('dialog', { name: 'Editar dashboard' })
      await waitFor(() => expect(within(dialogo).getByRole('textbox', { name: 'Nome do dashboard' })).toHaveValue('teste'))
      return dialogo
    }

    const filiaisEscolhidas = (dialogo: HTMLElement) =>
      within(within(dialogo).getByRole('list', { name: 'Filiais escolhidas' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

    it('a filial 100 aparece escolhida com o nome da lista de filiais ("100 - MATRIZ")', async () => {
      const user = usuarioRapido()
      simularSessaoReal()
      const dialogo = await abrirEdicaoReal(user)

      expect(within(dialogo).getByRole('button', { name: 'Tipo de vínculo do dashboard' })).toHaveTextContent('Filiais')
      await waitFor(() => expect(filiaisEscolhidas(dialogo)).toEqual([expect.stringMatching(/^100 - MATRIZ/)]))
      expect(within(dialogo).queryByText('Nenhuma filial selecionada.')).not.toBeInTheDocument()
    })

    it('"Salvar alterações" sem mudança: PUT com "itens vinculados": ["100"] e nenhum rótulo no corpo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessaoReal()
      const dialogo = await abrirEdicaoReal(user)
      await waitFor(() => expect(filiaisEscolhidas(dialogo)).toEqual([expect.stringMatching(/^100 - MATRIZ/)]))

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1`)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
        nome: 'teste',
        periodicidade: 'mensal',
        'pontuacao base maxima': 100,
        'tipo de vinculo': 'filiais',
        'itens vinculados': ['100'],
        indicadores: [
          { 'id indicador': 3, 'pontos base': 50 },
          { 'id indicador': 1, 'pontos base': 30 },
          { 'id indicador': 4, 'pontos base': 20 },
        ],
        'indicador base da faixa': 1,
        'formula de pontuacao': 'teste indicador',
        'observacao para ti': 'teste',
        'enviar tarefa ti': false,
      })
      expect(String(puts(chamadas)[0].init?.body)).not.toContain('Filial 100')
    })

    it('escolher outra filial: PUT com os dois códigos, sem duplicar e sem rótulo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessaoReal()
      const dialogo = await abrirEdicaoReal(user)
      await waitFor(() => expect(filiaisEscolhidas(dialogo)).toEqual([expect.stringMatching(/^100 - MATRIZ/)]))

      await user.click(within(dialogo).getByRole('button', { name: 'Selecionar filial' }))
      const lista = within(within(dialogo).getByRole('listbox', { name: 'Filiais vinculadas' }))
      expect(lista.getAllByRole('option').some((opcao) => (opcao.textContent ?? '').startsWith('100 - MATRIZ'))).toBe(false)
      await user.click(lista.getByRole('option', { name: (n) => n.startsWith('101 - CAMPO GRANDE') }))
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
      expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({ 'tipo de vinculo': 'filiais', 'itens vinculados': ['100', '101'] })
      expect(String(puts(chamadas)[0].init?.body)).not.toContain('Filial 100')
    })
  })

  it('erro ao consultar o detalhe: alerta com a mensagem dentro do diálogo e nenhum formulário', async () => {
    const user = usuarioRapido()
    simularSessao({ aoDetalhar: () => respostaErro(404, 'Dashboard não encontrado.') })
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })

    await escolherAcao(user, rotuloAcoesDashboard('PED Gerentes'), 'Editar')

    const dialogo = screen.getByRole('dialog', { name: 'Editar dashboard' })
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Dashboard não encontrado.')
    expect(within(dialogo).queryByRole('textbox', { name: 'Nome do dashboard' })).not.toBeInTheDocument()
  })
})
