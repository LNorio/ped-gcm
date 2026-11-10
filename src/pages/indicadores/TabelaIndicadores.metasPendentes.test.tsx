import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { FILIAIS } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

/**
 * F6.12 — Item "Definir metas pendentes" no menu da linha.
 *
 * Props novas (opcionais): `podeDefinirMetasPendentes?: boolean` (padrão `false`) e
 * `onDefinirMetasPendentes?: (indicador: Indicador) => void`. O item aparece quando:
 * - `podeDefinirMetasPendentes` (a página passa a permissão "definir-meta-indicador": Admin e Validador);
 * - o indicador está **ativo**, tem `filiaisSemMeta` não vazia, não está com "meta a definir" (o back
 *   recusa com 400: use "Definir meta") e não é de meta via API (`origemDaMeta = 'terceiro'`, F6.11);
 * - na visão de uma filial, só se essa filial estiver em `filiaisSemMeta`.
 * Posição: depois de "Definir meta" e antes de "Histórico de metas" / "Inativar".
 */
const TICKET = paraIndicador(INDICADOR_TICKET_MEDIO_API)
const MARGEM = paraIndicador(INDICADOR_MARGEM_API)
const COBERTURA = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)
const ITEM = 'Definir metas pendentes'

describe('F6.12 — TabelaIndicadores: ação "Definir metas pendentes"', () => {
  function renderizar(
    opcoes: {
      indicadores?: Indicador[]
      filialSelecionada?: FilialSelecionada
      props?: Partial<TabelaIndicadoresProps>
    } = {},
  ) {
    const onDefinirMetasPendentes = vi.fn<(indicador: Indicador) => void>()
    render(
      <TabelaIndicadores
        indicadores={opcoes.indicadores ?? [COBERTURA, TICKET, MARGEM]}
        filialSelecionada={opcoes.filialSelecionada ?? 'todas'}
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        podeDefinirMetasPendentes
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
        onDefinirMetasPendentes={onDefinirMetasPendentes}
        {...opcoes.props}
      />,
    )
    return { onDefinirMetasPendentes }
  }

  const itens = (nome: string) => itensDoMenuAcoes(usuarioRapido(), rotuloAcoesIndicador(nome))

  it('indicador ativo com filiais sem meta: "Definir metas pendentes" logo depois de "Ver detalhes" e antes de "Inativar"', async () => {
    renderizar()

    expect(await itens('Ticket médio por filial')).toEqual(['Ver detalhes', ITEM, 'Inativar', 'Excluir'])
  })

  it('com meta editável, fica antes de "Histórico de metas"', async () => {
    renderizar({ indicadores: [{ ...TICKET, metaEditavel: true }] })

    expect(await itens('Ticket médio por filial')).toEqual(['Ver detalhes', ITEM, 'Histórico de metas', 'Inativar', 'Excluir'])
  })

  it('escolher o item chama onDefinirMetasPendentes com o indicador', async () => {
    const user = usuarioRapido()
    const { onDefinirMetasPendentes } = renderizar()

    await escolherAcao(user, rotuloAcoesIndicador('Ticket médio por filial'), ITEM)

    expect(onDefinirMetasPendentes).toHaveBeenCalledTimes(1)
    expect(onDefinirMetasPendentes).toHaveBeenCalledWith(TICKET)
  })

  it('sem podeDefinirMetasPendentes (padrão false), o item não aparece', async () => {
    renderizar({ props: { podeDefinirMetasPendentes: undefined } })

    expect(await itens('Ticket médio por filial')).not.toContain(ITEM)
  })

  it('com podeDefinirMetasPendentes false, o item não aparece', async () => {
    renderizar({ props: { podeDefinirMetasPendentes: false } })

    expect(await itens('Ticket médio por filial')).not.toContain(ITEM)
  })

  it('não aparece em indicador de meta única nem com as metas por filial completas', async () => {
    renderizar()

    expect(await itens('Cobertura de visitas')).not.toContain(ITEM)
    expect(await itens('Margem bruta por filial')).not.toContain(ITEM)
  })

  it('não aparece em indicador inativo, mesmo com filiais sem meta', async () => {
    renderizar({ indicadores: [{ ...TICKET, ativo: false }] })

    expect(await itens('Ticket médio por filial')).not.toContain(ITEM)
  })

  it('não aparece em indicador de meta via API (origem "terceiro", F6.11), mesmo com filiais sem meta', async () => {
    renderizar({ indicadores: [{ ...TICKET, origemDaMeta: 'terceiro' }] })

    expect(await itens('Ticket médio por filial')).not.toContain(ITEM)
  })

  it('não aparece em indicador com "meta a definir" (usa-se "Definir meta")', async () => {
    renderizar({ indicadores: [{ ...TICKET, metaADefinir: true, criadoAutomaticamente: true }] })

    const nomes = await itens('Ticket médio por filial')
    expect(nomes).toContain('Definir meta')
    expect(nomes).not.toContain(ITEM)
  })

  describe('visão de uma filial', () => {
    it('aparece quando a filial do cabeçalho está entre as filiais sem meta (101)', async () => {
      renderizar({ filialSelecionada: FILIAIS[1] })

      expect(await itens('Ticket médio por filial')).toContain(ITEM)
    })

    it('não aparece quando a filial do cabeçalho já tem meta (100)', async () => {
      renderizar({ filialSelecionada: FILIAIS[0] })

      expect(await itens('Ticket médio por filial')).not.toContain(ITEM)
    })
  })
})
