/**
 * Alerta do erro de gravação das faixas, com as tabelas em conflito (F8.7, F8.12*).
 *
 * Usado no cadastro (`FormularioTabelaFaixas`) e na inativação/reativação
 * (`DialogoSituacaoTabelaFaixas`). Sem `erro`, nada é renderizado. Com `conflitos` não vazios (o
 * `400` de conflito do contrato final, lido por `conflitosDoErro`), o mesmo alerta mostra a mensagem
 * da API, a linha "Dashboard: {nome}" (a mensagem da API não cita o dashboard) e a lista "Tabelas em
 * conflito"; sem conflitos (ex.: `400` de corrida entre gravações), só a mensagem.
 */
import { Aviso } from '../../components/Aviso'
import type { ConflitoFaixas } from '../../services/faixasService'
import { textoConflitoFaixas } from './regrasFaixas'
import './AvisoConflitoFaixas.css'

export interface AvisoConflitoFaixasProps {
  /** Mensagem de erro; `null` não renderiza nada. */
  erro: string | null
  /** Tabelas em conflito devolvidas pela API; ausente, `null` ou vazia mostra só a mensagem. */
  conflitos?: ConflitoFaixas[] | null
  /** Nome do dashboard envolvido, exibido com os conflitos; sem nome, a linha é omitida. */
  dashboard?: string | null
}

export function AvisoConflitoFaixas({ erro, conflitos, dashboard }: AvisoConflitoFaixasProps) {
  if (!erro) return null
  if (!conflitos || conflitos.length === 0) return <Aviso tipo="erro">{erro}</Aviso>
  return (
    <Aviso tipo="erro">
      <p>{erro}</p>
      {dashboard ? <p>{`Dashboard: ${dashboard}`}</p> : null}
      <ul className="aviso-conflito-faixas__lista" aria-label="Tabelas em conflito">
        {conflitos.map((conflito) => (
          <li key={conflito.id}>{textoConflitoFaixas(conflito)}</li>
        ))}
      </ul>
    </Aviso>
  )
}
