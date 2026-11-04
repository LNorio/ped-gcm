import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { NOMES_TIPOS_FIXOS, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import type { Perfil } from '../../types/dominio'
import { TiposPage } from './TiposPage'

const ROTA_LISTA = 'GET /api/ped/tipos-apontamento'

describe('F3.2 — Listagem de tipos de apontamento (TiposPage)', () => {
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

  function simularLista(tipos: TipoApontamentoApiFalso[] = tiposApi()) {
    return simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(tipos) })
  }

  function renderizar(perfil: Perfil = 'admin') {
    return render(
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso({ perfil, todasAsFiliais: true, filiais: FILIAIS }) }}>
        <TiposPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function aguardarTabela() {
    return await screen.findByRole('table', { name: 'Tipos de apontamento' })
  }

  /** Linhas do corpo da tabela (sem a linha de cabeçalho). */
  function linhasDeDados(tabela: HTMLElement) {
    return within(tabela).getAllByRole('row').slice(1)
  }

  /** Nomes exibidos na primeira coluna, na ordem da tabela. */
  function nomesListados(tabela: HTMLElement) {
    return linhasDeDados(tabela).map((linha) => within(linha).getAllByRole('cell')[0].textContent)
  }

  function linhaDoTipo(nome: string): HTMLElement {
    const linha = screen.getByRole('cell', { name: nome }).closest('tr')
    if (!linha) throw new Error(`Linha do tipo "${nome}" não encontrada`)
    return linha
  }

  describe('estrutura da tela', () => {
    it('exibe o título "Tipos" e o aviso de que os sete tipos fixos não podem ser excluídos', async () => {
      simularLista()
      renderizar()

      expect(screen.getByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
      const aviso = screen.getByRole('note')
      expect(aviso).toHaveClass('aviso--info')
      expect(aviso).toHaveTextContent(/sete tipos fixos/i)
      expect(aviso).toHaveTextContent(/não podem ser excluídos/)
      for (const nome of NOMES_TIPOS_FIXOS) expect(aviso).toHaveTextContent(nome)

      await aguardarTabela()
    })

    it('anuncia "Carregando tipos..." em uma região de status enquanto a lista não chega e remove ao concluir', async () => {
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(tiposApi()))
          }),
      })
      renderizar()

      const carregando = screen.getByText('Carregando tipos...')
      expect(carregando.closest('[role="status"]')).not.toBeNull()

      liberar()
      await aguardarTabela()
      expect(screen.queryByText('Carregando tipos...')).not.toBeInTheDocument()
    })

    it('chama GET /api/ped/tipos-apontamento uma única vez ao abrir', async () => {
      const chamadas = simularLista()
      renderizar()

      await aguardarTabela()

      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')).toHaveLength(1)
    })

    it('a barra de filtros e a tabela ficam em um Card com o corpo sem padding (card__corpo--sem-padding)', async () => {
      simularLista()
      renderizar()

      const tabela = await aguardarTabela()

      const corpo = tabela.closest('.card__corpo')
      expect(corpo).not.toBeNull()
      expect(corpo).toHaveClass('card__corpo--sem-padding')
      expect(screen.getByRole('searchbox', { name: /Buscar/ }).closest('.card__corpo')).toBe(corpo)
    })
  })

  describe('tabela', () => {
    it('lista os tipos na tabela "Tipos de apontamento" com as colunas Nome, Origem, Apontamentos e Ações', async () => {
      simularLista()
      renderizar()

      const tabela = await aguardarTabela()

      expect(within(tabela).getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual([
        'Nome',
        'Origem',
        'Apontamentos',
        'Ações',
      ])
      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(nomesListados(tabela)).toEqual([...NOMES_TIPOS_FIXOS, 'Logística', 'Marketing'])
    })

    it('não exibe coluna de grupos vinculados nesta fase (fica para a F3.4)', async () => {
      simularLista()
      renderizar()

      const tabela = await aguardarTabela()

      expect(within(tabela).queryByRole('columnheader', { name: /grupos/i })).not.toBeInTheDocument()
    })

    it('mostra a origem como etiqueta: Fixo em tom neutro e Personalizado em tom de informação', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      const etiquetaFixo = within(linhaDoTipo('Comercial')).getByText('Fixo')
      expect(etiquetaFixo).toHaveClass('etiqueta', 'etiqueta--neutro')

      const etiquetaPersonalizado = within(linhaDoTipo('Logística')).getByText('Personalizado')
      expect(etiquetaPersonalizado).toHaveClass('etiqueta', 'etiqueta--info')
    })

    it('mostra a quantidade de apontamentos de cada tipo, inclusive zero', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      expect(within(linhaDoTipo('Comercial')).getAllByRole('cell')[2]).toHaveTextContent(/^7$/)
      expect(within(linhaDoTipo('Recursos Humanos')).getAllByRole('cell')[2]).toHaveTextContent(/^0$/)
      expect(within(linhaDoTipo('Marketing')).getAllByRole('cell')[2]).toHaveTextContent(/^3$/)
    })

    it('oferece "Excluir tipo {nome}" apenas nos tipos personalizados; os sete fixos não têm botão', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      const botoes = screen.getAllByRole('button', { name: /^Excluir tipo / })
      expect(botoes.map((botao) => botao.getAttribute('aria-label'))).toEqual([
        'Excluir tipo Logística',
        'Excluir tipo Marketing',
      ])
      for (const nome of NOMES_TIPOS_FIXOS) {
        expect(within(linhaDoTipo(nome)).queryByRole('button')).not.toBeInTheDocument()
      }
    })

    it('na célula Ações dos fixos, o "—" fica escondido de leitores de tela e o texto "Sem ações" existe só para eles', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      for (const nome of NOMES_TIPOS_FIXOS) {
        const celula = within(linhaDoTipo(nome)).getAllByRole('cell')[3]
        expect(within(celula).getByText('—')).toHaveAttribute('aria-hidden', 'true')
        expect(within(celula).getByText('Sem ações')).toHaveClass('visualmente-oculto')
      }
      expect(within(linhaDoTipo('Logística')).queryByText('Sem ações')).not.toBeInTheDocument()
    })

    it('mostra "Nenhum tipo cadastrado." quando a API devolve lista vazia', async () => {
      simularLista([])
      renderizar()

      const tabela = await aguardarTabela()

      expect(within(tabela).getByText('Nenhum tipo cadastrado.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Excluir tipo / })).not.toBeInTheDocument()
    })
  })

  describe('erro de carga', () => {
    it('mostra a mensagem da API em um alerta com o botão "Tentar novamente"', async () => {
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os tipos.'),
      })
      renderizar()

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Falha ao consultar os tipos.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(screen.queryByText('Carregando tipos...')).not.toBeInTheDocument()
    })

    it('"Tentar novamente" chama a API de novo e, com sucesso, mostra a tabela e remove o alerta', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: () => {
          tentativa += 1
          return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : respostaJson(tiposApi())
        },
      })
      renderizar()
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      const tabela = await aguardarTabela()
      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(chamadas.filter((c) => c.metodo === 'GET')).toHaveLength(2)
    })

    it('"Tentar novamente" fica desabilitado, com o alerta ainda visível, enquanto a recarga está em andamento', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      let tentativa = 0
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () => {
          tentativa += 1
          if (tentativa === 1) return respostaErro(500, 'Falha temporária.')
          return new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(tiposApi()))
          })
        },
      })
      renderizar()
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      const botao = screen.getByRole('button', { name: 'Tentar novamente' })
      expect(botao).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Falha temporária.')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      // Um segundo clique durante a recarga não dispara outra chamada.
      await user.click(botao)
      expect(tentativa).toBe(2)

      liberar()
      await aguardarTabela()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    })

    it('erro sem mensagem da API mostra a mensagem padrão do status', async () => {
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () => respostaErro(500),
      })
      renderizar()

      expect(await screen.findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    })

    it('falha de rede mostra a mensagem padrão de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      renderizar()

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
    })
  })

  describe('filtros', () => {
    function opcaoOrigem(rotulo: string) {
      const lista = screen.getByRole('listbox', { name: 'Origem' })
      return within(lista)
        .getAllByRole('option')
        .find((opcao) => within(opcao).queryByText(rotulo) !== null)!
    }

    it('oferece as origens Todos, Fixo e Personalizado com a contagem de cada uma, com Todos selecionada', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      const lista = screen.getByRole('listbox', { name: 'Origem' })
      const opcoes = within(lista).getAllByRole('option')
      expect(opcoes).toHaveLength(3)

      expect(within(opcoes[0]).getByText('Todos')).toBeInTheDocument()
      expect(within(opcoes[0]).getByText('9')).toBeInTheDocument()
      expect(opcoes[0]).toHaveAttribute('aria-selected', 'true')

      expect(within(opcoes[1]).getByText('Fixo')).toBeInTheDocument()
      expect(within(opcoes[1]).getByText('7')).toBeInTheDocument()
      expect(opcoes[1]).toHaveAttribute('aria-selected', 'false')

      expect(within(opcoes[2]).getByText('Personalizado')).toBeInTheDocument()
      expect(within(opcoes[2]).getByText('2')).toBeInTheDocument()
      expect(opcoes[2]).toHaveAttribute('aria-selected', 'false')
    })

    it('selecionar Fixo mostra só os sete fixos; Personalizado só os personalizados; Todos volta à lista completa', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.click(opcaoOrigem('Fixo'))
      expect(nomesListados(tabela)).toEqual([...NOMES_TIPOS_FIXOS])
      expect(screen.queryByRole('button', { name: /^Excluir tipo / })).not.toBeInTheDocument()

      await user.click(opcaoOrigem('Personalizado'))
      expect(nomesListados(tabela)).toEqual(['Logística', 'Marketing'])
      expect(opcaoOrigem('Personalizado')).toHaveAttribute('aria-selected', 'true')

      await user.click(opcaoOrigem('Todos'))
      expect(nomesListados(tabela)).toHaveLength(9)
    })

    it('a busca por nome ignora acentos e maiúsculas', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()
      const busca = screen.getByRole('searchbox', { name: /Buscar/ })

      await user.type(busca, 'tecnologia da informacao')
      expect(nomesListados(tabela)).toEqual(['Tecnologia da Informação'])

      await user.clear(busca)
      await user.type(busca, 'FISC')
      expect(nomesListados(tabela)).toEqual(['Fiscal'])

      await user.clear(busca)
      await user.type(busca, 'logistica')
      expect(nomesListados(tabela)).toEqual(['Logística'])
    })

    it('limpar o texto da busca volta a mostrar todos os tipos', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()
      const busca = screen.getByRole('searchbox', { name: /Buscar/ })

      await user.type(busca, 'fiscal')
      expect(nomesListados(tabela)).toEqual(['Fiscal'])

      await user.clear(busca)
      expect(nomesListados(tabela)).toHaveLength(9)
    })

    it('busca e origem combinam', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.click(opcaoOrigem('Personalizado'))
      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'mark')

      expect(nomesListados(tabela)).toEqual(['Marketing'])
    })

    it('busca sem correspondência não lista nenhum tipo', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      await aguardarTabela()

      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'xyz-inexistente')

      expect(screen.queryByRole('cell', { name: 'Comercial' })).not.toBeInTheDocument()
      expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Excluir tipo / })).not.toBeInTheDocument()
    })

    it('busca sem correspondência mostra "Nenhum tipo encontrado para os filtros." (e não "Nenhum tipo cadastrado.")', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'xyz-inexistente')

      expect(within(tabela).getByText('Nenhum tipo encontrado para os filtros.')).toBeInTheDocument()
      expect(within(tabela).queryByText('Nenhum tipo cadastrado.')).not.toBeInTheDocument()
    })

    it('origem sem itens após filtrar também mostra "Nenhum tipo encontrado para os filtros."', async () => {
      const user = usuarioRapido()
      simularLista(tiposApi().slice(0, 7)) // só fixos
      renderizar()
      const tabela = await aguardarTabela()

      await user.click(opcaoOrigem('Personalizado'))

      expect(within(tabela).getByText('Nenhum tipo encontrado para os filtros.')).toBeInTheDocument()
    })

    it('não exibe "Limpar filtros" enquanto nenhum filtro está ativo', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('"Limpar filtros" aparece após digitar uma busca e, ao clicar, restaura as 9 linhas e limpa o campo', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'fiscal')
      expect(linhasDeDados(tabela)).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(screen.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('')
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('"Limpar filtros" aparece após escolher uma origem e, ao clicar, volta para Todos com as 9 linhas', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.click(opcaoOrigem('Personalizado'))
      expect(linhasDeDados(tabela)).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(opcaoOrigem('Todos')).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('"Limpar filtros" limpa busca e origem ao mesmo tempo', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      const tabela = await aguardarTabela()

      await user.click(opcaoOrigem('Personalizado'))
      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'mark')
      expect(nomesListados(tabela)).toEqual(['Marketing'])

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(screen.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('')
      expect(opcaoOrigem('Todos')).toHaveAttribute('aria-selected', 'true')
    })

    it('as contagens das origens não mudam com a busca (refletem a lista completa)', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      await aguardarTabela()

      await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'fiscal')

      expect(within(opcaoOrigem('Todos')).getByText('9')).toBeInTheDocument()
      expect(within(opcaoOrigem('Fixo')).getByText('7')).toBeInTheDocument()
      expect(within(opcaoOrigem('Personalizado')).getByText('2')).toBeInTheDocument()
    })
  })

  describe('perfis', () => {
    it('Validador vê a mesma listagem do Admin, com os botões Excluir dos personalizados', async () => {
      simularLista()
      renderizar('validador')

      const tabela = await aguardarTabela()

      expect(linhasDeDados(tabela)).toHaveLength(9)
      expect(screen.getAllByRole('button', { name: /^Excluir tipo / })).toHaveLength(2)
    })
  })
})
