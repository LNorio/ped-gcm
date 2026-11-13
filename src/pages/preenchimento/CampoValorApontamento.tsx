/**
 * Campo do valor de um apontamento (F9.6 — RF-66, RNF-03). Controlado: recebe o texto em `valor` e
 * avisa cada mudança em `onChange(texto)`; a validação é feita ao salvar (`lerValorDigitado`).
 *
 * - Numeral e Porcentagem: caixa de texto "Valor de {nome}" (ou `rotulo`), `inputMode="decimal"`,
 *   placeholder "0,00"; a Porcentagem mostra "%" ao lado.
 * - Booleano: grupo "Valor de {nome}" (ou `rotulo`) com os botões "Sim" e "Não" (`aria-pressed`);
 *   `valor` é `'sim'`, `'nao'` ou `''`.
 *   Clicar na opção já marcada desmarca (`onChange('')`): o apontamento volta a ficar sem valor.
 * - `erro` aparece como alerta junto do campo (e marca a caixa de texto como inválida).
 *
 * Sem `rotulo`, o rótulo padrão fica só para leitores de tela (o nome já está na linha do apontamento).
 */
import { useId } from 'react'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import type { TipoValor } from '../../types/dominio'
import './CampoValorApontamento.css'

export interface CampoValorApontamentoProps {
  /** Nome do apontamento (nome acessível padrão "Valor de {nome}"). */
  nome: string
  tipoValor: TipoValor
  /** Texto digitado; no booleano, `'sim'`, `'nao'` ou `''`. */
  valor: string
  onChange: (texto: string) => void
  erro?: string | null
  /** Substitui o rótulo padrão (e fica visível). */
  rotulo?: string
  disabled?: boolean
}

export function CampoValorApontamento({ nome, tipoValor, valor, onChange, erro, rotulo, disabled }: CampoValorApontamentoProps) {
  const idBase = useId()
  const textoRotulo = rotulo ?? `Valor de ${nome}`
  const rotuloOculto = rotulo === undefined

  if (tipoValor === 'booleano') {
    const idRotulo = `${idBase}-rotulo`
    const idErro = `${idBase}-erro`
    return (
      <div className="campo-valor-apontamento">
        <span id={idRotulo} className={rotuloOculto ? 'visualmente-oculto' : 'campo__rotulo'}>
          {textoRotulo}
        </span>
        <div
          role="group"
          aria-labelledby={idRotulo}
          aria-describedby={erro ? idErro : undefined}
          className="campo-valor-apontamento__booleano"
        >
          {(['sim', 'nao'] as const).map((opcao) => {
            const pressionado = valor === opcao
            return (
              <Botao
                key={opcao}
                type="button"
                variante={pressionado ? 'primario' : 'contorno'}
                tamanho="pequeno"
                aria-pressed={pressionado}
                disabled={disabled}
                onClick={() => onChange(pressionado ? '' : opcao)}
              >
                {opcao === 'sim' ? 'Sim' : 'Não'}
              </Botao>
            )
          })}
        </div>
        <ErroCampo id={idErro} mensagem={erro} />
      </div>
    )
  }

  return (
    <div className="campo-valor-apontamento campo-valor-apontamento--numero">
      <Campo
        rotulo={textoRotulo}
        rotuloOculto={rotuloOculto}
        erro={erro}
        inputMode="decimal"
        placeholder="0,00"
        autoComplete="off"
        value={valor}
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        sufixo={tipoValor === 'porcentagem' ? <span className="campo__sufixo">%</span> : undefined}
      />
    </div>
  )
}
