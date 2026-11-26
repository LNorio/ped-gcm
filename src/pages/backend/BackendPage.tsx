/**
 * Página pública `/backend` (F2.13): documentação trocada com o back-end (propostas, contrapropostas,
 * respostas, pendências e verificações de `docs/propostas-backend/`), para a equipe de back-end
 * acompanhar pelo navegador sem conta no PED.
 *
 * - Fica fora do layout principal e de `RotaProtegida`; não chama a API.
 * - O documento aberto vem de `?doc=<id>`; sem `?doc`, abre o primeiro (mais recente).
 * - O Markdown é renderizado por react-markdown + remark-gfm, sem `rehype-raw`: HTML cru no
 *   documento não vira elemento.
 * - Links para outro `.md` abrem o documento na própria página; links http/https, em nova aba.
 */
import type { ComponentProps } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { Link, useSearchParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { CAMINHO_BACKEND } from '../../caminhos'
import { Etiqueta } from '../../components/Etiqueta'
import { Marca } from '../../components/Marca'
import { Rodape } from '../../components/Rodape'
import { useTituloDocumento } from '../../hooks/useTituloDocumento'
import { DOCUMENTOS_BACKEND } from './documentosBackend'
import './BackendPage.css'

const PLUGINS_REMARK = [remarkGfm]

/** Endereço da página com o documento `id` aberto (e a âncora, se houver). */
function caminhoDoDocumento(id: string, ancora = ''): string {
  return `${CAMINHO_BACKEND}?doc=${encodeURIComponent(id)}${ancora}`
}

const LINK_PARA_DOCUMENTO = /^(?:\.\/)?([^/?#]+)\.md(#.*)?$/i
const LINK_EXTERNO = /^https?:\/\//i

function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto)
  } catch {
    return texto
  }
}

/** Link dentro do Markdown: outro documento da pasta, externo ou comum. */
function LinkMarkdown({ href, children, node: _node, ...resto }: ComponentProps<'a'> & { node?: unknown }) {
  const paraDocumento = href ? LINK_PARA_DOCUMENTO.exec(href) : null
  if (paraDocumento) {
    return (
      <Link {...resto} to={caminhoDoDocumento(decodificar(paraDocumento[1]), paraDocumento[2] ?? '')}>
        {children}
      </Link>
    )
  }
  if (href && LINK_EXTERNO.test(href)) {
    return (
      <a {...resto} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <a {...resto} href={href}>
      {children}
    </a>
  )
}

const COMPONENTES: Components = {
  a: LinkMarkdown,
  // Tabelas largas rolam dentro do próprio contêiner, sem rolagem horizontal da página.
  table: ({ node: _node, ...props }) => (
    <div className="backend__tabela">
      <table {...props} />
    </div>
  ),
}

export function BackendPage() {
  useTituloDocumento('Back-end')
  const [parametros] = useSearchParams()
  const docPedido = parametros.get('doc')

  const aberto = docPedido === null ? DOCUMENTOS_BACKEND[0] : DOCUMENTOS_BACKEND.find((documento) => documento.id === docPedido)

  return (
    <div className="backend">
      <header className="backend__cabecalho">
        <div className="backend__cabecalho-interno">
          <Marca tom="claro" className="backend__marca" />
          <Etiqueta tom="dourado">PED</Etiqueta>
        </div>
      </header>

      <main className="backend__principal">
        <h1 className="backend__titulo">Documentação para o back-end</h1>

        {DOCUMENTOS_BACKEND.length === 0 ? (
          <p className="backend__aviso">Nenhum documento disponível.</p>
        ) : (
          <div className="backend__corpo">
            <nav aria-label="Documentos" className="backend__lista">
              <ul>
                {DOCUMENTOS_BACKEND.map((documento) => {
                  const atual = documento === aberto
                  return (
                    <li key={documento.id} className="backend__item-linha">
                      <Link
                        to={caminhoDoDocumento(documento.id)}
                        aria-current={atual ? 'page' : undefined}
                        className={`backend__item foco-interno${atual ? ' backend__item--atual' : ''}`}
                      >
                        {documento.titulo}
                      </Link>
                      {documento.data && <span className="backend__item-data">{formatarData(documento.data)}</span>}
                    </li>
                  )
                })}
              </ul>
            </nav>

            {aberto ? (
              <article className="backend__documento" key={aberto.id}>
                <Markdown remarkPlugins={PLUGINS_REMARK} components={COMPONENTES}>
                  {aberto.conteudo}
                </Markdown>
              </article>
            ) : (
              <p className="backend__aviso backend__documento">Documento não encontrado.</p>
            )}
          </div>
        )}
      </main>

      <Rodape />
    </div>
  )
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`. */
function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}
