import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertasMenuProvider, useAlertasMenu } from '../../layout/AlertasMenu'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_CUSTO_FRETE_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_ROTINAS_API,
  indicadoresApi,
  respostaIndicadoresApi,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { IndicadoresPage } from './IndicadoresPage'

const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'

/** Sonda que expõe no DOM as abas marcadas com alerta no contexto do menu. */
function SondaAlertasMenu() {
  const { abasComAlerta } = useAlertasMenu()
  return <output data-sonda="abas-com-alerta">{[...abasComAlerta].join(',')}</output>
}

describe('F6.3 — IndicadoresPage: alertas da aba e sinal no menu (RF-33)', () => {
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

  function renderizar(lista: IndicadorApiFalso[] | (() => Response) = indicadoresApi()) {
    simularApi(fetchFalso, { [ROTA_LISTA]: typeof lista === 'function' ? lista : () => respostaJson(respostaIndicadoresApi(lista)) })
    const acesso = acessoFalso({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
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

  it('com indicadores aguardando meta e com componente desativado, mostra os dois alertas da aba (role note, tipo alerta)', async () => {
    renderizar()

    await screen.findByRole('table', { name: 'Indicadores' })

    const aguardando = screen.getByText('1 indicador aguardando definição de meta.')
    expect(aguardando.closest('[role="note"]')).toHaveClass('aviso--alerta')
    const desativados = screen.getByText('3 indicadores com componente desativado.')
    expect(desativados.closest('[role="note"]')).toHaveClass('aviso--alerta')
  })

  it('usa o plural conforme a contagem', async () => {
    renderizar([
      INDICADOR_DEVOLUCOES_API,
      { ...INDICADOR_DEVOLUCOES_API, id: 40, nome: 'Outro automático' },
      INDICADOR_CUSTO_FRETE_API,
    ])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(screen.getByText('2 indicadores aguardando definição de meta.')).toBeInTheDocument()
    expect(screen.getByText('1 indicador com componente desativado.')).toBeInTheDocument()
  })

  it('sem alertas, nenhum aviso é exibido', async () => {
    renderizar([INDICADOR_COBERTURA_VISITAS_API])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(screen.queryByText(/aguardando definição de meta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/com componente desativado/)).not.toBeInTheDocument()
  })

  it('só o alerta com contagem maior que zero aparece', async () => {
    renderizar([INDICADOR_ROTINAS_API])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(screen.queryByText(/aguardando definição de meta/)).not.toBeInTheDocument()
    expect(screen.getByText('1 indicador com componente desativado.')).toBeInTheDocument()
  })

  it('indicadores inativos não contam (a API conta só ativos): automático inativo não gera alerta', async () => {
    renderizar([{ ...INDICADOR_DEVOLUCOES_API, ativo: false }])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(notas()).toEqual([])
    expect(sonda()).toHaveTextContent('')
  })

  it('com qualquer alerta, a página marca a aba "indicadores" no contexto do menu', async () => {
    renderizar()

    await waitFor(() => expect(sonda()).toHaveTextContent('indicadores'))
  })

  it('sem alertas, a aba "indicadores" não fica marcada no contexto do menu', async () => {
    renderizar([INDICADOR_COBERTURA_VISITAS_API])

    await screen.findByRole('table', { name: 'Indicadores' })

    expect(sonda()).toHaveTextContent('')
  })

  it('erro na carga não marca a aba nem mostra alertas', async () => {
    renderizar(() => respostaErro(500, 'Falha ao consultar.'))

    await screen.findByRole('alert')

    expect(sonda()).toHaveTextContent('')
    expect(notas()).toEqual([])
  })
})
