/**
 * Diálogo de uma imagem da consulta retroativa (F10.6 — RF-84, RN-18; F10.10).
 *
 * Mostra a imagem congelada em PDF gerado pelo back-end (`obterPdfImagem`), embutido no diálogo
 * (`VisualizadorPdf`), e o botão "Exportar": "PDF desta imagem" (reserva `{código}.pdf`) e "Todas as
 * imagens (ZIP)" com os filtros da consulta (`filtros`). O conteúdo é recriado a cada imagem (`key` pelo
 * id): trocar a imagem pede o novo PDF, libera a URL anterior e descarta a resposta atrasada.
 * Somente leitura: só GET, sem ações de alterar ou excluir.
 */
import { Dialogo } from '../../components/Dialogo'
import { obterPdfImagem, obterZipImagens, type FiltrosImagens } from '../../services/imagensService'
import type { ImagemDaConsulta } from '../../types/dominio'
import { AvisoQuantidadeImagens } from './AvisoQuantidadeImagens'
import { ExportarImagens } from './ExportarImagens'
import { tituloPdfImagem, usePdfImagem } from './usePdfImagem'
import { VisualizadorPdf } from './VisualizadorPdf'
import './DialogoImagem.css'

export interface DialogoImagemProps {
  /** Linha da consulta cuja imagem é mostrada; `null` mantém o diálogo fechado (sem consultar). */
  imagem: ImagemDaConsulta | null
  onFechar: () => void
  /** Filtros aplicados na consulta, usados no ZIP "Todas as imagens"; sem eles, o ZIP vai sem filtros. */
  filtros?: FiltrosImagens
  /** Imagens da consulta filtrada (o que o ZIP exporta), para o aviso da quantidade; sem ela, sem aviso. */
  quantidade?: number
}

interface ConteudoImagemProps {
  imagem: ImagemDaConsulta
  filtros?: FiltrosImagens
  quantidade?: number
}

function ConteudoImagem({ imagem, filtros, quantidade }: ConteudoImagemProps) {
  const nomeReserva = `${imagem.codigo}.pdf`
  const pdf = usePdfImagem(String(imagem.id), (signal) => obterPdfImagem(imagem.id, { nomeReserva, signal }))

  return (
    <div className="dialogo-imagem">
      {quantidade !== undefined ? <AvisoQuantidadeImagens quantidade={quantidade} /> : null}
      <ExportarImagens
        obterPdf={(signal) => (pdf.arquivo ? Promise.resolve(pdf.arquivo) : obterPdfImagem(imagem.id, { nomeReserva, signal }))}
        obterZip={(signal) => obterZipImagens(filtros ?? {}, { signal })}
        quantidade={quantidade}
        dicaFalhaZip="Use os filtros da consulta para reduzir a quantidade de imagens."
      />
      <VisualizadorPdf pdf={pdf} titulo={tituloPdfImagem(imagem.filial, imagem.colaborador)} />
    </div>
  )
}

export function DialogoImagem({ imagem, onFechar, filtros, quantidade }: DialogoImagemProps) {
  return (
    <Dialogo
      aberto={imagem !== null}
      titulo={imagem ? `Imagem congelada ${imagem.codigo}` : ''}
      onFechar={onFechar}
      className="dialogo--largo"
    >
      {imagem ? <ConteudoImagem key={imagem.id} imagem={imagem} filtros={filtros} quantidade={quantidade} /> : null}
    </Dialogo>
  )
}
