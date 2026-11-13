import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { adiado, inicioAdminApi, inicioAdminFilial101Api, inicioPreenchedorApi } from '../../test/inicioFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { useInicio } from './useInicio'

const ROTA = '/api/ped/inicio'

/**
 * F11.1 — Hook da tela Início (`src/pages/inicio/useInicio.ts`; RF-06 a RF-11).
 *
 * `useInicio()` (sem parâmetros) devolve `{ inicio: Inicio | null; carregando: boolean; erro: string | null;
 * recarregar: () => void }`. Consulta `obterInicio` ao montar com a filial do cabeçalho
 * (`useSessao().filialSelecionada`): uma filial → o código dela; "todas" ou `null` → sem filial. Trocar a
 * filial consulta de novo; só a resposta da consulta mais recente é aplicada. Falhas viram mensagem em
 * pt-BR em `erro`; `recarregar()` consulta de novo.
 */
describe('F11.1 — useInicio (dados da tela Início pela filial do cabeçalho)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: admin(), filialSelecionada: 'todas' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar() {
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => useInicio(), { wrapper })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const filialDe = (chamada: ChamadaRegistrada) => chamada.url.searchParams.get('filial')

  it('começa carregando, sem dados e sem erro; ao responder, expõe os dados da API', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

    const { result } = renderizar()

    expect(result.current.carregando).toBe(true)
    expect(result.current.inicio).toBeNull()
    expect(result.current.erro).toBeNull()
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBeNull()
    expect(result.current.inicio?.perfil).toBe('admin')
    expect(result.current.inicio?.periodosEmAberto.map((p) => p.nome)).toEqual(['PED Comercial', 'PED Gerentes', 'PED Vendedores'])
  })

  it('"Todas as filiais" no cabeçalho: consulta sem filial', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

    const { result } = renderizar()

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('sem filial selecionada (null): consulta sem filial', async () => {
    sessao = { acesso: admin(), filialSelecionada: null }
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

    const { result } = renderizar()

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('uma filial no cabeçalho: consulta ?filial={código}', async () => {
    sessao = { acesso: acessoFalso(), filialSelecionada: FILIAIS[1] }
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioPreenchedorApi()) })

    const { result } = renderizar()

    await waitFor(() => expect(result.current.inicio?.perfil).toBe('preenchedor'))
    expect(gets(chamadas)).toHaveLength(1)
    expect(filialDe(gets(chamadas)[0])).toBe('101')
  })

  it('trocar a filial do cabeçalho consulta de novo com a nova filial e aplica a nova resposta', async () => {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: (_init, url) =>
        respostaJson(url.searchParams.get('filial') === '101' ? inicioAdminFilial101Api() : inicioAdminApi()),
    })
    const { result, rerender } = renderizar()
    await waitFor(() => expect(result.current.inicio?.periodosEmAberto).toHaveLength(3))

    sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
    rerender()

    await waitFor(() => expect(result.current.inicio?.periodosEmAberto).toHaveLength(1))
    expect(gets(chamadas)).toHaveLength(2)
    expect(filialDe(gets(chamadas)[1])).toBe('101')

    sessao = { acesso: admin(), filialSelecionada: 'todas' }
    rerender()

    await waitFor(() => expect(result.current.inicio?.periodosEmAberto).toHaveLength(3))
    expect(gets(chamadas)).toHaveLength(3)
    expect(gets(chamadas)[2].url.search).toBe('')
  })

  it('só a resposta da consulta mais recente é aplicada (troca de filial com a primeira resposta pendente)', async () => {
    const primeira = adiado<Response>()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: (_init, url) =>
        url.searchParams.get('filial') === '101' ? respostaJson(inicioAdminFilial101Api()) : primeira.promessa,
    })
    const { result, rerender } = renderizar()

    sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
    rerender()
    await waitFor(() => expect(result.current.inicio?.periodosEmAberto).toHaveLength(1))

    await act(async () => {
      primeira.resolver(respostaJson(inicioAdminApi()))
      await primeira.promessa
    })

    expect(result.current.inicio?.periodosEmAberto).toHaveLength(1)
    expect(result.current.carregando).toBe(false)
  })

  it('erro da API: erro com a mensagem, sem dados; recarregar() consulta de novo e limpa o erro no sucesso', async () => {
    let tentativas = 0
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => {
        tentativas += 1
        return tentativas === 1 ? respostaErro(500, 'Falha ao montar o inicio.') : respostaJson(inicioAdminApi())
      },
    })
    const { result } = renderizar()

    await waitFor(() => expect(result.current.erro).toBe('Falha ao montar o inicio.'))
    expect(result.current.carregando).toBe(false)
    expect(result.current.inicio).toBeNull()

    act(() => {
      result.current.recarregar()
    })

    await waitFor(() => expect(result.current.inicio?.perfil).toBe('admin'))
    expect(result.current.erro).toBeNull()
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('falha de rede: mensagem de conexão em pt-BR', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderizar()

    await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
  })
})
