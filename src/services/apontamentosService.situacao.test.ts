import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { APONTAMENTO_CHAMADOS_API } from '../test/apontamentosFalsos'
import { ApiError, mensagemPadraoPorStatus } from './api'
import { alterarSituacao } from './apontamentosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/apontamentos'

describe('F4.5 — Serviço de apontamentos: troca de situação', () => {
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

  describe('alterarSituacao(id, ativo) — resposta 2xx sem o apontamento', () => {
    const DESATIVADO = {
      ...APONTAMENTO_CHAMADOS_API,
      ativo: false,
      'situacao alterada em': '2026-11-03 11:20:00',
      'situacao alterada por': 'Fulano',
    }

    it('envelope { apontamento } (sem mensagem) devolve o apontamento convertido', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ apontamento: DESATIVADO }) })

      await expect(alterarSituacao(4, false)).resolves.toMatchObject({
        id: 4,
        ativo: false,
        situacaoAlteradaEm: '2026-11-03 11:20:00',
        situacaoAlteradaPor: 'Fulano',
      })
    })


    it('envelope { mensagem, apontamento } devolve o apontamento convertido', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ mensagem: 'situação alterada', apontamento: DESATIVADO }),
      })

      await expect(alterarSituacao(4, false)).resolves.toMatchObject({ id: 4, ativo: false, situacaoAlteradaPor: 'Fulano' })
    })


    it('resposta 2xx só com { mensagem } resolve null, sem erro (a situação foi gravada)', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ mensagem: 'situação alterada' }) })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('resposta 200 com corpo vazio resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => new Response('', { status: 200 }) })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('resposta 204 sem corpo resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => new Response(null, { status: 204 }) })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('resposta 2xx só com { id } resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ id: 4 }) })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('apontamento incompleto na raiz (sem "id tipo" e "tipo") resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ id: 4, nome: 'Chamados', ativo: false }) })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('apontamento com tipo de valor desconhecido resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ ...DESATIVADO, 'tipo de valor': 'Moeda' }),
      })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('envelope { mensagem, apontamento } com apontamento incompleto resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ mensagem: 'situação alterada', apontamento: { id: 4, ativo: false } }),
      })

      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('resposta 2xx com lista ou texto solto resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson([DESATIVADO]) })
      await expect(alterarSituacao(4, false)).resolves.toBeNull()

      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson('ok') })
      await expect(alterarSituacao(4, false)).resolves.toBeNull()
    })


    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaErro(500) })

      const erro = await alterarSituacao(4, false).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })
  })
})
