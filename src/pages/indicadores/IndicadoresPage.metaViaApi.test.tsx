import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertasMenuProvider, useAlertasMenu } from '../../layout/AlertasMenu'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_PENDENTE_API,
  alertasApi,
  alertasComIntegracaoPendenteApi,
  type AlertasIndicadoresApiFalsos,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { IndicadoresPage } from './IndicadoresPage'

const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'

/** Sonda que expõe no DOM as abas marcadas com alerta no contexto do menu. */
function SondaAlertasMenu() {
  const { abasComAlerta } = useAlertasMenu()
  return <output data-sonda="abas-com-alerta">{[...abasComAlerta].join(',')}</output>
}

/**
 * F6.11 — Sinal da aba Indicadores com a integração da meta pendente.
 * `alertas["integracao pendente"] > 0` (opcional na API) também marca a aba no menu, só para quem pode
 * configurar a integração (Admin). Ausente → 0 (não marca). Nenhum aviso novo no topo da página.
 */
describe('F6.11 — IndicadoresPage: sinal da aba com integração da meta pendente', () => {
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

  function renderizar(lista: IndicadorApiFalso[], alertas: AlertasIndicadoresApiFalsos, perfil: Perfil = 'admin') {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson({ indicadores: lista, alertas }) })
    const acesso = acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <AlertasMenuProvider>
          <SondaAlertasMenu />
          <IndicadoresPage />
        </AlertasMenuProvider>
      </ProvedorSessaoFalso>,
    )
  }

  const sonda = () => document.querySelector('[data-sonda="abas-com-alerta"]') as HTMLElement
  const notas = () => screen.queryAllByRole('note').map((nota) => nota.textContent)

  it('Admin: "integracao pendente" > 0 (sem outros alertas) marca a aba "indicadores"', async () => {
    const lista = [INDICADOR_COBERTURA_VISITAS_API, INDICADOR_META_API_PENDENTE_API]
    renderizar(lista, alertasComIntegracaoPendenteApi(lista))

    await screen.findByRole('table', { name: 'Indicadores' })

    await waitFor(() => expect(sonda()).toHaveTextContent('indicadores'))
  })

  it('Admin: nenhum aviso novo no topo da página por causa da integração pendente', async () => {
    const lista = [INDICADOR_COBERTURA_VISITAS_API, INDICADOR_META_API_PENDENTE_API]
    renderizar(lista, alertasComIntegracaoPendenteApi(lista))

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(notas()).toEqual([])
  })

  it('Admin: "integracao pendente" 0 não marca a aba', async () => {
    const lista = [INDICADOR_COBERTURA_VISITAS_API]
    renderizar(lista, { ...alertasApi(lista), 'integracao pendente': 0 })

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })

  it('Admin: sem "integracao pendente" nos alertas (API atual), a aba não é marcada mesmo com indicador pendente na lista', async () => {
    const lista = [INDICADOR_COBERTURA_VISITAS_API, INDICADOR_META_API_PENDENTE_API]
    renderizar(lista, alertasApi(lista))

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })

  it('Validador: "integracao pendente" > 0 não marca a aba (só o Admin configura a integração)', async () => {
    const lista = [INDICADOR_COBERTURA_VISITAS_API]
    renderizar(lista, { ...alertasApi(lista), 'integracao pendente': 2 }, 'validador')

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })
})
