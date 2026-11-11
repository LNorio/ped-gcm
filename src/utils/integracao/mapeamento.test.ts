import { describe, expect, it } from 'vitest'
import type { MapeamentoSaida } from '../../types/dominio'
import { validarMapeamento } from './mapeamento'
import type { CampoSaida } from './saida'

/**
 * F5.14 — Mapeamento da saída (11/11/2026, opção B de `docs/propostas-backend/FRONT-saida-chave-tipo.md`).
 *
 * Com a saída em "chave: tipo", quem diz qual campo é a filial e qual é o valor (dado externo) ou a meta
 * (indicador) é o mapeamento: `MapeamentoSaida { campoFilial, campoValor?, campoMeta?, campoCompetencia? }`.
 *
 * `validarMapeamento(campos, mapeamento, campoValor)` — `campos` é o resultado de `validarSaida` (saída
 * válida), `campoValor` (`'valor'` | `'meta'`) diz qual chave do mapeamento vale (`campoValor` ou
 * `campoMeta`); a outra é ignorada. Devolve `{ valido, faltando, erros }`:
 * - `faltando`: papéis obrigatórios não informados (vazio, só espaços ou ausente), na ordem
 *   `filial` → `valor`/`meta`. Não geram mensagem (a modal os lista no "falta: ...");
 * - `erros`: mensagem de cada papel **informado** com problema — o campo não existe na saída; o tipo não
 *   combina (filial: `string` ou `number`; valor/meta: `number`; competência: `date` ou `string`); ou o
 *   campo já foi usado por um papel anterior (ordem filial → valor/meta → competência; o erro fica no
 *   papel que repete). Um erro por papel, nessa prioridade: inexistente → tipo → repetido;
 * - `valido`: sem faltas e sem erros. A competência é opcional (`null`, `''` ou ausente).
 */
const CAMPOS: CampoSaida[] = [
  { nome: 'codemp', tipo: 'string' },
  { nome: 'codfil', tipo: 'string' },
  { nome: 'numfil', tipo: 'number' },
  { nome: 'vlrLiq', tipo: 'number' },
  { nome: 'metVlr', tipo: 'number' },
  { nome: 'data', tipo: 'date' },
  { nome: 'compet', tipo: 'string' },
  { nome: 'ativo', tipo: 'boolean' },
]

const REPETIDO_VALOR = 'Cada papel (filial, valor, competência) precisa de um campo diferente da saída'
const REPETIDO_META = 'Cada papel (filial, meta, competência) precisa de um campo diferente da saída'

function dadoExterno(m: Partial<MapeamentoSaida> = {}): MapeamentoSaida {
  return { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null, ...m }
}

function indicador(m: Partial<MapeamentoSaida> = {}): MapeamentoSaida {
  return { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null, ...m }
}

