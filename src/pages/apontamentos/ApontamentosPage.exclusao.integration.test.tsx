import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import {
  APONTAMENTO_CHAMADOS_API,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
} from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/apontamentos'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F4.6 — Exclusão de apontamento (integração: /apontamentos com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', aoExcluir?: () => Response | undefined) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = apontamentosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`DELETE ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}`]: () => {
        const personalizada = aoExcluir?.()
        if (personalizada) return personalizada
        lista = lista.filter((a) => a.id !== APONTAMENTO_CHAMADOS_API.id)
        return new Response(null, { status: 204 })
      },
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')

  async function abrirTela() {
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  async function confirmarExclusao(user: ReturnType<typeof userEvent.setup>, nome: string) {
    await user.click(screen.getByRole('button', { name: `Excluir apontamento ${nome}` }))
    await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento' })).getByRole('button', { name: 'Excluir' }))
  }

  it('Admin exclui um apontamento sem indicadores: confirmação → DELETE com o Bearer → "Apontamento excluído." → linha removida', async () => {
    const user = userEvent.setup()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
    expect(
      within(dialogo).getByText(
        'O apontamento Chamados resolvidos no prazo e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    const notificacao = await screen.findByText('Apontamento excluído.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument())
    expect(screen.getByText('Roteiro de visitas elaborado')).toBeInTheDocument()

    expect(deletes(chamadas)).toHaveLength(1)
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_CHAMADOS_API.id}`)
    expect(cabecalhoDaChamada(deletes(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(deletes(chamadas)[0].init?.body).toBeUndefined()
  })

  it('Admin tenta excluir um apontamento com indicadores: diálogo bloqueado com a lista e "Entendi"; nenhum DELETE', async () => {
    const user = userEvent.setup()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await user.click(screen.getByRole('button', { name: 'Excluir apontamento Horas de treinamento realizadas' }))

    const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
    expect(
      within(dialogo).getByText('Este apontamento compõe os indicadores: Capacitação, Desenvolvimento de equipe e não pode ser excluído.'),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Horas de treinamento realizadas')).toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(0)
  })

  it('API recusa com 400 { mensagem, indicadores } ("já compôs", A-10): mensagem exibida, linha mantida', async () => {
    const user = userEvent.setup()
    simularSessao('admin', () =>
      respostaJson(
        {
          mensagem: 'Este apontamento já compôs o indicador Cobertura de visitas e não pode ser excluído.',
          indicadores: [{ id: 1, nome: 'Cobertura de visitas' }],
        },
        400,
      ),
    )
    await abrirTela()

    await confirmarExclusao(user, 'Chamados resolvidos no prazo')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este apontamento já compôs o indicador Cobertura de visitas e não pode ser excluído.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
    expect(screen.queryByText('Apontamento excluído.')).not.toBeInTheDocument()
  })

  it.each(['validador', 'preenchedor'] as const)('%s não vê botão Excluir em nenhuma linha', async (perfil) => {
    simularSessao(perfil)
    await abrirTela()

    expect(screen.queryByRole('button', { name: /^Excluir apontamento / })).not.toBeInTheDocument()
  })

  it('401 ao excluir (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    const user = userEvent.setup()
    simularSessao('admin', () => respostaErro(401))
    await abrirTela()

    await confirmarExclusao(user, 'Chamados resolvidos no prazo')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
