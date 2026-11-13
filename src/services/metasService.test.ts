import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { INDICADOR_META_COBERTURA_API, INDICADOR_META_FATURAMENTO_API, janelaMetasApi } from '../test/preenchimentoFalsos'
import type { AjusteMetas, IndicadorMetaPreenchimento, JanelaMetas } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { ajustarMetas, errosDoAjusteMetas, listarMetasPreenchimento } from './metasService'
import { MENSAGEM_FILIAL_OBRIGATORIA, MENSAGEM_MES_INVALIDO } from './preenchimentoService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/metas'

const COBERTURA: IndicadorMetaPreenchimento = {
  id: 12,
  nome: 'Cobertura de clientes',
  tipos: ['Comercial'],
  composicao: { tipo: 'apontamentos', itens: [{ id: 5, nome: 'Visitas a clientes', ativo: true }] },
  sentido: 'maior_melhor',
  metaDoCadastro: 1500,
  metaDoCadastroOrigem: 'geral',
  metaVigente: 2000.25,
  ajustada: true,
}

const FATURAMENTO: IndicadorMetaPreenchimento = {
  id: 13,
  nome: 'Faturamento',
  tipos: ['Comercial'],
  composicao: { tipo: 'dado_externo', itens: [{ id: 3, nome: 'Faturamento', ativo: true }] },
  sentido: 'maior_melhor',
  metaDoCadastro: 500000,
  metaDoCadastroOrigem: 'filial',
  metaVigente: 500000,
  ajustada: false,
}

const AJUSTE: AjusteMetas = {
  filial: '101',
  mesDeReferencia: '2026-10',
  itens: [{ idIndicador: 12, meta: 2000.25, motivo: 'sazonalidade' }],
}

