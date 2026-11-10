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
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import {
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_TICKET_MEDIO_API,
  indicadoresApi,
  indicadoresComMetasPorFilialApi,
  respostaIndicadorApi,
  rotaListarIndicadoresComMetas,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

/**
 * F6.10 — Meta por filial (integração: /indicadores com a aplicação completa; só a rede é simulada).
 *
 * Contrato proposto (o back-end implementa depois; ver `src/test/indicadoresFalsos.ts`):
 * - POST `/api/ped/indicadores-cadastro` e PUT `.../{id}/meta`: "Replicar a meta para todas as filiais"
 *   marcado (visão "Todas as filiais") → `"meta"` como hoje; desmarcado → `"metas por filial"` só com as
 *   filiais preenchidas, sem `"meta"`; visão de uma filial → `"metas por filial"` só com ela, sem `"meta"`.
 * - GET da listagem: `"metas por filial"`, `"filiais sem meta"` e `alertas["meta pendente por filial"]`.
 *
 * Filiais do acesso: 100 MATRIZ, 101 CAMPO GRANDE, 102 DOURADOS.
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_APONTAMENTOS = '/api/ped/apontamentos'
const ROTA_DADOS_EXTERNOS = '/api/ped/dados-externos-cadastro'
const REPLICAR = 'Replicar a meta para todas as filiais'

describe('F6.10 — Meta por filial (integração: /indicadores)', () => {
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
    /** Acesso a uma única filial (101), sem "Todas as filiais" (validador). */
    filialUnica?: boolean
    lista?: IndicadorApiFalso[]
    aoCriar?: () => Response
    aoDefinir?: () => Response
  }

  const CRIADO: IndicadorApiFalso = { ...INDICADOR_TICKET_MEDIO_API, id: 30, nome: 'Positivação por filial' }

  function simularSessao(opcoes: Opcoes = {}) {
    const acesso = opcoes.filialUnica
      ? acessoApi({ perfil: 'validador', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
      : acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = opcoes.lista ?? indicadoresApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetas(() => lista),
      [`GET ${ROTA_APONTAMENTOS}`]: rotaListarApontamentos(apontamentosApi),
      [`GET ${ROTA_DADOS_EXTERNOS}`]: rotaListarDadosExternos(dadosExternosApi),
      [`POST ${ROTA}`]: () => {
        if (opcoes.aoCriar) return opcoes.aoCriar()
        lista = [...lista, CRIADO]
        return respostaJson(respostaIndicadorApi(CRIADO), 201)
      },
      [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: () => {
        if (opcoes.aoDefinir) return opcoes.aoDefinir()
        return respostaJson(respostaIndicadorApi({ ...INDICADOR_DEVOLUCOES_API, sentido: 'maior_melhor', 'meta a definir': false }))
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const metaDaFilial = (dialogo: HTMLElement, rotulo: string) => within(dialogo).getByRole('textbox', { name: `Meta da filial ${rotulo}` })

  async function abrirTela() {
    renderizarApp('/indicadores')
    return screen.findByRole('table', { name: 'Indicadores' })
  }

  async function selecionarFilialNoCabecalho(user: Usuario, rotulo: string) {
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    await user.selectOptions(seletor, within(seletor).getByRole('option', { name: rotulo }))
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    // Espera a carga dos componentes: o botão do dado externo só lista opções depois dela.
    const grupoDado = within(dialogo).getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupoDado).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupoDado).getByRole('listbox', { name: 'Dados externos' })
    await user.click(await within(lista).findByRole('option', { name: (nome) => nome.startsWith('Faturamento líquido') }))
    return dialogo
  }

  async function preencherComuns(user: Usuario, dialogo: HTMLElement) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Positivação por filial')
    const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
  }

  async function abrirDefinirMeta(user: Usuario) {
    await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
    return screen.getByRole('dialog', { name: 'Definir meta' })
  }

  describe('cadastro de indicador', () => {
    it('visão "Todas as filiais": "Replicar a meta para todas as filiais" nasce marcado e o POST leva "meta" sem "metas por filial"', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      const dialogo = await abrirCadastro(user)

      expect(within(dialogo).getByRole('checkbox', { name: REPLICAR })).toBeChecked()
      await preencherComuns(user, dialogo)
      await user.type(within(dialogo).getByRole('textbox', { name: 'Meta' }), '1.500,50')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Indicador cadastrado.')
      const corpo = corpoDaChamada(posts(chamadas)[0])
      expect(corpo).toMatchObject({ meta: 1500.5, 'dado externo': 1 })
      expect(corpo).not.toHaveProperty('metas por filial')
    })

    it('desmarcado, mostra as filiais do usuário e o POST leva "metas por filial" só com as preenchidas, sem "meta"; a lista recarrega com a pendência', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)

      await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
      expect(within(dialogo).queryByRole('textbox', { name: 'Meta' })).not.toBeInTheDocument()
      const grupo = within(dialogo).getByRole('group', { name: 'Metas por filial' })
      expect(within(grupo).getAllByRole('textbox')).toHaveLength(3)
      await user.type(metaDaFilial(dialogo, '100 - MATRIZ'), '1.500,50')
      await user.type(metaDaFilial(dialogo, '102 - DOURADOS'), '900')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Indicador cadastrado.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(1)
      const corpo = corpoDaChamada(posts(chamadas)[0])
      expect(corpo).toEqual({
        nome: 'Positivação por filial',
        descricao: null,
        'origem da meta': 'manual',
        'metas por filial': [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
      expect(corpo).not.toHaveProperty('meta')

      const tabela = screen.getByRole('table', { name: 'Indicadores' })
      const linhaCriado = (await within(tabela).findByText('Positivação por filial')).closest('tr')!
      expect(within(linhaCriado).getByText('Meta pendente em 2 filiais')).toBeInTheDocument()
    })

    it('desmarcado e sem nenhuma filial preenchida, mostra "Informe a meta de ao menos uma filial." e não chama o POST', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)
      await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      expect(within(dialogo).getByText('Informe a meta de ao menos uma filial.')).toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
    })

    it('com a filial 101 escolhida no cabeçalho: sem checkbox, campo "Meta da filial 101 - CAMPO GRANDE" e POST só com ela, sem "meta"', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      await selecionarFilialNoCabecalho(user, '101 - CAMPO GRANDE')
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)

      expect(within(dialogo).queryByRole('checkbox', { name: REPLICAR })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('textbox', { name: 'Meta' })).not.toBeInTheDocument()
      await user.type(metaDaFilial(dialogo, '101 - CAMPO GRANDE'), '250')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Indicador cadastrado.')
      const corpo = corpoDaChamada(posts(chamadas)[0])
      expect(corpo).toMatchObject({ 'metas por filial': [{ filial: '101', meta: 250 }] })
      expect(corpo).not.toHaveProperty('meta')
    })

    it('usuário com uma única filial (sem "Todas as filiais") cadastra a meta só para a própria filial', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao({ filialUnica: true })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)

      expect(within(dialogo).queryByRole('checkbox', { name: REPLICAR })).not.toBeInTheDocument()
      await user.type(metaDaFilial(dialogo, '101 - CAMPO GRANDE'), '75,5')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Indicador cadastrado.')
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ 'metas por filial': [{ filial: '101', meta: 75.5 }] })
    })

    it('erro da API no POST com metas por filial aparece no diálogo e mantém os valores digitados', async () => {
      const user = usuarioRapido()
      simularSessao({ aoCriar: () => respostaErro(400, 'Filial 102 não encontrada.') })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)
      await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
      await user.type(metaDaFilial(dialogo, '102 - DOURADOS'), '900')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Filial 102 não encontrada.')
      expect(within(dialogo).getByRole('checkbox', { name: REPLICAR })).not.toBeChecked()
      expect(metaDaFilial(dialogo, '102 - DOURADOS')).toHaveValue('900')
    })
  })

  describe('definir meta do indicador criado automaticamente', () => {
    it('visão "Todas as filiais", desmarcado: PUT .../meta com "metas por filial" das preenchidas, sem "meta" → "Meta definida."', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      const dialogo = await abrirDefinirMeta(user)

      expect(within(dialogo).getByRole('checkbox', { name: REPLICAR })).toBeChecked()
      await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
      await user.type(metaDaFilial(dialogo, '101 - CAMPO GRANDE'), '2.000,25')
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      await screen.findByText('Meta definida.')
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/4/meta`)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
        sentido: 'maior_melhor',
        'meta editavel': false,
        'metas por filial': [{ filial: '101', meta: 2000.25 }],
      })
    })

    it('com a filial 102 no cabeçalho: campo "Meta da filial 102 - DOURADOS" e PUT só com ela', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      await abrirTela()
      await selecionarFilialNoCabecalho(user, '102 - DOURADOS')
      const dialogo = await abrirDefinirMeta(user)

      expect(within(dialogo).queryByRole('checkbox', { name: REPLICAR })).not.toBeInTheDocument()
      await user.type(metaDaFilial(dialogo, '102 - DOURADOS'), '1800')
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Menor é melhor (custo)' }))
      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      await screen.findByText('Meta definida.')
      const corpo = corpoDaChamada(puts(chamadas)[0])
      expect(corpo).toEqual({ sentido: 'menor_melhor', 'meta editavel': false, 'metas por filial': [{ filial: '102', meta: 1800 }] })
    })

    it('erro da API no PUT aparece no diálogo e mantém a lista com os valores digitados', async () => {
      const user = usuarioRapido()
      simularSessao({ aoDefinir: () => respostaErro(400, 'A meta deste indicador já foi definida.') })
      await abrirTela()
      const dialogo = await abrirDefinirMeta(user)
      await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
      await user.type(metaDaFilial(dialogo, '100 - MATRIZ'), '10')
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))

      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A meta deste indicador já foi definida.')
      expect(metaDaFilial(dialogo, '100 - MATRIZ')).toHaveValue('10')
    })
  })

  describe('listagem e sinal da aba', () => {
    it('indicador com filiais sem meta: etiqueta "Meta pendente em 2 filiais", filiais nos detalhes e a aba Indicadores marcada "Com alertas"', async () => {
      const user = usuarioRapido()
      // Sem os outros alertas: só a pendência por filial deve marcar a aba.
      simularSessao({ lista: indicadoresComMetasPorFilialApi().filter((i) => i.id === 1 || i.id === 8 || i.id === 9) })
      const tabela = await abrirTela()

      const linhaTicket = within(tabela).getByText('Ticket médio por filial').closest('tr')!
      expect(within(linhaTicket).getByText('Meta pendente em 2 filiais')).toBeInTheDocument()

      await escolherAcao(user, rotuloAcoesIndicador('Ticket médio por filial'), 'Ver detalhes')
      const detalhes = linhaTicket.nextElementSibling as HTMLElement
      const termo = within(detalhes).getByText('Filiais sem meta', { selector: 'dt' })
      expect(termo.nextElementSibling).toHaveTextContent('101 - CAMPO GRANDE, 102 - DOURADOS')

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      const linkIndicadores = within(abas).getByRole('link', { name: /^Indicadores/ })
      await waitFor(() => expect(within(linkIndicadores).getByRole('img', { name: 'Com alertas' })).toBeInTheDocument())
    })

    it('ao trocar a filial do cabeçalho, a coluna Meta passa a mostrar a meta daquela filial', async () => {
      const user = usuarioRapido()
      simularSessao({ lista: indicadoresComMetasPorFilialApi() })
      const tabela = await abrirTela()
      const celulaMeta = () => within(within(tabela).getByText('Ticket médio por filial').closest('tr')!).getAllByRole('cell')[3]

      expect(celulaMeta()).toHaveTextContent('Por filial')

      await selecionarFilialNoCabecalho(user, '100 - MATRIZ')
      expect(celulaMeta()).toHaveTextContent('1.500,50')

      await selecionarFilialNoCabecalho(user, '101 - CAMPO GRANDE')
      expect(celulaMeta()).toHaveTextContent('Sem meta nesta filial')
    })
  })
})
