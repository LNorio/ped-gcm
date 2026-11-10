/**
 * Layout principal da aplicação (F2.3 — RF-01, RF-02, RNF-06): cabeçalho azul com a marca,
 * o seletor de filial e os dados do usuário; barra de abas conforme as permissões do perfil;
 * conteúdo da rota filha (`Outlet`) e rodapé institucional.
 *
 * F6.3 (RF-33): monta o `AlertasMenuProvider` em volta das abas e do conteúdo; a aba que estiver em
 * `abasComAlerta` ganha o marcador "Com alertas" e a classe `layout-principal__aba--com-alerta`.
 *
 * F2.9: o conteúdo da aba fica num `Suspense` (as páginas são carregadas sob demanda); enquanto o
 * chunk baixa, o `<main>` mostra "Carregando..." e o cabeçalho, as abas e o rodapé seguem visíveis.
 * A `key` pelo `pathname` é necessária porque o React Router navega dentro de `startTransition`:
 * sem ela, a aba anterior ficaria na tela durante o download em vez do "Carregando...".
 *
 * Deve ser usado dentro de `SessaoProvider` e de um roteador. Tolera `acesso === null`
 * (sessão ainda carregando) sem quebrar: o cabeçalho fica sem os dados do usuário.
 */
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CAMINHO_DA_ABA } from '../caminhos'
import { Botao } from '../components/Botao'
import { Etiqueta } from '../components/Etiqueta'
import { Marca } from '../components/Marca'
import { RegiaoStatus } from '../components/RegiaoStatus'
import { Rodape } from '../components/Rodape'
import { ROTULOS_ABA, type Aba } from '../sessao/permissoes'
import { useSessao } from '../sessao/SessaoProvider'
import { usePermissoes } from '../sessao/usePermissoes'
import { ROTULOS_PERFIL } from '../types/dominio'
import { TODAS_AS_FILIAIS } from '../sessao/filial'
import { AlertasMenuProvider, useAlertasMenu } from './AlertasMenu'
import { SeletorFilial } from './SeletorFilial'
import './LayoutPrincipal.css'

/** Barra de abas; lê o sinal de alerta do contexto (precisa estar dentro do `AlertasMenuProvider`). */
function BarraAbas({ abas }: { abas: readonly Aba[] }) {
  const { abasComAlerta } = useAlertasMenu()

  return (
    <nav className="layout-principal__abas" aria-label="Abas">
      <ul className="layout-principal__lista-abas">
        {abas.map((aba) => {
          const comAlerta = abasComAlerta.has(aba)
          return (
            <li key={aba}>
              <NavLink
                to={CAMINHO_DA_ABA[aba]}
                end={aba === 'inicio'}
                className={({ isActive }) =>
                  [
                    isActive ? 'layout-principal__aba layout-principal__aba--ativa' : 'layout-principal__aba',
                    comAlerta ? 'layout-principal__aba--com-alerta' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {ROTULOS_ABA[aba]}
                {comAlerta ? (
                  <span role="img" aria-label="Com alertas" className="layout-principal__alerta" />
                ) : null}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function LayoutPrincipal() {
  const { acesso, filialSelecionada, selecionarFilial, sair } = useSessao()
  const { abas } = usePermissoes()
  const location = useLocation()

  const valorFilial =
    filialSelecionada === TODAS_AS_FILIAIS ? TODAS_AS_FILIAIS : (filialSelecionada?.codigo ?? '')

  return (
    <div className="layout-principal">
      <header className="layout-principal__cabecalho">
        <div className="layout-principal__cabecalho-conteudo">
          <Marca className="layout-principal__marca" />
          <span className="layout-principal__sistema">PED</span>

          {acesso ? (
            <SeletorFilial
              filiais={acesso.filiais}
              todasAsFiliais={acesso.todasAsFiliais}
              valor={valorFilial}
              onChange={selecionarFilial}
            />
          ) : null}

          <div className="layout-principal__usuario">
            {acesso ? <span className="layout-principal__saudacao">Olá, {acesso.nome}</span> : null}
            {acesso?.perfil ? <Etiqueta tom="dourado">{ROTULOS_PERFIL[acesso.perfil]}</Etiqueta> : null}
            <Botao variante="sobre-primaria" className="layout-principal__sair" onClick={sair}>
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <AlertasMenuProvider>
        <BarraAbas abas={abas} />

        <main className="layout-principal__conteudo">
          <Suspense key={location.pathname} fallback={<RegiaoStatus mensagem="Carregando..." />}>
            <Outlet />
          </Suspense>
        </main>
      </AlertasMenuProvider>

      <Rodape />
    </div>
  )
}
