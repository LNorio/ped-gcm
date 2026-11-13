/**
 * Confirmação da exclusão de uma tabela de faixas (F8.6 — RF-46, RN-18, RNF-07).
 *
 * Só a tabela de um dashboard excluído pode ser excluída: nela, o diálogo descreve o impacto e pede o
 * "Motivo da exclusão" (obrigatório desde 12/11/2026), com "Cancelar" e "Excluir" (perigo); o motivo
 * vai sem os espaços das pontas para `onConfirmar`. Tabela de dashboard existente vira um aviso de
 * bloqueio com apenas "Entendi" (a orientação é inativá-la — F8.7). Com `tabela` nula, nada é
 * renderizado.
 */
import { useState } from 'react'
import { Campo } from '../../components/Campo'
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { TabelaFaixas } from '../../types/dominio'
import { nomeTabelaFaixas } from './regrasFaixas'

export interface DialogoExcluirTabelaFaixasProps {
  /** Tabela a excluir; `null` mantém o diálogo fechado. */
  tabela: TabelaFaixas | null
  /** Enquanto `true`, o botão "Excluir" fica desabilitado. */
  excluindo: boolean
  /** Recebe o motivo da exclusão, sem os espaços das pontas. */
  onConfirmar: (motivo: string) => void
  /** Chamado ao cancelar, pressionar Esc ou escolher "Entendi". */
  onCancelar: () => void
}

const MENSAGEM_BLOQUEIO_EXCLUSAO_FAIXAS =
  'Esta tabela pertence a um dashboard existente e não pode ser excluída — use “Inativar tabela” para que ela deixe de valer ou “Alterar faixas” para gerar uma nova versão.'
const ERRO_MOTIVO = 'Informe o motivo da exclusão.'

type ConteudoProps = Omit<DialogoExcluirTabelaFaixasProps, 'tabela'> & { tabela: TabelaFaixas }

function ConteudoExclusao({ tabela, excluindo, onConfirmar, onCancelar }: ConteudoProps) {
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)

  function confirmar() {
    if (excluindo) return
    const motivoLimpo = motivo.trim()
    if (motivoLimpo === '') {
      setErroMotivo(ERRO_MOTIVO)
      return
    }
    onConfirmar(motivoLimpo)
  }

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir tabela de faixas"
      impacto={
        <>
          <p>{`A tabela de faixas de “${nomeTabelaFaixas(tabela)}” e o seu histórico de versões serão excluídos. Imagens já congeladas mantêm as faixas vigentes no fechamento.`}</p>
          <Campo
            rotulo="Motivo da exclusão"
            obrigatorio
            placeholder="Obrigatório"
            value={motivo}
            erro={erroMotivo}
            onChange={(evento) => {
              setMotivo(evento.target.value)
              if (evento.target.value.trim() !== '') setErroMotivo(null)
            }}
          />
        </>
      }
      bloqueio={tabela.dashboardExcluido ? undefined : MENSAGEM_BLOQUEIO_EXCLUSAO_FAIXAS}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={confirmar}
      onCancelar={onCancelar}
    />
  )
}

export function DialogoExcluirTabelaFaixas({ tabela, ...resto }: DialogoExcluirTabelaFaixasProps) {
  if (tabela === null) return null
  return <ConteudoExclusao key={tabela.id} tabela={tabela} {...resto} />
}
