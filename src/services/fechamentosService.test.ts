import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  MENSAGEM_DASHBOARD_NAO_ATIVO,
  MENSAGEM_ENCERRAMENTO,
  MENSAGEM_TODAS_ENCERRADAS,
  MOTIVO_SEM_FAIXA,
  fechamentosApi,
  previaComercialApi,
  avisoFiliaisSemComposicaoApi,
  respostaEncerramentoApi,
  resumoComercialApi,
  resumoEncerramentoApi,
  resumoNumericoApi,
} from '../test/fechamentosFalsos'
import type { Fechamento, ImagemCongelada, PreviaFechamento, ResultadoEncerramento, ResumoFechamento } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { encerrarFechamento, listarFechamentos, obterPreviaFechamento } from './fechamentosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/fechamentos'

const FECHAMENTO_GERENTES: Fechamento = {
  id: 2,
  nome: 'PED Gerentes',
  tipoVinculo: 'cargos',
  itensVinculados: ['Gerente de Loja'],
  periodicidade: 'mensal',
  periodoAtual: '11/2026',
  situacaoDoPeriodo: 'aberto',
  unidadesDeImagem: 2,
  unidadesEncerradas: 0,
  unidadesComPendencias: 2,
  progresso: { preenchidos: 1, total: 4 },
  indicadoresComProblema: [],
  quantidadeIndicadoresComProblema: 1,
  unidadesSemTabelaDeFaixas: [],
  quantidadeUnidadesSemTabelaDeFaixas: 1,
}

/** Resumo só com contagens (`resumoNumericoApi()`), no formato do domínio. */
const RESUMO_NUMERICO: ResumoFechamento = {
  imagensAGerar: 2,
  unidadesJaEncerradas: { quantidade: 1, unidades: [] },
  unidadesComPendencias: { quantidade: 1, unidades: [] },
  unidadesSemTabelaDeFaixas: { quantidade: 1, unidades: [] },
  avisos: [],
}

const RESUMO_COMERCIAL: ResumoFechamento = {
  imagensAGerar: 2,
  unidadesJaEncerradas: { quantidade: 1, unidades: [] },
  unidadesComPendencias: { quantidade: 1, unidades: ['102'] },
  unidadesSemTabelaDeFaixas: { quantidade: 1, unidades: ['102'] },
  avisos: ['Lançamentos pendentes serão congelados sem valor.', 'Filial 102 sem tabela de faixas: sem pontuação.'],
}

const RESUMO_VAZIO: ResumoFechamento = {
  imagensAGerar: 0,
  unidadesJaEncerradas: { quantidade: 0, unidades: [] },
  unidadesComPendencias: { quantidade: 0, unidades: [] },
  unidadesSemTabelaDeFaixas: { quantidade: 0, unidades: [] },
  avisos: [],
}

