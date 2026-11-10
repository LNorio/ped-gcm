import { act, render, screen, within } from '@testing-library/react'
import { lazy, type ComponentType } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { usuarioRapido } from '../test/usuario'
import { LayoutPrincipal } from './LayoutPrincipal'

/** Página "sob demanda" cujo carregamento só termina quando o teste chama `concluir()`. */
function paginaControlada() {
  let concluir: () => void = () => {}
  const Pagina = lazy(
    () =>
      new Promise<{ default: ComponentType }>((resolver) => {
        concluir = () => resolver({ default: () => <h1>Tipos</h1> })
      }),
  )
  return { Pagina, concluir: () => concluir() }
}

/** Layout com o Início (já carregado) e a aba Tipos sob demanda, no mesmo roteador usado pela aplicação. */
function renderizar(Pagina: ComponentType, caminho: string) {
  const roteador = createMemoryRouter(
    [
      {
        path: '/',
        element: <LayoutPrincipal />,
        children: [
          { index: true, element: <h1>Início</h1> },
          { path: 'tipos', element: <Pagina /> },
        ],
      },
    ],
    { initialEntries: [caminho] },
  )
  render(
    <ProvedorSessaoFalso
      sessao={{ estado: 'autenticado', acesso: acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS }) }}
    >
      <RouterProvider router={roteador} />
    </ProvedorSessaoFalso>,
  )
  return roteador
}

function esperarLayoutVisivel() {
  expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
  expect(screen.getByRole('navigation', { name: 'Abas' })).toBeInTheDocument()
  expect(screen.getByRole('contentinfo')).toBeInTheDocument()
}

describe('F2.9 — Carregamento sob demanda das abas (LayoutPrincipal)', () => {
  it('abrindo a URL de uma aba que ainda carrega, mostra "Carregando..." no conteúdo, mantendo cabeçalho, abas e rodapé', async () => {
    const { Pagina } = paginaControlada()
    renderizar(Pagina, '/tipos')

    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent('Carregando...')
    esperarLayoutVisivel()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { level: 1, name: 'Tipos' })).not.toBeInTheDocument()
  })

  it('ao terminar o carregamento, a página substitui o "Carregando..." dentro do layout', async () => {
    const { Pagina, concluir } = paginaControlada()
    renderizar(Pagina, '/tipos')
    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent('Carregando...')

    await act(async () => {
      concluir()
    })

    expect(await within(screen.getByRole('main')).findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    esperarLayoutVisivel()
  })

  it('ao trocar de aba pelo menu, mostra "Carregando..." no lugar da aba anterior enquanto a nova carrega', async () => {
    const user = usuarioRapido()
    const { Pagina, concluir } = paginaControlada()
    const roteador = renderizar(Pagina, '/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()

    const abas = screen.getByRole('navigation', { name: 'Abas' })
    await user.click(within(abas).getByRole('link', { name: 'Tipos' }))

    // A aba anterior não fica na tela como se nada tivesse acontecido.
    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent('Carregando...')
    expect(screen.queryByRole('heading', { level: 1, name: 'Início' })).not.toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/tipos')
    expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')
    esperarLayoutVisivel()

    await act(async () => {
      concluir()
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
  })
})
