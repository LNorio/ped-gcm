import { describe, expect, it } from 'vitest'
import { COLABORADORES_VINCULO } from '../../test/dashboardsFalsos'
import { resumoImagens } from './regrasDashboard'

/**
 * Colaboradores da fixture: 100 → Ana Souza (Gerente de Loja) e Fábio Nunes (Supervisor Comercial);
 * 101 → Bruno Lima e Carla Dias (Vendedor); 102 → Diego Rocha (Gerente de Loja) e Elisa Prado
 * (Vendedor); 103 → nenhum.
 */
describe('F7.5 — resumoImagens: imagens geradas no encerramento conforme o vínculo (RF-50)', () => {
  it('sem tipo ou sem itens escolhidos: nenhuma imagem e nenhuma filial', () => {
    const vazio = { quantidade: 0, filiais: [], filiaisSemColaborador: [] }

    expect(resumoImagens({ tipo: '', itens: [] }, COLABORADORES_VINCULO)).toEqual(vazio)
    expect(resumoImagens({ tipo: 'filiais', itens: [] }, COLABORADORES_VINCULO)).toEqual(vazio)
    expect(resumoImagens({ tipo: 'cargos', itens: [] }, COLABORADORES_VINCULO)).toEqual(vazio)
  })

  it('por filiais: uma imagem por colaborador das filiais escolhidas', () => {
    expect(resumoImagens({ tipo: 'filiais', itens: ['101', '100'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 4,
      filiais: ['100', '101'],
      filiaisSemColaborador: [],
    })
  })

  it('por filiais: filial sem colaborador gera uma única imagem "Filial (sem colaborador vinculado)"', () => {
    expect(resumoImagens({ tipo: 'filiais', itens: ['103', '101'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 3,
      filiais: ['101', '103'],
      filiaisSemColaborador: ['103'],
    })
    expect(resumoImagens({ tipo: 'filiais', itens: ['103'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 1,
      filiais: ['103'],
      filiaisSemColaborador: ['103'],
    })
  })

  it('por filiais: todas as filiais (Selecionar todas) somam todos os colaboradores e a filial vazia', () => {
    expect(resumoImagens({ tipo: 'filiais', itens: ['100', '101', '102', '103'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 7,
      filiais: ['100', '101', '102', '103'],
      filiaisSemColaborador: ['103'],
    })
  })

  it('por cargos: uma imagem por colaborador do cargo, só nas filiais que têm colaboradores desse cargo', () => {
    expect(resumoImagens({ tipo: 'cargos', itens: ['Vendedor'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 3,
      filiais: ['101', '102'],
      filiaisSemColaborador: [],
    })
    expect(resumoImagens({ tipo: 'cargos', itens: ['Gerente de Loja', 'Supervisor Comercial'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 3,
      filiais: ['100', '102'],
      filiaisSemColaborador: [],
    })
  })

  it('por cargos sem nenhum colaborador: nenhuma imagem (cargo vazio não gera imagem de filial)', () => {
    expect(resumoImagens({ tipo: 'cargos', itens: ['Motorista'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 0,
      filiais: [],
      filiaisSemColaborador: [],
    })
  })

  it('por colaboradores específicos: uma imagem por colaborador escolhido, nas filiais deles (ids em texto)', () => {
    expect(resumoImagens({ tipo: 'colaboradores', itens: ['16', '11', '15'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 3,
      filiais: ['100', '102'],
      filiaisSemColaborador: [],
    })
  })

  it('itens que não existem nas listas são ignorados', () => {
    expect(resumoImagens({ tipo: 'colaboradores', itens: ['999'] }, COLABORADORES_VINCULO)).toEqual({
      quantidade: 0,
      filiais: [],
      filiaisSemColaborador: [],
    })
  })
})
