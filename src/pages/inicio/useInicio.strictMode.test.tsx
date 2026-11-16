import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { adiado, inicioAdminApi } from '../../test/inicioFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Acesso } from '../../types/dominio'
import { liberarPreConsultaInicio, liberarPreConsultaPendencias, preConsultarInicio, verPreConsultaInicio, verPreConsultaPendencias } from './consultasInicio'
import { useInicio } from './useInicio'

const ROTA = '/api/ped/inicio'

/**
 * F11.1 — useInicio em <StrictMode> com a pré-consulta da primeira abertura (revisão de 16/11/2026).
 *
 * `main.tsx` usa <StrictMode>, que executa o efeito duas vezes na montagem. A pré-consulta antecipada ao
 * obter o acesso vale para a primeira abertura: com ela (já respondida ou ainda pendente), sai um único
 * GET /api/ped/inicio — o da pré-consulta —, sem nova consulta na re-execução do efeito.
 */
describe('F11.1 — useInicio em <StrictMode> (pré-consulta sem GET duplicado)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let acesso: Acesso

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  })

  afterEach(() => {
    // Não deixa pré-consulta para os testes seguintes (estado do módulo).
    const preInicio = verPreConsultaInicio(acesso, null)
    if (preInicio) liberarPreConsultaInicio(preInicio)
    const prePendencias = verPreConsultaPendencias(acesso)
    if (prePendencias) liberarPreConsultaPendencias(prePendencias)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Raiz em <StrictMode>, como em `main.tsx` (efeitos executados duas vezes na montagem). */
  function renderizarEmStrictMode() {
    const sessao: Partial<Sessao> = { acesso, filialSelecionada: 'todas' }
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => useInicio(), { wrapper, reactStrictMode: true })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  async function aguardarEfeitos() {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 20))
    })
  }

  it('pré-consulta já respondida: os dados saem na primeira renderização e há um único GET /api/ped/inicio', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })
    preConsultarInicio({ acesso, filialSelecionada: 'todas' })
    await waitFor(() => expect(verPreConsultaInicio(acesso, null)?.consulta.resultado).toBeTruthy())
    expect(gets(chamadas)).toHaveLength(1)

    const { result } = renderizarEmStrictMode()

    expect(result.current.inicio?.perfil).toBe('admin')
    expect(result.current.carregando).toBe(false)
    await aguardarEfeitos()
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.inicio?.perfil).toBe('admin')
    expect(result.current.carregando).toBe(false)
    expect(result.current.erro).toBeNull()
  })

  it('pré-consulta ainda pendente: aguarda a mesma consulta, sem novo GET /api/ped/inicio', async () => {
    const liberacao = adiado<void>()
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => liberacao.promessa.then(() => respostaJson(inicioAdminApi())),
    })
    preConsultarInicio({ acesso, filialSelecionada: 'todas' })
    expect(gets(chamadas)).toHaveLength(1)

    const { result } = renderizarEmStrictMode()
    expect(result.current.carregando).toBe(true)
    await aguardarEfeitos()

    await act(async () => {
      liberacao.resolver()
    })

    await waitFor(() => expect(result.current.inicio?.perfil).toBe('admin'))
    expect(result.current.carregando).toBe(false)
    await aguardarEfeitos()
    expect(gets(chamadas)).toHaveLength(1)
  })
})
