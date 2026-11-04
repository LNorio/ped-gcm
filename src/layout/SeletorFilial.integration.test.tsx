import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../services/sessao'
import { SessaoProvider, useSessao } from '../sessao/SessaoProvider'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../test/apiFalsa'
import { LayoutPrincipal } from './LayoutPrincipal'

/** Página de exemplo que lê a filial selecionada da sessão, como as abas farão. */
function PaginaQueUsaFilial() {
  const { filialSelecionada } = useSessao()
  const texto =
    filialSelecionada === 'todas'
      ? 'Todas as filiais'
      : filialSelecionada === null
        ? 'Nenhuma'
        : `${filialSelecionada.codigo} - ${filialSelecionada.nome}`
  return <p>Filial de trabalho: {texto}</p>
}

function renderizar() {
  return render(
    <SessaoProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<LayoutPrincipal />}>
            <Route path="/" element={<PaginaQueUsaFilial />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessaoProvider>,
  )
}

describe('F2.4 — Seletor de filial (integração: cabeçalho + sessão)', () => {
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

  it('Admin: começa em "Todas as filiais"; escolher uma filial no cabeçalho muda a filial disponível às abas', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
    })
    renderizar()

    expect(await screen.findByText('Filial de trabalho: Todas as filiais')).toBeInTheDocument()
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    expect(seletor).toHaveValue('todas')

    await user.selectOptions(seletor, '102')

    expect(seletor).toHaveValue('102')
    expect(screen.getByText('Filial de trabalho: 102 - DOURADOS')).toBeInTheDocument()

    await user.selectOptions(seletor, 'todas')

    expect(screen.getByText('Filial de trabalho: Todas as filiais')).toBeInTheDocument()
  })

  it('Validador: também vê o seletor livre com "Todas as filiais"', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil: 'validador', 'todas as filiais': true, filiais: FILIAIS_API })),
    })
    renderizar()

    await screen.findByText('Filial de trabalho: Todas as filiais')
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Todas as filiais',
      '100 - MATRIZ',
      '101 - CAMPO GRANDE',
      '102 - DOURADOS',
    ])
  })

  it('Preenchedor com uma filial: filial fixa no cabeçalho, sem seletor, e já disponível às abas', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'preenchedor', filiais: [FILIAIS_API[1]] })),
    })
    renderizar()

    expect(await screen.findByText('Filial de trabalho: 101 - CAMPO GRANDE')).toBeInTheDocument()
    const cabecalho = screen.getByRole('banner')
    expect(within(cabecalho).queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument()
    expect(within(cabecalho).getByText('101 - CAMPO GRANDE')).toBeInTheDocument()
  })

  it('Preenchedor com várias filiais: seletor restrito a elas, sem "Todas as filiais", e a troca reflete nas abas', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil: 'preenchedor', filiais: [FILIAIS_API[1], FILIAIS_API[2]] })),
    })
    renderizar()

    expect(await screen.findByText('Filial de trabalho: 101 - CAMPO GRANDE')).toBeInTheDocument()
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      '101 - CAMPO GRANDE',
      '102 - DOURADOS',
    ])

    await user.selectOptions(seletor, '102')

    expect(screen.getByText('Filial de trabalho: 102 - DOURADOS')).toBeInTheDocument()
  })
})
