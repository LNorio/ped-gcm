import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraDashboard, paraIndicador } from '../../services/adaptadores'
import type { DetalheDashboard, PreviaTarefa } from '../../services/dashboardsService'
import {
  CARGOS_VINCULO,
  COLABORADORES_VINCULO,
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_GERENTES_API,
  FILIAIS_VINCULO,
  dadosExternosParaDashboardApi,
  indicadoresParaDashboardApi,
} from '../../test/dashboardsFalsos'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { DadosDashboard } from '../../types/dominio'
import { FormularioDashboard, type FormularioDashboardProps, type ListasFormularioDashboard } from './FormularioDashboard'

const LISTAS: ListasFormularioDashboard = {
  indicadores: indicadoresParaDashboardApi().map(paraIndicador),
  dadosExternos: dadosExternosParaDashboardApi().map(paraDadoExterno),
  filiais: FILIAIS_VINCULO,
  cargos: CARGOS_VINCULO,
  colaboradores: COLABORADORES_VINCULO,
}

const AVISO =
  'Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador.'
const ERRO_CALCULO = 'Selecione o cálculo no período.'
const ATRASO_PREVIA_MS = 500

/** PED Comercial (trimestral, por filiais) com o cálculo de cada indicador gravado. */
const COMERCIAL: DetalheDashboard = {
  ...paraDashboard(DASHBOARD_COMERCIAL_API),
  codigosVinculados: ['100', '101', '102'],
  pontuacaoBaseMaxima: 100,
  indicadorBaseDaFaixa: 3,
  formulaDePontuacao: 'Soma ponderada dos atingimentos, limitada a 120% por indicador.',
  observacaoParaTi: null,
  indicadores: [
    { id: 1, nome: 'Cobertura de visitas', pontosBase: 40, calculoNoPeriodo: 'media', ativo: true, problema: null },
    { id: 3, nome: 'Faturamento líquido mensal', pontosBase: 60, calculoNoPeriodo: 'soma', ativo: true, problema: null },
  ],
  periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
}

/** Dashboard não mensal cadastrado antes da mudança: o detalhe vem sem o cálculo (null). */
const COMERCIAL_SEM_CALCULO: DetalheDashboard = {
  ...COMERCIAL,
  indicadores: COMERCIAL.indicadores.map((item) => ({ ...item, calculoNoPeriodo: null })),
}

/** PED Gerentes (mensal). */
const GERENTES: DetalheDashboard = {
  ...paraDashboard(DASHBOARD_GERENTES_API),
  codigosVinculados: ['Gerente de Loja'],
  pontuacaoBaseMaxima: 50,
  indicadorBaseDaFaixa: 3,
  formulaDePontuacao: 'Atingimento médio ponderado pelos pontos base.',
  observacaoParaTi: null,
  indicadores: [{ id: 3, nome: 'Faturamento líquido mensal', pontosBase: 50, calculoNoPeriodo: null, ativo: true, problema: null }],
  periodo: null,
}

/** Cadastro esperado do preenchimento padrão (`preencher`), em periodicidade trimestral. */
const ESPERADO_TRIMESTRAL: DadosDashboard = {
  nome: 'PED Vendedores',
  periodicidade: 'trimestral',
  pontuacaoBaseMaxima: 100,
  tipoVinculo: 'cargos',
  itensVinculados: ['Vendedor'],
  indicadores: [
    { idIndicador: 1, pontosBase: 40, calculoNoPeriodo: 'soma' },
    { idIndicador: 3, pontosBase: 60, calculoNoPeriodo: 'ultimo' },
  ],
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'Soma simples.',
  observacaoParaTi: null,
}

/**
 * Interface (F7.15): o `FormularioDashboard` não ganha props novas. Com a periodicidade diferente de
 * `mensal`, passa `mostrarCalculoNoPeriodo` e `errosCalculo` à `SecaoIndicadores`, exige o cálculo de cada
 * indicador e envia `calculoNoPeriodo` em cada item de `indicadores`. Decisão (documentada aqui): ao voltar
 * para `mensal`, os cálculos escolhidos deixam de ser enviados, mas ficam guardados enquanto o formulário
 * está aberto e reaparecem ao voltar para uma periodicidade não mensal.
 */
