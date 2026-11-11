import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraIndicador, type IndicadorApi } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { identificadoresApi, variaveisIntegracaoApi } from '../../test/dadosExternosFalsos'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  SAIDA_META_VIA_API,
  SAIDA_META_VIA_API_ANTIGA,
  URL_META_VIA_API,
} from '../../test/indicadoresFalsos'
import type { Indicador, IntegracaoDadoExterno, IntegracaoDoIndicador } from '../../types/dominio'
import type { DadosConclusaoConstrucao } from '../dados-externos/DialogoConcluirConstrucao'
import { useIntegracaoIndicador } from './useIntegracaoIndicador'

/**
 * F6.11 — Saída "chave: tipo" no hook `useIntegracaoIndicador` (docs/propostas-backend/FRONT-saida-chave-tipo.md,
 * 11/11/2026).
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): os parâmetros
 * de saída só mostram ao back-end a saída esperada; não há amarração na modal.
 * - `abrir(indicador)`: o alvo da modal (`AlvoIntegracao`) leva `parametrosSaida` como veio (objeto no
 *   formato novo, lista no antigo) e **não** leva `mapeamentoSaida`;
 * - `confirmar(dados)`: repassa a `atualizarIntegracao(id, integracao)` **só** os quatro campos
 *   (`identificador`, `url`, `parametrosSaida`, `parametrosEntrada`); `variaveisUsadas` continua fora e não
 *   há `mapeamento`.
 */
const ROTA_IDENTIFICADORES = '/api/ped/dados-externos-cadastro/identificadores'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'

function comIntegracao(base: Indicador, integracao: Partial<IntegracaoDoIndicador>): Indicador {
  return { ...base, integracao: { ...base.integracao!, ...integracao } }
}

const CONFIGURADO = comIntegracao(paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi), {
  parametrosSaida: SAIDA_META_VIA_API,
})
const SAIDA_ANTIGA = comIntegracao(paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi), {
  parametrosSaida: SAIDA_META_VIA_API_ANTIGA,
})
const PENDENTE = paraIndicador(INDICADOR_META_API_PENDENTE_API as IndicadorApi)

describe('F6.11 — useIntegracaoIndicador: saída "chave: tipo" sem mapeamento', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularApi(fetchFalso, {
      [`GET ${ROTA_IDENTIFICADORES}`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA_VARIAVEIS}`]: () => respostaJson(variaveisIntegracaoApi()),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function montar() {
    const atualizarIntegracao = vi.fn<(id: number, integracao: IntegracaoDadoExterno) => Promise<void>>().mockResolvedValue(undefined)
    const onSalva = vi.fn()
    const resultado = renderHook(() => useIntegracaoIndicador({ atualizarIntegracao, onSalva }))
    return { ...resultado, atualizarIntegracao, onSalva }
  }

  it('abrir (formato novo): o alvo leva parametrosSaida { chave: tipo }, sem mapeamentoSaida', () => {
    const { result } = montar()

    act(() => result.current.abrir(CONFIGURADO))

    expect(result.current.alvo).toMatchObject({
      id: 11,
      nome: 'Margem com meta da TI',
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: SAIDA_META_VIA_API,
    })
    expect(result.current.alvo).not.toHaveProperty('mapeamentoSaida')
  })

  it('abrir (formato antigo, saída em lista): a lista como veio, sem mapeamentoSaida', () => {
    const { result } = montar()

    act(() => result.current.abrir(SAIDA_ANTIGA))

    expect(result.current.alvo?.parametrosSaida).toEqual(SAIDA_META_VIA_API_ANTIGA)
    expect(result.current.alvo).not.toHaveProperty('mapeamentoSaida')
  })

  it('abrir (integração pendente ou indicador sem integracao): sem mapeamentoSaida', () => {
    const { result } = montar()

    act(() => result.current.abrir(PENDENTE))
    expect(result.current.alvo).toMatchObject({ id: 10, parametrosSaida: null })
    expect(result.current.alvo).not.toHaveProperty('mapeamentoSaida')

    act(() => result.current.abrir({ ...CONFIGURADO, integracao: undefined }))
    expect(result.current.alvo).not.toHaveProperty('mapeamentoSaida')
  })

  it('confirmar repassa só os quatro campos a atualizarIntegracao (sem mapeamento nem variaveisUsadas)', async () => {
    const { result, atualizarIntegracao, onSalva } = montar()
    act(() => result.current.abrir(CONFIGURADO))
    const dados: DadosConclusaoConstrucao = {
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: JSON.stringify({ codfil: 'string', metVlr: 'number', data: 'date' }, null, 2),
      parametrosEntrada: JSON.stringify(ENTRADA_META_VIA_API, null, 2),
      variaveisUsadas: ['competencia', 'empresas'],
    }

    await act(async () => {
      await result.current.confirmar(dados)
    })

    expect(atualizarIntegracao).toHaveBeenCalledTimes(1)
    expect(atualizarIntegracao.mock.calls[0][0]).toBe(11)
    expect(atualizarIntegracao.mock.calls[0][1]).toStrictEqual({
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: dados.parametrosSaida,
      parametrosEntrada: dados.parametrosEntrada,
    })
    expect(onSalva).toHaveBeenCalledTimes(1)
    expect(result.current.alvo).toBeNull()
  })

  it('confirmar com dados de uma modal antiga (com mapeamento) também não repassa o mapeamento', async () => {
    const { result, atualizarIntegracao } = montar()
    act(() => result.current.abrir(CONFIGURADO))
    const antigos = {
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: JSON.stringify(SAIDA_META_VIA_API, null, 2),
      parametrosEntrada: JSON.stringify(ENTRADA_META_VIA_API, null, 2),
      variaveisUsadas: [],
      mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
    } as DadosConclusaoConstrucao

    await act(async () => {
      await result.current.confirmar(antigos)
    })

    expect(atualizarIntegracao.mock.calls[0][1]).not.toHaveProperty('mapeamento')
  })
})
