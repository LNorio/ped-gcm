import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  MENSAGEM_CONFLITO_CORRIDA,
  MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
  MENSAGEM_CONFLITO_GERAL_ATIVA,
  MENSAGEM_SITUACAO_DASHBOARD_EXCLUIDO,
  TABELA_GERAL_GERENTES_INATIVA_API,
  respostaAlteracaoFaixasApi,
  respostaCadastroFaixasApi,
  respostaSituacaoFaixasApi,
} from '../test/faixasFalsos'
import { ApiError, MENSAGEM_SEM_CONEXAO } from './api'
import {
  alterarFaixas,
  alterarSituacaoTabelaFaixas,
  conflitosDoErro,
  criarTabelaFaixas,
  listarTabelasFaixas,
  type ConflitoFaixas,
} from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'
const NOVA_GERAL = { dashboard: 3, filial: 'todas', descricao: null, faixas: [{ de: 0, ate: 1000, aliquota: 0 }] }

/**
 * F8.12* — contrato final do back-end para a faixa geral e a situação (12/11/2026;
 * `docs/backend/RESPOSTA-faixa-geral-e-situacao.md`, `docs/backend/FRONT-faixa-geral-e-situacao.md`
 * e `docs/backend/API (28).md`, seção "fase 5: faixas"), com as divergências da proposta:
 * - `POST` responde `{ mensagem, id, versao, geral }`, `PUT` `{ mensagem, versao }` e
 *   `PUT .../situacao` `{ mensagem, situacao }`, sem a tabela: o serviço resolve como gravado (`null`);
 * - faixa de dashboard excluído não muda de situação: `400` com a mensagem da API;
 * - o `400` de conflito traz `mensagem` (sem o nome do dashboard) e, se vier, `conflitos`
 *   (`{ id, geral, filial, "nome filial" }`). `conflitosDoErro(erro)` lê essa lista do `ApiError`
 *   (`dados.conflitos`) e devolve `ConflitoFaixas[]` (`{ id, geral, filial, nomeFilial }`), ou `null`
 *   quando não há conflitos a mostrar.
 */
