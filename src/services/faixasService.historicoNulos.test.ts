import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { historicoComAcaoFaixasApi, historicoComNulosFaixasApi } from '../test/faixasFalsos'
import { MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { listarHistoricoFaixas, type VersaoFaixas } from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'

/**
 * D2 — `GET /api/ped/faixas/{id}/historico` com os nulos do contrato real (resposta do back-end de
 * 25/11/2026, `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`; Swagger de 25/11/2026):
 * - `motivo` pode vir `null` (cadastro da versão 1 sem motivo) — antes o histórico inteiro era rejeitado;
 * - `versao` pode vir `null` (o Swagger aceita, ainda que hoje não ocorra);
 * - `"quantidade de faixas"` vem `null` nas linhas de inativação, reativação e exclusão.
 *
 * Interface esperada: `VersaoFaixas.versao: number | null` e `VersaoFaixas.motivo: string | null`; os
 * nulos chegam como `null` no domínio (sem texto de substituição no serviço).
 */
describe('F8.1 — Serviço de faixas: histórico com motivo, versão e quantidade de faixas nulos (D2)', () => {
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

  it('aceita o histórico com motivo null no cadastro, versao null e "quantidade de faixas" null, na ordem da API', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoComNulosFaixasApi()) })

    const versoes = await listarHistoricoFaixas(1)

    expect(versoes).toEqual<VersaoFaixas[]>([
      {
        versao: 1,
        vigente: false,
        motivo: 'Voltou a valer para a filial',
        data: '2026-11-20 10:00:00-04:00',
        usuario: 'Ana Costa',
        quantidadeDeFaixas: null,
        acao: 'reativacao',
      },
      {
        versao: null,
        vigente: false,
        motivo: 'Filial fechada para reforma',
        data: '2026-11-15 09:30:00-04:00',
        usuario: 'Ana Costa',
        quantidadeDeFaixas: null,
        acao: 'inativacao',
      },
      {
        versao: 1,
        vigente: true,
        motivo: null,
        data: '2026-11-01 08:00:00-04:00',
        usuario: 'Maria Souza',
        quantidadeDeFaixas: 2,
        acao: 'cadastro',
      },
    ])
  })

  it('cadastro da versão 1 sem motivo ("motivo": null), sozinho no histórico, não rejeita a resposta', async () => {
    const [, , cadastro] = historicoComNulosFaixasApi()
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([cadastro]) })

    const [versao] = await listarHistoricoFaixas(1)

    expect(versao).toMatchObject({ acao: 'cadastro', versao: 1, motivo: null, quantidadeDeFaixas: 2 })
  })

  it('"motivo" ausente também vira null', async () => {
    const { motivo: _motivo, ...semMotivo } = historicoComNulosFaixasApi()[2]
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([semMotivo]) })

    const [versao] = await listarHistoricoFaixas(1)

    expect(versao.motivo).toBeNull()
  })

  it('"versao" null numa linha de alteração vira versao null, sem rejeitar o histórico', async () => {
    const [, alteracao, cadastro] = historicoComAcaoFaixasApi()
    simularApi(fetchFalso, { [`GET ${ROTA}/6/historico`]: () => respostaJson([{ ...alteracao, versao: null }, cadastro]) })

    const versoes = await listarHistoricoFaixas(6)

    expect(versoes.map((v) => [v.acao, v.versao])).toEqual([
      ['alteracao', null],
      ['cadastro', 1],
    ])
  })

  it.each([['inativacao'], ['reativacao'], ['exclusao']])(
    '"quantidade de faixas" null na linha de %s vira quantidadeDeFaixas null',
    async (acao) => {
      const [linha] = historicoComAcaoFaixasApi()
      simularApi(fetchFalso, {
        [`GET ${ROTA}/6/historico`]: () => respostaJson([{ ...linha, acao, 'quantidade de faixas': null }]),
      })

      const [versao] = await listarHistoricoFaixas(6)

      expect(versao).toMatchObject({ acao, quantidadeDeFaixas: null })
    },
  )

  it.each([
    ['motivo em número', { motivo: 3 }],
    ['versao em texto', { versao: '1' }],
  ])('%s continua fora do formato: ApiError "resposta inválida"', async (_caso, sobrescrever) => {
    const [, , cadastro] = historicoComNulosFaixasApi()
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([{ ...cadastro, ...sobrescrever }]) })

    await expect(listarHistoricoFaixas(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })
})
