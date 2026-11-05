import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraDashboard, paraIndicador } from '../../services/adaptadores'
import type { DetalheDashboard, TarefaDashboard } from '../../services/dashboardsService'
import {
  CARGOS_VINCULO,
  COLABORADORES_VINCULO,
  DASHBOARD_GERENTES_API,
  DASHBOARD_SUPERVISORES_API,
  FILIAIS_VINCULO,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API,
  dadosExternosParaDashboardApi,
  indicadoresParaDashboardApi,
} from '../../test/dashboardsFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import type { DadosDashboard } from '../../types/dominio'
import { FormularioDashboard, type FormularioDashboardProps, type ListasFormularioDashboard } from './FormularioDashboard'

const LISTAS: ListasFormularioDashboard = {
  indicadores: indicadoresParaDashboardApi().map(paraIndicador),
  dadosExternos: dadosExternosParaDashboardApi().map(paraDadoExterno),
  filiais: FILIAIS_VINCULO,
  cargos: CARGOS_VINCULO,
  colaboradores: COLABORADORES_VINCULO,
}

/** Detalhe do PED Gerentes (ativo, por cargo; Custo de frete ficou com componente desativado depois de vinculado). */
const GERENTES: DetalheDashboard = {
  ...paraDashboard(DASHBOARD_GERENTES_API),
  codigosVinculados: ['Gerente de Loja'],
  pontuacaoBaseMaxima: 50,
  indicadorBaseDaFaixa: 3,
  formulaDePontuacao: 'Atingimento médio ponderado pelos pontos base.',
  observacaoParaTi: 'Usar a mesma régua do PED Comercial.',
  indicadores: [
    { id: 3, nome: 'Faturamento líquido mensal', pontosBase: 30, ativo: true, problema: null },
    { id: 6, nome: 'Custo de frete por entrega', pontosBase: 20, ativo: true, problema: 'Todos os apontamentos estão desativados' },
  ],
  periodo: { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' },
}

/** PED Gerentes gravado antes da regra de 2026-11-05: o indicador base (Cobertura de visitas, id 1) não está entre os vinculados. */
const GERENTES_BASE_FORA: DetalheDashboard = { ...GERENTES, indicadorBaseDaFaixa: 1 }

const SUPERVISORES: DetalheDashboard = {
  ...paraDashboard(DASHBOARD_SUPERVISORES_API),
  codigosVinculados: ['16', '11'],
  pontuacaoBaseMaxima: 120,
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'Pontos base × atingimento, sem limite.',
  observacaoParaTi: null,
  indicadores: [
    { id: 1, nome: 'Cobertura de visitas', pontosBase: 70, ativo: true, problema: null },
    { id: 8, nome: 'Vendas por zona', pontosBase: 50, ativo: true, problema: null },
  ],
  periodo: null,
}

/**
 * Detalhe real de 05/11/2026 (bug da edição), já convertido pelo serviço: `itensVinculados` traz o rótulo
 * de exibição ("100 - Filial 100") e `codigosVinculados` o código que o PUT espera ("100").
 */
const TESTE_FILIAL: DetalheDashboard = {
  ...paraDashboard(RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API[0]),
  itensVinculados: ['100 - Filial 100'],
  codigosVinculados: ['100'],
  quantidadeDeIndicadores: 3,
  pontuacaoBaseMaxima: 100,
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'teste indicador',
  observacaoParaTi: 'teste',
  indicadores: [
    { id: 3, nome: 'teste 2', pontosBase: 50, ativo: true, problema: null },
    { id: 1, nome: 'teste indicador', pontosBase: 30, ativo: true, problema: null },
    { id: 4, nome: 'testes', pontosBase: 20, ativo: true, problema: null },
  ],
  periodo: { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' },
}

/** O que a edição do detalhe real envia sem nenhuma mudança: o vínculo vai pelo código. */
const TESTE_FILIAL_SEM_MUDANCA: DadosDashboard = {
  nome: 'teste',
  periodicidade: 'mensal',
  pontuacaoBaseMaxima: 100,
  tipoVinculo: 'filiais',
  itensVinculados: ['100'],
  indicadores: [
    { idIndicador: 3, pontosBase: 50 },
    { idIndicador: 1, pontosBase: 30 },
    { idIndicador: 4, pontosBase: 20 },
  ],
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'teste indicador',
  observacaoParaTi: 'teste',
  enviarTarefaTi: false,
}

/** Na ordem da API: da mais antiga à mais recente. */
const TAREFAS: TarefaDashboard[] = [
  { id: 21, tipo: 'construcao', status: 'concluida', titulo: '[PED] Construir dashboard: PED Gerentes', descricao: null, criadaEm: '2026-08-01 10:00:00' },
  { id: 25, tipo: 'modificacao', status: 'concluida', titulo: '[PED] Modificar dashboard: PED Gerentes', descricao: null, criadaEm: '2026-09-10 14:00:00' },
]

const TEXTO_CAIXA = 'Enviar tarefa à TI para realizar as modificações'
const APOIO_CAIXA =
  'Opcional. Marque quando a alteração exigir ajuste na construção do dashboard pela equipe de TI. Enquanto a TI não concluir, o dashboard fica inativo.'
const BLOCO = 'Tarefa de modificação que será enviada ao Bitrix24'
const AVISO = 'Ao enviar, o dashboard fica inativo (em modificação) até a TI concluir a tarefa.'

/** O que a edição envia sem nenhuma mudança (a observação do cadastro segue inalterada). */
const SEM_MUDANCA: DadosDashboard = {
  nome: 'PED Gerentes',
  periodicidade: 'mensal',
  pontuacaoBaseMaxima: 50,
  tipoVinculo: 'cargos',
  itensVinculados: ['Gerente de Loja'],
  indicadores: [
    { idIndicador: 3, pontosBase: 30 },
    { idIndicador: 6, pontosBase: 20 },
  ],
  indicadorBaseDaFaixa: 3,
  formulaDePontuacao: 'Atingimento médio ponderado pelos pontos base.',
  observacaoParaTi: 'Usar a mesma régua do PED Comercial.',
  enviarTarefaTi: false,
}

describe('F7.8 — FormularioDashboard: edição com "Enviar tarefa à TI" e tarefas anteriores (RF-56, RN-15, INT-04, protótipo dashModal)', () => {
  function renderizar(props: Partial<FormularioDashboardProps> = {}) {
    const onPrevia = vi.fn().mockResolvedValue({ titulo: 'T', descricao: 'D' })
    const onSalvar = vi.fn<(dados: DadosDashboard) => void>()
    render(
      <FormularioDashboard
        dashboard={props.dashboard === undefined ? GERENTES : props.dashboard}
        tarefas={props.tarefas ?? TAREFAS}
        listas={LISTAS}
        carregandoListas={false}
        erroListas={null}
        onPrevia={onPrevia}
        salvando={props.salvando ?? false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onPrevia, onSalvar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome do dashboard' })
  const pontuacao = () => screen.getByRole('textbox', { name: 'Pontuação base máxima' })
  const enviarTarefa = () => screen.getByRole('checkbox', { name: (n) => n.startsWith(TEXTO_CAIXA) })
  const bloco = () => screen.getByRole('region', { name: BLOCO })
  /** Elemento cujo texto completo é exatamente `texto` (sem um filho com o mesmo texto). */
  const textoExato = (texto: string) => (_conteudo: string, elemento: Element | null) =>
    elemento?.textContent === texto && Array.from(elemento.children).every((filho) => filho.textContent !== texto)
  const indicadorBase = () => screen.getByRole('combobox', { name: 'Indicador base da faixa' })
  const textos = (select: HTMLElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)

  describe('dados', () => {
    it('abre preenchido com os dados do dashboard: nome, periodicidade, base da faixa, fórmula, vínculo e indicadores com os pontos', () => {
      renderizar()

      expect(nome()).toHaveValue('PED Gerentes')
      expect(screen.getByRole('combobox', { name: 'Periodicidade de lançamento' })).toHaveValue('mensal')
      expect(screen.getByRole('combobox', { name: 'Indicador base da faixa' })).toHaveValue('3')
      expect(screen.getByRole('textbox', { name: 'Fórmula de pontuação' })).toHaveValue('Atingimento médio ponderado pelos pontos base.')
      expect(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })).toHaveTextContent('Cargos de colaboradores')
      const cargos = within(screen.getByRole('list', { name: 'Cargos escolhidos' })).getAllByRole('listitem')
      expect(cargos.map((item) => item.textContent)).toEqual([expect.stringMatching(/^Gerente de Loja/)])
      expect(screen.getByRole('textbox', { name: 'Pontos base de Faturamento líquido mensal neste dashboard' })).toHaveValue('30')
      expect(screen.getByRole('textbox', { name: 'Pontos base de Custo de frete por entrega neste dashboard' })).toHaveValue('20')
      expect(screen.getByText('Total correto: 50 pts')).toBeInTheDocument()
    })

    it('ordem na edição: dados básicos, vínculo, "Indicadores vinculados", "Indicador base da faixa" e "Fórmula de pontuação", depois a caixa da tarefa', () => {
      renderizar()

      const grupo = screen.getByRole('group', { name: 'Indicadores vinculados' })
      const sequencia = [
        nome(),
        screen.getByRole('combobox', { name: 'Periodicidade de lançamento' }),
        pontuacao(),
        screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' }),
        grupo,
        indicadorBase(),
        screen.getByRole('textbox', { name: 'Fórmula de pontuação' }),
        enviarTarefa(),
      ]
      for (let i = 1; i < sequencia.length; i++) {
        expect(sequencia[i - 1]).not.toContainElement(sequencia[i])
        expect(sequencia[i - 1].compareDocumentPosition(sequencia[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
    })

    it('"Indicador base da faixa" abre com a base gravada e oferece só os indicadores vinculados ao dashboard, na ordem do detalhe', () => {
      renderizar()

      expect(indicadorBase()).toBeEnabled()
      expect(indicadorBase()).toHaveValue('3')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Faturamento líquido mensal', 'Custo de frete por entrega'])
    })

    it('base gravada fora dos indicadores vinculados (dado antigo): o campo abre vazio e salvar exige escolher um dos vinculados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: GERENTES_BASE_FORA })

      expect(indicadorBase()).toHaveValue('')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Faturamento líquido mensal', 'Custo de frete por entrega'])

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(indicadorBase()).toHaveAccessibleDescription(expect.stringContaining('Selecione o indicador base da faixa.'))
      expect(onSalvar).not.toHaveBeenCalled()

      await user.selectOptions(indicadorBase(), 'Custo de frete por entrega')
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({ ...SEM_MUDANCA, indicadorBaseDaFaixa: 6 })
    })

    it('remover o indicador base dos vinculados na edição deixa o campo vazio e salvar mostra o erro obrigatório', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Remover Faturamento líquido mensal' }))

      expect(indicadorBase()).toHaveValue('')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Custo de frete por entrega'])
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(screen.getByText('Selecione o indicador base da faixa.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a pontuação base máxima aparece travada, com " pts", e a explicação de que não muda (RN-15)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(pontuacao()).toHaveValue('50 pts')
      expect(pontuacao()).toHaveAttribute('readonly')
      expect(pontuacao()).toHaveAccessibleDescription(
        expect.stringContaining('Definida no cadastro e não pode ser alterada. A soma dos pontos base precisa ser igual a este valor.'),
      )
      await user.type(pontuacao(), '9')
      expect(pontuacao()).toHaveValue('50 pts')
    })

    it('indicador já vinculado que ficou com componente desativado continua no dashboard, com a etiqueta "⚠ {motivo}"', () => {
      renderizar()

      const item = within(screen.getByRole('list', { name: 'Indicadores escolhidos' }))
        .getAllByRole('listitem')
        .find((li) => (li.textContent ?? '').startsWith('Custo de frete por entrega'))!
      expect(within(item).getByText('⚠ Componente desativado')).toBeInTheDocument()
    })

    it('as regras de validação continuam valendo na edição (ex.: soma dos pontos diferente da máxima)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      const campo = screen.getByRole('textbox', { name: 'Pontos base de Faturamento líquido mensal neste dashboard' })
      await user.clear(campo)
      await user.type(campo, '20')
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        screen.getByText('A soma dos pontos base dos indicadores deve ser exatamente igual à pontuação base máxima (50 pts). Total atual: 40 pts.'),
      ).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('vínculo a partir dos códigos do detalhe (codigosVinculados), não dos rótulos (itensVinculados)', () => {
    const filiaisEscolhidas = () =>
      within(screen.getByRole('list', { name: 'Filiais escolhidas' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

    it('a filial 100 aparece escolhida, com o nome vindo da lista de filiais ("100 - MATRIZ"), e o rótulo da API não aparece', () => {
      renderizar({ dashboard: TESTE_FILIAL, tarefas: [] })

      expect(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })).toHaveTextContent('Filiais')
      expect(filiaisEscolhidas()).toEqual([expect.stringMatching(/^100 - MATRIZ/)])
      expect(screen.getByRole('button', { name: 'Remover 100 - MATRIZ' })).toBeInTheDocument()
      expect(screen.queryByText('Nenhuma filial selecionada.')).not.toBeInTheDocument()
      expect(screen.queryByText(/Filial 100/)).not.toBeInTheDocument()
    })

    it('"Salvar alterações" sem mexer envia itensVinculados ["100"] (o código), sem o rótulo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: TESTE_FILIAL, tarefas: [] })

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(TESTE_FILIAL_SEM_MUDANCA)
      expect(onSalvar.mock.calls[0][0].itensVinculados).not.toContain('100 - Filial 100')
    })

    it('a filial 100 não é oferecida de novo; escolher outra filial envia só códigos, sem duplicar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: TESTE_FILIAL, tarefas: [] })

      await user.click(screen.getByRole('button', { name: 'Selecionar filial' }))
      const lista = within(screen.getByRole('listbox', { name: 'Filiais vinculadas' }))
      const opcoes = lista.getAllByRole('option').map((opcao) => opcao.textContent ?? '')
      expect(opcoes.some((texto) => texto.startsWith('100 - MATRIZ'))).toBe(false)
      await user.click(lista.getByRole('option', { name: (n) => n.startsWith('101 - CAMPO GRANDE') }))
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(filiaisEscolhidas()).toEqual([expect.stringMatching(/^100 - MATRIZ/), expect.stringMatching(/^101 - CAMPO GRANDE/)])
      expect(onSalvar).toHaveBeenCalledWith({ ...TESTE_FILIAL_SEM_MUDANCA, itensVinculados: ['100', '101'] })
    })

    it('código que não está na lista carregada aparece como item escolhido pelo próprio código ("Remover 999") e segue no envio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: { ...TESTE_FILIAL, codigosVinculados: ['100', '999'] }, tarefas: [] })

      expect(filiaisEscolhidas()).toEqual([expect.stringMatching(/^100 - MATRIZ/), expect.stringMatching(/^999/)])
      expect(screen.getByRole('button', { name: 'Remover 999' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onSalvar).toHaveBeenCalledWith({ ...TESTE_FILIAL_SEM_MUDANCA, itensVinculados: ['100', '999'] })
    })

    it('código fora da lista removido com "Remover 999" não é enviado', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: { ...TESTE_FILIAL, codigosVinculados: ['100', '999'] }, tarefas: [] })

      await user.click(screen.getByRole('button', { name: 'Remover 999' }))
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(filiaisEscolhidas()).toEqual([expect.stringMatching(/^100 - MATRIZ/)])
      expect(onSalvar).toHaveBeenCalledWith(TESTE_FILIAL_SEM_MUDANCA)
    })

    it('colaboradores: os ids do detalhe marcam os colaboradores pelo nome da lista e o envio leva os ids numéricos', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: { ...SUPERVISORES, itensVinculados: ['Fábio Nunes', 'Ana Souza'] }, tarefas: [] })

      const colaboradores = within(screen.getByRole('list', { name: 'Colaboradores escolhidos' })).getAllByRole('listitem')
      expect(colaboradores.map((item) => item.textContent)).toEqual([expect.stringMatching(/^Fábio Nunes/), expect.stringMatching(/^Ana Souza/)])
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ tipoVinculo: 'colaboradores', itensVinculados: [16, 11] }))
    })

    it('cargos: os nomes do detalhe (codigosVinculados) marcam os cargos e o envio leva os nomes, não o rótulo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ dashboard: { ...GERENTES, itensVinculados: ['Gerente de Loja (2 colaboradores)'] } })

      const cargos = within(screen.getByRole('list', { name: 'Cargos escolhidos' })).getAllByRole('listitem')
      expect(cargos.map((item) => item.textContent)).toEqual([expect.stringMatching(/^Gerente de Loja/)])
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onSalvar).toHaveBeenCalledWith(SEM_MUDANCA)
    })
  })

  describe('"Enviar tarefa à TI para realizar as modificações"', () => {
    it('a caixa tem o texto de apoio do protótipo e começa desmarcada; sem ela, nada da tarefa de modificação e botão "Salvar alterações"', () => {
      renderizar()

      expect(enviarTarefa()).not.toBeChecked()
      expect(screen.getByText(APOIO_CAIXA)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: BLOCO })).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: 'Observação para a TI (opcional)' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar alterações' })).toHaveAttribute('type', 'submit')
      expect(screen.queryByRole('button', { name: 'Ver prévia da tarefa' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Tarefa de construção que será criada no Bitrix24' })).not.toBeInTheDocument()
    })

    it('"Salvar alterações" chama onSalvar com enviarTarefaTi false e a observação do cadastro inalterada; o indicador com problema já vinculado não impede salvar', async () => {
      const user = usuarioRapido()
      const { onPrevia, onSalvar } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(onPrevia).not.toHaveBeenCalled()
      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(SEM_MUDANCA)
    })

    it('marcada: mostra o bloco "Tarefa de modificação que será enviada ao Bitrix24" com responsável, aviso, título "[PED] Modificar dashboard: {nome}" e a observação vazia', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.clear(nome())
      await colar(user, nome(), '  PED Gerentes de Loja ')
      await user.click(enviarTarefa())

      const b = within(bloco())
      expect(b.getByText(BLOCO)).toBeInTheDocument()
      expect(b.getByText('Responsável: Equipe de TI')).toBeInTheDocument()
      expect(b.getByText(AVISO)).toBeInTheDocument()
      expect(b.getByText('Título')).toBeInTheDocument()
      expect(b.getByText(textoExato('[PED] Modificar dashboard: PED Gerentes de Loja'))).toBeInTheDocument()
      expect(b.getByRole('textbox', { name: 'Observação para a TI (opcional)' })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Salvar e enviar tarefa à TI' })).toHaveAttribute('type', 'submit')
      expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument()
    })

    it('a edição nunca consulta a prévia da API (a rota só cobre o cadastro)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const user = usuarioRapido()
        const { onPrevia } = renderizar()

        await user.click(enviarTarefa())
        await user.type(nome(), ' 2')
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000)
        })

        expect(onPrevia).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('"Salvar e enviar tarefa à TI" envia enviarTarefaTi true e a observação digitada no bloco', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.clear(nome())
      await colar(user, nome(), 'PED Gerentes de Loja')
      await user.click(enviarTarefa())
      await colar(user, within(bloco()).getByRole('textbox', { name: 'Observação para a TI (opcional)' }), '  Trocar o nome no painel.  ')
      await user.click(screen.getByRole('button', { name: 'Salvar e enviar tarefa à TI' }))

      expect(onSalvar).toHaveBeenCalledWith({
        ...SEM_MUDANCA,
        nome: 'PED Gerentes de Loja',
        observacaoParaTi: 'Trocar o nome no painel.',
        enviarTarefaTi: true,
      })
    })

    it('marcada com a observação vazia: envia observacaoParaTi null', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(enviarTarefa())
      await user.click(screen.getByRole('button', { name: 'Salvar e enviar tarefa à TI' }))

      expect(onSalvar).toHaveBeenCalledWith({ ...SEM_MUDANCA, observacaoParaTi: null, enviarTarefaTi: true })
    })

    it('desmarcar volta ao botão "Salvar alterações" e esconde o bloco', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(enviarTarefa())
      await user.click(enviarTarefa())

      expect(screen.queryByRole('region', { name: BLOCO })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()
    })

    it('dashboard em construção: a caixa fica desabilitada, com o motivo', () => {
      renderizar({ dashboard: SUPERVISORES, tarefas: [] })

      expect(enviarTarefa()).toBeDisabled()
      expect(enviarTarefa()).toHaveAccessibleDescription(expect.stringContaining('Indisponível enquanto o dashboard está em construção.'))
      expect(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })).toHaveTextContent('Colaboradores específicos')
      const colaboradores = within(screen.getByRole('list', { name: 'Colaboradores escolhidos' })).getAllByRole('listitem')
      expect(colaboradores.map((item) => item.textContent)).toEqual([expect.stringMatching(/^Fábio Nunes/), expect.stringMatching(/^Ana Souza/)])
    })
  })

  describe('tarefas anteriores (RF-56)', () => {
    it('mostra "Tarefas anteriores: {tipo} nº {id} · {data e hora}", da mais recente à mais antiga, separadas por " | "', () => {
      renderizar()

      expect(
        screen.getByText(textoExato('Tarefas anteriores: Modificação nº 25 · 10/09/2026 14:00 | Construção nº 21 · 01/08/2026 10:00')),
      ).toBeInTheDocument()
    })

    it('ordena pela data de criação, mesmo que a API devolva em outra ordem', () => {
      renderizar({ tarefas: [TAREFAS[1], TAREFAS[0]] })

      expect(
        screen.getByText(textoExato('Tarefas anteriores: Modificação nº 25 · 10/09/2026 14:00 | Construção nº 21 · 01/08/2026 10:00')),
      ).toBeInTheDocument()
    })

    it('tarefa sem número (Bitrix24 ainda não integrado) aparece só com o tipo e a data', () => {
      renderizar({
        tarefas: [
          { id: null, tipo: 'construcao', status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Gerentes', descricao: null, criadaEm: '2026-11-04 17:10:00' },
        ],
      })

      expect(screen.getByText(textoExato('Tarefas anteriores: Construção · 04/11/2026 17:10'))).toBeInTheDocument()
    })

    it('sem tarefas anteriores, a linha não aparece', () => {
      renderizar({ tarefas: [] })

      expect(screen.queryByText(/Tarefas anteriores/)).not.toBeInTheDocument()
      expect(screen.queryByText('Nenhuma tarefa anterior.')).not.toBeInTheDocument()
    })
  })

  it('cadastro (sem dashboard) não mostra a caixa nem as tarefas anteriores', () => {
    renderizar({ dashboard: null, tarefas: [] })

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Tarefas anteriores/)).not.toBeInTheDocument()
  })
})
