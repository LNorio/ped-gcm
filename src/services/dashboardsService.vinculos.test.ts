import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  CARGOS_VINCULO,
  COLABORADORES_VINCULO,
  FILIAIS_VINCULO,
  FILIAIS_VINCULO_API,
  rotaVinculos,
} from '../test/dashboardsFalsos'
import { MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { listarCargosVinculo, listarColaboradoresVinculo, listarFiliaisVinculo } from './dashboardsService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/vinculos'

describe('F7.1 — Serviço de dashboards: listas de vínculo (GET /api/ped/vinculos — INT-02, RF-50)', () => {
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

  it('listarFiliaisVinculo(): GET ?tipo=filiais (sem busca) com o token e devolve { codigo, nome }', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rotaVinculos() })

    const filiais = await listarFiliaisVinculo()

    expect(chamadas[0].metodo).toBe('GET')
    expect(chamadas[0].caminho).toBe(ROTA)
    expect([...chamadas[0].url.searchParams.entries()]).toEqual([['tipo', 'filiais']])
    expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    expect(filiais).toEqual(FILIAIS_VINCULO)
  })

  it('listarCargosVinculo(): GET ?tipo=cargos e devolve { cargo, colaboradores }', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rotaVinculos() })

    const cargos = await listarCargosVinculo()

    expect(chamadas[0].url.searchParams.get('tipo')).toBe('cargos')
    expect(cargos).toEqual(CARGOS_VINCULO)
  })

  it('listarColaboradoresVinculo(): GET ?tipo=colaboradores e devolve { id, nome, cargo, filial }', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rotaVinculos() })

    const colaboradores = await listarColaboradoresVinculo()

    expect(chamadas[0].url.searchParams.get('tipo')).toBe('colaboradores')
    expect(colaboradores).toEqual(COLABORADORES_VINCULO)
    expect(colaboradores[0]).toEqual({ id: 11, nome: 'Ana Souza', cargo: 'Gerente de Loja', filial: '100' })
  })

  it('a busca vai na query como digitada; vazia ou só com espaços é omitida', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: rotaVinculos() })

    const encontrados = await listarColaboradoresVinculo('FÁBIO')
    await listarCargosVinculo('   ')

    expect(chamadas[0].url.searchParams.get('busca')).toBe('FÁBIO')
    expect(encontrados.map((c) => c.nome)).toEqual(['Fábio Nunes'])
    expect([...chamadas[1].url.searchParams.keys()]).toEqual(['tipo'])
  })

  it('códigos de filial numéricos viram texto; cargo sem contagem vira 0; colaborador sem cargo/filial vira null', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: (_init, url) => {
        const tipo = url.searchParams.get('tipo')
        if (tipo === 'filiais') return respostaJson([{ filial: 101, 'nome filial': 'CAMPO GRANDE' }])
        if (tipo === 'cargos') return respostaJson([{ cargo: 'Vendedor' }])
        return respostaJson([{ 'id colaborador': 30, nome: 'Gil Souza', cargo: null, filial: null }])
      },
    })

    await expect(listarFiliaisVinculo()).resolves.toEqual([{ codigo: '101', nome: 'CAMPO GRANDE' }])
    await expect(listarCargosVinculo()).resolves.toEqual([{ cargo: 'Vendedor', colaboradores: 0 }])
    await expect(listarColaboradoresVinculo()).resolves.toEqual([{ id: 30, nome: 'Gil Souza', cargo: null, filial: null }])
  })

  it('aceita também a lista dentro de uma chave com o nome do tipo (ex.: { filiais: [...] })', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ filiais: FILIAIS_VINCULO_API.slice(0, 1) }) })

    await expect(listarFiliaisVinculo()).resolves.toEqual([{ codigo: '100', nome: 'MATRIZ' }])
  })

  it.each([
    ['filial sem nome', () => listarFiliaisVinculo(), [{ filial: '100' }]],
    ['cargo sem nome', () => listarCargosVinculo(), [{ colaboradores: 2 }]],
    ['colaborador sem id', () => listarColaboradoresVinculo(), [{ nome: 'Ana Souza', cargo: 'Gerente de Loja', filial: '100' }]],
    ['objeto sem lista', () => listarFiliaisVinculo(), { mensagem: 'ok' }],
  ])('%s vira ApiError "resposta inválida"', async (_caso, chamar, corpo) => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

    await expect(chamar()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })

  it('403 (Preenchedor) e falha de rede chegam como ApiError', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
    await expect(listarFiliaisVinculo()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listarCargosVinculo()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
  })
})
