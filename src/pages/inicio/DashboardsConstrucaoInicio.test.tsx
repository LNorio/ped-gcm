import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { DASHBOARD_LOGISTICA_API, DASHBOARD_SUPERVISORES_API } from '../../test/dashboardsFalsos'
import { DASHBOARD_EXPANSAO_API, DASHBOARD_NOVOS_NEGOCIOS_API } from '../../test/inicioBlocosFalsos'
import { usuarioRapido } from '../../test/usuario'
import { ROTULO_AGUARDANDO_ENVIO } from '../../utils/tarefaBitrix'
import { DashboardsConstrucaoInicio, type DashboardsConstrucaoInicioProps } from './DashboardsConstrucaoInicio'

const SUPERVISORES = paraDashboard(DASHBOARD_SUPERVISORES_API)
const LOGISTICA = paraDashboard(DASHBOARD_LOGISTICA_API)
const NOVOS_NEGOCIOS = paraDashboard(DASHBOARD_NOVOS_NEGOCIOS_API)
const EXPANSAO = paraDashboard(DASHBOARD_EXPANSAO_API)

const TITULO = 'Dashboards em construção'
const MENSAGEM_VAZIA = 'Nenhum dashboard em construção.'
const MENSAGEM_FALHA = 'Não foi possível carregar os dashboards em construção.'

function renderizar(props: Partial<DashboardsConstrucaoInicioProps> = {}) {
  const completas: DashboardsConstrucaoInicioProps = { dashboards: [], carregando: false, erro: null, ...props }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardsConstrucaoInicio {...completas} />} />
        <Route path="/dashboards" element={<h1>Tela de dashboards</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const regiao = () => screen.getByRole('region', { name: TITULO })
const itens = () => within(regiao()).getAllByRole('listitem')

/**
 * F11.6 — Painel "Dashboards em construção" do Início (`src/pages/inicio/DashboardsConstrucaoInicio.tsx`).
 *
 * Props: `{ dashboards: Dashboard[] | null; carregando: boolean; erro: string | null }`. Card (região) com o
 * título "Dashboards em construção" e uma lista com um item por dashboard, na ordem recebida. Cada item mostra:
 * - o nome do dashboard;
 * - a periodicidade (`ROTULOS_PERIODICIDADE`, ex.: "Semestral");
 * - a tarefa do Bitrix, quando houver, pela regra comum (`textoTarefaBitrix(tarefa, 'Tarefa #')`):
 *   "Tarefa #{número}" quando enviada; "Aguardando envio ao Bitrix" quando ainda não enviada; sem tarefa, nada.
 * O painel sempre tem o link "Ver dashboards" para `/dashboards`. Lista vazia: "Nenhum dashboard em
 * construção.". Com `erro`: só o aviso curto "Não foi possível carregar os dashboards em construção." —
 * **sem** `role="alert"`. Carregando (sem itens): nem lista, nem mensagem de vazio, nem aviso de falha.
 */
describe('F11.6 — DashboardsConstrucaoInicio (painel de dashboards em construção)', () => {
  it('região com o título e um item por dashboard, na ordem recebida', () => {
    renderizar({ dashboards: [SUPERVISORES, LOGISTICA, NOVOS_NEGOCIOS, EXPANSAO] })

    expect(within(regiao()).getByRole('heading', { name: TITULO })).toBeInTheDocument()
    const encontrados = itens()
    expect(encontrados).toHaveLength(4)
    expect(within(encontrados[0]).getByText('PED Supervisores')).toBeInTheDocument()
    expect(within(encontrados[1]).getByText('PED Logística')).toBeInTheDocument()
    expect(within(encontrados[2]).getByText('PED Novos Negócios')).toBeInTheDocument()
    expect(within(encontrados[3]).getByText('PED Expansão')).toBeInTheDocument()
  })

  it('cada item mostra a periodicidade', () => {
    renderizar({ dashboards: [SUPERVISORES, LOGISTICA, NOVOS_NEGOCIOS, EXPANSAO] })

    const [supervisores, logistica, novosNegocios, expansao] = itens()
    expect(within(supervisores).getByText('Semestral')).toBeInTheDocument()
    expect(within(logistica).getByText('Bimestral')).toBeInTheDocument()
    expect(within(novosNegocios).getByText('Mensal')).toBeInTheDocument()
    expect(within(expansao).getByText('Anual')).toBeInTheDocument()
  })

  it('tarefa do Bitrix: "Tarefa #{número}" quando enviada, "Aguardando envio ao Bitrix" quando não enviada e nada sem tarefa', () => {
    renderizar({ dashboards: [SUPERVISORES, LOGISTICA, NOVOS_NEGOCIOS, EXPANSAO] })

    const [supervisores, logistica, novosNegocios, expansao] = itens()
    expect(within(supervisores).getByText('Tarefa #40')).toBeInTheDocument()
    expect(within(logistica).getByText('Tarefa #41')).toBeInTheDocument()
    expect(ROTULO_AGUARDANDO_ENVIO).toBe('Aguardando envio ao Bitrix')
    expect(within(novosNegocios).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(novosNegocios).queryByText(/Tarefa #/)).not.toBeInTheDocument()
    expect(within(expansao).queryByText(/Tarefa #/)).not.toBeInTheDocument()
    expect(within(expansao).queryByText('Aguardando envio ao Bitrix')).not.toBeInTheDocument()
  })

  it('tem o link "Ver dashboards" para /dashboards, que leva à aba Dashboards', async () => {
    const user = usuarioRapido()
    renderizar({ dashboards: [SUPERVISORES] })

    const link = within(regiao()).getByRole('link', { name: 'Ver dashboards' })
    expect(link).toHaveAttribute('href', '/dashboards')

    await user.click(link)

    expect(screen.getByRole('heading', { name: 'Tela de dashboards' })).toBeInTheDocument()
  })

  it('lista vazia: "Nenhum dashboard em construção." e o link continua', () => {
    renderizar({ dashboards: [] })

    expect(within(regiao()).getByText(MENSAGEM_VAZIA)).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).getByRole('link', { name: 'Ver dashboards' })).toBeInTheDocument()
  })

  it('falha: aviso curto, sem role="alert", sem lista e sem a mensagem de vazio; o link continua', () => {
    renderizar({ dashboards: null, erro: 'Erro interno do servidor.' })

    expect(within(regiao()).getByText(MENSAGEM_FALHA)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).queryByText(MENSAGEM_VAZIA)).not.toBeInTheDocument()
    expect(within(regiao()).getByRole('link', { name: 'Ver dashboards' })).toBeInTheDocument()
  })

  it('carregando: região com o título, sem lista, sem mensagem de vazio e sem aviso de falha', () => {
    renderizar({ dashboards: null, carregando: true })

    expect(within(regiao()).getByRole('heading', { name: TITULO })).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).queryByText(MENSAGEM_VAZIA)).not.toBeInTheDocument()
    expect(within(regiao()).queryByText(MENSAGEM_FALHA)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
