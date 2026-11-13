import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  MENSAGEM_FILIAL_INEXISTENTE,
  PERIODO_COMERCIAL_API,
  ULTIMAS_ADMIN_API,
  inicioAdminApi,
  inicioPreenchedorApi,
} from '../test/inicioFalsos'
import type { Inicio } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { obterInicio } from './inicioService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/inicio'

/** `inicioPreenchedorApi()` no formato do domínio. */
const INICIO_PREENCHEDOR: Inicio = {
  perfil: 'preenchedor',
  filiais: [{ codigo: '101', nome: 'CAMPO GRANDE', empresa: null }],
  periodoAberto: {
    mesDeReferencia: '2026-10-01',
    abertoPor: 'Ana Costa',
    abertoEm: '2026-10-01 08:00:00',
    aviso: 'Somente um periodo fica aberto por vez.',
  },
  avisoDeAcesso: {
    tipo: 'preenchedor',
    mensagem: 'Voce acessa apenas os seus tipos e filiais.',
    tipos: ['Comercial', 'Logística'],
    filiais: ['101 - CAMPO GRANDE'],
  },
  resumo: [
    { chave: 'apontamentos dos meus tipos', rotulo: 'Apontamentos dos meus tipos', valor: 3 },
    { chave: 'dashboards com meus apontamentos', rotulo: 'Dashboards com meus apontamentos', valor: 1 },
    { chave: 'meus dados externos em construcao', rotulo: 'Meus dados externos em construção (TI)', valor: 0 },
    { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1 },
  ],
  periodosEmAberto: [
    {
      id: 1,
      nome: 'PED Comercial',
      periodicidade: 'trimestral',
      periodoAtual: '4º tri/2026',
      periodoEncerrado: false,
      filiaisAbertas: 1,
      progresso: { preenchidos: 2, total: 3 },
    },
  ],
  ultimasAlteracoes: [],
}

/**
 * F11.1 — Serviço da tela Início (`src/services/inicioService.ts`; RF-06 a RF-11).
 *
 * `obterInicio(filial?: string | null): Promise<Inicio>` faz `GET /api/ped/inicio` com o Bearer. A filial
 * do cabeçalho vai em `?filial=<código>`; `undefined`, `null`, vazia ou `todas` não entram na query (todas
 * as filiais — o Admin escolhe; os demais perfis têm a filial ignorada pela API).
 *
 * Conversão para o domínio (`Inicio` em `src/types/dominio.ts`): `perfil`; `filiais` → `Filial[]`
 * (`empresa: null`, código em texto); `"periodo aberto"` → `{ mesDeReferencia, abertoPor, abertoEm, aviso }`
 * ou `null`; `"aviso de acesso"` → `{ tipo, mensagem, tipos, filiais }` ou `null`; `resumo` na ordem da API;
 * `"periodos em aberto"` → `{ id, nome, periodicidade, periodoAtual, periodoEncerrado, filiaisAbertas,
 * progresso }`; `"ultimas alteracoes"` → `{ acao, apontamento, competencia, filial, valorAnterior,
 * valorNovo, data, usuario }` (valores número, booleano ou `null`).
 * Listas ausentes viram `[]`. Respostas 2xx fora do formato viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`;
 * erros HTTP e de rede chegam como `ApiError` sem alteração.
 */
