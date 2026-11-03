import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('RF-00 — Tela inicial', () => {
  it('exibe o cabeçalho do sistema', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'PED' })).toBeInTheDocument()
    expect(screen.getByText('Sistema de Cadastro')).toBeInTheDocument()
  })
})
