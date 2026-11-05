import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { ApiError } from '../../services/api'
import type { PreviaTarefa } from '../../services/dashboardsService'
import {
  CARGOS_VINCULO,
  COLABORADORES_VINCULO,
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

const ATRASO_PREVIA_MS = 500
const BLOCO = 'Tarefa de construção que será criada no Bitrix24'
const ORIENTACAO = 'Preencha os dados do dashboard para ver o título e a descrição da tarefa.'

const PREVIA: PreviaTarefa = {
  titulo: '[PED] Construir dashboard: PED Supervisores',
  descricao: 'Construir o dashboard “PED Supervisores” no PED.\nPeriodicidade: Semestral',
}

/** Dados esperados do preenchimento padrão (`preencherTudo`). */
const ESPERADO: DadosDashboard = {
  nome: 'PED Supervisores',
  periodicidade: 'semestral',
  pontuacaoBaseMaxima: 120,
  tipoVinculo: 'colaboradores',
  itensVinculados: [16, 11],
  indicadores: [
    { idIndicador: 1, pontosBase: 70 },
    { idIndicador: 8, pontosBase: 50 },
  ],
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'Pontos base × atingimento, sem limite.',
  observacaoParaTi: 'Prioridade alta.',
}

describe('F7.7 — FormularioDashboard: tarefa de construção sempre visível e gravação do cadastro (RF-55, INT-04, protótipo dashModal)', () => {
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

  function renderizar(props: Partial<FormularioDashboardProps> = {}) {
    const onPrevia = props.onPrevia ?? vi.fn<(dados: DadosDashboard) => Promise<PreviaTarefa>>().mockResolvedValue(PREVIA)
    const onSalvar = props.onSalvar ?? vi.fn<(dados: DadosDashboard) => void>()
    const comum = {
      listas: LISTAS,
      carregandoListas: false,
      erroListas: null,
      onPrevia,
      onSalvar,
      onCancelar: vi.fn(),
    }
    const utils = render(<FormularioDashboard {...comum} salvando={props.salvando ?? false} erro={props.erro ?? null} />)
    return {
      ...utils,
      onPrevia,
      onSalvar,
      rerenderizar: (extra: Partial<FormularioDashboardProps>) =>
        utils.rerender(<FormularioDashboard {...comum} salvando={extra.salvando ?? false} erro={extra.erro ?? null} />),
    }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome do dashboard' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })
  const bloco = () => screen.getByRole('region', { name: BLOCO })
  const observacao = () => within(bloco()).getByRole('textbox', { name: 'Observação para a TI (opcional)' })
  const grupoIndicadores = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const indicadorBase = () => screen.getByRole('combobox', { name: 'Indicador base da faixa' })
  /** Elemento cujo texto completo (com as quebras de linha) é exatamente `texto`. */
  const textoExato = (texto: string) => (_conteudo: string, elemento: Element | null) =>
    elemento?.textContent === texto && Array.from(elemento.children).every((filho) => filho.textContent !== texto)

  async function abrirEEscolher(user: Usuario, escopo: HTMLElement, botao: string, lista: string, item: string) {
    const gatilho = within(escopo).getByRole('button', { name: botao })
    if (gatilho.getAttribute('aria-expanded') !== 'true') await user.click(gatilho)
    await user.click(within(within(escopo).getByRole('listbox', { name: lista })).getByRole('option', { name: (n) => n.startsWith(item) }))
  }

  async function escolherTipo(user: Usuario, rotulo: string) {
    await user.click(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', { name: (n) => n.startsWith(rotulo) }),
    )
  }

  /**
   * Preenche um cadastro válido, na ordem da tela: por colaboradores (Fábio Nunes e Ana Souza), 70 + 50 = 120 pontos e
   * o indicador base escolhido entre os vinculados (só depois de vincular os indicadores).
   */
  async function preencherTudo(user: Usuario, textoNome = '  PED Supervisores  ') {
    await colar(user, nome(), textoNome)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Periodicidade de lançamento' }), 'Semestral')
    await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '120')
    await escolherTipo(user, 'Colaboradores específicos')
    await abrirEEscolher(user, document.body, 'Selecionar colaborador', 'Colaboradores vinculados', 'Fábio Nunes')
    await abrirEEscolher(user, document.body, 'Selecionar colaborador', 'Colaboradores vinculados', 'Ana Souza')
    await abrirEEscolher(user, grupoIndicadores(), 'Selecionar indicador', 'Indicadores', 'Cobertura de visitas')
    await abrirEEscolher(user, grupoIndicadores(), 'Selecionar indicador', 'Indicadores', 'Vendas por zona')
    await user.type(screen.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '70')
    await user.type(screen.getByRole('textbox', { name: 'Pontos base de Vendas por zona neste dashboard' }), '50')
    await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
    await colar(user, screen.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Pontos base × atingimento, sem limite.')
    await colar(user, observacao(), 'Prioridade alta.')
  }

  describe('bloco da tarefa de construção', () => {
    it('aparece desde a abertura, com cabeçalho, "Responsável: Equipe de TI", aviso, orientação e a observação; sem "Ver prévia da tarefa" nem "Voltar"', async () => {
      const { onPrevia } = renderizar()

      const b = within(bloco())
      expect(b.getByText(BLOCO)).toBeInTheDocument()
      expect(b.getByText('Responsável: Equipe de TI')).toBeInTheDocument()
      expect(b.getByText('O dashboard nasce inativo (em construção) e só fica ativo quando a TI concluir a tarefa.')).toBeInTheDocument()
      expect(b.getByText(ORIENTACAO)).toBeInTheDocument()
      expect(observacao().tagName).toBe('TEXTAREA')
      expect(screen.queryByRole('button', { name: 'Ver prévia da tarefa' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()

      await avancar(ATRASO_PREVIA_MS + 100)
      expect(onPrevia).not.toHaveBeenCalled()
    })

    it('com tudo válido, consulta a prévia 500 ms após a última alteração, com os dados do cadastro (nome aparado, ids de colaborador numéricos, pontos em número)', async () => {
      const user = usuarioRapido()
      const { onPrevia, onSalvar } = renderizar()

      await preencherTudo(user)
      expect(onPrevia).not.toHaveBeenCalled()
      await avancar()

      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(1))
      expect(onPrevia).toHaveBeenCalledWith(ESPERADO)
      expect(vi.mocked(onPrevia).mock.calls[0][0]).not.toHaveProperty('enviarTarefaTi')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a prévia mostra "Título" e "Descrição" (com as quebras de linha) dentro do bloco, sem esconder os campos', async () => {
      const user = usuarioRapido()
      renderizar()

      await preencherTudo(user)
      await avancar()

      const b = within(bloco())
      expect(await b.findByText(PREVIA.titulo)).toBeInTheDocument()
      expect(b.getByText('Título')).toBeInTheDocument()
      expect(b.getByText('Descrição')).toBeInTheDocument()
      expect(b.getByText(textoExato(PREVIA.descricao))).toBeInTheDocument()
      expect(b.queryByText(ORIENTACAO)).not.toBeInTheDocument()
      expect(nome()).toHaveValue('  PED Supervisores  ')
      expect(salvar()).toBeEnabled()
    })

    it('enquanto a prévia é consultada: "Gerando a prévia da tarefa..." em região de status dentro do bloco', async () => {
      const user = usuarioRapido()
      let liberar: (previa: PreviaTarefa) => void = () => {}
      const onPrevia = vi.fn<(dados: DadosDashboard) => Promise<PreviaTarefa>>(
        () =>
          new Promise<PreviaTarefa>((resolve) => {
            liberar = resolve
          }),
      )
      renderizar({ onPrevia })

      await preencherTudo(user)
      await avancar()

      expect(await within(bloco()).findByText('Gerando a prévia da tarefa...')).toBeInTheDocument()
      expect(within(bloco()).getByText('Gerando a prévia da tarefa...').closest('[role="status"]')).not.toBeNull()

      await act(async () => {
        liberar(PREVIA)
      })
      expect(await within(bloco()).findByText(PREVIA.titulo)).toBeInTheDocument()
      expect(within(bloco()).queryByText('Gerando a prévia da tarefa...')).not.toBeInTheDocument()
    })

    it('várias alterações seguidas geram uma só nova consulta, com os dados mais recentes', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await preencherTudo(user)
      await avancar()
      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(1))

      await user.type(observacao(), ' Urgente.')
      await avancar()

      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(2))
      expect(onPrevia).toHaveBeenLastCalledWith({ ...ESPERADO, observacaoParaTi: 'Prioridade alta. Urgente.' })
    })

    it('com dados insuficientes (ex.: soma dos pontos diferente da máxima) não consulta e mantém a orientação, sem mostrar erros nos campos', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await colar(user, nome(), 'PED Supervisores')
      await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '120')
      await abrirEEscolher(user, document.body, 'Selecionar cargo de colaboradores', 'Cargos vinculados', 'Vendedor')
      await abrirEEscolher(user, grupoIndicadores(), 'Selecionar indicador', 'Indicadores', 'Cobertura de visitas')
      await user.type(screen.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '70')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
      await colar(user, screen.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Soma simples.')
      await avancar(ATRASO_PREVIA_MS + 100)

      expect(onPrevia).not.toHaveBeenCalled()
      expect(within(bloco()).getByText(ORIENTACAO)).toBeInTheDocument()
      expect(screen.queryByText(/A soma dos pontos base dos indicadores deve ser exatamente igual/)).not.toBeInTheDocument()
    })

    it('depois da prévia, deixar os dados inválidos (ex.: apagar o nome) tira o título e a descrição e volta à orientação', async () => {
      const user = usuarioRapido()
      renderizar()

      await preencherTudo(user)
      await avancar()
      await within(bloco()).findByText(PREVIA.titulo)

      await user.clear(nome())

      expect(within(bloco()).queryByText(PREVIA.titulo)).not.toBeInTheDocument()
      expect(within(bloco()).getByText(ORIENTACAO)).toBeInTheDocument()
    })

    it('o indicador base faz parte dos dados exigidos: removido dos vinculados, a prévia volta à orientação, mesmo com o restante válido, até escolher outra base', async () => {
      const user = usuarioRapido()
      const { onPrevia } = renderizar()

      await preencherTudo(user)
      await avancar()
      await within(bloco()).findByText(PREVIA.titulo)

      await user.click(within(grupoIndicadores()).getByRole('button', { name: 'Remover Cobertura de visitas' }))
      const pontosVendas = screen.getByRole('textbox', { name: 'Pontos base de Vendas por zona neste dashboard' })
      await user.clear(pontosVendas)
      await user.type(pontosVendas, '120')
      await avancar(ATRASO_PREVIA_MS + 100)

      expect(indicadorBase()).toHaveValue('')
      expect(onPrevia).toHaveBeenCalledTimes(1)
      expect(within(bloco()).queryByText(PREVIA.titulo)).not.toBeInTheDocument()
      expect(within(bloco()).getByText(ORIENTACAO)).toBeInTheDocument()
      expect(screen.queryByText('Selecione o indicador base da faixa.')).not.toBeInTheDocument()

      await user.selectOptions(indicadorBase(), 'Vendas por zona')
      await avancar()

      await waitFor(() => expect(onPrevia).toHaveBeenCalledTimes(2))
      expect(onPrevia).toHaveBeenLastCalledWith({
        ...ESPERADO,
        indicadores: [{ idIndicador: 8, pontosBase: 120 }],
        indicadorBaseDaFaixa: 8,
      })
    })

    it('erro da prévia: alerta com a mensagem da API dentro do bloco, sem impedir o restante (salvar continua possível)', async () => {
      const user = usuarioRapido()
      const onPrevia = vi
        .fn<(dados: DadosDashboard) => Promise<PreviaTarefa>>()
        .mockRejectedValue(new ApiError(400, 'O indicador Vendas por zona não pode entrar neste dashboard.'))
      const { onSalvar } = renderizar({ onPrevia })

      await preencherTudo(user)
      await avancar()

      expect(await within(bloco()).findByRole('alert')).toHaveTextContent('O indicador Vendas por zona não pode entrar neste dashboard.')
      expect(nome()).toBeEnabled()
      expect(salvar()).toBeEnabled()

      await user.click(salvar())
      expect(onSalvar).toHaveBeenCalledWith(ESPERADO)
    })
  })

  describe('gravação', () => {
    it('"Salvar e criar tarefa no Bitrix" valida e chama onSalvar direto com os dados do cadastro, sem esperar a prévia', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencherTudo(user)
      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(ESPERADO)
      expect(vi.mocked(onSalvar).mock.calls[0][0]).not.toHaveProperty('enviarTarefaTi')
    })

    it('observação vazia vai como null; filiais vão como códigos, pontos decimais em número e o indicador base pelo id', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await colar(user, nome(), 'PED Lojas')
      await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '90,5')
      await escolherTipo(user, 'Filiais')
      await abrirEEscolher(user, document.body, 'Selecionar filial', 'Filiais vinculadas', '101 - CAMPO GRANDE')
      await abrirEEscolher(user, grupoIndicadores(), 'Selecionar indicador', 'Indicadores', 'Faturamento líquido mensal')
      await user.type(screen.getByRole('textbox', { name: 'Pontos base de Faturamento líquido mensal neste dashboard' }), '90,5')
      await user.selectOptions(indicadorBase(), 'Faturamento líquido mensal')
      await colar(user, screen.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Soma simples.')
      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({
        nome: 'PED Lojas',
        periodicidade: 'mensal',
        pontuacaoBaseMaxima: 90.5,
        tipoVinculo: 'filiais',
        itensVinculados: ['101'],
        indicadores: [{ idIndicador: 3, pontosBase: 90.5 }],
        indicadorBaseDaFaixa: 3,
        formulaDePontuacao: 'Soma simples.',
        observacaoParaTi: null,
      })
    })

    it('dados inválidos: mostra os erros e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(salvar())

      expect(screen.getByText('Informe o nome do dashboard.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('salvando desabilita "Salvar e criar tarefa no Bitrix" e o erro da gravação (prop erro) aparece em alerta', async () => {
      const { rerenderizar } = renderizar()

      rerenderizar({ salvando: true })
      expect(salvar()).toBeDisabled()

      rerenderizar({ salvando: false, erro: 'Não foi possível conectar ao servidor.' })
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
      expect(salvar()).toBeEnabled()
    })
  })
})