describe('F7.15 — FormularioDashboard: cálculo no período dos indicadores em dashboard não mensal', () => {
  function renderizar(props: Partial<FormularioDashboardProps> = {}) {
    const onPrevia = props.onPrevia ?? vi.fn<(dados: DadosDashboard) => Promise<PreviaTarefa>>().mockResolvedValue({ titulo: 'T', descricao: 'D' })
    const onSalvar = vi.fn<(dados: DadosDashboard) => void>()
    render(
      <FormularioDashboard
        dashboard={props.dashboard ?? null}
        tarefas={[]}
        listas={LISTAS}
        carregandoListas={false}
        erroListas={null}
        onPrevia={onPrevia}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onPrevia, onSalvar }
  }

  const periodicidade = () => screen.getByRole('combobox', { name: 'Periodicidade de lançamento' })
  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const calculo = (nome: string) => within(grupo()).getByRole('combobox', { name: `Cálculo no período de ${nome}` })
  const consultarCalculo = (nome: string) => within(grupo()).queryByRole('combobox', { name: `Cálculo no período de ${nome}` })
  const salvarCadastro = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })
  const salvarEdicao = () => screen.getByRole('button', { name: 'Salvar alterações' })

  async function escolherIndicador(user: Usuario, nome: string) {
    const botao = within(grupo()).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)
    await user.click(within(within(grupo()).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', { name: (n) => n.startsWith(nome) }))
  }

  /** Cadastro válido, exceto o cálculo no período: cargo Vendedor, Cobertura de visitas (40) e Faturamento líquido mensal (60). */
  async function preencher(user: Usuario, rotuloPeriodicidade = 'Trimestral') {
    await colar(user, screen.getByRole('textbox', { name: 'Nome do dashboard' }), 'PED Vendedores')
    await user.selectOptions(periodicidade(), rotuloPeriodicidade)
    await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '100')
    await user.click(screen.getByRole('button', { name: 'Selecionar cargo de colaboradores' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Cargos vinculados' })).getByRole('option', { name: (n) => n.startsWith('Vendedor') }),
    )
    await escolherIndicador(user, 'Cobertura de visitas')
    await escolherIndicador(user, 'Faturamento líquido mensal')
    await user.type(screen.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '40')
    await user.type(screen.getByRole('textbox', { name: 'Pontos base de Faturamento líquido mensal neste dashboard' }), '60')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Indicador base da faixa' }), 'Cobertura de visitas')
    await colar(user, screen.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Soma simples.')
  }

  async function escolherCalculos(user: Usuario) {
    await user.selectOptions(calculo('Cobertura de visitas'), 'Somar')
    await user.selectOptions(calculo('Faturamento líquido mensal'), 'Usar só o último valor')
  }

  describe('exibição conforme a periodicidade', () => {
    it('Mensal (padrão do cadastro): os indicadores não têm "Cálculo no período" e o aviso não aparece', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')

      expect(periodicidade()).toHaveValue('mensal')
      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })

    it.each(['Bimestral', 'Trimestral', 'Semestral', 'Anual'])('%s: cada indicador mostra o select vazio e a seção mostra o aviso', async (rotulo) => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await escolherIndicador(user, 'Faturamento líquido mensal')
      await user.selectOptions(periodicidade(), rotulo)

      expect(calculo('Cobertura de visitas')).toHaveValue('')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('')
      expect(within(calculo('Cobertura de visitas')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
        'Selecione',
        'Somar',
        'Fazer a média',
        'Usar só o último valor',
      ])
      expect(within(grupo()).getByText(AVISO).closest('[role="note"]')).not.toBeNull()
    })

    it('voltar para Mensal esconde os selects e o aviso', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await user.selectOptions(periodicidade(), 'Semestral')
      await user.selectOptions(periodicidade(), 'Mensal')

      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })
  })

  describe('validação e gravação do cadastro', () => {
    it(`sem escolher o cálculo: "${ERRO_CALCULO}" no campo de cada indicador e onSalvar não é chamado`, async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await user.click(salvarCadastro())

      for (const nome of ['Cobertura de visitas', 'Faturamento líquido mensal']) {
        expect(calculo(nome)).toHaveAttribute('aria-invalid', 'true')
        expect(calculo(nome)).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      }
      expect(screen.getAllByText(ERRO_CALCULO)).toHaveLength(2)
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('só o indicador sem cálculo fica com o erro', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await user.selectOptions(calculo('Cobertura de visitas'), 'Fazer a média')
      await user.click(salvarCadastro())

      expect(calculo('Cobertura de visitas')).not.toHaveAttribute('aria-invalid')
      expect(calculo('Faturamento líquido mensal')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      expect(screen.getAllByText(ERRO_CALCULO)).toHaveLength(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('escolher o cálculo limpa o erro daquele indicador, mantendo o do outro', async () => {
      const user = usuarioRapido()
      renderizar()

      await preencher(user)
      await user.click(salvarCadastro())
      await user.selectOptions(calculo('Cobertura de visitas'), 'Somar')

      expect(calculo('Cobertura de visitas')).not.toHaveAttribute('aria-invalid')
      expect(calculo('Faturamento líquido mensal')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getAllByText(ERRO_CALCULO)).toHaveLength(1)
    })

    it('o erro do cálculo aparece junto dos erros dos demais campos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(periodicidade(), 'Anual')
      await escolherIndicador(user, 'Cobertura de visitas')
      await user.click(salvarCadastro())

      expect(screen.getByText('Informe o nome do dashboard.')).toBeInTheDocument()
      expect(calculo('Cobertura de visitas')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
    })

    it('com o cálculo de todos os indicadores: onSalvar recebe calculoNoPeriodo em cada indicador', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await user.click(salvarCadastro())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(ESPERADO_TRIMESTRAL)
      expect(screen.queryByText(ERRO_CALCULO)).not.toBeInTheDocument()
    })

    it('Mensal: não exige o cálculo e os indicadores vão sem calculoNoPeriodo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user, 'Mensal')
      await user.click(salvarCadastro())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      const dados = onSalvar.mock.calls[0][0]
      expect(dados.periodicidade).toBe('mensal')
      expect(dados.indicadores).toEqual([
        { idIndicador: 1, pontosBase: 40 },
        { idIndicador: 3, pontosBase: 60 },
      ])
      for (const item of dados.indicadores) expect(item.calculoNoPeriodo).toBeUndefined()
    })

    it('trocar de Trimestral para Mensal depois de escolher: os cálculos deixam de ser enviados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await user.selectOptions(periodicidade(), 'Mensal')
      await user.click(salvarCadastro())

      const dados = onSalvar.mock.calls[0][0]
      expect(dados.periodicidade).toBe('mensal')
      for (const item of dados.indicadores) expect(item.calculoNoPeriodo).toBeUndefined()
    })

    it('trocar para Mensal com o erro do cálculo na tela: o erro some com o campo e salvar passa', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await user.click(salvarCadastro())
      await user.selectOptions(periodicidade(), 'Mensal')

      expect(screen.queryByText(ERRO_CALCULO)).not.toBeInTheDocument()
      await user.click(salvarCadastro())
      expect(onSalvar).toHaveBeenCalledTimes(1)
    })

    it('decisão: os cálculos ficam guardados ao voltar de Mensal para uma periodicidade não mensal (formulário aberto)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await user.selectOptions(periodicidade(), 'Mensal')
      await user.selectOptions(periodicidade(), 'Trimestral')

      expect(calculo('Cobertura de visitas')).toHaveValue('soma')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('ultimo')
      await user.click(salvarCadastro())
      expect(onSalvar).toHaveBeenCalledWith(ESPERADO_TRIMESTRAL)
    })

    it('remover um indicador leva junto o cálculo dele; o restante segue no envio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await user.click(within(grupo()).getByRole('button', { name: 'Remover Faturamento líquido mensal' }))
      const pontos = screen.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' })
      await user.clear(pontos)
      await user.type(pontos, '100')
      await user.click(salvarCadastro())

      expect(onSalvar).toHaveBeenCalledWith({ ...ESPERADO_TRIMESTRAL, indicadores: [{ idIndicador: 1, pontosBase: 100, calculoNoPeriodo: 'soma' }] })
    })
  })

  describe('edição', () => {
    it('dashboard trimestral: os selects vêm preenchidos com o cálculo gravado de cada indicador, e o aviso aparece', () => {
      renderizar({ dashboard: COMERCIAL })

      expect(calculo('Cobertura de visitas')).toHaveValue('media')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('soma')
      expect(screen.getByText(AVISO)).toBeInTheDocument()
    })

    it('"Salvar alterações" sem mexer envia os cálculos gravados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: COMERCIAL })

      await user.click(salvarEdicao())

      expect(onSalvar).toHaveBeenCalledWith(
        expect.objectContaining({
          periodicidade: 'trimestral',
          indicadores: [
            { idIndicador: 1, pontosBase: 40, calculoNoPeriodo: 'media' },
            { idIndicador: 3, pontosBase: 60, calculoNoPeriodo: 'soma' },
          ],
          enviarTarefaTi: false,
        }),
      )
    })

    it('trocar o cálculo na edição envia o novo valor', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: COMERCIAL })

      await user.selectOptions(calculo('Cobertura de visitas'), 'Usar só o último valor')
      await user.click(salvarEdicao())

      expect(onSalvar.mock.calls[0][0].indicadores).toEqual([
        { idIndicador: 1, pontosBase: 40, calculoNoPeriodo: 'ultimo' },
        { idIndicador: 3, pontosBase: 60, calculoNoPeriodo: 'soma' },
      ])
    })

    it('dashboard não mensal sem cálculo gravado (cadastrado antes da mudança): selects vazios e salvar exige escolher', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: COMERCIAL_SEM_CALCULO })

      expect(calculo('Cobertura de visitas')).toHaveValue('')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('')
      await user.click(salvarEdicao())

      expect(screen.getAllByText(ERRO_CALCULO)).toHaveLength(2)
      expect(onSalvar).not.toHaveBeenCalled()

      await user.selectOptions(calculo('Cobertura de visitas'), 'Somar')
      await user.selectOptions(calculo('Faturamento líquido mensal'), 'Fazer a média')
      await user.click(salvarEdicao())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar.mock.calls[0][0].indicadores).toEqual([
        { idIndicador: 1, pontosBase: 40, calculoNoPeriodo: 'soma' },
        { idIndicador: 3, pontosBase: 60, calculoNoPeriodo: 'media' },
      ])
    })

    it('dashboard mensal: sem select nem aviso, e a edição envia os indicadores sem calculoNoPeriodo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: GERENTES })

      expect(consultarCalculo('Faturamento líquido mensal')).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
      await user.click(salvarEdicao())

      const [item] = onSalvar.mock.calls[0][0].indicadores
      expect(item).toEqual({ idIndicador: 3, pontosBase: 50 })
      expect(item.calculoNoPeriodo).toBeUndefined()
    })

    it('mudar um dashboard trimestral para Mensal na edição: os cálculos deixam de ser enviados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: COMERCIAL })

      await user.selectOptions(periodicidade(), 'Mensal')
      await user.click(salvarEdicao())

      const dados = onSalvar.mock.calls[0][0]
      expect(dados.periodicidade).toBe('mensal')
      for (const item of dados.indicadores) expect(item.calculoNoPeriodo).toBeUndefined()
    })

    it('mudar um dashboard mensal para Semestral na edição: passa a exigir o cálculo de cada indicador', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: GERENTES })

      await user.selectOptions(periodicidade(), 'Semestral')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('')
      await user.click(salvarEdicao())

      expect(calculo('Faturamento líquido mensal')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('prévia da tarefa de construção (F7.7)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function avancar(ms = ATRASO_PREVIA_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }

    it('sem o cálculo de todos os indicadores, a prévia não é consultada e nenhum erro aparece (validação silenciosa)', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await preencher(user)
      await user.selectOptions(calculo('Cobertura de visitas'), 'Somar')
      await avancar(ATRASO_PREVIA_MS + 100)

      expect(onPrevia).not.toHaveBeenCalled()
      expect(screen.queryByText(ERRO_CALCULO)).not.toBeInTheDocument()
      expect(screen.getByText('Preencha os dados do dashboard para ver o título e a descrição da tarefa.')).toBeInTheDocument()
    })

    it('com o cálculo de todos os indicadores, onPrevia recebe calculoNoPeriodo em cada indicador', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await avancar()

      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(1))
      expect(onPrevia).toHaveBeenCalledWith(ESPERADO_TRIMESTRAL)
    })

    it('trocar o cálculo de um indicador gera nova prévia com o valor novo', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await preencher(user)
      await escolherCalculos(user)
      await avancar()
      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(1))

      await user.selectOptions(calculo('Cobertura de visitas'), 'Fazer a média')
      await avancar()

      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(2))
      expect(onPrevia).toHaveBeenLastCalledWith({
        ...ESPERADO_TRIMESTRAL,
        indicadores: [
          { idIndicador: 1, pontosBase: 40, calculoNoPeriodo: 'media' },
          { idIndicador: 3, pontosBase: 60, calculoNoPeriodo: 'ultimo' },
        ],
      })
    })
  })
})
