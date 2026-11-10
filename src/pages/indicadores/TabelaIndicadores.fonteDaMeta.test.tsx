import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_API,
  INDICADOR_META_SEM_META_NO_MES_API,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

/**
 * F6.11 — Listagem no contrato final da meta via API (RESPOSTA-FINAL-meta-via-api.md, seção 2.4, e
 * CONFIRMACAO-FRONT-meta-via-api.md — 10/11/2026).
 *
 * Etiquetas por `situacaoDaMetaViaApi` (para todos os perfis; no lugar da antiga "Integração pendente
 * (TI)", logo após as etiquetas de meta e antes de "Componentes desativados"/"Inativo"):
 * - `integracao_pendente` → "Integração pendente (TI)" (alerta) — só na fonte `integracao`; sem a
 *   situação (API anterior), vale `integracao.pendente`;
 * - `aguardando_consulta` → "Aguardando primeira consulta" (info);
 * - `erro` → "Erro na consulta da meta" (perigo);
 * - `sem_meta_no_mes` → "Sem meta no mês" (alerta);
 * - `ok` → sem etiqueta. "Meta pendente em N filiais" continua pelas `filiaisSemMeta`.
 * Tarefa do Bitrix (`tarefaBitrix`) como nos dados externos: texto "#N" ou "Aguardando envio ao Bitrix"
 * (`textoTarefaBitrix`) na coluna Nome, fora das etiquetas. Coluna Meta: "Via API".
 * Menu (só com `podeConfigurarIntegracao`): fonte `integracao` → "Preencher integração"/"Configurações"
 * (como antes); fonte `dado_externo` → "Ver integração do dado externo" (prop opcional
 * `onVerIntegracaoDadoExterno`), nunca "Preencher integração"/"Configurações".
 */
const API = [
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_SEM_META_NO_MES_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_ERRO_API,
]
const INDICADORES: Indicador[] = API.map(paraIndicador)

const COL = { nome: 0, meta: 3 }

