import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import {
  MENSAGEM_CONFLITO_CORRIDA,
  MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
  MENSAGEM_CONFLITO_GERAL_ATIVA,
  TABELA_COMERCIAL_100_INATIVA_API,
  TABELA_COMERCIAL_101_API,
  TABELA_GERAL_GERENTES_INATIVA_API,
} from '../../test/faixasFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import { DialogoSituacaoTabelaFaixas, type DialogoSituacaoTabelaFaixasProps } from './DialogoSituacaoTabelaFaixas'

const ATIVA = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const INATIVA_GERAL = paraTabelaFaixas(TABELA_GERAL_GERENTES_INATIVA_API)
const INATIVA_100 = paraTabelaFaixas(TABELA_COMERCIAL_100_INATIVA_API)

const IMPACTO_INATIVAR =
  'A tabela de faixas “PED Comercial · Filial 101” deixa de valer no cálculo do dashboard. Ela continua na lista (filtro “Inativas”) e pode ser reativada depois.'
const IMPACTO_REATIVAR = 'A tabela de faixas “PED Gerentes · Geral” volta a valer no cálculo do dashboard.'

function renderizar(props: Partial<DialogoSituacaoTabelaFaixasProps> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  const resultado = render(
    <DialogoSituacaoTabelaFaixas
      tabela={props.tabela === undefined ? ATIVA : props.tabela}
      salvando={props.salvando ?? false}
      erro={props.erro ?? null}
      conflitos={props.conflitos}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  )
  return { onConfirmar, onCancelar, ...resultado }
}

/**
 * Diálogo de "Inativar tabela"/"Reativar tabela" (proposta "faixa geral e situação", seção 4): motivo
 * obrigatório nos dois sentidos. O erro da API (ex.: `400` de conflito na reativação) aparece dentro
 * do diálogo, que continua aberto com o motivo digitado.
 *
 * Contrato final (F8.12*): a mensagem de conflito não cita o dashboard. Com a prop `conflitos`
 * (`ConflitoFaixas[]`), o alerta mostra a mensagem, a linha "Dashboard: {nome do dashboard da tabela}"
 * e a lista "Tabelas em conflito" ("Geral (todas as filiais)" ou "Filial {código} – {nome}"). Sem
 * `conflitos` (ausente, `null` ou vazio), só a mensagem.
 */
