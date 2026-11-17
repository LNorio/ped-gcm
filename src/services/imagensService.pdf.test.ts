import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR, TIPO_PDF, TIPO_ZIP, respostaArquivo } from '../test/pdfFalsos'
import { ApiError, EVENTO_SESSAO_EXPIRADA, MENSAGEM_SEM_CONEXAO } from './api'
import { listarImagens, obterPdfImagem, obterZipImagens, type FiltrosImagens } from './imagensService'
import { definirToken, limparToken } from './sessao'

/**
 * F10.10 — PDF e ZIP das imagens congeladas (`src/services/imagensService.ts`), contrato proposto em
 * `docs/backend/PROPOSTA-pdf-imagens.md` (rotas ainda inexistentes no back-end):
 * - `obterPdfImagem(id, opcoes?)` → `GET /api/ped/imagens/{id}/pdf`;
 * - `obterZipImagens(filtros?, opcoes?)` → `GET /api/ped/imagens/zip` com **os mesmos filtros** de
 *   `listarImagens` (`filial`, `periodo`, `dashboard`, `tipo`, `id_colaborador`, `busca`; filial/tipo
 *   "todas" e textos vazios omitidos), para exportar exatamente o que a consulta lista.
 * `opcoes`: `{ nomeReserva?: string; signal?: AbortSignal }`. Devolvem `ArquivoBaixado { blob, nomeArquivo }`
 * com o nome do `Content-Disposition`; sem ele, `opcoes.nomeReserva` ou o padrão (`imagem-{id}.pdf` e
 * `imagens.zip`). Só GET (RN-18). Erros como `ApiError` com a `mensagem`; `401` = sessão expirada.
 */
