import { describe, expect, it, vi } from 'vitest'
import { correspondeASituacao } from './filtros'

interface Item {
  id: number
  ativo: boolean
  usadoEmIndicadorAtivo: boolean
}

const ATIVO: Item = { id: 1, ativo: true, usadoEmIndicadorAtivo: false }
const INATIVO: Item = { id: 2, ativo: false, usadoEmIndicadorAtivo: false }
const INATIVO_COM_PROBLEMA: Item = { id: 3, ativo: false, usadoEmIndicadorAtivo: true }

const REGRAS: Record<string, (item: Item) => boolean> = {
  ativos: (item) => item.ativo,
  inativos: (item) => !item.ativo,
  problemas: (item) => !item.ativo && item.usadoEmIndicadorAtivo,
}

describe('F1.14 — correspondeASituacao (filtros.ts)', () => {
  it('filtro "todas" aceita qualquer item, sem consultar as regras', () => {
    const regra = vi.fn((item: Item) => item.ativo)
    const regras: Record<string, (item: Item) => boolean> = { todas: regra, ativos: regra }

    expect(correspondeASituacao('todas', ATIVO, regras)).toBe(true)
    expect(correspondeASituacao('todas', INATIVO, regras)).toBe(true)
    expect(regra).not.toHaveBeenCalled()
  })

  it('devolve true quando a regra do filtro aceita o item', () => {
    expect(correspondeASituacao('ativos', ATIVO, REGRAS)).toBe(true)
    expect(correspondeASituacao('inativos', INATIVO, REGRAS)).toBe(true)
    expect(correspondeASituacao('problemas', INATIVO_COM_PROBLEMA, REGRAS)).toBe(true)
  })

  it('devolve false quando a regra do filtro recusa o item (o item sai da lista)', () => {
    expect(correspondeASituacao('ativos', INATIVO, REGRAS)).toBe(false)
    expect(correspondeASituacao('inativos', ATIVO, REGRAS)).toBe(false)
    expect(correspondeASituacao('problemas', INATIVO, REGRAS)).toBe(false)
    expect(correspondeASituacao('problemas', ATIVO, REGRAS)).toBe(false)
  })

  it('usa somente a regra do filtro informado, chamada com o próprio item', () => {
    const ativos = vi.fn((item: Item) => item.ativo)
    const inativos = vi.fn((item: Item) => !item.ativo)

    const resultado = correspondeASituacao('inativos', INATIVO, { ativos, inativos })

    expect(resultado).toBe(true)
    expect(inativos).toHaveBeenCalledTimes(1)
    expect(inativos).toHaveBeenCalledWith(INATIVO)
    expect(ativos).not.toHaveBeenCalled()
  })

  it('funciona com qualquer forma de item (ex.: situação textual dos dados externos)', () => {
    type Dado = { situacao: 'ativo' | 'inativo' | 'em_construcao'; indicadores: string[] }
    const regras: Record<string, (dado: Dado) => boolean> = {
      construcao: (dado) => dado.situacao === 'em_construcao',
      problemas: (dado) => dado.situacao === 'inativo' && dado.indicadores.length > 0,
    }

    expect(correspondeASituacao('construcao', { situacao: 'em_construcao', indicadores: [] }, regras)).toBe(true)
    expect(correspondeASituacao('construcao', { situacao: 'ativo', indicadores: [] }, regras)).toBe(false)
    expect(correspondeASituacao('problemas', { situacao: 'inativo', indicadores: ['Margem'] }, regras)).toBe(true)
  })
})
