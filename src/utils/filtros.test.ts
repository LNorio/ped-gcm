import { describe, expect, it } from 'vitest'
import { contarPor, filtrarPorBusca } from './filtros'

interface Item {
  id: number
  nome: string
  origem: 'Fixo' | 'Personalizado'
  descricao?: string
}

const ITENS: Item[] = [
  { id: 1, nome: 'Comercial', origem: 'Fixo' },
  { id: 4, nome: 'Tecnologia da Informação', origem: 'Fixo', descricao: 'Infraestrutura e sistemas' },
  { id: 5, nome: 'Fiscal', origem: 'Fixo' },
  { id: 8, nome: 'Logística', origem: 'Personalizado', descricao: 'Entregas' },
  { id: 9, nome: 'Marketing', origem: 'Personalizado' },
]

describe('F1.12 — Utilitários de filtro (filtros.ts)', () => {
  describe('filtrarPorBusca(itens, termo, obterTexto)', () => {
    it('termo vazio devolve todos os itens, na mesma ordem', () => {
      expect(filtrarPorBusca(ITENS, '', (item) => item.nome)).toEqual(ITENS)
    })

    it('termo só com espaços equivale a termo vazio', () => {
      expect(filtrarPorBusca(ITENS, '   ', (item) => item.nome)).toEqual(ITENS)
    })

    it('casa por trecho do texto (contém), não só pelo início', () => {
      expect(filtrarPorBusca(ITENS, 'ologia', (item) => item.nome).map((item) => item.nome)).toEqual([
        'Tecnologia da Informação',
      ])
    })

    it('ignora acentos no termo e no texto', () => {
      expect(filtrarPorBusca(ITENS, 'informacao', (item) => item.nome).map((item) => item.nome)).toEqual([
        'Tecnologia da Informação',
      ])
      expect(filtrarPorBusca(ITENS, 'logística', (item) => item.nome).map((item) => item.nome)).toEqual(['Logística'])
      expect(filtrarPorBusca(ITENS, 'logistica', (item) => item.nome).map((item) => item.nome)).toEqual(['Logística'])
    })

    it('ignora maiúsculas e minúsculas', () => {
      expect(filtrarPorBusca(ITENS, 'FISC', (item) => item.nome).map((item) => item.nome)).toEqual(['Fiscal'])
      expect(filtrarPorBusca(ITENS, 'mArKeTiNg', (item) => item.nome).map((item) => item.nome)).toEqual(['Marketing'])
    })

    it('reduz espaços repetidos e espaços nas pontas do termo', () => {
      expect(filtrarPorBusca(ITENS, '  tecnologia   da  ', (item) => item.nome).map((item) => item.nome)).toEqual([
        'Tecnologia da Informação',
      ])
    })

    it('aceita vários campos (obterTexto devolvendo lista): casa se qualquer um contiver o termo', () => {
      const resultado = filtrarPorBusca(ITENS, 'entregas', (item) => [item.nome, item.descricao ?? ''])

      expect(resultado.map((item) => item.nome)).toEqual(['Logística'])
    })

    it('com vários campos, continua casando pelo nome', () => {
      const resultado = filtrarPorBusca(ITENS, 'comercial', (item) => [item.nome, item.descricao ?? ''])

      expect(resultado.map((item) => item.nome)).toEqual(['Comercial'])
    })

    it('vários itens podem casar e a ordem original é preservada', () => {
      const resultado = filtrarPorBusca(ITENS, 'i', (item) => item.nome)

      expect(resultado.map((item) => item.nome)).toEqual(['Comercial', 'Tecnologia da Informação', 'Fiscal', 'Logística', 'Marketing'])
    })

    it('sem correspondência devolve lista vazia', () => {
      expect(filtrarPorBusca(ITENS, 'xyz-inexistente', (item) => item.nome)).toEqual([])
    })

    it('lista vazia devolve lista vazia', () => {
      expect(filtrarPorBusca([] as Item[], 'comercial', (item) => item.nome)).toEqual([])
    })

    it('devolve os mesmos objetos (referências) e não altera a lista original', () => {
      const original = [...ITENS]

      const resultado = filtrarPorBusca(ITENS, 'fiscal', (item) => item.nome)

      expect(resultado[0]).toBe(ITENS[2])
      expect(ITENS).toEqual(original)
    })

    it('funciona com textos primitivos', () => {
      expect(filtrarPorBusca(['Ação', 'Reação', 'Outro'], 'acao', (texto) => texto)).toEqual(['Ação', 'Reação'])
    })
  })

  describe('contarPor(itens, obterChave)', () => {
    it('conta os itens por chave', () => {
      expect(contarPor(ITENS, (item) => item.origem)).toEqual({ Fixo: 3, Personalizado: 2 })
    })

    it('lista vazia devolve objeto vazio', () => {
      expect(contarPor([] as Item[], (item) => item.origem)).toEqual({})
    })

    it('não inclui chaves sem ocorrência', () => {
      const contagem = contarPor(ITENS.slice(0, 3), (item) => item.origem)

      expect(contagem).toEqual({ Fixo: 3 })
      expect(contagem).not.toHaveProperty('Personalizado')
    })

    it('aceita qualquer função de chave (ex.: primeira letra do nome)', () => {
      expect(contarPor(ITENS, (item) => item.nome[0])).toEqual({ C: 1, T: 1, F: 1, L: 1, M: 1 })
    })

    it('chave repetida em todos os itens devolve o total', () => {
      expect(contarPor(ITENS, () => 'todos')).toEqual({ todos: 5 })
    })

    it('não altera a lista original', () => {
      const original = [...ITENS]

      contarPor(ITENS, (item) => item.origem)

      expect(ITENS).toEqual(original)
    })
  })
})
