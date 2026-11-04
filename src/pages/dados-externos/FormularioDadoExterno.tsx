/**
 * Formulário de cadastro de dado externo (F5.4–F5.6 — RF-25, RF-26, RF-27, RF-29).
 *
 * Campos comuns: nome, tipo, sistema de origem, tipo de valor, referência, coleta (com o dia quando
 * a coleta é numa data específica do mês), sentido do cálculo, janela retroativa (oculta quando o
 * sentido é "último valor") e comentários (obrigatórios com "Outro sistema").
 *
 * "Campo ou cálculo" é obrigatório nas duas variantes.
 *
 * Variantes:
 * - `admin`: "Identificador da consulta" obrigatório, com sugestões dos existentes. Ao digitar, colar
 *   ou escolher uma sugestão, o texto passa por `limparIdentificador` (só A–Z, 0–9 e "_", em
 *   maiúsculas), pois o identificador aponta para o código da coleta no back-end;
 * - `solicitacao` (Validador/Preenchedor): também "Observação para a TI".
 *
 * O dado não é editável depois de salvo, por isso não há campo de situação. O erro devolvido pela
 * API (`erro`) é exibido dentro do formulário sem apagar o que o usuário digitou.
 */
import { useState, type FormEvent } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Select, type OpcaoSelect } from '../../components/Select'
import {
  COLETAS,
  JANELAS_RETROATIVAS,
  REFERENCIAS,
  ROTULOS_COLETA,
  ROTULOS_REFERENCIA,
  ROTULOS_SENTIDO_CALCULO,
  ROTULOS_SISTEMA_ORIGEM,
  ROTULOS_TIPO_VALOR,
  SENTIDOS_CALCULO,
  SISTEMAS_ORIGEM,
  TIPOS_VALOR,
  type IdentificadorColeta,
  type JanelaRetroativa,
  type NovoDadoExterno,
  type ReferenciaNomeada,
} from '../../types/dominio'
import { limparIdentificador } from '../../utils/identificador'
import { SugestoesIdentificador } from './SugestoesIdentificador'
import './FormularioDadoExterno.css'

export type VarianteFormularioDadoExterno = 'admin' | 'solicitacao'

export interface FormularioDadoExternoProps {
  /** Tipos em que o usuário pode cadastrar, na ordem de exibição. */
  tipos: ReferenciaNomeada[]
  /** `admin` informa o identificador; `solicitacao` deixa uma observação para a TI. */
  variante: VarianteFormularioDadoExterno
  /** Identificadores existentes, sugeridos na variante Admin. */
  identificadores: IdentificadorColeta[]
  /** Enquanto `true`, o botão Salvar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida ao salvar; `null` quando não há. */
  erro: string | null
  onSalvar: (dados: NovoDadoExterno) => void
  onCancelar: () => void
}

type CampoValidado =
  | 'nome'
  | 'tipo'
  | 'origem'
  | 'tipoValor'
  | 'referencia'
  | 'coleta'
  | 'dia'
  | 'sentido'
  | 'janela'
  | 'comentarios'
  | 'identificador'
  | 'campoCalculo'

type ErrosFormulario = Partial<Record<CampoValidado, string>>

function opcoes<T extends string | number>(valores: readonly T[], rotulo: (valor: T) => string): OpcaoSelect[] {
  return valores.map((valor) => ({ valor: String(valor), rotulo: rotulo(valor) }))
}

const OPCOES_ORIGEM = opcoes(SISTEMAS_ORIGEM, (valor) => ROTULOS_SISTEMA_ORIGEM[valor])
const OPCOES_TIPO_VALOR = opcoes(TIPOS_VALOR, (valor) => ROTULOS_TIPO_VALOR[valor])
const OPCOES_REFERENCIA = opcoes(REFERENCIAS, (valor) => ROTULOS_REFERENCIA[valor])
const OPCOES_COLETA = opcoes(COLETAS, (valor) => ROTULOS_COLETA[valor])
const OPCOES_SENTIDO = opcoes(SENTIDOS_CALCULO, (valor) => ROTULOS_SENTIDO_CALCULO[valor])
const OPCOES_JANELA = opcoes(JANELAS_RETROATIVAS, (valor) => (valor === 1 ? 'Somente o mês' : `${valor} meses`))

