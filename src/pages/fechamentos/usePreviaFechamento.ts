import { useEffect, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { obterPreviaFechamento } from '../../services/fechamentosService'
import type { PreviaFechamento } from '../../types/dominio'

export interface EstadoPreviaFechamento {
  previa: PreviaFechamento | null
  carregando: boolean
  erro: string | null
}

/**
 * Prévia do encerramento de um dashboard (F10.4, F10.5). Com `previaInicial`, usa a prévia recebida e
 * não consulta a API; sem ela, faz um único `GET .../previa` ao montar (nada é gravado).
 */
export function usePreviaFechamento(id: number, previaInicial?: PreviaFechamento | null): EstadoPreviaFechamento {
  const [estado, setEstado] = useState<EstadoPreviaFechamento>(() =>
    previaInicial
      ? { previa: previaInicial, carregando: false, erro: null }
      : { previa: null, carregando: true, erro: null },
  )
  const temPreviaInicial = Boolean(previaInicial)

  useEffect(() => {
    if (temPreviaInicial) return
    let ativo = true
    obterPreviaFechamento(id).then(
      (previa) => {
        if (ativo) setEstado({ previa, carregando: false, erro: null })
      },
      (erro: unknown) => {
        if (ativo) setEstado({ previa: null, carregando: false, erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      ativo = false
    }
  }, [id, temPreviaInicial])

  return estado
}
