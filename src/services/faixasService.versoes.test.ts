import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { FAIXAS_V1_COMERCIAL_101, historicoFaixasApi, versaoFaixasApi } from '../test/faixasFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { excluirTabelaFaixas, listarHistoricoFaixas, obterFaixasDaVersao, type VersaoFaixas } from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'

/** Histórico no formato atual da API (sem `acao` — F8.5): `acao` é `null`. */
const HISTORICO: VersaoFaixas[] = [
  { versao: 2, vigente: true, motivo: 'Reajuste do trimestre', data: '2026-10-20 15:30:00', usuario: 'Ana Costa', quantidadeDeFaixas: 3, acao: null },
  { versao: 1, vigente: false, motivo: 'Cadastro inicial', data: '2026-09-01 10:00:00', usuario: 'Maria Souza', quantidadeDeFaixas: 2, acao: null },
]

const MOTIVO_EXCLUSAO = 'Dashboard encerrado em 2025'

describe('F8.1 — Serviço de faixas: histórico de versões, faixas de uma versão e exclusão (RF-45, RF-46)', () => {
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

  describe('listarHistoricoFaixas(id) — RF-45', () => {
    it('GET /api/ped/faixas/{id}/historico e devolve as versões convertidas, na ordem da API (mais recente primeiro)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoFaixasApi()) })

      const versoes = await listarHistoricoFaixas(1)

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/historico`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(versoes).toEqual(HISTORICO)
    })

    it('aceita a lista dentro de { historico }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson({ historico: historicoFaixasApi() }) })

      await expect(listarHistoricoFaixas(1)).resolves.toEqual(HISTORICO)
    })

    it('sem "quantidade de faixas", quantidadeDeFaixas é null', async () => {
      const { 'quantidade de faixas': _quantidade, ...semQuantidade } = historicoFaixasApi()[1]
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([semQuantidade]) })

      const [versao] = await listarHistoricoFaixas(1)

      expect(versao.quantidadeDeFaixas).toBeNull()
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([]) })

      await expect(listarHistoricoFaixas(1)).resolves.toEqual([])
    })

    it.each([
      ['resposta sem lista', { mensagem: 'ok' }],
      ['versão sem número', [{ ...historicoFaixasApi()[0], versao: undefined }]],
      ['versão sem "vigente"', [{ ...historicoFaixasApi()[0], vigente: undefined }]],
      ['versão sem motivo', [{ ...historicoFaixasApi()[0], motivo: undefined }]],
      ['versão sem data', [{ ...historicoFaixasApi()[0], data: undefined }]],
      ['versão sem usuário', [{ ...historicoFaixasApi()[0], usuario: undefined }]],
      ['versão com número em texto', [{ ...historicoFaixasApi()[0], versao: 'v2' }]],
    ])('%s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(corpo) })

      const erro = await listarHistoricoFaixas(1).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('404, 403 e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/99/historico`]: () => respostaErro(404, 'Tabela de faixas não encontrada.') })
      await expect(listarHistoricoFaixas(99)).rejects.toMatchObject({ status: 404, mensagem: 'Tabela de faixas não encontrada.' })

      simularApi(fetchFalso, { [`GET ${ROTA}/2/historico`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(listarHistoricoFaixas(2)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarHistoricoFaixas(1)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterFaixasDaVersao(id, versao) — RF-45 ("ver as faixas de cada versão")', () => {
    it('GET /api/ped/faixas/{id}/versoes/{versao} e devolve as faixas daquela versão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/versoes/1`]: () => respostaJson(versaoFaixasApi(1)) })

      const faixas = await obterFaixasDaVersao(1, 1)

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/versoes/1`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(faixas).toEqual(FAIXAS_V1_COMERCIAL_101)
    })

    it('aceita a lista pura de faixas e valores em texto decimal ("1000.00")', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/versoes/1`]: () => respostaJson([{ de: '0.00', ate: '1000.00', aliquota: '0.00' }, { de: 1000.01, ate: 3000, aliquota: 2 }]),
      })

      await expect(obterFaixasDaVersao(1, 1)).resolves.toEqual(FAIXAS_V1_COMERCIAL_101)
    })

    it.each([
      ['sem faixas', { versao: 1 }],
      ['faixa sem "ate"', { versao: 1, faixas: [{ de: 0, aliquota: 0 }] }],
      ['um texto', 'nada'],
    ])('resposta %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/versoes/1`]: () => respostaJson(corpo) })

      await expect(obterFaixasDaVersao(1, 1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('404 (versão inexistente) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/versoes/9`]: () => respostaErro(404, 'Versão não encontrada.') })

      await expect(obterFaixasDaVersao(1, 9)).rejects.toMatchObject({ status: 404, mensagem: 'Versão não encontrada.' })
    })
  })

  describe('excluirTabelaFaixas(id, motivo) — RF-46; motivo obrigatório (F8.6, 12/11/2026); 2xx significa excluído', () => {
    it('DELETE /api/ped/faixas/{id} com o token e o corpo { motivo }; 204 resolve sem valor', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => new Response(null, { status: 204 }) })

      await expect(excluirTabelaFaixas(4, MOTIVO_EXCLUSAO)).resolves.toBeUndefined()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe(`${ROTA}/4`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(corpoDaChamada(chamadas[0])).toEqual({ motivo: MOTIVO_EXCLUSAO })
    })

    it.each<[string, () => Response]>([
      ['200 com { mensagem }', () => respostaJson({ mensagem: 'Tabela de faixas excluída.' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['200 com a tabela excluída', () => respostaJson({ tabela: { id: 4 } })],
    ])('%s também resolve sem valor, sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: resposta })

      await expect(excluirTabelaFaixas(4, MOTIVO_EXCLUSAO)).resolves.toBeUndefined()
    })

    it('400 (dashboard ainda existe — RF-46) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`DELETE ${ROTA}/1`]: () => respostaErro(400, 'A tabela só pode ser excluída depois que o dashboard for excluído.'),
      })

      await expect(excluirTabelaFaixas(1, MOTIVO_EXCLUSAO)).rejects.toMatchObject({
        status: 400,
        mensagem: 'A tabela só pode ser excluída depois que o dashboard for excluído.',
      })
    })

    it('403 e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(excluirTabelaFaixas(4, MOTIVO_EXCLUSAO)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(excluirTabelaFaixas(4, MOTIVO_EXCLUSAO)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
