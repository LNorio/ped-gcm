import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listarDashboards } from '../../services/dashboardsService'
import { listarIndicadores, type ResultadoListagemIndicadores } from '../../services/indicadoresService'
import { obterInicio } from '../../services/inicioService'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Dashboard, Indicador, Inicio } from '../../types/dominio'
import {
  codigoDaFilial,
  consultarIndicadoresComMetaPendente,
  liberarPreConsultaInicio,
  liberarPreConsultaPendencias,
  preConsultarInicio,
  verPreConsultaInicio,
  verPreConsultaPendencias,
  vePendencias,
} from './consultasInicio'

vi.mock('../../services/inicioService', () => ({ obterInicio: vi.fn() }))
vi.mock('../../services/indicadoresService', () => ({ listarIndicadores: vi.fn() }))
vi.mock('../../services/dashboardsService', () => ({ listarDashboards: vi.fn() }))

const obterInicioFalso = vi.mocked(obterInicio)
const listarIndicadoresFalso = vi.mocked(listarIndicadores)
const listarDashboardsFalso = vi.mocked(listarDashboards)

const INICIO = { resumo: [] } as unknown as Inicio
const DASHBOARDS = [{ id: 7, nome: 'Comercial' }] as unknown as Dashboard[]

function indicador(id: number, nome: string): Indicador {
  return { id, nome } as unknown as Indicador
}

function listagem(indicadores: Indicador[]): ResultadoListagemIndicadores {
  return { indicadores } as unknown as ResultadoListagemIndicadores
}

async function esperarMicrotarefas() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