function encontrar<T extends string | number>(valores: readonly T[], texto: string): T | undefined {
  return valores.find((valor) => String(valor) === texto)
}

/** Dia da coleta: inteiro de 1 a 31; `null` quando inválido. */
function lerDia(texto: string): number | null {
  const limpo = texto.trim()
  if (!/^\d{1,2}$/.test(limpo)) return null
  const dia = Number(limpo)
  return dia >= 1 && dia <= 31 ? dia : null
}

function textoOuNulo(texto: string): string | null {
  const limpo = texto.trim()
  return limpo === '' ? null : limpo
}

export function FormularioDadoExterno({
  tipos,
  variante,
  identificadores,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: FormularioDadoExternoProps) {
  const [nome, setNome] = useState('')
  const [idTipo, setIdTipo] = useState('')
  const [origem, setOrigem] = useState('')
  const [tipoValor, setTipoValor] = useState('')
  const [referencia, setReferencia] = useState('')
  const [coleta, setColeta] = useState('')
  const [dia, setDia] = useState('')
  const [sentido, setSentido] = useState('')
  const [janela, setJanela] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [campoCalculo, setCampoCalculo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erros, setErros] = useState<ErrosFormulario>({})

  const admin = variante === 'admin'
  const coletaPorDia = coleta === 'dia do mes'
  const usaJanela = sentido !== 'ultimo'
  const comentariosObrigatorios = origem === 'outro'
  const opcoesTipo: OpcaoSelect[] = tipos.map((tipo) => ({ valor: String(tipo.id), rotulo: tipo.nome }))

  function limparErro(campo: CampoValidado) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function alterarIdentificador(valor: string) {
    const limpo = limparIdentificador(valor)
    setIdentificador(limpo)
    if (limpo !== '') limparErro('identificador')
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return

    const origemEscolhida = encontrar(SISTEMAS_ORIGEM, origem)
    const tipoValorEscolhido = encontrar(TIPOS_VALOR, tipoValor)
    const referenciaEscolhida = encontrar(REFERENCIAS, referencia)
    const coletaEscolhida = encontrar(COLETAS, coleta)
    const sentidoEscolhido = encontrar(SENTIDOS_CALCULO, sentido)
    const janelaEscolhida = encontrar<JanelaRetroativa>(JANELAS_RETROATIVAS, janela)
    const diaDaColeta = coletaPorDia ? lerDia(dia) : null

    const novosErros: ErrosFormulario = {}
    if (nome.trim() === '') novosErros.nome = 'Informe o nome.'
    if (idTipo === '') novosErros.tipo = 'Selecione o tipo.'
    if (!origemEscolhida) novosErros.origem = 'Selecione o sistema de origem.'
    if (!tipoValorEscolhido) novosErros.tipoValor = 'Selecione o tipo de valor.'
    if (!referenciaEscolhida) novosErros.referencia = 'Selecione a referência.'
    if (!coletaEscolhida) novosErros.coleta = 'Selecione a coleta.'
    if (coletaPorDia && diaDaColeta === null) novosErros.dia = 'Informe o dia da coleta, de 1 a 31.'
    if (!sentidoEscolhido) novosErros.sentido = 'Selecione o sentido do cálculo.'
    if (usaJanela && !janelaEscolhida) novosErros.janela = 'Selecione a janela retroativa.'
    if (comentariosObrigatorios && comentarios.trim() === '') {
      novosErros.comentarios = 'Informe nos comentários qual é o sistema de origem.'
    }
    const identificadorLimpo = limparIdentificador(identificador)
    if (admin && identificadorLimpo === '') novosErros.identificador = 'Informe o identificador da consulta.'
    if (campoCalculo.trim() === '') {
      novosErros.campoCalculo = 'Descreva o campo a buscar ou o cálculo a fazer.'
    }
    setErros(novosErros)

    if (
      Object.values(novosErros).some(Boolean) ||
      !origemEscolhida ||
      !tipoValorEscolhido ||
      !referenciaEscolhida ||
      !coletaEscolhida ||
      !sentidoEscolhido
    ) {
      return
    }

    onSalvar({
      nome: nome.trim(),
      idTipo: Number(idTipo),
      sistemaOrigem: origemEscolhida,
      tipoValor: tipoValorEscolhido,
      referencia: referenciaEscolhida,
      coleta: coletaEscolhida,
      diaDaColeta,
      sentidoCalculo: sentidoEscolhido,
      janelaRetroativa: sentidoEscolhido === 'ultimo' ? null : (janelaEscolhida ?? null),
      comentarios: textoOuNulo(comentarios),
      campoCalculo: textoOuNulo(campoCalculo),
      identificador: admin ? identificadorLimpo : null,
      observacao: admin ? null : textoOuNulo(observacao),
    })
  }

  return (
    <form className="formulario-dado-externo" onSubmit={enviar} noValidate>
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
      <div className="formulario-dado-externo__grade">
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
          rotulo="Sistema de origem"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_ORIGEM}
          value={origem}
          erro={erros.origem}
          onChange={(evento) => {
            setOrigem(evento.target.value)
            limparErro('origem')
            if (evento.target.value !== 'outro') limparErro('comentarios')
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
        <Select
          rotulo="Referência"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_REFERENCIA}
          value={referencia}
          erro={erros.referencia}
          onChange={(evento) => {
            setReferencia(evento.target.value)
            limparErro('referencia')
          }}
        />
        <Select
          rotulo="Coleta"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_COLETA}
          value={coleta}
          erro={erros.coleta}
          onChange={(evento) => {
            setColeta(evento.target.value)
            limparErro('coleta')
            limparErro('dia')
          }}
        />
        {coletaPorDia ? (
          <Campo
            rotulo="Dia"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            obrigatorio
            value={dia}
            erro={erros.dia}
            onChange={(evento) => {
              setDia(evento.target.value)
              limparErro('dia')
            }}
          />
        ) : null}
        <Select
          rotulo="Sentido do cálculo"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_SENTIDO}
          value={sentido}
          erro={erros.sentido}
          onChange={(evento) => {
            setSentido(evento.target.value)
            limparErro('sentido')
            limparErro('janela')
          }}
        />
        {usaJanela ? (
          <Select
            rotulo="Janela retroativa"
            obrigatorio
            placeholder="Selecione"
            opcoes={OPCOES_JANELA}
            value={janela}
            erro={erros.janela}
            onChange={(evento) => {
              setJanela(evento.target.value)
              limparErro('janela')
            }}
          />
        ) : null}
      </div>
      {admin ? (
        <div className="formulario-dado-externo__identificador">
          <Campo
            rotulo="Identificador da consulta"
            obrigatorio
            value={identificador}
            erro={erros.identificador}
            autoComplete="off"
            onChange={(evento) => alterarIdentificador(evento.target.value)}
          />
          <SugestoesIdentificador
            identificadores={identificadores}
            filtro={identificador}
            onEscolher={alterarIdentificador}
          />
        </div>
      ) : null}
      <AreaTexto
        rotulo="Campo ou cálculo"
        obrigatorio
        rows={3}
        value={campoCalculo}
        erro={erros.campoCalculo}
        onChange={(evento) => {
          setCampoCalculo(evento.target.value)
          if (evento.target.value.trim() !== '') limparErro('campoCalculo')
        }}
      />
      <AreaTexto
        rotulo="Comentários"
        obrigatorio={comentariosObrigatorios}
        rows={3}
        value={comentarios}
        erro={erros.comentarios}
        onChange={(evento) => {
          setComentarios(evento.target.value)
          if (evento.target.value.trim() !== '') limparErro('comentarios')
        }}
      />
      {admin ? null : (
        <AreaTexto
          rotulo="Observação para a TI"
          rows={3}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      )}
      <div className="formulario-dado-externo__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          Salvar
        </Botao>
      </div>
    </form>
  )
}
