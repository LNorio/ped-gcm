import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraIndicador, type IndicadorApi } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { identificadoresApi, variaveisIntegracaoApi } from '../../test/dadosExternosFalsos'
import { INDICADOR_META_API_CONFIGURADO_API } from '../../test/indicadoresFalsos'
import type { IdentificadorColeta, IntegracaoDadoExterno } from '../../types/dominio'
import { useIntegracaoIndicador } from './useIntegracaoIndicador'

/**
 * F6.11 — Sugestões de identificadores no hook `useIntegracaoIndicador` com o formato real de
 * `GET /api/ped/dados-externos-cadastro/identificadores` (D1 da resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`).
 *
 * Cada item vem como `{ identificador, nome, unidade, ativo, "dados cadastrados" }` (nunca `quantidade`).
 * Ao abrir a modal, `identificadores` passa a ter as coletas com `quantidade` igual a `"dados cadastrados"`
 * (antes a lista inteira era rejeitada e a modal ficava sem sugestões).
 */
const ROTA_IDENTIFICADORES = '/api/ped/dados-externos-cadastro/identificadores'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'

const CONFIGURADO = paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi)

describe('F6.11 — useIntegracaoIndicador: sugestões de identificadores no formato real ("dados cadastrados")', () => {
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
    return renderHook(() => useIntegracaoIndicador({ atualizarIntegracao, onSalva: vi.fn() }))
  }

  it('abrir: carrega as coletas com a contagem de "dados cadastrados", na ordem da API', async () => {
    const { result } = montar()

    act(() => result.current.abrir(CONFIGURADO))

    await waitFor(() => expect(result.current.identificadores).toHaveLength(4))
    expect(result.current.identificadores).toEqual<IdentificadorColeta[]>([
      { identificador: 'FATURAMENTO', quantidade: 1 },
      { identificador: 'COBERTURA', quantidade: 1 },
      { identificador: 'VOLUME_VENDAS', quantidade: 2 },
      { identificador: 'NOVOS_CLIENTES', quantidade: 0 },
    ])
  })
})
