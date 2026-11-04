import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, rotuloAcoesApontamento } from '../../test/menuAcoes'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  filtrarApontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA_LISTA = 'GET /api/ped/apontamentos'
/** Espera da busca (decisão do usuário em 04/11/2026): a consulta sai 500 ms após a última tecla. */
const ATRASO_BUSCA_MS = 500

describe('F4.3 — Filtros da listagem de apontamentos (ApontamentosPage)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Usuário com o relógio falso (a digitação avança os timers falsos). */
  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  /** Avança o relógio falso (padrão: o tempo da espera da busca) e deixa as promessas resolverem. */
  async function avancar(ms = ATRASO_BUSCA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simularListaFiltrada(lista: ApontamentoApiFalso[] = apontamentosApi()) {
    return simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarApontamentos(() => lista) })
  }

  function gets(chamadas: ChamadaRegistrada[]) {
    return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
  }

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  function renderizar() {
    return render(
      <ProvedorSessaoFalso
        sessao={{ acesso: acessoFalso({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS }) }}
      >
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(lista?: ApontamentoApiFalso[]) {
    const chamadas = simularListaFiltrada(lista)
    renderizar()
    await screen.findByRole('table', { name: 'Apontamentos' })
    return chamadas
  }

  function linhasDeDados() {
    return within(screen.getByRole('table', { name: 'Apontamentos' }))
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
  }

  function nomesListados() {
    return linhasDeDados().map((linha) => {
      const celulaNome = within(linha).getAllByRole('cell')[0]
      return NOMES_APONTAMENTOS.find((nome) => within(celulaNome).queryByText(nome) !== null) ?? celulaNome.textContent
    })
  }

  function busca() {
    return screen.getByRole('searchbox', { name: 'Buscar' })
  }

  function opcaoSituacao(rotulo: string) {
    const lista = screen.getByRole('listbox', { name: 'Situação' })
    const opcao = within(lista)
      .getAllByRole('option')
      .find((item) => within(item).queryByText(rotulo) !== null)
    if (!opcao) throw new Error(`Opção de situação "${rotulo}" não encontrada`)
    return opcao
  }

  function chipsTipo() {
    return within(screen.getByRole('group', { name: 'Tipo' })).getAllByRole('button')
  }

  function chipTipo(nome: string) {
    const chip = chipsTipo().find((botao) => within(botao).queryByText(nome) !== null)
    if (!chip) throw new Error(`Chip de tipo "${nome}" não encontrado`)
    return chip
  }

  describe('barra de filtros', () => {
    it('tem o campo "Buscar" com o placeholder "Nome, tipo, descrição ou tipo de valor"', async () => {
      await abrirTela()

      expect(busca()).toHaveAttribute('placeholder', 'Nome, tipo, descrição ou tipo de valor')
      expect(busca()).toHaveValue('')
    })

    it('oferece as situações Todas, Ativos, Inativos e Com problemas, sem contagem, com Todas selecionada', async () => {
      await abrirTela()

      const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Todas', 'Ativos', 'Inativos', 'Com problemas'])
      expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
      for (const opcao of opcoes) expect(within(opcao).queryByText(/^\d+$/)).not.toBeInTheDocument()
    })

    it('oferece um botão por tipo da contagem devolvida pela API, com a quantidade, nenhum ativo', async () => {
      await abrirTela()

      const chips = chipsTipo()
      expect(chips).toHaveLength(4)
      expect(within(chipTipo('Comercial')).getByText('2')).toBeInTheDocument()
      expect(within(chipTipo('Financeiro')).getByText('1')).toBeInTheDocument()
      expect(within(chipTipo('Recursos Humanos')).getByText('1')).toBeInTheDocument()
      expect(within(chipTipo('Tecnologia da Informação')).getByText('1')).toBeInTheDocument()
      for (const chip of chips) expect(chip).toHaveAttribute('aria-pressed', 'false')
    })

    it('não exibe "Limpar filtros" enquanto nenhum filtro está ativo', async () => {
      await abrirTela()

      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })
  })

  describe('busca (RNF-09, pela API)', () => {
    it('digitar na busca refaz o GET com busca=<texto> após a espera de 500 ms e a tabela passa a mostrar a resposta', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'visitas')
      await avancar()

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('visitas'))
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))
      expect(busca()).toHaveValue('visitas')
    })

    it('a busca ignora acentos e maiúsculas (resolvido pela API; o texto vai como digitado)', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'CONCILIACAO')
      await avancar()

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('CONCILIACAO'))
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída']))
    })

    it('busca por tipo e por tipo de valor também passam pela API e filtram a tabela', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.type(busca(), 'booleano')
      await avancar()
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída', 'Relatório mensal entregue']))

      await user.clear(busca())
      await user.type(busca(), 'tecnologia')
      await avancar()
      await waitFor(() => expect(nomesListados()).toEqual(['Chamados resolvidos no prazo']))
    })

    it('a barra de filtros permanece visível, com o texto digitado, enquanto a consulta filtrada está em andamento', async () => {
      const user = configurarUsuario()
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [ROTA_LISTA]: (_init, url) => {
          if (url.searchParams.has('busca')) {
            return new Promise<Response>((resolve) => {
              liberar = () => resolve(respostaJson(filtrarApontamentosApi(apontamentosApi(), url)))
            })
          }
          return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      await user.type(busca(), 'x')
      await avancar()

      expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('x')
      expect(screen.getByRole('listbox', { name: 'Situação' })).toBeInTheDocument()

      liberar()
      await waitFor(() => expect(screen.getByText('Nenhum apontamento encontrado para os filtros.')).toBeInTheDocument())
    })

    it('limpar o texto da busca refaz o GET sem busca e volta a mostrar todos', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'visitas')
      await avancar()
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))

      await user.clear(busca())
      await avancar()

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.has('busca')).toBe(false))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(5))
    })

    it('busca sem correspondência mostra "Nenhum apontamento encontrado para os filtros." (e não "Nenhum apontamento cadastrado.")', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.type(busca(), 'xyz-inexistente')
      await avancar()

      const tabela = screen.getByRole('table', { name: 'Apontamentos' })
      await waitFor(() => expect(within(tabela).getByText('Nenhum apontamento encontrado para os filtros.')).toBeInTheDocument())
      expect(within(tabela).queryByText('Nenhum apontamento cadastrado.')).not.toBeInTheDocument()
    })

    it('proteção de corrida: a resposta atrasada de um texto antigo não sobrescreve a do texto atual', async () => {
      const user = configurarUsuario()
      let liberarAntiga: () => void = () => {}
      simularApi(fetchFalso, {
        [ROTA_LISTA]: (_init, url) => {
          if (url.searchParams.get('busca') === 'v') {
            return new Promise<Response>((resolve) => {
              liberarAntiga = () => resolve(respostaJson(filtrarApontamentosApi(apontamentosApi(), url)))
            })
          }
          return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      // "v" fica esperando a resposta; "visitas" é consultado depois e responde primeiro.
      await user.type(busca(), 'v')
      await avancar()
      await user.type(busca(), 'isitas')
      await avancar()
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))

      liberarAntiga()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(nomesListados()).toEqual(['Roteiro de visitas elaborado'])
    })
  })

  describe('situação', () => {
    it('selecionar "Inativos" refaz o GET com situacao=inativos e mostra só os inativos', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(opcaoSituacao('Inativos'))

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos'))
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída', 'Relatório mensal entregue']))
      expect(opcaoSituacao('Inativos')).toHaveAttribute('aria-selected', 'true')
      expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'false')
    })

    it('"Ativos" envia situacao=ativos e "Com problemas" envia situacao=problemas', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(opcaoSituacao('Ativos'))
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos'))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(3))

      await user.click(opcaoSituacao('Com problemas'))
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída']))
    })

    it('voltar para "Todas" mostra a lista completa de novo', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.click(opcaoSituacao('Inativos'))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(2))

      await user.click(opcaoSituacao('Todas'))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(5))
    })

    it('as contagens dos tipos acompanham a situação (vêm da resposta): em Inativos só Comercial 1 e Financeiro 1', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.click(opcaoSituacao('Inativos'))

      await waitFor(() => expect(chipsTipo()).toHaveLength(2))
      expect(within(chipTipo('Comercial')).getByText('1')).toBeInTheDocument()
      expect(within(chipTipo('Financeiro')).getByText('1')).toBeInTheDocument()
      expect(chipsTipo().find((chip) => within(chip).queryByText('Recursos Humanos') !== null)).toBeUndefined()
    })
  })

  describe('botões por tipo', () => {
    it('clicar em um tipo refaz o GET com tipo=<id>, marca o botão e mostra só os apontamentos do tipo', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(chipTipo('Comercial'))

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('1'))
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado', 'Relatório mensal entregue']))
      expect(chipTipo('Comercial')).toHaveAttribute('aria-pressed', 'true')
      expect(chipTipo('Financeiro')).toHaveAttribute('aria-pressed', 'false')
    })

    it('as contagens não mudam com o filtro de tipo (a API não o considera na contagem)', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.click(chipTipo('Tecnologia da Informação'))
      await waitFor(() => expect(nomesListados()).toEqual(['Chamados resolvidos no prazo']))

      expect(chipsTipo()).toHaveLength(4)
      expect(within(chipTipo('Comercial')).getByText('2')).toBeInTheDocument()
      expect(within(chipTipo('Tecnologia da Informação')).getByText('1')).toBeInTheDocument()
    })

    it('clicar no tipo ativo desmarca, refaz o GET sem tipo e volta à lista completa', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(chipTipo('Comercial'))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(2))

      await user.click(chipTipo('Comercial'))

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(5))
      expect(chipTipo('Comercial')).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicar em outro tipo troca o filtro (um único tipo ativo por vez)', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(chipTipo('Comercial'))
      await waitFor(() => expect(linhasDeDados()).toHaveLength(2))
      await user.click(chipTipo('Financeiro'))

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('2'))
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída']))
      expect(chipTipo('Financeiro')).toHaveAttribute('aria-pressed', 'true')
      expect(chipTipo('Comercial')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('combinação e limpeza', () => {
    it('busca, situação e tipo combinam na mesma consulta', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.click(opcaoSituacao('Ativos'))
      await user.click(chipTipo('Comercial'))
      await user.type(busca(), 'roteiro')
      await avancar()

      await waitFor(() => {
        const parametros = ultimoGet(chamadas).url.searchParams
        expect(parametros.get('busca')).toBe('roteiro')
        expect(parametros.get('situacao')).toBe('ativos')
        expect(parametros.get('tipo')).toBe('1')
      })
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))
    })

    it('"Limpar filtros" aparece com qualquer filtro ativo e, ao clicar, zera busca, situação e tipo e refaz o GET sem parâmetros de busca/tipo', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'roteiro')
      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
      await user.click(opcaoSituacao('Ativos'))
      await user.click(chipTipo('Comercial'))
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

      await waitFor(() => {
        const parametros = ultimoGet(chamadas).url.searchParams
        expect(parametros.has('busca')).toBe(false)
        expect(parametros.has('tipo')).toBe(false)
      })
      await waitFor(() => expect(linhasDeDados()).toHaveLength(5))
      expect(busca()).toHaveValue('')
      expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
      for (const chip of chipsTipo()) expect(chip).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('"Limpar filtros" aparece também só com a situação ou só com um tipo ativo', async () => {
      const user = configurarUsuario()
      await abrirTela()

      await user.click(opcaoSituacao('Inativos'))
      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
      await user.click(opcaoSituacao('Todas'))
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument())

      await user.click(chipTipo('Comercial'))
      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    })
  })

  describe('erro na consulta filtrada', () => {
    it('erro da API ao filtrar mostra a mensagem em um alerta com "Tentar novamente", que repete a consulta com os mesmos filtros', async () => {
      const user = configurarUsuario()
      let falhar = true
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: (_init, url) => {
          if (url.searchParams.get('situacao') === 'inativos' && falhar) {
            falhar = false
            return respostaErro(500, 'Falha ao filtrar.')
          }
          return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      await user.click(opcaoSituacao('Inativos'))

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao filtrar.')
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos')
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída', 'Relatório mensal entregue']))
    })
  })
  describe('espera da busca (debounce de 500 ms, decisão de 04/11/2026)', () => {
    const getsComBusca = (chamadas: ChamadaRegistrada[]) => gets(chamadas).filter((c) => c.url.searchParams.has('busca'))

    it('o campo mostra o texto na hora, mas nenhum GET sai antes de 500 ms após a última tecla', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'abc')

      expect(busca()).toHaveValue('abc')
      expect(gets(chamadas)).toHaveLength(1)
      await avancar(ATRASO_BUSCA_MS - 200)
      expect(gets(chamadas)).toHaveLength(1)
    })

    it('digitar "abc" rapidamente gera um único GET, com busca=abc, depois da espera', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'abc')
      await avancar()
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      await avancar(ATRASO_BUSCA_MS * 2)

      expect(gets(chamadas)).toHaveLength(2)
      expect(getsComBusca(chamadas).map((c) => c.url.searchParams.get('busca'))).toEqual(['abc'])
    })

    it('trocar a situação durante a espera consulta na hora, com a busca já digitada, sem um GET extra da busca depois', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'roteiro')
      await user.click(opcaoSituacao('Ativos'))

      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('roteiro')
      expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos')
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))

      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas)).toHaveLength(2)
    })

    it('clicar em um tipo durante a espera consulta na hora com a busca já digitada', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'relatorio')
      await user.click(chipTipo('Comercial'))

      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('relatorio')
      expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('1')
      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas)).toHaveLength(2)
    })

    it('"Limpar filtros" durante a espera cancela o GET pendente da busca e esvazia o campo', async () => {
      const user = configurarUsuario()
      const chamadas = await abrirTela()

      await user.type(busca(), 'roteiro')
      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
      await avancar(ATRASO_BUSCA_MS * 2)

      expect(busca()).toHaveValue('')
      expect(getsComBusca(chamadas)).toHaveLength(0)
      expect(linhasDeDados()).toHaveLength(5)
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })
  })

  describe('tipo selecionado que some da contagem', () => {
    it('excluir o único apontamento do tipo selecionado remove o botão do tipo, desmarca o filtro e volta a listar os demais', async () => {
      const user = configurarUsuario()
      let lista = apontamentosApi()
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: rotaListarApontamentos(() => lista),
        'DELETE /api/ped/apontamentos/4': () => {
          lista = lista.filter((a) => a.id !== 4)
          return new Response(null, { status: 204 })
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      await user.click(chipTipo('Tecnologia da Informação'))
      await waitFor(() => expect(nomesListados()).toEqual(['Chamados resolvidos no prazo']))

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Excluir')
      await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento' })).getByRole('button', { name: 'Excluir' }))
      await screen.findByText('Apontamento excluído.')

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false))
      await waitFor(() =>
        expect(nomesListados()).toEqual([
          'Roteiro de visitas elaborado',
          'Conciliação bancária concluída',
          'Horas de treinamento realizadas',
          'Relatório mensal entregue',
        ]),
      )
      expect(chipsTipo().find((chip) => within(chip).queryByText('Tecnologia da Informação') !== null)).toBeUndefined()
      for (const chip of chipsTipo()) expect(chip).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })
  })
})
