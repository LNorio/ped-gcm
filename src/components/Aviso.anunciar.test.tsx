import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Aviso } from './Aviso'

/**
 * F12.1 (RNF-05, item M9 da revisão de acessibilidade de 24/11/2026) — `Aviso` com a prop opcional
 * `anunciar` (`boolean`, padrão `false`): o aviso que aparece dinamicamente (ex.: `tipo="alerta"` depois de
 * uma ação) usa `role="status"` para ser anunciado por leitores de tela. Sem `anunciar`, nada muda: os
 * tipos `info`, `alerta` e `sucesso` continuam `role="note"` e `erro` continua `role="alert"`
 * (`Aviso.test.tsx`, F1.6).
 */
describe('F12.1 — Aviso: prop anunciar (M9)', () => {
  it('tipo "alerta" com anunciar usa role="status", com o título e o conteúdo', () => {
    render(
      <Aviso tipo="alerta" titulo="Atenção" anunciar>
        Há filiais sem tabela de faixas.
      </Aviso>,
    )

    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent('Atenção')
    expect(aviso).toHaveTextContent('Há filiais sem tabela de faixas.')
    expect(aviso).toHaveClass('aviso', 'aviso--alerta')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it.each(['info', 'sucesso'] as const)('tipo "%s" com anunciar também usa role="status"', (tipo) => {
    render(
      <Aviso tipo={tipo} anunciar>
        Texto
      </Aviso>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Texto')
  })

  it('sem anunciar, o tipo "alerta" continua role="note" (padrão)', () => {
    render(<Aviso tipo="alerta">Texto do alerta</Aviso>)

    expect(screen.getByRole('note')).toHaveTextContent('Texto do alerta')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('anunciar={false} é o mesmo que omitir (role="note")', () => {
    render(
      <Aviso tipo="alerta" anunciar={false}>
        Texto do alerta
      </Aviso>,
    )

    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('tipo "erro" continua role="alert" mesmo com anunciar (já é anunciado imediatamente)', () => {
    render(
      <Aviso tipo="erro" anunciar>
        Falha ao salvar.
      </Aviso>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
