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

  describe('sufixo', () => {
    const botaoOlho = (
      <button type="button" aria-label="Mostrar senha">
        olho
      </button>
    )

    it('renderiza o conteúdo do sufixo no mesmo contêiner do input, logo após ele', () => {
      render(<Campo rotulo="Senha" type="password" sufixo={botaoOlho} />)

      const input = screen.getByLabelText('Senha')
      const botao = screen.getByRole('button', { name: 'Mostrar senha' })
      expect(input.parentElement).toContainElement(botao)
      expect(input.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('não repassa "sufixo" como atributo do input', () => {
      render(<Campo rotulo="Senha" sufixo={botaoOlho} />)

      expect(screen.getByLabelText('Senha')).not.toHaveAttribute('sufixo')
    })

    it('mantém o rótulo associado ao input e o sufixo fora do rótulo', () => {
      render(<Campo rotulo="Senha" sufixo={botaoOlho} />)

      const input = screen.getByLabelText('Senha')
      expect(input.tagName).toBe('INPUT')
      expect(screen.getByText('Senha').tagName).toBe('LABEL')
      expect(screen.getByText('Senha')).not.toContainElement(screen.getByRole('button', { name: 'Mostrar senha' }))
    })

    it('não altera aria-describedby: sem erro e dica, o input continua sem descrição', () => {
      render(<Campo rotulo="Senha" sufixo={botaoOlho} />)

      expect(screen.getByLabelText('Senha')).not.toHaveAttribute('aria-describedby')
    })

    it('com erro e dica, a descrição acessível continua sendo apenas erro e dica (sem o sufixo)', () => {
      render(<Campo rotulo="Senha" erro="Informe a senha" dica="Mínimo de 6 caracteres" sufixo={botaoOlho} />)

      const input = screen.getByLabelText('Senha')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription('Informe a senha Mínimo de 6 caracteres')
      expect(screen.getByRole('alert')).toHaveTextContent('Informe a senha')
      expect(screen.getByRole('alert')).not.toContainElement(screen.getByRole('button', { name: 'Mostrar senha' }))
    })

    it('o sufixo é interativo: clicar nele não altera o valor do input', async () => {
      const user = userEvent.setup()
      const aoClicar = vi.fn()
      render(
        <Campo
          rotulo="Senha"
          defaultValue="segredo"
          sufixo={
            <button type="button" aria-label="Mostrar senha" onClick={aoClicar}>
              olho
            </button>
          }
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))

      expect(aoClicar).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Senha')).toHaveValue('segredo')
    })

    it('sem sufixo, nada além do input é renderizado como controle', () => {
      render(<Campo rotulo="Senha" />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
