import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { dashboardsApi, respostaDashboardApi, rotaListarDashboards, type DashboardApiFalso } from '../../test/dashboardsFalsos'
import { useDashboards } from './useDashboards'

const ROTA = '/api/ped/dashboards'

describe('F7.10 — useDashboards: ativar/desativar, concluir e excluir (RF-48, RF-58, RF-59)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  /** Lista mutável: as rotas de ação atualizam a lista como a API faria e devolvem `{ dashboard }`. */
  function montar(rotasExtras: Record<string, RotaFalsa> = {}) {
    let lista: DashboardApiFalso[] = dashboardsApi()
    const atualizar = (id: number, mudanca: Partial<DashboardApiFalso>) => {
      lista = lista.map((d) => (d.id === id ? { ...d, ...mudanca } : d))
      return respostaJson(respostaDashboardApi(lista.find((d) => d.id === id)!))
    }
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      [`PUT ${ROTA}/1/situacao`]: () => atualizar(1, { situacao: 'inativo', 'situacao descricao': 'Inativo' }),
      [`PUT ${ROTA}/5/situacao`]: () => atualizar(5, { situacao: 'ativo', 'situacao descricao': 'Ativo' }),
      [`PUT ${ROTA}/3/concluir`]: () => atualizar(3, { situacao: 'ativo', 'situacao descricao': 'Ativo' }),
      [`PUT ${ROTA}/4/concluir`]: () => atualizar(4, { situacao: 'inativo', 'situacao descricao': 'Inativo' }),
      [`DELETE ${ROTA}/5`]: () => {
        lista = lista.filter((d) => d.id !== 5)
        return new Response(null, { status: 204 })
      },
      ...rotasExtras,
    })
    const resultado = renderHook(() => useDashboards())
    return { ...resultado, chamadas }
  }

  describe('alterarSituacao(id, ativo)', () => {
    it('PUT { ativo: false } e troca o item pela versão da API, sem nova consulta', async () => {
      const { result, chamadas } = montar()
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let atualizado: Awaited<ReturnType<typeof result.current.alterarSituacao>> | undefined
      await act(async () => {
        atualizado = await result.current.alterarSituacao(1, false)
      })

      const put = chamadas.find((c) => c.metodo === 'PUT')!
      expect(put.caminho).toBe(`${ROTA}/1/situacao`)
      expect(corpoDaChamada(put)).toEqual({ ativo: false })
      expect(atualizado).toMatchObject({ id: 1, situacao: 'inativo' })
      expect(result.current.dashboards.find((d) => d.id === 1)?.situacao).toBe('inativo')
      expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2, 3, 4, 5])
      expect(gets(chamadas)).toHaveLength(1)
    })

    it('com o filtro "Ativos", o dashboard desativado sai da lista na hora', async () => {
      const { result } = montar()
      await waitFor(() => expect(result.current.carregando).toBe(false))
      act(() => {
        result.current.setSituacao('ativos')
      })
      await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2]))

      await act(async () => {
        await result.current.alterarSituacao(1, false)
      })

      expect(result.current.dashboards.map((d) => d.id)).toEqual([2])
    })

    it('2xx sem o dashboard no corpo recarrega a lista com os filtros atuais e resolve null', async () => {
      const { result, chamadas } = montar({ [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ mensagem: 'Situação alterada.' }) })
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let atualizado: unknown = 'nao-resolvido'
      await act(async () => {
        atualizado = await result.current.alterarSituacao(1, false)
      })

      expect(atualizado).toBeNull()
      expect(gets(chamadas)).toHaveLength(2)
    })

    it('erro: rejeita com a ApiError original e não altera a lista', async () => {
      const { result } = montar({ [`PUT ${ROTA}/1/situacao`]: () => respostaErro(400, 'Dashboard em construção não pode ser desativado.') })
      await waitFor(() => expect(result.current.carregando).toBe(false))
      const antes = result.current.dashboards

      let falha: unknown
      await act(async () => {
        falha = await result.current.alterarSituacao(1, false).catch((e: unknown) => e)
      })

      expect(falha).toBeInstanceOf(ApiError)
      expect(falha).toMatchObject({ status: 400, mensagem: 'Dashboard em construção não pode ser desativado.' })
      expect(result.current.dashboards).toEqual(antes)
      expect(result.current.erro).toBeNull()
    })
  })

  describe('concluir(id)', () => {
    it('PUT .../concluir e troca o item pela versão da API (construção concluída → ativo)', async () => {
      const { result, chamadas } = montar()
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let concluido: Awaited<ReturnType<typeof result.current.concluir>> | undefined
      await act(async () => {
        concluido = await result.current.concluir(3)
      })

      expect(chamadas.find((c) => c.metodo === 'PUT')?.caminho).toBe(`${ROTA}/3/concluir`)
      expect(concluido).toMatchObject({ id: 3, situacao: 'ativo' })
      expect(result.current.dashboards.find((d) => d.id === 3)?.situacao).toBe('ativo')
      expect(gets(chamadas)).toHaveLength(1)
    })

    it('com o filtro "Em construção/modificação", o dashboard concluído sai da lista na hora', async () => {
      const { result } = montar()
      await waitFor(() => expect(result.current.carregando).toBe(false))
      act(() => {
        result.current.setSituacao('construcao')
      })
      await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual([3, 4]))

      await act(async () => {
        await result.current.concluir(4)
      })

      expect(result.current.dashboards.map((d) => d.id)).toEqual([3])
    })

    it('2xx sem o dashboard recarrega a lista e resolve null; erro rejeita sem alterar a lista', async () => {
      let falhar = false
      const { result, chamadas } = montar({
        [`PUT ${ROTA}/3/concluir`]: () => (falhar ? respostaErro(403, 'Apenas o Admin conclui a construção.') : new Response(null, { status: 204 })),
      })
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let concluido: unknown = 'nao-resolvido'
      await act(async () => {
        concluido = await result.current.concluir(3)
      })
      expect(concluido).toBeNull()
      expect(gets(chamadas)).toHaveLength(2)

      falhar = true
      let falha: unknown
      await act(async () => {
        falha = await result.current.concluir(3).catch((e: unknown) => e)
      })
      expect(falha).toMatchObject({ status: 403, mensagem: 'Apenas o Admin conclui a construção.' })
      expect(gets(chamadas)).toHaveLength(2)
    })
  })

  describe('excluir(id)', () => {
    it('DELETE e remoção do item da lista, sem nova consulta', async () => {
      const { result, chamadas } = montar()
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await result.current.excluir(5)
      })

      expect(chamadas.find((c) => c.metodo === 'DELETE')?.caminho).toBe(`${ROTA}/5`)
      expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2, 3, 4])
      expect(gets(chamadas)).toHaveLength(1)
    })

    it('erro: rejeita com a ApiError original e mantém o item', async () => {
      const { result } = montar({ [`DELETE ${ROTA}/5`]: () => respostaErro(403, 'Apenas o Admin exclui dashboards.') })
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let falha: unknown
      await act(async () => {
        falha = await result.current.excluir(5).catch((e: unknown) => e)
      })

      expect(falha).toBeInstanceOf(ApiError)
      expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2, 3, 4, 5])
    })
  })
})
