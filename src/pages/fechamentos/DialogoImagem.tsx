/**
 * Diálogo de uma imagem da consulta retroativa (F10.6 — RF-84, RN-18).
 *
 * Consulta sozinho o detalhe (`obterImagem`) ao abrir e mostra a `VisualizacaoImagem` (F10.3).
 * O conteúdo é recriado a cada imagem (`key` pelo id): trocar a imagem consulta a nova e a resposta
 * da anterior é descartada. Somente leitura: só GET, sem ações de alterar ou excluir.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { mensagemDeErro } from '../../services/api'
import { obterImagem } from '../../services/imagensService'
import type { ImagemCongelada, ImagemDaConsulta } from '../../types/dominio'
import { VisualizacaoImagem } from './VisualizacaoImagem'
import './DialogoImagem.css'

export interface DialogoImagemProps {
  /** Linha da consulta cuja imagem é mostrada; `null` mantém o diálogo fechado (sem consultar). */
  imagem: ImagemDaConsulta | null
  onFechar: () => void
}

interface EstadoDetalhe {
  /** Tentativa que produziu este estado; diferente da atual, o estado é descartado. */
  tentativa: number
  imagem: ImagemCongelada | null
  erro: string | null
}

function ConteudoImagem({ id }: { id: number }) {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoDetalhe | null>(null)

  useEffect(() => {
    let descartada = false
    obterImagem(id).then(
      (imagem) => {
        if (!descartada) setEstado({ tentativa, imagem, erro: null })
      },
      (falha: unknown) => {
        if (!descartada) setEstado({ tentativa, imagem: null, erro: mensagemDeErro(falha) })
      },
    )
    return () => {
      descartada = true
    }
  }, [id, tentativa])

  const atual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = atual === null
  // Durante uma nova tentativa, o erro anterior continua visível (com o botão desabilitado).
  const erro = atual?.erro ?? (carregando ? (estado?.erro ?? null) : null)

  return (
    <div className="dialogo-imagem">
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando imagem..."
        erro={erro}
        onTentarNovamente={() => setTentativa((valor) => valor + 1)}
      />
      {atual?.imagem ? <VisualizacaoImagem imagem={atual.imagem} /> : null}
    </div>
  )
}

export function DialogoImagem({ imagem, onFechar }: DialogoImagemProps) {
  return (
    <Dialogo
      aberto={imagem !== null}
      titulo={imagem ? `Imagem congelada ${imagem.codigo}` : ''}
      onFechar={onFechar}
      className="dialogo--largo"
    >
      {imagem ? <ConteudoImagem key={imagem.id} id={imagem.id} /> : null}
    </Dialogo>
  )
}
