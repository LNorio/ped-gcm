/**
 * Mapeamento da saída da integração (F5.14 — 11/11/2026, opção B de
 * `docs/propostas-backend/FRONT-saida-chave-tipo.md`): qual campo da saída (`{ "campo": "tipo" }`) traz
 * a filial, o valor (dado externo) ou a meta (indicador) e, opcionalmente, a competência.
 *
 * Regras (alinhadas ao back-end): filial obrigatória (`string` ou `number`); valor/meta obrigatório
 * (`number`); competência opcional (`date` ou `string`); cada papel usa um campo diferente. Papéis
 * obrigatórios não informados vão em `faltando` (sem mensagem); os informados com problema ganham uma
 * mensagem em `erros`, na prioridade inexistente → tipo → repetido.
 */

import type { MapeamentoSaida } from '../../types/dominio'
import type { CampoValorSaida, TipoCampoSaida } from './saida'

export type PapelMapeamento = 'filial' | 'valor' | 'meta' | 'competencia'

export interface ResultadoMapeamento {
  valido: boolean
  /** Papéis obrigatórios não informados, na ordem filial → valor/meta. */
  faltando: PapelMapeamento[]
  /** Mensagem de cada papel informado com problema. */
  erros: Partial<Record<PapelMapeamento, string>>
}

/** Nome do papel nas mensagens ("O campo da filial ..."). */
export const ROTULO_PAPEL: Readonly<Record<PapelMapeamento, string>> = {
  filial: 'da filial',
  valor: 'do valor',
  meta: 'da meta',
  competencia: 'da competência',
}

const TIPOS_ACEITOS: Readonly<Record<PapelMapeamento, readonly TipoCampoSaida[]>> = {
  filial: ['string', 'number'],
  valor: ['number'],
  meta: ['number'],
  competencia: ['date', 'string'],
}

function descreverTipos(tipos: readonly TipoCampoSaida[]): string {
  return tipos.join(' ou ')
}

/** Campo escolhido para o papel (`''` quando não informado). */
export function campoDoPapel(mapeamento: MapeamentoSaida, papel: PapelMapeamento): string {
  const valor =
    papel === 'filial'
      ? mapeamento.campoFilial
      : papel === 'valor'
        ? mapeamento.campoValor
        : papel === 'meta'
          ? mapeamento.campoMeta
          : mapeamento.campoCompetencia
  return (valor ?? '').trim()
}

/** Campo da saída validada (o `CampoSaida` do motor local ou o do back-end, com o tipo em texto). */
export interface CampoMapeavel {
  nome: string
  tipo: string
}

/** Valida o mapeamento contra os campos da saída válida. Não altera os argumentos. */
export function validarMapeamento(
  campos: readonly CampoMapeavel[],
  mapeamento: MapeamentoSaida,
  campoValor: CampoValorSaida,
): ResultadoMapeamento {
  const papeis: PapelMapeamento[] = ['filial', campoValor, 'competencia']
  const textoRepetido = `Cada papel (filial, ${campoValor}, competência) precisa de um campo diferente da saída`
  const faltando: PapelMapeamento[] = []
  const erros: Partial<Record<PapelMapeamento, string>> = {}
  const usados: string[] = []

  for (const papel of papeis) {
    const nome = campoDoPapel(mapeamento, papel)
    if (nome === '') {
      if (papel !== 'competencia') faltando.push(papel)
      continue
    }
    const campo = campos.find((item) => item.nome === nome)
    const rotulo = ROTULO_PAPEL[papel]
    if (campo === undefined) {
      erros[papel] = `O campo ${rotulo} aponta para "${nome}", que não existe na saída`
    } else if (!(TIPOS_ACEITOS[papel] as readonly string[]).includes(campo.tipo)) {
      erros[papel] = `O campo ${rotulo} ("${nome}") é do tipo ${campo.tipo}; precisa ser ${descreverTipos(TIPOS_ACEITOS[papel])}`
    } else if (usados.includes(nome)) {
      erros[papel] = textoRepetido
    }
    usados.push(nome)
  }

  return { valido: faltando.length === 0 && Object.keys(erros).length === 0, faltando, erros }
}
