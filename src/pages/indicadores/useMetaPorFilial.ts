/**
 * Estado e validação da meta do indicador por filial (F6.10), usados pelo cadastro
 * (`FormularioIndicador`) e pela modal "Definir meta" (`DialogoDefinirMeta`).
 *
 * Contrato PROPOSTO ao back-end em `docs/propostas-backend/PROPOSTA-meta-por-filial.md` (seções 1 a 4):
 * - visão "Todas as filiais" (`filialSelecionada` ausente, `null` ou `'todas'`): "Replicar a meta para
 *   todas as filiais" marcado por padrão → um campo "Meta", obrigatório, enviado como `meta`;
 *   desmarcado → um campo por filial do acesso, não obrigatórios; as preenchidas vão em
 *   `metasPorFilial`, na ordem das filiais, e as em branco (ou só com espaços) ficam de fora
 *   (pendentes). Nenhuma preenchida → "Informe a meta de ao menos uma filial.";
 * - visão de uma filial: um campo obrigatório só para a filial do cabeçalho, enviado como
 *   `metasPorFilial` com um item.
 *
 * Os valores aceitam vírgula decimal (`lerDecimal`) e precisam ser maiores que zero.
 *
 * Erros 400 por filial da API (F6.10, contrato real em `docs/backend/FRONT-meta-por-filial.md`):
 * `opcoes.errosFiliais` (de `errosPorFilial`) vai para o campo da filial — na lista ou no campo único da
 * visão de uma filial — enquanto o erro local daquele campo não existir. Com "Replicar" marcado, erro
 * de filial sem campo na tela ou `filial: null`, nada aparece nos campos (fica só no alerta geral de
 * quem usa o hook). Editar o campo limpa só o erro daquela filial; uma nova lista (outra referência)
 * reaparece por inteiro.
 *
 * `opcoes.replicarInicial` (padrão `true`): `false` abre direto na lista de filiais — usado pela modal
 * "Definir metas pendentes" (F6.12), que não tem o checkbox "Replicar".
 */
