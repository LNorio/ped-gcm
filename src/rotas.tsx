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
 *
 * F2.9 (desempenho da primeira carga): as páginas das abas e a 404 são carregadas sob demanda
 * (`React.lazy` + `import()` dinâmico) — cada uma vira um chunk próprio, baixado só ao abrir a aba.
 * O `Suspense` fica no `LayoutPrincipal`, em volta do `Outlet`. Falha ao baixar um chunk cai no
 * `errorElement` (`ErroPage`). `LoginPage`, `SemAcessoPage` e `ErroPage` continuam com import
 * estático: são a entrada da aplicação e o fallback de erro (precisa existir mesmo sem rede).
 *
 * Desempenho da primeira abertura do Início: o chunk do Início é **pré-carregado** quando este
 * módulo é avaliado (carga do app), em paralelo com `GET /api/ped/acesso`. Quando a sessão fica
 * autenticada, o módulo já chegou e o `lazy` resolve na primeira renderização, sem suspender (sem o
 * "Carregando..." do `Suspense` e sem a espera mínima do React ao revelar o conteúdo). O Início
 * continua num chunk próprio; as demais abas só são baixadas ao abrir.
 *
 * Além disso, uma rota pode antecipar as próprias consultas pelo `handle.aoObterAcesso`: enquanto a
 * sessão salva é restaurada, `AntecipacaoDaRota` ouve o acesso das rotas abertas e as chama assim que o
 * acesso chega, antes de a tela renderizar. O Início usa isso para disparar `GET /api/ped/inicio` (e as
 * pendências do Admin e do Validador) em paralelo com a renderização do layout; a primeira renderização
 * da página já pode sair com os dados.
 */
import { lazy, useEffect, type ReactNode } from 'react'
import { Navigate, useMatches, type RouteObject } from 'react-router-dom'
import { CAMINHOS } from './caminhos'
import { RegiaoStatus } from './components/RegiaoStatus'
import { LayoutPrincipal } from './layout/LayoutPrincipal'
import { ErroPage } from './pages/erro/ErroPage'
import { LoginPage } from './pages/login/LoginPage'
import { SemAcessoPage } from './pages/sem-acesso/SemAcessoPage'
import { ouvirAcessoObtido, type AcessoObtido } from './sessao/acessoObtido'
import type { Aba } from './sessao/permissoes'
import { useSessao } from './sessao/SessaoProvider'
import { usePermissoes } from './sessao/usePermissoes'
import { preCarregar } from './utils/preCarga'

export { CAMINHOS, CAMINHO_DA_ABA } from './caminhos'

// Páginas sob demanda (F2.9): cada `import()` gera um chunk próprio na build; os módulos mantêm
// os exports nomeados, adaptados aqui ao `default` exigido por `lazy`.
// O Início é a primeira tela depois do acesso: a pré-carga começa já na carga do app.
const paginaInicio = preCarregar(() => import('./pages/inicio/InicioPage'))
const InicioPage = lazy(() => paginaInicio.carregar().then((m) => ({ default: m.InicioPage })))
const TiposPage = lazy(() => import('./pages/tipos/TiposPage').then((m) => ({ default: m.TiposPage })))
const ApontamentosPage = lazy(() => import('./pages/apontamentos/ApontamentosPage').then((m) => ({ default: m.ApontamentosPage })))
const DadosExternosPage = lazy(() => import('./pages/dados-externos/DadosExternosPage').then((m) => ({ default: m.DadosExternosPage })))
const IndicadoresPage = lazy(() => import('./pages/indicadores/IndicadoresPage').then((m) => ({ default: m.IndicadoresPage })))
const DashboardsPage = lazy(() => import('./pages/dashboards/DashboardsPage').then((m) => ({ default: m.DashboardsPage })))
const FaixasPage = lazy(() => import('./pages/faixas/FaixasPage').then((m) => ({ default: m.FaixasPage })))
const PreenchimentoPage = lazy(() => import('./pages/preenchimento/PreenchimentoPage').then((m) => ({ default: m.PreenchimentoPage })))
const FechamentosPage = lazy(() => import('./pages/fechamentos/FechamentosPage').then((m) => ({ default: m.FechamentosPage })))
const NaoEncontradaPage = lazy(() => import('./pages/nao-encontrada/NaoEncontradaPage').then((m) => ({ default: m.NaoEncontradaPage })))

/** Dados extras de uma rota (`handle` do React Router). */
interface HandleRota {
  /** Chamado quando a sessão restaurada obtém o acesso com esta rota aberta, antes de a tela renderizar. */
  aoObterAcesso?: (obtido: AcessoObtido) => void
}

/**
 * Enquanto a sessão salva é restaurada, ouve o acesso para as rotas abertas que antecipam as próprias
 * consultas (`handle.aoObterAcesso`). Não renderiza nada.
 */
function AntecipacaoDaRota() {
  const { estado } = useSessao()
  const rotasAbertas = useMatches()

  useEffect(() => {
    if (estado !== 'carregando') return undefined
    const antecipacoes = rotasAbertas.flatMap((rota) => {
      const aoObterAcesso = (rota.handle as HandleRota | undefined)?.aoObterAcesso
      return aoObterAcesso ? [aoObterAcesso] : []
    })
    if (antecipacoes.length === 0) return undefined
    return ouvirAcessoObtido((obtido) => {
      for (const antecipar of antecipacoes) antecipar(obtido)
    })
  }, [estado, rotasAbertas])

  return null
}

/** Início: antecipa as consultas se o chunk já chegou (senão, a página consulta ao montar). */
const HANDLE_INICIO: HandleRota = {
  aoObterAcesso: (obtido) => paginaInicio.carregado()?.preConsultarInicio(obtido),
}

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
      <>
        <AntecipacaoDaRota />
        <RotaProtegida>
          <LayoutPrincipal />
        </RotaProtegida>
      </>
    ),
    errorElement: <ErroPage />,
    children: [
      { index: true, element: <InicioPage />, handle: HANDLE_INICIO },
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
