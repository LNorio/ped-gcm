/**
 * Botão "Exportar" das imagens (F10.10 — RF-80, RF-84): menu com "PDF desta imagem" e "Todas as imagens
 * (ZIP)". O arquivo vem do back-end (as funções recebidas) e é baixado por `baixarArquivo`.
 *
 * - Durante a exportação o gatilho do `MenuAcoes` fica desabilitado (`desabilitado`); o nome acessível
 *   continua "Exportar". Ao terminar, o foco volta ao gatilho se ele o tinha.
 * - Erro: alerta com a mensagem do back-end, sem download; a próxima exportação limpa o alerta.
 * - Limite de uso (`429`): além do alerta, o gatilho fica desabilitado por `tentarNovamenteEm` segundos
 *   (60 s sem o valor), para os dois itens; outros erros não bloqueiam.
 * - Ao desmontar, a exportação em andamento é cancelada e nada é baixado.
 * - Enquanto o ZIP é montado, mostra o status "Montando o ZIP com {N} imagens…" (`quantidade`); o ZIP
 *   não tem limite de imagens e pode demorar.
 * - ZIP com falha de rede ou tempo limite (0, 502, 503, 504): o alerta acrescenta `TEXTO_ZIP_TEMPO` e a
 *   `dicaFalhaZip` (o servidor corta a resposta em ~60 s, cerca de 500 PDFs).
 */
import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { useBloqueioLimite } from '../../hooks/useBloqueioLimite'
import { MenuAcoes } from '../../components/MenuAcoes'
import { ApiError, mensagemDeErro, type ArquivoBaixado } from '../../services/api'
import { baixarArquivo } from '../../utils/baixarArquivo'
import './ExportarImagens.css'

export const ROTULO_EXPORTAR = 'Exportar'
export const ITEM_PDF_DESTA_IMAGEM = 'PDF desta imagem'
export const ITEM_ZIP_TODAS = 'Todas as imagens (ZIP)'
export const TEXTO_ZIP_TEMPO = 'A montagem do ZIP pode ter excedido o tempo limite do servidor.'

/** Status que indicam falha por tempo/rede na montagem do ZIP (sem resposta ou gateway). */
const STATUS_TEMPO_ZIP = new Set([0, 502, 503, 504])

export type ObterArquivo = (signal: AbortSignal) => Promise<ArquivoBaixado>

export interface ExportarImagensProps {
  /** PDF da imagem exibida. */
  obterPdf: ObterArquivo
  /** ZIP com um PDF por imagem. */
  obterZip: ObterArquivo
  /** Quantidade de imagens do ZIP, mostrada no status "Montando o ZIP com {N} imagens…". */
  quantidade?: number
  /** Dica acrescentada ao alerta quando o ZIP falha por rede ou tempo limite (status 0, 502, 503, 504). */
  dicaFalhaZip?: string
}

/** Status enquanto o ZIP é montado. */
function textoMontandoZip(quantidade?: number): string {
  if (quantidade === undefined) return 'Montando o ZIP…'
  return quantidade === 1
    ? 'Montando o ZIP com 1 imagem…'
    : `Montando o ZIP com ${quantidade.toLocaleString('pt-BR')} imagens…`
}

export function ExportarImagens({ obterPdf, obterZip, quantidade, dicaFalhaZip }: ExportarImagensProps) {
  const [exportando, setExportando] = useState(false)
  const [montandoZip, setMontandoZip] = useState(false)
  const [erro, setErro] = useState<string[] | null>(null)
  const controleRef = useRef<AbortController | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const devolverFocoRef = useRef(false)
  const { bloqueado, registrarFalha } = useBloqueioLimite()
  const desabilitado = exportando || bloqueado

  useEffect(() => () => controleRef.current?.abort(), [])

  // Ao reabilitar o gatilho, devolve o foco se ele o tinha ao iniciar a exportação (o botão
  // desabilitado perde o foco para o <body>).
  useEffect(() => {
    if (desabilitado || !devolverFocoRef.current) return
    devolverFocoRef.current = false
    const ativo = document.activeElement
    if (ativo !== null && ativo !== document.body) return
    wrapperRef.current?.querySelector<HTMLButtonElement>('.menu-acoes__gatilho')?.focus()
  }, [desabilitado])

  function exportar(obter: ObterArquivo, zip: boolean) {
    if (controleRef.current !== null || bloqueado) return
    const controle = new AbortController()
    controleRef.current = controle
    const ativo = document.activeElement
    devolverFocoRef.current = ativo !== null && (wrapperRef.current?.contains(ativo) ?? false)
    setErro(null)
    setExportando(true)
    setMontandoZip(zip)
    obter(controle.signal)
      .then(
        (arquivo) => {
          if (!controle.signal.aborted) baixarArquivo(arquivo)
        },
        (falha: unknown) => {
          if (controle.signal.aborted) return
          const porTempo = zip && falha instanceof ApiError && STATUS_TEMPO_ZIP.has(falha.status)
          const partes = [mensagemDeErro(falha)]
          if (porTempo) {
            partes.push(TEXTO_ZIP_TEMPO)
            if (dicaFalhaZip) partes.push(dicaFalhaZip)
          }
          setErro(partes)
          registrarFalha(falha)
        },
      )
      .finally(() => {
        if (controle.signal.aborted) return
        controleRef.current = null
        setExportando(false)
        setMontandoZip(false)
      })
  }

  return (
    <div className="exportar-imagens" ref={wrapperRef} aria-busy={exportando}>
      <MenuAcoes
        rotulo={ROTULO_EXPORTAR}
        rotuloVisivel={ROTULO_EXPORTAR}
        desabilitado={desabilitado}
        itens={[
          { rotulo: ITEM_PDF_DESTA_IMAGEM, onSelecionar: () => exportar(obterPdf, false) },
          { rotulo: ITEM_ZIP_TODAS, onSelecionar: () => exportar(obterZip, true) },
        ]}
      />
      {montandoZip ? (
        <p role="status" className="exportar-imagens__status">
          {textoMontandoZip(quantidade)}
        </p>
      ) : null}
      {erro ? (
        <Aviso tipo="erro">
          {erro.length === 1
            ? erro[0]
            : erro.map((parte) => <p key={parte}>{parte}</p>)}
        </Aviso>
      ) : null}
    </div>
  )
}
