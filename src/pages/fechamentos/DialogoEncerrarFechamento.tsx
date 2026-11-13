/**
 * Encerramento manual do período atual de um dashboard, com confirmação (F10.5 — RF-77, RF-81, RF-82,
 * RNF-07).
 *
 * A confirmação é montada a partir do resumo da prévia: a recebida em `previa` (vinda da
 * pré-visualização) ou, sem ela, uma consulta própria a `obterPreviaFechamento(fechamento.id)` (aberto
 * pelo menu da linha). Mostra o total de imagens a gerar (uma por filial ou por colaborador), as imagens
 * por filial, que os outros dashboards não são afetados e os avisos de pendências e de falta de faixas.
 * Confirmar faz um único `encerrarFechamento(fechamento.id)`; sucesso chama `onEncerrado(resultado)` e
 * erro fica no diálogo, que continua aberto. Sem imagens a gerar, explica o motivo e oferece só "Entendi".
 */
import { useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import { mensagemDeErro } from '../../services/api'
import { encerrarFechamento } from '../../services/fechamentosService'
import type { Fechamento, PreviaFechamento, ResultadoEncerramento } from '../../types/dominio'
import { AvisosFechamento } from './AvisosFechamento'
import {
  TEXTO_CALCULANDO,
  TEXTO_OUTROS_DASHBOARDS,
  TEXTO_TODAS_ENCERRADAS,
  agruparPorFilial,
  previaPorColaborador,
  rotuloEncerrar,
  rotuloFilial,
  textoImagens,
} from './previaFechamento'
import { usePreviaFechamento } from './usePreviaFechamento'
import './DialogoEncerrarFechamento.css'

export interface DialogoEncerrarFechamentoProps {
  fechamento: Fechamento
  /** Prévia já carregada (vinda da pré-visualização); sem ela, o diálogo consulta a prévia. */
  previa?: PreviaFechamento | null
  onCancelar: () => void
  onEncerrado: (resultado: ResultadoEncerramento) => void
}

export function DialogoEncerrarFechamento({
  fechamento,
  previa: previaRecebida,
  onCancelar,
  onEncerrado,
}: DialogoEncerrarFechamentoProps) {
  const { previa, carregando, erro: erroPrevia } = usePreviaFechamento(fechamento.id, previaRecebida)
  const [gravando, setGravando] = useState(false)
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null)
  const gravandoRef = useRef(false)

  const titulo = `Encerrar ${fechamento.nome} — ${fechamento.periodoAtual}`
  const aGerar = previa?.resumo.imagensAGerar ?? 0
  const bloqueado = previa !== null && (aGerar === 0 || previa.imagens.length === 0)

  async function encerrar() {
    if (gravandoRef.current) return
    gravandoRef.current = true
    setGravando(true)
    setErroEncerrar(null)
    try {
      const resultado = await encerrarFechamento(fechamento.id)
      onEncerrado(resultado)
    } catch (erro) {
      setErroEncerrar(mensagemDeErro(erro))
    } finally {
      gravandoRef.current = false
      setGravando(false)
    }
  }

  function cancelar() {
    if (gravandoRef.current) return
    onCancelar()
  }

  const acoes = bloqueado ? (
    <Botao onClick={onCancelar}>Entendi</Botao>
  ) : (
    <>
      <Botao variante="contorno" onClick={cancelar} disabled={gravando}>
        Cancelar
      </Botao>
      {previa ? (
        <Botao variante="perigo-cheio" onClick={() => void encerrar()} disabled={gravando}>
          {gravando ? 'Encerrando...' : rotuloEncerrar(aGerar)}
        </Botao>
      ) : null}
    </>
  )

  const grupos = previa ? agruparPorFilial(previa.imagens) : []
  const porColaborador = previa ? previaPorColaborador(previa, fechamento.tipoVinculo === 'filiais') : false

  return (
    <Dialogo aberto titulo={titulo} onFechar={cancelar} acoes={acoes} className="dialogo-encerrar">
      {carregando ? (
        <p role="status" className="dialogo-encerrar__carregando">
          {TEXTO_CALCULANDO}
        </p>
      ) : null}
      {erroPrevia ? <Aviso tipo="erro">{erroPrevia}</Aviso> : null}
      {previa && bloqueado ? <Aviso tipo="info">{TEXTO_TODAS_ENCERRADAS}</Aviso> : null}
      {previa && !bloqueado ? (
        <>
          <p className="dialogo-encerrar__total">
            Total de imagens a gerar: {aGerar} ({porColaborador ? 'uma por colaborador' : 'uma por filial'})
          </p>
          <ul aria-label="Imagens por filial" className="dialogo-encerrar__filiais">
            {grupos.map((grupo) => (
              <li key={grupo.codigo}>
                {rotuloFilial(grupo.codigo, grupo.nome)}: {textoImagens(grupo.imagens.length)}
              </li>
            ))}
          </ul>
          <p className="dialogo-encerrar__outros">{TEXTO_OUTROS_DASHBOARDS}</p>
          <AvisosFechamento resumo={previa.resumo} />
          {erroEncerrar ? <Aviso tipo="erro">{erroEncerrar}</Aviso> : null}
        </>
      ) : null}
    </Dialogo>
  )
}
