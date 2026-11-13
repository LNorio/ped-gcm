/**
 * F11.5 — "Últimas alterações em apontamentos" da tela Início (integração: app completo com a rede
 * simulada; RF-11).
 *
 * O Início mostra a região "Últimas alterações em apontamentos" com as alterações de `"ultimas alteracoes"`
 * de `GET /api/ped/inicio` (as 6 mais recentes, na ordem da API): ação, apontamento, "Competência
 * {MM/AAAA} · Filial {código} · {anterior} → {novo}" e "{dd/mm/aaaa hh:mm} · {usuário}". Valem as
 * filiais da tela (trocar a filial do cabeçalho atualiza a lista); o Preenchedor vê só os dos seus tipos
 * (filtrado pela API). Sem alterações: "Nenhum lançamento registrado ainda.".
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

const TITULO = 'Últimas alterações em apontamentos'

describe('F11.5 — Últimas alterações em apontamentos no Início (integração)', () => {
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
  const regiao = () => screen.getByRole('region', { name: TITULO })
  const itens = () => within(regiao()).getAllByRole('listitem')

  describe('Admin', () => {
    it('com "Todas as filiais": as 6 alterações mais recentes, na ordem da API, com todos os campos', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin'))
      renderizarApp('/')

      await screen.findByText('Treinamentos realizados')

      expect(itens()).toHaveLength(6)
      const [correcao, lancamento, booleano] = itens()
      expect(within(correcao).getByText('Correção')).toBeInTheDocument()
      expect(within(correcao).getByText('Cobertura de clientes')).toBeInTheDocument()
      expect(within(correcao).getByText('Competência 10/2026 · Filial 101 · 5,00 → 6,50')).toBeInTheDocument()
      expect(within(correcao).getByText('12/11/2026 14:30 · Ana Costa')).toBeInTheDocument()
      expect(within(lancamento).getByText('Lançamento')).toBeInTheDocument()
      expect(within(lancamento).getByText('Faturamento líquido')).toBeInTheDocument()
      expect(within(lancamento).getByText('Competência 10/2026 · Filial 100 · 451.590,62')).toBeInTheDocument()
      expect(within(lancamento).getByText('12/11/2026 10:05 · Bruno Lima')).toBeInTheDocument()
      expect(within(booleano).getByText('Competência 10/2026 · Filial 102 · Não → Sim')).toBeInTheDocument()
      expect(within(itens()[5]).getByText('Competência 09/2026 · Filial 100 · 4,00')).toBeInTheDocument()
    })

    it('trocar a filial do cabeçalho para 101 mostra só as alterações da filial', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('admin'))
      renderizarApp('/')
      await screen.findByText('Treinamentos realizados')

      await user.selectOptions(seletorFilial(), '101')

      await waitFor(() => expect(screen.queryByText('Treinamentos realizados')).not.toBeInTheDocument())
      await screen.findByText('Ruptura de gôndola')
      expect(itens()).toHaveLength(2)
      expect(within(itens()[0]).getByText('Cobertura de clientes')).toBeInTheDocument()
      expect(within(itens()[1]).getByText('Competência 10/2026 · Filial 101 · 3,00')).toBeInTheDocument()
    })
  })

  describe('Validador', () => {
    it('mostra as alterações devolvidas para o Validador', async () => {
      simularApi(fetchFalso, rotasDoInicio('validador'))
      renderizarApp('/')

      await screen.findByText('Loja auditada')

      expect(itens()).toHaveLength(1)
      expect(within(itens()[0]).getByText('Correção')).toBeInTheDocument()
      expect(within(itens()[0]).getByText('11/11/2026 17:45 · Carla Dias')).toBeInTheDocument()
    })
  })

  describe('Preenchedor', () => {
    it('sem alterações dos seus tipos: "Nenhum lançamento registrado ainda."', async () => {
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))
      renderizarApp('/')

      expect(await screen.findByText('Nenhum lançamento registrado ainda.')).toBeInTheDocument()
      expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
    })
  })
})
