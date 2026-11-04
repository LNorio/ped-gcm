/**
 * Formulário de cadastro de apontamento (F4.4 — RF-19, RF-20).
 *
 * Valida localmente os campos obrigatórios (nome, tipo e tipo de valor) antes de chamar `onSalvar`.
 * O apontamento nasce ativo e não é editável, por isso não há campo de situação. O erro devolvido
 * pela API (`erro`) é exibido dentro do formulário sem apagar o que o usuário digitou. Sem tipos
 * disponíveis, exibe um alerta e desabilita "Salvar".
 */
import { useState, type FormEvent } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Select, type OpcaoSelect } from '../../components/Select'
import {
  ROTULOS_TIPO_VALOR,
  TIPOS_VALOR,
  type NovoApontamento,
  type ReferenciaNomeada,
  type TipoValor,
} from '../../types/dominio'
import './FormularioApontamento.css'

export interface FormularioApontamentoProps {
  /** Tipos em que o usuário pode cadastrar apontamentos, na ordem de exibição. */
  tipos: ReferenciaNomeada[]
  /** Enquanto `true`, o botão Salvar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida ao salvar; `null` quando não há. */
  erro: string | null
  onSalvar: (dados: NovoApontamento) => void
  onCancelar: () => void
}

interface ErrosFormulario {
  nome?: string
  tipo?: string
  tipoValor?: string
}

const OPCOES_TIPO_VALOR: OpcaoSelect[] = TIPOS_VALOR.map((tipoValor) => ({
  valor: tipoValor,
  rotulo: ROTULOS_TIPO_VALOR[tipoValor],
}))

const MENSAGEM_SEM_TIPOS = 'Você não tem tipos de apontamento disponíveis para cadastro.'

function ehTipoValor(valor: string): valor is TipoValor {
  return (TIPOS_VALOR as readonly string[]).includes(valor)
}

export function FormularioApontamento({ tipos, salvando, erro, onSalvar, onCancelar }: FormularioApontamentoProps) {
  const [nome, setNome] = useState('')
  const [idTipo, setIdTipo] = useState('')
  const [tipoValor, setTipoValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erros, setErros] = useState<ErrosFormulario>({})

  const opcoesTipo: OpcaoSelect[] = tipos.map((tipo) => ({ valor: String(tipo.id), rotulo: tipo.nome }))
  const semTipos = tipos.length === 0

  function limparErro(campo: keyof ErrosFormulario) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || semTipos) return

    const novosErros: ErrosFormulario = {}
    if (nome.trim() === '') novosErros.nome = 'Informe o nome.'
    if (idTipo === '') novosErros.tipo = 'Selecione o tipo.'
    if (!ehTipoValor(tipoValor)) novosErros.tipoValor = 'Selecione o tipo de valor.'
    setErros(novosErros)

    if (novosErros.nome || novosErros.tipo || !ehTipoValor(tipoValor)) return

    const descricaoLimpa = descricao.trim()
    onSalvar({
      nome: nome.trim(),
      idTipo: Number(idTipo),
      tipoValor,
      descricao: descricaoLimpa === '' ? null : descricaoLimpa,
    })
  }

  return (
    <form className="formulario-apontamento" onSubmit={enviar} noValidate>
      {semTipos ? <Aviso tipo="alerta">{MENSAGEM_SEM_TIPOS}</Aviso> : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Campo
        rotulo="Nome"
        obrigatorio
        value={nome}
        erro={erros.nome}
        onChange={(evento) => {
          setNome(evento.target.value)
          if (evento.target.value.trim() !== '') limparErro('nome')
        }}
      />
      <Select
        rotulo="Tipo"
        obrigatorio
        placeholder="Selecione"
        opcoes={opcoesTipo}
        value={idTipo}
        erro={erros.tipo}
        onChange={(evento) => {
          setIdTipo(evento.target.value)
          limparErro('tipo')
        }}
      />
      <Select
        rotulo="Tipo de valor"
        obrigatorio
        placeholder="Selecione"
        opcoes={OPCOES_TIPO_VALOR}
        value={tipoValor}
        erro={erros.tipoValor}
        onChange={(evento) => {
          setTipoValor(evento.target.value)
          limparErro('tipoValor')
        }}
      />
      <AreaTexto rotulo="Descrição" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} rows={3} />
      <div className="formulario-apontamento__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando || semTipos}>
          Salvar
        </Botao>
      </div>
    </form>
  )
}
