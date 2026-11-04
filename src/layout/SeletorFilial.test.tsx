import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import type { Filial } from '../types/dominio'
import { SeletorFilial } from './SeletorFilial'

const FILIAIS: Filial[] = [
  { codigo: '100', nome: 'MATRIZ', empresa: null },
  { codigo: '101', nome: 'CAMPO GRANDE', empresa: null },
  { codigo: '102', nome: 'DOURADOS', empresa: null },
]

describe('F2.4 — Seletor de filial', () => {
  describe('acesso a todas as filiais (Admin/Validador)', () => {
    it('mostra um seletor "Filial" com "Todas as filiais" seguida de todas as filiais, no formato "código - nome"', () => {
      render(<SeletorFilial filiais={FILIAIS} todasAsFiliais valor="todas" onChange={() => {}} />)

      const seletor = screen.getByRole('combobox', { name: 'Filial' })
      expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
        'Todas as filiais',
        '100 - MATRIZ',
        '101 - CAMPO GRANDE',
        '102 - DOURADOS',
      ])
      expect(within(seletor).getByRole('option', { name: 'Todas as filiais' })).toHaveValue('todas')
      expect(within(seletor).getByRole('option', { name: '101 - CAMPO GRANDE' })).toHaveValue('101')
    })

    it('reflete o valor selecionado', () => {
      render(<SeletorFilial filiais={FILIAIS} todasAsFiliais valor="102" onChange={() => {}} />)

      expect(screen.getByRole('combobox', { name: 'Filial' })).toHaveValue('102')
    })

    it('ao escolher uma filial chama onChange com o código', async () => {
      const user = usuarioRapido()
      const onChange = vi.fn()
      render(<SeletorFilial filiais={FILIAIS} todasAsFiliais valor="todas" onChange={onChange} />)

      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '101')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('101')
    })

    it('ao escolher "Todas as filiais" chama onChange com "todas"', async () => {
      const user = usuarioRapido()
      const onChange = vi.fn()
      render(<SeletorFilial filiais={FILIAIS} todasAsFiliais valor="101" onChange={onChange} />)

      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), 'todas')

      expect(onChange).toHaveBeenCalledWith('todas')
    })
  })

  describe('acesso a uma única filial', () => {
    it('mostra a filial fixa como texto "código - nome", sem seletor', () => {
      render(<SeletorFilial filiais={[FILIAIS[1]]} todasAsFiliais={false} valor="101" onChange={() => {}} />)

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.getByText('101 - CAMPO GRANDE')).toBeInTheDocument()
    })

    it('não oferece a opção "Todas as filiais"', () => {
      render(<SeletorFilial filiais={[FILIAIS[1]]} todasAsFiliais={false} valor="101" onChange={() => {}} />)

      expect(screen.queryByText('Todas as filiais')).not.toBeInTheDocument()
    })
  })

  describe('casos-limite: lista de filiais vazia', () => {
    it('sem todas as filiais e sem nenhuma filial não renderiza nada', () => {
      const { container } = render(<SeletorFilial filiais={[]} todasAsFiliais={false} valor="" onChange={() => {}} />)

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.queryByText('Filial')).not.toBeInTheDocument()
    })

    it('com todas as filiais e lista vazia mostra o seletor "Filial" somente com "Todas as filiais"', () => {
      render(<SeletorFilial filiais={[]} todasAsFiliais valor="todas" onChange={() => {}} />)

      const seletor = screen.getByRole('combobox', { name: 'Filial' })
      expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Todas as filiais'])
      expect(seletor).toHaveValue('todas')
    })
  })

  describe('acesso a várias filiais (sem todas)', () => {
    it('mostra um seletor restrito às filiais informadas, sem "Todas as filiais"', () => {
      render(
        <SeletorFilial filiais={[FILIAIS[1], FILIAIS[2]]} todasAsFiliais={false} valor="101" onChange={() => {}} />,
      )

      const seletor = screen.getByRole('combobox', { name: 'Filial' })
      expect(within(seletor).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
        '101 - CAMPO GRANDE',
        '102 - DOURADOS',
      ])
      expect(within(seletor).queryByRole('option', { name: 'Todas as filiais' })).not.toBeInTheDocument()
      expect(seletor).toHaveValue('101')
    })

    it('ao trocar a filial chama onChange com o código escolhido', async () => {
      const user = usuarioRapido()
      const onChange = vi.fn()
      render(
        <SeletorFilial filiais={[FILIAIS[1], FILIAIS[2]]} todasAsFiliais={false} valor="101" onChange={onChange} />,
      )

      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '102')

      expect(onChange).toHaveBeenCalledWith('102')
    })
  })
})
