import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { NOMES_INDICADORES, indicadoresApi, respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { IndicadoresPage } from './IndicadoresPage'

const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'

describe('F6.2 — Listagem de indicadores (IndicadoresPage)', () => {
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

  function simularLista(lista = indicadoresApi()) {
    return simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaIndicadoresApi(lista)) })
  }

  function renderizar(perfil: Perfil = 'admin') {
    const acesso = acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <IndicadoresPage />
      </ProvedorSessaoFalso>,
    )
  }

  const aguardarTabela = () => screen.findByRole('table', { name: 'Indicadores' })

  it('exibe o título "Indicadores"', async () => {
    simularLista()
    renderizar()

    expect(screen.getByRole('heading', { level: 1, name: 'Indicadores' })).toBeInTheDocument()
    await aguardarTabela()
  })

  it('anuncia "Carregando indicadores..." em região de status e só mostra a tabela após a primeira carga', async () => {
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaIndicadoresApi()))
        }),
    })
    renderizar()

    const carregando = screen.getByText('Carregando indicadores...')
    expect(carregando.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    liberar()
    await aguardarTabela()
    expect(screen.queryByText('Carregando indicadores...')).not.toBeInTheDocument()
  })

  it('lista os indicadores devolvidos pela API dentro de um Card sem padding', async () => {
    simularLista()
    renderizar()

    const tabela = await aguardarTabela()

    for (const nome of NOMES_INDICADORES) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    expect(tabela.closest('.card__corpo')).toHaveClass('card__corpo--sem-padding')
  })

  it('erro de carga: Aviso de erro com a mensagem e "Tentar novamente", sem a tabela; tentar de novo recarrega', async () => {
    const user = usuarioRapido()
    let falhar = true
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falha ao consultar.') : respostaJson(respostaIndicadoresApi())),
    })
    renderizar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await aguardarTabela()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lista vazia sem filtro mostra "Nenhum indicador cadastrado."', async () => {
    simularLista([])
    renderizar()

    const tabela = await aguardarTabela()
    expect(within(tabela).getByText('Nenhum indicador cadastrado.')).toBeInTheDocument()
  })

  it.each<Perfil>(['admin', 'validador'])('%s vê o botão "Novo indicador"', async (perfil) => {
    simularLista()
    renderizar(perfil)

    await aguardarTabela()
    expect(screen.getByRole('button', { name: 'Novo indicador' })).toBeInTheDocument()
  })

  it('não há ação de editar na listagem (RF-37)', async () => {
    simularLista()
    renderizar()

    await aguardarTabela()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  it.each<Perfil>(['admin', 'validador'])(
    '%s vê todas as ações do indicador no menu da linha (Definir meta, Histórico de metas, Inativar/Reativar e Excluir)',
    async (perfil) => {
      const user = usuarioRapido()
      simularLista()
      renderizar(perfil)

      await aguardarTabela()
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Definir meta',
        'Inativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))).toEqual([
        'Ver detalhes',
        'Histórico de metas',
        'Inativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Reativar', 'Excluir'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))).toEqual(['Ver detalhes', 'Inativar'])
    },
  )
})
