import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { DADO_FATURAMENTO_API } from '../test/dadosExternosFalsos'
import { ApiError, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { alterarSituacaoDadoExterno } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'

describe('F5.8 — Serviço de dados externos: troca de situação com 2xx sem o dado', () => {
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

  describe('alterarSituacaoDadoExterno(id, ativo) — resposta 2xx sem o dado', () => {
    it('envelope { mensagem, "dado externo" } devolve o dado atualizado', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/1/situacao`]: () =>
          respostaJson({ mensagem: 'situação alterada', 'dado externo': { ...DADO_FATURAMENTO_API, situacao: 'inativo' } }),
      })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toMatchObject({ id: 1, situacao: 'inativo' })
    })


    it('resposta 2xx só com { mensagem } resolve null, sem erro (a situação foi gravada)', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ mensagem: 'situação alterada' }) })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toBeNull()
    })


    it('resposta 200 com corpo vazio resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => new Response('', { status: 200 }) })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toBeNull()
    })


    it('resposta 204 sem corpo resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => new Response(null, { status: 204 }) })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toBeNull()
    })


    it('resposta 2xx com outro objeto sem o dado (ex.: { ok: true }) resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ ok: true }) })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toBeNull()
    })


    it('dado incompleto na resposta resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ id: 1, situacao: 'inativo' }) })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toBeNull()
    })


    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaErro(500) })

      const erro = await alterarSituacaoDadoExterno(1, false).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })


    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(alterarSituacaoDadoExterno(1, false)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
