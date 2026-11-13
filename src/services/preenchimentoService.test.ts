import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  APONTAMENTO_INADIMPLENCIA_API,
  APONTAMENTO_VISITAS_API,
  APONTAMENTO_VITRINE_API,
  mesesPreenchimentoApi,
  telaMesFechadoApi,
  telaPreenchimentoApi,
} from '../test/preenchimentoFalsos'
import type { ApontamentoPreenchimento, MesPreenchimento, TelaPreenchimento } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  MENSAGEM_ANO_INVALIDO,
  MENSAGEM_FILIAL_OBRIGATORIA,
  MENSAGEM_MES_INVALIDO,
  listarMesesPreenchimento,
  obterPreenchimento,
} from './preenchimentoService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

const VISITAS: ApontamentoPreenchimento = {
  id: 5,
  nome: 'Visitas a clientes',
  descricao: 'Visitas feitas no mês',
  tipoValor: 'numeral',
  situacao: 'preenchido',
  valor: 1234.56,
  indicadores: [{ id: null, nome: 'Cobertura de clientes' }],
  dashboards: [{ id: 1, nome: 'PED Comercial', periodicidade: 'mensal' }],
  imagensCongeladas: [],
}

const VITRINE: ApontamentoPreenchimento = {
  id: 7,
  nome: 'Vitrine montada',
  descricao: null,
  tipoValor: 'booleano',
  situacao: 'pendente',
  valor: null,
  indicadores: [],
  dashboards: [],
  imagensCongeladas: [],
}

