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

describe('F1.13 — Permissões de ação por perfil (usePermissoes().podeAcao)', () => {
  it('Admin pode executar todas as ações', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('admin') })

    expect(result.current.podeAcao('excluir-tipo')).toBe(true)
    expect(result.current.podeAcao('alterar-situacao-apontamento')).toBe(true)
    expect(result.current.podeAcao('excluir-apontamento')).toBe(true)
  })

  it('Validador exclui tipos e altera a situação de apontamentos, mas não exclui apontamentos', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('validador') })

    expect(result.current.podeAcao('excluir-tipo')).toBe(true)
    expect(result.current.podeAcao('alterar-situacao-apontamento')).toBe(true)
    expect(result.current.podeAcao('excluir-apontamento')).toBe(false)
  })

  it('Preenchedor não executa nenhuma das ações', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('preenchedor') })

    expect(result.current.podeAcao('excluir-tipo')).toBe(false)
    expect(result.current.podeAcao('alterar-situacao-apontamento')).toBe(false)
    expect(result.current.podeAcao('excluir-apontamento')).toBe(false)
  })

  it('sem perfil: podeAcao sempre falso', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil(null) })

    expect(result.current.podeAcao('excluir-tipo')).toBe(false)
    expect(result.current.podeAcao('excluir-apontamento')).toBe(false)
  })

  it('sem acesso carregado (sessão anônima): podeAcao sempre falso', () => {
    const { result } = renderHook(() => usePermissoes(), {
      wrapper: ({ children }) => (
        <ProvedorSessaoFalso sessao={{ estado: 'anonimo', acesso: null }}>{children}</ProvedorSessaoFalso>
      ),
    })

    expect(result.current.podeAcao('alterar-situacao-apontamento')).toBe(false)
  })

  it('continua expondo abas e pode(aba) da F2.6', () => {
    const { result } = renderHook(() => usePermissoes(), { wrapper: comPerfil('preenchedor') })

    expect(result.current.abas).toEqual(['inicio', 'apontamentos', 'dados-externos', 'preenchimento'])
    expect(result.current.pode('apontamentos')).toBe(true)
    expect(typeof result.current.podeAcao).toBe('function')
  })
})
