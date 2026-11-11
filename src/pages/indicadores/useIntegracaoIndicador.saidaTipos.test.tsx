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
import type { Indicador, IntegracaoDadoExterno, IntegracaoDoIndicador, MapeamentoSaida } from '../../types/dominio'
import type { DadosConclusaoConstrucao } from '../dados-externos/DialogoConcluirConstrucao'
import { useIntegracaoIndicador } from './useIntegracaoIndicador'

/**
 * F6.11 — Saída "chave: tipo" no hook `useIntegracaoIndicador` (docs/propostas-backend/FRONT-saida-chave-tipo.md,
 * 11/11/2026):
 * - `abrir(indicador)`: o alvo da modal (`AlvoIntegracao`) passa a levar `mapeamentoSaida` =
 *   `indicador.integracao.mapeamentoSaida` (`null` no formato antigo, na integração pendente ou sem integração),
 *   além de `parametrosSaida` como veio (objeto no formato novo, lista no antigo);
 * - `confirmar(dados)`: repassa a `atualizarIntegracao(id, integracao)` o `mapeamento` recebido da modal
 *   (`DadosConclusaoConstrucao.mapeamento`), junto dos quatro campos; `variaveisUsadas` continua fora.
 */
const ROTA_IDENTIFICADORES = '/api/ped/dados-externos-cadastro/identificadores'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'
const MAPEAMENTO: MapeamentoSaida = { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null }

function comIntegracao(base: Indicador, integracao: Partial<IntegracaoDoIndicador>): Indicador {
  return { ...base, integracao: { ...base.integracao!, ...integracao } }
}

const CONFIGURADO = comIntegracao(paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi), {
  parametrosSaida: SAIDA_META_VIA_API,
  mapeamentoSaida: MAPEAMENTO,
})
const SAIDA_ANTIGA = comIntegracao(paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi), {
  parametrosSaida: SAIDA_META_VIA_API_ANTIGA,
  mapeamentoSaida: null,
})
const PENDENTE = comIntegracao(paraIndicador(INDICADOR_META_API_PENDENTE_API as IndicadorApi), { mapeamentoSaida: null })

describe('F6.11 — useIntegracaoIndicador: mapeamento da saída ("chave: tipo")', () => {
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

  it('abrir (formato novo): o alvo leva parametrosSaida { chave: tipo } e mapeamentoSaida do indicador', () => {
    const { result } = montar()

    act(() => result.current.abrir(CONFIGURADO))

    expect(result.current.alvo).toMatchObject({
      id: 11,
      nome: 'Margem com meta da TI',
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: SAIDA_META_VIA_API,
      mapeamentoSaida: MAPEAMENTO,
    })
  })

  it('abrir (formato antigo, saída em lista): mapeamentoSaida null e a lista como veio', () => {
    const { result } = montar()

    act(() => result.current.abrir(SAIDA_ANTIGA))

    expect(result.current.alvo?.parametrosSaida).toEqual(SAIDA_META_VIA_API_ANTIGA)
    expect(result.current.alvo?.mapeamentoSaida).toBeNull()
  })

  it('abrir (integração pendente): mapeamentoSaida null', () => {
    const { result } = montar()

    act(() => result.current.abrir(PENDENTE))

    expect(result.current.alvo).toMatchObject({ id: 10, parametrosSaida: null, mapeamentoSaida: null })
  })

  it('abrir (indicador sem integracao): mapeamentoSaida null', () => {
    const { result } = montar()
    const semIntegracao: Indicador = { ...CONFIGURADO, integracao: undefined }

    act(() => result.current.abrir(semIntegracao))

    expect(result.current.alvo?.mapeamentoSaida).toBeNull()
  })

  it('confirmar repassa o mapeamento recebido da modal a atualizarIntegracao (sem variaveisUsadas)', async () => {
    const { result, atualizarIntegracao, onSalva } = montar()
    act(() => result.current.abrir(CONFIGURADO))
    const dados: DadosConclusaoConstrucao = {
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: JSON.stringify({ codfil: 'string', metVlr: 'number', data: 'date' }, null, 2),
      parametrosEntrada: JSON.stringify(ENTRADA_META_VIA_API, null, 2),
      variaveisUsadas: ['competencia', 'empresas'],
      mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' },
    }

    await act(async () => {
      await result.current.confirmar(dados)
    })

    expect(atualizarIntegracao).toHaveBeenCalledTimes(1)
    expect(atualizarIntegracao).toHaveBeenCalledWith(11, {
      identificador: 'META_MARGEM',
      url: URL_META_VIA_API,
      parametrosSaida: dados.parametrosSaida,
      parametrosEntrada: dados.parametrosEntrada,
      mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' },
    })
    expect(onSalva).toHaveBeenCalledTimes(1)
    expect(result.current.alvo).toBeNull()
  })
})
