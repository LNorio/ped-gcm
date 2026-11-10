/**
 * Validação dos JSONs da integração pelo back-end (F5.18), usada pelo `DialogoConcluirConstrucao`.
 *
 * Validação híbrida "front primeiro, back depois": a modal mostra o resultado do motor local na hora e
 * este hook, `atrasoMs` depois da última mudança em qualquer dos dois textos, chama `validar` uma vez
 * com os textos atuais não vazios (após `trim()`; o objeto leva só as chaves enviadas). Com os dois
 * vazios não chama. Os textos com que o hook é montado (valores salvos, no modo "configurar") não
 * disparam chamada: só as mudanças.
 *
 * O resultado devolvido vale **por campo** enquanto o texto daquele campo for o que foi enviado; fora
 * disso o campo fica `null` (a modal usa o resultado local). Respostas mais antigas que a última
 * aplicada (fora de ordem) são ignoradas, assim como as que chegam depois da desmontagem. Falha da
 * chamada é silenciosa (mantém o local); a próxima mudança tenta de novo. Desmontar (fechar a modal)
 * cancela a espera.
 *
 * Os resultados do back-end saem já no formato de exibição do motor local (`ResultadoSaidaExibido` e
 * `ResultadoEntrada`): tipos dos campos de saída como vieram, prévia com `JSON.stringify(previa, null, 2)`
 * e erros formatados por `formatarErroIntegracao`.
 */
import { useEffect, useRef, useState } from 'react'
import type {
  ParametrosValidacaoIntegracao,
  ResultadoValidacaoEntradaServidor,
  ResultadoValidacaoIntegracao,
  ResultadoValidacaoSaidaServidor,
} from '../../types/dominio'
import type { ResultadoEntrada } from '../../utils/integracao/entrada'
import { formatarErroIntegracao } from '../../utils/integracao/erros'

/** Chamada de validação no back-end (ex.: `validarIntegracao` do serviço). */
export type ValidarNoServidor = (parametros: ParametrosValidacaoIntegracao) => Promise<ResultadoValidacaoIntegracao>

/**
 * Resultado da saída no formato de exibição. Compatível com o `ResultadoSaida` do motor local, mas com
 * o resumo em texto livre: o motor local usa os mesmos nomes de tipo do back-end (`texto`, `numero`,
 * ...), mas o back-end pode devolver qualquer tipo, exibido como veio.
 */
export type ResultadoSaidaExibido =
  | { estado: 'vazio' }
  | { estado: 'valido'; resumo: string }
  | { estado: 'invalido'; mensagem: string }

/** Resultado do back-end em vigor para os textos atuais; `null` no campo sem resultado válido para o texto. */
export interface ResultadoValidacaoServidorAtual {
  saida: ResultadoSaidaExibido | null
  entrada: ResultadoEntrada | null
}

interface ParametrosHook {
  /** Texto atual do JSON de saída. */
  saida: string
  /** Texto atual do JSON de entrada. */
  entrada: string
  /** Sem a função, o hook não chama nada e devolve sempre `null` nos dois campos. */
  validar: ValidarNoServidor | undefined
  /** Espera entre a última mudança e a chamada. */
  atrasoMs: number
}

/** Resposta aplicada, com os textos enviados (`null` no campo não enviado). */
interface RespostaAplicada {
  textoSaida: string | null
  textoEntrada: string | null
  resultado: ResultadoValidacaoIntegracao
}

function resumoSaida(resultado: ResultadoValidacaoSaidaServidor): ResultadoSaidaExibido {
  if (!resultado.valido) {
    const { mensagem, linha, coluna } = resultado.erro
    return {
      estado: 'invalido',
      mensagem: formatarErroIntegracao({ campo: null, mensagem, linha, coluna, caminho: null, expressao: null }),
    }
  }
  const quantidade = resultado.campos.length === 1 ? '1 campo' : `${resultado.campos.length} campos`
  const descricao = resultado.campos.map((campo) => `${campo.nome} (${campo.tipo})`).join(', ')
  return { estado: 'valido', resumo: descricao === '' ? quantidade : `${quantidade}: ${descricao}` }
}

function resumoEntrada(resultado: ResultadoValidacaoEntradaServidor): ResultadoEntrada {
  if (!resultado.valido) return { estado: 'invalido', erros: resultado.erros.map(formatarErroIntegracao) }
  return {
    estado: 'valido',
    variaveisUsadas: resultado.variaveisUsadas,
    calculos: resultado.calculos,
    previa: JSON.stringify(resultado.previa, null, 2) ?? '',
  }
}

export function useValidacaoServidor({ saida, entrada, validar, atrasoMs }: ParametrosHook): ResultadoValidacaoServidorAtual {
  const [resposta, setResposta] = useState<RespostaAplicada | null>(null)
  const montadoRef = useRef(false)
  /** Número da última chamada feita e da última resposta aplicada (descarta respostas fora de ordem). */
  const ultimaChamadaRef = useRef(0)
  const ultimaAplicadaRef = useRef(0)
  /** Textos da montagem: só as mudanças em relação a eles disparam a validação. */
  const iniciaisRef = useRef<{ saida: string; entrada: string } | null>({ saida, entrada })

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  useEffect(() => {
    if (validar === undefined) return
    const iniciais = iniciaisRef.current
    if (iniciais !== null) {
      if (iniciais.saida === saida && iniciais.entrada === entrada) return
      iniciaisRef.current = null
    }
    const parametros: ParametrosValidacaoIntegracao = {}
    if (saida.trim() !== '') parametros.parametrosSaida = saida
    if (entrada.trim() !== '') parametros.parametrosEntrada = entrada
    if (parametros.parametrosSaida === undefined && parametros.parametrosEntrada === undefined) return

    const espera = setTimeout(() => {
      const chamada = ++ultimaChamadaRef.current
      validar(parametros).then(
        (resultado) => {
          if (!montadoRef.current || chamada < ultimaAplicadaRef.current) return
          ultimaAplicadaRef.current = chamada
          setResposta({
            textoSaida: parametros.parametrosSaida ?? null,
            textoEntrada: parametros.parametrosEntrada ?? null,
            resultado,
          })
        },
        () => {
          // Falha silenciosa: a modal segue com o resultado local.
        },
      )
    }, atrasoMs)
    return () => clearTimeout(espera)
  }, [saida, entrada, validar, atrasoMs])

  if (resposta === null) return { saida: null, entrada: null }
  const { textoSaida, textoEntrada, resultado } = resposta
  return {
    saida: textoSaida === saida && resultado.saida !== null ? resumoSaida(resultado.saida) : null,
    entrada: textoEntrada === entrada && resultado.entrada !== null ? resumoEntrada(resultado.entrada) : null,
  }
}