describe('F5.14 — validarMapeamento (campo da filial, do valor/meta e da competência)', () => {
  describe('válido', () => {
    it('dado externo: filial string e valor number, sem competência', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno(), 'valor')).toEqual({ valido: true, faltando: [], erros: {} })
    })

    it('indicador: filial string e meta number', () => {
      expect(validarMapeamento(CAMPOS, indicador(), 'meta')).toEqual({ valido: true, faltando: [], erros: {} })
    })

    it('filial do tipo number também é aceita', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: 'numfil' }), 'valor')).toMatchObject({ valido: true })
    })

    it.each([
      ['date', 'data'],
      ['string', 'compet'],
    ])('competência do tipo %s é aceita', (_tipo, campo) => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoCompetencia: campo }), 'valor')).toEqual({ valido: true, faltando: [], erros: {} })
    })

    it.each([
      ['null', null],
      ['texto vazio', ''],
      ['ausente', undefined],
    ])('competência %s → opcional, sem falta nem erro', (_nome, valor) => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoCompetencia: valor }), 'valor')).toEqual({ valido: true, faltando: [], erros: {} })
    })

    it('no dado externo, campoMeta é ignorado (e no indicador, campoValor)', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoMeta: 'inexistente' }), 'valor')).toMatchObject({ valido: true })
      expect(validarMapeamento(CAMPOS, indicador({ campoValor: 'codemp' }), 'meta')).toMatchObject({ valido: true })
    })
  })

  describe('faltando (obrigatórios não informados)', () => {
    it('filial vazia → faltando ["filial"], sem mensagem', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: '' }), 'valor')).toEqual({ valido: false, faltando: ['filial'], erros: {} })
    })

    it('valor ausente no dado externo → faltando ["valor"]', () => {
      expect(validarMapeamento(CAMPOS, { campoFilial: 'codfil', campoCompetencia: null }, 'valor')).toEqual({
        valido: false,
        faltando: ['valor'],
        erros: {},
      })
    })

    it('meta só com espaços no indicador → faltando ["meta"]', () => {
      expect(validarMapeamento(CAMPOS, indicador({ campoMeta: '  ' }), 'meta')).toEqual({ valido: false, faltando: ['meta'], erros: {} })
    })

    it('nenhum informado → faltando ["filial", "valor"] (ou "meta"), nessa ordem', () => {
      expect(validarMapeamento(CAMPOS, { campoFilial: '', campoValor: '', campoCompetencia: null }, 'valor').faltando).toEqual(['filial', 'valor'])
      expect(validarMapeamento(CAMPOS, { campoFilial: '', campoMeta: '', campoCompetencia: null }, 'meta').faltando).toEqual(['filial', 'meta'])
    })

    it('no indicador, campoValor preenchido não supre a meta', () => {
      expect(validarMapeamento(CAMPOS, { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null }, 'meta')).toEqual({
        valido: false,
        faltando: ['meta'],
        erros: {},
      })
    })
  })

  describe('erros dos papéis informados', () => {
    it('campo que não existe na saída → "O campo da filial aponta para "x", que não existe na saída"', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: 'filial' }), 'valor')).toEqual({
        valido: false,
        faltando: [],
        erros: { filial: 'O campo da filial aponta para "filial", que não existe na saída' },
      })
    })

    it('inexistente no valor, na meta e na competência', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoValor: 'valor', campoCompetencia: 'mes' }), 'valor').erros).toEqual({
        valor: 'O campo do valor aponta para "valor", que não existe na saída',
        competencia: 'O campo da competência aponta para "mes", que não existe na saída',
      })
      expect(validarMapeamento(CAMPOS, indicador({ campoMeta: 'meta' }), 'meta').erros).toEqual({
        meta: 'O campo da meta aponta para "meta", que não existe na saída',
      })
    })

    it('a comparação do nome é exata (maiúsculas importam)', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoValor: 'vlrliq' }), 'valor').erros).toEqual({
        valor: 'O campo do valor aponta para "vlrliq", que não existe na saída',
      })
    })

    it('filial do tipo boolean ou date → "O campo da filial ("x") é do tipo ...; precisa ser string ou number"', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: 'ativo' }), 'valor').erros).toEqual({
        filial: 'O campo da filial ("ativo") é do tipo boolean; precisa ser string ou number',
      })
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: 'data' }), 'valor').erros).toEqual({
        filial: 'O campo da filial ("data") é do tipo date; precisa ser string ou number',
      })
    })

    it('valor que não é number → "O campo do valor ("codemp") é do tipo string; precisa ser number"', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoValor: 'codemp' }), 'valor')).toEqual({
        valido: false,
        faltando: [],
        erros: { valor: 'O campo do valor ("codemp") é do tipo string; precisa ser number' },
      })
    })

    it('meta que não é number → "O campo da meta ("data") é do tipo date; precisa ser number"', () => {
      expect(validarMapeamento(CAMPOS, indicador({ campoMeta: 'data' }), 'meta').erros).toEqual({
        meta: 'O campo da meta ("data") é do tipo date; precisa ser number',
      })
    })

    it('competência number ou boolean → "O campo da competência ("x") é do tipo ...; precisa ser date ou string"', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoCompetencia: 'metVlr' }), 'valor').erros).toEqual({
        competencia: 'O campo da competência ("metVlr") é do tipo number; precisa ser date ou string',
      })
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoCompetencia: 'ativo' }), 'valor').erros).toEqual({
        competencia: 'O campo da competência ("ativo") é do tipo boolean; precisa ser date ou string',
      })
    })

    it('o mesmo campo em dois papéis → erro no papel que repete (filial e valor numfil)', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: 'numfil', campoValor: 'numfil' }), 'valor')).toEqual({
        valido: false,
        faltando: [],
        erros: { valor: REPETIDO_VALOR },
      })
    })

    it('competência repetindo a filial → erro na competência; no indicador o texto cita "meta"', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoCompetencia: 'codfil' }), 'valor').erros).toEqual({ competencia: REPETIDO_VALOR })
      expect(validarMapeamento(CAMPOS, indicador({ campoCompetencia: 'codfil' }), 'meta').erros).toEqual({ competencia: REPETIDO_META })
    })

    it('prioridade: o tipo errado é informado antes da repetição (valor = campo string da filial)', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoValor: 'codfil' }), 'valor').erros).toEqual({
        valor: 'O campo do valor ("codfil") é do tipo string; precisa ser number',
      })
    })

    it('faltas e erros juntos: filial vazia e valor inexistente', () => {
      expect(validarMapeamento(CAMPOS, dadoExterno({ campoFilial: '', campoValor: 'xyz' }), 'valor')).toEqual({
        valido: false,
        faltando: ['filial'],
        erros: { valor: 'O campo do valor aponta para "xyz", que não existe na saída' },
      })
    })

    it('saída sem campos (lista vazia) → todo papel informado aponta para campo inexistente', () => {
      expect(validarMapeamento([], dadoExterno(), 'valor').erros).toEqual({
        filial: 'O campo da filial aponta para "codfil", que não existe na saída',
        valor: 'O campo do valor aponta para "vlrLiq", que não existe na saída',
      })
    })
  })

  it('não altera os campos nem o mapeamento recebidos', () => {
    const campos = CAMPOS.map((campo) => ({ ...campo }))
    const mapeamento = dadoExterno({ campoCompetencia: 'data' })
    const copia = { ...mapeamento }

    validarMapeamento(campos, mapeamento, 'valor')

    expect(campos).toEqual(CAMPOS)
    expect(mapeamento).toEqual(copia)
  })
})
