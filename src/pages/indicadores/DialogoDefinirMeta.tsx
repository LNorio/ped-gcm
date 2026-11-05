/**
 * Diálogo "Definir meta" de um indicador criado automaticamente (F6.5 — RF-36).
 *
 * Um indicador criado a partir de dado externo nasce sem meta nem sentido ("meta a definir"). Este
 * diálogo pede a meta (maior que zero, em pt-BR), o sentido e se a meta é editável no preenchimento.
 * Valida localmente antes de chamar `onConfirmar`; o erro devolvido pela API (`erro`) aparece dentro
 * do diálogo sem apagar os valores digitados. Enquanto `definindo`, o botão de envio fica desabilitado.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import { Select, type OpcaoSelect } from '../../components/Select'
import type { DadosMeta } from '../../services/indicadoresService'
import { ROTULOS_SENTIDO, SENTIDOS, type Indicador, type Sentido } from '../../types/dominio'
import { lerDecimal } from '../../utils/formato'
import './FormularioIndicador.css'

export interface DialogoDefinirMetaProps {
  /** Indicador a receber a meta; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Enquanto `true`, o botão "Definir meta" fica desabilitado. */
  definindo: boolean
  /** Mensagem de erro devolvida pela API; `null` quando não há. */
  erro: string | null
  onConfirmar: (dados: DadosMeta) => void
  onCancelar: () => void
}

interface ErrosMeta {
  meta?: string
  sentido?: string
}

const OPCOES_SENTIDO: OpcaoSelect[] = SENTIDOS.map((sentido) => ({ valor: sentido, rotulo: ROTULOS_SENTIDO[sentido] }))

/** Id do formulário; o botão "Definir meta" fica no rodapé do diálogo e envia por `form`. */
function idDoFormulario(indicador: Indicador): string {
  return `formulario-definir-meta-${indicador.id}`
}

function ehSentido(valor: string): valor is Sentido {
  return (SENTIDOS as readonly string[]).includes(valor)
}

interface ConteudoDefinirMetaProps {
  indicador: Indicador
  definindo: boolean
  erro: string | null
  onConfirmar: (dados: DadosMeta) => void
}

/** Formulário do diálogo; montado a cada indicador aberto, então parte sempre limpo. */
function ConteudoDefinirMeta({ indicador, definindo, erro, onConfirmar }: ConteudoDefinirMetaProps) {
  const [metaTexto, setMetaTexto] = useState('')
  const [sentido, setSentido] = useState('')
  const [metaEditavel, setMetaEditavel] = useState(false)
  const [erros, setErros] = useState<ErrosMeta>({})

  const origem = indicador.composicao.tipo === 'dado_externo' ? indicador.composicao.itens[0]?.nome : undefined

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (definindo) return

    const meta = lerDecimal(metaTexto)
    const sentidoEscolhido = ehSentido(sentido) ? sentido : undefined

    const novosErros: ErrosMeta = {}
    if (meta === null || meta <= 0) novosErros.meta = 'Informe uma meta maior que zero.'
    if (sentidoEscolhido === undefined) novosErros.sentido = 'Selecione o sentido.'
    setErros(novosErros)

    if (meta === null || meta <= 0 || sentidoEscolhido === undefined) return
    onConfirmar({ meta, sentido: sentidoEscolhido, metaEditavel })
  }

  return (
    <>
      {origem ? <p className="formulario-indicador__origem">Dado externo de origem: {origem}</p> : null}
      <form id={idDoFormulario(indicador)} className="formulario-indicador" onSubmit={enviar} noValidate>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <Campo
          rotulo="Meta"
          obrigatorio
          inputMode="decimal"
          autoComplete="off"
          value={metaTexto}
          erro={erros.meta}
          onChange={(evento) => {
            setMetaTexto(evento.target.value)
            setErros((atual) => ({ ...atual, meta: undefined }))
          }}
        />
        <Select
          rotulo="Sentido"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_SENTIDO}
          value={sentido}
          erro={erros.sentido}
          onChange={(evento) => {
            setSentido(evento.target.value)
            setErros((atual) => ({ ...atual, sentido: undefined }))
          }}
        />
        <label className="formulario-indicador__caixa">
          <input type="checkbox" checked={metaEditavel} onChange={(evento) => setMetaEditavel(evento.target.checked)} />
          Meta editável no preenchimento
        </label>
      </form>
    </>
  )
}

export function DialogoDefinirMeta({ indicador, definindo, erro, onConfirmar, onCancelar }: DialogoDefinirMetaProps) {
  return (
    <Dialogo
      aberto={indicador !== null}
      titulo="Definir meta"
      descricao={indicador?.nome}
      onFechar={onCancelar}
      acoes={
        indicador ? (
          <>
            <Botao variante="contorno" onClick={onCancelar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idDoFormulario(indicador)} disabled={definindo}>
              Definir meta
            </Botao>
          </>
        ) : null
      }
    >
      {indicador ? (
        <ConteudoDefinirMeta
          key={indicador.id}
          indicador={indicador}
          definindo={definindo}
          erro={erro}
          onConfirmar={onConfirmar}
        />
      ) : null}
    </Dialogo>
  )
}
