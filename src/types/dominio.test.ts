import { describe, expect, it } from 'vitest'
import {
  CALCULOS,
  COLETAS,
  JANELAS_RETROATIVAS,
  PERFIS,
  PERIODICIDADES,
  REFERENCIAS,
  ROTULOS_CALCULO,
  ROTULOS_COLETA,
  ROTULOS_PERFIL,
  ROTULOS_PERIODICIDADE,
  ROTULOS_REFERENCIA,
  ROTULOS_SENTIDO,
  ROTULOS_SENTIDO_CALCULO,
  ROTULOS_SISTEMA_ORIGEM,
  ROTULOS_SITUACAO_DADO_EXTERNO,
  ROTULOS_SITUACAO_DASHBOARD,
  ROTULOS_TIPO_VALOR,
  ROTULOS_TIPO_VINCULO,
  SENTIDOS,
  SENTIDOS_CALCULO,
  SISTEMAS_ORIGEM,
  SITUACOES_DADO_EXTERNO,
  SITUACOES_DASHBOARD,
  TIPOS_VALOR,
  TIPOS_VINCULO,
} from './dominio'

describe('F1.3 — Enums do domínio', () => {
  it('perfis: admin, validador e preenchedor, com rótulos em pt-BR', () => {
    expect(PERFIS).toEqual(['admin', 'validador', 'preenchedor'])
    expect(ROTULOS_PERFIL).toEqual({ admin: 'Admin', validador: 'Validador', preenchedor: 'Preenchedor' })
  })

  it('tipos de valor: porcentagem, numeral e booleano', () => {
    expect(TIPOS_VALOR).toEqual(['porcentagem', 'numeral', 'booleano'])
    expect(ROTULOS_TIPO_VALOR).toEqual({ porcentagem: 'Porcentagem', numeral: 'Numeral', booleano: 'Booleano' })
  })

  it('periodicidades na ordem mensal → anual', () => {
    expect(PERIODICIDADES).toEqual(['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'])
    expect(ROTULOS_PERIODICIDADE).toEqual({
      mensal: 'Mensal',
      bimestral: 'Bimestral',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
    })
  })

  it('sentido do indicador: maior é melhor e menor é melhor (custo)', () => {
    expect(SENTIDOS).toEqual(['maior_melhor', 'menor_melhor'])
    expect(ROTULOS_SENTIDO).toEqual({ maior_melhor: 'Maior é melhor', menor_melhor: 'Menor é melhor (custo)' })
  })

  it('cálculo do indicador com apontamentos: soma e média', () => {
    expect(CALCULOS).toEqual(['soma', 'media'])
    expect(ROTULOS_CALCULO).toEqual({ soma: 'Soma', media: 'Média' })
  })

  it('sentido do cálculo do dado externo: somar, média e último valor', () => {
    expect(SENTIDOS_CALCULO).toEqual(['soma', 'media', 'ultimo'])
    expect(ROTULOS_SENTIDO_CALCULO).toEqual({
      soma: 'Somar',
      media: 'Fazer a média',
      ultimo: 'Usar só o último valor',
    })
  })

  it('referência do dado externo: Filial, Colaborador e Zona de venda (API usa "zona")', () => {
    expect(REFERENCIAS).toEqual(['filial', 'colaborador', 'zona'])
    expect(ROTULOS_REFERENCIA).toEqual({ filial: 'Filial', colaborador: 'Colaborador', zona: 'Zona de venda' })
  })

  it('sistemas de origem conforme o documento (RF-25)', () => {
    expect(SISTEMAS_ORIGEM).toEqual(['senior_erp', 'senior_hcm', 'bitrix24', 'outro'])
    expect(ROTULOS_SISTEMA_ORIGEM).toEqual({
      senior_erp: 'Senior ERP (Sapiens)',
      senior_hcm: 'Senior HCM',
      bitrix24: 'Bitrix24',
      outro: 'Outro sistema',
    })
  })

  it('coleta: diária ou em dia específico do mês', () => {
    expect(COLETAS).toEqual(['diaria', 'dia do mes'])
    expect(ROTULOS_COLETA).toEqual({ diaria: 'Diária', 'dia do mes': 'Data específica do mês' })
  })

  it('janela retroativa: 1 (somente o mês), 2, 3, 6, 12 e 24 meses', () => {
    expect(JANELAS_RETROATIVAS).toEqual([1, 2, 3, 6, 12, 24])
  })

  it('situações de dado externo e de dashboard com descrição em pt-BR', () => {
    expect(SITUACOES_DADO_EXTERNO).toEqual(['ativo', 'inativo', 'em_construcao'])
    expect(ROTULOS_SITUACAO_DADO_EXTERNO).toEqual({
      ativo: 'Ativo',
      inativo: 'Inativo',
      em_construcao: 'Em construção (TI)',
    })
    expect(SITUACOES_DASHBOARD).toEqual(['ativo', 'inativo', 'em_construcao', 'em_modificacao'])
    expect(ROTULOS_SITUACAO_DASHBOARD).toEqual({
      ativo: 'Ativo',
      inativo: 'Inativo',
      em_construcao: 'Em construção (TI)',
      em_modificacao: 'Em modificação (TI)',
    })
  })

  it('tipos de vínculo do dashboard: filiais, cargos e colaboradores', () => {
    expect(TIPOS_VINCULO).toEqual(['filiais', 'cargos', 'colaboradores'])
    expect(ROTULOS_TIPO_VINCULO).toEqual({ filiais: 'Filiais', cargos: 'Cargos', colaboradores: 'Colaboradores' })
  })
})
