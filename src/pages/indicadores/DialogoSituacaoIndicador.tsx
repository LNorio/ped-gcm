/**
 * Confirmação de inativar/reativar um indicador (F6.6 — RF-38, RN-08, RNF-07).
 *
 * Com `indicador` nulo, nada é renderizado. O impacto acompanha a situação atual: inativar tira o
 * indicador da pontuação dos dashboards; reativar a devolve. Os dashboards listados são os conhecidos
 * pelo próprio indicador antes da alteração (a API só devolve a lista na resposta).
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Indicador } from '../../types/dominio'

export interface DialogoSituacaoIndicadorProps {
  /** Indicador a inativar/reativar; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  alterando: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

const IMPACTO_INATIVAR =
  'Enquanto inativo, o indicador não pontua: seus pontos base ficam sem pontuação nos dashboards em que aparece. Imagens já congeladas são mantidas.'
const IMPACTO_REATIVAR = 'Reativado, o indicador volta a pontuar nos dashboards em que aparece.'

export function DialogoSituacaoIndicador({ indicador, alterando, onConfirmar, onCancelar }: DialogoSituacaoIndicadorProps) {
  if (indicador === null) return null

  const inativar = indicador.ativo
  const dashboards = indicador.dashboards

  const impacto = (
    <>
      <p>{inativar ? IMPACTO_INATIVAR : IMPACTO_REATIVAR}</p>
      {dashboards.length > 0 ? (
        <ul className="dialogo-situacao-indicador__dashboards" aria-label="Dashboards afetados">
          {dashboards.map((dashboard) => (
            <li key={dashboard.id}>{`${dashboard.nome} (${dashboard.pontosBase} pontos base)`}</li>
          ))}
        </ul>
      ) : (
        <p>Nenhum dashboard é afetado.</p>
      )}
    </>
  )

  return (
    <DialogoConfirmacao
      aberto
      titulo={inativar ? 'Inativar indicador' : 'Reativar indicador'}
      impacto={impacto}
      textoConfirmar={inativar ? 'Inativar' : 'Reativar'}
      processando={alterando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
