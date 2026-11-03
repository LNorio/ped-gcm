/**
 * Provedor de sessão falso para testes unitários de componentes que usam `useSessao()`.
 * Usa o contexto real (`SessaoContexto`) com um valor controlado pelo teste (ver `sessaoFalsa.ts`).
 */
import type { ReactNode } from 'react'
import { SessaoContexto, type Sessao } from '../sessao/SessaoProvider'
import { sessaoFalsa } from './sessaoFalsa'

export interface ProvedorSessaoFalsoProps {
  sessao?: Partial<Sessao>
  children: ReactNode
}

export function ProvedorSessaoFalso({ sessao, children }: ProvedorSessaoFalsoProps) {
  return <SessaoContexto.Provider value={sessaoFalsa(sessao)}>{children}</SessaoContexto.Provider>
}
