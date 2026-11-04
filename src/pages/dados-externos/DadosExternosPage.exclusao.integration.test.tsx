import { screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { dadosExternosApi, identificadoresApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_JA_COMPOS = 'O dado externo já compôs indicadores e não pode ser excluído.'

describe('F5.9 — Excluir dado externo (integração: /dados-externos com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(
    perfil: 'admin' | 'validador' | 'preenchedor',
    aoExcluir?: () => Response | Promise<Response> | undefined,
    aoAlterarSituacao?: () => Response,
  ) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosApi()
    const rotaExcluir = (id: number) => () => {
      const personalizada = aoExcluir?.()
      if (personalizada) return personalizada
      lista = lista.filter((d) => d.id !== id)
      return new Response(null, { status: 204 })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`DELETE ${ROTA}/1`]: rotaExcluir(1),
      [`DELETE ${ROTA}/3`]: rotaExcluir(3),
      [`DELETE ${ROTA}/6`]: rotaExcluir(6),
      [`PUT ${ROTA}/1/situacao`]: aoAlterarSituacao ?? (() => respostaErro(500)),
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')

  async function abrirTela() {
    renderizarApp('/dados-externos')
    return await screen.findByRole('table', { name: 'Dados externos' })
  }

  it('Admin exclui: confirmação com o impacto → DELETE com o Bearer → "Dado externo excluído." e a linha some', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir dado externo' })
    expect(
      within(dialogo).getByText('O dado externo Faturamento líquido será excluído. Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    const notificacao = await screen.findByText('Dado externo excluído.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(1)
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/1`)
    expect(cabecalhoDaChamada(deletes(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    await waitFor(() => expect(screen.queryByText('Faturamento líquido')).not.toBeInTheDocument())
  })

  it('Admin exclui um dado em construção', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Dado externo excluído.')
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/3`)
  })

  it('dado com indicadores: bloqueio no front listando os indicadores, só "Entendi", sem DELETE', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Volume de vendas'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir dado externo' })
    expect(
      within(dialogo).getByText(
        'Este dado externo compõe os indicadores: Volume mensal, Crescimento de vendas e não pode ser excluído.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(0)
    expect(screen.getByText('Volume de vendas')).toBeInTheDocument()
  })

  it('400 da API ("já compôs" — A-10): diálogo fecha, Aviso de erro com a mensagem e a linha mantida, sem notificação', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaJson({ mensagem: MENSAGEM_JA_COMPOS, indicadores: ['Faturamento 2025'] }, 400))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_JA_COMPOS)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Faturamento líquido')).toBeInTheDocument()
    expect(screen.queryByText('Dado externo excluído.')).not.toBeInTheDocument()
  })

  it('clique duplo em Excluir gera um único DELETE; Cancelar e Esc são ignorados durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const chamadas = simularSessao(
      'admin',
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(new Response(null, { status: 204 }))
        }),
    )
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir dado externo' })
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Excluir' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Excluir dado externo' })).toBeInTheDocument()
    liberar()
    await screen.findByText('Dado externo excluído.')
    expect(deletes(chamadas)).toHaveLength(1)
  })

  it('um aviso de erro de ação por vez: o erro da exclusão substitui o da alteração de situação', async () => {
    const user = usuarioRapido()
    simularSessao(
      'admin',
      () => respostaJson({ mensagem: MENSAGEM_JA_COMPOS }, 400),
      () => respostaErro(500, 'Falha ao alterar a situação.'),
    )
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao alterar a situação.')

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_JA_COMPOS))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText('Falha ao alterar a situação.')).not.toBeInTheDocument()
  })

  it.each(['validador', 'preenchedor'] as const)('%s não vê a ação Excluir', async (perfil) => {
    const user = usuarioRapido()
    simularSessao(perfil)
    await abrirTela()

    for (const nome of ['Faturamento líquido', 'Devoluções de venda']) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))).not.toContain('Excluir')
    }
  })

  it('401 ao excluir encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
