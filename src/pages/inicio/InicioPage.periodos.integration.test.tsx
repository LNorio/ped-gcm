/**
 * F11.4 — "Preencher apontamentos do período" e "Períodos em aberto" (integração: app completo com a rede
 * simulada; RF-09, RF-10).
 *
 * O Início mostra o link "Preencher apontamentos do período" (todos os perfis), que leva à aba Preenchimento
 * (`/preenchimento`), e a região "Períodos em aberto" com os dashboards de `"periodos em aberto"` de
 * `GET /api/ped/inicio`, na ordem da API: nome, "{Periodicidade} · período {período atual}",
 * "{X} de {Y} lançamentos" e o link "Preencher {dashboard}" para `/preenchimento`. Trocar a filial do
 * cabeçalho atualiza a lista e o progresso.
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

describe('F11.4 — Períodos em aberto e "Preencher" no Início (integração)', () => {
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
  const regiao = () => screen.getByRole('region', { name: 'Períodos em aberto' })
  const itens = () => within(regiao()).getAllByRole('listitem')

  /** Abre o Início e espera o link "Preencher" do dashboard informado. */
  async function abrirInicio(dashboard: string) {
    const resultado = renderizarApp('/')
    await screen.findByRole('link', { name: `Preencher ${dashboard}` })
    return resultado
  }

  describe('Admin', () => {
    it('com "Todas as filiais": os 3 dashboards na ordem da API, com periodicidade, período atual e progresso', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirInicio('PED Comercial')

      const [comercial, gerentes, vendedores] = itens()
      expect(itens()).toHaveLength(3)
      expect(within(comercial).getByText('PED Comercial')).toBeInTheDocument()
      expect(within(comercial).getByText('Trimestral · período 4º tri/2026')).toBeInTheDocument()
      expect(within(comercial).getByText('5 de 9 lançamentos')).toBeInTheDocument()
      expect(within(gerentes).getByText('PED Gerentes')).toBeInTheDocument()
      expect(within(gerentes).getByText('Mensal · período 10/2026')).toBeInTheDocument()
      expect(within(gerentes).getByText('1 de 4 lançamentos')).toBeInTheDocument()
      expect(within(vendedores).getByText('PED Vendedores')).toBeInTheDocument()
      expect(within(vendedores).getByText('Anual · período 2026')).toBeInTheDocument()
      expect(within(vendedores).getByText('0 de 0 lançamentos')).toBeInTheDocument()
    })

    it('trocar a filial do cabeçalho para 101 atualiza a lista e o progresso (só o PED Comercial, 2 de 3)', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirInicio('PED Gerentes')

      await user.selectOptions(seletorFilial(), '101')

      await waitFor(() => expect(screen.queryByRole('link', { name: 'Preencher PED Gerentes' })).not.toBeInTheDocument())
      await screen.findByRole('link', { name: 'Preencher PED Comercial' })
      expect(itens()).toHaveLength(1)
      expect(within(itens()[0]).getByText('2 de 3 lançamentos')).toBeInTheDocument()
    })

    it('"Preencher apontamentos do período" leva à aba Preenchimento', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('admin'))
      const { roteador } = await abrirInicio('PED Comercial')

      await user.click(screen.getByRole('link', { name: 'Preencher apontamentos do período' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/preenchimento')
    })

    it('"Preencher" de um dashboard leva à aba Preenchimento', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('admin'))
      const { roteador } = await abrirInicio('PED Gerentes')

      await user.click(screen.getByRole('link', { name: 'Preencher PED Gerentes' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/preenchimento')
    })
  })

  describe('Validador', () => {
    it('os dashboards visíveis ao Validador e o link "Preencher apontamentos do período"', async () => {
      simularApi(fetchFalso, rotasDoInicio('validador'))
      await abrirInicio('PED Comercial')

      expect(itens()).toHaveLength(2)
      expect(within(itens()[0]).getByRole('link', { name: 'Preencher PED Comercial' })).toBeInTheDocument()
      expect(within(itens()[1]).getByRole('link', { name: 'Preencher PED Gerentes' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Preencher apontamentos do período' })).toHaveAttribute('href', '/preenchimento')
    })
  })

  describe('Preenchedor', () => {
    it('só os dashboards com apontamentos dos seus tipos, com o progresso desses tipos (PED Comercial, 2 de 3)', async () => {
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))
      await abrirInicio('PED Comercial')

      expect(itens()).toHaveLength(1)
      expect(within(itens()[0]).getByText('Trimestral · período 4º tri/2026')).toBeInTheDocument()
      expect(within(itens()[0]).getByText('2 de 3 lançamentos')).toBeInTheDocument()
    })

    it('"Preencher" leva à aba Preenchimento', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))
      const { roteador } = await abrirInicio('PED Comercial')

      await user.click(screen.getByRole('link', { name: 'Preencher PED Comercial' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/preenchimento')
    })

    it('"Preencher apontamentos do período" também aparece para o Preenchedor e leva à aba Preenchimento', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicio('preenchedor'))
      const { roteador } = await abrirInicio('PED Comercial')

      await user.click(screen.getByRole('link', { name: 'Preencher apontamentos do período' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/preenchimento')
    })
  })
})
