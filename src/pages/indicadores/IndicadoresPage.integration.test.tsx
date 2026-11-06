import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { NOMES_INDICADORES, indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F6.2 — Listagem de indicadores (integração: /indicadores com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', lista = indicadoresApi(), listar?: () => Response) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: listar ?? rotaListarIndicadores(() => lista),
    })
  }

  it('Admin abre /indicadores: GET da listagem com o Bearer e todas as linhas com as colunas do RF-32', async () => {
    const chamadas = simularSessao('admin')
    renderizarApp('/indicadores')

    const tabela = await screen.findByRole('table', { name: 'Indicadores' })

    expect(screen.getByRole('heading', { level: 1, name: 'Indicadores' })).toBeInTheDocument()
    for (const nome of NOMES_INDICADORES) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    const get = chamadas.find((c) => c.metodo === 'GET' && c.caminho === ROTA)!
    expect(cabecalhoDaChamada(get, 'Authorization')).toBe('Bearer token-salvo')
    expect(get.url.search).toBe('')

    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Nome',
      'Composição',
      'Sentido e cálculo',
      'Meta',
      'Dashboards',
      'Ações',
    ])
    const linhaFaturamento = within(tabela).getByText('Faturamento líquido mensal').closest('tr')!
    expect(within(linhaFaturamento).getByText('Faturamento líquido')).toHaveClass('etiqueta--dourado')
    expect(within(linhaFaturamento).getByText('1.500.000,50')).toBeInTheDocument()
    expect(within(linhaFaturamento).getByText('PED Comercial (60 pontos base)')).toBeInTheDocument()
    expect(within(linhaFaturamento).getByText('Meta editável')).toBeInTheDocument()
    expect(within(linhaFaturamento).getByText('Vinculado a dashboard')).toBeInTheDocument()
    const linhaDevolucoes = within(tabela).getByText('Devoluções (dado externo)', { selector: '.etiqueta--dourado' }).closest('tr')!
    expect(within(linhaDevolucoes).getByText('Criado automaticamente')).toBeInTheDocument()
    expect(within(linhaDevolucoes).getByText('Meta a definir')).toBeInTheDocument()
  })

  it('Admin abre "Ver detalhes": descrição, tipos e cadastro aparecem na linha de detalhes', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    renderizarApp('/indicadores')
    const tabela = await screen.findByRole('table', { name: 'Indicadores' })

    await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Ver detalhes')

    const detalhes = within(tabela).getByText('Cobertura de visitas').closest('tr')!.nextElementSibling as HTMLElement
    expect(within(detalhes).getByText('Descrição', { selector: 'dt' })).toBeInTheDocument()
    expect(detalhes).toHaveTextContent('Percentual de vendedores com roteiro e positivação em dia.')
    expect(detalhes).toHaveTextContent('02/10/2026 09:30 por Maria Souza')
  })

  it('Validador vê a aba e as mesmas ações do Admin, menos "Excluir" (exclusão só do Admin — decisão de 06/11/2026)', async () => {
    const user = usuarioRapido()
    simularSessao('validador')
    renderizarApp('/indicadores')

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Indicadores/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Novo indicador' })).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual(['Ver detalhes', 'Definir meta', 'Inativar'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Reativar'])
  })

  it('Preenchedor não vê a aba Indicadores e, ao abrir /indicadores, volta ao Início sem consultar a listagem', async () => {
    const chamadas = simularSessao('preenchedor')
    renderizarApp('/indicadores')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).queryByRole('link', { name: /Indicadores/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Indicadores' })).not.toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho === ROTA)).toHaveLength(0)
  })

  it('500 na listagem: Aviso de erro com a mensagem da API e "Tentar novamente"', async () => {
    simularSessao('admin', [], () => respostaErro(500, 'Falha ao consultar os indicadores.'))
    renderizarApp('/indicadores')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os indicadores.')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Indicadores' })).not.toBeInTheDocument()
  })

  it('401 na listagem encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularSessao('admin', [], () => respostaErro(401))
    renderizarApp('/indicadores')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
