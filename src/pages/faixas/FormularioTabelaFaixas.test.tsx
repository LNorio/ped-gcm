import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard, paraTabelaFaixas } from '../../services/adaptadores'
import { DASHBOARD_COMERCIAL_API, DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API } from '../../test/dashboardsFalsos'
import { tabelasFaixasApi } from '../../test/faixasFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'
import { FormularioTabelaFaixas, type FormularioTabelaFaixasProps } from './FormularioTabelaFaixas'

const DASHBOARDS = [DASHBOARD_COMERCIAL_API, DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API].map(paraDashboard)
const TABELAS = tabelasFaixasApi().map(paraTabelaFaixas)
const [, CAMPO_GRANDE] = FILIAIS

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

const campoDashboard = () => screen.getByRole('combobox', { name: 'Dashboard' })
const campoFilial = () => screen.getByRole('combobox', { name: 'Filial' })
const campoDescricao = () => screen.getByRole('textbox', { name: 'Descrição (opcional)' })
const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => screen.getByRole('textbox', { name: `${nome}, faixa ${n}` })
const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar tabela de faixas' })

async function preencherLinha(user: Usuario, n: number, de: string, ate: string, aliquota: string) {
  await user.type(campo('De', n), de)
  await user.type(campo('Até', n), ate)
  await user.type(campo('Alíquota', n), aliquota)
}