describe('F6.11 — TabelaIndicadores: situação da meta via API, tarefa do Bitrix e integração do dado externo', () => {
  function renderizar(props: Partial<TabelaIndicadoresProps> = {}) {
    const onConfigurarIntegracao = vi.fn<(indicador: Indicador) => void>()
    const onVerIntegracaoDadoExterno = vi.fn<(indicador: Indicador) => void>()
    render(
      <TabelaIndicadores
        indicadores={INDICADORES}
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        podeConfigurarIntegracao
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
        onConfigurarIntegracao={onConfigurarIntegracao}
        onVerIntegracaoDadoExterno={onVerIntegracaoDadoExterno}
        podeDefinirMetasPendentes
        onDefinirMetasPendentes={vi.fn()}
        {...props}
      />,
    )
    return { onConfigurarIntegracao, onVerIntegracaoDadoExterno }
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
  const etiquetas = (nome: string) => [...celula(nome, COL.nome).querySelectorAll('.etiqueta')].map((e) => e.textContent?.trim())

  describe('etiquetas por situação da meta via API', () => {
    it.each([
      ['Faturamento com meta da TI', ['Integração pendente (TI)']],
      ['Margem com meta da TI', []],
      ['Faturamento com meta do ERP', []],
      ['Volume Mann com meta do ERP', ['Meta pendente em 2 filiais', 'Sem meta no mês']],
      ['Novos clientes com meta da TI', ['Aguardando primeira consulta']],
      ['Cobertura com meta da TI', ['Erro na consulta da meta']],
    ])('%s → %j', (nome, esperadas) => {
      renderizar()

      expect(etiquetas(nome)).toEqual(esperadas)
    })

    it('tons: "Aguardando primeira consulta" info, "Erro na consulta da meta" perigo, "Sem meta no mês" alerta', () => {
      renderizar()

      expect(within(celula('Novos clientes com meta da TI', COL.nome)).getByText('Aguardando primeira consulta')).toHaveClass('etiqueta--info')
      expect(within(celula('Cobertura com meta da TI', COL.nome)).getByText('Erro na consulta da meta')).toHaveClass('etiqueta--perigo')
      expect(within(celula('Volume Mann com meta do ERP', COL.nome)).getByText('Sem meta no mês')).toHaveClass('etiqueta--alerta')
    })

    it('as etiquetas aparecem também sem a permissão de configurar (a situação chega a todos os perfis)', () => {
      renderizar({ podeConfigurarIntegracao: false })

      expect(etiquetas('Novos clientes com meta da TI')).toEqual(['Aguardando primeira consulta'])
      expect(etiquetas('Faturamento com meta da TI')).toEqual(['Integração pendente (TI)'])
    })

    it('fonte dado_externo nunca mostra "Integração pendente (TI)", mesmo com integracao.pendente', () => {
      const api: IndicadorApiFalso = { ...INDICADOR_META_DADO_EXTERNO_API, 'integracao pendente': true }
      renderizar({ indicadores: [paraIndicador(api)] })

      expect(etiquetas('Faturamento com meta do ERP')).toEqual([])
    })

    it('fonte integracao sem a situação (API anterior): "Integração pendente (TI)" pela integracao.pendente', () => {
      const api: IndicadorApiFalso = { ...INDICADOR_META_API_PENDENTE_API, 'situacao da meta via api': null }
      renderizar({ indicadores: [paraIndicador(api)] })

      expect(etiquetas('Faturamento com meta da TI')).toEqual(['Integração pendente (TI)'])
    })

    it('ordem: depois das etiquetas de meta e antes de "Componentes desativados" e "Inativo"', () => {
      const api: IndicadorApiFalso = { ...INDICADOR_META_ERRO_API, ativo: false, 'componentes desativados': true, 'filiais sem meta': ['101'] }
      renderizar({ indicadores: [paraIndicador(api)] })

      expect(etiquetas('Cobertura com meta da TI')).toEqual([
        'Meta pendente em 1 filial',
        'Erro na consulta da meta',
        'Componentes desativados',
        'Inativo',
      ])
    })
  })

  describe('tarefa do Bitrix', () => {
    it('"Aguardando envio ao Bitrix" (sem número) e "#N" (enviada) na coluna Nome, fora das etiquetas', () => {
      renderizar()

      expect(within(celula('Faturamento com meta da TI', COL.nome)).getByText('Aguardando envio ao Bitrix')).not.toHaveClass('etiqueta')
      expect(within(celula('Novos clientes com meta da TI', COL.nome)).getByText('#4521')).toBeInTheDocument()
      expect(within(celula('Cobertura com meta da TI', COL.nome)).getByText('#4522')).toBeInTheDocument()
    })

    it('sem tarefa (fonte dado_externo, integração configurada e meta manual), nada é exibido', () => {
      renderizar()

      for (const nome of ['Faturamento com meta do ERP', 'Margem com meta da TI', 'Cobertura de visitas']) {
        expect(within(celula(nome, COL.nome)).queryByText(/^#\d+$/)).not.toBeInTheDocument()
        expect(within(celula(nome, COL.nome)).queryByText('Aguardando envio ao Bitrix')).not.toBeInTheDocument()
      }
    })
  })

  it('coluna Meta: "Via API" nas duas fontes e em todas as situações', () => {
    renderizar()

    for (const indicador of API.slice(1)) {
      expect(celula(indicador.nome, COL.meta)).toHaveTextContent('Via API')
    }
  })

  describe('menu de ações', () => {
    it('Admin, fonte dado_externo: "Ver integração do dado externo" logo após "Ver detalhes", sem "Preencher integração"/"Configurações" nem "Definir metas pendentes"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta do ERP'))).toEqual([
        'Ver detalhes',
        'Ver integração do dado externo',
        'Inativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Volume Mann com meta do ERP'))).toEqual([
        'Ver detalhes',
        'Ver integração do dado externo',
        'Inativar',
        'Excluir',
      ])
    })

    it('Admin, fonte integracao: "Preencher integração" (pendente) ou "Configurações" (salva), sem "Ver integração do dado externo"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta da TI'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Inativar',
        'Excluir',
      ])
      for (const nome of ['Margem com meta da TI', 'Novos clientes com meta da TI', 'Cobertura com meta da TI']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))
        expect(itens).toContain('Configurações')
        expect(itens).not.toContain('Ver integração do dado externo')
      }
    })

    it('fonte dado_externo com integracao.pendente não oferece "Preencher integração"', async () => {
      const user = usuarioRapido()
      renderizar({ indicadores: [paraIndicador({ ...INDICADOR_META_DADO_EXTERNO_API, 'integracao pendente': true })] })

      const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta do ERP'))
      expect(itens).toContain('Ver integração do dado externo')
      expect(itens).not.toContain('Preencher integração')
      expect(itens).not.toContain('Configurações')
    })

    it('"Ver integração do dado externo" chama onVerIntegracaoDadoExterno com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onVerIntegracaoDadoExterno, onConfigurarIntegracao } = renderizar()

      await escolherAcao(user, rotuloAcoesIndicador('Faturamento com meta do ERP'), 'Ver integração do dado externo')

      expect(onVerIntegracaoDadoExterno).toHaveBeenCalledTimes(1)
      expect(onVerIntegracaoDadoExterno.mock.calls[0][0]).toMatchObject({ id: 12, fonteDaMeta: 'dado_externo' })
      expect(onConfigurarIntegracao).not.toHaveBeenCalled()
    })

    it('sem a permissão (Validador), nenhuma ação de integração em nenhuma fonte', async () => {
      const user = usuarioRapido()
      renderizar({ podeConfigurarIntegracao: false })

      for (const nome of ['Faturamento com meta do ERP', 'Faturamento com meta da TI', 'Novos clientes com meta da TI']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))
        expect(itens).not.toContain('Ver integração do dado externo')
        expect(itens).not.toContain('Preencher integração')
        expect(itens).not.toContain('Configurações')
      }
    })
  })
})
