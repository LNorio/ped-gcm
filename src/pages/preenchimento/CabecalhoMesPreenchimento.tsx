/**
 * Cabeçalho do mês (F9.4 — RF-63; aviso de consulta do RF-62): região "Resumo do mês" com a filial, a
 * competência, a situação ("Aberto"/"Fechado"), o progresso e, no mês aberto, quem abriu o período e
 * quando. Fora do mês editável, o aviso de somente consulta indica o mês aberto.
 */
import { Aviso } from '../../components/Aviso'
import { Etiqueta } from '../../components/Etiqueta'
import type { TelaPreenchimento } from '../../types/dominio'
import { formatarCompetencia, formatarDataHora } from '../../utils/formato'
import { avisoSomenteConsulta } from './regrasPreenchimento'

export interface CabecalhoMesPreenchimentoProps {
  tela: TelaPreenchimento
}

function textoAbertura(tela: TelaPreenchimento): string | null {
  const quando = tela.abertoEm ? formatarDataHora(tela.abertoEm) : ''
  const partes: string[] = []
  if (tela.abertoPor) partes.push(`por ${tela.abertoPor}`)
  if (quando) partes.push(`em ${quando}`)
  return partes.length > 0 ? `Período aberto ${partes.join(' ')}` : null
}

export function CabecalhoMesPreenchimento({ tela }: CabecalhoMesPreenchimentoProps) {
  const aberto = tela.situacaoDoMes === 'aberto'
  const abertura = aberto ? textoAbertura(tela) : null
  const filial = tela.nomeFilial ? `Filial ${tela.filial} — ${tela.nomeFilial}` : `Filial ${tela.filial}`

  return (
    <section aria-label="Resumo do mês" className="resumo-mes-preenchimento">
      <div className="resumo-mes-preenchimento__linha">
        <p className="resumo-mes-preenchimento__filial">{filial}</p>
        <p className="resumo-mes-preenchimento__competencia">{`Competência: ${formatarCompetencia(tela.mesDeReferencia)}`}</p>
        <Etiqueta tom={aberto ? 'sucesso' : 'neutro'}>{aberto ? 'Aberto' : 'Fechado'}</Etiqueta>
      </div>
      <p className="resumo-mes-preenchimento__progresso">
        {`${tela.progresso.preenchidos} de ${tela.progresso.total} apontamentos preenchidos`}
      </p>
      {abertura ? <p className="resumo-mes-preenchimento__abertura">{abertura}</p> : null}
      {tela.editavel ? null : <Aviso tipo="info">{avisoSomenteConsulta(tela.periodoAberto)}</Aviso>}
    </section>
  )
}
