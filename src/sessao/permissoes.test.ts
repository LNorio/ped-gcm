import { describe, expect, it } from 'vitest'
import { PERFIS } from '../types/dominio'
import { ABAS, ROTULOS_ABA, abasVisiveis, podeAcessar, type Aba } from './permissoes'

const TODAS: Aba[] = [
  'inicio',
  'tipos',
  'apontamentos',
  'dados-externos',
  'indicadores',
  'faixas',
  'dashboards',
  'preenchimento',
  'fechamentos',
]

const ABAS_PREENCHEDOR: Aba[] = ['inicio', 'apontamentos', 'dados-externos', 'preenchimento']
const ABAS_RESTRITAS_AO_PREENCHEDOR: Aba[] = ['tipos', 'indicadores', 'faixas', 'dashboards', 'fechamentos']

describe('F2.6 — Permissões por perfil', () => {
  describe('ABAS e ROTULOS_ABA', () => {
    it('lista as nove abas na ordem do protótipo', () => {
      expect([...ABAS]).toEqual(TODAS)
    })

    it('tem o rótulo em pt-BR de cada aba', () => {
      expect(ROTULOS_ABA).toEqual({
        inicio: 'Início',
        tipos: 'Tipos',
        apontamentos: 'Apontamentos',
        'dados-externos': 'Dados Externos',
        indicadores: 'Indicadores',
        faixas: 'Faixas',
        dashboards: 'Dashboards',
        preenchimento: 'Preenchimento',
        fechamentos: 'Fechamentos',
      })
    })
  })

  describe('abasVisiveis(perfil)', () => {
    it('Admin vê todas as abas, na ordem', () => {
      expect(abasVisiveis('admin')).toEqual(TODAS)
    })

    it('Validador vê todas as abas, inclusive Tipos, Faixas e Fechamentos', () => {
      expect(abasVisiveis('validador')).toEqual(TODAS)
    })

    it('Preenchedor vê somente Início, Apontamentos, Dados Externos e Preenchimento', () => {
      expect(abasVisiveis('preenchedor')).toEqual(ABAS_PREENCHEDOR)
    })

    it('perfil null (sem acesso) não vê aba alguma', () => {
      expect(abasVisiveis(null)).toEqual([])
    })

    it('devolve um novo array a cada chamada (não expõe a lista interna)', () => {
      const primeira = abasVisiveis('admin')
      primeira.pop()

      expect(abasVisiveis('admin')).toEqual(TODAS)
    })
  })

  describe('podeAcessar(perfil, aba)', () => {
    it.each(TODAS)('Admin pode acessar "%s"', (aba) => {
      expect(podeAcessar('admin', aba)).toBe(true)
    })

    it.each(TODAS)('Validador pode acessar "%s"', (aba) => {
      expect(podeAcessar('validador', aba)).toBe(true)
    })

    it.each(ABAS_PREENCHEDOR)('Preenchedor pode acessar "%s"', (aba) => {
      expect(podeAcessar('preenchedor', aba)).toBe(true)
    })

    it.each(ABAS_RESTRITAS_AO_PREENCHEDOR)('Preenchedor NÃO pode acessar "%s"', (aba) => {
      expect(podeAcessar('preenchedor', aba)).toBe(false)
    })

    it.each(TODAS)('perfil null não pode acessar "%s"', (aba) => {
      expect(podeAcessar(null, aba)).toBe(false)
    })

    it('é coerente com abasVisiveis para todos os perfis', () => {
      for (const perfil of PERFIS) {
        const visiveis = abasVisiveis(perfil)
        for (const aba of TODAS) {
          expect(podeAcessar(perfil, aba)).toBe(visiveis.includes(aba))
        }
      }
    })
  })
})
