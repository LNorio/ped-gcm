import { describe, expect, it } from 'vitest'
import {
  ACOES_LANCAMENTO,
  ORIGENS_META_DO_CADASTRO,
  ROTULOS_ACAO_LANCAMENTO,
  ROTULOS_SITUACAO_LANCAMENTO,
  SITUACOES_LANCAMENTO,
  SITUACOES_MES_PREENCHIMENTO,
} from './dominio'

describe('F9.1 — Enums do domínio do preenchimento (RF-61, RF-65, RF-69, RF-72)', () => {
  it('situações do mês de competência: aberto, fechado e futuro', () => {
    expect(SITUACOES_MES_PREENCHIMENTO).toEqual(['aberto', 'fechado', 'futuro'])
  })

  it('situações do apontamento no mês, com rótulos em pt-BR (RF-65)', () => {
    expect(SITUACOES_LANCAMENTO).toEqual(['pendente', 'nao_lancado', 'preenchido', 'corrigido'])
    expect(ROTULOS_SITUACAO_LANCAMENTO).toEqual({
      pendente: 'Pendente',
      nao_lancado: 'Não lançado',
      preenchido: 'Preenchido',
      corrigido: 'Corrigido',
    })
  })

  it('ações do histórico do apontamento, com rótulos em pt-BR (RF-69)', () => {
    expect(ACOES_LANCAMENTO).toEqual(['lancamento', 'correcao'])
    expect(ROTULOS_ACAO_LANCAMENTO).toEqual({ lancamento: 'Lançamento', correcao: 'Correção' })
  })

  it('origem da meta do cadastro na janela "Editar metas": filial ou geral', () => {
    expect(ORIGENS_META_DO_CADASTRO).toEqual(['filial', 'geral'])
  })
})
