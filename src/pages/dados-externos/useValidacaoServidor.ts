/**
 * Validação do JSON de entrada da integração pelo back-end (F5.18), usada pelo `DialogoConcluirConstrucao`.
 *
 * Validação híbrida "front primeiro, back depois": a modal mostra o resultado do motor local na hora e
 * este hook, `atrasoMs` depois da última mudança na entrada, chama `validar` uma vez com o texto atual da
 * entrada (não vazio após `trim()`) e a `finalidade` informada (`valor`/`meta`). Com a entrada vazia não
 * chama. O valor com que o hook é montado (valor salvo, no modo "configurar") não dispara chamada: só as
 * mudanças.
 *
 * Desde 11/11/2026 (saída sem mapeamento — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`)
 * a saída é validada **só no front** (`validarSaida`): ela nunca vai ao servidor, mudar a saída não chama o
 * back-end e um resultado de saída devolvido por um back-end antigo é ignorado.
 *
 * O resultado devolvido vale enquanto o texto da entrada for o que foi enviado; fora disso fica `null` (a
 * modal usa o resultado local). Respostas mais antigas que a última aplicada (fora de ordem) são
 * ignoradas, assim como as que chegam depois da desmontagem. Falha da chamada é silenciosa (mantém o
 * local); a próxima mudança tenta de novo. Desmontar (fechar a modal) cancela a espera.
 *
 * O resultado do back-end sai já no formato de exibição do motor local (`ResultadoEntrada`): prévia com
 * `JSON.stringify(previa, null, 2)`, erros formatados por `formatarErroIntegracao` e `avisos` de
 * `avisosDaEntrada`.
 */
import { useEffect, useRef, useState } from 'react'
import type {
  ParametrosValidacaoIntegracao,
  ResultadoValidacaoEntradaServidor,
  ResultadoValidacaoIntegracao,
} from '../../types/dominio'
import { avisosDaEntrada, type ResultadoEntrada } from '../../utils/integracao/entrada'
import { formatarErroIntegracao } from '../../utils/integracao/erros'

/** Chamada de validação no back-end (ex.: `validarIntegracao` do serviço). */
export type ValidarNoServidor = (parametros: ParametrosValidacaoIntegracao) => Promise<ResultadoValidacaoIntegracao>

interface ParametrosHook {
  /** Texto atual do JSON de entrada. */
  entrada: string
  /** Campo de valor da integração, enviado como `finalidade`; ausente não é enviado. */
  finalidade?: ParametrosValidacaoIntegracao['finalidade']
  /** Sem a função, o hook não chama nada e devolve sempre `null`. */
  validar: ValidarNoServidor | undefined
  /** Espera entre a última mudança e a chamada. */
  atrasoMs: number
}

/** Resposta aplicada, com o texto da entrada enviado. */
interface RespostaAplicada {
  textoEntrada: string
  resultado: ResultadoValidacaoIntegracao
}

function resumoEntrada(resultado: ResultadoValidacaoEntradaServidor): ResultadoEntrada {
  if (!resultado.valido) return { estado: 'invalido', erros: resultado.erros.map(formatarErroIntegracao) }
  return {
    estado: 'valido',
    variaveisUsadas: resultado.variaveisUsadas,
    calculos: resultado.calculos,
    previa: JSON.stringify(resultado.previa, null, 2) ?? '',
    avisos: avisosDaEntrada(resultado.variaveisUsadas),
  }
}

/** Resultado do back-end em vigor para a entrada atual; `null` sem resultado válido para o texto atual. */
export function useValidacaoServidor({ entrada, finalidade, validar, atrasoMs }: ParametrosHook): ResultadoEntrada | null {
  const [resposta, setResposta] = useState<RespostaAplicada | null>(null)
  const montadoRef = useRef(false)
  /** Número da última chamada feita e da última resposta aplicada (descarta respostas fora de ordem). */
  const ultimaChamadaRef = useRef(0)
  const ultimaAplicadaRef = useRef(0)
  /** Entrada da montagem: só as mudanças em relação a ela disparam a validação. */
  const entradaInicialRef = useRef<string | null>(entrada)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  useEffect(() => {
    if (validar === undefined) return
    if (entradaInicialRef.current !== null) {
      if (entradaInicialRef.current === entrada) return
      entradaInicialRef.current = null
    }
    if (entrada.trim() === '') return
    const parametros: ParametrosValidacaoIntegracao = { parametrosEntrada: entrada }
    if (finalidade !== undefined) parametros.finalidade = finalidade

    const espera = setTimeout(() => {
      const chamada = ++ultimaChamadaRef.current
      validar(parametros).then(
        (resultado) => {
          if (!montadoRef.current || chamada < ultimaAplicadaRef.current) return
          ultimaAplicadaRef.current = chamada
          setResposta({ textoEntrada: entrada, resultado })
        },
        () => {
          // Falha silenciosa: a modal segue com o resultado local.
        },
      )
    }, atrasoMs)
    return () => clearTimeout(espera)
  }, [entrada, finalidade, validar, atrasoMs])

  if (resposta === null || resposta.textoEntrada !== entrada || !resposta.resultado.entrada) return null
  return resumoEntrada(resposta.resultado.entrada)
}