import { useState } from 'react'
import type { ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import type { Filial, MetaDaFilial } from '../../types/dominio'
import { lerDecimal } from '../../utils/formato'

export const MENSAGEM_META_INVALIDA = 'Informe uma meta maior que zero.'
export const MENSAGEM_NENHUMA_FILIAL = 'Informe a meta de ao menos uma filial.'

/** Meta validada: única (replicada) ou por filial; nunca as duas. */
export type MetaValidada = { meta: number } | { metasPorFilial: MetaDaFilial[] }

export interface ErrosMetaPorFilial {
  /** Erro do campo único ("Meta" ou o campo da filial do cabeçalho). */
  meta?: string
  /** Erro do grupo "Metas por filial" (nenhuma filial preenchida). */
  grupo?: string
  /** Erro de cada campo da lista, pelo código da filial. */
  filiais: Readonly<Record<string, string>>
}

export interface UseMetaPorFilialResultado {
  /** Filial do cabeçalho; `null` na visão "Todas as filiais". */
  filialFixa: Filial | null
  /** Filiais da lista (visão "Todas as filiais", checkbox desmarcado), na ordem recebida. */
  filiais: Filial[]
  replicar: boolean
  alternarReplicar: (replicar: boolean) => void
  /** Texto do campo único ("Meta" ou o campo da filial do cabeçalho). */
  metaUnica: string
  alterarMetaUnica: (texto: string) => void
  /** Texto de cada campo da lista, pelo código da filial (ausente = em branco). */
  metasFiliais: Readonly<Record<string, string>>
  alterarMetaFilial: (codigo: string, texto: string) => void
  erros: ErrosMetaPorFilial
  /** Valida e mostra os erros; devolve a meta pronta para envio ou `null` se houver erro. */
  validar: () => MetaValidada | null
}

export interface OpcoesMetaPorFilial {
  /** Erros 400 por filial devolvidos pela API (F6.10). Padrão: nenhum. */
  errosFiliais?: readonly ErroDeFilial[]
  /** Estado inicial do checkbox "Replicar a meta para todas as filiais". Padrão `true`. */
  replicarInicial?: boolean
}

const SEM_ERROS: ErrosMetaPorFilial = { filiais: {} }
const SEM_ERROS_API: readonly ErroDeFilial[] = []

/**
 * "código - nome", o mesmo formato do seletor de filial do cabeçalho; sem nome (texto vazio), só o
 * código.
 */
export function rotuloFilial(filial: Filial): string {
  return filial.nome ? `${filial.codigo} - ${filial.nome}` : filial.codigo
}

/** Primeira mensagem da API de cada filial (erros com `filial: null` ficam de fora). */
function porFilial(erros: readonly ErroDeFilial[]): Record<string, string> {
  const resultado: Record<string, string> = {}
  for (const erro of erros) {
    if (erro.filial !== null && resultado[erro.filial] === undefined) resultado[erro.filial] = erro.mensagem
  }
  return resultado
}

/** Valor positivo lido em pt-BR; `null` quando vazio, inválido ou menor ou igual a zero. */
function lerMetaPositiva(texto: string): number | null {
  const valor = lerDecimal(texto)
  return valor === null || valor <= 0 ? null : valor
}

/**
 * Erros exibidos: os locais (validação) prevalecem; os da API entram só nos campos visíveis — o
 * campo único da visão de uma filial ou a lista (sem "Replicar").
 */
function combinarErros(
  locais: ErrosMetaPorFilial,
  api: Readonly<Record<string, string>>,
  filialFixa: Filial | null,
  replicar: boolean,
  filiais: Filial[],
): ErrosMetaPorFilial {
  if (filialFixa !== null) {
    const daApi = api[filialFixa.codigo]
    return daApi === undefined || locais.meta ? locais : { ...locais, meta: daApi }
  }
  if (replicar) return locais
  let combinados: Record<string, string> | null = null
  for (const filial of filiais) {
    const daApi = api[filial.codigo]
    if (daApi === undefined || locais.filiais[filial.codigo]) continue
    combinados ??= { ...locais.filiais }
    combinados[filial.codigo] = daApi
  }
  return combinados === null ? locais : { ...locais, filiais: combinados }
}

export function useMetaPorFilial(
  filialSelecionada: FilialSelecionada | undefined,
  filiais: Filial[],
  opcoes: OpcoesMetaPorFilial = {},
): UseMetaPorFilialResultado {
  const { errosFiliais = SEM_ERROS_API, replicarInicial = true } = opcoes
  const filialFixa = filialSelecionada && filialSelecionada !== 'todas' ? filialSelecionada : null
  const [replicar, setReplicar] = useState(replicarInicial)
  const [metaUnica, setMetaUnica] = useState('')
  const [metasFiliais, setMetasFiliais] = useState<Record<string, string>>({})
  const [errosLocais, setErros] = useState<ErrosMetaPorFilial>(SEM_ERROS)

  // Erros da API ainda visíveis, pela filial. Uma nova lista recebida substitui os que restavam.
  const [errosApiRecebidos, setErrosApiRecebidos] = useState(errosFiliais)
  const [errosApi, setErrosApi] = useState(() => porFilial(errosFiliais))
  if (errosApiRecebidos !== errosFiliais) {
    setErrosApiRecebidos(errosFiliais)
    setErrosApi(porFilial(errosFiliais))
  }

  function limparErroApi(codigo: string) {
    setErrosApi((atual) => {
      if (atual[codigo] === undefined) return atual
      const restantes = { ...atual }
      delete restantes[codigo]
      return restantes
    })
  }

  const erros = combinarErros(errosLocais, errosApi, filialFixa, replicar, filiais)

  function alternarReplicar(proximo: boolean) {
    setReplicar(proximo)
    setErros(SEM_ERROS)
  }

  function alterarMetaUnica(texto: string) {
    setMetaUnica(texto)
    if (filialFixa !== null) limparErroApi(filialFixa.codigo)
    setErros((atual) => (atual.meta ? { ...atual, meta: undefined } : atual))
  }

  function alterarMetaFilial(codigo: string, texto: string) {
    setMetasFiliais((atual) => ({ ...atual, [codigo]: texto }))
    limparErroApi(codigo)
    setErros((atual) => {
      if (!atual.grupo && !atual.filiais[codigo]) return atual
      const restantes = { ...atual.filiais }
      delete restantes[codigo]
      return { ...atual, grupo: texto.trim() === '' ? atual.grupo : undefined, filiais: restantes }
    })
  }

  function validar(): MetaValidada | null {
    if (filialFixa !== null || replicar) {
      const meta = lerMetaPositiva(metaUnica)
      if (meta === null) {
        setErros({ ...SEM_ERROS, meta: MENSAGEM_META_INVALIDA })
        return null
      }
      setErros(SEM_ERROS)
      return filialFixa === null ? { meta } : { metasPorFilial: [{ filial: filialFixa.codigo, meta }] }
    }

    const metasPorFilial: MetaDaFilial[] = []
    const errosFiliais: Record<string, string> = {}
    for (const filial of filiais) {
      const texto = metasFiliais[filial.codigo] ?? ''
      if (texto.trim() === '') continue
      const meta = lerMetaPositiva(texto)
      if (meta === null) errosFiliais[filial.codigo] = MENSAGEM_META_INVALIDA
      else metasPorFilial.push({ filial: filial.codigo, meta })
    }
    const temErroFilial = Object.keys(errosFiliais).length > 0
    const grupo = !temErroFilial && metasPorFilial.length === 0 ? MENSAGEM_NENHUMA_FILIAL : undefined
    setErros({ filiais: errosFiliais, grupo })
    return temErroFilial || grupo ? null : { metasPorFilial }
  }

  return {
    filialFixa,
    filiais,
    replicar,
    alternarReplicar,
    metaUnica,
    alterarMetaUnica,
    metasFiliais,
    alterarMetaFilial,
    erros,
    validar,
  }
}
