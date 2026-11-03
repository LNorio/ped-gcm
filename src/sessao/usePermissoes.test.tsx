import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { acessoFalso } from '../test/sessaoFalsa'
import type { Perfil } from '../types/dominio'
import { usePermissoes } from './usePermissoes'

function comPerfil(perfil: Perfil | null) {
  return ({ children }: { children: ReactNode }) => (
    <ProvedorSessaoFalso
      sessao={{
        estado: perfil === null ? 'sem-acesso' : 'autenticado',
        acesso: acessoFalso({ perfil, todasAsFiliais: perfil === 'admin' || perfil === 'validador' }),
      }}
    >
      {children}
    </ProvedorSessaoFalso>
  )
}

describe('F2.6 — Permissões por perfil (usePermissoes)', () => {
  it('Admin: abas completas e pode(aba) verdadeiro para todas', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('admin') })

    expect(result.current.abas).toEqual([
      'inicio',
      'tipos',
      'apontamentos',
      'dados-externos',
      'indicadores',
      'faixas',
      'dashboards',
      'preenchimento',
      'fechamentos',
    ])
    expect(result.current.pode('fechamentos')).toBe(true)
    expect(result.current.pode('tipos')).toBe(true)
  })

  it('Validador: abas completas, inclusive Tipos, Faixas e Fechamentos', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('validador') })

    expect(result.current.abas).toHaveLength(9)
    expect(result.current.pode('tipos')).toBe(true)
    expect(result.current.pode('faixas')).toBe(true)
    expect(result.current.pode('fechamentos')).toBe(true)
  })

  it('Preenchedor: só Início, Apontamentos, Dados Externos e Preenchimento; pode(aba) falso nas demais', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('preenchedor') })

    expect(result.current.abas).toEqual(['inicio', 'apontamentos', 'dados-externos', 'preenchimento'])
    expect(result.current.pode('apontamentos')).toBe(true)
    expect(result.current.pode('tipos')).toBe(false)
    expect(result.current.pode('indicadores')).toBe(false)
    expect(result.current.pode('faixas')).toBe(false)
    expect(result.current.pode('dashboards')).toBe(false)
    expect(result.current.pode('fechamentos')).toBe(false)
  })

  it('sem perfil: nenhuma aba e pode(aba) sempre falso', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil(null) })

    expect(result.current.abas).toEqual([])
    expect(result.current.pode('inicio')).toBe(false)
  })

  it('sem acesso carregado (sessão anônima): nenhuma aba', () => {
    const { result } = renderHook(() => usePermissoes(), {
      wrapper: ({ children }) => (
        <ProvedorSessaoFalso sessao={{ estado: 'anonimo', acesso: null }}>{children}</ProvedorSessaoFalso>
      ),
    })

    expect(result.current.abas).toEqual([])
    expect(result.current.pode('inicio')).toBe(false)
  })
})
