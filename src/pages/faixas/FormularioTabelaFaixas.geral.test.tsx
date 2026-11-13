import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard, paraTabelaFaixas } from '../../services/adaptadores'
import { DASHBOARD_COMERCIAL_API, DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API } from '../../test/dashboardsFalsos'
import {
  MENSAGEM_CONFLITO_CORRIDA,
  MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
  MENSAGEM_CONFLITO_GERAL_ATIVA,
  tabelasFaixasComSituacaoApi,
} from '../../test/faixasFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import { FormularioTabelaFaixas, type FormularioTabelaFaixasProps } from './FormularioTabelaFaixas'

const DASHBOARDS = [DASHBOARD_COMERCIAL_API, DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API].map(paraDashboard)
const TABELAS = tabelasFaixasComSituacaoApi().map(paraTabelaFaixas)
const [, CAMPO_GRANDE] = FILIAIS

const ROTULO_GERAL = 'Faixa geral (vale para todas as filiais)'
const NOTA_JA_EXISTE =
  'Já existe uma tabela de faixas para este dashboard nesta filial. Para mudar os valores, use “Alterar faixas” nela — o histórico de versões é mantido.'

function renderizar(props: Partial<FormularioTabelaFaixasProps> = {}) {
  const onSalvar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <FormularioTabelaFaixas
      dashboards={DASHBOARDS}
      tabelas={TABELAS}
      filialFixa={null}
      filiais={FILIAIS}
      salvando={false}
      erro={null}
      onSalvar={onSalvar}
      onCancelar={onCancelar}
      {...props}
    />,
  )
  return { onSalvar, onCancelar }
}

const opcaoGeral = () => screen.getByRole('checkbox', { name: ROTULO_GERAL })
const campoDashboard = () => screen.getByRole('combobox', { name: 'Dashboard' })
const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => screen.getByRole('textbox', { name: `${nome}, faixa ${n}` })
const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar tabela de faixas' })

/** Com a faixa geral marcada, a filial some do formulário ou fica desabilitada. */
function filialIndisponivel(): boolean {
  const filial = screen.queryByRole('combobox', { name: 'Filial' })
  return filial === null || (filial as HTMLSelectElement).disabled
}

async function preencherFaixa(user: Usuario) {
  await user.type(campo('De', 1), '0')
  await user.type(campo('Até', 1), '2.000')
  await user.type(campo('Alíquota', 1), '1')
}

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 3: o formulário oferece a opção de faixa
 * geral (Admin e Validador — decisão do negócio de 12/11/2026; sem prop nova). Marcada a opção, a filial deixa de ser pedida e o cadastro envia
 * `filial: "todas"`. Faixas inativas não contam para a orientação de tabela já existente (RN-14):
 * é possível cadastrar uma nova faixa no lugar de uma inativada.
 *
 * Contrato final (F8.12*): a mensagem do `400` de conflito não cita o dashboard. Com a prop
 * `conflitos` (`ConflitoFaixas[]`), o alerta mostra a mensagem, a linha "Dashboard: {nome do
 * dashboard escolhido}" e a lista "Tabelas em conflito" ("Geral (todas as filiais)" ou
 * "Filial {código} – {nome}"). Sem `conflitos`, só a mensagem.
 */