describe('F8.7 — DialogoSituacaoTabelaFaixas (inativar e reativar com motivo obrigatório)', () => {
  it('com tabela null não renderiza nada', () => {
    renderizar({ tabela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('tabela ativa → "Inativar tabela de faixas"', () => {
    const dialogo = () => screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })
    const motivo = () => within(dialogo()).getByRole('textbox', { name: 'Motivo da inativação' })

    it('descreve o impacto e pede o motivo (obrigatório), com "Cancelar" e "Inativar"', () => {
      renderizar()

      expect(within(dialogo()).getByText(IMPACTO_INATIVAR)).toBeInTheDocument()
      expect(motivo()).toHaveValue('')
      expect(motivo()).toHaveAttribute('aria-required', 'true')
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Inativar' })).toBeEnabled()
    })

    it('"Inativar" chama onConfirmar com o motivo sem os espaços das pontas', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await colar(user, motivo(), '  passou a valer a faixa geral  ')
      await user.click(within(dialogo()).getByRole('button', { name: 'Inativar' }))

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith('passou a valer a faixa geral')
    })

    it.each([
      ['vazio', ''],
      ['só com espaços', '   '],
    ])('motivo %s: mostra "Informe o motivo da inativação." e não chama onConfirmar', async (_caso, texto) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      if (texto !== '') await colar(user, motivo(), texto)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inativar' }))

      expect(within(dialogo()).getByText('Informe o motivo da inativação.')).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('salvando: "Inativar" fica desabilitado', () => {
      renderizar({ salvando: true })

      expect(within(dialogo()).getByRole('button', { name: 'Inativar' })).toBeDisabled()
    })

    it('"Cancelar" e Esc chamam onCancelar, sem onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(2)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('tabela inativa → "Reativar tabela de faixas"', () => {
    const dialogo = () => screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })
    const motivo = () => within(dialogo()).getByRole('textbox', { name: 'Motivo da reativação' })

    it('descreve o impacto e pede o motivo (obrigatório), com "Cancelar" e "Reativar"', () => {
      renderizar({ tabela: INATIVA_GERAL })

      expect(within(dialogo()).getByText(IMPACTO_REATIVAR)).toBeInTheDocument()
      expect(motivo()).toHaveAttribute('aria-required', 'true')
      expect(within(dialogo()).getByRole('button', { name: 'Reativar' })).toBeEnabled()
      expect(screen.queryByRole('dialog', { name: 'Inativar tabela de faixas' })).not.toBeInTheDocument()
    })

    it('"Reativar" chama onConfirmar com o motivo', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ tabela: INATIVA_GERAL })

      await colar(user, motivo(), 'voltou a valer a régua geral')
      await user.click(within(dialogo()).getByRole('button', { name: 'Reativar' }))

      expect(onConfirmar).toHaveBeenCalledWith('voltou a valer a régua geral')
    })

    it('sem motivo: mostra "Informe o motivo da reativação." e não chama onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ tabela: INATIVA_GERAL })

      await user.click(within(dialogo()).getByRole('button', { name: 'Reativar' }))

      expect(within(dialogo()).getByText('Informe o motivo da reativação.')).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('o erro da API (conflito) aparece como alerta dentro do diálogo, sem apagar o motivo digitado', async () => {
      const user = usuarioRapido()
      const onConfirmar = vi.fn()
      const onCancelar = vi.fn()
      const { rerender } = render(
        <DialogoSituacaoTabelaFaixas tabela={INATIVA_GERAL} salvando={false} erro={null} onConfirmar={onConfirmar} onCancelar={onCancelar} />,
      )
      await colar(user, motivo(), 'voltou a valer a régua geral')

      const mensagem = MENSAGEM_CONFLITO_FAIXAS_ATIVAS
      rerender(
        <DialogoSituacaoTabelaFaixas tabela={INATIVA_GERAL} salvando={false} erro={mensagem} onConfirmar={onConfirmar} onCancelar={onCancelar} />,
      )

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent(mensagem)
      expect(motivo()).toHaveValue('voltou a valer a régua geral')
    })
  })

  describe('400 de conflito com a lista "conflitos" (contrato final)', () => {
    const dialogo = () => screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })
    const alerta = () => within(dialogo()).getByRole('alert')
    const itensConflito = () =>
      within(within(alerta()).getByRole('list', { name: 'Tabelas em conflito' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

    it('faixa geral em conflito com faixa por filial: mensagem, "Dashboard: PED Gerentes" e "Filial 100 – MATRIZ"', () => {
      renderizar({
        tabela: INATIVA_GERAL,
        erro: MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
        conflitos: [{ id: 3, geral: false, filial: '100', nomeFilial: 'MATRIZ' }],
      })

      expect(alerta()).toHaveTextContent(MENSAGEM_CONFLITO_FAIXAS_ATIVAS)
      expect(within(alerta()).getByText('Dashboard: PED Gerentes')).toBeInTheDocument()
      expect(itensConflito()).toEqual(['Filial 100 – MATRIZ'])
    })

    it('faixa por filial em conflito com a faixa geral: "Geral (todas as filiais)"', () => {
      renderizar({
        tabela: INATIVA_100,
        erro: MENSAGEM_CONFLITO_GERAL_ATIVA,
        conflitos: [{ id: 9, geral: true, filial: null, nomeFilial: null }],
      })

      expect(alerta()).toHaveTextContent(MENSAGEM_CONFLITO_GERAL_ATIVA)
      expect(within(alerta()).getByText('Dashboard: PED Comercial')).toBeInTheDocument()
      expect(itensConflito()).toEqual(['Geral (todas as filiais)'])
    })

    it('várias tabelas em conflito aparecem na ordem da API', () => {
      renderizar({
        tabela: INATIVA_GERAL,
        erro: MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
        conflitos: [
          { id: 3, geral: false, filial: '100', nomeFilial: 'MATRIZ' },
          { id: 8, geral: false, filial: '101', nomeFilial: 'CAMPO GRANDE' },
        ],
      })

      expect(itensConflito()).toEqual(['Filial 100 – MATRIZ', 'Filial 101 – CAMPO GRANDE'])
    })

    it.each([
      ['ausente', undefined],
      ['null', null],
      ['vazia', []],
    ] as const)('lista de conflitos %s (ex.: 400 de corrida): só a mensagem, sem a lista nem o dashboard', (_caso, conflitos) => {
      renderizar({ tabela: INATIVA_GERAL, erro: MENSAGEM_CONFLITO_CORRIDA, conflitos })

      expect(alerta()).toHaveTextContent(MENSAGEM_CONFLITO_CORRIDA)
      expect(within(alerta()).queryByRole('list')).not.toBeInTheDocument()
      expect(within(alerta()).queryByText(/^Dashboard:/)).not.toBeInTheDocument()
    })

    it('sem erro, nenhum alerta mesmo com conflitos informados', () => {
      renderizar({ tabela: INATIVA_GERAL, erro: null, conflitos: [{ id: 3, geral: false, filial: '100', nomeFilial: 'MATRIZ' }] })

      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
