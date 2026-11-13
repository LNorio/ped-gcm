import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TipoValor } from '../../types/dominio'
import { usuarioRapido } from '../../test/usuario'
import { CampoValorApontamento, type CampoValorApontamentoProps } from './CampoValorApontamento'

/**
 * Campo do valor de um apontamento (F9.6 — RF-66, RNF-03). Controlado: recebe o texto em `valor` e
 * avisa cada mudança em `onChange(texto)`.
 * - Numeral e Porcentagem: caixa de texto "Valor de {nome}" (ou `rotulo`), `inputMode="decimal"`,
 *   placeholder "0,00"; a Porcentagem mostra "%" ao lado. A validação é feita ao salvar
 *   (`lerValorDigitado`), não ao digitar.
 * - Booleano: grupo "Valor de {nome}" (ou `rotulo`) com os botões "Sim" e "Não" (`aria-pressed`);
 *   `valor` é `'sim'`, `'nao'` ou `''`.
 * - `erro` aparece como alerta junto do campo (e marca a caixa de texto como inválida).
 */
describe('F9.6 — CampoValorApontamento (entrada do valor do apontamento)', () => {
  function renderizar(props: Partial<CampoValorApontamentoProps> & { tipoValor?: TipoValor } = {}) {
    const onChange = props.onChange ?? vi.fn()
    const { tipoValor = 'numeral', ...resto } = props
    render(
      <CampoValorApontamento
        nome={resto.nome ?? 'Visitas a clientes'}
        tipoValor={tipoValor}
        valor={resto.valor ?? ''}
        onChange={onChange}
        erro={resto.erro}
        rotulo={resto.rotulo}
        disabled={resto.disabled}
      />,
    )
    return { onChange }
  }

  /** Versão com estado, para verificar a digitação completa. */
  function CampoComEstado({ tipoValor, aoMudar }: { tipoValor: TipoValor; aoMudar: (valor: string) => void }) {
    const [valor, setValor] = useState('')
    return (
      <CampoValorApontamento
        nome="Visitas a clientes"
        tipoValor={tipoValor}
        valor={valor}
        onChange={(novo) => {
          setValor(novo)
          aoMudar(novo)
        }}
      />
    )
  }

  describe('Numeral', () => {
    it('mostra a caixa "Valor de {nome}" com inputMode decimal e placeholder "0,00", sem "%"', () => {
      renderizar()

      const campo = screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })
      expect(campo).toHaveAttribute('inputmode', 'decimal')
      expect(campo).toHaveAttribute('placeholder', '0,00')
      expect(campo).toHaveValue('')
      expect(screen.queryByText('%')).not.toBeInTheDocument()
    })

    it('exibe o texto recebido em valor', () => {
      renderizar({ valor: '1.234,56' })

      expect(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })).toHaveValue('1.234,56')
    })

    it('digitar avisa o texto completo em onChange (vírgula decimal aceita ao digitar)', async () => {
      const user = usuarioRapido()
      const aoMudar = vi.fn()
      render(<CampoComEstado tipoValor="numeral" aoMudar={aoMudar} />)

      await user.type(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' }), '1.234,56')

      expect(aoMudar).toHaveBeenLastCalledWith('1.234,56')
      expect(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })).toHaveValue('1.234,56')
    })

    it('erro: alerta com a mensagem e a caixa marcada como inválida', () => {
      renderizar({ erro: 'O valor não pode ser negativo.' })

      expect(screen.getByRole('alert')).toHaveTextContent('O valor não pode ser negativo.')
      expect(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })).toHaveAttribute('aria-invalid', 'true')
    })

    it('sem erro: nenhum alerta e a caixa não fica inválida', () => {
      renderizar({ erro: null })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('rotulo substitui o nome acessível padrão', () => {
      renderizar({ rotulo: 'Novo valor' })

      expect(screen.getByRole('textbox', { name: 'Novo valor' })).toBeInTheDocument()
    })

    it('disabled desabilita a caixa', () => {
      renderizar({ disabled: true })

      expect(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' })).toBeDisabled()
    })
  })

  describe('Porcentagem', () => {
    it('mostra a caixa "Valor de {nome}" com inputMode decimal e o símbolo "%" ao lado', () => {
      renderizar({ tipoValor: 'porcentagem', nome: 'Inadimplência' })

      expect(screen.getByRole('textbox', { name: 'Valor de Inadimplência' })).toHaveAttribute('inputmode', 'decimal')
      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('digitar avisa o texto em onChange', async () => {
      const user = usuarioRapido()
      const aoMudar = vi.fn()
      render(<CampoComEstado tipoValor="porcentagem" aoMudar={aoMudar} />)

      await user.type(screen.getByRole('textbox', { name: 'Valor de Visitas a clientes' }), '80,5')

      expect(aoMudar).toHaveBeenLastCalledWith('80,5')
    })
  })

  describe('Booleano', () => {
    it('mostra o grupo "Valor de {nome}" com "Sim" e "Não", nenhum pressionado, e nenhuma caixa de texto', () => {
      renderizar({ tipoValor: 'booleano', nome: 'Vitrine montada' })

      const grupo = screen.getByRole('group', { name: 'Valor de Vitrine montada' })
      expect(within(grupo).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'false')
      expect(within(grupo).getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('valor "sim" deixa "Sim" pressionado; "nao" deixa "Não" pressionado', () => {
      const { unmount } = render(
        <CampoValorApontamento nome="Vitrine montada" tipoValor="booleano" valor="sim" onChange={vi.fn()} />,
      )
      expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'false')
      unmount()

      render(<CampoValorApontamento nome="Vitrine montada" tipoValor="booleano" valor="nao" onChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('clicar em "Sim" chama onChange("sim") e em "Não" chama onChange("nao")', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipoValor: 'booleano', nome: 'Vitrine montada' })

      await user.click(screen.getByRole('button', { name: 'Sim' }))
      expect(onChange).toHaveBeenLastCalledWith('sim')

      await user.click(screen.getByRole('button', { name: 'Não' }))
      expect(onChange).toHaveBeenLastCalledWith('nao')
    })

    // Revisão da F9 em 13/11/2026: clicar de novo na opção marcada desmarca (volta a "sem valor").
    it.each([
      ['sim', 'Sim'],
      ['nao', 'Não'],
    ] as const)('valor "%s": clicar de novo em "%s" chama onChange("")', async (valor, rotulo) => {
      const user = usuarioRapido()
      const onChange = vi.fn()
      render(<CampoValorApontamento nome="Vitrine montada" tipoValor="booleano" valor={valor} onChange={onChange} />)

      await user.click(screen.getByRole('button', { name: rotulo }))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('')
    })

    it('valor "sim": clicar em "Não" troca para "nao" (não desmarca)', async () => {
      const user = usuarioRapido()
      const onChange = vi.fn()
      render(<CampoValorApontamento nome="Vitrine montada" tipoValor="booleano" valor="sim" onChange={onChange} />)

      await user.click(screen.getByRole('button', { name: 'Não' }))

      expect(onChange).toHaveBeenCalledWith('nao')
    })

    it('com estado: marcar "Sim" e clicar de novo deixa os dois botões com aria-pressed false', async () => {
      const user = usuarioRapido()
      const aoMudar = vi.fn()
      render(<CampoComEstado tipoValor="booleano" aoMudar={aoMudar} />)
      const sim = screen.getByRole('button', { name: 'Sim' })

      await user.click(sim)
      expect(sim).toHaveAttribute('aria-pressed', 'true')
      await user.click(sim)

      expect(sim).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'false')
      expect(aoMudar.mock.calls.map(([texto]) => texto)).toEqual(['sim', ''])
    })

    it('os botões não enviam formulário (type="button")', () => {
      renderizar({ tipoValor: 'booleano', nome: 'Vitrine montada' })

      expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('type', 'button')
      expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('type', 'button')
    })

    it('erro aparece como alerta; rotulo nomeia o grupo; disabled desabilita os botões', () => {
      renderizar({ tipoValor: 'booleano', nome: 'Vitrine montada', erro: 'Escolha Sim ou Não.', rotulo: 'Novo valor', disabled: true })

      expect(screen.getByRole('alert')).toHaveTextContent('Escolha Sim ou Não.')
      const grupo = screen.getByRole('group', { name: 'Novo valor' })
      expect(within(grupo).getByRole('button', { name: 'Sim' })).toBeDisabled()
      expect(within(grupo).getByRole('button', { name: 'Não' })).toBeDisabled()
    })
  })
})
