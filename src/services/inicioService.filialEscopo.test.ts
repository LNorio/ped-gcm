import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { MENSAGEM_FILIAL_FORA_DO_ESCOPO, MENSAGEM_SEM_FILIAL_DEFINIDA, inicioPreenchedorApi } from '../test/inicioFalsos'
import { ApiError } from './api'
import { obterInicio } from './inicioService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/inicio'

/**
 * F11.1 — D6 da resposta do back-end de 25/11/2026 (`docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`):
 * todos os perfis podem pedir `?filial=` dentro do próprio escopo. O serviço não conhece o perfil: envia a
 * filial recebida (a do cabeçalho) sempre que houver uma, e os dois `403` do escopo chegam como `ApiError`
 * com a mensagem da API:
 * - filial fora do escopo: `403` "voce nao tem acesso a esta filial";
 * - sem filial e sem abrangência: `403` "usuario sem filial definida".
 */
describe('F11.1 — Serviço do Início: ?filial= para todos os perfis e os 403 do escopo (D6)', () => {
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

  it('a resposta de um Preenchedor também chega pela filial pedida (?filial=102), sem filtrar por perfil', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioPreenchedorApi()) })

    const inicio = await obterInicio('102')

    expect([...chamadas[0].url.searchParams.entries()]).toEqual([['filial', '102']])
    expect(inicio.perfil).toBe('preenchedor')
  })

  it('filial fora do escopo: 403 "voce nao tem acesso a esta filial" chega como ApiError com a mensagem', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, MENSAGEM_FILIAL_FORA_DO_ESCOPO) })

    const promessa = obterInicio('200')

    await expect(promessa).rejects.toBeInstanceOf(ApiError)
    await expect(promessa).rejects.toMatchObject({ status: 403, mensagem: MENSAGEM_FILIAL_FORA_DO_ESCOPO })
  })

  it('sem filial e sem abrangência: 403 "usuario sem filial definida" chega como ApiError com a mensagem', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, MENSAGEM_SEM_FILIAL_DEFINIDA) })

    await expect(obterInicio(null)).rejects.toMatchObject({ status: 403, mensagem: MENSAGEM_SEM_FILIAL_DEFINIDA })
    expect(chamadas[0].url.search).toBe('')
  })
})