describe('F11.1 / F11.6 — Consultas e pré-consulta do Início (consultasInicio)', () => {
  beforeEach(() => {
    obterInicioFalso.mockResolvedValue(INICIO)
    listarIndicadoresFalso.mockResolvedValue(listagem([]))
    listarDashboardsFalso.mockResolvedValue(DASHBOARDS)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('codigoDaFilial', () => {
    it('uma filial vira o próprio código', () => {
      expect(codigoDaFilial(FILIAIS[1])).toBe('101')
    })

    it('"todas", nenhuma filial (null) ou indefinida viram sem filial (null)', () => {
      expect(codigoDaFilial('todas')).toBeNull()
      expect(codigoDaFilial(null)).toBeNull()
      expect(codigoDaFilial(undefined)).toBeNull()
    })
  })

  describe('vePendencias', () => {
    it('Admin e Validador veem as pendências do cadastro', () => {
      expect(vePendencias('admin')).toBe(true)
      expect(vePendencias('validador')).toBe(true)
    })

    it('Preenchedor, sem perfil (null) ou indefinido não veem', () => {
      expect(vePendencias('preenchedor')).toBe(false)
      expect(vePendencias(null)).toBe(false)
      expect(vePendencias(undefined)).toBe(false)
    })
  })

  describe('consultarIndicadoresComMetaPendente', () => {
    it('une situacao=meta e situacao=meta_filial_pendente sem repetir e em ordem alfabética', async () => {
      listarIndicadoresFalso.mockImplementation(async (filtros) =>
        filtros?.situacao === 'meta'
          ? listagem([indicador(2, 'Vendas'), indicador(1, 'Água')])
          : listagem([indicador(2, 'Vendas'), indicador(3, 'Margem')]),
      )

      const resultado = await consultarIndicadoresComMetaPendente()

      expect(listarIndicadoresFalso).toHaveBeenCalledWith({ situacao: 'meta' })
      expect(listarIndicadoresFalso).toHaveBeenCalledWith({ situacao: 'meta_filial_pendente' })
      expect(resultado.map((i) => i.nome)).toEqual(['Água', 'Margem', 'Vendas'])
    })
  })

  describe('pré-consulta do Início', () => {
    it('dispara GET /api/ped/inicio na hora, com o código da filial selecionada', () => {
      const acesso = acessoFalso({ perfil: 'preenchedor' })

      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(obterInicioFalso).toHaveBeenCalledTimes(1)
      expect(obterInicioFalso).toHaveBeenCalledWith('101')
    })

    it('com "todas" as filiais consulta sem filial', () => {
      const acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })

      preConsultarInicio({ acesso, filialSelecionada: 'todas' })

      expect(obterInicioFalso).toHaveBeenCalledWith(null)
      expect(verPreConsultaInicio(acesso, null)).not.toBeNull()
    })

    it('fica disponível para o mesmo acesso e a mesma filial, com o resultado preenchido ao chegar', async () => {
      const acesso = acessoFalso()
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      const pre = verPreConsultaInicio(acesso, '101')
      expect(pre).not.toBeNull()
      expect(pre?.codigoFilial).toBe('101')
      expect(pre?.consulta.resultado).toBeNull()

      await expect(pre?.consulta.promessa).resolves.toBe(INICIO)
      await esperarMicrotarefas()
      expect(pre?.consulta.resultado).toEqual({ ok: true, valor: INICIO })
    })

    it('uma falha da consulta fica registrada no resultado (ok: false), sem rejeição não tratada', async () => {
      const erro = new Error('Falha ao montar o inicio.')
      obterInicioFalso.mockRejectedValueOnce(erro)
      const acesso = acessoFalso()
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })
      const pre = verPreConsultaInicio(acesso, '101')

      await esperarMicrotarefas()

      expect(pre?.consulta.resultado).toEqual({ ok: false, erro })
      await expect(pre?.consulta.promessa).rejects.toBe(erro)
    })

    it('vale uma única vez: depois de liberada, a mesma consulta não é mais devolvida', () => {
      const acesso = acessoFalso()
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })
      const pre = verPreConsultaInicio(acesso, '101')
      expect(pre).not.toBeNull()
      // Ver não consome: até liberar, a mesma pré-consulta é devolvida.
      expect(verPreConsultaInicio(acesso, '101')).toBe(pre)

      liberarPreConsultaInicio(pre!)

      expect(verPreConsultaInicio(acesso, '101')).toBeNull()
    })

    it('outro usuário (outro acesso, mesmo com dados iguais) não reaproveita o resultado', () => {
      const acesso = acessoFalso()
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(verPreConsultaInicio(acessoFalso(), '101')).toBeNull()
      expect(verPreConsultaInicio(acessoFalso({ idColaborador: 99, nome: 'Ciclano' }), '101')).toBeNull()
      expect(verPreConsultaInicio(null, '101')).toBeNull()
      expect(verPreConsultaInicio(acesso, '101')).not.toBeNull()
    })

    it('outra filial não reaproveita o resultado', () => {
      const acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(verPreConsultaInicio(acesso, '102')).toBeNull()
      expect(verPreConsultaInicio(acesso, null)).toBeNull()
      expect(verPreConsultaInicio(acesso, '101')).not.toBeNull()
    })

    it('uma nova pré-consulta substitui a anterior; liberar a antiga não descarta a nova', () => {
      const primeiroAcesso = acessoFalso()
      preConsultarInicio({ acesso: primeiroAcesso, filialSelecionada: FILIAIS[1] })
      const antiga = verPreConsultaInicio(primeiroAcesso, '101')!

      const segundoAcesso = acessoFalso()
      preConsultarInicio({ acesso: segundoAcesso, filialSelecionada: FILIAIS[1] })

      expect(verPreConsultaInicio(primeiroAcesso, '101')).toBeNull()
      const nova = verPreConsultaInicio(segundoAcesso, '101')
      expect(nova).not.toBeNull()

      liberarPreConsultaInicio(antiga)
      expect(verPreConsultaInicio(segundoAcesso, '101')).toBe(nova)
    })
  })

  describe('pré-consulta das pendências', () => {
    it.each(['admin', 'validador'] as const)('%s: dispara as consultas de indicadores e dashboards', async (perfil) => {
      const acesso = acessoFalso({ perfil })

      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(listarIndicadoresFalso).toHaveBeenCalledWith({ situacao: 'meta' })
      expect(listarIndicadoresFalso).toHaveBeenCalledWith({ situacao: 'meta_filial_pendente' })
      expect(listarDashboardsFalso).toHaveBeenCalledTimes(1)
      expect(listarDashboardsFalso).toHaveBeenCalledWith({ situacao: 'construcao' })

      const pre = verPreConsultaPendencias(acesso)
      expect(pre).not.toBeNull()
      await esperarMicrotarefas()
      expect(pre?.dashboards.resultado).toEqual({ ok: true, valor: DASHBOARDS })
      expect(pre?.indicadores.resultado).toEqual({ ok: true, valor: [] })
    })

    it('Preenchedor: não dispara as consultas de pendências e não há pré-consulta delas', () => {
      const acesso = acessoFalso({ perfil: 'preenchedor' })

      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(listarIndicadoresFalso).not.toHaveBeenCalled()
      expect(listarDashboardsFalso).not.toHaveBeenCalled()
      expect(verPreConsultaPendencias(acesso)).toBeNull()
      expect(obterInicioFalso).toHaveBeenCalledTimes(1)
    })

    it('vale uma única vez e só para o mesmo acesso', () => {
      const acesso = acessoFalso({ perfil: 'admin' })
      preConsultarInicio({ acesso, filialSelecionada: FILIAIS[1] })

      expect(verPreConsultaPendencias(acessoFalso({ perfil: 'admin' }))).toBeNull()
      expect(verPreConsultaPendencias(null)).toBeNull()

      const pre = verPreConsultaPendencias(acesso)!
      liberarPreConsultaPendencias(pre)
      expect(verPreConsultaPendencias(acesso)).toBeNull()
    })

    it('uma pré-consulta do Preenchedor descarta a pré-consulta de pendências anterior', () => {
      const admin = acessoFalso({ perfil: 'admin' })
      preConsultarInicio({ acesso: admin, filialSelecionada: FILIAIS[1] })
      expect(verPreConsultaPendencias(admin)).not.toBeNull()

      preConsultarInicio({ acesso: acessoFalso({ perfil: 'preenchedor' }), filialSelecionada: FILIAIS[1] })

      expect(verPreConsultaPendencias(admin)).toBeNull()
    })
  })
})
