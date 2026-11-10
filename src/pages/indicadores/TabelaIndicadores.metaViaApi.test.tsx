import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

/**
 * F6.11 — Meta buscada via API na listagem.
 * - Etiqueta "Integração pendente (TI)" (tom alerta, mesmo texto da aba Dados Externos) quando a
 *   integração da meta está pendente (`indicador.integracao.pendente`), logo após as etiquetas de meta
 *   ("Meta a definir" / "Meta pendente em N filiais") e antes de "Componentes desativados" e "Inativo".
 * - Coluna Meta: "Via API" quando `origemDaMeta === 'terceiro'`.
 * - Menu (props opcionais `podeConfigurarIntegracao`, padrão `false`, e `onConfigurarIntegracao`): só em
 *   indicadores com origem `terceiro`, logo após "Ver detalhes": "Preencher integração" quando pendente,
 *   "Configurações" quando já configurada.
 * Contrato final (10/11/2026): os indicadores daqui são da fonte `integracao`; a etiqueta segue
 * `situacaoDaMetaViaApi` (`integracao_pendente`) — ver `TabelaIndicadores.fonteDaMeta.test.tsx`.
 */
const PENDENTE = paraIndicador(INDICADOR_META_API_PENDENTE_API)
const CONFIGURADO = paraIndicador(INDICADOR_META_API_CONFIGURADO_API)
const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)

const COL = { nome: 0, meta: 3 }

describe('F6.11 — TabelaIndicadores: meta via API', () => {
  function renderizar(props: Partial<TabelaIndicadoresProps> = {}) {
    const onConfigurarIntegracao = props.onConfigurarIntegracao ?? vi.fn<(indicador: Indicador) => void>()
    render(
      <TabelaIndicadores
        indicadores={props.indicadores ?? [COBERTURA_VISITAS, PENDENTE, CONFIGURADO]}
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        podeConfigurarIntegracao={props.podeConfigurarIntegracao}
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
        onConfigurarIntegracao={onConfigurarIntegracao}
      />,
    )
    return { onConfigurarIntegracao }
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

  describe('etiqueta "Integração pendente (TI)"', () => {
    it('aparece (tom alerta) no indicador com a integração pendente', () => {
      renderizar()

      const etiqueta = within(celula('Faturamento com meta da TI', COL.nome)).getByText('Integração pendente (TI)')
      expect(etiqueta).toHaveClass('etiqueta--alerta')
      expect(etiquetas(celula('Faturamento com meta da TI', COL.nome))).toEqual(['Integração pendente (TI)'])
    })

    it('não aparece no indicador com a integração configurada nem nos de meta manual', () => {
      renderizar()

      expect(within(celula('Margem com meta da TI', COL.nome)).queryByText('Integração pendente (TI)')).not.toBeInTheDocument()
      expect(within(celula('Cobertura de visitas', COL.nome)).queryByText('Integração pendente (TI)')).not.toBeInTheDocument()
    })

    it('aparece também sem a permissão de configurar (o dado só chega ao Admin)', () => {
      renderizar({ podeConfigurarIntegracao: false })

      expect(within(celula('Faturamento com meta da TI', COL.nome)).getByText('Integração pendente (TI)')).toBeInTheDocument()
    })

    it('ordem: depois de "Criado automaticamente" e antes de "Componentes desativados" e "Inativo"', () => {
      const api: IndicadorApiFalso = {
        ...INDICADOR_META_API_PENDENTE_API,
        ativo: false,
        'criado automaticamente': true,
        'componentes desativados': true,
      }
      renderizar({ indicadores: [paraIndicador(api)] })

      expect(etiquetas(celula('Faturamento com meta da TI', COL.nome))).toEqual([
        'Criado automaticamente',
        'Integração pendente (TI)',
        'Componentes desativados',
        'Inativo',
      ])
    })
  })

  describe('coluna Meta', () => {
    it('indicador com meta via API mostra "Via API" (pendente ou configurado)', () => {
      renderizar()

      expect(celula('Faturamento com meta da TI', COL.meta)).toHaveTextContent('Via API')
      expect(celula('Margem com meta da TI', COL.meta)).toHaveTextContent('Via API')
    })

    it('indicador de meta manual continua com a meta formatada', () => {
      renderizar()

      expect(celula('Cobertura de visitas', COL.meta)).toHaveTextContent('85')
      expect(celula('Cobertura de visitas', COL.meta)).not.toHaveTextContent('Via API')
    })
  })

  describe('menu de ações', () => {
    it('com a permissão: "Preencher integração" (pendente) e "Configurações" (configurada), logo após "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar({ podeConfigurarIntegracao: true })

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta da TI'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Inativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Margem com meta da TI'))).toEqual([
        'Ver detalhes',
        'Configurações',
        'Inativar',
        'Excluir',
      ])
    })

    it('com a permissão, indicador de meta manual não tem "Configurações" nem "Preencher integração"', async () => {
      const user = usuarioRapido()
      renderizar({ podeConfigurarIntegracao: true })

      const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))
      expect(itens).not.toContain('Configurações')
      expect(itens).not.toContain('Preencher integração')
    })

    it.each([
      ['sem a prop (padrão false)', undefined],
      ['com podeConfigurarIntegracao false', false],
    ] as const)('%s, nenhum indicador mostra "Configurações" nem "Preencher integração"', async (_nome, pode) => {
      const user = usuarioRapido()
      renderizar({ podeConfigurarIntegracao: pode })

      for (const nome of ['Faturamento com meta da TI', 'Margem com meta da TI']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))
        expect(itens).not.toContain('Configurações')
        expect(itens).not.toContain('Preencher integração')
      }
    })

    it('"Preencher integração" e "Configurações" chamam onConfigurarIntegracao com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onConfigurarIntegracao } = renderizar({ podeConfigurarIntegracao: true })

      await escolherAcao(user, rotuloAcoesIndicador('Faturamento com meta da TI'), 'Preencher integração')
      await escolherAcao(user, rotuloAcoesIndicador('Margem com meta da TI'), 'Configurações')

      expect(onConfigurarIntegracao).toHaveBeenCalledTimes(2)
      expect(onConfigurarIntegracao.mock.calls[0][0]).toMatchObject({ id: 10 })
      expect(onConfigurarIntegracao.mock.calls[1][0]).toMatchObject({ id: 11 })
    })
  })
})
