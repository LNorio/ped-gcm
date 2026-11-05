import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AlertasMenuProvider, useAlertasMenu } from './AlertasMenu'

/**
 * Contexto do sinal de alerta nas abas do menu (RF-33, RNF-09): as telas informam se a sua aba tem
 * alertas (ex.: indicadores aguardando meta ou com componente desativado) e o layout marca a aba.
 */
describe('F6.3 — AlertasMenu (contexto do sinal de alerta nas abas do menu)', () => {
  const comProvider = ({ children }: { children: ReactNode }) => <AlertasMenuProvider>{children}</AlertasMenuProvider>

  it('começa sem nenhuma aba com alerta', () => {
    const { result } = renderHook(() => useAlertasMenu(), { wrapper: comProvider })

    expect(result.current.abasComAlerta.size).toBe(0)
    expect(result.current.abasComAlerta.has('indicadores')).toBe(false)
  })

  it('definirAlerta(aba, true) marca a aba; definirAlerta(aba, false) desmarca', () => {
    const { result } = renderHook(() => useAlertasMenu(), { wrapper: comProvider })

    act(() => {
      result.current.definirAlerta('indicadores', true)
    })
    expect(result.current.abasComAlerta.has('indicadores')).toBe(true)
    expect([...result.current.abasComAlerta]).toEqual(['indicadores'])

    act(() => {
      result.current.definirAlerta('indicadores', false)
    })
    expect(result.current.abasComAlerta.has('indicadores')).toBe(false)
  })

  it('várias abas podem ter alerta ao mesmo tempo; desmarcar uma não afeta a outra', () => {
    const { result } = renderHook(() => useAlertasMenu(), { wrapper: comProvider })

    act(() => {
      result.current.definirAlerta('indicadores', true)
      result.current.definirAlerta('dashboards', true)
    })
    expect([...result.current.abasComAlerta].sort()).toEqual(['dashboards', 'indicadores'])

    act(() => {
      result.current.definirAlerta('indicadores', false)
    })
    expect([...result.current.abasComAlerta]).toEqual(['dashboards'])
  })

  it('repetir o mesmo valor não cria um novo conjunto (referência estável para evitar rerenderizações)', () => {
    const { result } = renderHook(() => useAlertasMenu(), { wrapper: comProvider })
    act(() => {
      result.current.definirAlerta('indicadores', true)
    })
    const antes = result.current.abasComAlerta

    act(() => {
      result.current.definirAlerta('indicadores', true)
    })
    expect(result.current.abasComAlerta).toBe(antes)

    act(() => {
      result.current.definirAlerta('faixas', false)
    })
    expect(result.current.abasComAlerta).toBe(antes)
  })

  it('definirAlerta mantém a mesma referência entre renderizações', () => {
    const { result } = renderHook(() => useAlertasMenu(), { wrapper: comProvider })
    const definir = result.current.definirAlerta

    act(() => {
      result.current.definirAlerta('indicadores', true)
    })

    expect(result.current.definirAlerta).toBe(definir)
  })

  it('fora do provider, o hook não quebra: conjunto vazio e definirAlerta sem efeito (telas testadas isoladamente)', () => {
    const { result } = renderHook(() => useAlertasMenu())

    expect(result.current.abasComAlerta.size).toBe(0)
    expect(() => {
      act(() => {
        result.current.definirAlerta('indicadores', true)
      })
    }).not.toThrow()
    expect(result.current.abasComAlerta.size).toBe(0)
  })
})