describe('F10.10 — Serviço: PDF e ZIP das imagens congeladas', () => {
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

  describe('obterPdfImagem', () => {
    it('GET /api/ped/imagens/{id}/pdf com o Bearer; devolve o Blob e o nome do Content-Disposition', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/imagens/3/pdf': () =>
          respostaArquivo('%PDF-1.4 IMG-000003', TIPO_PDF, 'IMG-000003_PED-Gerentes_10-2026_F100_Ana-Souza.pdf'),
      })

      const arquivo = await obterPdfImagem(3)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(arquivo.nomeArquivo).toBe('IMG-000003_PED-Gerentes_10-2026_F100_Ana-Souza.pdf')
      expect(arquivo.blob.type).toBe(TIPO_PDF)
      expect(await arquivo.blob.text()).toBe('%PDF-1.4 IMG-000003')
    })

    it('sem nome no cabeçalho: opcoes.nomeReserva ou "imagem-{id}.pdf"', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/imagens/3/pdf': () => respostaArquivo('%PDF', TIPO_PDF) })

      expect((await obterPdfImagem(3, { nomeReserva: 'IMG-000003.pdf' })).nomeArquivo).toBe('IMG-000003.pdf')
      expect((await obterPdfImagem(3)).nomeArquivo).toBe('imagem-3.pdf')
    })

    it.each([
      [403, 'o validador so ve imagens da propria filial'],
      [404, 'recurso nao encontrado'],
    ])('%i: ApiError com a mensagem do back-end', async (status, mensagem) => {
      fetchFalso.mockResolvedValue(respostaErro(status, mensagem))

      const erro = await obterPdfImagem(3).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status, mensagem })
    })

    it('401: ApiError 401 e evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      fetchFalso.mockResolvedValue(respostaJson({ mensagem: 'token expirado' }, 401))

      try {
        await expect(obterPdfImagem(3)).rejects.toMatchObject({ status: 401 })
        expect(ouvinte).toHaveBeenCalledTimes(1)
      } finally {
        window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      }
    })

    it('falha de rede: ApiError(0, sem conexão)', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(obterPdfImagem(3)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterZipImagens', () => {
    function simularZip() {
      return simularApi(fetchFalso, {
        'GET /api/ped/imagens/zip': () => respostaArquivo('PK zip', TIPO_ZIP, 'IMAGENS_2026-11-17.zip'),
        'GET /api/ped/imagens': () => respostaJson([]),
      })
    }

    it('GET /api/ped/imagens/zip com o Bearer; devolve o Blob e o nome do Content-Disposition', async () => {
      const chamadas = simularZip()

      const arquivo = await obterZipImagens()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe('/api/ped/imagens/zip')
      expect([...chamadas[0].url.searchParams.keys()]).toEqual([])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(arquivo.nomeArquivo).toBe('IMAGENS_2026-11-17.zip')
      expect(arquivo.blob.type).toBe(TIPO_ZIP)
      expect(await arquivo.blob.text()).toBe('PK zip')
    })

    it('envia todos os filtros da consulta na query (filial, periodo, dashboard, tipo, id_colaborador, busca)', async () => {
      const chamadas = simularZip()

      await obterZipImagens({ filial: '100', periodo: '10/2026', dashboard: 2, tipo: 'colaborador', idColaborador: 11, busca: 'ana' })

      expect(Object.fromEntries(chamadas[0].url.searchParams.entries())).toEqual({
        filial: '100',
        periodo: '10/2026',
        dashboard: '2',
        tipo: 'colaborador',
        id_colaborador: '11',
        busca: 'ana',
      })
    })

    it('omite filial e tipo "todas" e textos vazios, como a consulta', async () => {
      const chamadas = simularZip()

      await obterZipImagens({ filial: 'todas', periodo: '', tipo: 'todas', busca: '   ' })

      expect([...chamadas[0].url.searchParams.keys()]).toEqual([])
    })

    it.each<[string, FiltrosImagens]>([
      ['só a filial', { filial: '100' }],
      ['período e tipo', { periodo: '3º tri/2026', tipo: 'filial' }],
      ['tudo', { filial: '102', periodo: '10/2026', dashboard: 2, tipo: 'colaborador', idColaborador: 14, busca: 'diego' }],
      ['filtros "todas"/vazios', { filial: 'todas', tipo: 'todas', busca: '' }],
    ])('mesma query de listarImagens (%s)', async (_caso, filtros) => {
      const chamadas = simularZip()

      await listarImagens(filtros)
      await obterZipImagens(filtros)

      const [lista, zip] = chamadas
      expect(lista.caminho).toBe('/api/ped/imagens')
      expect(zip.caminho).toBe('/api/ped/imagens/zip')
      expect(Object.fromEntries(zip.url.searchParams.entries())).toEqual(Object.fromEntries(lista.url.searchParams.entries()))
    })

    it('sem nome no cabeçalho: opcoes.nomeReserva ou "imagens.zip"', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/imagens/zip': () => respostaArquivo('PK', TIPO_ZIP) })

      expect((await obterZipImagens({}, { nomeReserva: 'IMAGENS_F100.zip' })).nomeArquivo).toBe('IMAGENS_F100.zip')
      expect((await obterZipImagens()).nomeArquivo).toBe('imagens.zip')
    })

    it('400 (nenhuma imagem, filtros inválidos ou outro erro do back-end): ApiError com a mensagem do back-end', async () => {
      // Desde 17/11/2026 o ZIP não tem limite de imagens; um 400 qualquer só repassa a mensagem.
      const outro = 'parametro periodo invalido'
      fetchFalso.mockResolvedValueOnce(respostaErro(400, MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR))
      fetchFalso.mockResolvedValueOnce(respostaErro(400, outro))

      await expect(obterZipImagens({ busca: 'nada' })).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR })
      await expect(obterZipImagens()).rejects.toMatchObject({ status: 400, mensagem: outro })
    })

    it('403: ApiError com a mensagem', async () => {
      fetchFalso.mockResolvedValue(respostaErro(403, 'sem permissao'))

      await expect(obterZipImagens({ filial: '101' })).rejects.toMatchObject({ status: 403, mensagem: 'sem permissao' })
    })

    it('401: evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      fetchFalso.mockResolvedValue(respostaErro(401))

      try {
        await expect(obterZipImagens()).rejects.toMatchObject({ status: 401 })
        expect(ouvinte).toHaveBeenCalledTimes(1)
      } finally {
        window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      }
    })
  })
})
