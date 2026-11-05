import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  indicadoresApi,
  respostaIndicadorApi,
  rotaListarIndicadores,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_APONTAMENTOS = '/api/ped/apontamentos'
const ROTA_DADOS_EXTERNOS = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_COMPOSICAO = 'Informe apontamentos ou um dado externo, nunca os dois.'

describe('F6.4 — Cadastro de indicador (integração: /indicadores)', () => {
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
    aoCriar?: () => Response
    aoListarApontamentos?: () => Response
    aoListarDadosExternos?: () => Response
  }

  const CRIADO: IndicadorApiFalso = {
    ...INDICADOR_COBERTURA_VISITAS_API,
    id: 20,
    nome: 'Positivação da carteira',
    composicao: {
      tipo: 'apontamentos',
      itens: [
        { id: 1, nome: 'Roteiro de visitas elaborado', ativo: true },
        { id: 4, nome: 'Chamados resolvidos no prazo', ativo: true },
      ],
    },
    dashboards: [],
    'vinculado a dashboard': false,
  }

  function simularSessao(perfil: 'admin' | 'validador', opcoes: Opcoes = {}) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = indicadoresApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`GET ${ROTA_APONTAMENTOS}`]: opcoes.aoListarApontamentos ?? rotaListarApontamentos(apontamentosApi),
      [`GET ${ROTA_DADOS_EXTERNOS}`]: opcoes.aoListarDadosExternos ?? rotaListarDadosExternos(dadosExternosApi),
      [`POST ${ROTA}`]: () => {
        if (opcoes.aoCriar) return opcoes.aoCriar()
        lista = [...lista, CRIADO]
        return respostaJson(respostaIndicadorApi(CRIADO), 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsLista = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  const grupo = (dialogo: HTMLElement, nome: 'Apontamentos' | 'Dado externo') => within(dialogo).getByRole('group', { name: nome })

  /** Opção do dropdown cujo nome começa pelo rótulo (o nome inclui o subtexto). */
  const opcao = (lista: HTMLElement, rotulo: string) => within(lista).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    // Espera a carga dos apontamentos ativos: abre o dropdown, confirma a opção e fecha.
    const botao = await within(dialogo).findByRole('button', { name: 'Selecionar apontamento' })
    await user.click(botao)
    await within(dialogo).findByRole('option', { name: (nome) => nome.startsWith('Roteiro de visitas elaborado') })
    await user.click(botao)
    return dialogo
  }

  /** Abre o dropdown de apontamentos se estiver fechado e escolhe a opção (o painel fica aberto). */
  async function escolherApontamento(user: Usuario, dialogo: HTMLElement, rotulo: string) {
    const apontamentos = grupo(dialogo, 'Apontamentos')
    if (within(apontamentos).queryByRole('listbox') === null) {
      await user.click(within(apontamentos).getByRole('button', { name: 'Selecionar apontamento' }))
    }
    await user.click(opcao(within(apontamentos).getByRole('listbox', { name: 'Apontamentos' }), rotulo))
  }

  /** O dropdown de dado externo fecha ao escolher. */
  async function escolherDadoExterno(user: Usuario, dialogo: HTMLElement, rotulo: string) {
    const dadoExterno = grupo(dialogo, 'Dado externo')
    await user.click(within(dadoExterno).getByRole('button', { name: 'Selecionar dado externo' }))
    await user.click(opcao(within(dadoExterno).getByRole('listbox', { name: 'Dados externos' }), rotulo))
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, campo: string, rotulo: string) {
    const select = within(dialogo).getByRole('combobox', { name: campo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  async function preencherPorApontamentos(user: Usuario, dialogo: HTMLElement) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Positivação da carteira')
    await user.type(within(dialogo).getByRole('textbox', { name: 'Meta' }), '1.500,50')
    await escolher(user, dialogo, 'Sentido', 'Maior é melhor')
    await escolherApontamento(user, dialogo, 'Roteiro de visitas elaborado')
    await escolherApontamento(user, dialogo, 'Chamados resolvidos no prazo')
    await escolher(user, dialogo, 'Cálculo do realizado', 'Média')
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Meta editável no preenchimento' }))
  }

  it('"Novo indicador" abre o diálogo largo e carrega só os apontamentos e dados externos ativos (situacao=ativos)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirCadastro(user)

    expect(dialogo).toHaveClass('dialogo--largo')
    const getApontamentos = chamadas.find((c) => c.metodo === 'GET' && c.caminho === ROTA_APONTAMENTOS)!
    const getDados = chamadas.find((c) => c.metodo === 'GET' && c.caminho === ROTA_DADOS_EXTERNOS)!
    expect(getApontamentos.url.searchParams.get('situacao')).toBe('ativos')
    expect(getDados.url.searchParams.get('situacao')).toBe('ativos')

    await user.click(within(grupo(dialogo, 'Apontamentos')).getByRole('button', { name: 'Selecionar apontamento' }))
    const opcoesApontamentos = within(grupo(dialogo, 'Apontamentos')).getByRole('listbox', { name: 'Apontamentos' })
    expect(within(opcoesApontamentos).getAllByRole('option')).toHaveLength(3)
    expect(within(opcoesApontamentos).queryByRole('option', { name: /Conciliação bancária concluída/ })).not.toBeInTheDocument()
    await user.click(within(grupo(dialogo, 'Apontamentos')).getByRole('button', { name: 'Selecionar apontamento' }))

    await user.click(within(grupo(dialogo, 'Dado externo')).getByRole('button', { name: 'Selecionar dado externo' }))
    const opcoesDados = within(grupo(dialogo, 'Dado externo')).getByRole('listbox', { name: 'Dados externos' })
    expect(within(opcoesDados).getAllByRole('option')).toHaveLength(3)
    expect(within(opcoesDados).queryByRole('option', { name: /Cobertura de clientes/ })).not.toBeInTheDocument()
    expect(within(opcoesDados).queryByRole('option', { name: /Devoluções de venda/ })).not.toBeInTheDocument()
  })

  it('Cancelar fecha sem chamar o POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirCadastro(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('validação local impede o POST quando faltam campos obrigatórios ou a composição', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirCadastro(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(within(dialogo).getByText('Informe o nome.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Escolha ao menos um apontamento ou um dado externo.')).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it.each(['admin', 'validador'] as const)(
    '%s cadastra por apontamentos: POST com o corpo da API e o Bearer → diálogo fecha, "Indicador cadastrado." e a lista é recarregada com o novo indicador',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil)
      const dialogo = await abrirCadastro(user)
      const getsAntes = getsLista(chamadas).length
      await preencherPorApontamentos(user, dialogo)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      const notificacao = await screen.findByText('Indicador cadastrado.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(1)
      expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
        nome: 'Positivação da carteira',
        descricao: null,
        'origem da meta': 'manual',
        meta: 1500.5,
        sentido: 'maior_melhor',
        'meta editavel': true,
        calculo: 'media',
        apontamentos: [1, 4],
      })
      await waitFor(() => expect(getsLista(chamadas)).toHaveLength(getsAntes + 1))
      const tabela = screen.getByRole('table', { name: 'Indicadores' })
      await waitFor(() => expect(within(tabela).getByText('Positivação da carteira')).toBeInTheDocument())
    },
  )

  it('só os apontamentos escolhidos seguem no envio: escolhido e removido depois não entra no POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirCadastro(user)
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Positivação da carteira')
    await user.type(within(dialogo).getByRole('textbox', { name: 'Meta' }), '90')
    await escolher(user, dialogo, 'Sentido', 'Maior é melhor')
    await escolherApontamento(user, dialogo, 'Roteiro de visitas elaborado')
    await escolherApontamento(user, dialogo, 'Horas de treinamento realizadas')
    await escolherApontamento(user, dialogo, 'Chamados resolvidos no prazo')
    await user.click(within(dialogo).getByRole('button', { name: 'Remover Horas de treinamento realizadas' }))
    expect(within(dialogo).getByRole('list', { name: 'Apontamentos escolhidos' }).textContent).not.toMatch(/Horas de treinamento/)
    await escolher(user, dialogo, 'Cálculo do realizado', 'Soma')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Indicador cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ calculo: 'soma', apontamentos: [1, 4] })
  })

  it('cadastra por dado externo: escolhido no dropdown, o corpo leva "dado externo" e não tem calculo nem apontamentos', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirCadastro(user)
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Volume mensal')
    await user.type(within(dialogo).getByRole('textbox', { name: 'Meta' }), '250')
    await escolher(user, dialogo, 'Sentido', 'Menor é melhor (custo)')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Descrição' }), 'Volume de vendas do ERP.')
    await escolherDadoExterno(user, dialogo, 'Volume de vendas')
    expect(within(dialogo).queryByRole('combobox', { name: 'Cálculo do realizado' })).not.toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Indicador cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      nome: 'Volume mensal',
      descricao: 'Volume de vendas do ERP.',
      'origem da meta': 'manual',
      meta: 250,
      sentido: 'menor_melhor',
      'meta editavel': false,
      'dado externo': 6,
    })
  })

  it('POST 2xx só com { mensagem } também fecha o diálogo, notifica e recarrega a lista (2xx = gravado)', async () => {
    const user = usuarioRapido()
    let lista = indicadoresApi()
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`GET ${ROTA_APONTAMENTOS}`]: rotaListarApontamentos(apontamentosApi),
      [`GET ${ROTA_DADOS_EXTERNOS}`]: rotaListarDadosExternos(dadosExternosApi),
      [`POST ${ROTA}`]: () => {
        lista = [...lista, CRIADO]
        return respostaJson({ mensagem: 'indicador cadastrado' }, 201)
      },
    })
    const dialogo = await abrirCadastro(user)
    await preencherPorApontamentos(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Indicador cadastrado.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Indicadores' })).getByText('Positivação da carteira')).toBeInTheDocument())
  })

  it('400 da API aparece no formulário com a mensagem, sem fechar nem perder os dados', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { aoCriar: () => respostaErro(400, MENSAGEM_COMPOSICAO) })
    const dialogo = await abrirCadastro(user)
    await preencherPorApontamentos(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_COMPOSICAO)
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveValue('Positivação da carteira')
    expect(within(dialogo).getByRole('list', { name: 'Apontamentos escolhidos' })).toHaveTextContent('Roteiro de visitas elaborado')
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeEnabled()
    expect(screen.queryByText('Indicador cadastrado.')).not.toBeInTheDocument()
  })

  it('falha de rede no POST mostra "Não foi possível conectar ao servidor." no formulário', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      aoCriar: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const dialogo = await abrirCadastro(user)
    await preencherPorApontamentos(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
  })

  it('erro ao carregar os apontamentos ou dados externos aparece no diálogo e Salvar não envia sem composição', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', { aoListarApontamentos: () => respostaErro(500, 'Falha ao consultar os apontamentos.') })
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falha ao consultar os apontamentos.')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('401 no POST encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { aoCriar: () => respostaErro(401) })
    const dialogo = await abrirCadastro(user)
    await preencherPorApontamentos(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    await waitFor(() => expect(obterToken()).toBeNull())
  })
})
