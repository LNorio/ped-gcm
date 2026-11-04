import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, rotuloAcoesApontamento } from '../../test/menuAcoes'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_CONCILIACAO_API,
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  respostaApontamentosApi,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA_LISTA = 'GET /api/ped/apontamentos'

describe('F4.2 — Listagem de apontamentos (ApontamentosPage)', () => {
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

  function simularLista(lista: ApontamentoApiFalso[] = apontamentosApi()) {
    return simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaApontamentosApi(lista)) })
  }

  function renderizar(perfil: Perfil = 'admin') {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function aguardarTabela() {
    return await screen.findByRole('table', { name: 'Apontamentos' })
  }

  function linhasDeDados(tabela: HTMLElement) {
    return within(tabela)
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
  }

  function nomesListados(tabela: HTMLElement) {
    return linhasDeDados(tabela).map((linha) => {
      const celulaNome = within(linha).getAllByRole('cell')[0]
      return NOMES_APONTAMENTOS.find((nome) => within(celulaNome).queryByText(nome) !== null) ?? celulaNome.textContent
    })
  }

  describe('estrutura da tela', () => {
    it('exibe o título "Apontamentos"', async () => {
      simularLista()
      renderizar()

      expect(screen.getByRole('heading', { level: 1, name: 'Apontamentos' })).toBeInTheDocument()
      await aguardarTabela()
    })

    it('anuncia "Carregando apontamentos..." em uma região de status enquanto a lista não chega e remove ao concluir', async () => {
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(respostaApontamentosApi()))
          }),
      })
      renderizar()

      const carregando = screen.getByText('Carregando apontamentos...')
      expect(carregando.closest('[role="status"]')).not.toBeNull()

      liberar()
      await aguardarTabela()
      expect(screen.queryByText('Carregando apontamentos...')).not.toBeInTheDocument()
    })

    it('chama GET /api/ped/apontamentos uma única vez ao abrir, sem busca nem tipo na query', async () => {
      const chamadas = simularLista()
      renderizar()

      await aguardarTabela()

      const gets = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
      expect(gets).toHaveLength(1)
      expect(gets[0].url.searchParams.has('busca')).toBe(false)
      expect(gets[0].url.searchParams.has('tipo')).toBe(false)
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
    it('lista os apontamentos devolvidos pela API, na ordem da API, com as colunas da F4.2', async () => {
      simularLista()
      renderizar()

      const tabela = await aguardarTabela()

      expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent).slice(0, 7)).toEqual([
        'Nome',
        'Tipo',
        'Tipo de valor',
        'Situação',
        'Indicadores',
        'Cadastro',
        'Ações',
      ])
      expect(linhasDeDados(tabela)).toHaveLength(5)
      expect(nomesListados(tabela)).toEqual([...NOMES_APONTAMENTOS])
    })

    it('mostra descrição, tipo, tipo de valor, situação, indicadores e cadastro de cada linha', async () => {
      simularLista([APONTAMENTO_CONCILIACAO_API])
      renderizar()
      await aguardarTabela()

      const linha = screen.getByText('Conciliação bancária concluída').closest('tr')!
      const celulas = within(linha).getAllByRole('cell')
      expect(celulas[0]).toHaveTextContent('Conciliação de todas as contas fechada até o dia 5.')
      expect(celulas[1]).toHaveTextContent('Financeiro')
      expect(celulas[2]).toHaveTextContent('Booleano')
      expect(within(celulas[3]).getByText('Inativo')).toHaveClass('etiqueta--neutro')
      expect(celulas[4]).toHaveTextContent('Rotinas financeiras em dia')
      expect(celulas[5]).toHaveTextContent('15/09/2026 14:30')
      expect(celulas[5]).toHaveTextContent('por João Lima')
    })

    it('mostra as etiquetas "Vinculado a dashboard" (dourado) e "Desativado, mas usado em indicador ativo" (alerta) nos apontamentos certos', async () => {
      simularLista()
      renderizar()
      await aguardarTabela()

      const vinculado = screen.getByText('Vinculado a dashboard')
      expect(vinculado).toHaveClass('etiqueta--dourado')
      expect(vinculado.closest('tr')).toHaveTextContent('Roteiro de visitas elaborado')

      const problema = screen.getByText('Desativado, mas usado em indicador ativo')
      expect(problema).toHaveClass('etiqueta--alerta')
      expect(problema.closest('tr')).toHaveTextContent('Conciliação bancária concluída')
    })

    it('a linha com situação alterada mostra quem alterou e quando pelo item "Ver detalhes" do menu de ações', async () => {
      const user = usuarioRapido()
      simularLista()
      renderizar()
      await aguardarTabela()

      expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) detalhes$/ })).not.toBeInTheDocument()
      const linha = screen.getByText('Conciliação bancária concluída').closest('tr')!
      await escolherAcao(user, rotuloAcoesApontamento('Conciliação bancária concluída'), 'Ver detalhes', linha)

      expect(screen.getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()
    })

    it('mostra "Nenhum apontamento cadastrado." quando a API devolve lista vazia', async () => {
      simularLista([])
      renderizar()

      const tabela = await aguardarTabela()

      expect(within(tabela).getByText('Nenhum apontamento cadastrado.')).toBeInTheDocument()
    })
  })

  describe('erro de carga', () => {
    it('mostra a mensagem da API em um alerta com o botão "Tentar novamente" e sem tabela', async () => {
      simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os apontamentos.') })
      renderizar()

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Falha ao consultar os apontamentos.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(screen.queryByText('Carregando apontamentos...')).not.toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('"Tentar novamente" chama a API de novo e, com sucesso, mostra a tabela e remove o alerta', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: () => {
          tentativa += 1
          return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : respostaJson(respostaApontamentosApi())
        },
      })
      renderizar()
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      const tabela = await aguardarTabela()
      expect(linhasDeDados(tabela)).toHaveLength(5)
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
            liberar = () => resolve(respostaJson(respostaApontamentosApi()))
          })
        },
      })
      renderizar()
      await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      const botao = screen.getByRole('button', { name: 'Tentar novamente' })
      expect(botao).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Falha temporária.')

      await user.click(botao)
      expect(tentativa).toBe(2)

      liberar()
      await aguardarTabela()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('erro sem mensagem da API mostra a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500) })
      renderizar()

      expect(await screen.findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    })

    it('falha de rede mostra a mensagem padrão de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      renderizar()

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
    })
  })

  describe('perfis', () => {
    it('Validador vê a mesma listagem do Admin', async () => {
      simularLista()
      renderizar('validador')

      const tabela = await aguardarTabela()

      expect(linhasDeDados(tabela)).toHaveLength(5)
    })

    it('Preenchedor vê exatamente a lista devolvida pela API (quem restringe aos tipos dele é a API; o front não filtra)', async () => {
      // A API já devolve só os tipos do usuário; mesmo que devolva outro tipo, o front exibe o que recebeu.
      simularLista([APONTAMENTO_CHAMADOS_API, APONTAMENTO_CONCILIACAO_API])
      renderizar('preenchedor')

      const tabela = await aguardarTabela()

      expect(nomesListados(tabela)).toEqual(['Chamados resolvidos no prazo', 'Conciliação bancária concluída'])
    })
  })

  describe('desmontagem', () => {
    it('desmontar durante a carga não gera erro no console quando a resposta chega', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [ROTA_LISTA]: () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(respostaApontamentosApi()))
          }),
      })
      const { unmount } = renderizar()
      unmount()

      liberar()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleErro).not.toHaveBeenCalled()
    })
  })
})
