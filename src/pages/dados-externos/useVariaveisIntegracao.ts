/**
 * Variáveis da integração (F5.15) para o diálogo de concluir construção (F5.7).
 *
 * `carregar()` consulta a API (a cada abertura do diálogo) e `descartar()` volta ao estado inicial.
 * Respostas que chegam depois de um novo `carregar()`, de `descartar()` ou da desmontagem são
 * ignoradas. Em falha, `erro` traz `mensagemDeErro(falha)` e a lista fica vazia.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { listarVariaveisIntegracao } from '../../services/dadosExternosService'
import type { VariavelIntegracao } from '../../types/dominio'

interface EstadoVariaveis {
  variaveis: VariavelIntegracao[]
  carregando: boolean
  erro: string | null
}

const ESTADO_INICIAL: EstadoVariaveis = { variaveis: [], carregando: false, erro: null }

export function useVariaveisIntegracao() {
  const [estado, setEstado] = useState<EstadoVariaveis>(ESTADO_INICIAL)
  const consultaRef = useRef(0)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const carregar = useCallback(() => {
    const consulta = ++consultaRef.current
    const atual = () => montadoRef.current && consulta === consultaRef.current
    setEstado({ variaveis: [], carregando: true, erro: null })
    listarVariaveisIntegracao().then(
      (variaveis) => {
        if (atual()) setEstado({ variaveis, carregando: false, erro: null })
      },
      (falha: unknown) => {
        if (atual()) setEstado({ variaveis: [], carregando: false, erro: mensagemDeErro(falha) })
      },
    )
  }, [])

  const descartar = useCallback(() => {
    consultaRef.current += 1
    setEstado(ESTADO_INICIAL)
  }, [])

  return { ...estado, carregar, descartar }
}