describe('F8.1 — Serviço de faixas: contrato final (respostas sem a tabela, conflitos e dashboard excluído)', () => {
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

  describe('respostas sem a tabela resolvem como gravado (null)', () => {
    it('POST 201 { mensagem, id, versao, geral }', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaCadastroFaixasApi({ id: 12, 'versao vigente': 1, geral: true }), 201),
      })

      await expect(criarTabelaFaixas(NOVA_GERAL)).resolves.toBeNull()
      expect(chamadas).toHaveLength(1)
    })

    it('PUT 200 { mensagem, versao } de "Alterar faixas"', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: () => respostaJson(respostaAlteracaoFaixasApi(3)) })

      await expect(alterarFaixas(1, { motivo: 'reajuste', faixas: [{ de: 0, ate: 1000, aliquota: 1 }] })).resolves.toBeNull()
    })

    it.each([
      ['inativar', false, 'inativa'],
      ['reativar', true, 'ativa'],
    ] as const)('PUT .../situacao 200 { mensagem, situacao } ao %s', async (_caso, ativa, situacao) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/7/situacao`]: () => respostaJson(respostaSituacaoFaixasApi(situacao)) })

      await expect(alterarSituacaoTabelaFaixas(7, { ativa, motivo: 'motivo' })).resolves.toBeNull()
    })
  })

  it('faixa de dashboard excluído: o 400 da situação chega como ApiError com a mensagem da API, sem conflitos', async () => {
    simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaErro(400, MENSAGEM_SITUACAO_DASHBOARD_EXCLUIDO) })

    const erro = await alterarSituacaoTabelaFaixas(4, { ativa: false, motivo: 'motivo' }).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_SITUACAO_DASHBOARD_EXCLUIDO })
    expect(conflitosDoErro(erro)).toBeNull()
  })

  it('listagem com "situacao" inválida (400) chega como ApiError com a mensagem da API', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(400, 'situacao invalida') })

    await expect(listarTabelasFaixas({ situacao: 'ativas' })).rejects.toMatchObject({ status: 400, mensagem: 'situacao invalida' })
  })

  it('a listagem continua enviando situacao=ativas quando pedida (o padrão do back é "todas")', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_GERAL_GERENTES_INATIVA_API]) })

    await listarTabelasFaixas({ situacao: 'ativas' })

    expect(chamadas[0].url.searchParams.get('situacao')).toBe('ativas')
  })

  describe('conflitosDoErro(erro) — lista "conflitos" do 400 de conflito', () => {
    it('cadastro em conflito: ApiError com a mensagem da API (sem o dashboard) e os conflitos convertidos', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(
            {
              mensagem: MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
              conflitos: [
                { id: 1, geral: false, filial: '101', 'nome filial': 'CAMPO GRANDE' },
                { id: 2, geral: false, filial: '102', 'nome filial': 'DOURADOS' },
              ],
            },
            400,
          ),
      })

      const erro = await criarTabelaFaixas(NOVA_GERAL).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_CONFLITO_FAIXAS_ATIVAS })
      expect(conflitosDoErro(erro)).toEqual<ConflitoFaixas[]>([
        { id: 1, geral: false, filial: '101', nomeFilial: 'CAMPO GRANDE' },
        { id: 2, geral: false, filial: '102', nomeFilial: 'DOURADOS' },
      ])
    })

    it('reativação em conflito com a faixa geral: geral true, filial e nome da filial null', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/6/situacao`]: () =>
          respostaJson({ mensagem: MENSAGEM_CONFLITO_GERAL_ATIVA, conflitos: [{ id: 7, geral: true, filial: null, 'nome filial': null }] }, 400),
      })

      const erro = await alterarSituacaoTabelaFaixas(6, { ativa: true, motivo: 'voltar' }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_CONFLITO_GERAL_ATIVA })
      expect(conflitosDoErro(erro)).toEqual<ConflitoFaixas[]>([{ id: 7, geral: true, filial: null, nomeFilial: null }])
    })

    it('filial numérica no conflito vira texto', () => {
      const erro = new ApiError(400, MENSAGEM_CONFLITO_GERAL_ATIVA, {
        mensagem: MENSAGEM_CONFLITO_GERAL_ATIVA,
        conflitos: [{ id: 3, geral: false, filial: 100, 'nome filial': 'MATRIZ' }],
      })

      expect(conflitosDoErro(erro)).toEqual<ConflitoFaixas[]>([{ id: 3, geral: false, filial: '100', nomeFilial: 'MATRIZ' }])
    })

    it.each<[string, unknown]>([
      ['400 só com mensagem (corrida entre gravações)', { mensagem: MENSAGEM_CONFLITO_CORRIDA }],
      ['"conflitos" vazio', { mensagem: MENSAGEM_CONFLITO_CORRIDA, conflitos: [] }],
      ['"conflitos" null', { mensagem: MENSAGEM_CONFLITO_CORRIDA, conflitos: null }],
      ['"conflitos" fora de lista', { mensagem: MENSAGEM_CONFLITO_CORRIDA, conflitos: { id: 7 } }],
      ['sem corpo', undefined],
    ])('%s: null', (_caso, dados) => {
      expect(conflitosDoErro(new ApiError(400, MENSAGEM_CONFLITO_CORRIDA, dados))).toBeNull()
    })

    it('valores que não são ApiError (erro comum, null, texto) devolvem null', () => {
      expect(conflitosDoErro(new Error('falha'))).toBeNull()
      expect(conflitosDoErro(null)).toBeNull()
      expect(conflitosDoErro('conflito')).toBeNull()
    })

    it('falha de rede: ApiError de conexão, sem conflitos', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      const erro = await criarTabelaFaixas(NOVA_GERAL).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
      expect(conflitosDoErro(erro)).toBeNull()
    })
  })
})
