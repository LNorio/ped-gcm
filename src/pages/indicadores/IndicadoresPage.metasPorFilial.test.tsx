import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertasMenuProvider, useAlertasMenu } from '../../layout/AlertasMenu'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
  respostaIndicadoresComMetasApi,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { IndicadoresPage } from './IndicadoresPage'

/**
 * F6.10 — Meta por filial na página: o sinal da aba Indicadores no menu passa a considerar também
 * `alertas["meta pendente por filial"] > 0`, e a filial do cabeçalho chega à tabela (coluna Meta).
 */
const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'

/** Sonda que expõe no DOM as abas marcadas com alerta no contexto do menu. */
function SondaAlertasMenu() {
  const { abasComAlerta } = useAlertasMenu()
  return <output data-sonda="abas-com-alerta">{[...abasComAlerta].join(',')}</output>
}

describe('F6.10 — IndicadoresPage: sinal da aba e filial do cabeçalho com meta por filial', () => {
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

  function renderizar(lista: IndicadorApiFalso[], filialSelecionada: FilialSelecionada = 'todas') {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaIndicadoresComMetasApi(lista)) })
    const acesso = acessoFalso({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso, filialSelecionada }}>
        <AlertasMenuProvider>
          <SondaAlertasMenu />
          <IndicadoresPage />
        </AlertasMenuProvider>
      </ProvedorSessaoFalso>,
    )
  }

  const sonda = () => document.querySelector('[data-sonda="abas-com-alerta"]') as HTMLElement

  it('só com indicador ativo com meta pendente por filial (sem os outros alertas), a aba "indicadores" fica marcada', async () => {
    renderizar([INDICADOR_COBERTURA_VISITAS_API, INDICADOR_TICKET_MEDIO_API])

    await screen.findByRole('table', { name: 'Indicadores' })

    await waitFor(() => expect(sonda()).toHaveTextContent('indicadores'))
  })

  it('com "meta pendente por filial" 0 e sem os outros alertas, a aba não fica marcada', async () => {
    renderizar([INDICADOR_COBERTURA_VISITAS_API, INDICADOR_MARGEM_API])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })

  it('indicador inativo com filiais sem meta não marca a aba (a API conta só ativos)', async () => {
    renderizar([INDICADOR_COBERTURA_VISITAS_API, { ...INDICADOR_TICKET_MEDIO_API, ativo: false }])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })

  it('a etiqueta "Meta pendente em 2 filiais" aparece na linha do indicador', async () => {
    renderizar([INDICADOR_TICKET_MEDIO_API])

    const tabela = await screen.findByRole('table', { name: 'Indicadores' })

    expect(within(tabela).getByText('Meta pendente em 2 filiais')).toBeInTheDocument()
  })

  it('com a filial 101 no cabeçalho, a coluna Meta mostra a meta daquela filial ("Sem meta nesta filial" quando falta)', async () => {
    renderizar([INDICADOR_TICKET_MEDIO_API, INDICADOR_MARGEM_API], FILIAIS[1])

    const tabela = await screen.findByRole('table', { name: 'Indicadores' })

    expect(within(tabela).getByText('Sem meta nesta filial')).toBeInTheDocument()
    expect(within(tabela).getByText('32,50')).toBeInTheDocument()
    expect(within(tabela).queryByText('Por filial')).not.toBeInTheDocument()
  })

  it('na visão "Todas as filiais", a coluna Meta mostra "Por filial" nos indicadores só com metas por filial', async () => {
    renderizar([INDICADOR_TICKET_MEDIO_API, INDICADOR_MARGEM_API])

    const tabela = await screen.findByRole('table', { name: 'Indicadores' })

    expect(within(tabela).getAllByText('Por filial')).toHaveLength(2)
  })
})
