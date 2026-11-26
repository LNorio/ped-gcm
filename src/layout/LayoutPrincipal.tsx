/**
 * Layout principal da aplicação (F2.3 — RF-01, RF-02, RNF-06): cabeçalho azul com a marca,
 * o seletor de filial e os dados do usuário; barra de abas conforme as permissões do perfil;
 * conteúdo da rota filha (`Outlet`) e rodapé institucional.
 *
 * F6.3 (RF-33): monta o `AlertasMenuProvider` em volta das abas e do conteúdo; a aba que estiver em
 * `abasComAlerta` ganha o marcador "Com alertas" e a classe `layout-principal__aba--com-alerta`.
 * F2.12: a barra de abas monta o verificador central (`GET /api/ped/alertas-menu`) e o marcador ganha
 * como dica (`title`) as descrições dos alertas da aba.
 *
 * F2.9: o conteúdo da aba fica num `Suspense` (as páginas são carregadas sob demanda); enquanto o
 * chunk baixa, o `<main>` mostra "Carregando..." e o cabeçalho, as abas e o rodapé seguem visíveis.
 * A `key` pelo `pathname` é necessária porque o React Router navega dentro de `startTransition`:
 * sem ela, a aba anterior ficaria na tela durante o download em vez do "Carregando...".
 *
 * F12.1 (RNF-05): link "Pular para o conteúdo" como primeiro focável, levando o foco ao
 * `<main id="conteudo">` (M4); título do documento "{Aba} · PED" e foco no `<h1>` da página nova ao
 * navegar pelas abas (M5); a dica do marcador "Com alertas" é a descrição acessível dele
 * (`aria-describedby`), num texto visualmente oculto fora do link (M6).
 * F12.2 (RNF-04): na troca de rota, a aba ativa é rolada para a área visível da barra de abas.
 *
 * Deve ser usado dentro de `SessaoProvider` e de um roteador. Tolera `acesso === null`
 * (sessão ainda carregando) sem quebrar: o cabeçalho fica sem os dados do usuário.
 */
import { Suspense, useCallback, useEffect, useId, useRef, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CAMINHO_DA_ABA } from '../caminhos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
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
import { useVerificadorAlertasMenu } from './useVerificadorAlertasMenu'
import './LayoutPrincipal.css'

/** `id` do `<main>`, destino do link "Pular para o conteúdo" (M4). */
const ID_CONTEUDO = 'conteudo'

/** Tempo máximo (ms) de espera pelo `<h1>` de uma página carregada sob demanda. */
const ESPERA_TITULO_MS = 10000

/** Aba cujo caminho é exatamente o informado (barra final ignorada); `null` fora das abas (ex.: 404). */
function abaDoCaminho(caminho: string): Aba | null {
  const normalizado = caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho
  const entrada = (Object.entries(CAMINHO_DA_ABA) as [Aba, string][]).find(([, alvo]) => alvo === normalizado)
  return entrada ? entrada[0] : null
}

/**
 * Foca o `<h1>` do conteúdo (com `tabIndex=-1`, se ainda não tiver). Devolve `false` se ele ainda não
 * existe. Se o usuário já levou o foco para dentro do conteúdo, não o tira de lá.
 */
function focarTitulo(principal: HTMLElement): boolean {
  const titulo = principal.querySelector<HTMLElement>('h1')
  if (!titulo) return false
  const ativo = document.activeElement
  const focoNoConteudo = ativo !== null && ativo !== principal && principal.contains(ativo)
  if (!focoNoConteudo) {
    if (!titulo.hasAttribute('tabindex')) titulo.tabIndex = -1
    titulo.focus()
  }
  return true
}

/**
 * Barra de abas; lê o sinal de alerta e a dica do contexto (precisa estar dentro do `AlertasMenuProvider`)
 * e monta o verificador central dos alertas do menu (F2.12).
 */
