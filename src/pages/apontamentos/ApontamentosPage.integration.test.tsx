import { screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, rotuloAcoesApontamento } from '../../test/menuAcoes'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_ROTEIRO_API,
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  respostaApontamentosApi,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F4.2 — Listagem de apontamentos (integração: /apontamentos com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', lista: ApontamentoApiFalso[] = apontamentosApi()) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      'GET /api/ped/apontamentos': () => respostaJson(respostaApontamentosApi(lista)),
    })
  }

  function linhasDeDados(tabela: HTMLElement) {
    return within(tabela)
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
  }

  it('Admin: token salvo → acesso → GET /api/ped/apontamentos com o Bearer → tabela com os 5 apontamentos dentro do layout', async () => {
    const chamadas = simularSessao('admin')

    renderizarApp('/apontamentos')

    const tabela = await screen.findByRole('table', { name: 'Apontamentos' })
    expect(screen.getByRole('heading', { level: 1, name: 'Apontamentos' })).toBeInTheDocument()
    expect(linhasDeDados(tabela)).toHaveLength(5)
    for (const nome of NOMES_APONTAMENTOS) expect(screen.getByText(nome)).toBeInTheDocument()

    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getByRole('link', { name: 'Apontamentos' })).toHaveAttribute('aria-current', 'page')

    const gets = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
    expect(gets).toHaveLength(1)
    expect(cabecalhoDaChamada(gets[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(gets[0].url.searchParams.has('busca')).toBe(false)
    expect(gets[0].url.searchParams.has('tipo')).toBe(false)
  })

  it('Admin vê as etiquetas de vínculo e de problema e abre, pelo menu de ações, os detalhes com a alteração de situação', async () => {
    const user = usuarioRapido()
    simularSessao('admin')

    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })

    expect(screen.getByText('Vinculado a dashboard')).toHaveClass('etiqueta--dourado')
    expect(screen.getByText('Desativado, mas usado em indicador ativo')).toHaveClass('etiqueta--alerta')

    expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) detalhes$/ })).not.toBeInTheDocument()
    const linha = screen.getByText('Conciliação bancária concluída').closest('tr')!
    await escolherAcao(user, rotuloAcoesApontamento('Conciliação bancária concluída'), 'Ver detalhes', linha)
    expect(screen.getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()
  })

  it('Validador vê a mesma listagem do Admin', async () => {
    simularSessao('validador')

    renderizarApp('/apontamentos')

    const tabela = await screen.findByRole('table', { name: 'Apontamentos' })
    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(linhasDeDados(tabela)).toHaveLength(5)
  })

  it('Preenchedor (tipo Comercial) vê a lista que a API devolve para ele, sem filtrar no front', async () => {
    simularSessao('preenchedor', [APONTAMENTO_ROTEIRO_API, APONTAMENTO_RELATORIO_API])

    renderizarApp('/apontamentos')

    const tabela = await screen.findByRole('table', { name: 'Apontamentos' })
    expect(screen.getByText('Preenchedor')).toBeInTheDocument()
    expect(linhasDeDados(tabela)).toHaveLength(2)
    expect(screen.getByText('Roteiro de visitas elaborado')).toBeInTheDocument()
    expect(screen.getByText('Relatório mensal entregue')).toBeInTheDocument()
    expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument()
  })

  it('erro 500 ao listar mostra a mensagem da API e "Tentar novamente" recupera a lista', async () => {
    const user = usuarioRapido()
    let tentativa = 0
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/apontamentos': () => {
        tentativa += 1
        return tentativa === 1
          ? respostaErro(500, 'Falha ao consultar os apontamentos.')
          : respostaJson(respostaApontamentosApi([APONTAMENTO_CHAMADOS_API]))
      },
    })

    renderizarApp('/apontamentos')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os apontamentos.')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    const tabela = await screen.findByRole('table', { name: 'Apontamentos' })
    expect(linhasDeDados(tabela)).toHaveLength(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('401 ao listar (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/apontamentos': () => respostaErro(401),
    })

    renderizarApp('/apontamentos')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