describe('F8.7 — FormularioTabelaFaixas: faixa geral e tabelas inativas', () => {
  describe('opção "Faixa geral (vale para todas as filiais)"', () => {
    it('aparece desmarcada e a filial continua obrigatória', () => {
      renderizar()

      expect(opcaoGeral()).not.toBeChecked()
      expect(screen.getByRole('combobox', { name: 'Filial' })).toBeEnabled()
      expect(screen.getByRole('combobox', { name: 'Filial' })).toHaveAttribute('aria-required', 'true')
    })

    it('marcada, a filial fica indisponível e salvar chama onSalvar com filial "todas", sem pedir a filial', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(opcaoGeral())
      expect(opcaoGeral()).toBeChecked()
      expect(filialIndisponivel()).toBe(true)

      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherFaixa(user)
      await user.click(botaoSalvar())

      expect(screen.queryByText('Selecione a filial.')).not.toBeInTheDocument()
      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({
        dashboard: 2,
        filial: 'todas',
        descricao: null,
        faixas: [{ de: 0, ate: 2000, aliquota: 1 }],
      })
    })

    it('com uma filial no cabeçalho, a faixa geral marcada também envia filial "todas"', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })

      await user.click(opcaoGeral())
      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherFaixa(user)
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ dashboard: 2, filial: 'todas' }))
    })

    it('desmarcada de novo, a filial volta a ser pedida ("Selecione a filial.") e o cadastro é por filial', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(opcaoGeral())
      await user.click(opcaoGeral())
      expect(screen.getByRole('combobox', { name: 'Filial' })).toBeEnabled()

      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherFaixa(user)
      await user.click(botaoSalvar())

      expect(screen.getByText('Selecione a filial.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()

      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '101')
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ dashboard: 2, filial: '101' }))
    })

    it('o erro devolvido pela API (ex.: conflito com faixas ativas) aparece no formulário com a opção ainda marcada', async () => {
      const user = usuarioRapido()
      const props = {
        dashboards: DASHBOARDS,
        tabelas: TABELAS,
        filialFixa: null,
        filiais: FILIAIS,
        salvando: false,
        onSalvar: vi.fn(),
        onCancelar: vi.fn(),
      }
      const { rerender } = render(<FormularioTabelaFaixas {...props} erro={null} />)
      await user.click(opcaoGeral())

      const mensagem = MENSAGEM_CONFLITO_FAIXAS_ATIVAS
      rerender(<FormularioTabelaFaixas {...props} erro={mensagem} />)

      expect(screen.getByRole('alert')).toHaveTextContent(mensagem)
      expect(opcaoGeral()).toBeChecked()
    })
  })

  describe('400 de conflito com a lista "conflitos" (contrato final)', () => {
    const props = {
      dashboards: DASHBOARDS,
      tabelas: TABELAS,
      filialFixa: null,
      filiais: FILIAIS,
      salvando: false,
      onSalvar: vi.fn(),
      onCancelar: vi.fn(),
    }
    const itensConflito = () =>
      within(within(screen.getByRole('alert')).getByRole('list', { name: 'Tabelas em conflito' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

    it('faixa geral num dashboard com faixas por filial ativas: mensagem, "Dashboard: PED Comercial" e as filiais em conflito', async () => {
      const user = usuarioRapido()
      const { rerender } = render(<FormularioTabelaFaixas {...props} erro={null} />)
      await user.click(opcaoGeral())
      await user.selectOptions(campoDashboard(), 'PED Comercial')

      rerender(
        <FormularioTabelaFaixas
          {...props}
          erro={MENSAGEM_CONFLITO_FAIXAS_ATIVAS}
          conflitos={[
            { id: 1, geral: false, filial: '101', nomeFilial: 'CAMPO GRANDE' },
            { id: 2, geral: false, filial: '102', nomeFilial: 'DOURADOS' },
          ]}
        />,
      )

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_FAIXAS_ATIVAS)
      expect(within(alerta).getByText('Dashboard: PED Comercial')).toBeInTheDocument()
      expect(itensConflito()).toEqual(['Filial 101 – CAMPO GRANDE', 'Filial 102 – DOURADOS'])
      expect(opcaoGeral()).toBeChecked()
    })

    it('faixa por filial num dashboard com faixa geral ativa: "Geral (todas as filiais)"', async () => {
      const user = usuarioRapido()
      const { rerender } = render(<FormularioTabelaFaixas {...props} erro={null} />)
      await user.selectOptions(campoDashboard(), 'PED Supervisores')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '101')

      rerender(
        <FormularioTabelaFaixas
          {...props}
          erro={MENSAGEM_CONFLITO_GERAL_ATIVA}
          conflitos={[{ id: 5, geral: true, filial: null, nomeFilial: null }]}
        />,
      )

      expect(within(screen.getByRole('alert')).getByText('Dashboard: PED Supervisores')).toBeInTheDocument()
      expect(itensConflito()).toEqual(['Geral (todas as filiais)'])
      expect(screen.getByRole('combobox', { name: 'Filial' })).toHaveValue('101')
    })

    it.each([
      ['ausente', undefined],
      ['null', null],
      ['vazia', []],
    ] as const)('lista de conflitos %s (ex.: 400 de corrida): só a mensagem, sem a lista nem o dashboard', async (_caso, conflitos) => {
      const user = usuarioRapido()
      const { rerender } = render(<FormularioTabelaFaixas {...props} erro={null} />)
      await user.selectOptions(campoDashboard(), 'PED Gerentes')

      rerender(<FormularioTabelaFaixas {...props} erro={MENSAGEM_CONFLITO_CORRIDA} conflitos={conflitos} />)

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_CORRIDA)
      expect(within(alerta).queryByRole('list')).not.toBeInTheDocument()
      expect(within(alerta).queryByText(/^Dashboard:/)).not.toBeInTheDocument()
    })
  })

  describe('tabelas inativas não contam como "já existe" (RN-14)', () => {
    it('dashboard e filial com tabela só inativa (PED Comercial · Filial 100): sem a orientação e com salvar habilitado', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoDashboard(), 'PED Comercial')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '100')

      expect(screen.queryByText(NOTA_JA_EXISTE)).not.toBeInTheDocument()
      expect(botaoSalvar()).toBeEnabled()
    })

    it('dashboard e filial com tabela ativa (PED Comercial · Filial 101) continuam com a orientação e o salvar desabilitado', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoDashboard(), 'PED Comercial')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '101')

      expect(screen.getByText(NOTA_JA_EXISTE)).toBeInTheDocument()
      expect(botaoSalvar()).toBeDisabled()
    })

    it('a faixa geral do dashboard (filial null) não dispara a orientação para uma filial (o conflito é validado pela API)', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoDashboard(), 'PED Supervisores')
      await user.selectOptions(screen.getByRole('combobox', { name: 'Filial' }), '101')

      expect(screen.queryByText(NOTA_JA_EXISTE)).not.toBeInTheDocument()
      expect(within(screen.getByRole('group', { name: 'Faixas' })).getByRole('textbox', { name: 'De, faixa 1' })).toBeInTheDocument()
    })
  })
})