describe('F9.1 — Serviço de metas no preenchimento (RF-71 a RF-74)', () => {
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

  describe('listarMetasPreenchimento({ filial, mesDeReferencia?, tipo? }) — GET /api/ped/metas (janela "Editar metas")', () => {
    it('faz GET /api/ped/metas?filial= com o token e devolve a situação do mês, se é editável e os indicadores convertidos', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(janelaMetasApi()) })

      const janela = await listarMetasPreenchimento({ filial: '101' })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['filial'])
      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(janela).toEqual<JanelaMetas>({ situacaoDoMes: 'aberto', editavel: true, indicadores: [COBERTURA, FATURAMENTO] })
    })

    it('envia mes_de_referencia como "AAAA-MM" e o id do tipo quando informados', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(janelaMetasApi()) })

      await listarMetasPreenchimento({ filial: '101', mesDeReferencia: '2026-09-01', tipo: 2 })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('mes_de_referencia')).toBe('2026-09')
      expect(parametros.get('tipo')).toBe('2')
      expect([...parametros.keys()].sort()).toEqual(['filial', 'mes_de_referencia', 'tipo'])
    })

    it.each(['todas', '', '  '])('filial "%s" rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API', async (filial) => {
      const erro = await listarMetasPreenchimento({ filial }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API', async () => {
      const erro = await listarMetasPreenchimento({ filial: '101', mesDeReferencia: '2026/10' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fechado: editavel false; "editavel" ausente segue a situação do mês', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(janelaMetasApi({ 'situacao do mes': 'fechado', editavel: false })) })
      await expect(listarMetasPreenchimento({ filial: '101', mesDeReferencia: '2026-09' })).resolves.toMatchObject({
        situacaoDoMes: 'fechado',
        editavel: false,
      })

      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ 'situacao do mes': 'aberto', indicadores: [] }) })
      await expect(listarMetasPreenchimento({ filial: '101' })).resolves.toEqual({ situacaoDoMes: 'aberto', editavel: true, indicadores: [] })

      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ 'situacao do mes': 'fechado', indicadores: [] }) })
      await expect(listarMetasPreenchimento({ filial: '101' })).resolves.toMatchObject({ editavel: false })
    })

    it('metas em texto com ponto decimal ("2000.25") viram número; tipos em objeto { id, nome } viram o nome', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            janelaMetasApi({
              indicadores: [
                { ...INDICADOR_META_COBERTURA_API, 'meta do cadastro': '1500.00', 'meta vigente': '2000.25', tipos: [{ id: 1, nome: 'Comercial' }] },
              ],
            }),
          ),
      })

      const janela = await listarMetasPreenchimento({ filial: '101' })

      expect(janela.indicadores[0]).toMatchObject({ metaDoCadastro: 1500, metaVigente: 2000.25, tipos: ['Comercial'] })
    })

    it('campos opcionais ausentes: tipos [], composição, sentido, metas e origem null, ajustada false', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(janelaMetasApi({ indicadores: [{ id: 20, nome: 'Ticket médio' }] })) })

      const janela = await listarMetasPreenchimento({ filial: '101' })

      expect(janela.indicadores).toEqual<IndicadorMetaPreenchimento[]>([
        {
          id: 20,
          nome: 'Ticket médio',
          tipos: [],
          composicao: null,
          sentido: null,
          metaDoCadastro: null,
          metaDoCadastroOrigem: null,
          metaVigente: null,
          ajustada: false,
        },
      ])
    })

    it('"meta do cadastro origem" e sentido desconhecidos viram null, sem rejeitar a lista', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(janelaMetasApi({ indicadores: [{ ...INDICADOR_META_FATURAMENTO_API, 'meta do cadastro origem': 'regional', sentido: 'neutro' }] })),
      })

      const janela = await listarMetasPreenchimento({ filial: '101' })

      expect(janela.indicadores[0]).toMatchObject({ metaDoCadastroOrigem: null, sentido: null })
    })

    it.each([
      ['uma lista pura', [INDICADOR_META_COBERTURA_API]],
      ['um objeto sem indicadores', { 'situacao do mes': 'aberto' }],
      ['sem "situacao do mes"', { indicadores: [] }],
      ['com "situacao do mes" desconhecida', janelaMetasApi({ 'situacao do mes': 'futuro' })],
      ['com indicador sem id', janelaMetasApi({ indicadores: [{ ...INDICADOR_META_COBERTURA_API, id: undefined as unknown as number }] })],
      ['com indicador sem nome', janelaMetasApi({ indicadores: [{ ...INDICADOR_META_COBERTURA_API, nome: undefined as unknown as string }] })],
      ['com meta vigente em formato pt-BR', janelaMetasApi({ indicadores: [{ ...INDICADOR_META_COBERTURA_API, 'meta vigente': '2.000,25' }] })],
      ['com "ajustada" em texto', janelaMetasApi({ indicadores: [{ ...INDICADOR_META_COBERTURA_API, ajustada: 'sim' as unknown as boolean }] })],
    ])('resposta 2xx %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      await expect(listarMetasPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('erros HTTP e de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(400, 'informe a filial') })
      await expect(listarMetasPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 400, mensagem: 'informe a filial' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarMetasPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('ajustarMetas(dados) — PUT /api/ped/metas (RF-73; tudo ou nada; 2xx = gravado)', () => {
    it('envia filial, "mes de referencia" no dia 01 e os itens com a meta como número JSON e o motivo; devolve mensagem e ajustadas', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson({ mensagem: 'metas ajustadas', ajustadas: 1 }) })

      const resultado = await ajustarMetas(AJUSTE)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [{ 'id indicador': 12, meta: 2000.25, motivo: 'sazonalidade' }],
      })
      expect(resultado).toEqual({ mensagem: 'metas ajustadas', ajustadas: 1 })
    })

    it('mês "AAAA-MM-DD" vai como o dia 01; vários itens na ordem recebida', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson({ mensagem: 'metas ajustadas', ajustadas: 2 }) })

      await ajustarMetas({
        filial: '101',
        mesDeReferencia: '2026-10-20',
        itens: [
          { idIndicador: 13, meta: 550000, motivo: 'campanha' },
          { idIndicador: 12, meta: 1800, motivo: 'reforma' },
        ],
      })

      expect(corpoDaChamada(chamadas[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [
          { 'id indicador': 13, meta: 550000, motivo: 'campanha' },
          { 'id indicador': 12, meta: 1800, motivo: 'reforma' },
        ],
      })
    })

    it.each<[string, () => Response]>([
      ['200 só com { mensagem }', () => respostaJson({ mensagem: 'metas ajustadas' })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['um texto solto', () => respostaJson('ok')],
      ['"ajustadas" em texto', () => respostaJson({ ajustadas: 'uma' })],
    ])('2xx com %s resolve sem erro (foi gravado), com ajustadas 0', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: resposta })

      await expect(ajustarMetas(AJUSTE)).resolves.toMatchObject({ ajustadas: 0 })
    })

    it('resposta sem mensagem textual devolve mensagem null', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson({ ajustadas: 1 }) })

      await expect(ajustarMetas(AJUSTE)).resolves.toEqual({ mensagem: null, ajustadas: 1 })
    })

    it.each(['todas', ''])('filial "%s" rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API', async (filial) => {
      const erro = await ajustarMetas({ ...AJUSTE, filial }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API', async () => {
      const erro = await ajustarMetas({ ...AJUSTE, mesDeReferencia: '2026' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('400 (filial sem meta cadastrada, meta igual à vigente, mês fechado) chega como ApiError com a mensagem e os dados', async () => {
      const corpo = { mensagem: 'o indicador nao tem meta cadastrada para a filial 101', erros: [{ 'id indicador': 12, mensagem: 'sem meta para a filial' }] }
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaJson(corpo, 400) })

      const erro = await ajustarMetas(AJUSTE).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'o indicador nao tem meta cadastrada para a filial 101' })
      expect((erro as ApiError).dados).toEqual(corpo)
    })

    it('403 (indicador sem meta editável, meta via API da fonte integracao ou tipo sem acesso) e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}`]: () => respostaErro(403, 'a meta deste indicador nao e editavel') })
      await expect(ajustarMetas(AJUSTE)).rejects.toMatchObject({ status: 403, mensagem: 'a meta deste indicador nao e editavel' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(ajustarMetas(AJUSTE)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('errosDoAjusteMetas(falha) — erros por item do PUT /api/ped/metas', () => {
    it('lê dados.erros: "id indicador" (número ou dígitos em texto; senão null) e mensagem; sem mensagem textual é ignorado', () => {
      const falha = new ApiError(400, 'meta invalida', {
        erros: [
          { 'id indicador': 12, mensagem: 'a nova meta precisa ser diferente da vigente' },
          { 'id indicador': '13', mensagem: 'motivo obrigatorio' },
          { mensagem: 'mes fechado' },
          { 'id indicador': 14 },
        ],
      })

      expect(errosDoAjusteMetas(falha)).toEqual([
        { idIndicador: 12, mensagem: 'a nova meta precisa ser diferente da vigente' },
        { idIndicador: 13, mensagem: 'motivo obrigatorio' },
        { idIndicador: null, mensagem: 'mes fechado' },
      ])
    })

    it.each<[string, unknown]>([
      ['um Error comum', new Error('falhou')],
      ['ApiError sem dados', new ApiError(403, 'sem acesso')],
      ['ApiError sem a lista erros', new ApiError(400, 'meta invalida', { mensagem: 'meta invalida' })],
    ])('%s devolve []', (_caso, falha) => {
      expect(errosDoAjusteMetas(falha)).toEqual([])
    })
  })

  it('GET com corpo null vira ApiError "resposta inválida"', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(null) })

    const erro = await listarMetasPreenchimento({ filial: '101' }).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect((erro as ApiError).mensagem).toBe(MENSAGEM_RESPOSTA_INVALIDA)
  })
})
