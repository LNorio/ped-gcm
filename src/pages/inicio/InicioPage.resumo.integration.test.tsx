/**
 * F11.3 — Indicadores-resumo da tela Início (integração: app completo com a rede simulada; RF-08).
 *
 * O Início mostra a lista "Indicadores-resumo" com os itens de `resumo` de `GET /api/ped/inicio`, na ordem
 * da API (a lista muda com o perfil): Admin (5), Validador (5, com "Dashboards ativos") e Preenchedor (4,
 * com "Apontamentos dos meus tipos" e sem "Dashboards ativos"). Trocar a filial do cabeçalho atualiza os
 * valores.
 *
 * A rota é carregada sob demanda: os testes esperam a lista com `findBy*` (timeout padrão do projeto).
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { simularApi } from '../../test/apiFalsa'
import { rotasDoInicio } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

describe('F11.3 — Indicadores-resumo do Início por perfil (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })

  async function abrirResumo() {
    renderizarApp('/')
    return await screen.findByRole('list', { name: 'Indicadores-resumo' })
  }

  /** Pares [rótulo, valor] de cada item, conferidos na ordem. */
  function esperarItens(lista: HTMLElement, esperados: Array<[string, string]>) {
    const itens = within(lista).getAllByRole('listitem')
    expect(itens).toHaveLength(esperados.length)
    esperados.forEach(([rotulo, valor], indice) => {
      expect(within(itens[indice]).getByText(rotulo)).toBeInTheDocument()
      expect(within(itens[indice]).getByText(valor)).toBeInTheDocument()
    })
  }

  describe('Admin', () => {
    it('com "Todas as filiais": os 5 indicadores do Admin, na ordem, com pendentes em pt-BR (1.234)', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin'))

      const lista = await abrirResumo()

      esperarItens(lista, [
        ['Apontamentos ativos', '12'],
        ['Dados externos ativos', '5'],
        ['Total de indicadores', '8'],
        ['Dados externos em construção (TI)', '2'],
        ['Lançamentos pendentes no período', '1.234'],
      ])
    })

    it('trocar a filial do cabeçalho para 101 atualiza os valores (pendentes da filial: 3)', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirResumo()
      await screen.findByText('1.234')

      await user.selectOptions(seletorFilial(), '101')

      await waitFor(() => expect(screen.queryByText('1.234')).not.toBeInTheDocument())
      const lista = await screen.findByRole('list', { name: 'Indicadores-resumo' })
      await waitFor(() =>
        expect(within(within(lista).getAllByRole('listitem')[4]).getByText('3')).toBeInTheDocument(),
      )
    })
  })

  describe('Validador', () => {
    it('os 5 indicadores do Validador, com "Dashboards ativos"', async () => {
      simularApi(fetchFalso, rotasDoInicio('validador'))

      const lista = await abrirResumo()

      esperarItens(lista, [
        ['Apontamentos ativos', '12'],
        ['Dashboards com meus apontamentos', '3'],
        ['Meus dados externos em construção (TI)', '1'],
        ['Dashboards ativos', '4'],
        ['Lançamentos pendentes no período', '9'],
      ])
    })
  })

  describe('Preenchedor', () => {
    it('os 4 indicadores do Preenchedor, com "Apontamentos dos meus tipos" e sem "Dashboards ativos"', async () => {
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))

      const lista = await abrirResumo()

      esperarItens(lista, [
        ['Apontamentos dos meus tipos', '3'],
        ['Dashboards com meus apontamentos', '1'],
        ['Meus dados externos em construção (TI)', '0'],
        ['Lançamentos pendentes no período', '1'],
      ])
      expect(within(lista).queryByText('Dashboards ativos')).not.toBeInTheDocument()
    })
  })
})