describe('F8.3 — FormularioTabelaFaixas (nova tabela de faixas — RF-42, RF-43, RN-14)', () => {
  describe('campos', () => {
    it('com "Todas as filiais" no cabeçalho: Dashboard e Filial obrigatórios (iniciando em "Selecione"), Descrição (opcional) e uma linha vazia', () => {
      renderizar()

      expect(campoDashboard()).toHaveAttribute('aria-required', 'true')
      expect(within(campoDashboard()).getByRole('option', { name: 'Selecione', selected: true })).toBeInTheDocument()
      expect(within(campoDashboard()).getAllByRole('option').slice(1).map((o) => o.textContent)).toEqual([
        'PED Comercial',
        'PED Gerentes',
        'PED Supervisores',
      ])
      expect(campoFilial()).toHaveAttribute('aria-required', 'true')
      expect(within(campoFilial()).getByRole('option', { name: 'Selecione', selected: true })).toBeInTheDocument()
      expect(within(campoFilial()).getAllByRole('option').slice(1).map((o) => o.textContent)).toEqual([
        '100 - MATRIZ',
        '101 - CAMPO GRANDE',
        '102 - DOURADOS',
      ])
      expect(campoDescricao()).toHaveValue('')
      expect(campoDescricao()).not.toHaveAttribute('aria-required')
      expect(campo('De', 1)).toHaveValue('')
      expect(screen.queryByRole('textbox', { name: 'De, faixa 2' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(botaoSalvar()).toBeEnabled()
    })

    it('com uma filial no cabeçalho: não pede a filial e mostra "Filial {código} - {nome}"', () => {
      renderizar({ filialFixa: CAMPO_GRANDE })

      expect(screen.queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument()
      expect(screen.getByText('Filial 101 - CAMPO GRANDE')).toBeInTheDocument()
    })
  })

  describe('validações (nada é enviado com erro)', () => {
    it('sem dashboard: "Selecione o dashboard."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })
      await preencherLinha(user, 1, '0', '1.000', '0')

      await user.click(botaoSalvar())

      expect(screen.getByText('Selecione o dashboard.')).toBeInTheDocument()
      expect(campoDashboard()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com "Todas as filiais" e sem filial: "Selecione a filial."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherLinha(user, 1, '0', '1.000', '0')

      await user.click(botaoSalvar())

      expect(screen.getByText('Selecione a filial.')).toBeInTheDocument()
      expect(campoFilial()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('linha incompleta: mostra a mensagem do RF-43 como alerta e não salva', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })
      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await user.type(campo('De', 1), '0')

      await user.click(botaoSalvar())

      expect(screen.getByRole('alert')).toHaveTextContent('Preencha De, Até e Alíquota da faixa 1.')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('faixa que não começa acima da anterior: mensagem do RF-43 e não salva', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })
      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherLinha(user, 1, '0', '1.000', '0')
      await user.click(screen.getByRole('button', { name: /Adicionar faixa/ }))
      await preencherLinha(user, 2, '1.000', '2.000', '1')

      await user.click(botaoSalvar())

      expect(screen.getByRole('alert')).toHaveTextContent('A faixa 2 deve começar acima do limite da faixa 1.')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('corrigir e salvar de novo limpa a mensagem anterior', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })
      await user.click(botaoSalvar())
      expect(screen.getByText('Selecione o dashboard.')).toBeInTheDocument()

      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await preencherLinha(user, 1, '0', '1.000', '0')
      await user.click(botaoSalvar())

      expect(screen.queryByText('Selecione o dashboard.')).not.toBeInTheDocument()
      expect(onSalvar).toHaveBeenCalledTimes(1)
    })
  })

  describe('salvar', () => {
    it('com "Todas as filiais": chama onSalvar com dashboard (id), filial escolhida, descrição sem espaços nas pontas e faixas numéricas', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      await user.selectOptions(campoFilial(), '101')
      await colar(user, campoDescricao(), '  Resultado operacional  ')
      await preencherLinha(user, 1, '0', '1.000,00', '0')
      await user.click(screen.getByRole('button', { name: /Adicionar faixa/ }))
      await preencherLinha(user, 2, '1.000,01', '2.000', '1,5')
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({
        dashboard: 2,
        filial: '101',
        descricao: 'Resultado operacional',
        faixas: [
          { de: 0, ate: 1000, aliquota: 0 },
          { de: 1000.01, ate: 2000, aliquota: 1.5 },
        ],
      })
    })

    it('com uma filial no cabeçalho: envia a filial do cabeçalho; descrição vazia vai como null', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialFixa: CAMPO_GRANDE })

      await user.selectOptions(campoDashboard(), 'PED Supervisores')
      await preencherLinha(user, 1, '0', '500', '2')
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledWith({
        dashboard: 3,
        filial: '101',
        descricao: null,
        faixas: [{ de: 0, ate: 500, aliquota: 2 }],
      })
    })
  })

  describe('orientação quando já existe tabela para o dashboard e a filial (RF-42, RN-14)', () => {
    it('com "Todas as filiais": PED Comercial + filial 101 mostra a orientação e desabilita o salvar; filial 100 não', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoDashboard(), 'PED Comercial')
      expect(screen.queryByText(NOTA_JA_EXISTE)).not.toBeInTheDocument()

      await user.selectOptions(campoFilial(), '101')
      expect(screen.getByText(NOTA_JA_EXISTE)).toBeInTheDocument()
      expect(botaoSalvar()).toBeDisabled()

      await user.selectOptions(campoFilial(), '100')
      expect(screen.queryByText(NOTA_JA_EXISTE)).not.toBeInTheDocument()
      expect(botaoSalvar()).toBeEnabled()
    })

    it('com a filial 101 no cabeçalho: escolher PED Comercial mostra a orientação; PED Gerentes não', async () => {
      const user = usuarioRapido()
      renderizar({ filialFixa: CAMPO_GRANDE })

      await user.selectOptions(campoDashboard(), 'PED Comercial')
      expect(screen.getByText(NOTA_JA_EXISTE)).toBeInTheDocument()
      expect(botaoSalvar()).toBeDisabled()

      await user.selectOptions(campoDashboard(), 'PED Gerentes')
      expect(screen.queryByText(NOTA_JA_EXISTE)).not.toBeInTheDocument()
    })
  })

  describe('estado de gravação e erro da API', () => {
    it('salvando: "Salvar tabela de faixas" fica desabilitado', () => {
      renderizar({ salvando: true })

      expect(botaoSalvar()).toBeDisabled()
    })

    it('erro da API é exibido como alerta dentro do formulário', () => {
      renderizar({ erro: 'Já existe uma tabela de faixas para este dashboard nesta filial.' })

      expect(screen.getByRole('alert')).toHaveTextContent('Já existe uma tabela de faixas para este dashboard nesta filial.')
    })

    it('"Cancelar" chama onCancelar sem salvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })
})
