/**
 * Validação dos JSONs da integração pelo back-end (F5.18), usada pelo `DialogoConcluirConstrucao`.
 *
 * Validação híbrida "front primeiro, back depois": a modal mostra o resultado do motor local na hora e
 * este hook, `atrasoMs` depois da última mudança em qualquer dos dois textos (ou no mapeamento), chama
 * `validar` uma vez com os textos atuais não vazios (após `trim()`; o objeto leva só as chaves enviadas),
 * a `finalidade` informada (`valor`/`meta`, 11/11/2026) e o `mapeamento` (só junto com a saída). Com os
 * dois textos vazios não chama. Os valores com que o hook é montado (valores salvos, no modo
 * "configurar") não disparam chamada: só as mudanças.
 *
 * O resultado devolvido vale **por campo** enquanto o texto daquele campo for o que foi enviado (na
 * saída, também o mapeamento — saída por "chave: tipo", 11/11/2026); fora disso o campo fica `null` (a
 * modal usa o resultado local). Respostas mais antigas que a última aplicada (fora de ordem) são
 * ignoradas, assim como as que chegam depois da desmontagem. Falha da chamada é silenciosa (mantém o
 * local); a próxima mudança tenta de novo. Desmontar (fechar a modal) cancela a espera.
 *
 * Os resultados do back-end saem já no formato de exibição do motor local (`ResultadoSaidaExibido` e
 * `ResultadoEntrada`): tipos dos campos de saída como vieram, prévia com `JSON.stringify(previa, null, 2)`
 * e erros formatados por `formatarErroIntegracao`. Na saída inválida, os itens de `erros` viram a lista
 * `erros` (sem repetir a mensagem principal); na entrada válida, `avisos` sai de `avisosDaEntrada`. Na
 * saída válida, o `resumo` do back-end (quando vem) é o exibido; resposta válida sem `formato: "tipos"`
 * (formato antigo, lista) não prevalece — vale o local, pois a modal só salva no formato novo.
 */
import { useEffect, useRef, useState } from 'react'
import type {
  MapeamentoSaida,
  ParametrosValidacaoIntegracao,
  ResultadoValidacaoEntradaServidor,
  ResultadoValidacaoIntegracao,
  ResultadoValidacaoSaidaServidor,
} from '../../types/dominio'
import { avisosDaEntrada, type ResultadoEntrada } from '../../utils/integracao/entrada'
import { formatarErroIntegracao } from '../../utils/integracao/erros'

/** Chamada de validação no back-end (ex.: `validarIntegracao` do serviço). */
export type ValidarNoServidor = (parametros: ParametrosValidacaoIntegracao) => Promise<ResultadoValidacaoIntegracao>

/** Campo da saída exibido: o tipo é texto livre (o back-end pode devolver qualquer tipo). */
export interface CampoSaidaExibido {
  nome: string
  tipo: string
}

/**
 * Resultado da saída no formato de exibição. Compatível com o `ResultadoSaida` do motor local, mas com
 * o resumo e os tipos em texto livre (exibidos como vieram do back-end). `campos` alimenta as listas do
 * mapeamento.
 */
export type ResultadoSaidaExibido =
  | { estado: 'vazio' }
  | { estado: 'valido'; resumo: string; campos: readonly CampoSaidaExibido[] }
  | { estado: 'invalido'; mensagem: string; erros?: string[] }

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
  /** Campo de valor exigido na saída, enviado como `finalidade`; ausente não é enviado. */
  finalidade?: ParametrosValidacaoIntegracao['finalidade']
  /** Mapeamento da saída (vai só junto com a saída); ausente não é enviado. */
  mapeamento?: MapeamentoSaida
  /** Sem a função, o hook não chama nada e devolve sempre `null` nos dois campos. */
  validar: ValidarNoServidor | undefined
  /** Espera entre a última mudança e a chamada. */
  atrasoMs: number
}

/** Resposta aplicada, com os textos enviados (`null` no campo não enviado). */
interface RespostaAplicada {
  textoSaida: string | null
  textoEntrada: string | null
  /** Mapeamento atual no momento do envio (`JSON.stringify`; `''` sem mapeamento). */
  chaveMapeamento: string
  resultado: ResultadoValidacaoIntegracao
}

