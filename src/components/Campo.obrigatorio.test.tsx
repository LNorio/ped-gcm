import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { AreaTexto } from './AreaTexto'
import { Campo } from './Campo'
import { Select } from './Select'

const OPCOES = [
  { valor: '1', rotulo: 'Comercial' },
  { valor: '2', rotulo: 'Financeiro' },
]

interface CasoControle {
  componente: string
  papel: 'textbox' | 'combobox'
  renderizar: (obrigatorio?: boolean) => ReactElement
}

const CASOS: CasoControle[] = [
  {
    componente: 'Campo',
    papel: 'textbox',
    renderizar: (obrigatorio) => <Campo rotulo="Nome" obrigatorio={obrigatorio} />,
  },
  {
    componente: 'Select',
    papel: 'combobox',
    renderizar: (obrigatorio) => <Select rotulo="Nome" opcoes={OPCOES} placeholder="Selecione" obrigatorio={obrigatorio} />,
  },
  {
    componente: 'AreaTexto',
    papel: 'textbox',
    renderizar: (obrigatorio) => <AreaTexto rotulo="Nome" obrigatorio={obrigatorio} />,
  },
]

describe('F1.13 — Campos obrigatórios (Campo, Select e AreaTexto com obrigatorio)', () => {
  // A prop `obrigatorio` não pode chegar ao elemento nativo: o React avisaria (uma única vez por
  // arquivo) "Received `true` for a non-boolean attribute". Por isso o console é vigiado em todos os testes.
  let consoleErro: MockInstance<typeof console.error>

  beforeEach(() => {
    consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(consoleErro).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  describe.each(CASOS)('$componente', ({ papel, renderizar }) => {
    it('obrigatorio → aria-required="true" no controle', () => {
      render(renderizar(true))

      expect(screen.getByRole(papel, { name: 'Nome' })).toHaveAttribute('aria-required', 'true')
    })

    it('obrigatorio → marca visual " *" no rótulo, com aria-hidden e classe campo__obrigatorio', () => {
      const { container } = render(renderizar(true))

      const rotulo = container.querySelector('label')!
      const marca = rotulo.querySelector('.campo__obrigatorio')
      expect(marca).not.toBeNull()
      expect(marca).toHaveAttribute('aria-hidden', 'true')
      expect(marca!.textContent?.trim()).toBe('*')
      expect(rotulo.textContent).toBe(`Nome${marca!.textContent}`)
    })

    it('a marca não muda o nome acessível do controle (continua exatamente o rótulo)', () => {
      render(renderizar(true))

      const controle = screen.getByRole(papel, { name: 'Nome' })
      expect(screen.getByLabelText('Nome')).toBe(controle)
    })

    it('sem obrigatorio: sem aria-required e sem marca no rótulo', () => {
      const { container } = render(renderizar())

      expect(screen.getByRole(papel, { name: 'Nome' })).not.toHaveAttribute('aria-required')
      expect(container.querySelector('.campo__obrigatorio')).toBeNull()
    })

    it('obrigatorio={false} equivale a não informar', () => {
      const { container } = render(renderizar(false))

      expect(screen.getByRole(papel, { name: 'Nome' })).not.toHaveAttribute('aria-required')
      expect(container.querySelector('.campo__obrigatorio')).toBeNull()
    })

    it('a prop obrigatorio não vaza para o DOM como atributo nem gera aviso do React', () => {
      render(renderizar(true))

      expect(screen.getByRole(papel, { name: 'Nome' })).not.toHaveAttribute('obrigatorio')
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  it('Campo com obrigatorio e erro mantém aria-invalid e aria-required juntos', () => {
    render(<Campo rotulo="Nome" obrigatorio erro="Informe o nome." />)

    const campo = screen.getByRole('textbox', { name: 'Nome' })
    expect(campo).toHaveAttribute('aria-required', 'true')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription('Informe o nome.')
  })
})
