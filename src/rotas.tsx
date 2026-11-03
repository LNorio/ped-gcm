/**
 * Rotas da aplicação (F2.3 — RF-02, RF-03, RF-04).
 *
 * - `/login` e `/sem-acesso` ficam fora do layout principal.
 * - Todas as abas ficam sob `RotaProtegida` + `LayoutPrincipal`; cada aba tem ainda o guard
 *   `RotaAba`, que devolve ao Início quem não tem permissão para ela (`podeAcessar`).
 * - Qualquer outra URL (`*`) cai em `NaoEncontradaPage`, também dentro do layout e protegida
 *   (anônimos vão ao login antes de ver o 404); a URL é preservada.
 * - Erros de renderização em qualquer rota caem em `ErroPage` (`errorElement`), em português e
 *   sem a mensagem técnica.
 *
 * As decisões de tela dependem apenas do estado da sessão (`useSessao`); o provider não navega.
 */
import type { ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { CAMINHOS } from './caminhos'
import { RegiaoStatus } from './components/RegiaoStatus'
import { LayoutPrincipal } from './layout/LayoutPrincipal'
import { ApontamentosPage } from './pages/apontamentos/ApontamentosPage'
import { DadosExternosPage } from './pages/dados-externos/DadosExternosPage'
import { DashboardsPage } from './pages/dashboards/DashboardsPage'
import { ErroPage } from './pages/erro/ErroPage'
import { FaixasPage } from './pages/faixas/FaixasPage'
import { FechamentosPage } from './pages/fechamentos/FechamentosPage'
import { IndicadoresPage } from './pages/indicadores/IndicadoresPage'
import { InicioPage } from './pages/inicio/InicioPage'
import { LoginPage } from './pages/login/LoginPage'
import { NaoEncontradaPage } from './pages/nao-encontrada/NaoEncontradaPage'
import { PreenchimentoPage } from './pages/preenchimento/PreenchimentoPage'
import { SemAcessoPage } from './pages/sem-acesso/SemAcessoPage'
import { TiposPage } from './pages/tipos/TiposPage'
import type { Aba } from './sessao/permissoes'
import { useSessao } from './sessao/SessaoProvider'
import { usePermissoes } from './sessao/usePermissoes'

export { CAMINHOS, CAMINHO_DA_ABA } from './caminhos'

/** Exige sessão autenticada: redireciona anônimos ao login e usuários sem perfil à tela de sem acesso. */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const { estado } = useSessao()

  switch (estado) {
    case 'carregando':
      return <RegiaoStatus mensagem="Carregando..." />
    case 'anonimo':
      return <Navigate to={CAMINHOS.login} replace />
    case 'sem-acesso':
      return <Navigate to={CAMINHOS.semAcesso} replace />
    case 'autenticado':
      return children
  }
}

/**
 * Tela de login; quem já está autenticado é levado ao Início e quem está logado sem perfil, à
 * tela de sem acesso (consistente com `RotaProtegida`). Enquanto a sessão salva é restaurada,
 * mostra apenas o status (evita exibir o formulário por um instante e um envio com o token
 * antigo no cabeçalho).
 */
function RotaLogin() {
  const { estado } = useSessao()
  if (estado === 'carregando') return <RegiaoStatus mensagem="Carregando..." />
  if (estado === 'autenticado') return <Navigate to={CAMINHOS.inicio} replace />
  if (estado === 'sem-acesso') return <Navigate to={CAMINHOS.semAcesso} replace />
  return <LoginPage />
}

/** Guard de aba: perfis sem permissão para a aba voltam ao Início. */
function RotaAba({ aba, children }: { aba: Aba; children: ReactNode }) {
  const { pode } = usePermissoes()
  if (!pode(aba)) return <Navigate to={CAMINHOS.inicio} replace />
  return children
}

// A tabela de rotas fica junto dos guards por contrato dos testes (F2.3) e de `renderizarApp`.
// oxlint-disable-next-line react/only-export-components
export const rotas: RouteObject[] = [
  { path: CAMINHOS.login, element: <RotaLogin />, errorElement: <ErroPage /> },
  { path: CAMINHOS.semAcesso, element: <SemAcessoPage />, errorElement: <ErroPage /> },
  {
    path: CAMINHOS.inicio,
    element: (
      <RotaProtegida>
        <LayoutPrincipal />
      </RotaProtegida>
    ),
    errorElement: <ErroPage />,
    children: [
      { index: true, element: <InicioPage /> },
      {
        path: 'tipos',
        element: (
          <RotaAba aba="tipos">
            <TiposPage />
          </RotaAba>
        ),
      },
      {
        path: 'apontamentos',
        element: (
          <RotaAba aba="apontamentos">
            <ApontamentosPage />
          </RotaAba>
        ),
      },
      {
        path: 'dados-externos',
        element: (
          <RotaAba aba="dados-externos">
            <DadosExternosPage />
          </RotaAba>
        ),
      },
      {
        path: 'indicadores',
        element: (
          <RotaAba aba="indicadores">
            <IndicadoresPage />
          </RotaAba>
        ),
      },
      {
        path: 'faixas',
        element: (
          <RotaAba aba="faixas">
            <FaixasPage />
          </RotaAba>
        ),
      },
      {
        path: 'dashboards',
        element: (
          <RotaAba aba="dashboards">
            <DashboardsPage />
          </RotaAba>
        ),
      },
      {
        path: 'preenchimento',
        element: (
          <RotaAba aba="preenchimento">
            <PreenchimentoPage />
          </RotaAba>
        ),
      },
      {
        path: 'fechamentos',
        element: (
          <RotaAba aba="fechamentos">
            <FechamentosPage />
          </RotaAba>
        ),
      },
      // Qualquer URL não prevista (inclusive aninhadas, ex.: /tipos/abc) — fica atrás de
      // `RotaProtegida` e dentro do layout; a URL é preservada.
      { path: '*', element: <NaoEncontradaPage /> },
    ],
  },
]
