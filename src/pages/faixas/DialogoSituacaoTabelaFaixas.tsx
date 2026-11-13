/**
 * Diálogo "Inativar tabela"/"Reativar tabela" de faixas (F8.7 — proposta "faixa geral e situação",
 * seção 4).
 *
 * Tabela ativa: "Inativar tabela de faixas" (a tabela deixa de valer no cálculo, continua na lista e
 * pode ser reativada). Tabela inativa: "Reativar tabela de faixas". O motivo é obrigatório nos dois
 * sentidos e vai sem os espaços das pontas para `onConfirmar`. O erro da API (`erro`, ex.: `400` de
 * conflito na reativação) aparece dentro do diálogo, sem apagar o motivo digitado; com `conflitos`
 * (F8.12*), o alerta mostra também o dashboard da tabela e as tabelas em conflito
 * (`AvisoConflitoFaixas`). Com `tabela` nula, nada é renderizado.
 */
import { useState } from 'react'
import { Campo } from '../../components/Campo'
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { ConflitoFaixas } from '../../services/faixasService'
import type { TabelaFaixas } from '../../types/dominio'
import { AvisoConflitoFaixas } from './AvisoConflitoFaixas'
import { nomeTabelaFaixas } from './regrasFaixas'

export interface DialogoSituacaoTabelaFaixasProps {
  /** Tabela a inativar (ativa) ou reativar (inativa); `null` mantém o diálogo fechado. */
  tabela: TabelaFaixas | null
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida pela API; `null` quando não há. */
  erro: string | null
  /** Tabelas em conflito do `400` (F8.12*), mostradas com `erro`; ausente, `null` ou vazia = só a mensagem. */
  conflitos?: ConflitoFaixas[] | null
  /** Recebe o motivo, sem os espaços das pontas. */
  onConfirmar: (motivo: string) => void
  /** Chamado ao cancelar, fechar ou pressionar Esc. */
  onCancelar: () => void
}

interface TextosSituacao {
  titulo: string
  impacto: (nome: string) => string
  rotuloMotivo: string
  erroMotivo: string
  confirmar: string
}

const INATIVAR: TextosSituacao = {
  titulo: 'Inativar tabela de faixas',
  impacto: (nome) =>
    `A tabela de faixas “${nome}” deixa de valer no cálculo do dashboard. Ela continua na lista (filtro “Inativas”) e pode ser reativada depois.`,
  rotuloMotivo: 'Motivo da inativação',
  erroMotivo: 'Informe o motivo da inativação.',
  confirmar: 'Inativar',
}

const REATIVAR: TextosSituacao = {
  titulo: 'Reativar tabela de faixas',
  impacto: (nome) => `A tabela de faixas “${nome}” volta a valer no cálculo do dashboard.`,
  rotuloMotivo: 'Motivo da reativação',
  erroMotivo: 'Informe o motivo da reativação.',
  confirmar: 'Reativar',
}

type ConteudoProps = Omit<DialogoSituacaoTabelaFaixasProps, 'tabela'> & { tabela: TabelaFaixas }

function ConteudoSituacao({ tabela, salvando, erro, conflitos, onConfirmar, onCancelar }: ConteudoProps) {
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)
  const textos = tabela.situacao === 'inativa' ? REATIVAR : INATIVAR

  function confirmar() {
    if (salvando) return
    const motivoLimpo = motivo.trim()
    if (motivoLimpo === '') {
      setErroMotivo(textos.erroMotivo)
      return
    }
    onConfirmar(motivoLimpo)
  }

  return (
    <DialogoConfirmacao
      aberto
      titulo={textos.titulo}
      impacto={
        <>
          <p>{textos.impacto(nomeTabelaFaixas(tabela))}</p>
          <AvisoConflitoFaixas erro={erro} conflitos={conflitos} dashboard={tabela.dashboard} />
          <Campo
            rotulo={textos.rotuloMotivo}
            obrigatorio
            placeholder="Obrigatório — fica registrado no histórico"
            value={motivo}
            erro={erroMotivo}
            onChange={(evento) => {
              setMotivo(evento.target.value)
              if (evento.target.value.trim() !== '') setErroMotivo(null)
            }}
          />
        </>
      }
      textoConfirmar={textos.confirmar}
      processando={salvando}
      onConfirmar={confirmar}
      onCancelar={onCancelar}
    />
  )
}

export function DialogoSituacaoTabelaFaixas({ tabela, ...resto }: DialogoSituacaoTabelaFaixasProps) {
  if (tabela === null) return null
  return <ConteudoSituacao key={`${tabela.id}-${tabela.situacao}`} tabela={tabela} {...resto} />
}