/** Imagem da prévia do PED Comercial para a filial 101 (exemplo do negócio), no formato do domínio. */
const IMAGEM_PREVIA_101: ImagemCongelada = {
  id: null,
  codigo: null,
  lote: null,
  chave: 'filial:101',
  tipo: 'filial',
  idColaborador: null,
  dashboard: {
    id: 1,
    nome: 'PED Comercial',
    periodicidade: 'trimestral',
    pontuacaoMaxima: 100,
    tipoVinculo: 'filiais',
    formulaDePontuacao: 'Base de cálculo × PED (%) ÷ 100',
  },
  periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
  unidade: { filial: '101', nomeFilial: 'CAMPO GRANDE', colaborador: null, cargo: null },
  resultadoOperacional: { indicador: 'Faturamento', valor: 451590.62, observacao: 'Realizado do indicador base da faixa' },
  pedPercentual: 99.99,
  pontosBaseTotal: 100,
  indicadores: [
    {
      indicador: 'Faturamento',
      meta: 400000,
      realizado: 451590.62,
      coletaDisponivel: true,
      atingimento: 112.9,
      pontosBase: 60,
      pontosRealizados: 60,
      observacao: 'Pontos limitados aos pontos base',
    },
    {
      indicador: 'Cobertura de clientes',
      meta: 80,
      realizado: 79.98,
      coletaDisponivel: true,
      atingimento: 99.98,
      pontosBase: 40,
      pontosRealizados: 39.99,
      observacao: null,
    },
  ],
  pontuacao: {
    calculada: true,
    motivo: null,
    faixaAtual: { de: 400000, ate: 600000, aliquota: 1.95 },
    faixaAnterior: { de: 0, ate: 399999.99, aliquota: 2.21 },
    aliquotaAnterior: 2.21,
    aliquotaAtual: 1.95,
    pisoDaFaixa: 400000,
    opcaoA: 8840,
    opcaoB: 8806.02,
    opcaoSelecionada: 'A',
    baseDeCalculo: 8840,
    valor: 8839.12,
  },
  faixas: {
    nome: 'Resultado operacional',
    versao: 2,
    linhas: [
      { de: 0, ate: 399999.99, aliquota: 2.21 },
      { de: 400000, ate: 600000, aliquota: 1.95 },
      { de: 600000.01, ate: 1000000, aliquota: 1.5 },
    ],
  },
  pendencias: [],
  avisos: [],
  geradoEm: null,
  usuario: null,
}

/**
 * F10.1 — Serviço dos fechamentos (`src/services/fechamentosService.ts`), contrato de
 * `docs/backend/API (28).md`, seção "fase 7: fechamentos, cálculo e imagens congeladas":
 * - `listarFechamentos(filtros?)` → `GET /api/ped/fechamentos?periodicidade=&situacao=&busca=`
 *   (lista pura ou `{ fechamentos }`; cada linha pelo adaptador `paraFechamento` da F1.3);
 * - `obterPreviaFechamento(id)` → `GET /api/ped/fechamentos/{id}/previa` (nada é gravado);
 * - `encerrarFechamento(id)` → `POST /api/ped/fechamentos/{id}/encerrar`, sem corpo; regra
 *   "2xx = gravado". Desde 17/11/2026 (`docs/backend/FRONT-pdf-fechamento.md`; `API (29).md`, "Prévia e
 *   encerramento"), o `resumo` do encerramento traz `"filiais sem composicao"` (códigos em texto ou
 *   número; `[]` quando todas têm composição; só o encerramento traz o campo): vai para
 *   `ResultadoEncerramento.filiaisSemComposicao: string[]` (números viram texto; ausente ou fora do
 *   formato = `[]`; itens que não são texto nem número são ignorados). `ResumoFechamento` não muda: a
 *   linha a mais em `resumo.avisos` continua em `resumo.avisos`, como veio.
 * Erros HTTP e de rede chegam como `ApiError` sem alteração; leituras 2xx fora do formato viram
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`.
 */
