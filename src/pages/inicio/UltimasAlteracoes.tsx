import { Card } from '../../components/Card'
import { Etiqueta } from '../../components/Etiqueta'
import { ROTULOS_ACAO_LANCAMENTO, type UltimaAlteracaoInicio, type ValorLancamento } from '../../types/dominio'
import { formatarCompetencia, formatarDataHora, formatarNumero } from '../../utils/formato'
import './UltimasAlteracoes.css'

/** Quantidade máxima de alterações exibidas (as mais recentes, na ordem da API). */
export const MAXIMO_ULTIMAS_ALTERACOES = 6

export interface UltimasAlteracoesProps {
  /** Alterações na ordem da API (mais recente primeiro). */
  alteracoes: UltimaAlteracaoInicio[]
}

/** Número em pt-BR com 2 casas (RN-10); booleano como "Sim"/"Não". */
function formatarValor(valor: ValorLancamento): string {
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  return formatarNumero(valor)
}

/** "Competência MM/AAAA · Filial {código} · {anterior} → {novo}" (sem anterior, só o novo). */
function textoDetalhe(alteracao: UltimaAlteracaoInicio): string {
  const partes = [`Competência ${formatarCompetencia(alteracao.competencia)}`, `Filial ${alteracao.filial}`]
  const novo = alteracao.valorNovo === null ? '' : formatarValor(alteracao.valorNovo)
  if (alteracao.valorAnterior !== null) partes.push(`${formatarValor(alteracao.valorAnterior)} → ${novo}`)
  else if (novo !== '') partes.push(novo)
  return partes.join(' · ')
}

/** "dd/mm/aaaa hh:mm · {usuário}" (sem usuário, só a data). */
function textoQuando(alteracao: UltimaAlteracaoInicio): string {
  const data = formatarDataHora(alteracao.data)
  return alteracao.usuario ? `${data} · ${alteracao.usuario}` : data
}

/** "Últimas alterações em apontamentos" do Início (F11.5 — RF-11): no máximo 6, na ordem recebida. */
export function UltimasAlteracoes({ alteracoes }: UltimasAlteracoesProps) {
  const exibidas = alteracoes.slice(0, MAXIMO_ULTIMAS_ALTERACOES)

  return (
    <Card titulo="Últimas alterações em apontamentos" className="ultimas-alteracoes">
      {exibidas.length === 0 ? (
        <p className="ultimas-alteracoes__vazio">Nenhum lançamento registrado ainda.</p>
      ) : (
        <ul className="ultimas-alteracoes__lista">
          {exibidas.map((alteracao, indice) => (
            <li key={`${alteracao.data}-${alteracao.apontamento}-${indice}`} className="ultimas-alteracoes__item">
              <div className="ultimas-alteracoes__topo">
                <Etiqueta tom={alteracao.acao === 'correcao' ? 'alerta' : 'info'}>
                  {ROTULOS_ACAO_LANCAMENTO[alteracao.acao]}
                </Etiqueta>
                <span className="ultimas-alteracoes__apontamento">{alteracao.apontamento}</span>
              </div>
              <span className="ultimas-alteracoes__detalhe">{textoDetalhe(alteracao)}</span>
              <span className="ultimas-alteracoes__quando">{textoQuando(alteracao)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
