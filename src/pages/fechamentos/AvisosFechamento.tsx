import { Aviso } from '../../components/Aviso'
import type { ResumoFechamento } from '../../types/dominio'
import { avisoPendencias, avisoSemFaixas, filiaisDosAvisos } from './previaFechamento'
import './AvisosFechamento.css'

/**
 * Avisos da prévia e da confirmação do encerramento (F10.4, F10.5): filiais com lançamentos pendentes
 * (congelados sem valor) e filiais sem tabela de faixas (imagens sem pontuação), a partir do resumo.
 */
export function AvisosFechamento({ resumo }: { resumo: ResumoFechamento }) {
  const { pendencias, semFaixas } = filiaisDosAvisos(resumo)
  if (pendencias.length === 0 && semFaixas.length === 0) return null
  return (
    <div className="avisos-fechamento">
      {pendencias.length > 0 ? <Aviso tipo="alerta">{avisoPendencias(pendencias)}</Aviso> : null}
      {semFaixas.length > 0 ? <Aviso tipo="alerta">{avisoSemFaixas(semFaixas)}</Aviso> : null}
    </div>
  )
}
