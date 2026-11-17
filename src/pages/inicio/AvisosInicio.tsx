import { Aviso } from '../../components/Aviso'
import type { AvisoDeAcessoInicio, Perfil, PeriodoAbertoInicio } from '../../types/dominio'
import { formatarCompetencia } from '../../utils/formato'
import './AvisosInicio.css'

export interface AvisosInicioProps {
  perfil: Perfil
  /** Mês aberto para preenchimento (RF-06); `null` = sem mês aberto ("Nenhum período aberto para preenchimento."). */
  periodoAberto: PeriodoAbertoInicio | null
  /** Acesso restrito (RF-07); a API manda `null` para Admin e Validador. */
  avisoDeAcesso: AvisoDeAcessoInicio | null
}

/** "Período aberto para preenchimento: MM/AAAA. Apenas um período fica aberto por vez." */
function textoAvisoPeriodo(periodo: PeriodoAbertoInicio): string {
  return `Período aberto para preenchimento: ${formatarCompetencia(periodo.mesDeReferencia)}. Apenas um período fica aberto por vez.`
}

/**
 * Texto do aviso de acesso, montado pelo front a partir dos tipos e filiais (a `mensagem` da API não é
 * exibida). Preenchedor: tipos e filiais; outro perfil: só as filiais.
 */
function textoAvisoAcesso(perfil: Perfil, aviso: AvisoDeAcessoInicio): string {
  const filiais = aviso.filiais.join(', ')
  if (perfil === 'preenchedor') {
    const base = `Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos ${aviso.tipos.join(', ')}`
    if (aviso.filiais.length === 0) return `${base}.`
    return `${base}, somente ${aviso.filiais.length === 1 ? 'na filial' : 'nas filiais'} ${filiais}.`
  }
  return aviso.filiais.length === 1
    ? `Seu usuário tem acesso somente à filial ${filiais}.`
    : `Seu usuário tem acesso somente às filiais ${filiais}.`
}

/** Aviso do Início sem mês aberto para preenchimento (RF-06). */
const TEXTO_SEM_PERIODO_ABERTO = 'Nenhum período aberto para preenchimento.'

/**
 * Avisos do Início (F11.2 — RF-06, RF-07): período aberto (ou "Nenhum período aberto para
 * preenchimento.") e, quando houver, acesso restrito.
 */
export function AvisosInicio({ perfil, periodoAberto, avisoDeAcesso }: AvisosInicioProps) {
  return (
    <div className="avisos-inicio">
      <Aviso>{periodoAberto ? textoAvisoPeriodo(periodoAberto) : TEXTO_SEM_PERIODO_ABERTO}</Aviso>
      {avisoDeAcesso ? <Aviso tipo="alerta">{textoAvisoAcesso(perfil, avisoDeAcesso)}</Aviso> : null}
    </div>
  )
}
