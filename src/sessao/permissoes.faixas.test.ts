import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeAcessar, podeExecutar, type AcaoPermissao } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ações da aba Faixas (matriz da seção 2 do documento — "Faixas: Admin Sim, Validador Sim,
 * Preenchedor Não" — e P-04 resolvida: "o Validador tem acesso a todas as ações das abas Indicadores
 * e Faixas"). O documento prevalece sobre a API, que hoje limita o Validador à própria filial (A-04).
 * - cadastrar tabela, alterar faixas (nova versão), ver o histórico de versões e excluir tabela
 *   (só de dashboard excluído — regra da tabela, não do perfil) — Admin e Validador.
 */
const ESPERADO: ReadonlyArray<[AcaoPermissao, Perfil[]]> = [
  ['cadastrar-faixas', ['admin', 'validador']],
  ['alterar-faixas', ['admin', 'validador']],
  ['ver-historico-faixas', ['admin', 'validador']],
  ['excluir-faixas', ['admin', 'validador']],
]

describe('F8.2 — Permissões da aba Faixas (podeAcessar e podeExecutar)', () => {
  it('a aba Faixas é acessível para Admin e Validador, e não para o Preenchedor', () => {
    expect(PERFIS.filter((perfil) => podeAcessar(perfil, 'faixas'))).toEqual(['admin', 'validador'])
    expect(podeAcessar(null, 'faixas')).toBe(false)
  })

  it.each(ESPERADO)('%s é permitida somente para %j', (acao, perfis) => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, acao))).toEqual(perfis)
  })

  it.each(ESPERADO.map(([acao]) => acao))('sem perfil (null) nunca pode executar %s', (acao) => {
    expect(podeExecutar(null, acao)).toBe(false)
  })

  it('as ações já existentes continuam com a mesma matriz', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-tipo'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-apontamento'))).toEqual(['admin'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'cadastrar-indicador'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-dashboard'))).toEqual(['admin'])
  })
})
