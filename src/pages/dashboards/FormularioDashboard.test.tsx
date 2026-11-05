import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
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

const DICA_PONTUACAO = 'Não pode ser alterada depois do cadastro. A soma dos pontos base dos indicadores precisa ser igual a este valor.'
const ERRO_PONTUACAO = 'Informe a pontuação base máxima do dashboard (número maior que zero).'
const ERRO_BASE = 'Selecione o indicador base da faixa.'
const ORIENTACAO_BASE = 'Vincule indicadores para escolher o indicador base.'
const BLOCO = 'Tarefa de construção que será criada no Bitrix24'

describe('F7.4 — FormularioDashboard: dados básicos do cadastro (RF-49, RF-54, RN-15, protótipo dashModal)', () => {
  function renderizar(props: Partial<FormularioDashboardProps> = {}) {
    const onPrevia = props.onPrevia ?? vi.fn().mockResolvedValue({ titulo: 'T', descricao: 'D' })
    const onSalvar = props.onSalvar ?? vi.fn<(dados: DadosDashboard) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    render(
      <FormularioDashboard
        listas={props.listas ?? LISTAS}
        carregandoListas={props.carregandoListas ?? false}
        erroListas={props.erroListas ?? null}
        onPrevia={onPrevia}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { onPrevia, onSalvar, onCancelar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome do dashboard' })
  const periodicidade = () => screen.getByRole('combobox', { name: 'Periodicidade de lançamento' })
  const pontuacao = () => screen.getByRole('textbox', { name: 'Pontuação base máxima' })
  const indicadorBase = () => screen.getByRole('combobox', { name: 'Indicador base da faixa' })
  const formula = () => screen.getByRole('textbox', { name: 'Fórmula de pontuação' })
  const observacao = () => screen.getByRole('textbox', { name: 'Observação para a TI (opcional)' })
  const enviar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })
  const textos = (select: HTMLElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)
  const grupoIndicadores = () => screen.getByRole('group', { name: 'Indicadores vinculados' })

  async function escolherIndicador(user: Usuario, nomeIndicador: string) {
    const botao = within(grupoIndicadores()).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)
    await user.click(
      within(within(grupoIndicadores()).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', {
        name: (n) => n.startsWith(nomeIndicador),
      }),
    )
  }

  async function removerIndicador(user: Usuario, nomeIndicador: string) {
    await user.click(within(grupoIndicadores()).getByRole('button', { name: `Remover ${nomeIndicador}` }))
  }

  /** `depois` vem depois de `antes` no documento e fora dele. */
  function vemDepois(antes: HTMLElement, depois: HTMLElement) {
    expect(antes).not.toContainElement(depois)
    expect(antes.compareDocumentPosition(depois) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }

  describe('campos', () => {
    it('tem Nome do dashboard, Periodicidade de lançamento, Pontuação base máxima, Indicador base da faixa, Fórmula de pontuação e Observação para a TI (opcional)', () => {
      renderizar()

      for (const campo of [nome, periodicidade, pontuacao, indicadorBase, formula, observacao]) expect(campo()).toBeInTheDocument()
      expect(formula().tagName).toBe('TEXTAREA')
      expect(observacao().tagName).toBe('TEXTAREA')
      expect(pontuacao()).toHaveAttribute('inputmode', 'decimal')
    })

    it('Nome, Pontuação base máxima, Indicador base da faixa e Fórmula são obrigatórios; Observação para a TI não (RF-49)', () => {
      renderizar()

      for (const campo of [nome, pontuacao, indicadorBase, formula]) expect(campo()).toHaveAttribute('aria-required', 'true')
      expect(observacao()).not.toHaveAttribute('aria-required', 'true')
    })

    it('placeholders do protótipo: "Ex.: PED Supervisor Comercial" no nome e "Ex.: 120" na pontuação', () => {
      renderizar()

      expect(nome()).toHaveAttribute('placeholder', 'Ex.: PED Supervisor Comercial')
      expect(pontuacao()).toHaveAttribute('placeholder', 'Ex.: 120')
    })

    it('Periodicidade de lançamento oferece só as cinco periodicidades do RN-16 e começa em Mensal (sem "Selecione")', () => {
      renderizar()

      expect(textos(periodicidade())).toEqual(['Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'])
      expect(periodicidade()).toHaveValue('mensal')
    })

    it('ordem na tela: dados básicos (nome, periodicidade, pontuação), vínculo, "Indicadores vinculados", depois "Indicador base da faixa" e "Fórmula de pontuação", depois o bloco da tarefa', () => {
      renderizar()

      const sequencia = [
        nome(),
        periodicidade(),
        pontuacao(),
        screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' }),
        grupoIndicadores(),
        indicadorBase(),
        formula(),
        screen.getByRole('region', { name: BLOCO }),
      ]
      for (let i = 1; i < sequencia.length; i++) vemDepois(sequencia[i - 1], sequencia[i])
      expect(grupoIndicadores()).not.toContainElement(formula())
    })

    it('Pontuação base máxima explica que não muda depois do cadastro e que a soma dos pontos precisa ser igual a ela (RN-15)', () => {
      renderizar()

      expect(pontuacao()).toHaveAccessibleDescription(expect.stringContaining(DICA_PONTUACAO))
      expect(pontuacao()).not.toHaveAttribute('readonly')
    })

    it('no cadastro, o botão principal é "Salvar e criar tarefa no Bitrix" (submit), sem "Ver prévia da tarefa", e há "Cancelar", que chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onCancelar, onSalvar } = renderizar()

      expect(enviar()).toHaveAttribute('type', 'submit')
      expect(screen.queryByRole('button', { name: 'Ver prévia da tarefa' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('validação dos dados básicos', () => {
    it('enviar vazio mostra os erros dos campos obrigatórios e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(enviar())

      expect(screen.getByText('Informe o nome do dashboard.')).toBeInTheDocument()
      expect(screen.getByText(ERRO_PONTUACAO)).toBeInTheDocument()
      expect(screen.getByText(ERRO_BASE)).toBeInTheDocument()
      expect(screen.getByText('Informe a fórmula de pontuação.')).toBeInTheDocument()
      expect(nome()).toHaveAccessibleDescription(expect.stringContaining('Informe o nome do dashboard.'))
      expect(pontuacao()).toHaveAccessibleDescription(expect.stringContaining(ERRO_PONTUACAO))
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('nome e fórmula só com espaços contam como vazios', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(nome(), '   ')
      await user.type(formula(), '   ')
      await user.click(enviar())

      expect(screen.getByText('Informe o nome do dashboard.')).toBeInTheDocument()
      expect(screen.getByText('Informe a fórmula de pontuação.')).toBeInTheDocument()
    })

    it.each(['0', '-5', 'abc', '0,00'])('pontuação "%s" é recusada (deve ser maior que zero)', async (valor) => {
      const user = usuarioRapido()
      renderizar()

      await user.type(pontuacao(), valor)
      await user.click(enviar())

      expect(screen.getByText(ERRO_PONTUACAO)).toBeInTheDocument()
    })

    it.each(['120', '90,5', '1.000'])('pontuação "%s" (formato pt-BR) é aceita', async (valor) => {
      const user = usuarioRapido()
      renderizar()

      await user.type(pontuacao(), valor)
      await user.click(enviar())

      expect(screen.queryByText(ERRO_PONTUACAO)).not.toBeInTheDocument()
    })

    it('dados básicos válidos não mostram erros desses campos', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, nome(), 'PED Supervisores')
      await user.selectOptions(periodicidade(), 'Semestral')
      await user.type(pontuacao(), '120')
      await escolherIndicador(user, 'Cobertura de visitas')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
      await colar(user, formula(), 'Pontos base × atingimento.')
      await user.click(enviar())

      for (const mensagem of [
        'Informe o nome do dashboard.',
        ERRO_PONTUACAO,
        ERRO_BASE,
        'Informe a fórmula de pontuação.',
      ]) {
        expect(screen.queryByText(mensagem)).not.toBeInTheDocument()
      }
    })

    it('corrigir um campo limpa o erro dele, mantendo os demais', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(enviar())

      await user.type(nome(), 'PED')
      await escolherIndicador(user, 'Cobertura de visitas')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')

      expect(screen.queryByText('Informe o nome do dashboard.')).not.toBeInTheDocument()
      expect(screen.queryByText(ERRO_BASE)).not.toBeInTheDocument()
      expect(screen.getByText('Informe a fórmula de pontuação.')).toBeInTheDocument()
    })
  })

  describe('Indicador base da faixa: somente os indicadores vinculados (decisão do usuário de 2026-11-05, altera o RF-54)', () => {
    it('sem indicador vinculado, o campo fica desabilitado, vazio e com a orientação "Vincule indicadores para escolher o indicador base."', () => {
      renderizar()

      expect(indicadorBase()).toBeDisabled()
      expect(indicadorBase()).toHaveValue('')
      expect(textos(indicadorBase())).toEqual(['Selecione'])
      expect(screen.getByText(ORIENTACAO_BASE)).toBeInTheDocument()
      expect(indicadorBase()).toHaveAccessibleDescription(expect.stringContaining(ORIENTACAO_BASE))
    })

    it('oferece só os indicadores escolhidos em "Indicadores vinculados", na ordem da escolha e pelo nome; os demais cadastrados não aparecem', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Vendas por zona')
      await escolherIndicador(user, 'Cobertura de visitas')

      expect(indicadorBase()).toBeEnabled()
      expect(indicadorBase()).toHaveValue('')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Vendas por zona', 'Cobertura de visitas'])
      expect(within(indicadorBase()).queryByRole('option', { name: 'Faturamento líquido mensal' })).not.toBeInTheDocument()
      expect(within(indicadorBase()).queryByRole('option', { name: 'Capacitação' })).not.toBeInTheDocument()
      expect(screen.queryByText(ORIENTACAO_BASE)).not.toBeInTheDocument()
    })

    it('as opções acompanham a lista: indicador vinculado depois também passa a ser opção, sem perder a base escolhida', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
      await escolherIndicador(user, 'Faturamento líquido mensal')

      expect(textos(indicadorBase())).toEqual(['Selecione', 'Cobertura de visitas', 'Faturamento líquido mensal'])
      expect(indicadorBase()).toHaveValue('1')
    })

    it('remover dos vinculados o indicador escolhido como base deixa o campo vazio, sem ele nas opções; ao salvar, aparece o erro obrigatório do campo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await escolherIndicador(user, 'Faturamento líquido mensal')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
      expect(indicadorBase()).toHaveValue('1')

      await removerIndicador(user, 'Cobertura de visitas')

      expect(indicadorBase()).toHaveValue('')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Faturamento líquido mensal'])

      await user.click(enviar())

      expect(screen.getByText(ERRO_BASE)).toBeInTheDocument()
      expect(indicadorBase()).toHaveAccessibleDescription(expect.stringContaining(ERRO_BASE))
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('remover outro indicador mantém o indicador base escolhido', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await escolherIndicador(user, 'Faturamento líquido mensal')
      await user.selectOptions(indicadorBase(), 'Faturamento líquido mensal')
      await removerIndicador(user, 'Cobertura de visitas')

      expect(indicadorBase()).toHaveValue('3')
      expect(textos(indicadorBase())).toEqual(['Selecione', 'Faturamento líquido mensal'])
    })

    it('remover todos os indicadores vinculados volta a desabilitar o campo, vazio e com a orientação', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await user.selectOptions(indicadorBase(), 'Cobertura de visitas')
      await removerIndicador(user, 'Cobertura de visitas')

      expect(indicadorBase()).toBeDisabled()
      expect(indicadorBase()).toHaveValue('')
      expect(screen.getByText(ORIENTACAO_BASE)).toBeInTheDocument()
    })

    it('com indicadores vinculados e sem base escolhida, enviar mostra "Selecione o indicador base da faixa." no campo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      await user.click(enviar())

      expect(indicadorBase()).toHaveAccessibleDescription(expect.stringContaining(ERRO_BASE))
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('estados recebidos da página', () => {
    it('erro da API (prop erro) aparece em alerta dentro do formulário, sem apagar o que foi digitado', async () => {
      const user = usuarioRapido()
      const props = {
        listas: LISTAS,
        carregandoListas: false,
        erroListas: null,
        onPrevia: vi.fn().mockResolvedValue({ titulo: 'T', descricao: 'D' }),
        salvando: false,
        onSalvar: vi.fn(),
        onCancelar: vi.fn(),
      }
      const { rerender } = render(<FormularioDashboard {...props} erro={null} />)
      await user.type(nome(), 'PED Novo')

      rerender(<FormularioDashboard {...props} erro="A soma dos pontos base deve ser 100." />)

      expect(screen.getByRole('alert')).toHaveTextContent('A soma dos pontos base deve ser 100.')
      expect(nome()).toHaveValue('PED Novo')
    })

    it('carregando as listas: anuncia "Carregando dados do formulário..." em região de status', () => {
      renderizar({ carregandoListas: true })

      expect(screen.getByText('Carregando dados do formulário...').closest('[role="status"]')).not.toBeNull()
    })

    it('erro ao carregar as listas aparece em alerta', () => {
      renderizar({ erroListas: 'Não foi possível conectar ao servidor.' })

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
    })
  })
})
