import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { MENSAGEM_DASHBOARD_NAO_ATIVO } from '../test/fechamentosFalsos'
import { MENSAGEM_CHAVE_FORA_DA_PREVIA, MENSAGEM_PREVIA_SEM_IMAGENS, TIPO_PDF, TIPO_ZIP, respostaArquivo } from '../test/pdfFalsos'
import { ApiError, EVENTO_SESSAO_EXPIRADA, MENSAGEM_SEM_CONEXAO } from './api'
import { obterPdfPrevia, obterZipPrevia } from './fechamentosService'
import { definirToken, limparToken } from './sessao'

/**
 * F10.10 — PDF e ZIP da prévia do fechamento (`src/services/fechamentosService.ts`), contrato proposto em
 * `docs/backend/PROPOSTA-pdf-imagens.md` (rotas ainda inexistentes no back-end):
 * - `obterPdfPrevia(id, chave, opcoes?)` → `GET /api/ped/fechamentos/{id}/previa/pdf?chave={chave}`;
 * - `obterZipPrevia(id, opcoes?)` → `GET /api/ped/fechamentos/{id}/previa/zip`.
 * `opcoes`: `{ nomeReserva?: string; signal?: AbortSignal }`. Devolvem `ArquivoBaixado { blob, nomeArquivo }`
 * com o nome do `Content-Disposition`; sem ele, `opcoes.nomeReserva` ou o padrão (`previa-{id}-{chave com
 * ":" trocado por "-"}.pdf` e `previa-{id}.zip`). Só GET: nada é gravado. Erros como `ApiError` com a
 * `mensagem` do JSON; `401` segue o fluxo de sessão expirada.
 */
describe('F10.10 — Serviço: PDF e ZIP da prévia do fechamento', () => {
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

  describe('obterPdfPrevia', () => {
    it('GET .../previa/pdf com a chave na query e o Bearer; devolve o Blob do PDF e o nome do Content-Disposition', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/fechamentos/1/previa/pdf': () =>
          respostaArquivo('%PDF-1.4 filial 101', TIPO_PDF, 'PREVIA_PED-Comercial_4-tri-2026_F101.pdf'),
      })

      const arquivo = await obterPdfPrevia(1, 'filial:101')

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].url.searchParams.get('chave')).toBe('filial:101')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(arquivo.nomeArquivo).toBe('PREVIA_PED-Comercial_4-tri-2026_F101.pdf')
      expect(arquivo.blob.type).toBe(TIPO_PDF)
      expect(await arquivo.blob.text()).toBe('%PDF-1.4 filial 101')
    })

    it('chave de colaborador vai na query sem alteração', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/fechamentos/2/previa/pdf': () => respostaArquivo('%PDF', TIPO_PDF, 'a.pdf'),
      })

      await obterPdfPrevia(2, 'colaborador:11')

      expect(Object.fromEntries(chamadas[0].url.searchParams.entries())).toEqual({ chave: 'colaborador:11' })
    })

    it('sem nome no cabeçalho: usa opcoes.nomeReserva; sem reserva, "previa-{id}-{chave}.pdf"', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/fechamentos/1/previa/pdf': () => respostaArquivo('%PDF', TIPO_PDF) })

      expect((await obterPdfPrevia(1, 'filial:101', { nomeReserva: 'PREVIA_F101.pdf' })).nomeArquivo).toBe('PREVIA_F101.pdf')
      expect((await obterPdfPrevia(1, 'filial:101')).nomeArquivo).toBe('previa-1-filial-101.pdf')
    })

    it('400 (chave fora da prévia, dashboard não ativo): ApiError com a mensagem do back-end', async () => {
      fetchFalso.mockResolvedValueOnce(respostaErro(400, MENSAGEM_CHAVE_FORA_DA_PREVIA))
      fetchFalso.mockResolvedValueOnce(respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO))

      await expect(obterPdfPrevia(1, 'filial:999')).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_CHAVE_FORA_DA_PREVIA })
      await expect(obterPdfPrevia(1, 'filial:101')).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_DASHBOARD_NAO_ATIVO })
    })

    it.each([
      [403, 'sem permissao'],
      [404, 'dashboard nao encontrado'],
    ])('%i: ApiError com a mensagem', async (status, mensagem) => {
      fetchFalso.mockResolvedValue(respostaErro(status, mensagem))

      const erro = await obterPdfPrevia(1, 'filial:101').catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status, mensagem })
    })

    it('401: ApiError 401 e evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      fetchFalso.mockResolvedValue(respostaJson({ mensagem: 'token expirado' }, 401))

      try {
        await expect(obterPdfPrevia(1, 'filial:101')).rejects.toMatchObject({ status: 401 })
        expect(ouvinte).toHaveBeenCalledTimes(1)
      } finally {
        window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      }
    })

    it('falha de rede: ApiError(0, sem conexão)', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(obterPdfPrevia(1, 'filial:101')).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterZipPrevia', () => {
    it('GET .../previa/zip sem query, com o Bearer; devolve o Blob do ZIP e o nome do Content-Disposition', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/fechamentos/1/previa/zip': () => respostaArquivo('PK zip', TIPO_ZIP, 'PREVIA_PED-Comercial_4-tri-2026.zip'),
      })

      const arquivo = await obterZipPrevia(1)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect([...chamadas[0].url.searchParams.keys()]).toEqual([])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(arquivo.nomeArquivo).toBe('PREVIA_PED-Comercial_4-tri-2026.zip')
      expect(arquivo.blob.type).toBe(TIPO_ZIP)
      expect(await arquivo.blob.text()).toBe('PK zip')
    })

    it('sem nome no cabeçalho: opcoes.nomeReserva ou "previa-{id}.zip"', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/fechamentos/2/previa/zip': () => respostaArquivo('PK', TIPO_ZIP) })

      expect((await obterZipPrevia(2, { nomeReserva: 'PREVIA_PED-Gerentes.zip' })).nomeArquivo).toBe('PREVIA_PED-Gerentes.zip')
      expect((await obterZipPrevia(2)).nomeArquivo).toBe('previa-2.zip')
    })

    it('400 (prévia sem imagens a gerar): ApiError com a mensagem', async () => {
      fetchFalso.mockResolvedValue(respostaErro(400, MENSAGEM_PREVIA_SEM_IMAGENS))

      await expect(obterZipPrevia(6)).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_PREVIA_SEM_IMAGENS })
    })

    it('401: evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      fetchFalso.mockResolvedValue(respostaErro(401))

      try {
        await expect(obterZipPrevia(1)).rejects.toMatchObject({ status: 401 })
        expect(ouvinte).toHaveBeenCalledTimes(1)
      } finally {
        window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      }
    })
  })
})
