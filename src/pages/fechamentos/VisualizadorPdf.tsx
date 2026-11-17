/**
 * PDF de uma imagem embutido no diálogo (F10.10): visualizador do próprio navegador (`iframe` com a URL
 * de objeto do Blob), com o estado "Gerando PDF…" e, em erro, o alerta com "Tentar novamente" (desabilitado
 * durante a espera pelo limite de uso, `429`).
 */
import { EstadoCarga } from '../../components/EstadoCarga'
import { TEXTO_GERANDO_PDF, type UsePdfImagemResultado } from './usePdfImagem'
import './VisualizadorPdf.css'

export interface VisualizadorPdfProps {
  pdf: UsePdfImagemResultado
  /** Título acessível do PDF embutido (ver `tituloPdfImagem`). */
  titulo: string
}

export function VisualizadorPdf({ pdf, titulo }: VisualizadorPdfProps) {
  return (
    <div className="visualizador-pdf">
      <EstadoCarga
        carregando={pdf.carregando}
        mensagemCarregando={TEXTO_GERANDO_PDF}
        erro={pdf.erro}
        onTentarNovamente={pdf.tentarNovamente}
        tentarNovamenteDesabilitado={pdf.aguardandoLimite}
      />
      {pdf.url ? <iframe className="visualizador-pdf__quadro" title={titulo} src={pdf.url} /> : null}
    </div>
  )
}
