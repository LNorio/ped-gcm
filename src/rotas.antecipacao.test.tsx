import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preConsultarInicio } from './pages/inicio/consultasInicio'
import { limparToken } from './services/sessao'
import { avisarAcessoObtido } from './sessao/acessoObtido'
import { FILIAIS, acessoFalso } from './test/sessaoFalsa'
import { respostaJson, simularApi, type ChamadaRegistrada } from './test/apiFalsa'
import { rotasDoInicio } from './test/inicioFalsos'
import { renderizarApp } from './test/renderizarApp'
import { usuarioRapido } from './test/usuario'

// Espiona a pré-consulta do Início mantendo o comportamento real (o InicioPage a reexporta deste módulo).
vi.mock('./pages/inicio/consultasInicio', async (importOriginal) => {
  const original = await importOriginal<typeof import('./pages/inicio/consultasInicio')>()
  return { ...original, preConsultarInicio: vi.fn(original.preConsultarInicio) }
})

const preConsultarInicioEspiao = vi.mocked(preConsultarInicio)

const getsInicio = (chamadas: ChamadaRegistrada[]) =>
  chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/inicio')

describe('F2.3 — Antecipação das consultas da rota aberta (AntecipacaoDaRota / handle.aoObterAcesso)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    preConsultarInicioEspiao.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sessão restaurada com o Início aberto: antecipa as consultas uma vez, com o acesso e a filial da sessão', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    const chamadas = simularApi(fetchFalso, rotasDoInicio('preenchedor'))

    renderizarApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(preConsultarInicioEspiao).toHaveBeenCalledTimes(1)
    const [obtido] = preConsultarInicioEspiao.mock.calls[0]
    expect(obtido.acesso.perfil).toBe('preenchedor')
    expect(obtido.filialSelecionada).toEqual({ codigo: '101', nome: 'CAMPO GRANDE', empresa: null })
    // A página aproveita a pré-consulta: GET /api/ped/inicio sai uma única vez.
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
    expect(getsInicio(chamadas)[0].url.searchParams.get('filial')).toBe('101')
  })

  it('sessão restaurada com outra aba aberta (sem handle.aoObterAcesso): não antecipa', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, rotasDoInicio('admin', { 'GET /api/ped/tipos-apontamento': () => respostaJson([]) }))

    renderizarApp('/tipos')

    expect(await screen.findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    expect(preConsultarInicioEspiao).not.toHaveBeenCalled()
  })

  it('sessão restaurada com /login aberto: não antecipa, mesmo levando depois ao Início', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, rotasDoInicio('preenchedor'))

    renderizarApp('/login')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(preConsultarInicioEspiao).not.toHaveBeenCalled()
  })

  it('login por formulário: não há pré-consulta (a sessão nunca fica "carregando")', async () => {
    const user = usuarioRapido()
    const chamadas = simularApi(
      fetchFalso,
      rotasDoInicio('preenchedor', { 'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }) }),
    )
    renderizarApp('/')
    await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })

    await user.type(screen.getByLabelText('Usuário'), 'fulano')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(preConsultarInicioEspiao).not.toHaveBeenCalled()
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
  })

  it('só reage enquanto a sessão está "carregando": um aviso depois de autenticada não antecipa', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, rotasDoInicio('preenchedor'))
    renderizarApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })
    expect(preConsultarInicioEspiao).toHaveBeenCalledTimes(1)

    act(() => {
      avisarAcessoObtido({ acesso: acessoFalso(), filialSelecionada: FILIAIS[1] })
    })

    expect(preConsultarInicioEspiao).toHaveBeenCalledTimes(1)
  })

  it('sem sessão (anônimo) no Início: um aviso de acesso não antecipa', async () => {
    simularApi(fetchFalso, {})
    renderizarApp('/')
    await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })

    act(() => {
      avisarAcessoObtido({ acesso: acessoFalso(), filialSelecionada: FILIAIS[1] })
    })

    expect(preConsultarInicioEspiao).not.toHaveBeenCalled()
  })
})
