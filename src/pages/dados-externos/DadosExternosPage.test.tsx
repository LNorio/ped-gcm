import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { NOMES_DADOS_EXTERNOS, dadosExternosApi, respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import { itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { DadosExternosPage } from './DadosExternosPage'

const ROTA_LISTA = 'GET /api/ped/dados-externos-cadastro'
const ROTA_IDENTIFICADORES = 'GET /api/ped/dados-externos-cadastro/identificadores'

describe('F5.2 — Listagem de dados externos (DadosExternosPage)', () => {
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

  function simularLista(lista = dadosExternosApi()) {
    return simularApi(fetchFalso, {
      [ROTA_LISTA]: () => respostaJson(respostaDadosExternosApi(lista)),
      [ROTA_IDENTIFICADORES]: () => respostaJson([]),
    })
  }

  function renderizar(perfil: Perfil = 'admin') {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <DadosExternosPage />
      </ProvedorSessaoFalso>,
    )
  }

  const aguardarTabela = () => screen.findByRole('table', { name: 'Dados externos' })

  it('exibe o título "Dados Externos"', async () => {
    simularLista()
    renderizar()

    expect(screen.getByRole('heading', { level: 1, name: 'Dados Externos' })).toBeInTheDocument()
    await aguardarTabela()
  })

  it('anuncia "Carregando dados externos..." em região de status e só mostra a tabela após a primeira carga', async () => {
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaDadosExternosApi()))
        }),
    })
    renderizar()

    const carregando = screen.getByText('Carregando dados externos...')
    expect(carregando.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    liberar()
    await aguardarTabela()
    expect(screen.queryByText('Carregando dados externos...')).not.toBeInTheDocument()
  })

  it('lista os dados devolvidos pela API dentro de um Card sem padding', async () => {
    simularLista()
    renderizar()

    const tabela = await aguardarTabela()

    for (const nome of NOMES_DADOS_EXTERNOS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    expect(tabela.closest('.card__corpo')).toHaveClass('card__corpo--sem-padding')
  })

  it('erro de carga: Aviso de erro com a mensagem e "Tentar novamente", sem a tabela; tentar de novo recarrega', async () => {
    const user = usuarioRapido()
    let falhar = true
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falha ao consultar.') : respostaJson(respostaDadosExternosApi())),
      [ROTA_IDENTIFICADORES]: () => respostaJson([]),
    })
    renderizar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await aguardarTabela()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lista vazia sem filtro mostra "Nenhum dado externo cadastrado."', async () => {
    simularLista([])
    renderizar()

    const tabela = await aguardarTabela()
    expect(within(tabela).getByText('Nenhum dado externo cadastrado.')).toBeInTheDocument()
  })

  it.each<Perfil>(['admin', 'validador', 'preenchedor'])('%s vê o botão "Novo dado externo"', async (perfil) => {
    simularLista()
    renderizar(perfil)

    await aguardarTabela()
    expect(screen.getByRole('button', { name: 'Novo dado externo' })).toBeInTheDocument()
  })

  it('não há ação de editar na listagem (RF-29)', async () => {
    simularLista()
    renderizar()

    await aguardarTabela()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it('Admin vê Concluir construção, Ativar/Desativar e Excluir no menu de ações da linha', async () => {
    const user = usuarioRapido()
    simularLista()
    renderizar('admin')

    await aguardarTabela()
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
      'Ver detalhes',
      'Concluir construção',
      'Excluir',
    ])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual([
      'Ver detalhes',
      'Desativar',
      'Excluir',
    ])
  })

  it('Validador vê só Ativar/Desativar (sem Concluir construção e sem Excluir)', async () => {
    const user = usuarioRapido()
    simularLista()
    renderizar('validador')

    await aguardarTabela()
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual(['Ver detalhes', 'Desativar'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual(['Ver detalhes'])
  })

  it('Preenchedor não vê nenhuma ação de linha além de "Ver detalhes"', async () => {
    const user = usuarioRapido()
    simularLista()
    renderizar('preenchedor')

    await aguardarTabela()
    for (const nome of NOMES_DADOS_EXTERNOS) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))).toEqual(['Ver detalhes'])
    }
  })
})
