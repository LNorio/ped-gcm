/**
 * Conclusão da construção de um dado externo pelo Admin (F5.7 — RF-28).
 *
 * Com `dado` nulo, nada é renderizado. O Admin informa o identificador da consulta criado pela TI,
 * podendo escolher um dos identificadores existentes. Ao digitar, colar ou escolher uma sugestão, o
 * texto passa por `limparIdentificador` (só A–Z, 0–9, "_", "-" e ".", em maiúsculas), pois o identificador
 * aponta para o código da coleta no back-end. O erro
 * devolvido pela API (`erro`) é exibido dentro do diálogo sem apagar o que foi digitado.
 */
import { useId, useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import type { DadoExterno, IdentificadorColeta } from '../../types/dominio'
import { limparIdentificador } from '../../utils/identificador'
import { SugestoesIdentificador } from './SugestoesIdentificador'
import './DialogoConcluirConstrucao.css'

export interface DialogoConcluirConstrucaoProps {
  /** Dado externo em construção; `null` mantém o diálogo fechado. */
  dado: DadoExterno | null
  /** Identificadores existentes, oferecidos como sugestão. */
  identificadores: IdentificadorColeta[]
  /** Enquanto `true`, o botão Concluir fica desabilitado. */
  concluindo: boolean
  /** Mensagem de erro devolvida ao concluir; `null` quando não há. */
  erro: string | null
  /** Chamado com o identificador limpo: só A–Z, 0–9, "_", "-" e ".", em maiúsculas. */
  onConfirmar: (identificador: string) => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

const MENSAGEM_SEM_IDENTIFICADOR = 'Informe o identificador da consulta.'

export function DialogoConcluirConstrucao(props: DialogoConcluirConstrucaoProps) {
  if (props.dado === null) return null
  // `key` reinicia o campo ao abrir o diálogo para outro dado.
  return <ConteudoConcluir key={props.dado.id} {...props} dado={props.dado} />
}

function ConteudoConcluir({
  dado,
  identificadores,
  concluindo,
  erro,
  onConfirmar,
  onCancelar,
}: DialogoConcluirConstrucaoProps & { dado: DadoExterno }) {
  const idFormulario = useId()
  const [identificador, setIdentificador] = useState('')
  const [erroCampo, setErroCampo] = useState<string | null>(null)

  function alterar(valor: string) {
    const limpo = limparIdentificador(valor)
    setIdentificador(limpo)
    if (limpo !== '') setErroCampo(null)
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (concluindo) return
    const limpo = limparIdentificador(identificador)
    if (limpo === '') {
      setErroCampo(MENSAGEM_SEM_IDENTIFICADOR)
      return
    }
    setErroCampo(null)
    onConfirmar(limpo)
  }

  return (
    <Dialogo
      aberto
      titulo="Concluir construção"
      onFechar={onCancelar}
      acoes={
        <>
          <Botao variante="contorno" onClick={onCancelar}>
            Cancelar
          </Botao>
          <Botao type="submit" form={idFormulario} disabled={concluindo}>
            Concluir
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="dialogo-concluir" onSubmit={enviar} noValidate>
        <p className="dialogo-concluir__texto">
          {`Informe o identificador da consulta criada pela TI para o dado externo ${dado.nome}.`}
        </p>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <Campo
          rotulo="Identificador da consulta"
          obrigatorio
          value={identificador}
          erro={erroCampo}
          autoComplete="off"
          onChange={(evento) => alterar(evento.target.value)}
        />
        <SugestoesIdentificador identificadores={identificadores} filtro={identificador} onEscolher={alterar} />
      </form>
    </Dialogo>
  )
}
