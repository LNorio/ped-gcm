import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import type { PeriodoEmAbertoInicio } from '../../types/dominio'
import { PeriodosEmAberto } from './PeriodosEmAberto'

const COMERCIAL: PeriodoEmAbertoInicio = {
  id: 1,
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  periodoAtual: '4º tri/2026',
  periodoEncerrado: false,
  filiaisAbertas: 3,
  progresso: { preenchidos: 5, total: 9 },
}

const GERENTES: PeriodoEmAbertoInicio = {
  id: 2,
  nome: 'PED Gerentes',
  periodicidade: 'mensal',
  periodoAtual: '10/2026',
  periodoEncerrado: false,
  filiaisAbertas: 2,
  progresso: { preenchidos: 1, total: 4 },
}

const VENDEDORES_ENCERRADO: PeriodoEmAbertoInicio = {
  id: 6,
  nome: 'PED Vendedores',
  periodicidade: 'anual',
  periodoAtual: '2026',
  periodoEncerrado: true,
  filiaisAbertas: 0,
  progresso: { preenchidos: 0, total: 0 },
}

function renderizar(periodos: PeriodoEmAbertoInicio[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PeriodosEmAberto periodos={periodos} />} />
        <Route path="/preenchimento" element={<h1>Tela de preenchimento</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const regiao = () => screen.getByRole('region', { name: 'Períodos em aberto' })
const itens = () => within(regiao()).getAllByRole('listitem')

/**
 * F11.4 — Lista "Períodos em aberto" do Início (`src/pages/inicio/PeriodosEmAberto.tsx`; RF-09, RF-10).
 *
 * Props: `{ periodos: PeriodoEmAbertoInicio[] }`. Card (região) com o título "Períodos em aberto" e uma
 * lista com um item por dashboard, na ordem recebida (a API ordena por nome). Cada item mostra:
 * - o nome do dashboard;
 * - "{Periodicidade} · período {período atual}" (ex.: "Mensal · período 10/2026");
 * - o progresso "{preenchidos} de {total} lançamentos";
 * - o link "Preencher" (nome acessível "Preencher {nome}") para a rota `/preenchimento`.
 * Período encerrado continua na lista, com "0 de 0 lançamentos". Sem dashboards: "Nenhum período em aberto.".
 */
describe('F11.4 — PeriodosEmAberto (lista de períodos em aberto)', () => {
  it('região "Períodos em aberto" com um item por dashboard, na ordem recebida', () => {
    renderizar([COMERCIAL, GERENTES, VENDEDORES_ENCERRADO])

    expect(within(regiao()).getByRole('heading', { name: 'Períodos em aberto' })).toBeInTheDocument()
    const encontrados = itens()
    expect(encontrados).toHaveLength(3)
    expect(within(encontrados[0]).getByText('PED Comercial')).toBeInTheDocument()
    expect(within(encontrados[1]).getByText('PED Gerentes')).toBeInTheDocument()
    expect(within(encontrados[2]).getByText('PED Vendedores')).toBeInTheDocument()
  })

  it('cada item mostra a periodicidade, o período atual e o progresso "X de Y lançamentos"', () => {
    renderizar([COMERCIAL, GERENTES])

    const [comercial, gerentes] = itens()
    expect(within(comercial).getByText('Trimestral · período 4º tri/2026')).toBeInTheDocument()
    expect(within(comercial).getByText('5 de 9 lançamentos')).toBeInTheDocument()
    expect(within(gerentes).getByText('Mensal · período 10/2026')).toBeInTheDocument()
    expect(within(gerentes).getByText('1 de 4 lançamentos')).toBeInTheDocument()
  })

  it('período encerrado continua na lista com "0 de 0 lançamentos"', () => {
    renderizar([VENDEDORES_ENCERRADO])

    const [vendedores] = itens()
    expect(within(vendedores).getByText('Anual · período 2026')).toBeInTheDocument()
    expect(within(vendedores).getByText('0 de 0 lançamentos')).toBeInTheDocument()
  })

  it('cada item tem o link "Preencher" (nome acessível "Preencher {dashboard}") para /preenchimento', () => {
    renderizar([COMERCIAL, GERENTES])

    const [comercial, gerentes] = itens()
    const linkComercial = within(comercial).getByRole('link', { name: 'Preencher PED Comercial' })
    expect(linkComercial).toHaveTextContent('Preencher')
    expect(linkComercial).toHaveAttribute('href', '/preenchimento')
    expect(within(gerentes).getByRole('link', { name: 'Preencher PED Gerentes' })).toHaveAttribute('href', '/preenchimento')
  })

  it('clicar em "Preencher" leva à tela de preenchimento', async () => {
    const user = usuarioRapido()
    renderizar([COMERCIAL])

    await user.click(screen.getByRole('link', { name: 'Preencher PED Comercial' }))

    expect(screen.getByRole('heading', { name: 'Tela de preenchimento' })).toBeInTheDocument()
  })

  it('sem dashboards: "Nenhum período em aberto." e nenhum link "Preencher"', () => {
    renderizar([])

    expect(within(regiao()).getByText('Nenhum período em aberto.')).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(regiao()).queryByRole('link', { name: /^Preencher/ })).not.toBeInTheDocument()
  })
})
