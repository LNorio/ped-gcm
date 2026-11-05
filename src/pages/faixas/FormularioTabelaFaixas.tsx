/**
 * Formulário "Nova tabela de faixas" (F8.3 — RF-42, RF-43, RN-14).
 *
 * Campos: Dashboard (obrigatório), Filial (obrigatória só quando o cabeçalho está em "Todas as
 * filiais"; senão mostra a filial do cabeçalho), Descrição (opcional) e as faixas (EditorFaixas,
 * iniciando com uma linha vazia). Quando o dashboard e a filial escolhidos já têm tabela (em
 * `tabelas`), mostra a orientação de usar "Alterar faixas" e desabilita o salvar (RN-14).
 *
 * Valida localmente antes de chamar `onSalvar`. O erro devolvido pela API (`erro`) aparece dentro do
 * formulário sem apagar o que o usuário digitou.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Etiqueta } from '../../components/Etiqueta'
import { Select, type OpcaoSelect } from '../../components/Select'
import type { Dashboard, Filial, NovaTabelaFaixas, TabelaFaixas } from '../../types/dominio'
import { EditorFaixas } from './EditorFaixas'
import { linhaFaixaVazia, validarLinhasFaixas, type LinhaFaixaEditavel } from './regrasFaixas'
import './EditorFaixas.css'

export interface FormularioTabelaFaixasProps {
  /** Dashboards oferecidos no campo "Dashboard". */
  dashboards: Dashboard[]
  /** Tabelas já cadastradas, para a orientação de tabela existente (RN-14). */
  tabelas: TabelaFaixas[]
  /** Filial do cabeçalho; `null` em "Todas as filiais" (a filial é pedida no formulário). */
  filialFixa: Filial | null
  /** Filiais oferecidas no campo "Filial" quando `filialFixa` é `null`. */
  filiais: Filial[]
  /** Enquanto `true`, o botão de salvar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida ao salvar; `null` quando não há. */
  erro: string | null
  onSalvar: (dados: NovaTabelaFaixas) => void
  onCancelar: () => void
}

type ErrosFormulario = Partial<Record<'dashboard' | 'filial' | 'faixas', string>>

const NOTA_JA_EXISTE =
  'Já existe uma tabela de faixas para este dashboard nesta filial. Para mudar os valores, use “Alterar faixas” nela — o histórico de versões é mantido.'

function rotuloFilial(filial: Filial): string {
  return `${filial.codigo} - ${filial.nome}`
}

function textoOuNulo(texto: string): string | null {
  const limpo = texto.trim()
  return limpo === '' ? null : limpo
}

export function FormularioTabelaFaixas({
  dashboards,
  tabelas,
  filialFixa,
  filiais,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: FormularioTabelaFaixasProps) {
  const [dashboard, setDashboard] = useState('')
  const [filialEscolhida, setFilialEscolhida] = useState('')
  const [descricao, setDescricao] = useState('')
  const [linhas, setLinhas] = useState<LinhaFaixaEditavel[]>(() => [linhaFaixaVazia()])
  const [erros, setErros] = useState<ErrosFormulario>({})

  const opcoesDashboard: OpcaoSelect[] = dashboards.map((item) => ({ valor: String(item.id), rotulo: item.nome }))
  const opcoesFilial: OpcaoSelect[] = filiais.map((item) => ({ valor: item.codigo, rotulo: rotuloFilial(item) }))

  const idDashboard = dashboards.find((item) => String(item.id) === dashboard)?.id
  const filial = filialFixa ? filialFixa.codigo : filialEscolhida
  const jaExiste =
    idDashboard !== undefined && filial !== '' && tabelas.some((t) => t.idDashboard === idDashboard && t.filial === filial)

  function limparErro(campo: keyof ErrosFormulario) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || jaExiste) return

    const validacao = validarLinhasFaixas(linhas)
    const novosErros: ErrosFormulario = {}
    if (idDashboard === undefined) novosErros.dashboard = 'Selecione o dashboard.'
    if (filial === '') novosErros.filial = 'Selecione a filial.'
    if (validacao.erro !== null) novosErros.faixas = validacao.erro
    setErros(novosErros)

    if (Object.keys(novosErros).length > 0 || idDashboard === undefined || validacao.faixas === null) return

    onSalvar({ dashboard: idDashboard, filial, descricao: textoOuNulo(descricao), faixas: validacao.faixas })
  }

  return (
    <form className="formulario-faixas" onSubmit={enviar} noValidate>
      {filialFixa ? (
        <span>
          <Etiqueta tom="info">{`Filial ${rotuloFilial(filialFixa)}`}</Etiqueta>
        </span>
      ) : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <div className="formulario-faixas__grade">
        <Select
          rotulo="Dashboard"
          obrigatorio
          placeholder="Selecione"
          opcoes={opcoesDashboard}
          value={dashboard}
          erro={erros.dashboard}
          onChange={(evento) => {
            setDashboard(evento.target.value)
            limparErro('dashboard')
          }}
        />
        {filialFixa ? null : (
          <Select
            rotulo="Filial"
            obrigatorio
            placeholder="Selecione"
            opcoes={opcoesFilial}
            value={filialEscolhida}
            erro={erros.filial}
            onChange={(evento) => {
              setFilialEscolhida(evento.target.value)
              limparErro('filial')
            }}
          />
        )}
        <Campo
          rotulo="Descrição (opcional)"
          placeholder="Ex.: Resultado operacional"
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
        />
      </div>

      {jaExiste ? <Aviso tipo="alerta">{NOTA_JA_EXISTE}</Aviso> : null}

      <fieldset className="formulario-faixas__secao">
        <legend>Faixas</legend>
        <EditorFaixas
          linhas={linhas}
          desabilitado={salvando}
          onChange={(novas) => {
            setLinhas(novas)
            limparErro('faixas')
          }}
        />
      </fieldset>

      {erros.faixas ? <Aviso tipo="erro">{erros.faixas}</Aviso> : null}

      <div className="formulario-faixas__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando || jaExiste}>
          Salvar tabela de faixas
        </Botao>
      </div>
    </form>
  )
}
