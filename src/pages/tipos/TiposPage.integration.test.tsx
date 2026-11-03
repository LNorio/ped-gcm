import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'
import { NOMES_TIPOS_FIXOS, tiposApi } from '../../test/tiposFalsos'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F3.2 — Listagem de tipos (integração: /tipos com sessão Admin e Validador)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador', rotas: Record<string, RotaFalsa> = {}) {
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () =>
        respostaJson(
          // Para o Admin a API devolve também "usuarios" em cada tipo; o front ignora.
          tiposApi().map((tipo) => (perfil === 'admin' ? { ...tipo, usuarios: [{ id: 12, nome: 'Fulano' }] } : tipo)),
        ),
      ...rotas,
    })
  }

  async function aguardarTabela() {
    return await screen.findByRole('table', { name: 'Tipos de apontamento' })
  }

  function nomesListados(tabela: HTMLElement) {
    return within(tabela)
      .getAllByRole('row')
      .slice(1)
      .map((linha) => within(linha).getAllByRole('cell')[0].textContent)
  }

  it('Admin abre /tipos: aba ativa, cabeçalho do usuário, API chamada com o token e tabela com os 9 tipos', async () => {
    const chamadas = simularSessao('admin')

    renderizarApp('/tipos')

    expect(await screen.findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    expect(screen.getByText('Olá, Fulano')).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')

    const tabela = await aguardarTabela()
    expect(nomesListados(tabela)).toEqual([...NOMES_TIPOS_FIXOS, 'Logística', 'Marketing'])

    const listagens = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')
    expect(listagens).toHaveLength(1)
    expect(cabecalhoDaChamada(listagens[0], 'Authorization')).toBe('Bearer token-salvo')
  })

  it('exibe o aviso dos sete tipos fixos, a origem como etiqueta e a quantidade de apontamentos de cada tipo', async () => {
    simularSessao('admin')

    renderizarApp('/tipos')
    await aguardarTabela()

    const aviso = screen.getByRole('note')
    expect(aviso).toHaveTextContent(/não podem ser excluídos/)
    for (const nome of NOMES_TIPOS_FIXOS) expect(aviso).toHaveTextContent(nome)

    const linhaComercial = screen.getByRole('cell', { name: 'Comercial' }).closest('tr')!
    expect(within(linhaComercial).getByText('Fixo')).toHaveClass('etiqueta--neutro')
    expect(within(linhaComercial).getAllByRole('cell')[2]).toHaveTextContent(/^7$/)

    const linhaLogistica = screen.getByRole('cell', { name: 'Logística' }).closest('tr')!
    expect(within(linhaLogistica).getByText('Personalizado')).toHaveClass('etiqueta--info')
    expect(within(linhaLogistica).getAllByRole('cell')[2]).toHaveTextContent(/^0$/)
  })

  it('Validador abre /tipos e vê a listagem completa com Excluir nos personalizados e sem ação nos fixos', async () => {
    simularSessao('validador')

    renderizarApp('/tipos')
    const tabela = await aguardarTabela()

    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(nomesListados(tabela)).toHaveLength(9)
    expect(screen.getAllByRole('button', { name: /^Excluir tipo / }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Excluir tipo Logística',
      'Excluir tipo Marketing',
    ])
    for (const nome of NOMES_TIPOS_FIXOS) {
      const linha = screen.getByRole('cell', { name: nome }).closest('tr')!
      expect(within(linha).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it('navegar do Início até a aba Tipos carrega a listagem', async () => {
    const user = userEvent.setup()
    const chamadas = simularSessao('admin')
    renderizarApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })
    expect(chamadas.some((c) => c.caminho === '/api/ped/tipos-apontamento')).toBe(false)

    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: 'Tipos' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    const tabela = await aguardarTabela()
    expect(nomesListados(tabela)).toHaveLength(9)
  })

  it('busca sem acento e filtro de origem funcionam na tela completa', async () => {
    const user = userEvent.setup()
    simularSessao('admin')
    renderizarApp('/tipos')
    const tabela = await aguardarTabela()

    const origem = screen.getByRole('listbox', { name: 'Origem' })
    const opcaoPersonalizado = within(origem)
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText('Personalizado') !== null)!
    await user.click(opcaoPersonalizado)
    expect(nomesListados(tabela)).toEqual(['Logística', 'Marketing'])

    await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'logistica')
    expect(nomesListados(tabela)).toEqual(['Logística'])
  })

  it('erro 500 ao listar: alerta com a mensagem da API e "Tentar novamente" recupera a listagem', async () => {
    const user = userEvent.setup()
    let tentativa = 0
    simularSessao('admin', {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha ao consultar os tipos.') : respostaJson(tiposApi())
      },
    })
    renderizarApp('/tipos')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os tipos.')
    expect(screen.getByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    const tabela = await aguardarTabela()
    expect(nomesListados(tabela)).toHaveLength(9)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('401 ao listar (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularSessao('admin', {
      'GET /api/ped/tipos-apontamento': () => respostaErro(401),
    })

    await act(async () => {
      renderizarApp('/tipos')
    })

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
    expect(sessionStorage.getItem('ped.token')).toBeNull()
  })
})
