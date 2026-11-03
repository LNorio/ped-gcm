import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Campo } from './Campo'

describe('F1.6 — Componentes base: Campo', () => {
  it('associa o rótulo ao input (acessível por getByLabelText)', () => {
    render(<Campo rotulo="Nome" />)

    const input = screen.getByLabelText('Nome')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('repassa atributos nativos ao input (type, placeholder, required, value, name)', () => {
    render(<Campo rotulo="Senha" type="password" placeholder="Sua senha" required name="senha" defaultValue="" />)

    const input = screen.getByLabelText(/Senha/)
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('placeholder', 'Sua senha')
    expect(input).toBeRequired()
    expect(input).toHaveAttribute('name', 'senha')
  })

  it('usa o id informado para ligar label e input', () => {
    render(<Campo id="campo-nome" rotulo="Nome" />)

    expect(screen.getByLabelText('Nome')).toHaveAttribute('id', 'campo-nome')
  })

  it('gera um id quando não informado, sem colidir entre dois campos', () => {
    render(
      <>
        <Campo rotulo="Nome" />
        <Campo rotulo="Descrição" />
      </>,
    )

    const nome = screen.getByLabelText('Nome')
    const descricao = screen.getByLabelText('Descrição')
    expect(nome).toHaveAttribute('id')
    expect(descricao).toHaveAttribute('id')
    expect(nome.getAttribute('id')).not.toBe(descricao.getAttribute('id'))
  })

  it('chama onChange ao digitar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Campo rotulo="Nome" onChange={onChange} />)

    await user.type(screen.getByLabelText('Nome'), 'Visitas')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('Nome')).toHaveValue('Visitas')
  })

  it('não mostra erro nem marca inválido quando não há erro', () => {
    render(<Campo rotulo="Nome" />)

    const input = screen.getByLabelText('Nome')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('exibe a mensagem de erro junto ao campo, marca aria-invalid e a usa como descrição acessível', () => {
    render(<Campo rotulo="Nome" erro="Informe o nome" />)

    const input = screen.getByLabelText('Nome')
    expect(screen.getByText('Informe o nome')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Informe o nome')
  })

  it('exibe a dica como descrição acessível quando informada', () => {
    render(<Campo rotulo="Identificador" dica="Letras, números, _, - e ." />)

    expect(screen.getByLabelText('Identificador')).toHaveAccessibleDescription('Letras, números, _, - e .')
  })

  it('com erro e dica ao mesmo tempo, a descrição acessível contém os dois textos', () => {
    render(<Campo rotulo="Identificador" erro="Informe o identificador" dica="Letras, números, _, - e ." />)

    const input = screen.getByLabelText('Identificador')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/Informe o identificador/)
    expect(input).toHaveAccessibleDescription(/Letras, números, _, - e \./)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o identificador')
    expect(screen.getByText('Letras, números, _, - e .')).toBeInTheDocument()
  })

  it('pode ser desabilitado', () => {
    render(<Campo rotulo="Nome" disabled />)

    expect(screen.getByLabelText('Nome')).toBeDisabled()
  })
})
