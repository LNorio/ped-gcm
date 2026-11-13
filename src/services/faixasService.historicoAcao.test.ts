import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { historicoComAcaoFaixasApi, historicoExcluidaFaixasApi, historicoFaixasApi } from '../test/faixasFalsos'
import { ACOES_HISTORICO_FAIXAS, listarHistoricoFaixas, type VersaoFaixas } from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 7: cada linha do histórico pode trazer `acao`
 * (`cadastro`, `alteracao`, `inativacao` ou `reativacao`). Linha sem `acao` = alteração das faixas,
 * como hoje; no domínio, `acao` ausente (ou desconhecida) é `null`.
 *
 * Contrato final (F8.12*): `acao` vem sempre e ganha o quinto valor, `exclusao` (histórico de faixa
 * já excluída, que passa a responder `200`); as linhas de inativação, reativação e exclusão trazem
 * `vigente: false` e "quantidade de faixas" `null`; datas no formato `2026-11-10 08:00:00-04:00`.
 */
describe('F8.5 — Serviço de faixas: "acao" nas linhas do histórico (cadastro, alteração, inativação, reativação)', () => {
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

  it('converte "acao" de cada linha, na ordem da API (mais recente primeiro)', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/6/historico`]: () => respostaJson(historicoComAcaoFaixasApi()) })

    const versoes = await listarHistoricoFaixas(6)

    expect(versoes).toEqual<VersaoFaixas[]>([
      {
        versao: 2,
        vigente: false,
        motivo: 'Filial passou a usar outra régua',
        data: '2026-11-10 08:00:00-04:00',
        usuario: 'Ana Costa',
        quantidadeDeFaixas: null,
        acao: 'inativacao',
      },
      { versao: 2, vigente: true, motivo: 'Ajuste da alíquota', data: '2026-10-01 09:00:00', usuario: 'Maria Souza', quantidadeDeFaixas: 1, acao: 'alteracao' },
      { versao: 1, vigente: false, motivo: 'Cadastro inicial', data: '2026-09-01 10:00:00', usuario: 'Maria Souza', quantidadeDeFaixas: 1, acao: 'cadastro' },
    ])
  })

  it('"reativacao" é aceita', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/6/historico`]: () => respostaJson([{ ...historicoComAcaoFaixasApi()[0], acao: 'reativacao', motivo: 'Voltou a valer' }]),
    })

    const [versao] = await listarHistoricoFaixas(6)

    expect(versao).toMatchObject({ acao: 'reativacao', motivo: 'Voltou a valer' })
  })

  it('as ações aceitas são cadastro, alteracao, inativacao, reativacao e exclusao', () => {
    expect(ACOES_HISTORICO_FAIXAS).toEqual(['cadastro', 'alteracao', 'inativacao', 'reativacao', 'exclusao'])
  })

  it('"exclusao" é aceita: histórico de faixa já excluída, só com os eventos, na ordem da API', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/4/historico`]: () => respostaJson(historicoExcluidaFaixasApi()) })

    const versoes = await listarHistoricoFaixas(4)

    expect(versoes.map((v) => v.acao)).toEqual(['exclusao', 'alteracao', 'cadastro'])
    expect(versoes[0]).toEqual<VersaoFaixas>({
      versao: 3,
      vigente: false,
      motivo: 'Dashboard encerrado em 2025',
      data: '2026-11-12 14:05:00-04:00',
      usuario: 'admin',
      quantidadeDeFaixas: null,
      acao: 'exclusao',
    })
  })

  it.each([
    ['ausente (formato atual)', undefined],
    ['null', null],
    ['texto desconhecido', 'arquivamento'],
    ['número', 3],
  ])('"acao" %s vira null, sem rejeitar o histórico', async (_caso, acao) => {
    const [linha] = historicoFaixasApi()
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([{ ...linha, acao }]) })

    const [versao] = await listarHistoricoFaixas(1)

    expect(versao.acao).toBeNull()
    expect(versao).toMatchObject({ versao: 2, motivo: 'Reajuste do trimestre' })
  })
})
