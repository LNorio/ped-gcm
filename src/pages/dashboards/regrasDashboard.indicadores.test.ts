import { describe, expect, it } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { DADO_VENDAS_ZONA_API, dadosExternosParaDashboardApi, indicadoresParaDashboardApi } from '../../test/dashboardsFalsos'
import type { Indicador } from '../../types/dominio'
import { motivoIndisponibilidade, somarPontos, textoTotalPontos } from './regrasDashboard'

const INDICADORES = indicadoresParaDashboardApi().map(paraIndicador)
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)
const porNome = (nome: string): Indicador => INDICADORES.find((indicador) => indicador.nome === nome)!

const ZONA = 'Dado externo por Zona de venda não é aceito em dashboard por filiais'
const COLABORADOR = 'Dado externo por Colaborador não é aceito em dashboard por filiais'

describe('F7.6 — Regras dos indicadores do dashboard (RF-51, RF-52, RF-53, RN-15)', () => {
  describe('motivoIndisponibilidade(indicador, tipoVinculo, dadosExternos)', () => {
    it.each([
      ['Cobertura de visitas', null],
      ['Faturamento líquido mensal', null],
      ['Rotinas financeiras em dia', 'Componente desativado'],
      ['Custo de frete por entrega', 'Componente desativado'],
      ['Cobertura da carteira', 'Componente desativado'],
      ['Devoluções de venda', 'Meta a definir'],
      ['Capacitação', 'Indicador inativo'],
    ])('%s → %s (RF-52)', (nome, motivo) => {
      for (const tipo of ['', 'filiais', 'cargos', 'colaboradores'] as const) {
        expect(motivoIndisponibilidade(porNome(nome), tipo, DADOS_EXTERNOS)).toBe(motivo)
      }
    })

    it('mais de um motivo: inativo prevalece sobre componente desativado, que prevalece sobre meta a definir', () => {
      const capacitacao = porNome('Capacitação')
      const rotinas = porNome('Rotinas financeiras em dia')

      expect(motivoIndisponibilidade({ ...capacitacao, componentesDesativados: true, metaADefinir: true }, 'cargos', DADOS_EXTERNOS)).toBe(
        'Indicador inativo',
      )
      expect(motivoIndisponibilidade({ ...rotinas, metaADefinir: true }, 'cargos', DADOS_EXTERNOS)).toBe('Componente desativado')
    })

    it('dado externo por Zona de venda: indisponível só em dashboard por filiais (RF-53)', () => {
      const vendasZona = porNome('Vendas por zona')

      expect(motivoIndisponibilidade(vendasZona, 'filiais', DADOS_EXTERNOS)).toBe(ZONA)
      expect(motivoIndisponibilidade(vendasZona, 'cargos', DADOS_EXTERNOS)).toBeNull()
      expect(motivoIndisponibilidade(vendasZona, 'colaboradores', DADOS_EXTERNOS)).toBeNull()
      expect(motivoIndisponibilidade(vendasZona, '', DADOS_EXTERNOS)).toBeNull()
    })

    it('dado externo por Colaborador: indisponível em dashboard por filiais (RF-53)', () => {
      const dados = DADOS_EXTERNOS.map((dado) => (dado.id === DADO_VENDAS_ZONA_API.id ? { ...dado, referencia: 'colaborador' as const } : dado))

      expect(motivoIndisponibilidade(porNome('Vendas por zona'), 'filiais', dados)).toBe(COLABORADOR)
    })

    it('dado externo por Filial é aceito em dashboard por filiais', () => {
      expect(motivoIndisponibilidade(porNome('Faturamento líquido mensal'), 'filiais', DADOS_EXTERNOS)).toBeNull()
    })

    it('dado externo que não está na lista recebida não bloqueia (sem referência conhecida)', () => {
      expect(motivoIndisponibilidade(porNome('Vendas por zona'), 'filiais', [])).toBeNull()
    })
  })

  describe('somarPontos(textos)', () => {
    it('soma os pontos digitados em pt-BR, ignorando vazios, inválidos, zero e negativos', () => {
      expect(somarPontos(['40', '60,5', '', 'abc', '0', '-3'])).toBe(100.5)
    })

    it('arredonda a soma em duas casas (sem erro de ponto flutuante)', () => {
      expect(somarPontos(['0,1', '0,2'])).toBe(0.3)
      expect(somarPontos([])).toBe(0)
    })
  })

  describe('textoTotalPontos(soma, maximo) — o formulário mostra o total e quanto falta ou excede (RF-51)', () => {
    it.each([
      [0, null, 'Informe a pontuação base máxima'],
      [50, 0, 'Informe a pontuação base máxima'],
      [100, 100, 'Total correto: 100 pts'],
      [90, 100, 'Faltam 10 pts para 100'],
      [110, 100, 'Excedeu 10 pts — o total deve ser 100'],
      [90.5, 90.5, 'Total correto: 90,50 pts'],
      [40.25, 90.5, 'Faltam 50,25 pts para 90,50'],
      [1250, 1000, 'Excedeu 250 pts — o total deve ser 1.000'],
    ])('soma %s e máximo %s → "%s"', (soma, maximo, texto) => {
      expect(textoTotalPontos(soma, maximo)).toBe(texto)
    })
  })
})
