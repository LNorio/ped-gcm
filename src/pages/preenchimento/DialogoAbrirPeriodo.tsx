/**
 * Diálogo "Abrir outro mês" (F9.11 — RF-75, RF-76, RNF-07; F9.12 — reabertura de mês passado).
 *
 * Só existe um mês aberto por vez, comum a todas as filiais. O Admin escolhe o Ano (2000 até o ano
 * atual) e o Mês; o mês já aberto e os meses posteriores ao mês atual ficam desabilitados. Um mês
 * posterior ao aberto é abertura de mês novo ("Abrir mês"); um mês anterior é reabertura de mês já
 * fechado (etiqueta "Reabertura", botão "Reabrir mês"). Nos dois casos o mês aberto fecha e passa a
 * ser só consulta.
 *
 * Componente controlado: a página chama `abrirPeriodo` em `onConfirmar(mes, reabertura)`
 * (mês como `AAAA-MM-01`) e devolve `salvando` e `erro` (mensagem da API), mostrado como alerta sem desfazer a escolha.
 */
import { useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import { Etiqueta } from '../../components/Etiqueta'
import { Select, type OpcaoSelect } from '../../components/Select'
import { formatarCompetencia } from '../../utils/formato'
import './DialogoAbrirPeriodo.css'

export interface DialogoAbrirPeriodoProps {
  aberto: boolean
  /** Mês aberto atual (`AAAA-MM-01`). */
  mesAberto: string
  salvando?: boolean
  /** Mensagem de erro da API; mostrada como alerta dentro do diálogo. */
  erro?: string | null
  onConfirmar: (mesDeReferencia: string, reabertura: boolean) => void
  onCancelar: () => void
}

const ANO_MINIMO = 2000

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0')

/** `AAAA-MM-01` do ano e mês (1 a 12). */
function referencia(ano: number, mes: number): string {
  return `${ano}-${doisDigitos(mes)}-01`
}

/** Mês não pode ser escolhido: é o mês aberto ou é posterior ao mês atual. */
function mesBloqueado(ano: number, mes: number, mesAberto: string, mesAtual: string): boolean {
  const escolhido = referencia(ano, mes)
  return escolhido === mesAberto || escolhido > mesAtual
}

type ConteudoProps = Omit<DialogoAbrirPeriodoProps, 'aberto'>

function ConteudoAbrirPeriodo({ mesAberto, salvando = false, erro = null, onConfirmar, onCancelar }: ConteudoProps) {
  // A data de hoje é lida uma vez, ao abrir o diálogo (o conteúdo é remontado a cada abertura).
  const [hoje] = useState(() => new Date())
  const anoAtual = hoje.getFullYear()
  const mesAtual = referencia(anoAtual, hoje.getMonth() + 1)
  const aberto = `${mesAberto.slice(0, 7)}-01`

  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState<number | null>(null)

  const opcoesAno: OpcaoSelect[] = []
  for (let valor = anoAtual; valor >= ANO_MINIMO; valor -= 1) opcoesAno.push({ valor: String(valor), rotulo: String(valor) })

  const opcoesMes: OpcaoSelect[] = NOMES_MESES.map((nome, indice) => ({
    valor: String(indice + 1),
    rotulo: nome,
    desabilitado: mesBloqueado(ano, indice + 1, aberto, mesAtual),
  }))

  function trocarAno(texto: string) {
    const novoAno = Number(texto)
    setAno(novoAno)
    if (mes !== null && mesBloqueado(novoAno, mes, aberto, mesAtual)) setMes(null)
  }

  const escolhido = mes === null ? null : referencia(ano, mes)
  const reabertura = escolhido !== null && escolhido < aberto
  const textoAberto = formatarCompetencia(aberto)
  const textoEscolhido = escolhido === null ? '' : formatarCompetencia(escolhido)

  function confirmar() {
    if (escolhido === null || salvando) return
    onConfirmar(escolhido, reabertura)
  }

  return (
    <Dialogo
      aberto
      titulo="Abrir outro mês"
      onFechar={onCancelar}
      acoes={
        <>
          <Botao type="button" variante="contorno" onClick={onCancelar}>
            Cancelar
          </Botao>
          <Botao type="button" onClick={confirmar} disabled={escolhido === null || salvando}>
            {reabertura ? 'Reabrir mês' : 'Abrir mês'}
          </Botao>
        </>
      }
    >
      <div className="dialogo-abrir-periodo">
        <p>{`Período aberto: ${textoAberto}.`}</p>
        <div className="dialogo-abrir-periodo__campos">
          <Select rotulo="Ano" opcoes={opcoesAno} value={String(ano)} onChange={(evento) => trocarAno(evento.target.value)} />
          <Select
            rotulo="Mês"
            opcoes={opcoesMes}
            placeholder="Selecione o mês"
            value={mes === null ? '' : String(mes)}
            onChange={(evento) => setMes(evento.target.value === '' ? null : Number(evento.target.value))}
          />
        </div>
        {escolhido !== null && reabertura ? (
          <div className="dialogo-abrir-periodo__impacto">
            <Etiqueta tom="alerta">Reabertura</Etiqueta>
            <p>{`Reabertura de mês já fechado: ${textoEscolhido} voltará a aceitar lançamentos e correções, para todas as filiais. Isto fechará o preenchimento de ${textoAberto}, que passará a ser só consulta.`}</p>
          </div>
        ) : null}
        {escolhido !== null && !reabertura ? (
          <div className="dialogo-abrir-periodo__impacto">
            <p>{`O período ${textoAberto} será fechado para preenchimento e passará a ser só consulta. ${textoEscolhido} passará a ser o único período aberto, para todas as filiais. Os lançamentos já feitos continuam disponíveis para consulta.`}</p>
          </div>
        ) : null}
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      </div>
    </Dialogo>
  )
}

export function DialogoAbrirPeriodo({ aberto, ...resto }: DialogoAbrirPeriodoProps) {
  if (!aberto) return null
  return <ConteudoAbrirPeriodo {...resto} />
}
