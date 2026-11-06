import { act, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'
import { itensDoMenuAcoes } from '../../test/menuAcoes'
import { NOMES_TIPOS_FIXOS, respostaRealTiposApi, rotuloAcoesTipo, tiposApi } from '../../test/tiposFalsos'

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
      // Para Admin e Validador a API devolve "grupos" e "usuarios" em cada tipo (A-02).
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
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
    expect(within(linhaComercial).getAllByRole('cell')[3]).toHaveTextContent(/^7$/)

    const linhaLogistica = screen.getByRole('cell', { name: 'Logística' }).closest('tr')!
    expect(within(linhaLogistica).getByText('Personalizado')).toHaveClass('etiqueta--info')
    expect(within(linhaLogistica).getAllByRole('cell')[3]).toHaveTextContent(/^0$/)
  })

  it('mostra na coluna "Grupos vinculados" os grupos e a quantidade de usuários devolvidos pela API', async () => {
    simularSessao('admin')

    renderizarApp('/tipos')
    await aguardarTabela()

    const tabela = screen.getByRole('table', { name: 'Tipos de apontamento' })
    expect(within(tabela).getAllByRole('columnheader')[2]).toHaveTextContent('Grupos vinculados')
    const linhaComercial = screen.getByRole('cell', { name: 'Comercial' }).closest('tr')!
    const grupos = within(linhaComercial).getAllByRole('cell')[2]
    expect(grupos).toHaveTextContent('DEF_OPERADOR DE CAIXA')
    expect(grupos).toHaveTextContent('DEF_GERENTE DE LOJA')
    expect(grupos).toHaveTextContent('1 usuário vinculado')
    const linhaProcessos = screen.getByRole('cell', { name: 'Processos' }).closest('tr')!
    expect(within(linhaProcessos).getAllByRole('cell')[2]).toHaveTextContent(/^Nenhum grupo$/)
  })

  it('Validador abre /tipos e vê a listagem completa, com "Editar grupos" e "Excluir" nos personalizados e só "Editar grupos" nos fixos', async () => {
    const user = usuarioRapido()
    simularSessao('validador')

    renderizarApp('/tipos')
    const tabela = await aguardarTabela()

    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(nomesListados(tabela)).toHaveLength(9)
    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Logística'))).toEqual(['Editar grupos', 'Excluir'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Marketing'))).toEqual(['Editar grupos', 'Excluir'])
    for (const nome of NOMES_TIPOS_FIXOS) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo(nome))).toEqual(['Editar grupos'])
    }
  })

  it('resposta real da API (usuários com "id colaborador"): a tabela carrega os 7 tipos fixos, sem "Resposta inválida do servidor.", com "1 usuário vinculado"', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      'GET /api/ped/tipos-apontamento': () => respostaJson(respostaRealTiposApi()),
    })

    renderizarApp('/tipos')
    const tabela = await aguardarTabela()

    expect(nomesListados(tabela)).toEqual([...NOMES_TIPOS_FIXOS])
    expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    for (const nome of NOMES_TIPOS_FIXOS) {
      const linha = screen.getByRole('cell', { name: nome }).closest('tr')!
      const grupos = within(linha).getAllByRole('cell')[2]
      expect(grupos).toHaveTextContent('1 usuário vinculado')
      expect(grupos).not.toHaveTextContent('Nenhum grupo')
    }
    const linhaTi = screen.getByRole('cell', { name: 'Tecnologia da Informação' }).closest('tr')!
    expect(within(linhaTi).getAllByRole('cell')[3]).toHaveTextContent(/^1$/)
    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Comercial'))).toEqual(['Editar grupos'])
  })

  it('navegar do Início até a aba Tipos carrega a listagem', async () => {
    const user = usuarioRapido()
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
    const user = usuarioRapido()
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
    const user = usuarioRapido()
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
