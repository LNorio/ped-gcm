import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESSAO_EXPIRADA, apiFetch } from '../services/api'
import { limparToken, obterToken } from '../services/sessao'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { renderizarApp } from '../test/renderizarApp'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F2.5 — Sair e sessão expirada (integração)', () => {
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

  function simularSessaoValida(rotasExtras: Parameters<typeof simularApi>[1] = {}) {
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      ...rotasExtras,
    })
  }

  describe('Sair', () => {
    it('encerra a sessão (token e estado) e volta ao login, sem mensagem de erro', async () => {
      const user = userEvent.setup()
      simularSessaoValida()
      renderizarApp('/tipos')
      await screen.findByRole('heading', { level: 1, name: 'Tipos' })

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('depois de sair, abrir uma aba continua exigindo login', async () => {
      const user = userEvent.setup()
      simularSessaoValida()
      const { roteador } = renderizarApp('/')
      await screen.findByRole('heading', { level: 1, name: 'Início' })

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))
      await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })

      await act(async () => {
        await roteador.navigate('/apontamentos')
      })

      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Apontamentos' })).not.toBeInTheDocument()
    })

    it('depois de sair, um novo login entra normalmente', async () => {
      const user = userEvent.setup()
      simularSessaoValida({
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-novo' }),
      })
      renderizarApp('/')
      await screen.findByRole('heading', { level: 1, name: 'Início' })

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))
      await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(obterToken()).toBe('token-novo')
    })
  })

  describe('sessão expirada (401)', () => {
    it('um 401 em chamada autenticada leva ao login com o aviso "Sua sessão expirou. Entre novamente." e limpa o token', async () => {
      simularSessaoValida({
        'GET /api/ped/tipos-apontamento': () => respostaErro(401),
      })
      renderizarApp('/tipos')
      await screen.findByRole('heading', { level: 1, name: 'Tipos' })

      await act(async () => {
        await apiFetch('/ped/tipos-apontamento').catch(() => {})
      })

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('o evento "sessao-expirada" disparado durante a sessão também leva ao login com o aviso', async () => {
      simularSessaoValida()
      renderizarApp('/')
      await screen.findByRole('heading', { level: 1, name: 'Início' })

      act(() => {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
      })

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    })

    it('após a sessão expirar, entrar de novo abre o Início e remove o aviso', async () => {
      const user = userEvent.setup()
      simularSessaoValida({
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-novo' }),
      })
      renderizarApp('/')
      await screen.findByRole('heading', { level: 1, name: 'Início' })

      act(() => {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
      })
      await screen.findByRole('alert')

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
