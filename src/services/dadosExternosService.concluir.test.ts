import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { DADO_DEVOLUCOES_API, respostaConclusaoApi } from '../test/dadosExternosFalsos'
import { ApiError, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { concluirConstrucao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'

describe('F5.7 — Serviço de dados externos: conclusão com 2xx sem o dado', () => {
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

  describe('concluirConstrucao(id, identificador) — resposta 2xx sem o dado', () => {
    const CONCLUIDO_API = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }

    it('envelope { mensagem, "dado externo", "indicador criado" } devolve o dado ativado e o indicador', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () =>
          respostaJson({ mensagem: 'Construção concluída.', ...respostaConclusaoApi(CONCLUIDO_API, { id: 30, nome: 'Devoluções de venda' }) }),
      })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toMatchObject({
        dadoExterno: { id: 3, situacao: 'ativo', identificador: 'DEVOLUCOES' },
        indicadorCriado: { id: 30, nome: 'Devoluções de venda' },
      })
    })


    it('resposta 2xx só com { mensagem } resolve null, sem erro (o dado foi concluído)', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ mensagem: 'Construção concluída.' }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('resposta 200 com corpo vazio resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => new Response('', { status: 200 }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('resposta 204 sem corpo resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => new Response(null, { status: 204 }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('resposta 2xx só com { id } resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ id: 3 }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('dado incompleto (sem situacao e coleta) resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ id: 3, nome: 'Devoluções de venda', identificador: 'DEVOLUCOES' }),
      })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('dado com tipo de valor desconhecido resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ ...CONCLUIDO_API, 'tipo de valor': 'Moeda' }),
      })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('resposta 2xx com lista ou texto solto resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson([CONCLUIDO_API]) })
      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()

      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson('ok') })
      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toBeNull()
    })


    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaErro(500) })

      const erro = await concluirConstrucao(3, 'DEVOLUCOES').catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })


    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
