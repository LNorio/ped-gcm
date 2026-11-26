import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import { EditorFaixas } from './EditorFaixas'
import type { LinhaFaixaEditavel } from './regrasFaixas'

const LINHAS: LinhaFaixaEditavel[] = [
  { de: '0', ate: '1.000,00', aliquota: '0' },
  { de: '1.000,01', ate: '2.000,00', aliquota: '1,5' },
  { de: '2.000,01', ate: '3.000,00', aliquota: '2' },
]

function EditorComEstado({ inicial }: { inicial: LinhaFaixaEditavel[] }) {
  const [linhas, setLinhas] = useState(inicial)
  return <EditorFaixas linhas={linhas} onChange={setLinhas} />
}

const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => screen.getByRole('textbox', { name: `${nome}, faixa ${n}` })

/**
 * F12.1 (RNF-05, item A4 da revisão de acessibilidade de 24/11/2026) — foco no editor de faixas.
 *
 * O botão "Remover faixa N" é desmontado ao remover a linha e o foco caía no `<body>`. Regra:
 * - "Remover faixa N" → foco no campo "De" da linha que assume a posição N (a seguinte, renumerada); sem
 *   linha seguinte, no "De" da anterior. O campo, e não o "Remover", porque com uma única linha o
 *   "Remover faixa 1" fica desabilitado e não recebe foco;
 * - "+ Adicionar faixa" → foco no campo "De" da nova linha;
 * - o foco nunca fica no `<body>`.
 */
describe('F12.1 — EditorFaixas: foco ao remover e adicionar faixas (A4)', () => {
  it('remover a faixa 1 de 3 leva o foco ao "De" da nova faixa 1 (a antiga faixa 2)', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS} />)

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }))

    expect(campo('De', 1)).toHaveValue('1.000,01')
    expect(campo('De', 1)).toHaveFocus()
  })

  it('remover a faixa do meio leva o foco ao "De" da seguinte, renumerada', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS} />)

    await user.click(screen.getByRole('button', { name: 'Remover faixa 2' }))

    expect(campo('De', 2)).toHaveValue('2.000,01')
    expect(campo('De', 2)).toHaveFocus()
  })

  it('remover a última faixa (sem seguinte) leva o foco ao "De" da anterior', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS} />)

    await user.click(screen.getByRole('button', { name: 'Remover faixa 3' }))

    expect(screen.queryByRole('textbox', { name: 'De, faixa 3' })).not.toBeInTheDocument()
    expect(campo('De', 2)).toHaveFocus()
  })

  it('remover até sobrar uma faixa: o foco vai para o "De" da faixa 1 (o "Remover faixa 1" fica desabilitado)', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS.slice(0, 2)} />)

    await user.click(screen.getByRole('button', { name: 'Remover faixa 2' }))

    expect(screen.getByRole('button', { name: 'Remover faixa 1' })).toBeDisabled()
    expect(campo('De', 1)).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('remover pelo teclado (Enter no "Remover faixa N") também move o foco', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS} />)

    screen.getByRole('button', { name: 'Remover faixa 1' }).focus()
    await user.keyboard('{Enter}')

    expect(campo('De', 1)).toHaveFocus()
  })

  it('"+ Adicionar faixa" leva o foco ao "De" da nova linha', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS.slice(0, 1)} />)

    await user.click(screen.getByRole('button', { name: '+ Adicionar faixa' }))

    expect(campo('De', 2)).toHaveValue('')
    expect(campo('De', 2)).toHaveFocus()
  })

  it('adicionar duas faixas seguidas leva o foco sempre à última criada', async () => {
    const user = usuarioRapido()
    render(<EditorComEstado inicial={LINHAS.slice(0, 1)} />)

    await user.click(screen.getByRole('button', { name: '+ Adicionar faixa' }))
    await user.click(screen.getByRole('button', { name: '+ Adicionar faixa' }))

    expect(campo('De', 3)).toHaveFocus()
  })
})
