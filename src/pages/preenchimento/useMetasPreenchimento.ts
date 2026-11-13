/**
 * Janela de metas da tela do Preenchimento (F9.9 — RF-71, RF-72).
 *
 * Com filial e mês (`AAAA-MM-DD` ou `AAAA-MM`), consulta `listarMetasPreenchimento({ filial,
 * mesDeReferencia })`; sem algum dos dois, nada é consultado. Refaz a consulta quando a filial ou o mês
 * mudam, em `recarregar()` e quando `versaoPeriodo` muda (um período foi aberto ou reaberto: a janela do
 * mesmo filial/mês pode ter deixado de ser só consulta). Durante a recarga do mesmo filial/mês, a janela anterior continua visível.
 * A falha da consulta não é exibida: a janela fica `null` (o botão "Editar metas" some).
 *
 * Consulta antecipada: a página pode disparar a consulta assim que a resposta da tela chega
 * (`anteciparMetasPreenchimento`) e guardar a resposta em `resposta`, sem esperar a renderização da
 * tela e o efeito deste hook. Sendo do filial/mês atual, o hook a usa no lugar de uma nova consulta
 * (uma única consulta) e mostra a resposta já na renderização; `recarregar()` e a mudança de
 * `versaoPeriodo` depois dela voltam a consultar.
 */
import { useCallback, useEffect, useState } from 'react'
import { listarMetasPreenchimento } from '../../services/metasService'
import type { JanelaMetas, TelaPreenchimento } from '../../types/dominio'
import { mesDeCompetencia } from './regrasPreenchimento'

export interface UseMetasPreenchimentoResultado {
  /** Janela do filial/mês atual; `null` antes da resposta, sem filial/mês ou após falha. */
  janela: JanelaMetas | null
  /** Repete a consulta do mesmo filial/mês. */
  recarregar: () => void
}

/** Consulta da janela já disparada para um filial/mês; a falha resolve com `null` (nunca rejeita). */
export interface ConsultaMetasAntecipada {
  chave: string
  promessa: Promise<JanelaMetas | null>
  /** Presente depois que a consulta respondeu (`janela: null` = falha). */
  resposta?: { janela: JanelaMetas | null }
}

interface EstadoConsulta {
  chave: string
  janela: JanelaMetas | null
  /** Consulta antecipada de onde veio a janela (`null` = consulta do próprio hook). */
  origem: Promise<JanelaMetas | null> | null
}

/** Versões em que a consulta antecipada chegou: depois de mudarem, ela deixa de valer. */
interface BaseAntecipada {
  promessa: Promise<JanelaMetas | null>
  versao: number
  versaoPeriodo: number
}

/** Mês da janela de metas de uma tela (`AAAA-MM-01`, ou o valor recebido fora do formato). */
export function mesDasMetas(tela: TelaPreenchimento): string {
  return mesDeCompetencia(tela.mesDeReferencia) ?? tela.mesDeReferencia
}

function chaveDaConsulta(filial: string, mesDeReferencia: string): string {
  return `${filial}|${mesDeReferencia}`
}

function consultarJanela(filial: string, mesDeReferencia: string): Promise<JanelaMetas | null> {
  return listarMetasPreenchimento({ filial, mesDeReferencia }).then(
    (janela) => janela,
    () => null,
  )
}

/** Dispara já a consulta da janela do filial/mês, para ser usada depois por `useMetasPreenchimento`. */
export function anteciparMetasPreenchimento(filial: string, mesDeReferencia: string): ConsultaMetasAntecipada {
  return { chave: chaveDaConsulta(filial, mesDeReferencia), promessa: consultarJanela(filial, mesDeReferencia) }
}

export function useMetasPreenchimento(
  filial: string | null,
  mesDeReferencia: string | null,
  versaoPeriodo = 0,
  antecipada: ConsultaMetasAntecipada | null = null,
): UseMetasPreenchimentoResultado {
  const [versao, setVersao] = useState(0)
  const [consulta, setConsulta] = useState<EstadoConsulta | null>(null)
  const [base, setBase] = useState<BaseAntecipada | null>(null)
  const chave = filial !== null && mesDeReferencia !== null ? chaveDaConsulta(filial, mesDeReferencia) : null

  // Consulta antecipada nova: guarda as versões atuais (estado derivado na própria renderização).
  if (antecipada !== null && base?.promessa !== antecipada.promessa) {
    setBase({ promessa: antecipada.promessa, versao, versaoPeriodo })
  }
  const antecipadaValida =
    antecipada !== null &&
    antecipada.chave === chave &&
    (base?.promessa !== antecipada.promessa || (base.versao === versao && base.versaoPeriodo === versaoPeriodo))
  const respostaAntecipada = antecipadaValida ? antecipada.resposta : undefined

  // A resposta antecipada também passa a ser a última janela conhecida: continua visível durante uma
  // recarga posterior do mesmo filial/mês.
  if (chave !== null && antecipada !== null && respostaAntecipada !== undefined && consulta?.origem !== antecipada.promessa) {
    setConsulta({ chave, janela: respostaAntecipada.janela, origem: antecipada.promessa })
  }

  useEffect(() => {
    if (filial === null || mesDeReferencia === null || antecipadaValida) return
    let ativo = true
    const chaveConsulta = chaveDaConsulta(filial, mesDeReferencia)
    void consultarJanela(filial, mesDeReferencia).then((janela) => {
      if (ativo) setConsulta({ chave: chaveConsulta, janela, origem: null })
    })
    return () => {
      ativo = false
    }
  }, [filial, mesDeReferencia, versao, versaoPeriodo, antecipadaValida])

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), [])

  const janela =
    respostaAntecipada !== undefined ? respostaAntecipada.janela : chave !== null && consulta?.chave === chave ? consulta.janela : null
  return { janela, recarregar }
}
