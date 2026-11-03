import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { limparToken } from './services/sessao'

describe('RF-00 — Tela inicial', () => {
  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    window.history.replaceState(null, '', '/')
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem sessão, abre na tela de login do PED', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText('Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano')).toBeInTheDocument()
  })

  it('não mostra mais o cabeçalho antigo "PED / Sistema de Cadastro"', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })
    expect(screen.queryByText('Sistema de Cadastro')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'PED' })).not.toBeInTheDocument()
  })

  it('sem sessão, não chama a API ao abrir', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
