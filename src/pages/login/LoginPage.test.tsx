import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { SessaoContexto, type Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { sessaoFalsa } from '../../test/sessaoFalsa'
import { LoginPage } from './LoginPage'

/** Emula o contrato do provider: ao falhar, `entrar` expõe a mensagem em `erro` e rejeita. */
function ProvedorComErro({ entrar, children }: { entrar: Sessao['entrar']; children: ReactNode }) {
  const [erro, setErro] = useState<string | null>(null)
  const sessao = sessaoFalsa({
    estado: 'anonimo',
    acesso: null,
    erro,
    entrar: async (usuario, senha) => {
      try {
        await entrar(usuario, senha)
        setErro(null)
      } catch (falha) {
        setErro(falha instanceof ApiError ? falha.mensagem : 'Erro desconhecido')
        throw falha
      }
    },
  })
  return <SessaoContexto.Provider value={sessao}>{children}</SessaoContexto.Provider>
}

function Telas() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<h1>Página inicial</h1>} />
    </Routes>
  )
}

function renderizar(sessao: Partial<Sessao> = {}) {
  return render(
    <ProvedorSessaoFalso sessao={{ estado: 'anonimo', acesso: null, ...sessao }}>
      <MemoryRouter initialEntries={['/login']}>
        <Telas />
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

describe('F2.2 — Tela de login', () => {
  describe('conteúdo do protótipo', () => {
    it('mostra a marca "Comercial Mariano", a etiqueta "PED", o título e o subtítulo', () => {
      renderizar()

      expect(screen.getByRole('img', { name: 'Comercial Mariano' })).toBeInTheDocument()
      expect(screen.getByText('PED')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.getByText('Cadastro, preenchimento e fechamento')).toBeInTheDocument()
    })

    it('tem os campos "Usuário" (placeholder "Seu login") e "Senha" (placeholder "Sua senha", tipo password)', () => {
      renderizar()

      const usuario = screen.getByLabelText('Usuário')
      expect(usuario).toHaveAttribute('placeholder', 'Seu login')
      expect(usuario).toHaveAttribute('type', 'text')

      const senha = screen.getByLabelText('Senha')
      expect(senha).toHaveAttribute('placeholder', 'Sua senha')
      expect(senha).toHaveAttribute('type', 'password')
    })

    it('tem o botão "Entrar" que envia o formulário', () => {
      renderizar()

      const botao = screen.getByRole('button', { name: 'Entrar' })
      expect(botao).toHaveAttribute('type', 'submit')
      expect(botao).toBeEnabled()
    })

    it('mostra o rodapé institucional', () => {
      renderizar()

      expect(screen.getByRole('contentinfo')).toHaveTextContent(
        'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
      )
    })
  })

  describe('mostrar/ocultar senha', () => {
    it('o botão "Mostrar senha" troca o campo para texto e passa a se chamar "Ocultar senha"', async () => {
      const user = userEvent.setup()
      renderizar()

      await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))

      expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mostrar senha' })).not.toBeInTheDocument()
    })

    it('o botão "Ocultar senha" volta o campo para password', async () => {
      const user = userEvent.setup()
      renderizar()

      await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
      await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))

      expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
      expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument()
    })

    it('mostrar a senha não envia o formulário', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn().mockResolvedValue(undefined)
      renderizar({ entrar })

      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))

      expect(entrar).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Senha')).toHaveValue('segredo')
    })
  })

  describe('envio', () => {
    it('chama entrar(usuario, senha) com o que foi digitado', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn().mockResolvedValue(undefined)
      renderizar({ entrar })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(entrar).toHaveBeenCalledTimes(1)
      expect(entrar).toHaveBeenCalledWith('fulano', 'segredo')
    })

    it('Enter no campo de senha envia o formulário', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn().mockResolvedValue(undefined)
      renderizar({ entrar })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo{Enter}')

      expect(entrar).toHaveBeenCalledWith('fulano', 'segredo')
    })

    it('desabilita o botão "Entrar" enquanto o login está em andamento', async () => {
      const user = userEvent.setup()
      let concluir: () => void = () => {}
      const entrar = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            concluir = resolve
          }),
      )
      renderizar({ entrar })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()

      concluir()
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Página inicial' })).toBeInTheDocument())
    })

    it('não envia duas vezes com cliques repetidos durante o envio', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn(() => new Promise<void>(() => {}))
      renderizar({ entrar })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(entrar).toHaveBeenCalledTimes(1)
    })

    it('com sucesso navega para "/"', async () => {
      const user = userEvent.setup()
      renderizar({ entrar: vi.fn().mockResolvedValue(undefined) })

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(await screen.findByRole('heading', { name: 'Página inicial' })).toBeInTheDocument()
    })
  })

  describe('erros', () => {
    it('exibe a mensagem de erro da sessão como alerta junto ao formulário', () => {
      renderizar({ erro: 'Usuário ou senha inválidos.' })

      expect(screen.getByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.')
    })

    it('sem erro, não há alerta na tela', () => {
      renderizar({ erro: null })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('com credenciais inválidas mostra a mensagem da API, permanece no login e reabilita o botão', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn().mockRejectedValue(new ApiError(401, 'Usuário ou senha inválidos.'))
      render(
        <ProvedorComErro entrar={entrar}>
          <MemoryRouter initialEntries={['/login']}>
            <Telas />
          </MemoryRouter>
        </ProvedorComErro>,
      )

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'errada')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.')
      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Página inicial' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    })

    it('mantém o usuário digitado após o erro', async () => {
      const user = userEvent.setup()
      const entrar = vi.fn().mockRejectedValue(new ApiError(401, 'Usuário ou senha inválidos.'))
      render(
        <ProvedorComErro entrar={entrar}>
          <MemoryRouter initialEntries={['/login']}>
            <Telas />
          </MemoryRouter>
        </ProvedorComErro>,
      )

      await user.type(screen.getByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'errada')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      await screen.findByRole('alert')

      expect(screen.getByLabelText('Usuário')).toHaveValue('fulano')
    })
  })
})
