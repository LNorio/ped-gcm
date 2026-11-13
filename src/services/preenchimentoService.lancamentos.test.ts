import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { historicoApontamentoApi } from '../test/preenchimentoFalsos'
import type { HistoricoLancamento, Preenchimento } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import {
  MENSAGEM_FILIAL_OBRIGATORIA,
  MENSAGEM_MES_INVALIDO,
  errosDoPreenchimento,
  listarHistoricoApontamento,
  salvarPreenchimento,
} from './preenchimentoService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/preenchimento'
const ROTA_HISTORICO_9 = '/api/ped/apontamentos/9/historico'

const LOTE: Preenchimento = {
  filial: '101',
  mesDeReferencia: '2026-10',
  itens: [
    { idApontamento: 5, valor: 1234.56 },
    { idApontamento: 7, valor: true },
    { idApontamento: 9, valor: 80, motivo: 'digitação errada' },
  ],
}

describe('F9.1 — Serviço do preenchimento: lançamento/correção em lote e histórico (RF-66 a RF-69)', () => {
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

  describe('salvarPreenchimento(dados) — PUT /api/ped/preenchimento (lote tudo ou nada; 2xx = gravado)', () => {
    it('envia filial, "mes de referencia" no dia 01 e os itens; números e booleanos vão como JSON (já convertidos), motivo só na correção', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}`]: () => respostaJson({ mensagem: 'preenchimento salvo', lancados: 2, corrigidos: 1 }),
      })

      const resultado = await salvarPreenchimento(LOTE)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [
          { 'id apontamento': 5, valor: 1234.56 },
          { 'id apontamento': 7, valor: true },
          { 'id apontamento': 9, valor: 80, motivo: 'digitação errada' },
        ],
      })
      expect(resultado).toEqual({ mensagem: 'preenchimento salvo', lancados: 2, corrigidos: 1 })
    })

    it('mês informado como "AAAA-MM-DD" vai como o dia 01; booleano false e valor 0 são enviados', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson({ mensagem: 'preenchimento salvo', lancados: 2, corrigidos: 0 }) })

      await salvarPreenchimento({
        filial: '101',
        mesDeReferencia: '2026-10-15',
        itens: [
          { idApontamento: 7, valor: false },
          { idApontamento: 5, valor: 0 },
        ],
      })

      expect(corpoDaChamada(chamadas[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [
          { 'id apontamento': 7, valor: false },
          { 'id apontamento': 5, valor: 0 },
        ],
      })
    })

    it.each<[string, () => Response]>([
      ['200 só com { mensagem }', () => respostaJson({ mensagem: 'preenchimento salvo' })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['um texto solto', () => respostaJson('ok')],
      ['contagens em texto', () => respostaJson({ lancados: 'dois', corrigidos: null })],
    ])('2xx com %s resolve sem erro (foi gravado), com contagens ausentes ou inválidas em 0', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: resposta })

      const resultado = await salvarPreenchimento(LOTE)

      expect(resultado).toMatchObject({ lancados: 0, corrigidos: 0 })
    })

    it('resposta sem mensagem textual devolve mensagem null', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson({ lancados: 3, corrigidos: 0 }) })

      await expect(salvarPreenchimento(LOTE)).resolves.toEqual({ mensagem: null, lancados: 3, corrigidos: 0 })
    })

    it.each(['todas', '', '  '])('filial "%s" rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API', async (filial) => {
      const erro = await salvarPreenchimento({ ...LOTE, filial }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API', async () => {
      const erro = await salvarPreenchimento({ ...LOTE, mesDeReferencia: '10/2026' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('400 (lote recusado: nada é gravado) chega como ApiError com a mensagem e os erros por item em dados', async () => {
      const corpo = {
        mensagem: 'a correcao exige motivo',
        erros: [
          { 'id apontamento': 9, mensagem: 'a correcao exige motivo' },
          { 'id apontamento': 5, mensagem: 'valor nao pode ser negativo' },
        ],
      }
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson(corpo, 400) })

      const erro = await salvarPreenchimento(LOTE).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'a correcao exige motivo' })
      expect((erro as ApiError).dados).toEqual(corpo)
    })

    it('403 (apontamento de tipo sem acesso) e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaErro(403, 'apontamento de tipo sem acesso') })
      await expect(salvarPreenchimento(LOTE)).rejects.toMatchObject({ status: 403, mensagem: 'apontamento de tipo sem acesso' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(salvarPreenchimento(LOTE)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('errosDoPreenchimento(falha) — erros por item do 400/403 do lote', () => {
    it('lê dados.erros na ordem devolvida: "id apontamento" (número ou dígitos em texto) e mensagem', () => {
      const falha = new ApiError(400, 'valor invalido', {
        mensagem: 'valor invalido',
        erros: [
          { 'id apontamento': 9, mensagem: 'a correcao exige motivo' },
          { 'id apontamento': '5', mensagem: 'valor nao pode ser negativo' },
        ],
      })

      expect(errosDoPreenchimento(falha)).toEqual([
        { idApontamento: 9, mensagem: 'a correcao exige motivo' },
        { idApontamento: 5, mensagem: 'valor nao pode ser negativo' },
      ])
    })

    it('item sem "id apontamento" reconhecível fica com idApontamento null; item sem mensagem textual é ignorado', () => {
      const falha = new ApiError(400, 'mes fechado', {
        erros: [{ mensagem: 'mes fechado para preenchimento' }, { 'id apontamento': 'abc', mensagem: 'apontamento repetido no lote' }, { 'id apontamento': 7 }],
      })

      expect(errosDoPreenchimento(falha)).toEqual([
        { idApontamento: null, mensagem: 'mes fechado para preenchimento' },
        { idApontamento: null, mensagem: 'apontamento repetido no lote' },
      ])
    })

    it.each<[string, unknown]>([
      ['um Error comum', new Error('falhou')],
      ['ApiError sem dados', new ApiError(400, 'valor invalido')],
      ['ApiError sem a lista erros', new ApiError(400, 'valor invalido', { mensagem: 'valor invalido' })],
      ['ApiError com erros fora de lista', new ApiError(400, 'valor invalido', { erros: 'muitos' })],
      ['undefined', undefined],
    ])('%s devolve []', (_caso, falha) => {
      expect(errosDoPreenchimento(falha)).toEqual([])
    })
  })

  describe('listarHistoricoApontamento(id, { filial, mesDeReferencia }) — GET /api/ped/apontamentos/{id}/historico (RF-69)', () => {
    it('faz GET .../apontamentos/{id}/historico?filial=&mes_de_referencia=AAAA-MM e devolve as linhas convertidas, na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA_HISTORICO_9}`]: () => respostaJson(historicoApontamentoApi()) })

      const historico = await listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10-01' })

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA_HISTORICO_9)
      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect(chamadas[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10')
      expect([...chamadas[0].url.searchParams.keys()].sort()).toEqual(['filial', 'mes_de_referencia'])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(historico).toEqual<HistoricoLancamento[]>([
        { data: '2026-10-20 10:00:00', acao: 'correcao', valorAnterior: 75, valorNovo: 80, usuario: 'Ana Costa', motivo: 'digitação errada' },
        { data: '2026-10-05 09:00:00', acao: 'lancamento', valorAnterior: null, valorNovo: 75, usuario: 'Fulano', motivo: null },
      ])
    })

    it('aceita { historico: [...] }; valores booleanos e números em texto com ponto decimal; campos ausentes viram null', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA_HISTORICO_9}`]: () =>
          respostaJson({
            historico: [
              { acao: 'correcao', 'valor anterior': false, 'valor novo': true, usuario: 'Ana Costa', motivo: 'conferido', data: '2026-10-21 08:00:00' },
              { acao: 'lancamento', 'valor novo': '12.50', data: '2026-10-02 08:00:00' },
            ],
          }),
      })

      await expect(listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10' })).resolves.toEqual<HistoricoLancamento[]>([
        { data: '2026-10-21 08:00:00', acao: 'correcao', valorAnterior: false, valorNovo: true, usuario: 'Ana Costa', motivo: 'conferido' },
        { data: '2026-10-02 08:00:00', acao: 'lancamento', valorAnterior: null, valorNovo: 12.5, usuario: null, motivo: null },
      ])
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA_HISTORICO_9}`]: () => respostaJson([]) })

      await expect(listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10' })).resolves.toEqual([])
    })

    it.each(['todas', ''])('filial "%s" rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API', async (filial) => {
      const erro = await listarHistoricoApontamento(9, { filial, mesDeReferencia: '2026-10' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API', async () => {
      const erro = await listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: 'outubro' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['uma linha com ação desconhecida', [{ acao: 'exclusao', 'valor novo': 1, data: '2026-10-02 08:00:00' }]],
      ['uma linha sem data', [{ acao: 'lancamento', 'valor novo': 1 }]],
      ['uma linha com valor em formato pt-BR', [{ acao: 'lancamento', 'valor novo': '1.234,56', data: '2026-10-02 08:00:00' }]],
      ['uma linha com usuário numérico', [{ acao: 'lancamento', 'valor novo': 1, usuario: 12, data: '2026-10-02 08:00:00' }]],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA_HISTORICO_9}`]: () => respostaJson(corpo) })

      await expect(listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10' })).rejects.toMatchObject({
        status: 200,
        mensagem: MENSAGEM_RESPOSTA_INVALIDA,
      })
    })

    it('403 e 404 chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA_HISTORICO_9}`]: () => respostaErro(403, 'apontamento de tipo sem acesso') })
      await expect(listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10' })).rejects.toMatchObject({
        status: 403,
        mensagem: 'apontamento de tipo sem acesso',
      })

      simularApi(fetchFalso, { [`GET ${ROTA_HISTORICO_9}`]: () => respostaErro(404, 'apontamento nao encontrado') })
      await expect(listarHistoricoApontamento(9, { filial: '101', mesDeReferencia: '2026-10' })).rejects.toMatchObject({
        status: 404,
        mensagem: 'apontamento nao encontrado',
      })
    })
  })
})
