import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import { INDICADOR_ABSENTEISMO_API } from '../../test/inicioBlocosFalsos'
import { INDICADOR_DEVOLUCOES_API, INDICADOR_TICKET_MEDIO_API } from '../../test/indicadoresFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { IndicadoresMetaPendenteInicio, type IndicadoresMetaPendenteInicioProps } from './IndicadoresMetaPendenteInicio'

const ABSENTEISMO = paraIndicador(INDICADOR_ABSENTEISMO_API)
const DEVOLUCOES = paraIndicador(INDICADOR_DEVOLUCOES_API)
const TICKET_MEDIO = paraIndicador(INDICADOR_TICKET_MEDIO_API)
const SEM_TIPOS: Indicador = { ...TICKET_MEDIO, id: 99, nome: 'Indicador sem tipos', tipos: [] }

const TITULO = 'Indicadores com meta pendente'
const MENSAGEM_VAZIA = 'Nenhum indicador com meta pendente.'
const MENSAGEM_FALHA = 'Não foi possível carregar os indicadores com meta pendente.'

function renderizar(props: Partial<IndicadoresMetaPendenteInicioProps> = {}) {
  const completas: IndicadoresMetaPendenteInicioProps = { indicadores: [], carregando: false, erro: null, ...props }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<IndicadoresMetaPendenteInicio {...completas} />} />
        <Route path="/indicadores" element={<h1>Tela de indicadores</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const regiao = () => screen.getByRole('region', { name: TITULO })
const itens = () => within(regiao()).getAllByRole('listitem')

/**
 * F11.6 — Painel "Indicadores com meta pendente" do Início (`src/pages/inicio/IndicadoresMetaPendenteInicio.tsx`).
 *
 * Props: `{ indicadores: Indicador[] | null; carregando: boolean; erro: string | null }`. Card (região) com o
 * título "Indicadores com meta pendente" e uma lista com um item por indicador, na ordem recebida. Cada item
 * mostra o nome do indicador e, quando houver:
 * - "Tipos: {tipo1}, {tipo2}" (tipos do indicador, na ordem);
 * - "Filiais sem meta: {c1}, {c2}" (`filiaisSemMeta`, na ordem).
 * O painel sempre tem o link "Ver indicadores" para `/indicadores`. Lista vazia: "Nenhum indicador com meta
 * pendente.". Com `erro`: só o aviso curto "Não foi possível carregar os indicadores com meta pendente." —
 * **sem** `role="alert"` (a falha não derruba nem "grita" na tela Início). Carregando (sem itens): nem lista,
 * nem mensagem de vazio, nem aviso de falha.
 */
describe('F11.6 — IndicadoresMetaPendenteInicio (painel de indicadores com meta pendente)', () => {
  it('região com o título e um item por indicador, na ordem recebida', () => {
    renderizar({ indicadores: [ABSENTEISMO, DEVOLUCOES, TICKET_MEDIO] })

    expect(within(regiao()).getByRole('heading', { name: TITULO })).toBeInTheDocument()
    const encontrados = itens()
    expect(encontrados).toHaveLength(3)
    expect(within(encontrados[0]).getByText('Absenteísmo por filial')).toBeInTheDocument()
    expect(within(encontrados[1]).getByText('Devoluções de venda')).toBeInTheDocument()
    expect(within(encontrados[2]).getByText('Ticket médio por filial')).toBeInTheDocument()
  })

  it('cada item mostra os tipos e as filiais sem meta, quando houver', () => {
    renderizar({ indicadores: [ABSENTEISMO, DEVOLUCOES, TICKET_MEDIO] })

    const [absenteismo, devolucoes, ticket] = itens()
    expect(within(absenteismo).getByText('Tipos: Logística, Financeiro')).toBeInTheDocument()
    expect(within(absenteismo).getByText('Filiais sem meta: 100, 101, 102')).toBeInTheDocument()
    expect(within(ticket).getByText('Tipos: Comercial')).toBeInTheDocument()
    expect(within(ticket).getByText('Filiais sem meta: 101, 102')).toBeInTheDocument()
    // Sem meta nenhuma e sem filiais pendentes: só os tipos.
    expect(within(devolucoes).getByText('Tipos: Comercial')).toBeInTheDocument()
    expect(within(devolucoes).queryByText(/Filiais sem meta/)).not.toBeInTheDocument()
  })

  it('indicador sem tipos não mostra a linha "Tipos:"', () => {
    renderizar({ indicadores: [SEM_TIPOS] })

    const [item] = itens()
    expect(within(item).getByText('Indicador sem tipos')).toBeInTheDocument()
    expect(within(item).queryByText(/Tipos:/)).not.toBeInTheDocument()
    expect(within(item).getByText('Filiais sem meta: 101, 102')).toBeInTheDocument()
  })

  it('tem o link "Ver indicadores" para /indicadores, que leva à aba Indicadores', async () => {
    const user = usuarioRapido()
    renderizar({ indicadores: [DEVOLUCOES] })

    const link = within(regiao()).getByRole('link', { name: 'Ver indicadores' })
    expect(link).toHaveAttribute('href', '/indicadores')

    await user.click(link)

    expect(screen.getByRole('heading', { name: 'Tela de indicadores' })).toBeInTheDocument()
  })

  it('lista vazia: "Nenhum indicador com meta pendente." e o link continua', () => {
    renderizar({ indicadores: [] })

    expect(within(regiao()).getByText(MENSAGEM_VAZIA)).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).getByRole('link', { name: 'Ver indicadores' })).toBeInTheDocument()
  })

  it('falha: aviso curto, sem role="alert", sem lista e sem a mensagem de vazio; o link continua', () => {
    renderizar({ indicadores: null, erro: 'Erro interno do servidor.' })

    expect(within(regiao()).getByText(MENSAGEM_FALHA)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).queryByText(MENSAGEM_VAZIA)).not.toBeInTheDocument()
    expect(within(regiao()).getByRole('link', { name: 'Ver indicadores' })).toBeInTheDocument()
  })

  it('carregando: região com o título, sem lista, sem mensagem de vazio e sem aviso de falha', () => {
    renderizar({ indicadores: null, carregando: true })

    expect(within(regiao()).getByRole('heading', { name: TITULO })).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).queryByText(MENSAGEM_VAZIA)).not.toBeInTheDocument()
    expect(within(regiao()).queryByText(MENSAGEM_FALHA)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