const INADIMPLENCIA: ApontamentoPreenchimento = {
  id: 9,
  nome: 'Inadimplência',
  descricao: null,
  tipoValor: 'porcentagem',
  situacao: 'corrigido',
  valor: 80,
  indicadores: [{ id: null, nome: 'Inadimplência' }],
  dashboards: [{ id: 2, nome: 'PED Gerentes', periodicidade: 'trimestral' }],
  imagensCongeladas: [{ codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' }],
}

const TELA_OUTUBRO: TelaPreenchimento = {
  filial: '101',
  nomeFilial: 'CAMPO GRANDE',
  mesDeReferencia: '2026-10-01',
  situacaoDoMes: 'aberto',
  editavel: true,
  periodoAberto: '2026-10-01',
  abertoPor: 'Ana Costa',
  abertoEm: '2026-10-01 08:00:00',
  progresso: { preenchidos: 2, total: 3 },
  tipos: [
    { id: 1, nome: 'Comercial', quantidade: 2, apontamentos: [VISITAS, VITRINE] },
    { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [INADIMPLENCIA] },
  ],
}

/** Tela com um único apontamento (para testar a conversão de um item). */
function telaComApontamento(apontamento: unknown): unknown {
  return telaPreenchimentoApi({ tipos: [{ id: 1, nome: 'Comercial', quantidade: 1, apontamentos: [apontamento as never] }] })
}

async function primeiroApontamento(): Promise<ApontamentoPreenchimento> {
  const tela = await obterPreenchimento({ filial: '101' })
  return tela.tipos[0].apontamentos[0]
}

describe('F9.1 — Serviço do preenchimento: meses e tela do mês (RF-60 a RF-65, RF-70)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0))
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  describe('listarMesesPreenchimento(ano, filial) — GET /api/ped/preenchimento/meses (RF-61)', () => {
    it('faz GET .../meses?ano=&filial= com o token e devolve os 12 meses: aberto com pendentes, fechados e futuros', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi(2026, 10, 1)) })

      const meses = await listarMesesPreenchimento(2026, '101')

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA_MESES)
      expect(chamadas[0].url.searchParams.get('ano')).toBe('2026')
      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect([...chamadas[0].url.searchParams.keys()].sort()).toEqual(['ano', 'filial'])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(meses).toHaveLength(12)
      expect(meses[0]).toEqual<MesPreenchimento>({ mes: 1, mesDeReferencia: '2026-01-01', situacao: 'fechado', pendentes: null })
      expect(meses[9]).toEqual<MesPreenchimento>({ mes: 10, mesDeReferencia: '2026-10-01', situacao: 'aberto', pendentes: 1 })
      expect(meses[10]).toEqual<MesPreenchimento>({ mes: 11, mesDeReferencia: '2026-11-01', situacao: 'futuro', pendentes: null })
      expect(meses.map((m) => m.situacao)).toEqual([...Array<string>(9).fill('fechado'), 'aberto', 'futuro', 'futuro'])
    })

    it('aceita a lista pura de meses', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi(2025, 13).meses) })

      const meses = await listarMesesPreenchimento(2025, '101')

      expect(meses).toHaveLength(12)
      expect(meses.every((m) => m.situacao === 'fechado')).toBe(true)
      expect(meses[11].mesDeReferencia).toBe('2025-12-01')
    })

    it('aceita o mês como "AAAA-MM" em "mes de referencia" ou como número em "mes" (devolve sempre "AAAA-MM-01")', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA_MESES}`]: () =>
          respostaJson({
            meses: [
              { 'mes de referencia': '2026-02', situacao: 'fechado' },
              { mes: 3, situacao: 'aberto', pendentes: 4 },
            ],
          }),
      })

      await expect(listarMesesPreenchimento(2026, '101')).resolves.toEqual([
        { mes: 2, mesDeReferencia: '2026-02-01', situacao: 'fechado', pendentes: null },
        { mes: 3, mesDeReferencia: '2026-03-01', situacao: 'aberto', pendentes: 4 },
      ])
    })

    it('filial numérica no código é enviada como texto; espaços nas pontas são removidos', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi()) })

      await listarMesesPreenchimento(2026, ' 101 ')

      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
    })

    it.each(['todas', 'TODAS', '', '   '])(
      'filial "%s" (RF-60: o preenchimento exige uma filial) rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API',
      async (filial) => {
        const erro = await listarMesesPreenchimento(2026, filial).catch((e: unknown) => e)

        expect(erro).toBeInstanceOf(ApiError)
        expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
        expect(fetchFalso).not.toHaveBeenCalled()
      },
    )

    it('aceita os limites do ano: 2000 e o ano atual (2026)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi()) })

      await listarMesesPreenchimento(2000, '101')
      await listarMesesPreenchimento(2026, '101')

      expect(chamadas.map((c) => c.url.searchParams.get('ano'))).toEqual(['2000', '2026'])
    })

    it.each([1999, 2027, 2026.5, Number.NaN])(
      'ano %s (fora de 2000 até o ano atual) rejeita com ApiError 400 (MENSAGEM_ANO_INVALIDO) sem chamar a API',
      async (ano) => {
        const erro = await listarMesesPreenchimento(ano, '101').catch((e: unknown) => e)

        expect(erro).toBeInstanceOf(ApiError)
        expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_ANO_INVALIDO })
        expect(fetchFalso).not.toHaveBeenCalled()
      },
    )

    it.each([
      ['um objeto sem a lista', { ano: 2026 }],
      ['um texto', 'nada'],
      ['um mês com situação desconhecida', { meses: [{ 'mes de referencia': '2026-01-01', situacao: 'encerrado' }] }],
      ['um mês sem situação', { meses: [{ 'mes de referencia': '2026-01-01' }] }],
      ['um mês sem "mes de referencia" nem "mes"', { meses: [{ situacao: 'fechado' }] }],
      ['um mês com "mes" 13', { meses: [{ mes: 13, situacao: 'fechado' }] }],
      ['"pendentes" em texto', { meses: [{ mes: 10, situacao: 'aberto', pendentes: 'três' }] }],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(corpo) })

      await expect(listarMesesPreenchimento(2026, '101')).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('400 (ano fora do intervalo, filial "todas" para o Admin) chega como ApiError com a mensagem da API; falha de rede vira ApiError de conexão', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaErro(400, 'informe a filial') })
      await expect(listarMesesPreenchimento(2026, '101')).rejects.toMatchObject({ status: 400, mensagem: 'informe a filial' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarMesesPreenchimento(2026, '101')).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterPreenchimento({ filial, mesDeReferencia?, busca? }) — GET /api/ped/preenchimento (RF-62 a RF-65)', () => {
    it('faz GET /api/ped/preenchimento?filial= (sem mês = mês aberto) e devolve a tela convertida (camelCase)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaPreenchimentoApi()) })

      const tela = await obterPreenchimento({ filial: '101' })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['filial'])
      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(tela).toEqual(TELA_OUTUBRO)
    })

    it('envia mes_de_referencia como "AAAA-MM" (a partir de "AAAA-MM" ou "AAAA-MM-DD") e a busca com o texto informado', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaMesFechadoApi()) })

      await obterPreenchimento({ filial: '101', mesDeReferencia: '2026-09', busca: 'visitas' })
      await obterPreenchimento({ filial: '101', mesDeReferencia: '2026-09-01' })

      expect(chamadas[0].url.searchParams.get('mes_de_referencia')).toBe('2026-09')
      expect(chamadas[0].url.searchParams.get('busca')).toBe('visitas')
      expect([...chamadas[0].url.searchParams.keys()].sort()).toEqual(['busca', 'filial', 'mes_de_referencia'])
      expect(chamadas[1].url.searchParams.get('mes_de_referencia')).toBe('2026-09')
      expect(chamadas[1].url.searchParams.has('busca')).toBe(false)
    })

    it('busca vazia ou só com espaços não entra na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaPreenchimentoApi()) })

      await obterPreenchimento({ filial: '101', busca: '' })
      await obterPreenchimento({ filial: '101', busca: '   ' })

      for (const chamada of chamadas) expect(chamada.url.searchParams.has('busca')).toBe(false)
    })

    it.each(['todas', '', '  '])('filial "%s" rejeita com ApiError 400 (MENSAGEM_FILIAL_OBRIGATORIA) sem chamar a API', async (filial) => {
      const erro = await obterPreenchimento({ filial }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_FILIAL_OBRIGATORIA })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it.each(['10/2026', '2026-13', '2026'])('mês "%s" fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API', async (mes) => {
      const erro = await obterPreenchimento({ filial: '101', mesDeReferencia: mes }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('mês fechado: situação "fechado", editavel false e "Nao lancado" vira a situação nao_lancado (RF-62, RF-65)', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaMesFechadoApi()) })

      const tela = await obterPreenchimento({ filial: '101', mesDeReferencia: '2026-09' })

      expect(tela).toMatchObject({ mesDeReferencia: '2026-09-01', situacaoDoMes: 'fechado', editavel: false, periodoAberto: '2026-10-01' })
      expect(tela.tipos[0].apontamentos.map((a) => a.situacao)).toEqual(['preenchido', 'nao_lancado'])
      expect(tela.tipos[1].apontamentos[0].situacao).toBe('preenchido')
    })

    it.each([
      ['Pendente', 'pendente'],
      ['Nao lancado', 'nao_lancado'],
      ['Não lançado', 'nao_lancado'],
      ['nao_lancado', 'nao_lancado'],
      ['PREENCHIDO', 'preenchido'],
      ['Corrigido', 'corrigido'],
    ])('situação do apontamento "%s" vira "%s" (sem diferenciar maiúsculas nem acentos)', async (situacaoApi, situacao) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaComApontamento({ ...APONTAMENTO_VISITAS_API, situacao: situacaoApi })) })

      await expect(primeiroApontamento()).resolves.toMatchObject({ situacao })
    })

    it('valor: número, true/false no booleano e null sem lançamento; número em texto com ponto decimal ("1234.50") vira número', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaPreenchimentoApi({
              tipos: [
                {
                  id: 1,
                  nome: 'Comercial',
                  quantidade: 4,
                  apontamentos: [
                    { ...APONTAMENTO_VISITAS_API, valor: '1234.50' },
                    { ...APONTAMENTO_VITRINE_API, situacao: 'Preenchido', valor: true },
                    { ...APONTAMENTO_VITRINE_API, id: 8, situacao: 'Preenchido', valor: false },
                    { ...APONTAMENTO_INADIMPLENCIA_API, situacao: 'Pendente', valor: undefined },
                  ],
                },
              ],
            }),
          ),
      })

      const tela = await obterPreenchimento({ filial: '101' })

      expect(tela.tipos[0].apontamentos.map((a) => a.valor)).toEqual([1234.5, true, false, null])
    })

    it('apontamento booleano com valor 1/0 vira true/false', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaPreenchimentoApi({
              tipos: [
                {
                  id: 1,
                  nome: 'Comercial',
                  quantidade: 2,
                  apontamentos: [
                    { ...APONTAMENTO_VITRINE_API, situacao: 'Preenchido', valor: 1 },
                    { ...APONTAMENTO_VITRINE_API, id: 8, situacao: 'Preenchido', valor: 0 },
                  ],
                },
              ],
            }),
          ),
      })

      const tela = await obterPreenchimento({ filial: '101' })

      expect(tela.tipos[0].apontamentos.map((a) => a.valor)).toEqual([true, false])
    })

    it('campos opcionais ausentes da tela: nome filial, período, quem abriu e quando viram null; progresso {0, 0}; editavel segue a situação do mês', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ filial: 101, 'mes de referencia': '2026-10-01', 'situacao do mes': 'aberto', tipos: [] }),
      })

      await expect(obterPreenchimento({ filial: '101' })).resolves.toEqual<TelaPreenchimento>({
        filial: '101',
        nomeFilial: null,
        mesDeReferencia: '2026-10-01',
        situacaoDoMes: 'aberto',
        editavel: true,
        periodoAberto: null,
        abertoPor: null,
        abertoEm: null,
        progresso: { preenchidos: 0, total: 0 },
        tipos: [],
      })

      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ filial: '101', 'mes de referencia': '2026-09-01', 'situacao do mes': 'fechado', tipos: [] }),
      })
      await expect(obterPreenchimento({ filial: '101', mesDeReferencia: '2026-09' })).resolves.toMatchObject({ editavel: false })
    })

    it('tipo sem "quantidade" usa a quantidade de apontamentos; tipo sem apontamentos vira []', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaPreenchimentoApi({
              tipos: [
                { id: 1, nome: 'Comercial', apontamentos: [APONTAMENTO_VISITAS_API, APONTAMENTO_VITRINE_API] },
                { id: 3, nome: 'Fiscal', quantidade: null, apontamentos: null },
              ],
            }),
          ),
      })

      const tela = await obterPreenchimento({ filial: '101' })

      expect(tela.tipos.map((t) => ({ id: t.id, quantidade: t.quantidade, total: t.apontamentos.length }))).toEqual([
        { id: 1, quantidade: 2, total: 2 },
        { id: 3, quantidade: 0, total: 0 },
      ])
    })

    it('apontamento sem descrição, indicadores, dashboards e imagens congeladas: null e listas vazias (fases 4, 6 e 7)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(telaComApontamento({ id: 5, nome: 'Visitas a clientes', 'tipo de valor': 'Numeral', situacao: 'Pendente' })),
      })

      await expect(primeiroApontamento()).resolves.toEqual<ApontamentoPreenchimento>({
        id: 5,
        nome: 'Visitas a clientes',
        descricao: null,
        tipoValor: 'numeral',
        situacao: 'pendente',
        valor: null,
        indicadores: [],
        dashboards: [],
        imagensCongeladas: [],
      })
    })

    it('indicadores (RF-65): nomes viram { id: null, nome }; objetos { id, nome } mantêm o id', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(telaComApontamento({ ...APONTAMENTO_VISITAS_API, indicadores: ['Cobertura de clientes', { id: 12, nome: 'Positivação' }] })),
      })

      await expect(primeiroApontamento()).resolves.toMatchObject({
        indicadores: [
          { id: null, nome: 'Cobertura de clientes' },
          { id: 12, nome: 'Positivação' },
        ],
      })
    })

    it('dashboards e periodicidades (RF-65): objeto { id, nome, periodicidade } ou só o nome; periodicidade ausente ou desconhecida vira null', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaComApontamento({
              ...APONTAMENTO_VISITAS_API,
              dashboards: [
                { id: 1, nome: 'PED Comercial', periodicidade: 'Mensal' },
                'PED Gerentes',
                { nome: 'PED Supervisores', periodicidade: 'quinzenal' },
                { id: 4, nome: 'PED Diretoria' },
              ],
            }),
          ),
      })

      await expect(primeiroApontamento()).resolves.toMatchObject({
        dashboards: [
          { id: 1, nome: 'PED Comercial', periodicidade: 'mensal' },
          { id: null, nome: 'PED Gerentes', periodicidade: null },
          { id: null, nome: 'PED Supervisores', periodicidade: null },
          { id: 4, nome: 'PED Diretoria', periodicidade: null },
        ],
      })
    })

    it('imagens congeladas (RF-70): objeto { codigo, dashboard, periodo } (campos ausentes → null) ou só o código em texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaComApontamento({
              ...APONTAMENTO_INADIMPLENCIA_API,
              'imagens congeladas': [
                { codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' },
                'IMG-000020',
                { dashboard: 'PED Comercial' },
              ],
            }),
          ),
      })

      await expect(primeiroApontamento()).resolves.toMatchObject({
        imagensCongeladas: [
          { codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' },
          { codigo: 'IMG-000020', dashboard: null, periodo: null },
          { codigo: null, dashboard: 'PED Comercial', periodo: null },
        ],
      })
    })

    it('indicadores, dashboards e imagens fora do formato não rejeitam a tela: o que não é lista vira [] e itens irreconhecíveis são ignorados', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            telaComApontamento({
              ...APONTAMENTO_VISITAS_API,
              indicadores: 'Cobertura',
              dashboards: [42, { id: 1 }, 'PED Comercial'],
              'imagens congeladas': { codigo: 'IMG-1' },
            }),
          ),
      })

      await expect(primeiroApontamento()).resolves.toMatchObject({
        indicadores: [],
        dashboards: [{ id: null, nome: 'PED Comercial', periodicidade: null }],
        imagensCongeladas: [],
      })
    })

    it.each([
      ['sem filial', { ...telaPreenchimentoApi(), filial: undefined }],
      ['sem "mes de referencia"', { ...telaPreenchimentoApi(), 'mes de referencia': undefined }],
      ['com "situacao do mes" desconhecida', telaPreenchimentoApi({ 'situacao do mes': 'futuro' })],
      ['sem tipos', { ...telaPreenchimentoApi(), tipos: undefined }],
      ['com "editavel" em texto', { ...telaPreenchimentoApi(), editavel: 'sim' }],
      ['com progresso não numérico', { ...telaPreenchimentoApi(), progresso: { preenchidos: 'dois', total: 3 } }],
      ['com tipo sem nome', telaPreenchimentoApi({ tipos: [{ id: 1, apontamentos: [] } as never] })],
      ['com apontamento sem id', telaComApontamento({ ...APONTAMENTO_VISITAS_API, id: undefined })],
      ['com apontamento sem nome', telaComApontamento({ ...APONTAMENTO_VISITAS_API, nome: undefined })],
      ['com tipo de valor desconhecido', telaComApontamento({ ...APONTAMENTO_VISITAS_API, 'tipo de valor': 'Moeda' })],
      ['com situação de apontamento desconhecida', telaComApontamento({ ...APONTAMENTO_VISITAS_API, situacao: 'Aprovado' })],
      ['com valor em formato pt-BR ("1.234,56")', telaComApontamento({ ...APONTAMENTO_VISITAS_API, valor: '1.234,56' })],
      ['com valor que é um objeto', telaComApontamento({ ...APONTAMENTO_VISITAS_API, valor: { total: 1 } })],
      ['uma lista', [telaPreenchimentoApi()]],
    ])('resposta 2xx %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await obterPreenchimento({ filial: '101' }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('400 (mês futuro ou anterior a 2000) e 403 chegam como ApiError com a mensagem da API; 500 sem mensagem usa a padrão', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(400, 'mes futuro nao pode ser consultado') })
      await expect(obterPreenchimento({ filial: '101', mesDeReferencia: '2026-12' })).rejects.toMatchObject({
        status: 400,
        mensagem: 'mes futuro nao pode ser consultado',
      })

      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(obterPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })
      await expect(obterPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede vira ApiError "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(obterPreenchimento({ filial: '101' })).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
