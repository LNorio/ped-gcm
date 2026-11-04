import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
import { definirToken, limparToken } from '../../services/sessao'
import { podeExecutar } from '../../sessao/permissoes'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

// Envolve as implementações reais: o comportamento é o mesmo, mas o teste consegue verificar
// que a página consulta a matriz de ações e conduz o diálogo pelo hook genérico.
vi.mock('../../sessao/permissoes', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../sessao/permissoes')>()
  return { ...real, podeExecutar: vi.fn(real.podeExecutar) }
})
vi.mock('../../hooks/useAcaoConfirmada', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../hooks/useAcaoConfirmada')>()
  return { ...real, useAcaoConfirmada: vi.fn(real.useAcaoConfirmada) }
})

const ROTA = '/api/ped/apontamentos'

describe('F4.5 — ApontamentosPage: permissão de alterar situação pela matriz de ações e fluxo via useAcaoConfirmada', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(async () => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    const real = await vi.importActual<typeof import('../../sessao/permissoes')>('../../sessao/permissoes')
    vi.mocked(podeExecutar).mockClear()
    vi.mocked(podeExecutar).mockImplementation(real.podeExecutar)
    vi.mocked(useAcaoConfirmada).mockClear()

    let lista = apontamentosApi()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`PUT ${ROTA}/4/situacao`]: (init) => {
        const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
        lista = lista.map((a) => (a.id === 4 ? { ...a, ativo } : a))
        return respostaJson(lista.find((a) => a.id === 4))
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function abrirTela(perfil: Perfil) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  it('a página consulta podeExecutar(perfil, "alterar-situacao-apontamento") (via usePermissoes().podeAcao)', async () => {
    await abrirTela('validador')

    expect(podeExecutar).toHaveBeenCalledWith('validador', 'alterar-situacao-apontamento')
  })

  it('quem decide é a matriz de ações: com a ação negada, nem o Admin vê Desativar/Ativar', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'alterar-situacao-apontamento')
    await abrirTela('admin')

    expect(screen.queryByRole('button', { name: /^Desativar apontamento / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ativar apontamento / })).not.toBeInTheDocument()
  })

  it('com a ação liberada pela matriz, os botões aparecem mesmo para um perfil que normalmente não os tem', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao === 'alterar-situacao-apontamento')
    await abrirTela('preenchedor')

    expect(screen.getAllByRole('button', { name: /^(Desativar|Ativar) apontamento / }).length).toBeGreaterThan(0)
  })

  it('o diálogo de situação é conduzido por useAcaoConfirmada: abrir define o alvo e confirmar executa a alteração', async () => {
    const user = userEvent.setup()
    await abrirTela('admin')
    expect(useAcaoConfirmada).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Desativar apontamento Chamados resolvidos no prazo' }))

    const alvos = vi.mocked(useAcaoConfirmada).mock.results.map((resultado) => (resultado.value as { alvo: unknown }).alvo)
    expect(alvos).toContainEqual(expect.objectContaining({ id: 4, nome: 'Chamados resolvidos no prazo', ativo: true }))

    await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))
    await screen.findByText('Situação alterada.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
