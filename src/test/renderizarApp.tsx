/**
 * Renderiza a aplicação completa (SessaoProvider + rotas reais) em um roteador de memória,
 * para os testes de integração dos fluxos de acesso, layout e navegação.
 */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { rotas } from '../rotas'
import { SessaoProvider } from '../sessao/SessaoProvider'

export function renderizarApp(caminhoInicial = '/') {
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminhoInicial] })
  const resultado = render(
    <SessaoProvider>
      <RouterProvider router={roteador} />
    </SessaoProvider>,
  )
  return { ...resultado, roteador }
}
