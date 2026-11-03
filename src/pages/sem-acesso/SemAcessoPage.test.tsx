import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { acessoFalso } from '../../test/sessaoFalsa'
import { SemAcessoPage } from './SemAcessoPage'

const MENSAGEM = 'Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'

function renderizar(sessao: Partial<Sessao> = {}) {
  return render(
    <ProvedorSessaoFalso
      sessao={{ estado: 'sem-acesso', acesso: acessoFalso({ perfil: null, tipos: [], filiais: [] }), ...sessao }}
    >
      <MemoryRouter initialEntries={['/sem-acesso']}>
        <Routes>
          <Route path="/sem-acesso" element={<SemAcessoPage />} />
          <Route path="/login" element={<h1>Página de login</h1>} />
        </Routes>
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

describe('F2.8 — Tela de usuário sem acesso', () => {
  it('mostra a mensagem exata de usuário sem acesso', () => {
    renderizar()

    expect(screen.getByText(MENSAGEM)).toBeInTheDocument()
  })

  it('oferece a ação "Voltar ao login"', () => {
    renderizar()

    expect(screen.getByRole('button', { name: 'Voltar ao login' })).toBeInTheDocument()
  })

  it('"Voltar ao login" encerra a sessão (sair) e navega para /login', async () => {
    const user = userEvent.setup()
    const sair = vi.fn()
    renderizar({ sair })

    await user.click(screen.getByRole('button', { name: 'Voltar ao login' }))

    expect(sair).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Página de login' })).toBeInTheDocument()
  })

  it('não mostra abas nem o cabeçalho do sistema', () => {
    renderizar()

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('mostra o rodapé institucional', () => {
    renderizar()

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
    )
  })
})