describe('F11.1 — Serviço da tela Início (GET /api/ped/inicio)', () => {
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

  describe('chamada e filial do cabeçalho (RF-01)', () => {
    it('sem filial: um único GET /api/ped/inicio, sem query, com o Bearer', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      await obterInicio()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('com uma filial: envia ?filial={código}', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      await obterInicio('101')

      expect([...chamadas[0].url.searchParams.entries()]).toEqual([['filial', '101']])
    })

    it.each([
      ['"todas"', 'todas'],
      ['vazia', ''],
      ['null', null],
    ])('filial %s não entra na query (todas as filiais)', async (_caso, filial) => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      await obterInicio(filial)

      expect(chamadas[0].url.search).toBe('')
    })
  })

  describe('conversão da resposta', () => {
    it('Preenchedor: converte perfil, filiais, período aberto, aviso de acesso, resumo, períodos e alterações', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioPreenchedorApi()) })

      await expect(obterInicio('101')).resolves.toEqual(INICIO_PREENCHEDOR)
    })

    it('Admin: aviso de acesso null, resumo na ordem da API e período encerrado com progresso 0 de 0', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      const inicio = await obterInicio()

      expect(inicio.perfil).toBe('admin')
      expect(inicio.avisoDeAcesso).toBeNull()
      expect(inicio.filiais.map((f) => f.codigo)).toEqual(['100', '101', '102'])
      expect(inicio.resumo.map((r) => r.chave)).toEqual([
        'apontamentos ativos',
        'dados externos ativos',
        'total de indicadores',
        'dados externos em construcao',
        'lancamentos pendentes',
      ])
      expect(inicio.resumo[4].valor).toBe(1234)
      expect(inicio.periodosEmAberto.map((p) => p.nome)).toEqual(['PED Comercial', 'PED Gerentes', 'PED Vendedores'])
      expect(inicio.periodosEmAberto[2]).toEqual({
        id: 6,
        nome: 'PED Vendedores',
        periodicidade: 'anual',
        periodoAtual: '2026',
        periodoEncerrado: true,
        filiaisAbertas: 0,
        progresso: { preenchidos: 0, total: 0 },
      })
    })

    it('últimas alterações: ação, apontamento, competência, filial, anterior e novo (número, booleano ou null), data e usuário, na ordem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      const { ultimasAlteracoes } = await obterInicio()

      expect(ultimasAlteracoes).toHaveLength(6)
      expect(ultimasAlteracoes[0]).toEqual({
        acao: 'correcao',
        apontamento: 'Cobertura de clientes',
        competencia: '2026-10-01',
        filial: '101',
        valorAnterior: 5,
        valorNovo: 6.5,
        data: '2026-11-12 14:30:00',
        usuario: 'Ana Costa',
      })
      expect(ultimasAlteracoes[1]).toMatchObject({ acao: 'lancamento', valorAnterior: null, valorNovo: 451590.62 })
      expect(ultimasAlteracoes[2]).toMatchObject({ acao: 'correcao', valorAnterior: false, valorNovo: true })
    })

    it('período aberto null (nenhum mês aberto) vira null', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi({ 'periodo aberto': null })) })

      const inicio = await obterInicio()

      expect(inicio.periodoAberto).toBeNull()
    })

    it('filial numérica (na lista de filiais e nas alterações) vira texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            inicioAdminApi({
              filiais: [{ filial: 101, 'nome filial': 'CAMPO GRANDE' }],
              'ultimas alteracoes': [{ ...ULTIMAS_ADMIN_API[0], filial: 101 }],
            }),
          ),
      })

      const inicio = await obterInicio()

      expect(inicio.filiais).toEqual([{ codigo: '101', nome: 'CAMPO GRANDE', empresa: null }])
      expect(inicio.ultimasAlteracoes[0].filial).toBe('101')
    })

    it('aviso de acesso sem mensagem, tipos ou filiais: mensagem null e listas vazias', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(inicioPreenchedorApi({ 'aviso de acesso': { tipo: 'filiais', mensagem: null } })),
      })

      const inicio = await obterInicio()

      expect(inicio.avisoDeAcesso).toEqual({ tipo: 'filiais', mensagem: null, tipos: [], filiais: [] })
    })

    it('listas ausentes (filiais, resumo, períodos em aberto, últimas alterações) viram []', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ perfil: 'admin', 'periodo aberto': null, 'aviso de acesso': null }),
      })

      const inicio = await obterInicio()

      expect(inicio).toEqual({
        perfil: 'admin',
        filiais: [],
        periodoAberto: null,
        avisoDeAcesso: null,
        resumo: [],
        periodosEmAberto: [],
        ultimasAlteracoes: [],
      })
    })

    it.each([
      ['um texto', 'nada'],
      ['uma lista', []],
      ['perfil desconhecido', inicioAdminApi({ perfil: 'gestor' as never })],
      ['resumo que não é lista', inicioAdminApi({ resumo: 'muitos' as never })],
      ['item do resumo sem rótulo', inicioAdminApi({ resumo: [{ chave: 'x', valor: 1 } as never] })],
      ['item do resumo com valor não numérico', inicioAdminApi({ resumo: [{ chave: 'x', rotulo: 'X', valor: 'três' as never }] })],
      ['período em aberto sem nome', inicioAdminApi({ 'periodos em aberto': [{ ...PERIODO_COMERCIAL_API, nome: undefined as never }] })],
      ['periodicidade desconhecida', inicioAdminApi({ 'periodos em aberto': [{ ...PERIODO_COMERCIAL_API, periodicidade: 'quinzenal' as never }] })],
      [
        'progresso sem números',
        inicioAdminApi({ 'periodos em aberto': [{ ...PERIODO_COMERCIAL_API, progresso: { preenchidos: 'dois' as never, total: 3 } }] }),
      ],
      ['ação desconhecida nas alterações', inicioAdminApi({ 'ultimas alteracoes': [{ ...ULTIMAS_ADMIN_API[0], acao: 'exclusao' as never }] })],
      ['alterações que não são lista', inicioAdminApi({ 'ultimas alteracoes': {} as never })],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      await expect(obterInicio()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('erros', () => {
    it('403 (sem perfil) e 404 (filial inexistente) chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) =>
          url.searchParams.get('filial') === '999'
            ? respostaErro(404, MENSAGEM_FILIAL_INEXISTENTE)
            : respostaErro(403, 'Usuario sem acesso ao PED.'),
      })

      await expect(obterInicio()).rejects.toMatchObject({ status: 403, mensagem: 'Usuario sem acesso ao PED.' })
      await expect(obterInicio('999')).rejects.toBeInstanceOf(ApiError)
      await expect(obterInicio('999')).rejects.toMatchObject({ status: 404, mensagem: MENSAGEM_FILIAL_INEXISTENTE })
    })

    it('falha de rede vira ApiError de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(obterInicio()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
