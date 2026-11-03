import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../test/apiFalsa'
import { renderizarApp } from '../test/renderizarApp'

const ABAS_RESTRITAS = [
  ['/tipos', 'Tipos'],
  ['/indicadores', 'Indicadores'],
  ['/faixas', 'Faixas'],
  ['/dashboards', 'Dashboards'],
  ['/fechamentos', 'Fechamentos'],
] as const

describe('F2.6 — Permissões por perfil (integração: abas e rotas)', () => {
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

  function simularPerfil(perfil: 'admin' | 'validador' | 'preenchedor') {
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(
          acessoApi({
            perfil,
            'todas as filiais': perfil !== 'preenchedor',
            filiais: perfil === 'preenchedor' ? [FILIAIS_API[1]] : FILIAIS_API,
          }),
        ),
    })
  }

  it('Preenchedor não vê as abas Tipos, Indicadores, Faixas, Dashboards e Fechamentos', async () => {
    simularPerfil('preenchedor')

    renderizarApp('/')

    await screen.findByRole('heading', { level: 1, name: 'Início' })
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Início',
      'Apontamentos',
      'Dados Externos',
      'Preenchimento',
    ])
    for (const [, rotulo] of ABAS_RESTRITAS) {
      expect(within(abas).queryByRole('link', { name: rotulo })).not.toBeInTheDocument()
    }
  })

  it.each(ABAS_RESTRITAS)('Preenchedor acessando %s diretamente é redirecionado para o Início', async (caminho, titulo) => {
    simularPerfil('preenchedor')

    renderizarApp(caminho)

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: titulo })).not.toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
  })

  it('Preenchedor navegando para uma aba proibida depois de logado também volta ao Início', async () => {
    simularPerfil('preenchedor')
    const { roteador } = renderizarApp('/apontamentos')
    await screen.findByRole('heading', { level: 1, name: 'Apontamentos' })

    await act(async () => {
      await roteador.navigate('/fechamentos')
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Fechamentos' })).not.toBeInTheDocument()
  })

  it.each([
    ['/apontamentos', 'Apontamentos'],
    ['/dados-externos', 'Dados Externos'],
    ['/preenchimento', 'Preenchimento'],
  ])('Preenchedor acessa %s normalmente', async (caminho, titulo) => {
    simularPerfil('preenchedor')

    renderizarApp(caminho)

    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })

  it.each(ABAS_RESTRITAS)('Validador acessa %s ("%s") normalmente', async (caminho, titulo) => {
    simularPerfil('validador')

    renderizarApp(caminho)

    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })

  it('Admin vê as nove abas', async () => {
    simularPerfil('admin')

    renderizarApp('/')

    await screen.findByRole('heading', { level: 1, name: 'Início' })
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getAllByRole('link')).toHaveLength(9)
  })
})
