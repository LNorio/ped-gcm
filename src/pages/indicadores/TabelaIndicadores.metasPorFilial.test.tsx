import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { FILIAIS } from '../../test/sessaoFalsa'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

/**
 * F6.10 — Meta por filial na listagem.
 * - Etiqueta "Meta pendente em N filiais" ("em 1 filial" no singular, tom alerta), logo após
 *   "Meta a definir" na ordem das etiquetas, quando há filiais sem meta;
 * - nos detalhes, "Filiais sem meta": "{código} - {nome}" separados por ", " (só o código quando a API
 *   não traz o nome);
 * - coluna Meta: com uma filial no cabeçalho e metas por filial, mostra a meta daquela filial ou
 *   "Sem meta nesta filial"; na visão "Todas as filiais", a meta única ou "Por filial" quando só há
 *   metas por filial. Sem metas por filial (API atual) a coluna não muda.
 */
const TICKET = paraIndicador(INDICADOR_TICKET_MEDIO_API)
const MARGEM = paraIndicador(INDICADOR_MARGEM_API)
const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)

const COL = { nome: 0, meta: 3 }

describe('F6.10 — TabelaIndicadores: meta por filial', () => {
  function renderizar(props: Partial<TabelaIndicadoresProps> = {}) {
    render(
      <TabelaIndicadores
        indicadores={props.indicadores ?? [COBERTURA_VISITAS, TICKET, MARGEM]}
        filialSelecionada={props.filialSelecionada === undefined ? 'todas' : props.filialSelecionada}
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
      />,
    )
  }

  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })

  function linha(nome: string): HTMLElement {
    const encontrada = within(tabela())
      .getAllByRole('row')
      .slice(1)
      .filter((l) => !l.classList.contains('tabela__detalhes'))
      .find((l) => within(within(l).getAllByRole('cell')[COL.nome]).queryByText(nome) !== null)
    if (!encontrada) throw new Error(`Linha "${nome}" não encontrada`)
    return encontrada
  }

  const celula = (nome: string, coluna: number) => within(linha(nome)).getAllByRole('cell')[coluna]
  const etiquetas = (elemento: HTMLElement) => [...elemento.querySelectorAll('.etiqueta')].map((e) => e.textContent?.trim())

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesIndicador(nome), 'Ver detalhes')
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    if (!proxima || !proxima.classList.contains('tabela__detalhes')) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return proxima
  }

  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  describe('etiqueta de pendência', () => {
    it('indicador com 2 filiais sem meta ganha a etiqueta "Meta pendente em 2 filiais" (tom alerta)', () => {
      renderizar()

      const celulaNome = celula('Ticket médio por filial', COL.nome)
      expect(etiquetas(celulaNome)).toEqual(['Meta pendente em 2 filiais'])
      expect(within(celulaNome).getByText('Meta pendente em 2 filiais')).toHaveClass('etiqueta--alerta')
    })

    it('com 1 filial sem meta, usa o singular "Meta pendente em 1 filial"', () => {
      renderizar({ indicadores: [{ ...TICKET, filiaisSemMeta: ['102'] }] })

      expect(etiquetas(celula('Ticket médio por filial', COL.nome))).toEqual(['Meta pendente em 1 filial'])
    })

    it('sem filiais pendentes (metas completas ou API atual), não há etiqueta de pendência', () => {
      renderizar()

      expect(etiquetas(celula('Margem bruta por filial', COL.nome))).toEqual([])
      expect(screen.getAllByText(/^Meta pendente em/)).toHaveLength(1)
    })

    it('fica logo depois de "Meta a definir" e antes de "Inativo" e "Meta editável"', () => {
      renderizar({
        indicadores: [{ ...TICKET, criadoAutomaticamente: true, metaADefinir: true, ativo: false, metaEditavel: true }],
      })

      expect(etiquetas(celula('Ticket médio por filial', COL.nome))).toEqual([
        'Criado automaticamente',
        'Meta a definir',
        'Meta pendente em 2 filiais',
        'Inativo',
        'Meta editável',
      ])
    })
  })

  describe('detalhes: filiais sem meta', () => {
    it('lista as filiais sem meta como "{código} - {nome}", separadas por vírgula', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Ticket médio por filial')

      expect(valorDetalhe(detalhes, 'Filiais sem meta')).toHaveTextContent('101 - CAMPO GRANDE, 102 - DOURADOS')
    })

    it('sem o nome da filial na resposta, mostra só o código', async () => {
      const user = usuarioRapido()
      renderizar({
        indicadores: [{ ...TICKET, metasPorFilial: [{ filial: '100', nomeFilial: 'MATRIZ', meta: 1500.5 }], filiaisSemMeta: ['101', '102'] }],
      })

      const detalhes = await verDetalhes(user, 'Ticket médio por filial')

      expect(valorDetalhe(detalhes, 'Filiais sem meta')).toHaveTextContent(/^101, 102$/)
    })

    it('sem filiais pendentes, os detalhes não mostram "Filiais sem meta"', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Margem bruta por filial')

      expect(within(detalhes).queryByText('Filiais sem meta')).not.toBeInTheDocument()
    })
  })

  describe('coluna Meta', () => {
    it('visão "Todas as filiais": meta única formatada; "Por filial" quando o indicador só tem metas por filial', () => {
      renderizar()

      expect(celula('Cobertura de visitas', COL.meta)).toHaveTextContent(/^85,00$/)
      expect(celula('Ticket médio por filial', COL.meta)).toHaveTextContent(/^Por filial$/)
      expect(celula('Margem bruta por filial', COL.meta)).toHaveTextContent(/^Por filial$/)
    })

    it('sem filialSelecionada informada, a coluna segue a visão "Todas as filiais"', () => {
      render(
        <TabelaIndicadores
          indicadores={[TICKET]}
          podeDefinirMeta
          podeVerHistorico
          podeAlterarSituacao
          podeExcluir
          onDefinirMeta={vi.fn()}
          onVerHistorico={vi.fn()}
          onAlterarSituacao={vi.fn()}
          onExcluir={vi.fn()}
        />,
      )

      expect(celula('Ticket médio por filial', COL.meta)).toHaveTextContent(/^Por filial$/)
    })

    it('com uma filial no cabeçalho: a meta daquela filial, formatada', () => {
      renderizar({ filialSelecionada: FILIAIS[0] })

      expect(celula('Ticket médio por filial', COL.meta)).toHaveTextContent(/^1\.500,50$/)
      expect(celula('Margem bruta por filial', COL.meta)).toHaveTextContent(/^30,00$/)
    })

    it('com uma filial no cabeçalho sem meta (nula ou ausente da lista): "Sem meta nesta filial"', () => {
      renderizar({
        filialSelecionada: FILIAIS[1],
        indicadores: [TICKET, { ...MARGEM, metasPorFilial: MARGEM.metasPorFilial.filter((item) => item.filial !== '101') }],
      })

      expect(celula('Ticket médio por filial', COL.meta)).toHaveTextContent(/^Sem meta nesta filial$/)
      expect(celula('Margem bruta por filial', COL.meta)).toHaveTextContent(/^Sem meta nesta filial$/)
    })

    it('com uma filial no cabeçalho e indicador sem metas por filial (API atual): mostra a meta única, como antes', () => {
      renderizar({ filialSelecionada: FILIAIS[1] })

      expect(celula('Cobertura de visitas', COL.meta)).toHaveTextContent(/^85,00$/)
    })
  })
})
