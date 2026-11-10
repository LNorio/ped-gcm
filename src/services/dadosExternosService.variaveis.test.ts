import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { variaveisIntegracao, variaveisIntegracaoApi } from '../test/dadosExternosFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { listarVariaveisIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/integracao/variaveis'
const ROTA_PROPOSTA_ANTIGA = '/api/ped/dados-externos-cadastro/variaveis'

/**
 * Variáveis da integração (F5.15), contrato publicado em 09/11/2026 (`FRONT-integracao-dado-externo.md`,
 * seção 3): `GET /api/ped/integracao/variaveis` → lista de
 * `{ variavel: "%filial%", nome: "filial", tipo, descricao, exemplo: "100" }`.
 * O domínio é `{ nome (sem %), descricao, tipo, exemplo: string | null }`.
 */
describe('F5.15 — listarVariaveisIntegracao (variáveis da integração vindas da API)', () => {
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

  it('faz GET /api/ped/integracao/variaveis com o token e devolve as 13 variáveis, na ordem, com o exemplo', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(variaveisIntegracaoApi()) })

    const variaveis = await listarVariaveisIntegracao()

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].metodo).toBe('GET')
    expect(chamadas[0].caminho).toBe(ROTA)
    expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    expect(variaveis).toEqual(variaveisIntegracao())
    expect(variaveis).toHaveLength(13)
    expect(variaveis[0]).toEqual({ nome: 'filial', descricao: 'Codigo da filial', tipo: 'numero', exemplo: '100' })
  })

  it('as 13 variáveis do contrato final (10/11/2026) incluem %empresa% (numero, exemplo "1") e %empresas% (texto, exemplo "1,6,7,8,9")', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(variaveisIntegracaoApi()) })

    const variaveis = await listarVariaveisIntegracao()

    expect(variaveis.map((v) => v.nome)).toEqual([
      'filial',
      'empresa',
      'empresas',
      'colaborador',
      'zona',
      'mes',
      'ano',
      'competencia',
      'dataInicial',
      'dataFinal',
      'hoje',
      'diaColeta',
      'mesesRetro',
    ])
    expect(variaveis.find((v) => v.nome === 'empresa')).toMatchObject({ tipo: 'numero', exemplo: '1' })
    expect(variaveis.find((v) => v.nome === 'empresas')).toMatchObject({ tipo: 'texto', exemplo: '1,6,7,8,9' })
  })

  it('não usa mais a rota proposta pelo front (/dados-externos-cadastro/variaveis)', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(variaveisIntegracaoApi()) })

    await listarVariaveisIntegracao()

    expect(chamadas.map((c) => c.caminho)).not.toContain(ROTA_PROPOSTA_ANTIGA)
  })

  it('aceita a lista envolvida em { "variaveis": [...] }', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ variaveis: variaveisIntegracaoApi() }) })

    await expect(listarVariaveisIntegracao()).resolves.toEqual(variaveisIntegracao())
  })

  it('item no formato do documento: descrição mantida como veio (sem acento) e exemplo em texto', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([
          { variavel: '%dataInicial%', nome: 'dataInicial', tipo: 'data', descricao: 'Primeiro dia do periodo', exemplo: '01/10/2026' },
        ]),
    })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([
      { nome: 'dataInicial', descricao: 'Primeiro dia do periodo', tipo: 'data', exemplo: '01/10/2026' },
    ])
  })

  it('normaliza o nome sem os % ("%filial%" → "filial")', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([
          { nome: '%filial%', descricao: 'Codigo da filial', tipo: 'numero', exemplo: '100' },
          { nome: '%hoje%', descricao: 'Data da execucao da consulta', tipo: 'data', exemplo: null },
        ]),
    })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([
      { nome: 'filial', descricao: 'Codigo da filial', tipo: 'numero', exemplo: '100' },
      { nome: 'hoje', descricao: 'Data da execucao da consulta', tipo: 'data', exemplo: null },
    ])
  })

  it('sem "nome", usa "variavel" sem os % ("%mesesRetro%" → "mesesRetro")', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson([{ variavel: '%mesesRetro%', tipo: 'numero', descricao: 'Meses', exemplo: '3' }]),
    })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([
      { nome: 'mesesRetro', descricao: 'Meses', tipo: 'numero', exemplo: '3' },
    ])
  })

  it('com "nome" e "variavel", vale o "nome"', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson([{ variavel: '%outra%', nome: 'filial', tipo: 'numero', descricao: '', exemplo: '100' }]),
    })

    const [variavel] = await listarVariaveisIntegracao()

    expect(variavel.nome).toBe('filial')
  })

  it('descrição ausente ou null vira texto vazio', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([
          { nome: 'zona', descricao: null, tipo: 'texto', exemplo: 'Z01' },
          { nome: 'mes', tipo: 'numero', exemplo: '10' },
        ]),
    })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([
      { nome: 'zona', descricao: '', tipo: 'texto', exemplo: 'Z01' },
      { nome: 'mes', descricao: '', tipo: 'numero', exemplo: '10' },
    ])
  })

  it('exemplo ausente ou null vira null', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([
          { variavel: '%zona%', nome: 'zona', descricao: 'Zona', tipo: 'texto' },
          { variavel: '%mes%', nome: 'mes', descricao: 'Mes', tipo: 'numero', exemplo: null },
        ]),
    })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([
      { nome: 'zona', descricao: 'Zona', tipo: 'texto', exemplo: null },
      { nome: 'mes', descricao: 'Mes', tipo: 'numero', exemplo: null },
    ])
  })

  it('lista vazia devolve []', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

    await expect(listarVariaveisIntegracao()).resolves.toEqual([])
  })

  describe('resposta fora do formato → ApiError(200, "Resposta inválida do servidor.")', () => {
    it.each<[string, unknown]>([
      ['tipo desconhecido', [{ nome: 'filial', descricao: 'x', tipo: 'moeda' }]],
      ['sem tipo', [{ nome: 'filial', descricao: 'x' }]],
      ['sem nome e sem variavel', [{ descricao: 'x', tipo: 'numero' }]],
      ['nome vazio', [{ nome: '', descricao: 'x', tipo: 'numero' }]],
      ['nome só com %', [{ nome: '%%', descricao: 'x', tipo: 'numero' }]],
      ['sem nome e variavel só com %', [{ variavel: '%%', descricao: 'x', tipo: 'numero' }]],
      ['nome que não é texto', [{ nome: 10, descricao: 'x', tipo: 'numero' }]],
      ['sem nome e variavel que não é texto', [{ variavel: 10, descricao: 'x', tipo: 'numero' }]],
      ['descrição que não é texto', [{ nome: 'filial', descricao: 10, tipo: 'numero' }]],
      ['exemplo objeto', [{ nome: 'filial', descricao: 'x', tipo: 'numero', exemplo: { valor: 100 } }]],
      ['exemplo booleano', [{ nome: 'filial', descricao: 'x', tipo: 'numero', exemplo: true }]],
      ['um item inválido entre válidos', [...variaveisIntegracaoApi(), { nome: 'x', tipo: 'outro' }]],
      ['item que não é objeto', ['filial']],
      ['objeto sem a lista', { itens: [] }],
      ['texto solto', 'ok'],
      ['nulo', null],
    ])('%s', async (_nome, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarVariaveisIntegracao().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('erros HTTP e de rede são propagados', () => {
    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })

      const erro = await listarVariaveisIntegracao().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('403 (perfil que não é Admin) rejeita com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })

      await expect(listarVariaveisIntegracao()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarVariaveisIntegracao()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
