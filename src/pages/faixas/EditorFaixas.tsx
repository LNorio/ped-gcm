/**
 * Editor das linhas de faixas (F8.3, F8.4 — RF-42, RF-43, RNF-03), controlado pelo formulário.
 *
 * Cada linha tem De (R$), Até (R$) e Alíquota (%) em texto com `inputmode="decimal"` (vírgula
 * decimal). "+ Adicionar faixa" inclui uma linha vazia no fim; "Remover faixa N" retira a linha
 * (desabilitado quando há só uma) e as seguintes são renumeradas.
 */
import { Botao } from '../../components/Botao'
import { linhaFaixaVazia, type LinhaFaixaEditavel } from './regrasFaixas'
import './EditorFaixas.css'

export interface EditorFaixasProps {
  linhas: LinhaFaixaEditavel[]
  onChange: (linhas: LinhaFaixaEditavel[]) => void
  desabilitado?: boolean
}

type CampoLinha = keyof LinhaFaixaEditavel

const COLUNAS: { campo: CampoLinha; rotulo: string }[] = [
  { campo: 'de', rotulo: 'De' },
  { campo: 'ate', rotulo: 'Até' },
  { campo: 'aliquota', rotulo: 'Alíquota' },
]

const ICONE_REMOVER = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export function EditorFaixas({ linhas, onChange, desabilitado = false }: EditorFaixasProps) {
  function alterar(indice: number, campo: CampoLinha, valor: string) {
    onChange(linhas.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)))
  }

  function remover(indice: number) {
    onChange(linhas.filter((_, i) => i !== indice))
  }

  return (
    <div className="editor-faixas">
      <div className="editor-faixas__lista">
        <div className="editor-faixas__linha editor-faixas__cabecalho" aria-hidden="true">
          <span>#</span>
          <span>De (R$)</span>
          <span>Até (R$)</span>
          <span>Alíquota (%)</span>
          <span />
        </div>
        {linhas.map((linha, indice) => {
          const n = indice + 1
          return (
            // As linhas não têm identidade própria: a posição é a identidade exibida ("faixa N").
            <div key={indice} className="editor-faixas__linha">
              <span className="editor-faixas__numero">{n}</span>
              {COLUNAS.map(({ campo, rotulo }) => (
                <input
                  key={campo}
                  type="text"
                  className="campo__controle foco-interno editor-faixas__campo"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`${rotulo}, faixa ${n}`}
                  value={linha[campo]}
                  disabled={desabilitado}
                  onChange={(evento) => alterar(indice, campo, evento.target.value)}
                />
              ))}
              <Botao
                variante="perigo"
                className="editor-faixas__remover"
                aria-label={`Remover faixa ${n}`}
                disabled={desabilitado || linhas.length <= 1}
                onClick={() => remover(indice)}
              >
                {ICONE_REMOVER}
              </Botao>
            </div>
          )
        })}
      </div>
      <div>
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={desabilitado}
          onClick={() => onChange([...linhas, linhaFaixaVazia()])}
        >
          + Adicionar faixa
        </Botao>
      </div>
    </div>
  )
}
