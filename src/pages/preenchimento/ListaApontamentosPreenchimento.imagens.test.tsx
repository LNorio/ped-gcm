import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APONTAMENTO_INADIMPLENCIA, telaMesFechado, tiposPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { TipoPreenchimento } from '../../types/dominio'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

const AVISO_INADIMPLENCIA =
  'Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026 (IMG-000012). Uma correção agora vale só para os períodos ainda abertos; a imagem já gerada não muda.'

/**
 * Aviso de mês congelado em imagens de dashboards (F9.8 — RF-70, RN-18): o apontamento com
 * `imagensCongeladas` mostra, na própria linha, um aviso (`role="note"`) com o texto de
 * `descreverImagensCongeladas`. Vale no mês editável e na consulta.
 */
describe('F9.8 — ListaApontamentosPreenchimento (aviso de imagens congeladas)', () => {
  function renderizar(props: Partial<ListaApontamentosPreenchimentoProps> = {}) {
    render(
      <ListaApontamentosPreenchimento
        tipos={tiposPreenchimento()}
        editavel
        rascunhos={{}}
        onAlterarRascunho={vi.fn()}
        erros={{}}
        onCorrigir={vi.fn()}
        onVerHistorico={vi.fn()}
        {...props}
      />,
    )
  }

  const linha = (nome: string) => screen.getByRole('article', { name: nome })
  // Subabas por tipo (alteração de 13/11/2026): "Inadimplência" fica na aba Financeiro.
  const aba = (tipo: string) =>
    within(screen.getByRole('tablist', { name: 'Tipos de apontamento' })).getByRole('tab', { name: (nome) => nome.startsWith(tipo) })

  it('o apontamento com imagem congelada avisa quais imagens são e que a correção vale só para os períodos abertos', async () => {
    const user = usuarioRapido()
    renderizar()
    await user.click(aba('Financeiro'))

    expect(within(linha('Inadimplência')).getByRole('note')).toHaveTextContent(AVISO_INADIMPLENCIA)
    expect(screen.getAllByText(/já foi congelado/)).toHaveLength(1)
  })

  it('os apontamentos sem imagens congeladas não mostram o aviso', () => {
    renderizar()

    expect(within(linha('Visitas a clientes')).queryByText(/já foi congelado/)).not.toBeInTheDocument()
    expect(within(linha('Vitrine montada')).queryByText(/já foi congelado/)).not.toBeInTheDocument()
    expect(screen.queryAllByText(/já foi congelado/)).toHaveLength(0)
  })

  it('várias imagens aparecem no mesmo aviso', () => {
    const tipos: TipoPreenchimento[] = [
      {
        id: 2,
        nome: 'Financeiro',
        quantidade: 1,
        apontamentos: [
          {
            ...APONTAMENTO_INADIMPLENCIA,
            imagensCongeladas: [
              { codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' },
              { codigo: 'IMG-000020', dashboard: 'PED Comercial', periodo: '10/2026' },
            ],
          },
        ],
      },
    ]
    renderizar({ tipos })

    expect(within(linha('Inadimplência')).getByRole('note')).toHaveTextContent(
      'Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026 (IMG-000012), PED Comercial · 10/2026 (IMG-000020).',
    )
  })

  it('o aviso também aparece na consulta de um mês fechado', async () => {
    const user = usuarioRapido()
    renderizar({ tipos: telaMesFechado().tipos, editavel: false })
    await user.click(aba('Financeiro'))

    expect(within(linha('Inadimplência')).getByRole('note')).toHaveTextContent(AVISO_INADIMPLENCIA)
  })
})