/** Formato da saída por "chave: tipo" na resposta do back-end. */
const FORMATO_TIPOS = 'tipos'

/** Resultado da saída do back-end para exibição; `null` quando não prevalece (válida sem `formato: "tipos"`). */
function resumoSaida(resultado: ResultadoValidacaoSaidaServidor): ResultadoSaidaExibido | null {
  if (!resultado.valido) {
    const { mensagem, linha, coluna } = resultado.erro
    const principal = formatarErroIntegracao({ campo: null, mensagem, linha, coluna, caminho: null, expressao: null })
    const erros = resultado.erros.map(formatarErroIntegracao).filter((texto) => texto !== principal)
    return { estado: 'invalido', mensagem: principal, erros }
  }
  if (resultado.formato !== FORMATO_TIPOS) return null
  if (resultado.resumo !== null) return { estado: 'valido', resumo: resultado.resumo, campos: resultado.campos }
  const quantidade = resultado.campos.length === 1 ? '1 campo' : `${resultado.campos.length} campos`
  const descricao = resultado.campos.map((campo) => `${campo.nome} (${campo.tipo})`).join(', ')
  return { estado: 'valido', resumo: descricao === '' ? quantidade : `${quantidade}: ${descricao}`, campos: resultado.campos }
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

export function useValidacaoServidor({
  saida,
  entrada,
  finalidade,
  mapeamento,
  validar,
  atrasoMs,
}: ParametrosHook): ResultadoValidacaoServidorAtual {
  const [resposta, setResposta] = useState<RespostaAplicada | null>(null)
  const montadoRef = useRef(false)
  /** Número da última chamada feita e da última resposta aplicada (descarta respostas fora de ordem). */
  const ultimaChamadaRef = useRef(0)
  const ultimaAplicadaRef = useRef(0)
  // O mapeamento entra nas dependências como texto: o objeto pode mudar de referência a cada renderização.
  const chaveMapeamento = mapeamento === undefined ? '' : JSON.stringify(mapeamento)
  /** Valores da montagem: só as mudanças em relação a eles disparam a validação. */
  const iniciaisRef = useRef<{ saida: string; entrada: string; chaveMapeamento: string } | null>({
    saida,
    entrada,
    chaveMapeamento,
  })

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
      if (iniciais.saida === saida && iniciais.entrada === entrada && iniciais.chaveMapeamento === chaveMapeamento) return
      iniciaisRef.current = null
    }
    const parametros: ParametrosValidacaoIntegracao = {}
    if (saida.trim() !== '') parametros.parametrosSaida = saida
    if (entrada.trim() !== '') parametros.parametrosEntrada = entrada
    if (parametros.parametrosSaida === undefined && parametros.parametrosEntrada === undefined) return
    if (finalidade !== undefined) parametros.finalidade = finalidade
    if (parametros.parametrosSaida !== undefined && chaveMapeamento !== '') {
      parametros.mapeamento = JSON.parse(chaveMapeamento) as MapeamentoSaida
    }

    const espera = setTimeout(() => {
      const chamada = ++ultimaChamadaRef.current
      validar(parametros).then(
        (resultado) => {
          if (!montadoRef.current || chamada < ultimaAplicadaRef.current) return
          ultimaAplicadaRef.current = chamada
          setResposta({
            textoSaida: parametros.parametrosSaida ?? null,
            textoEntrada: parametros.parametrosEntrada ?? null,
            chaveMapeamento,
            resultado,
          })
        },
        () => {
          // Falha silenciosa: a modal segue com o resultado local.
        },
      )
    }, atrasoMs)
    return () => clearTimeout(espera)
  }, [saida, entrada, finalidade, chaveMapeamento, validar, atrasoMs])

  if (resposta === null) return { saida: null, entrada: null }
  const { textoSaida, textoEntrada, resultado } = resposta
  const saidaEmVigor = textoSaida === saida && resposta.chaveMapeamento === chaveMapeamento
  return {
    saida: saidaEmVigor && resultado.saida !== null ? resumoSaida(resultado.saida) : null,
    entrada: textoEntrada === entrada && resultado.entrada !== null ? resumoEntrada(resultado.entrada) : null,
  }
}