describe('F10.1 — Serviço dos fechamentos: lista, prévia e encerramento (RF-77 a RF-82)', () => {
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

  describe('listarFechamentos(filtros?) — GET /api/ped/fechamentos (RF-78, RF-79)', () => {
    it('sem filtros faz GET sem query, com o token, e devolve as linhas convertidas na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(fechamentosApi()) })

      const fechamentos = await listarFechamentos()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect([...chamadas[0].url.searchParams.keys()]).toEqual([])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(fechamentos.map((f) => f.nome)).toEqual(['PED Gerentes', 'PED Comercial', 'PED Vendedores'])
      expect(fechamentos[0]).toEqual(FECHAMENTO_GERENTES)
      expect(fechamentos[2]).toMatchObject({ situacaoDoPeriodo: 'encerrado', unidadesEncerradas: 2, itensVinculados: ['12', '13'] })
    })

    it('aceita a lista envolvida em { fechamentos }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ fechamentos: [FECHAMENTO_GERENTES_API] }) })

      await expect(listarFechamentos()).resolves.toEqual([FECHAMENTO_GERENTES])
    })

    it('envia periodicidade, situacao e busca na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([FECHAMENTO_COMERCIAL_API]) })

      await listarFechamentos({ periodicidade: 'trimestral', situacao: 'encerrado', busca: 'comercial' })

      const parametros = chamadas[0].url.searchParams
      expect([...parametros.keys()].sort()).toEqual(['busca', 'periodicidade', 'situacao'])
      expect(parametros.get('periodicidade')).toBe('trimestral')
      expect(parametros.get('situacao')).toBe('encerrado')
      expect(parametros.get('busca')).toBe('comercial')
    })

    it('"todas" na periodicidade e na situação e busca vazia ou só com espaços não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarFechamentos({ periodicidade: 'todas', situacao: 'todas', busca: '' })
      await listarFechamentos({ busca: '   ' })

      for (const chamada of chamadas) expect([...chamada.url.searchParams.keys()]).toEqual([])
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await expect(listarFechamentos()).resolves.toEqual([])
    })

    it('linha só com os campos obrigatórios: contagens 0, progresso 0 de 0 e listas vazias', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            {
              id: 9,
              nome: 'PED Novo',
              'tipo de vinculo': 'filiais',
              periodicidade: 'bimestral',
              'periodo atual': '6º bim/2026',
              'situacao do periodo': 'aberto',
            },
          ]),
      })

      await expect(listarFechamentos()).resolves.toEqual<Fechamento[]>([
        {
          id: 9,
          nome: 'PED Novo',
          tipoVinculo: 'filiais',
          itensVinculados: [],
          periodicidade: 'bimestral',
          periodoAtual: '6º bim/2026',
          situacaoDoPeriodo: 'aberto',
          unidadesDeImagem: 0,
          unidadesEncerradas: 0,
          unidadesComPendencias: 0,
          progresso: { preenchidos: 0, total: 0 },
          indicadoresComProblema: [],
          quantidadeIndicadoresComProblema: 0,
          unidadesSemTabelaDeFaixas: [],
          quantidadeUnidadesSemTabelaDeFaixas: 0,
        },
      ])
    })

    it('"indicadores com problema" e "unidades sem tabela de faixas" como números (formato real de 16/11/2026) viram as quantidades, com as listas vazias', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            { ...FECHAMENTO_GERENTES_API, 'indicadores com problema': 3, 'unidades sem tabela de faixas': 2 },
            { ...FECHAMENTO_COMERCIAL_API, 'indicadores com problema': 0, 'unidades sem tabela de faixas': 0 },
          ]),
      })

      const [gerentes, comercial] = await listarFechamentos()

      expect(gerentes).toMatchObject({
        indicadoresComProblema: [],
        quantidadeIndicadoresComProblema: 3,
        unidadesSemTabelaDeFaixas: [],
        quantidadeUnidadesSemTabelaDeFaixas: 2,
      })
      expect(comercial).toMatchObject({
        indicadoresComProblema: [],
        quantidadeIndicadoresComProblema: 0,
        unidadesSemTabelaDeFaixas: [],
        quantidadeUnidadesSemTabelaDeFaixas: 0,
      })
    })

    it('formato antigo (listas) continua aceito: a quantidade é o tamanho da lista e os nomes e códigos ficam disponíveis', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            {
              ...FECHAMENTO_GERENTES_API,
              'indicadores com problema': ['Custo de frete por entrega', 'Ticket médio'],
              'unidades sem tabela de faixas': ['102'],
            },
          ]),
      })

      const [fechamento] = await listarFechamentos()

      expect(fechamento).toMatchObject({
        indicadoresComProblema: ['Custo de frete por entrega', 'Ticket médio'],
        quantidadeIndicadoresComProblema: 2,
        unidadesSemTabelaDeFaixas: ['102'],
        quantidadeUnidadesSemTabelaDeFaixas: 1,
      })
    })

    it('"indicadores com problema" como objetos { indicador, motivo } viram os nomes; filiais sem faixas numéricas viram texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            {
              ...FECHAMENTO_GERENTES_API,
              'indicadores com problema': [{ indicador: 'Custo de frete por entrega', motivo: 'Indicador inativo' }],
              'unidades sem tabela de faixas': [102, '103'],
            },
          ]),
      })

      const [fechamento] = await listarFechamentos()

      expect(fechamento.indicadoresComProblema).toEqual(['Custo de frete por entrega'])
      expect(fechamento.quantidadeIndicadoresComProblema).toBe(1)
      expect(fechamento.unidadesSemTabelaDeFaixas).toEqual(['102', '103'])
      expect(fechamento.quantidadeUnidadesSemTabelaDeFaixas).toBe(2)
    })

    it.each([
      ['um objeto sem a lista', { total: 3 }],
      ['um texto', 'nada'],
      ['uma linha sem id', [{ ...FECHAMENTO_COMERCIAL_API, id: undefined }]],
      ['uma linha sem nome', [{ ...FECHAMENTO_COMERCIAL_API, nome: undefined }]],
      ['periodicidade desconhecida', [{ ...FECHAMENTO_COMERCIAL_API, periodicidade: 'quinzenal' }]],
      ['situação do período desconhecida', [{ ...FECHAMENTO_COMERCIAL_API, 'situacao do periodo': 'fechado' }]],
      ['tipo de vínculo desconhecido', [{ ...FECHAMENTO_COMERCIAL_API, 'tipo de vinculo': 'zonas' }]],
      ['"unidades de imagem" em texto', [{ ...FECHAMENTO_COMERCIAL_API, 'unidades de imagem': 'três' }]],
      ['progresso sem números', [{ ...FECHAMENTO_COMERCIAL_API, progresso: { preenchidos: 'cinco', total: 6 } }]],
      ['"indicadores com problema" em texto não numérico', [{ ...FECHAMENTO_COMERCIAL_API, 'indicadores com problema': 'muitos' }]],
      ['"indicadores com problema" como objeto', [{ ...FECHAMENTO_COMERCIAL_API, 'indicadores com problema': { total: 1 } }]],
      ['"unidades sem tabela de faixas" em texto não numérico', [{ ...FECHAMENTO_COMERCIAL_API, 'unidades sem tabela de faixas': 'duas' }]],
      ['"unidades sem tabela de faixas" como objeto', [{ ...FECHAMENTO_COMERCIAL_API, 'unidades sem tabela de faixas': { total: 1 } }]],
    ])('resposta 2xx com %s vira ApiError "resposta inválida" (um item inválido rejeita a lista)', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      await expect(listarFechamentos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Preenchedor) chega como ApiError com a mensagem da API; falha de rede vira ApiError de conexão', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'sem permissao') })
      await expect(listarFechamentos()).rejects.toMatchObject({ status: 403, mensagem: 'sem permissao' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarFechamentos()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterPreviaFechamento(id) — GET /api/ped/fechamentos/{id}/previa (RF-80)', () => {
    it('faz só um GET (nada é gravado) e devolve dashboard, período, resumo e as imagens a gerar convertidas', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/previa`]: () => respostaJson(previaComercialApi()) })

      const previa = await obterPreviaFechamento(1)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/previa`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(previa).toEqual<PreviaFechamento>({
        dashboard: IMAGEM_PREVIA_101.dashboard,
        periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
        resumo: RESUMO_COMERCIAL,
        imagens: [IMAGEM_PREVIA_101, expect.objectContaining({ chave: 'filial:102' }) as ImagemCongelada],
        // Sem resumo."progresso por filial" na resposta: lista vazia (resposta de 25/11/2026).
        progressoPorFilial: [],
      })
    })

    it('imagem sem tabela de faixas: pontuação não calculada com o motivo, sem faixas; sem meta e pendente ficam sem valor (RN-09)', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/previa`]: () => respostaJson(previaComercialApi()) })

      const { imagens } = await obterPreviaFechamento(1)
      const semFaixa = imagens[1]

      expect(semFaixa).toMatchObject({ codigo: null, tipo: 'filial', unidade: { filial: '102', nomeFilial: 'DOURADOS' }, faixas: null })
      expect(semFaixa.pontuacao).toEqual({
        calculada: false,
        motivo: MOTIVO_SEM_FAIXA,
        faixaAtual: null,
        faixaAnterior: null,
        aliquotaAnterior: null,
        aliquotaAtual: null,
        pisoDaFaixa: null,
        opcaoA: null,
        opcaoB: null,
        opcaoSelecionada: null,
        baseDeCalculo: null,
        valor: null,
      })
      expect(semFaixa.indicadores.map((i) => [i.meta, i.realizado, i.atingimento, i.pontosRealizados])).toEqual([
        [null, 320000, null, null],
        [80, null, null, null],
      ])
      expect(semFaixa.pendencias).toEqual(['Visitas a clientes (4º tri/2026): sem lançamento'])
      expect(semFaixa.avisos).toEqual(['Filial 102 sem tabela de faixas: sem pontuação'])
    })

    it('aceita cada imagem como { chave, imagem: { ...conteúdo } }', async () => {
      const api = previaComercialApi()
      const envolvidas = api.imagens.map(({ chave, ...conteudo }) => ({ chave, imagem: conteudo }))
      simularApi(fetchFalso, { [`GET ${ROTA}/1/previa`]: () => respostaJson({ ...api, imagens: envolvidas }) })

      const previa = await obterPreviaFechamento(1)

      expect(previa.imagens[0]).toEqual(IMAGEM_PREVIA_101)
      expect(previa.imagens[1].chave).toBe('filial:102')
    })

    it('resumo: contagens numéricas ou listas (códigos em texto, número ou { filial }) viram { quantidade, unidades }', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/previa`]: () =>
          respostaJson({
            ...previaComercialApi(),
            resumo: {
              'imagens a gerar': 3,
              'unidades ja encerradas': ['100'],
              'unidades com pendencias': 2,
              'unidades sem tabela de faixas': [102, { filial: '103' }],
              avisos: [{ mensagem: 'Aviso em objeto' }, 'Aviso em texto'],
            },
          }),
      })

      await expect(obterPreviaFechamento(1)).resolves.toMatchObject({
        resumo: {
          imagensAGerar: 3,
          unidadesJaEncerradas: { quantidade: 1, unidades: ['100'] },
          unidadesComPendencias: { quantidade: 2, unidades: [] },
          unidadesSemTabelaDeFaixas: { quantidade: 2, unidades: ['102', '103'] },
          avisos: ['Aviso em objeto', 'Aviso em texto'],
        },
      })
    })

    it('resumo só com contagens numéricas (inclusive "unidades com pendencias" e "unidades sem tabela de faixas") vira as quantidades sem códigos; "indicadores com problema" no resumo é ignorado', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/previa`]: () => respostaJson({ ...previaComercialApi(), resumo: resumoNumericoApi() }),
      })

      const previa = await obterPreviaFechamento(1)

      expect(previa.resumo).toEqual<ResumoFechamento>(RESUMO_NUMERICO)
      expect(previa.imagens).toHaveLength(2)
    })

    it('campos ausentes: sem resumo (imagens a gerar = nº de imagens), dashboard null, período em texto e sem imagens = []', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/previa`]: () => respostaJson({ periodo: '4º tri/2026', imagens: previaComercialApi().imagens }),
        [`GET ${ROTA}/6/previa`]: () => respostaJson({}),
      })

      const previa = await obterPreviaFechamento(1)
      expect(previa.dashboard).toBeNull()
      expect(previa.periodo).toEqual({ codigo: '4º tri/2026', inicio: null, fim: null })
      expect(previa.resumo).toEqual<ResumoFechamento>({ ...RESUMO_VAZIO, imagensAGerar: 2 })
      expect(previa.imagens).toHaveLength(2)

      await expect(obterPreviaFechamento(6)).resolves.toEqual<PreviaFechamento>({
        dashboard: null,
        periodo: null,
        resumo: RESUMO_VAZIO,
        imagens: [],
        progressoPorFilial: [],
      })
    })

    it.each([
      ['uma lista', []],
      ['um texto', 'nada'],
      ['"imagens" que não é lista', { ...previaComercialApi(), imagens: { chave: 'filial:101' } }],
      ['uma imagem que não é objeto', { ...previaComercialApi(), imagens: ['filial:101'] }],
      [
        'um indicador com número em formato pt-BR',
        (() => {
          const api = previaComercialApi()
          ;(api.imagens[0].indicadores[0] as unknown as Record<string, unknown>).realizado = '451.590,62'
          return api
        })(),
      ],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/previa`]: () => respostaJson(corpo) })

      await expect(obterPreviaFechamento(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('400 (dashboard não ativo — RN-17), 403 e 404 chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/4/previa`]: () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO),
        [`GET ${ROTA}/5/previa`]: () => respostaErro(403, 'sem permissao'),
      })

      await expect(obterPreviaFechamento(4)).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_DASHBOARD_NAO_ATIVO })
      await expect(obterPreviaFechamento(5)).rejects.toMatchObject({ status: 403, mensagem: 'sem permissao' })
      await expect(obterPreviaFechamento(99)).rejects.toBeInstanceOf(ApiError)
      await expect(obterPreviaFechamento(99)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('encerrarFechamento(id) — POST /api/ped/fechamentos/{id}/encerrar (RF-77, RF-81, RF-82)', () => {
    it('faz POST sem corpo, com o token, e devolve lote, período, imagens geradas, resumo e mensagem', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}/1/encerrar`]: () => respostaJson(respostaEncerramentoApi()) })

      const resultado = await encerrarFechamento(1)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/encerrar`)
      expect(chamadas[0].init?.body ?? undefined).toBeUndefined()
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(resultado).toEqual<ResultadoEncerramento>({
        mensagem: MENSAGEM_ENCERRAMENTO,
        lote: 'ENC-000003',
        periodo: { codigo: '4º tri/2026', inicio: null, fim: null },
        imagensGeradas: 2,
        codigosDasImagens: [],
        resumo: RESUMO_COMERCIAL,
        filiaisSemComposicao: [],
      })
    })

    it('"filiais sem composicao" (texto ou número) vira filiaisSemComposicao em texto; a linha a mais fica em resumo.avisos', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/1/encerrar`]: () =>
          respostaJson(respostaEncerramentoApi({ resumo: resumoEncerramentoApi(resumoComercialApi(), ['100', 101]) }), 201),
      })

      const resultado = await encerrarFechamento(1)

      expect(resultado.filiaisSemComposicao).toEqual(['100', '101'])
      expect(resultado.resumo).toEqual<ResumoFechamento>({
        ...RESUMO_COMERCIAL,
        avisos: [...RESUMO_COMERCIAL.avisos, avisoFiliaisSemComposicaoApi(['100', 101])],
      })
      expect(resultado.resumo).not.toHaveProperty('filiaisSemComposicao')
    })

    it.each([
      ['ausente (resposta anterior a 17/11)', undefined],
      ['lista vazia', []],
      ['fora do formato (texto)', 'nenhuma'],
      ['null', null],
    ])('"filiais sem composicao" %s vira []', async (_caso, valor) => {
      const resumo: Record<string, unknown> = { ...resumoComercialApi() }
      if (valor !== undefined) resumo['filiais sem composicao'] = valor
      simularApi(fetchFalso, { [`POST ${ROTA}/1/encerrar`]: () => respostaJson({ ...respostaEncerramentoApi(), resumo }, 201) })

      const resultado = await encerrarFechamento(1)

      expect(resultado.filiaisSemComposicao).toEqual([])
      expect(resultado.resumo).toEqual(RESUMO_COMERCIAL)
    })

    it('itens de "filiais sem composicao" que não são texto nem número são ignorados', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/1/encerrar`]: () =>
          respostaJson({ ...respostaEncerramentoApi(), resumo: { ...resumoComercialApi(), 'filiais sem composicao': ['100', null, { filial: 1 }, 102] } }, 201),
      })

      await expect(encerrarFechamento(1)).resolves.toMatchObject({ filiaisSemComposicao: ['100', '102'] })
    })

    it('resumo só com contagens numéricas vira as quantidades sem códigos', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/1/encerrar`]: () => respostaJson({ ...respostaEncerramentoApi(), resumo: resumoNumericoApi() }),
      })

      await expect(encerrarFechamento(1)).resolves.toMatchObject({ imagensGeradas: 2, resumo: RESUMO_NUMERICO })
    })

    it('"imagens geradas" como lista de códigos ou de objetos { codigo } dá a quantidade e os códigos; período como objeto', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/1/encerrar`]: () =>
          respostaJson({
            ...respostaEncerramentoApi(),
            periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
            'imagens geradas': ['IMG-000005', { id: 6, codigo: 'IMG-000006' }],
          }),
        [`POST ${ROTA}/2/encerrar`]: () => respostaJson({ ...respostaEncerramentoApi(), 'imagens geradas': [] }),
      })

      await expect(encerrarFechamento(1)).resolves.toMatchObject({
        periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
        imagensGeradas: 2,
        codigosDasImagens: ['IMG-000005', 'IMG-000006'],
      })
      await expect(encerrarFechamento(2)).resolves.toMatchObject({ imagensGeradas: 0, codigosDasImagens: [] })
    })

    it.each([
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['201 só com a mensagem', () => respostaJson({ mensagem: MENSAGEM_ENCERRAMENTO }, 201)],
      ['200 com uma lista', () => respostaJson(['IMG-000005'])],
      ['200 com um texto', () => respostaJson('ok')],
      ['200 com lote e resumo fora do formato', () => respostaJson({ lote: 15, resumo: 'nada', 'imagens geradas': 'duas' })],
    ])('regra "2xx = gravado": %s resolve sem erro, com os campos desconhecidos vazios', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}/1/encerrar`]: resposta })

      const resultado = await encerrarFechamento(1)

      expect(resultado).toMatchObject({
        lote: null,
        periodo: null,
        imagensGeradas: 0,
        codigosDasImagens: [],
        resumo: RESUMO_VAZIO,
        filiaisSemComposicao: [],
      })
      expect(resultado.mensagem === null || resultado.mensagem === MENSAGEM_ENCERRAMENTO).toBe(true)
    })

    it('400 (todas as unidades já encerradas; dashboard não ativo) chega como ApiError com a mensagem da API, sem repetir a chamada', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}/6/encerrar`]: () => respostaErro(400, MENSAGEM_TODAS_ENCERRADAS),
        [`POST ${ROTA}/4/encerrar`]: () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO),
      })

      await expect(encerrarFechamento(6)).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_TODAS_ENCERRADAS })
      await expect(encerrarFechamento(4)).rejects.toMatchObject({ status: 400, mensagem: MENSAGEM_DASHBOARD_NAO_ATIVO })
      expect(chamadas).toHaveLength(2)
    })

    it('403 e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}/1/encerrar`]: () => respostaErro(403, 'sem permissao') })
      await expect(encerrarFechamento(1)).rejects.toMatchObject({ status: 403, mensagem: 'sem permissao' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(encerrarFechamento(1)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
