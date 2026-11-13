/**
 * F11.2 — Avisos da tela Início (integração: app completo com a rede simulada; RF-06, RF-07).
 *
 * Com a resposta de `GET /api/ped/inicio`, o Início mostra o aviso do período aberto (todos os perfis) e,
 * quando a API manda o "aviso de acesso" (Preenchedor), o aviso com os tipos e as filiais. Para o Admin e
 * o Validador o "aviso de acesso" vem `null` e não há aviso de acesso.
 *
 * A rota é carregada sob demanda: os testes esperam os avisos com `findBy*` (timeout padrão do projeto).
 */
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import {
  AVISO_ACESSO_PREENCHEDOR_API,
  TEXTO_AVISO_PERIODO,
  TEXTO_AVISO_PREENCHEDOR,
  inicioPreenchedorApi,
  rotasDoInicio,
} from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/inicio'

describe('F11.2 — Avisos do Início (integração: período aberto e acesso)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const semAvisoDeAcesso = () => {
    expect(screen.queryByText(/^Perfil Preenchedor:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Seu usuário tem acesso somente/)).not.toBeInTheDocument()
  }

  describe('Admin', () => {
    it('mostra o aviso do período aberto e nenhum aviso de acesso', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin'))
      renderizarApp('/')

      expect(await screen.findByText(TEXTO_AVISO_PERIODO)).toBeInTheDocument()
      semAvisoDeAcesso()
    })
  })

  describe('Validador', () => {
    it('mostra o aviso do período aberto e nenhum aviso de acesso (aviso de acesso null)', async () => {
      simularApi(fetchFalso, rotasDoInicio('validador'))
      renderizarApp('/')

      expect(await screen.findByText(TEXTO_AVISO_PERIODO)).toBeInTheDocument()
      semAvisoDeAcesso()
    })
  })

  describe('Preenchedor', () => {
    it('mostra o aviso do período aberto e o aviso de acesso com os tipos e a filial', async () => {
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))
      renderizarApp('/')

      expect(await screen.findByText(TEXTO_AVISO_PREENCHEDOR)).toBeInTheDocument()
      expect(screen.getByText(TEXTO_AVISO_PERIODO)).toBeInTheDocument()
    })

    it('com várias filiais de acesso, o aviso lista todas', async () => {
      simularApi(
        fetchFalso,
        rotasDoInicio('preenchedor', {
          [`GET ${ROTA}`]: () =>
            respostaJson(
              inicioPreenchedorApi({
                'aviso de acesso': { ...AVISO_ACESSO_PREENCHEDOR_API, filiais: ['101 - CAMPO GRANDE', '102 - DOURADOS'] },
              }),
            ),
        }),
      )
      renderizarApp('/')

      expect(
        await screen.findByText(
          'Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, Logística, somente nas filiais 101 - CAMPO GRANDE, 102 - DOURADOS.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('sem período aberto (null): não mostra o aviso do período', async () => {
    simularApi(
      fetchFalso,
      rotasDoInicio('preenchedor', { [`GET ${ROTA}`]: () => respostaJson(inicioPreenchedorApi({ 'periodo aberto': null })) }),
    )
    renderizarApp('/')

    expect(await screen.findByText(TEXTO_AVISO_PREENCHEDOR)).toBeInTheDocument()
    expect(screen.queryByText(/Período aberto para preenchimento/)).not.toBeInTheDocument()
  })
})
