/**
 * Contexto do sinal de alerta nas abas do menu (F6.3 — RF-33, RNF-09). As telas informam, via
 * `definirAlerta`, se a sua aba tem alertas (ex.: indicadores aguardando meta) e o `LayoutPrincipal`
 * marca a aba correspondente em `abasComAlerta`.
 *
 * F2.12: o verificador central (`useVerificadorAlertasMenu`) também acende/apaga as abas pelo
 * `GET /api/ped/alertas-menu` e informa, via `definirDica`, a dica de cada aba (as `descricao` dos itens
 * unidas por " · "). A aba acesa só pela tela fica sem dica.
 *
 * Referências estáveis: `abasComAlerta` e `dicas` só mudam quando o conteúdo realmente muda, e
 * `definirAlerta`/`definirDica` nunca mudam, para não provocar rerenderizações em efeitos que dependem deles.
 * Fora do provider, `abasComAlerta` e `dicas` são vazios e `definirAlerta`/`definirDica` não fazem nada
 * (telas testadas isoladamente).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Aba } from '../sessao/permissoes'

export type DicasAlertasMenu = Readonly<Partial<Record<Aba, string>>>

export interface AlertasMenuContexto {
  abasComAlerta: ReadonlySet<Aba>
  definirAlerta(aba: Aba, ativo: boolean): void
  /** Dica do marcador de cada aba (texto já montado); aba sem entrada fica sem dica. */
  dicas: DicasAlertasMenu
  /** Define a dica da aba; `null` ou `''` remove a dica. */
  definirDica(aba: Aba, dica: string | null): void
}

const CONJUNTO_VAZIO: ReadonlySet<Aba> = new Set<Aba>()
const DICAS_VAZIAS: DicasAlertasMenu = {}

const VALOR_PADRAO: AlertasMenuContexto = {
  abasComAlerta: CONJUNTO_VAZIO,
  definirAlerta: () => {},
  dicas: DICAS_VAZIAS,
  definirDica: () => {},
}

const AlertasMenuContext = createContext<AlertasMenuContexto>(VALOR_PADRAO)

export function AlertasMenuProvider({ children }: { children: ReactNode }) {
  const [abasComAlerta, setAbasComAlerta] = useState<ReadonlySet<Aba>>(CONJUNTO_VAZIO)
  const [dicas, setDicas] = useState<DicasAlertasMenu>(DICAS_VAZIAS)

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

  const definirDica = useCallback((aba: Aba, dica: string | null) => {
    setDicas((atual) => {
      const nova = dica ? dica : undefined
      if (atual[aba] === nova) return atual
      const proximo: Partial<Record<Aba, string>> = { ...atual }
      if (nova === undefined) {
        delete proximo[aba]
      } else {
        proximo[aba] = nova
      }
      return proximo
    })
  }, [])

  const valor = useMemo(
    () => ({ abasComAlerta, definirAlerta, dicas, definirDica }),
    [abasComAlerta, definirAlerta, dicas, definirDica],
  )

  return <AlertasMenuContext.Provider value={valor}>{children}</AlertasMenuContext.Provider>
}

export function useAlertasMenu(): AlertasMenuContexto {
  return useContext(AlertasMenuContext)
}
