import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EstadoCarga, type EstadoCargaProps } from './EstadoCarga'

describe('F1.13 — EstadoCarga (carregando / erro de carga com "Tentar novamente")', () => {
  function renderizar(props: Partial<EstadoCargaProps> = {}) {
    const onTentarNovamente = props.onTentarNovamente ?? vi.fn()
    const utils = render(
      <EstadoCarga
        carregando={props.carregando ?? false}
        mensagemCarregando={props.mensagemCarregando ?? 'Carregando apontamentos...'}
        erro={props.erro ?? null}
        onTentarNovamente={onTentarNovamente}
      />,
    )
    return { ...utils, onTentarNovamente }
  }

  it('carregando sem erro: anuncia a mensagem em uma região de status (RegiaoStatus) e não mostra alerta nem botão', () => {
    renderizar({ carregando: true })

    const mensagem = screen.getByText('Carregando apontamentos...')
    const regiao = mensagem.closest('[role="status"]')
    expect(regiao).not.toBeNull()
    expect(regiao).toHaveClass('regiao-status')
    expect(regiao).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('usa a mensagem recebida em mensagemCarregando', () => {
    renderizar({ carregando: true, mensagemCarregando: 'Carregando tipos...' })

    expect(screen.getByText('Carregando tipos...').closest('[role="status"]')).not.toBeNull()
  })

  it('sem carga e sem erro: a região de status continua no DOM, vazia, e não há alerta nem botão', () => {
    renderizar()

    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByText('Carregando apontamentos...')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('com erro: mostra a mensagem em um Aviso de erro (role alert) e o botão "Tentar novamente" habilitado', () => {
    renderizar({ erro: 'Falha ao consultar os apontamentos.' })

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Falha ao consultar os apontamentos.')
    expect(alerta).toHaveClass('aviso', 'aviso--erro')
    const botao = screen.getByRole('button', { name: 'Tentar novamente' })
    expect(botao).toBeEnabled()
    expect(botao).toHaveClass('botao', 'botao--contorno')
    expect(botao).toHaveAttribute('type', 'button')
  })

  it('"Tentar novamente" chama onTentarNovamente uma vez por clique', async () => {
    const user = userEvent.setup()
    const { onTentarNovamente } = renderizar({ erro: 'Falha temporária.' })

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(onTentarNovamente).toHaveBeenCalledTimes(1)
  })

  it('com erro durante uma nova carga: mantém o alerta, desabilita "Tentar novamente" e anuncia a carga', async () => {
    const user = userEvent.setup()
    const { onTentarNovamente } = renderizar({ erro: 'Falha temporária.', carregando: true })

    expect(screen.getByRole('alert')).toHaveTextContent('Falha temporária.')
    const botao = screen.getByRole('button', { name: 'Tentar novamente' })
    expect(botao).toBeDisabled()
    expect(screen.getByText('Carregando apontamentos...').closest('[role="status"]')).not.toBeNull()

    await user.click(botao)
    expect(onTentarNovamente).not.toHaveBeenCalled()
  })

  it('ao sair do erro (erro null), o alerta e o botão desaparecem', () => {
    const { rerender } = renderizar({ erro: 'Falha temporária.' })

    rerender(<EstadoCarga carregando={false} mensagemCarregando="Carregando apontamentos..." erro={null} onTentarNovamente={() => {}} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })
})
