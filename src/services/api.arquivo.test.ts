import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { TIPO_PDF, TIPO_ZIP, respostaArquivo } from '../test/pdfFalsos'
import {
  ApiError,
  EVENTO_SESSAO_EXPIRADA,
  MENSAGEM_SEM_CONEXAO,
  apiFetchArquivo,
  mensagemPadraoPorStatus,
  nomeDoArquivo,
} from './api'
import { definirToken, limparToken } from './sessao'

/**
 * F10.10 — Download de arquivos pela API (`src/services/api.ts`), base das imagens em PDF e dos ZIPs
 * (`docs/backend/PROPOSTA-pdf-imagens.md`):
 * - `nomeDoArquivo(contentDisposition)` lê o nome do arquivo do cabeçalho `Content-Disposition`
 *   (`filename*=UTF-8''...` tem prioridade sobre `filename=`; com ou sem aspas); sem nome → `null`;
 * - `apiFetchArquivo(caminho, nomeReserva, opcoes?)` faz a chamada como `apiFetch` (mesma URL base, query,
 *   `Authorization: Bearer`, `signal`) e devolve `{ blob, nomeArquivo }` **sem ler o corpo como JSON**;
 *   sem nome no cabeçalho, `nomeArquivo = nomeReserva`;
 * - erros como em `apiFetch`: `ApiError(status, mensagem do JSON | mensagem padrão)`, `401` com token
 *   dispara `EVENTO_SESSAO_EXPIRADA`, falha de rede → `ApiError(0, MENSAGEM_SEM_CONEXAO)`.
 * `apiFetch` (JSON) não muda.
 */
describe('F10.10 — Download de arquivos pela API (apiFetchArquivo e nomeDoArquivo)', () => {
  describe('nomeDoArquivo (Content-Disposition)', () => {
    it.each([
      ['inline; filename="PREVIA_PED-Comercial_4-tri-2026_F101.pdf"', 'PREVIA_PED-Comercial_4-tri-2026_F101.pdf'],
      ['attachment; filename="IMAGENS_2026-11-17.zip"', 'IMAGENS_2026-11-17.zip'],
      ['inline; filename=IMG-000123.pdf', 'IMG-000123.pdf'],
      ['inline;filename="sem-espaco.pdf"', 'sem-espaco.pdf'],
      ["inline; filename*=UTF-8''Relat%C3%B3rio%20final.pdf", 'Relatório final.pdf'],
      ['inline; filename="reserva.pdf"; filename*=UTF-8\'\'Jo%C3%A3o-Silva.pdf', 'João-Silva.pdf'],
    ])('lê o nome de %s', (cabecalho, esperado) => {
      expect(nomeDoArquivo(cabecalho)).toBe(esperado)
    })

    it.each([null, undefined, '', 'inline', 'attachment', 'inline; filename=""'])('sem nome (%s) → null', (cabecalho) => {
      expect(nomeDoArquivo(cabecalho)).toBeNull()
    })
  })

  describe('apiFetchArquivo', () => {
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

    it('faz GET na URL base com a query e o Bearer, e devolve o Blob e o nome do Content-Disposition', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/fechamentos/1/previa/pdf': () => respostaArquivo('%PDF-1.4 conteudo', TIPO_PDF, 'PREVIA_1.pdf'),
      })

      const arquivo = await apiFetchArquivo('/ped/fechamentos/1/previa/pdf', 'reserva.pdf', { query: { chave: 'filial:101' } })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].url.searchParams.get('chave')).toBe('filial:101')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(arquivo.nomeArquivo).toBe('PREVIA_1.pdf')
      expect(arquivo.blob).toBeInstanceOf(Blob)
      expect(arquivo.blob.type).toBe(TIPO_PDF)
      expect(await arquivo.blob.text()).toBe('%PDF-1.4 conteudo')
    })

    it('respeita VITE_API_URL como em apiFetch', async () => {
      vi.stubEnv('VITE_API_URL', 'http://servidor:8080/api/')
      fetchFalso.mockResolvedValue(respostaArquivo('PK', TIPO_ZIP, 'a.zip'))

      await apiFetchArquivo('/ped/imagens/zip', 'imagens.zip')

      expect(String(fetchFalso.mock.calls[0][0])).toBe('http://servidor:8080/api/ped/imagens/zip')
    })

    it('o corpo não é lido como JSON: um binário qualquer não vira "Resposta inválida do servidor"', async () => {
      fetchFalso.mockResolvedValue(respostaArquivo('PK\u0003\u0004 binario { nao json', TIPO_ZIP, 'PREVIA_1.zip'))

      const arquivo = await apiFetchArquivo('/ped/fechamentos/1/previa/zip', 'previa.zip')

      expect(arquivo.nomeArquivo).toBe('PREVIA_1.zip')
      expect(await arquivo.blob.text()).toBe('PK\u0003\u0004 binario { nao json')
    })

    it('sem Content-Disposition (ou sem nome nele), usa o nome de reserva', async () => {
      fetchFalso.mockResolvedValueOnce(respostaArquivo('%PDF', TIPO_PDF))
      fetchFalso.mockResolvedValueOnce(respostaArquivo('%PDF', TIPO_PDF, null, 'inline'))

      expect((await apiFetchArquivo('/ped/imagens/3/pdf', 'IMG-000003.pdf')).nomeArquivo).toBe('IMG-000003.pdf')
      expect((await apiFetchArquivo('/ped/imagens/3/pdf', 'IMG-000003.pdf')).nomeArquivo).toBe('IMG-000003.pdf')
    })

    it('repassa o signal ao fetch', async () => {
      fetchFalso.mockResolvedValue(respostaArquivo('%PDF', TIPO_PDF, 'a.pdf'))
      const controle = new AbortController()

      await apiFetchArquivo('/ped/imagens/3/pdf', 'a.pdf', { signal: controle.signal })

      expect(fetchFalso.mock.calls[0][1]?.signal).toBe(controle.signal)
    })

    it.each([400, 403, 404])('erro %i em JSON: ApiError com a mensagem do back-end', async (status) => {
      fetchFalso.mockResolvedValue(respostaErro(status, 'mensagem do back-end'))

      const erro = await apiFetchArquivo('/ped/imagens/3/pdf', 'a.pdf').catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status, mensagem: 'mensagem do back-end' })
    })

    it('erro sem mensagem no corpo: mensagem padrão do status', async () => {
      fetchFalso.mockResolvedValue(new Response('', { status: 404 }))

      await expect(apiFetchArquivo('/ped/imagens/9/pdf', 'a.pdf')).rejects.toMatchObject({
        status: 404,
        mensagem: mensagemPadraoPorStatus(404),
      })
    })

    it('401 com token: ApiError 401 e dispara o evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      fetchFalso.mockResolvedValue(respostaJson({ mensagem: 'token expirado' }, 401))

      try {
        await expect(apiFetchArquivo('/ped/imagens/3/pdf', 'a.pdf')).rejects.toMatchObject({ status: 401 })
        expect(ouvinte).toHaveBeenCalledTimes(1)
      } finally {
        window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      }
    })

    it('falha de rede: ApiError(0) com a mensagem de sem conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(apiFetchArquivo('/ped/imagens/3/pdf', 'a.pdf')).rejects.toMatchObject({
        status: 0,
        mensagem: MENSAGEM_SEM_CONEXAO,
      })
    })
  })
})
