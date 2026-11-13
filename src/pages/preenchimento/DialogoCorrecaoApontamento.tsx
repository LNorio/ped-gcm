/**
 * Diálogo "Corrigir lançamento" (F9.7 — RF-68, RNF-01, RNF-03). Controlado pela página, que envia a
 * correção (`PUT` com um item e o motivo) e informa `salvando`/`erro`.
 *
 * Validação ao salvar: novo valor informado ("Informe o novo valor."), número válido e não negativo
 * (mensagens de `lerValorDigitado`), diferente do atual e motivo não vazio (aparado). Válido →
 * `onConfirmar({ valor, motivo })` com o valor convertido. Com `salvando`, o diálogo não fecha: "Cancelar"
 * fica desabilitado e o Esc e o X não fazem nada.
 */
import { useState } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import type { ApontamentoPreenchimento, ValorLancamento } from '../../types/dominio'
import { CampoValorApontamento } from './CampoValorApontamento'
import { formatarValorLancamento, lerValorDigitado } from './regrasPreenchimento'

export const MENSAGEM_INFORME_NOVO_VALOR = 'Informe o novo valor.'
export const MENSAGEM_VALOR_IGUAL = 'O novo valor deve ser diferente do atual.'
export const MENSAGEM_INFORME_MOTIVO = 'Informe o motivo da correção.'

export interface CorrecaoApontamento {
  valor: ValorLancamento
  motivo: string
}

export interface DialogoCorrecaoApontamentoProps {
  /** Apontamento a corrigir; `null` mantém o diálogo fechado. */
  apontamento: ApontamentoPreenchimento | null
  salvando?: boolean
  /** Falha da API ao salvar a correção. */
  erro?: string | null
  onConfirmar: (correcao: CorrecaoApontamento) => void
  onFechar: () => void
}

interface ErrosCorrecao {
  valor: string | null
  motivo: string | null
}

const SEM_ERROS: ErrosCorrecao = { valor: null, motivo: null }

function FormularioCorrecao({
  apontamento,
  salvando = false,
  erro,
  onConfirmar,
  onFechar,
}: Omit<DialogoCorrecaoApontamentoProps, 'apontamento'> & { apontamento: ApontamentoPreenchimento }) {
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<ErrosCorrecao>(SEM_ERROS)

  function validarValor(): { valor: ValorLancamento | null; erro: string | null } {
    if (texto.trim() === '') return { valor: null, erro: MENSAGEM_INFORME_NOVO_VALOR }
    const lido = lerValorDigitado(apontamento.tipoValor, texto)
    if (lido.erro) return lido
    if (lido.valor === null) return { valor: null, erro: MENSAGEM_INFORME_NOVO_VALOR }
    if (lido.valor === apontamento.valor) return { valor: null, erro: MENSAGEM_VALOR_IGUAL }
    return lido
  }

  function salvar() {
    const valor = validarValor()
    const motivoAparado = motivo.trim()
    const novos: ErrosCorrecao = { valor: valor.erro, motivo: motivoAparado === '' ? MENSAGEM_INFORME_MOTIVO : null }
    setErros(novos)
    if (novos.valor || novos.motivo || valor.valor === null) return
    onConfirmar({ valor: valor.valor, motivo: motivoAparado })
  }

  // Enquanto a correção é salva, o diálogo não fecha (Cancelar, Esc e o X).
  const fechar = () => {
    if (!salvando) onFechar()
  }

  return (
    <Dialogo
      aberto
      titulo="Corrigir lançamento"
      onFechar={fechar}
      acoes={
        <>
          <Botao variante="contorno" onClick={fechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            Salvar correção
          </Botao>
        </>
      }
    >
      <div className="dialogo-correcao-apontamento">
        <p className="dialogo-correcao-apontamento__nome">{apontamento.nome}</p>
        <p className="dialogo-correcao-apontamento__atual">
          {`Valor atual: ${formatarValorLancamento(apontamento.tipoValor, apontamento.valor)}`}
        </p>
        <CampoValorApontamento
          nome={apontamento.nome}
          tipoValor={apontamento.tipoValor}
          rotulo="Novo valor"
          valor={texto}
          erro={erros.valor}
          disabled={salvando}
          onChange={(novo) => {
            setTexto(novo)
            if (erros.valor) setErros((atuais) => ({ ...atuais, valor: null }))
          }}
        />
        <AreaTexto
          rotulo="Motivo da correção"
          obrigatorio
          rows={3}
          value={motivo}
          erro={erros.motivo}
          disabled={salvando}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            if (erros.motivo) setErros((atuais) => ({ ...atuais, motivo: null }))
          }}
        />
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      </div>
    </Dialogo>
  )
}

export function DialogoCorrecaoApontamento({ apontamento, ...props }: DialogoCorrecaoApontamentoProps) {
  if (apontamento === null) return null
  return <FormularioCorrecao key={apontamento.id} apontamento={apontamento} {...props} />
}
