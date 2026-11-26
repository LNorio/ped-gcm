/**
 * Página pública `/resumo` (F2.14): diário de implementação e documentação do projeto, em duas abas,
 * para acompanhar o andamento pelo navegador sem conta no PED.
 *
 * - Fica fora do layout principal e de `RotaProtegida`; não chama a API (os textos vêm do build).
 * - Abas no padrão WAI-ARIA (como F9.5): tabindex móvel, setas ←/→ circulares, Home/End; ativação
 *   automática. A aba fica em `?aba=diario|documentacao`; sem `?aba` ou com valor inválido, o diário.
 * - Markdown por react-markdown + remark-gfm com `skipHtml`: o HTML cru do documento (inclusive as
 *   âncoras `<a id>` da documentação) é descartado — não vira elemento nem aparece como texto.
 * - Âncoras do índice: o `##` "DD/MM/AAAA" recebe o id "AAAA-MM-DD", destino dos links `#AAAA-MM-DD`.
 *   O clique rola até o destino sem mudar a rota nem a aba.
 * - Links http/https abrem em nova aba; qualquer outro destino (arquivo relativo, `.md`,
 *   `javascript:`) vira só texto.
 */
import { Children, isValidElement, useRef, type ComponentProps, type JSX, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { useSearchParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { Etiqueta } from '../../components/Etiqueta'
import { Marca } from '../../components/Marca'
import { Rodape } from '../../components/Rodape'
import { useTituloDocumento } from '../../hooks/useTituloDocumento'
import { DOCUMENTOS_RESUMO } from './documentosResumo'
import './ResumoPage.css'

type IdAba = 'diario' | 'documentacao'

const ABAS: readonly { id: IdAba; rotulo: string }[] = [
  { id: 'diario', rotulo: 'Diário de implementação' },
  { id: 'documentacao', rotulo: 'Documentação' },
]

const PLUGINS_REMARK = [remarkGfm]
const LINK_EXTERNO = /^https?:\/\//i
const DATA_DO_CABECALHO = /^(\d{2})\/(\d{2})\/(\d{4})$/

const idAba = (id: IdAba) => `resumo-aba-${id}`
const idPainel = (id: IdAba) => `resumo-painel-${id}`

function abaDaUrl(valor: string | null): IdAba {
  return ABAS.find((aba) => aba.id === valor)?.id ?? 'diario'
}

/** Texto puro dos filhos de um elemento React. */
function textoDe(filhos: ReactNode): string {
  return Children.toArray(filhos)
    .map((filho) => {
      if (typeof filho === 'string' || typeof filho === 'number') return String(filho)
      if (isValidElement<{ children?: ReactNode }>(filho)) return textoDe(filho.props.children)
      return ''
    })
    .join('')
}

function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto)
  } catch {
    return texto
  }
}

/** Âncora interna: rola até o destino sem passar pelo roteador (não muda pathname nem `?aba`). */
function irParaAncora(evento: MouseEvent<HTMLAnchorElement>, href: string) {
  const destino = document.getElementById(decodificar(href.slice(1)))
  if (!destino) return
  evento.preventDefault()
  destino.scrollIntoView({ block: 'start' })
}

type PropsMarkdown<T extends keyof JSX.IntrinsicElements> = ComponentProps<T> & { node?: unknown }

function LinkMarkdown({ href, children, node: _node, ...resto }: PropsMarkdown<'a'>) {
  if (href?.startsWith('#')) {
    return (
      <a {...resto} href={href} onClick={(evento) => irParaAncora(evento, href)}>
        {children}
      </a>
    )
  }
  if (href && LINK_EXTERNO.test(href)) {
    return (
      <a {...resto} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return <span className="resumo__link-texto">{children}</span>
}

/** `## DD/MM/AAAA` recebe o id `AAAA-MM-DD`, destino dos links do índice da documentação. */
function CabecalhoDia({ children, node: _node, ...resto }: PropsMarkdown<'h2'>) {
  const data = DATA_DO_CABECALHO.exec(textoDe(children).trim())
  return (
    <h2 {...resto} id={data ? `${data[3]}-${data[2]}-${data[1]}` : undefined}>
      {children}
    </h2>
  )
}

const COMPONENTES: Components = {
  a: LinkMarkdown,
  h2: CabecalhoDia,
  // Tabelas largas rolam dentro do próprio contêiner, sem rolagem horizontal da página.
  table: ({ node: _node, ...props }) => (
    <div className="resumo__tabela">
      <table {...props} />
    </div>
  ),
}

export function ResumoPage() {
  useTituloDocumento('Resumo')
  const [parametros, setParametros] = useSearchParams()
  const selecionada = abaDaUrl(parametros.get('aba'))
  const abasRef = useRef(new Map<IdAba, HTMLButtonElement>())

  function selecionar(id: IdAba, focar: boolean) {
    setParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais)
        novos.set('aba', id)
        return novos
      },
      { replace: true },
    )
    if (focar) abasRef.current.get(id)?.focus()
  }

  function teclaNaAba(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    let destino: number
    switch (evento.key) {
      case 'ArrowRight':
        destino = (indice + 1) % ABAS.length
        break
      case 'ArrowLeft':
        destino = (indice - 1 + ABAS.length) % ABAS.length
        break
      case 'Home':
        destino = 0
        break
      case 'End':
        destino = ABAS.length - 1
        break
      default:
        return
    }
    evento.preventDefault()
    selecionar(ABAS[destino].id, true)
  }

  return (
    <div className="resumo">
      <header className="resumo__cabecalho">
        <div className="resumo__cabecalho-interno">
          <Marca tom="claro" className="resumo__marca" />
          <Etiqueta tom="dourado">PED</Etiqueta>
        </div>
      </header>

      <main className="resumo__principal">
        <h1 className="resumo__titulo">Resumo do projeto</h1>

        <div role="tablist" aria-label="Documentos do projeto" className="resumo__abas">
          {ABAS.map((aba, indice) => {
            const ativa = aba.id === selecionada
            return (
              <button
                key={aba.id}
                ref={(elemento) => {
                  if (elemento) abasRef.current.set(aba.id, elemento)
                  else abasRef.current.delete(aba.id)
                }}
                type="button"
                role="tab"
                id={idAba(aba.id)}
                aria-selected={ativa}
                aria-controls={idPainel(aba.id)}
                tabIndex={ativa ? 0 : -1}
                className={`resumo__aba foco-anel${ativa ? ' resumo__aba--ativa' : ''}`}
                onClick={() => selecionar(aba.id, false)}
                onKeyDown={(evento) => teclaNaAba(evento, indice)}
              >
                {aba.rotulo}
              </button>
            )
          })}
        </div>

        {ABAS.map((aba) => {
          const ativa = aba.id === selecionada
          return (
            <div
              key={aba.id}
              role="tabpanel"
              id={idPainel(aba.id)}
              aria-labelledby={idAba(aba.id)}
              hidden={!ativa}
              className="resumo__painel"
            >
              {ativa && (
                <article className="resumo__documento">
                  <Markdown remarkPlugins={PLUGINS_REMARK} components={COMPONENTES} skipHtml>
                    {DOCUMENTOS_RESUMO[aba.id]}
                  </Markdown>
                </article>
              )}
            </div>
          )
        })}
      </main>

      <Rodape />
    </div>
  )
}
