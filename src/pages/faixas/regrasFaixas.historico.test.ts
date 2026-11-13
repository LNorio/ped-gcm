import { describe, expect, it } from 'vitest'
import type { AcaoHistoricoFaixas } from '../../services/faixasService'
import { linhaTemFaixasDaVersao, rotuloAcaoHistoricoFaixas } from './regrasFaixas'

/**
 * F8.12* — contrato final do histórico das faixas (`docs/backend/FRONT-faixa-geral-e-situacao.md`):
 * `acao` vem sempre, com cinco valores (`cadastro`, `alteracao`, `inativacao`, `reativacao` e
 * `exclusao`). Só `cadastro` e `alteracao` são versões com faixas próprias; inativação, reativação e
 * exclusão não oferecem "Ver faixas da versão". Linha sem `acao` (`null`) continua sendo alteração.
 *
 * - `rotuloAcaoHistoricoFaixas(acao)`: rótulo exibido da ação;
 * - `linhaTemFaixasDaVersao(acao)`: `true` quando a linha é uma versão (pode abrir as faixas).
 */
describe('F8.5 — regras do histórico das faixas: rótulos das ações e linhas que são versões', () => {
  it.each<[AcaoHistoricoFaixas | null, string]>([
    ['cadastro', 'Cadastro'],
    ['alteracao', 'Alteração das faixas'],
    ['inativacao', 'Inativação'],
    ['reativacao', 'Reativação'],
    ['exclusao', 'Exclusão'],
    [null, 'Alteração das faixas'],
  ])('rotuloAcaoHistoricoFaixas(%s) = "%s"', (acao, rotulo) => {
    expect(rotuloAcaoHistoricoFaixas(acao)).toBe(rotulo)
  })

  it.each<[AcaoHistoricoFaixas | null, boolean]>([
    ['cadastro', true],
    ['alteracao', true],
    [null, true],
    ['inativacao', false],
    ['reativacao', false],
    ['exclusao', false],
  ])('linhaTemFaixasDaVersao(%s) = %s', (acao, esperado) => {
    expect(linhaTemFaixasDaVersao(acao)).toBe(esperado)
  })
})
