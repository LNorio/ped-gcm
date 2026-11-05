import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import { EditorFaixas } from './EditorFaixas'
import type { LinhaFaixaEditavel } from './regrasFaixas'

const VAZIA: LinhaFaixaEditavel = { de: '', ate: '', aliquota: '' }

/** Envolve o editor (controlado) com estado, para os testes de digitação, inclusão e remoção. */
function EditorComEstado({ inicial, onChange }: { inicial: LinhaFaixaEditavel[]; onChange?: (linhas: LinhaFaixaEditavel[]) => void }) {
  const [linhas, setLinhas] = useState(inicial)
  return (
    <EditorFaixas
      linhas={linhas}
      onChange={(novas) => {
        setLinhas(novas)
        onChange?.(novas)
      }}
    />
  )
}

const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => screen.getByRole('textbox', { name: `${nome}, faixa ${n}` })

describe('F8.3 — EditorFaixas (linhas De/Até/Alíquota editáveis — RF-42, RF-43, RNF-03)', () => {
  it('mostra os cabeçalhos De (R$), Até (R$) e Alíquota (%) e um trio de campos por linha, com os valores recebidos', () => {
    render(
      <EditorFaixas
        linhas={[
          { de: '0', ate: '1.000,00', aliquota: '0' },
          { de: '1.000,01', ate: '2.000,00', aliquota: '1,5' },
        ]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('De (R$)')).toBeInTheDocument()
    expect(screen.getByText('Até (R$)')).toBeInTheDocument()
    expect(screen.getByText('Alíquota (%)')).toBeInTheDocument()
    expect(campo('De', 1)).toHaveValue('0')
    expect(campo('Até', 1)).toHaveValue('1.000,00')
    expect(campo('Alíquota', 2)).toHaveValue('1,5')
    expect(screen.queryByRole('textbox', { name: 'De, faixa 3' })).not.toBeInTheDocument()
  })

  it('os campos aceitam vírgula decimal (texto com inputmode="decimal")', () => {
    render(<EditorFaixas linhas={[VAZIA]} onChange={vi.fn()} />)

    for (const nome of ['De', 'Até', 'Alíquota'] as const) {
      expect(campo(nome, 1)).toHaveAttribute('inputmode', 'decimal')
      expect(campo(nome, 1)).not.toHaveAttribute('type', 'number')
    }
  })

  it('digitar atualiza só o campo da linha editada (onChange com a lista inteira)', async () => {
    const user = usuarioRapido()
    const onChange = vi.fn()
    render(<EditorComEstado inicial={[VAZIA, VAZIA]} onChange={onChange} />)

    await user.type(campo('Até', 2), '2.000,50')

    expect(campo('Até', 2)).toHaveValue('2.000,50')
    expect(onChange).toHaveBeenLastCalledWith([VAZIA, { de: '', ate: '2.000,50', aliquota: '' }])
  })

  it('"Adicionar faixa" inclui uma linha vazia no fim', async () => {
    const user = usuarioRapido()
    const onChange = vi.fn()
    render(<EditorComEstado inicial={[{ de: '0', ate: '100', aliquota: '1' }]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Adicionar faixa/ }))

    expect(campo('De', 2)).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith([{ de: '0', ate: '100', aliquota: '1' }, VAZIA])
  })

  it('"Remover faixa N" fica desabilitado quando há só uma linha', () => {
    render(<EditorFaixas linhas={[VAZIA]} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Remover faixa 1' })).toBeDisabled()
  })

  it('"Remover faixa N" retira a linha e renumera as seguintes', async () => {
    const user = usuarioRapido()
    const onChange = vi.fn()
    render(
      <EditorComEstado
        inicial={[
          { de: '0', ate: '100', aliquota: '0' },
          { de: '100,01', ate: '200', aliquota: '1' },
          { de: '200,01', ate: '300', aliquota: '2' },
        ]}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }))

    expect(onChange).toHaveBeenLastCalledWith([
      { de: '100,01', ate: '200', aliquota: '1' },
      { de: '200,01', ate: '300', aliquota: '2' },
    ])
    expect(campo('De', 1)).toHaveValue('100,01')
    expect(campo('De', 2)).toHaveValue('200,01')
    expect(screen.queryByRole('textbox', { name: 'De, faixa 3' })).not.toBeInTheDocument()
  })

  it('desabilitado: campos e botões ficam desabilitados', () => {
    render(<EditorFaixas linhas={[VAZIA, VAZIA]} onChange={vi.fn()} desabilitado />)

    expect(campo('De', 1)).toBeDisabled()
    expect(campo('Alíquota', 2)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Adicionar faixa/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remover faixa 2' })).toBeDisabled()
  })
})