function BarraAbas({
  abas,
  onNavegar,
}: {
  abas: readonly Aba[]
  /** Clique numa aba: o caminho da aba e o caminho atual (de onde se navega). */
  onNavegar: (caminho: string, origem: string) => void
}) {
  useVerificadorAlertasMenu()
  const { abasComAlerta, dicas } = useAlertasMenu()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const idDica = useId()

  // F12.2: em telas estreitas a barra rola na horizontal; a aba ativa é trazida para a área visível.
  useEffect(() => {
    const ativa = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]')
    ativa?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
  }, [pathname])

  return (
    <nav ref={navRef} className="layout-principal__abas" aria-label="Abas">
      <ul className="layout-principal__lista-abas">
        {abas.map((aba) => {
          const comAlerta = abasComAlerta.has(aba)
          const dica = comAlerta ? dicas[aba] || '' : ''
          const idDicaAba = `${idDica}-${aba}`
          return (
            <li key={aba}>
              <NavLink
                to={CAMINHO_DA_ABA[aba]}
                end={aba === 'inicio'}
                onClick={() => onNavegar(CAMINHO_DA_ABA[aba], pathname)}
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
                  <span
                    role="img"
                    aria-label="Com alertas"
                    title={dica || undefined}
                    aria-describedby={dica ? idDicaAba : undefined}
                    className="layout-principal__alerta"
                  />
                ) : null}
              </NavLink>
              {/* M6: a dica fica fora do link para não mudar o nome dele; é a descrição do marcador. */}
              {dica ? (
                <span id={idDicaAba} className="visualmente-oculto">
                  {dica}
                </span>
              ) : null}
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
  const principalRef = useRef<HTMLElement>(null)
  /**
   * Navegação pedida pela barra de abas: o caminho escolhido e o caminho onde o clique aconteceu.
   * Ao chegar no destino, o foco vai para o `<h1>` da página.
   */
  const destinoPelaAbaRef = useRef<{ caminho: string; origem: string } | null>(null)

  const abaAtual = abaDoCaminho(location.pathname)
  useTituloDocumento(abaAtual ? ROTULOS_ABA[abaAtual] : null)

  // M5: depois de navegar pelas abas, o foco vai para o `<h1>` da página nova. As páginas são
  // carregadas sob demanda: se o `<h1>` ainda não existe, espera ele aparecer no `<main>`.
  //
  // O destino só é descartado quando a rota mudou de fato: se o efeito ainda é o da rota de origem
  // (o efeito da montagem pode ficar pendente e o React o executa ao processar o clique, depois do
  // `onClick` da aba), o destino é mantido para a rota nova. Sem isso, o foco ficava no link da aba.
  useEffect(() => {
    const destino = destinoPelaAbaRef.current
    if (!destino || location.pathname === destino.origem) return undefined
    destinoPelaAbaRef.current = null
    const principal = principalRef.current
    if (destino.caminho !== location.pathname || !principal) return undefined
    if (focarTitulo(principal)) return undefined
    if (typeof MutationObserver === 'undefined') return undefined

    const observador = new MutationObserver(() => {
      if (focarTitulo(principal)) observador.disconnect()
    })
    observador.observe(principal, { childList: true, subtree: true })
    const temporizador = setTimeout(() => observador.disconnect(), ESPERA_TITULO_MS)
    return () => {
      observador.disconnect()
      clearTimeout(temporizador)
    }
  }, [location.pathname])

  const aoNavegarPelaAba = useCallback((caminho: string, origem: string) => {
    destinoPelaAbaRef.current = { caminho, origem }
  }, [])

  const pularParaConteudo = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    principalRef.current?.focus()
  }

  const valorFilial =
    filialSelecionada === TODAS_AS_FILIAIS ? TODAS_AS_FILIAIS : (filialSelecionada?.codigo ?? '')

  return (
    <div className="layout-principal">
      <a href={`#${ID_CONTEUDO}`} className="layout-principal__pular" onClick={pularParaConteudo}>
        Pular para o conteúdo
      </a>

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
        <BarraAbas abas={abas} onNavegar={aoNavegarPelaAba} />

        <main ref={principalRef} id={ID_CONTEUDO} tabIndex={-1} className="layout-principal__conteudo">
          <Suspense key={location.pathname} fallback={<RegiaoStatus mensagem="Carregando..." />}>
            <Outlet />
          </Suspense>
        </main>
      </AlertasMenuProvider>

      <Rodape />
    </div>
  )
}
