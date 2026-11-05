/**
 * Contexto do sinal de alerta nas abas do menu (F6.3 — RF-33, RNF-09). As telas informam, via
 * `definirAlerta`, se a sua aba tem alertas (ex.: indicadores aguardando meta) e o `LayoutPrincipal`
 * marca a aba correspondente em `abasComAlerta`.
 *
 * Referências estáveis: `abasComAlerta` só muda quando o conjunto realmente muda, e `definirAlerta`
 * nunca muda, para não provocar rerenderizações em efeitos que dependem dele.
 * Fora do provider, `abasComAlerta` é vazio e `definirAlerta` não faz nada (telas testadas isoladamente).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Aba } from '../sessao/permissoes'

export interface AlertasMenuContexto {
  abasComAlerta: ReadonlySet<Aba>
  definirAlerta(aba: Aba, ativo: boolean): void
}

const CONJUNTO_VAZIO: ReadonlySet<Aba> = new Set<Aba>()

const VALOR_PADRAO: AlertasMenuContexto = {
  abasComAlerta: CONJUNTO_VAZIO,
  definirAlerta: () => {},
}

const AlertasMenuContext = createContext<AlertasMenuContexto>(VALOR_PADRAO)

export function AlertasMenuProvider({ children }: { children: ReactNode }) {
  const [abasComAlerta, setAbasComAlerta] = useState<ReadonlySet<Aba>>(CONJUNTO_VAZIO)

  const definirAlerta = useCallback((aba: Aba, ativo: boolean) => {
    setAbasComAlerta((atual) => {
      if (atual.has(aba) === ativo) return atual
      const proximo = new Set(atual)
      if (ativo) {
        proximo.add(aba)
      } else {
        proximo.delete(aba)
      }
      return proximo
    })
  }, [])

  const valor = useMemo(() => ({ abasComAlerta, definirAlerta }), [abasComAlerta, definirAlerta])

  return <AlertasMenuContext.Provider value={valor}>{children}</AlertasMenuContext.Provider>
}

export function useAlertasMenu(): AlertasMenuContexto {
  return useContext(AlertasMenuContext)
}
