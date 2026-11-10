/**
 * Renderiza a aplicação completa (SessaoProvider + rotas reais) em um roteador de memória,
 * para os testes de integração dos fluxos de acesso, layout e navegação.
 *
 * F2.9: as páginas das abas são carregadas sob demanda (`import()` dinâmico em `rotas.tsx`). Nos
 * testes, o primeiro `import()` de uma página pesada inclui a transformação do módulo pelo Vitest,
 * o que pode passar do tempo padrão de `findBy*` e gerar falsos negativos. Por isso as páginas são
 * importadas aqui, de antemão: o `import()` das rotas encontra o módulo já carregado e a tela
 * aparece logo após o "Carregando..." (o carregamento em si é testado em
 * `src/rotas.sobDemanda.integration.test.tsx`, que não usa este utilitário).
 */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import '../pages/apontamentos/ApontamentosPage'
import '../pages/dados-externos/DadosExternosPage'
import '../pages/dashboards/DashboardsPage'
import '../pages/faixas/FaixasPage'
import '../pages/fechamentos/FechamentosPage'
import '../pages/indicadores/IndicadoresPage'
import '../pages/inicio/InicioPage'
import '../pages/nao-encontrada/NaoEncontradaPage'
import '../pages/preenchimento/PreenchimentoPage'
import '../pages/tipos/TiposPage'
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
