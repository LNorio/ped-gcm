/**
 * PDF de uma imagem gerado pelo back-end (F10.10 — RF-80, RF-83, RF-84), compartilhado pela
 * pré-visualização do fechamento e pelo diálogo da imagem congelada.
 *
 * Decisões:
 * - `chave` identifica o PDF pedido (ex.: `1|filial:101`); `null` não pede nada. Trocar a chave pede o
 *   novo PDF e libera a URL de objeto do anterior (`URL.revokeObjectURL`), também ao desmontar.
 * - Resposta atrasada (chave trocada, nova tentativa ou desmontagem) é descartada **sem criar URL**: o
 *   pedido é cancelado (`AbortController`) e a resposta que ainda chegar é ignorada.
 * - `carregar` é lido no momento do pedido (não precisa ser estável); o pedido só se repete quando a
 *   chave muda ou em `tentarNovamente`.
 * - `arquivo` é o PDF carregado (Blob e nome), reaproveitado pela exportação "PDF desta imagem".
 * - Limite de uso (`429`): `aguardandoLimite` fica `true` por `tentarNovamenteEm` segundos (60 s sem o
 *   valor), para desabilitar "Tentar novamente"; não há nova tentativa automática.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBloqueioLimite } from '../../hooks/useBloqueioLimite'
import { mensagemDeErro, type ArquivoBaixado } from '../../services/api'

export const TEXTO_GERANDO_PDF = 'Gerando PDF…'

/** "PDF da imagem — Filial {código} · {colaborador}"; sem colaborador, "PDF da imagem — Filial {código}". */
export function tituloPdfImagem(filial: string | null, colaborador?: string | null): string {
  const base = `PDF da imagem — Filial ${filial ?? '—'}`
  return colaborador ? `${base} · ${colaborador}` : base
}

export type CarregarPdf = (signal: AbortSignal) => Promise<ArquivoBaixado>

export interface UsePdfImagemResultado {
  /** URL de objeto do PDF exibido; `null` enquanto carrega, em erro ou sem chave. */
  url: string | null
  arquivo: ArquivoBaixado | null
  carregando: boolean
  erro: string | null
  /** `true` durante a espera pelo limite de uso (`429`): "Tentar novamente" fica desabilitado. */
  aguardandoLimite: boolean
  tentarNovamente: () => void
}

interface EstadoPdf {
  /** Chave e tentativa que produziram este estado; diferentes das atuais, o estado é descartado. */
  chave: string
  tentativa: number
  url: string | null
  arquivo: ArquivoBaixado | null
  erro: string | null
}

export function usePdfImagem(chave: string | null, carregar: CarregarPdf): UsePdfImagemResultado {
  const carregarRef = useRef(carregar)
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoPdf | null>(null)
  const { bloqueado: aguardandoLimite, registrarFalha } = useBloqueioLimite()

  useEffect(() => {
    carregarRef.current = carregar
  })

  useEffect(() => {
    if (chave === null) return
    const controle = new AbortController()
    let ativo = true
    let urlCriada: string | null = null
    carregarRef.current(controle.signal).then(
      (arquivo) => {
        if (!ativo) return
        urlCriada = URL.createObjectURL(arquivo.blob)
        setEstado({ chave, tentativa, url: urlCriada, arquivo, erro: null })
      },
      (falha: unknown) => {
        if (!ativo) return
        setEstado({ chave, tentativa, url: null, arquivo: null, erro: mensagemDeErro(falha) })
        registrarFalha(falha)
      },
    )
    return () => {
      ativo = false
      controle.abort()
      if (urlCriada !== null) URL.revokeObjectURL(urlCriada)
      // Descarta o estado deste pedido: ao voltar à mesma chave (A → B → A antes de B responder, ou
      // chave → null → chave), a URL já revogada e o erro antigo não podem reaparecer como "atuais".
      setEstado((anterior) =>
        anterior !== null && anterior.chave === chave && anterior.tentativa === tentativa ? null : anterior,
      )
    }
  }, [chave, tentativa, registrarFalha])

  const tentarNovamente = useCallback(() => setTentativa((valor) => valor + 1), [])

  const atual = chave !== null && estado !== null && estado.chave === chave && estado.tentativa === tentativa ? estado : null

  return {
    url: atual?.url ?? null,
    arquivo: atual?.arquivo ?? null,
    carregando: chave !== null && atual === null,
    erro: atual?.erro ?? null,
    aguardandoLimite,
    tentarNovamente,
  }
}
