import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const opcoesTipoValor = [
  { valor: 'porcentagem', rotulo: 'Porcentagem' },
  { valor: 'numeral', rotulo: 'Numeral' },
  { valor: 'booleano', rotulo: 'Booleano' },
]

describe('F1.6 — Componentes base: Select', () => {
  it('associa o rótulo ao select (combobox)', () => {
    render(<Select rotulo="Tipo de valor" opcoes={opcoesTipoValor} defaultValue="numeral" />)

    const select = screen.getByLabelText('Tipo de valor')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('combobox', { name: 'Tipo de valor' })).toBe(select)
  })

  it('renderiza uma option por item com valor e rótulo', () => {
    render(<Select rotulo="Tipo de valor" opcoes={opcoesTipoValor} defaultValue="numeral" />)

    const select = screen.getByRole('combobox', { name: 'Tipo de valor' })
    const opcoes = within(select).getAllByRole('option')
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Porcentagem', 'Numeral', 'Booleano'])
    expect(opcoes.map((opcao) => (opcao as HTMLOptionElement).value)).toEqual(['porcentagem', 'numeral', 'booleano'])
  })

  it('exibe o placeholder como primeira opção desabilitada com valor vazio', () => {
    render(<Select rotulo="Tipo" opcoes={opcoesTipoValor} placeholder="Selecione" defaultValue="" />)

    const select = screen.getByRole('combobox', { name: 'Tipo' })
    const primeira = within(select).getAllByRole('option')[0] as HTMLOptionElement
    expect(primeira).toHaveTextContent('Selecione')
    expect(primeira.value).toBe('')
    expect(primeira).toBeDisabled()
    expect(select).toHaveValue('')
  })

  it('sem placeholder, não acrescenta opção vazia: só as opções informadas', () => {
    render(<Select rotulo="Tipo" opcoes={opcoesTipoValor} defaultValue="numeral" />)

    const select = screen.getByRole('combobox', { name: 'Tipo' })
    const opcoes = within(select).getAllByRole('option') as HTMLOptionElement[]
    expect(opcoes).toHaveLength(3)
    expect(opcoes.some((opcao) => opcao.value === '')).toBe(false)
  })

  it('chama onChange e atualiza o valor ao escolher uma opção', async () => {
    const user = usuarioRapido()
    const onChange = vi.fn()
    render(<Select rotulo="Tipo de valor" opcoes={opcoesTipoValor} defaultValue="numeral" onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de valor' }), 'booleano')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('combobox', { name: 'Tipo de valor' })).toHaveValue('booleano')
  })

  it('exibe a mensagem de erro e marca aria-invalid', () => {
    render(<Select rotulo="Tipo" opcoes={opcoesTipoValor} erro="Selecione o tipo" defaultValue="numeral" />)

    const select = screen.getByRole('combobox', { name: 'Tipo' })
    expect(screen.getByText('Selecione o tipo')).toBeInTheDocument()
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Selecione o tipo')
  })

  it('opções podem ser desabilitadas individualmente', () => {
    render(
      <Select
        rotulo="Tipo"
        opcoes={[...opcoesTipoValor, { valor: 'x', rotulo: 'Indisponível', desabilitado: true }]}
        defaultValue="numeral"
      />,
    )

    expect(screen.getByRole('option', { name: 'Indisponível' })).toBeDisabled()
  })

  it('pode ser desabilitado', () => {
    render(<Select rotulo="Tipo" opcoes={opcoesTipoValor} disabled defaultValue="numeral" />)

    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeDisabled()
  })
})
