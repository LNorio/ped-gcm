/**
 * Seletor do mês de competência e do ano (F9.3 — RF-61, RF-62). Componente controlado.
 *
 * - Grupo "Mês de competência" com os 12 meses: o aberto mostra "aberto" e os pendentes; os demais
 *   passados, "fechado · consulta"; os futuros ficam desabilitados ("futuro"). O selecionado fica com
 *   `aria-pressed="true"`.
 * - Ano por setas ("Ano anterior"/"Próximo ano") ou digitação (campo "Ano"), de 2000 ao ano atual;
 *   `onMudarAno` só é chamado com um ano completo válido.
 * - "Ir para o período aberto" quando o mês selecionado não é o aberto ou o ano exibido não é o dele.
 */
import { useId, useState } from 'react'
import { Botao } from '../../components/Botao'
import type { MesPreenchimento } from '../../types/dominio'
import { ANO_MINIMO_PREENCHIMENTO, NOMES_MESES, anoDaData } from './regrasPreenchimento'
import './SeletorMesCompetencia.css'

export interface SeletorMesCompetenciaProps {
  ano: number
  meses: MesPreenchimento[]
  /** Mês da tela (`AAAA-MM-01`). */
  mesSelecionado: string | null
  /** Mês aberto para preenchimento (`AAAA-MM-01`). */
  periodoAberto: string | null
  onSelecionarMes: (mes: string) => void
  onMudarAno: (ano: number) => void
  onIrParaPeriodoAberto: () => void
}

function textoPendentes(pendentes: number): string {
  return `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`
}

function DetalheMes({ mes }: { mes: MesPreenchimento }) {
  if (mes.situacao === 'futuro') return <span className="seletor-mes__detalhe">futuro</span>
  if (mes.situacao === 'fechado') return <span className="seletor-mes__detalhe">fechado · consulta</span>
  return (
    <>
      <span className="seletor-mes__detalhe seletor-mes__detalhe--aberto">aberto</span>
      {mes.pendentes !== null ? <span className="seletor-mes__pendentes">{textoPendentes(mes.pendentes)}</span> : null}
    </>
  )
}

export function SeletorMesCompetencia({
  ano,
  meses,
  mesSelecionado,
  periodoAberto,
  onSelecionarMes,
  onMudarAno,
  onIrParaPeriodoAberto,
}: SeletorMesCompetenciaProps) {
  const idAno = useId()
  const idGrupo = useId()
  const [anoAtual] = useState(() => new Date().getFullYear())

  // O campo guarda o texto digitado; trocar a prop `ano` (setas, "Ir para o período aberto") o atualiza.
  const [textoAno, setTextoAno] = useState(String(ano))
  const [anoExibido, setAnoExibido] = useState(ano)
  if (ano !== anoExibido) {
    setAnoExibido(ano)
    setTextoAno(String(ano))
  }

  function aoDigitarAno(texto: string) {
    setTextoAno(texto)
    if (!/^\d{4}$/.test(texto)) return
    const digitado = Number(texto)
    if (digitado < ANO_MINIMO_PREENCHIMENTO || digitado > anoAtual || digitado === ano) return
    onMudarAno(digitado)
  }

  const foraDoPeriodoAberto =
    periodoAberto !== null && (mesSelecionado !== periodoAberto || ano !== anoDaData(periodoAberto))

  return (
    <div className="seletor-mes">
      <div className="seletor-mes__ano">
        <Botao
          variante="contorno"
          tamanho="pequeno"
          aria-label="Ano anterior"
          disabled={ano <= ANO_MINIMO_PREENCHIMENTO}
          onClick={() => onMudarAno(ano - 1)}
        >
          <span aria-hidden="true">‹</span>
        </Botao>
        <label className="seletor-mes__rotulo-ano" htmlFor={idAno}>
          Ano
        </label>
        <input
          id={idAno}
          type="number"
          className="seletor-mes__campo-ano foco-interno"
          min={ANO_MINIMO_PREENCHIMENTO}
          max={anoAtual}
          value={textoAno}
          onChange={(evento) => aoDigitarAno(evento.target.value)}
        />
        <Botao
          variante="contorno"
          tamanho="pequeno"
          aria-label="Próximo ano"
          disabled={ano >= anoAtual}
          onClick={() => onMudarAno(ano + 1)}
        >
          <span aria-hidden="true">›</span>
        </Botao>
        {foraDoPeriodoAberto ? (
          <Botao variante="link" tamanho="pequeno" onClick={onIrParaPeriodoAberto}>
            Ir para o período aberto
          </Botao>
        ) : null}
      </div>
      <span id={idGrupo} className="visualmente-oculto">
        Mês de competência
      </span>
      <div role="group" aria-labelledby={idGrupo} className="seletor-mes__meses">
        {meses.map((mes) => {
          const selecionado = mes.mesDeReferencia === mesSelecionado
          const classes = ['seletor-mes__mes', 'foco-anel', `seletor-mes__mes--${mes.situacao}`]
          if (selecionado) classes.push('seletor-mes__mes--selecionado')
          return (
            <button
              key={mes.mesDeReferencia}
              type="button"
              className={classes.join(' ')}
              aria-pressed={selecionado}
              disabled={mes.situacao === 'futuro'}
              onClick={() => onSelecionarMes(mes.mesDeReferencia)}
            >
              <span className="seletor-mes__nome">{NOMES_MESES[mes.mes - 1]}</span>
              <DetalheMes mes={mes} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
