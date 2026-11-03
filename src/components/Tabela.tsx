import { useId, useState, type ReactNode } from 'react'
import { Botao } from './Botao'
import './Tabela.css'

export type AlinhamentoColuna = 'esquerda' | 'direita' | 'centro'

export interface ColunaTabela<T> {
  /** Identificador da coluna; sem `render`, é a propriedade da linha exibida na célula. */
  chave: string
  /** Texto do cabeçalho. */
  titulo: string
  /** Conteúdo personalizado da célula. Sem ele, a célula exibe `String(linha[chave])`. */
  render?: (linha: T) => ReactNode
  /** Alinhamento do texto da coluna (padrão `esquerda`). */
  alinhar?: AlinhamentoColuna
}

export interface TabelaProps<T> {
  colunas: ColunaTabela<T>[]
  dados: T[]
  /** Chave única de cada linha (usada no `key` e no controle de expansão). */
  obterChave: (linha: T) => string | number
  /** Legenda (`<caption>`); também nomeia a tabela para leitores de tela. */
  legenda?: string
  /** Texto exibido quando `dados` está vazio. */
  textoVazio?: string
  /**
   * Conteúdo expansível de cada linha. Linhas cujo retorno é `null` não ganham botão de expandir.
   */
  expandir?: (linha: T) => ReactNode | null
  /** Rótulo do botão quando a linha está recolhida. */
  rotuloExpandir?: string
  /** Rótulo do botão quando a linha está expandida. */
  rotuloRecolher?: string
  className?: string
}

function valorPadrao<T>(linha: T, chave: string): ReactNode {
  const valor = (linha as Record<string, unknown>)[chave]
  if (valor === null || valor === undefined) return ''
  return String(valor)
}

/**
 * Tabela de dados responsiva (RNF-04): rola horizontalmente em telas menores dentro do
 * quadro `.tabela-rolagem`, sem quebrar o layout do card. Opcionalmente, cada linha pode
 * exibir um botão que alterna uma linha de detalhes logo abaixo dela.
 */
export function Tabela<T>({
  colunas,
  dados,
  obterChave,
  legenda,
  textoVazio = 'Nenhum registro encontrado.',
  expandir,
  rotuloExpandir = 'Expandir detalhes',
  rotuloRecolher = 'Recolher detalhes',
  className,
}: TabelaProps<T>) {
  const idBase = useId()
  const [expandidas, setExpandidas] = useState<Set<string | number>>(() => new Set())

  const totalColunas = colunas.length + (expandir ? 1 : 0)

  function alternar(chave: string | number) {
    setExpandidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  const classes = ['tabela']
  if (className) classes.push(className)

  return (
    <div className="tabela-rolagem">
      <table className={classes.join(' ')}>
        {legenda ? <caption className="tabela__legenda">{legenda}</caption> : null}
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                className={coluna.alinhar ? `rotulo-secao tabela__alinhar-${coluna.alinhar}` : 'rotulo-secao'}
              >
                {coluna.titulo}
              </th>
            ))}
            {expandir ? (
              <th scope="col" className="rotulo-secao tabela__coluna-expandir">
                <span className="visualmente-oculto">Detalhes</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {dados.length === 0 ? (
            <tr>
              <td colSpan={totalColunas} className="tabela__vazio">
                {textoVazio}
              </td>
            </tr>
          ) : (
            dados.map((linha) => {
              const chave = obterChave(linha)
              const conteudoExpandido = expandir ? expandir(linha) : null
              const expansivel = conteudoExpandido !== null && conteudoExpandido !== undefined
              const aberta = expansivel && expandidas.has(chave)
              const idDetalhes = `${idBase}-detalhes-${String(chave)}`

              return [
                <tr key={chave} className={aberta ? 'tabela__linha--aberta' : undefined}>
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.chave}
                      className={coluna.alinhar ? `tabela__alinhar-${coluna.alinhar}` : undefined}
                    >
                      {coluna.render ? coluna.render(linha) : valorPadrao(linha, coluna.chave)}
                    </td>
                  ))}
                  {expandir ? (
                    <td className="tabela__coluna-expandir">
                      {expansivel ? (
                        <Botao
                          variante="link"
                          tamanho="pequeno"
                          className="tabela__botao-expandir"
                          aria-expanded={aberta}
                          aria-controls={aberta ? idDetalhes : undefined}
                          onClick={() => alternar(chave)}
                        >
                          <svg
                            className="tabela__seta"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                          {aberta ? rotuloRecolher : rotuloExpandir}
                        </Botao>
                      ) : null}
                    </td>
                  ) : null}
                </tr>,
                aberta ? (
                  <tr key={`${chave}-detalhes`} id={idDetalhes} className="tabela__detalhes">
                    <td colSpan={totalColunas}>{conteudoExpandido}</td>
                  </tr>
                ) : null,
              ]
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
