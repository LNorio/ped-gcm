/**
 * Formulário "Alterar faixas" (F8.4 — RF-44, RF-43, RN-14): grava a versão seguinte da tabela.
 *
 * Mostra o nome da tabela e a versão que será gerada (vigente + 1); o editor começa com as faixas
 * vigentes no padrão pt-BR. "Motivo da alteração" é obrigatório (fica registrado no histórico).
 * Valida localmente antes de chamar `onSalvar`; o erro devolvido pela API (`erro`) aparece dentro do
 * formulário sem apagar o que o usuário digitou.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import type { AlteracaoFaixas } from '../../services/faixasService'
import type { TabelaFaixas } from '../../types/dominio'
import { EditorFaixas } from './EditorFaixas'
import { linhaFaixaVazia, nomeTabelaFaixas, paraLinhasEditaveis, validarLinhasFaixas, type LinhaFaixaEditavel } from './regrasFaixas'
import './EditorFaixas.css'

export interface FormularioAlterarFaixasProps {
  /** Tabela alterada, com as faixas vigentes. */
  tabela: TabelaFaixas
  /** Enquanto `true`, o botão de salvar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida ao salvar; `null` quando não há. */
  erro: string | null
  onSalvar: (dados: AlteracaoFaixas) => void
  onCancelar: () => void
}

type ErrosFormulario = Partial<Record<'motivo' | 'faixas', string>>

/** Linhas iniciais: as faixas vigentes; sem faixas, uma linha vazia para começar. */
function linhasIniciais(tabela: TabelaFaixas): LinhaFaixaEditavel[] {
  const linhas = paraLinhasEditaveis(tabela.faixas)
  return linhas.length > 0 ? linhas : [linhaFaixaVazia()]
}

export function FormularioAlterarFaixas({ tabela, salvando, erro, onSalvar, onCancelar }: FormularioAlterarFaixasProps) {
  const [linhas, setLinhas] = useState<LinhaFaixaEditavel[]>(() => linhasIniciais(tabela))
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<ErrosFormulario>({})

  function limparErro(campo: keyof ErrosFormulario) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return

    const motivoLimpo = motivo.trim()
    const validacao = validarLinhasFaixas(linhas)
    const novosErros: ErrosFormulario = {}
    if (validacao.erro !== null) novosErros.faixas = validacao.erro
    if (motivoLimpo === '') novosErros.motivo = 'Informe o motivo da alteração.'
    setErros(novosErros)

    if (Object.keys(novosErros).length > 0 || validacao.faixas === null) return

    onSalvar({ motivo: motivoLimpo, faixas: validacao.faixas })
  }

  return (
    <form className="formulario-faixas" onSubmit={enviar} noValidate>
      <div className="formulario-faixas__cabecalho">
        <p className="formulario-faixas__nome">{nomeTabelaFaixas(tabela)}</p>
        <p className="formulario-faixas__versao">{`Alterando faixas — será gerada a versão v${tabela.versaoVigente + 1}`}</p>
      </div>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

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

      <Campo
        rotulo="Motivo da alteração"
        obrigatorio
        placeholder="Obrigatório — fica registrado no histórico"
        value={motivo}
        erro={erros.motivo}
        onChange={(evento) => {
          setMotivo(evento.target.value)
          if (evento.target.value.trim() !== '') limparErro('motivo')
        }}
      />

      {erros.faixas ? <Aviso tipo="erro">{erros.faixas}</Aviso> : null}

      <div className="formulario-faixas__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          Salvar nova versão
        </Botao>
      </div>
    </form>
  )
}
