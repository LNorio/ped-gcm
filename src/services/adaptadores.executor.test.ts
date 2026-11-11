import { describe, expect, it } from 'vitest'
import {
  ERRO_ULTIMA_CONSULTA_META,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_CONSULTA_API,
  ULTIMA_CONSULTA_META_ANTERIOR_EM,
  ULTIMA_CONSULTA_META_EM,
  comoValidadorRecebe,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import { type IndicadorApi, paraIndicador } from './adaptadores'

/**
 * F6.11 — Meta via API, executor das integrações (fase 2: `docs/backend/FRONT-meta-via-api-fase2.md` e
 * `docs/backend/API (27).md`, seção "Executor das integrações" — 11/11/2026).
 *
 * `Indicador.integracao` (`IntegracaoDoIndicador`, só com `origem da meta = terceiro`) ganha:
 * - `ultimaConsultaEm: DataApi | null` — de `"ultima consulta em"` (último **sucesso**); ausente/`null` → `null`;
 * - `erroUltimaConsulta: string | null` — de `"erro da ultima consulta"`; ausente/`null` → `null`.
 * Os dois só chegam ao Admin e só na fonte `integracao`. `"tipo de servico"` (`soap`/`rest`) é aceito na
 * listagem, mas não entra no domínio. `filiais sem meta` da fonte `integracao` passa a vir preenchida
 * depois da primeira consulta e é lida como nas demais fontes.
 */
describe('F6.11 — Meta via API, executor: adaptadores (paraIndicador)', () => {
  const converter = (api: IndicadorApiFalso) => paraIndicador(api as IndicadorApi)

  it('fonte integracao já consultada: ultimaConsultaEm com a data do último sucesso e erroUltimaConsulta null', () => {
    const indicador = converter(INDICADOR_META_CONSULTADO_API)

    expect(indicador.integracao).toMatchObject({
      identificador: 'META_TICKET',
      pendente: false,
      ultimaConsultaEm: ULTIMA_CONSULTA_META_EM,
      erroUltimaConsulta: null,
    })
    expect(indicador.situacaoDaMetaViaApi).toBe('ok')
  })

  it('fonte integracao com erro: erroUltimaConsulta com o texto do back-end e a data do último sucesso mantida', () => {
    const indicador = converter(INDICADOR_META_ERRO_CONSULTA_API)

    expect(indicador.integracao).toMatchObject({
      ultimaConsultaEm: ULTIMA_CONSULTA_META_ANTERIOR_EM,
      erroUltimaConsulta: ERRO_ULTIMA_CONSULTA_META,
    })
    expect(indicador.situacaoDaMetaViaApi).toBe('erro')
  })

  it('sem os campos (antes da primeira consulta ou API anterior ao executor): ultimaConsultaEm e erroUltimaConsulta null', () => {
    const indicador = converter(INDICADOR_META_AGUARDANDO_API)

    expect(indicador.integracao?.ultimaConsultaEm).toBeNull()
    expect(indicador.integracao?.erroUltimaConsulta).toBeNull()
  })

  it('campos null explícitos também viram null', () => {
    const indicador = converter({ ...INDICADOR_META_CONSULTADO_API, 'ultima consulta em': null, 'erro da ultima consulta': null })

    expect(indicador.integracao?.ultimaConsultaEm).toBeNull()
    expect(indicador.integracao?.erroUltimaConsulta).toBeNull()
  })

  it('Validador (sem os campos do Admin): integracao com ultimaConsultaEm e erroUltimaConsulta null', () => {
    const indicador = converter(comoValidadorRecebe(INDICADOR_META_ERRO_CONSULTA_API))

    expect(indicador.integracao).toMatchObject({ ultimaConsultaEm: null, erroUltimaConsulta: null })
    expect(indicador.situacaoDaMetaViaApi).toBe('erro')
  })

  it('fonte integracao depois da primeira consulta: filiais sem meta lidas da API', () => {
    expect(converter(INDICADOR_META_CONSULTADO_API).filiaisSemMeta).toEqual(['101', '102'])
    expect(converter(comoValidadorRecebe(INDICADOR_META_CONSULTADO_API)).filiaisSemMeta).toEqual(['101', '102'])
  })

  it('"tipo de servico" não entra no domínio (nem em integracao)', () => {
    const indicador = converter({ ...INDICADOR_META_CONSULTADO_API, 'tipo de servico': 'rest' })

    expect(indicador.integracao).not.toHaveProperty('tipoDeServico')
    expect(indicador.integracao).not.toHaveProperty('tipo de servico')
    expect(indicador).not.toHaveProperty('tipo de servico')
  })

  it('fonte dado_externo continua com integracao sem consulta própria (ultimaConsultaEm e erroUltimaConsulta null)', () => {
    const indicador = converter({ ...INDICADOR_META_DADO_EXTERNO_API })

    expect(indicador.integracao).toMatchObject({ ultimaConsultaEm: null, erroUltimaConsulta: null })
  })

  it('indicador de meta manual continua sem integracao (undefined), mesmo que a API traga os campos do executor', () => {
    const indicador = converter({
      ...INDICADOR_COBERTURA_VISITAS_API,
      'ultima consulta em': ULTIMA_CONSULTA_META_EM,
      'erro da ultima consulta': ERRO_ULTIMA_CONSULTA_META,
      'tipo de servico': 'soap',
    })

    expect(indicador.integracao).toBeUndefined()
  })
})
