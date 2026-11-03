/**
 * Fábricas de valores de sessão para testes unitários (ver `ProvedorSessaoFalso.tsx`).
 */
import { vi } from 'vitest'
import type { Sessao } from '../sessao/SessaoProvider'
import type { Acesso, Filial } from '../types/dominio'

export const FILIAIS: Filial[] = [
  { codigo: '100', nome: 'MATRIZ', empresa: null },
  { codigo: '101', nome: 'CAMPO GRANDE', empresa: null },
  { codigo: '102', nome: 'DOURADOS', empresa: null },
]

export function acessoFalso(parcial: Partial<Acesso> = {}): Acesso {
  return {
    idColaborador: 12,
    nome: 'Fulano',
    perfil: 'preenchedor',
    tipos: [{ id: 1, nome: 'Comercial' }],
    todasAsFiliais: false,
    filiais: [FILIAIS[1]],
    periodoAberto: '2026-10-01',
    ...parcial,
  }
}

export function sessaoFalsa(parcial: Partial<Sessao> = {}): Sessao {
  const acesso = parcial.acesso === undefined ? acessoFalso() : parcial.acesso
  return {
    estado: 'autenticado',
    acesso,
    erro: null,
    filialSelecionada: acesso?.todasAsFiliais ? 'todas' : (acesso?.filiais[0] ?? null),
    entrar: vi.fn().mockResolvedValue(undefined),
    sair: vi.fn(),
    selecionarFilial: vi.fn(),
    ...parcial,
  }
}
