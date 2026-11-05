import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
} from '../../test/apontamentosFalsos'
import { DADO_CHAMADOS_API, DADO_FATURAMENTO_API, DADO_VOLUME_API } from '../../test/dadosExternosFalsos'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno, NovoIndicador } from '../../types/dominio'
import { FormularioIndicador, type FormularioIndicadorProps } from './FormularioIndicador'

/** Apontamentos e dados externos ativos, como a página entrega ao formulário. */
const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API, APONTAMENTO_TREINAMENTOS_API, APONTAMENTO_CHAMADOS_API].map(paraApontamento)
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API, DADO_CHAMADOS_API, DADO_VOLUME_API].map(paraDadoExterno)

const BLOQUEIO_APONTAMENTOS = 'Bloqueado: este indicador já usa um dado externo. Remova o dado externo para vincular apontamentos.'
const BLOQUEIO_DADO_EXTERNO = 'Bloqueado: este indicador já usa apontamentos. Remova os apontamentos para vincular um dado externo.'

describe('F6.4 — FormularioIndicador: cadastro de indicador (RF-34, RF-35, RF-37)', () => {
  function renderizar(props: Partial<FormularioIndicadorProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoIndicador) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <FormularioIndicador
        apontamentos={props.apontamentos ?? APONTAMENTOS}
        dadosExternos={props.dadosExternos ?? DADOS_EXTERNOS}
        carregandoComponentes={props.carregandoComponentes ?? false}
        erroComponentes={props.erroComponentes ?? null}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onSalvar, onCancelar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome' })
  const meta = () => screen.getByRole('textbox', { name: 'Meta' })
  const sentido = () => screen.getByRole('combobox', { name: 'Sentido' })
  const calculo = () => screen.getByRole('combobox', { name: 'Cálculo do realizado' })
  const calculoOpcional = () => screen.queryByRole('combobox', { name: 'Cálculo do realizado' })
  const descricao = () => screen.getByRole('textbox', { name: 'Descrição' })
  const metaEditavel = () => screen.getByRole('checkbox', { name: 'Meta editável no preenchimento' })
  const grupoApontamentos = () => screen.getByRole('group', { name: 'Apontamentos' })
  const grupoDadoExterno = () => screen.getByRole('group', { name: 'Dado externo' })
  const botaoApontamento = () => within(grupoApontamentos()).getByRole('button', { name: 'Selecionar apontamento' })
  const botaoDadoExterno = () => within(grupoDadoExterno()).getByRole('button', { name: 'Selecionar dado externo' })
  const listaApontamentos = () => within(grupoApontamentos()).getByRole('listbox', { name: 'Apontamentos' })
  const listaDadosExternos = () => within(grupoDadoExterno()).getByRole('listbox', { name: 'Dados externos' })
  const buscaApontamento = () => within(grupoApontamentos()).getByRole('searchbox', { name: 'Buscar apontamento' })
  const buscaDadoExterno = () => within(grupoDadoExterno()).getByRole('searchbox', { name: 'Buscar dado externo' })
  const escolhidosApontamento = () => within(grupoApontamentos()).getByRole('list', { name: 'Apontamentos escolhidos' })
  const escolhidoDadoExterno = () => within(grupoDadoExterno()).getByRole('list', { name: 'Dado externo escolhido' })
  const removerApontamento = (rotulo: string) => within(escolhidosApontamento()).getByRole('button', { name: `Remover ${rotulo}` })
  const removerDadoExterno = (rotulo: string) => within(escolhidoDadoExterno()).getByRole('button', { name: `Remover ${rotulo}` })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  const textos = (select: HTMLElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)
  /** Textos das opções de uma lista, na ordem exibida. */
  const textosDaLista = (lista: HTMLElement) => within(lista).getAllByRole('option').map((opcao) => opcao.textContent)
  /** Opção do listbox cujo nome começa pelo rótulo (o nome da opção inclui o subtexto). */
  const opcao = (lista: HTMLElement, rotulo: string) => within(lista).getByRole('option', { name: (nomeOpcao) => nomeOpcao.startsWith(rotulo) })

  async function escolher(user: Usuario, select: HTMLElement, rotulo: string) {
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  /** Abre o dropdown de apontamentos se estiver fechado; ele permanece aberto após cada escolha. */
  async function abrirApontamentos(user: Usuario): Promise<HTMLElement> {
    if (within(grupoApontamentos()).queryByRole('listbox') === null) await user.click(botaoApontamento())
    return listaApontamentos()
  }

  async function escolherApontamento(user: Usuario, rotulo: string) {
    const lista = await abrirApontamentos(user)
    await user.click(opcao(lista, rotulo))
  }

  /** O dropdown de dado externo fecha ao escolher, por isso é sempre aberto antes. */
  async function escolherDadoExterno(user: Usuario, rotulo: string) {
    await user.click(botaoDadoExterno())
    await user.click(opcao(listaDadosExternos(), rotulo))
  }

  /** Preenche os campos comuns com valores válidos (sem composição). */
  async function preencherComuns(user: Usuario) {
    await colar(user, nome(), '  Positivação da carteira  ')
    await user.type(meta(), '1.500,50')
    await escolher(user, sentido(), 'Maior é melhor')
  }

  describe('campos e opções', () => {
    it('tem Nome, Meta, Sentido, Descrição, "Meta editável no preenchimento" e os grupos Apontamentos e Dado externo dentro de "Composição"', () => {
      renderizar()

      for (const campo of [nome, meta, sentido, descricao, metaEditavel]) expect(campo()).toBeInTheDocument()
      expect(descricao().tagName).toBe('TEXTAREA')
      expect(metaEditavel()).not.toBeChecked()
      const composicao = screen.getByRole('group', { name: 'Composição' })
      expect(within(composicao).getByRole('group', { name: 'Apontamentos' })).toBeInTheDocument()
      expect(within(composicao).getByRole('group', { name: 'Dado externo' })).toBeInTheDocument()
    })

    it('Nome, Meta e Sentido são obrigatórios (aria-required); Descrição e Meta editável não', () => {
      renderizar()

      for (const campo of [nome, meta, sentido]) expect(campo()).toHaveAttribute('aria-required', 'true')
      expect(descricao()).not.toHaveAttribute('aria-required', 'true')
      expect(metaEditavel()).not.toHaveAttribute('aria-required')
    })

    it('Sentido oferece "Selecione", "Maior é melhor" e "Menor é melhor (custo)" e inicia em "Selecione"', () => {
      renderizar()

      expect(textos(sentido())).toEqual(['Selecione', 'Maior é melhor', 'Menor é melhor (custo)'])
      expect(sentido()).toHaveValue('')
    })

    it('cada grupo começa com um botão fechado ("Selecionar apontamento" e "Selecionar dado externo"), sem painel aberto e sem bloqueio', () => {
      renderizar()

      expect(botaoApontamento()).toHaveAttribute('aria-expanded', 'false')
      expect(botaoDadoExterno()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.queryByText(/Bloqueado:/)).not.toBeInTheDocument()
    })

    it('"Selecionar apontamento" abre o painel com a busca "Buscar apontamento" e a lista "Apontamentos" com os ativos, na ordem recebida; clicar de novo fecha', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoApontamento())

      expect(botaoApontamento()).toHaveAttribute('aria-expanded', 'true')
      expect(buscaApontamento()).toBeInTheDocument()
      const lista = listaApontamentos()
      expect(textosDaLista(lista)).toEqual([
        expect.stringContaining('Roteiro de visitas elaborado'),
        expect.stringContaining('Horas de treinamento realizadas'),
        expect.stringContaining('Chamados resolvidos no prazo'),
      ])
      expect(opcao(lista, 'Roteiro de visitas elaborado')).toHaveTextContent('Comercial')

      await user.click(botaoApontamento())

      expect(botaoApontamento()).toHaveAttribute('aria-expanded', 'false')
      expect(within(grupoApontamentos()).queryByRole('listbox')).not.toBeInTheDocument()
      expect(within(grupoApontamentos()).queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('"Selecionar dado externo" abre o painel com a busca "Buscar dado externo" e a lista "Dados externos" com os ativos, na ordem recebida; clicar de novo fecha', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoDadoExterno())

      expect(botaoDadoExterno()).toHaveAttribute('aria-expanded', 'true')
      expect(buscaDadoExterno()).toBeInTheDocument()
      expect(textosDaLista(listaDadosExternos())).toEqual([
        expect.stringContaining('Faturamento líquido'),
        expect.stringContaining('Chamados atendidos no prazo'),
        expect.stringContaining('Volume de vendas'),
      ])

      await user.click(botaoDadoExterno())

      expect(botaoDadoExterno()).toHaveAttribute('aria-expanded', 'false')
      expect(within(grupoDadoExterno()).queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('"Cálculo do realizado" só aparece quando há apontamento escolhido (RF-34)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(calculoOpcional()).not.toBeInTheDocument()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      expect(calculo()).toHaveAttribute('aria-required', 'true')
      expect(textos(calculo())).toEqual(['Selecione', 'Soma', 'Média'])

      await user.click(removerApontamento('Roteiro de visitas elaborado'))
      expect(calculoOpcional()).not.toBeInTheDocument()
    })

    it('com dado externo escolhido, "Cálculo do realizado" não aparece', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherDadoExterno(user, 'Faturamento líquido')

      expect(calculoOpcional()).not.toBeInTheDocument()
    })

    it('tem "Salvar" (submit) e "Cancelar"; Cancelar chama onCancelar sem salvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()

      expect(salvar()).toHaveAttribute('type', 'submit')
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('não tem campo de situação nem ação de editar (indicador não é editável depois de cadastrado — RF-37)', () => {
      renderizar()

      expect(screen.queryByLabelText(/situa/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    })

    it('com salvando, Salvar fica desabilitado', () => {
      renderizar({ salvando: true })

      expect(salvar()).toBeDisabled()
    })

    it('exibe o erro recebido em um alerta dentro do formulário, mantendo os dados', async () => {
      const user = usuarioRapido()
      const { rerender, onSalvar, onCancelar } = renderizar()
      await preencherComuns(user)

      rerender(
        <FormularioIndicador
          apontamentos={APONTAMENTOS}
          dadosExternos={DADOS_EXTERNOS}
          carregandoComponentes={false}
          erroComponentes={null}
          salvando={false}
          erro="Informe apontamentos ou um dado externo, nunca os dois."
          onSalvar={onSalvar}
          onCancelar={onCancelar}
        />,
      )

      expect(screen.getByRole('alert')).toHaveTextContent('Informe apontamentos ou um dado externo, nunca os dois.')
      expect(nome()).toHaveValue('  Positivação da carteira  ')
      expect(meta()).toHaveValue('1.500,50')
    })
  })

  describe('carga dos componentes', () => {
    it('enquanto carrega, anuncia "Carregando apontamentos e dados externos..." em região de status', () => {
      renderizar({ carregandoComponentes: true, apontamentos: [], dadosExternos: [] })

      expect(screen.getByRole('status')).toHaveTextContent('Carregando apontamentos e dados externos...')
    })

    it('erro na carga dos componentes aparece como alerta e o dropdown de apontamentos não tem opções', async () => {
      const user = usuarioRapido()
      renderizar({ erroComponentes: 'Não foi possível conectar ao servidor.', apontamentos: [], dadosExternos: [] })

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
      await user.click(botaoApontamento())
      expect(within(grupoApontamentos()).queryAllByRole('option')).toHaveLength(0)
    })

    it('sem apontamentos ativos, o painel mostra "Nenhum apontamento ativo disponível."; sem dados externos, "Nenhum dado externo ativo disponível."', async () => {
      const user = usuarioRapido()
      renderizar({ apontamentos: [], dadosExternos: [] })

      await user.click(botaoApontamento())
      expect(within(grupoApontamentos()).getByText('Nenhum apontamento ativo disponível.')).toBeInTheDocument()
      await user.click(botaoApontamento())

      await user.click(botaoDadoExterno())
      expect(within(grupoDadoExterno()).getByText('Nenhum dado externo ativo disponível.')).toBeInTheDocument()
    })
  })

  describe('composição por dropdown (RF-35)', () => {
    it('escolher apontamentos adiciona só os escolhidos em "Apontamentos escolhidos" com "Remover {nome}"; o painel continua aberto e sem as opções já escolhidas', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      const escolhidos = escolhidosApontamento()
      expect(within(escolhidos).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Roteiro de visitas elaborado'),
        expect.stringContaining('Chamados resolvidos no prazo'),
      ])
      expect(within(escolhidos).queryByText(/Horas de treinamento/)).not.toBeInTheDocument()
      expect(removerApontamento('Roteiro de visitas elaborado')).toBeInTheDocument()
      expect(listaApontamentos()).toBeInTheDocument()
      expect(textosDaLista(listaApontamentos())).toEqual([expect.stringContaining('Horas de treinamento realizadas')])
    })

    it('"Remover" tira o apontamento dos escolhidos e devolve a opção ao dropdown, na ordem recebida', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      await user.click(removerApontamento('Roteiro de visitas elaborado'))

      expect(within(escolhidosApontamento()).getAllByRole('listitem')).toHaveLength(1)
      expect(within(escolhidosApontamento()).getByText(/Chamados resolvidos no prazo/)).toBeInTheDocument()
      const lista = await abrirApontamentos(user)
      expect(textosDaLista(lista)).toEqual([
        expect.stringContaining('Roteiro de visitas elaborado'),
        expect.stringContaining('Horas de treinamento realizadas'),
      ])
    })

    it('sem escolhidos, cada lista mostra o texto de vazio ("Nenhum apontamento selecionado." e "Nenhum dado externo selecionado.") e, após remover tudo, volta a mostrá-lo', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(within(grupoApontamentos()).getByText('Nenhum apontamento selecionado.')).toBeInTheDocument()
      expect(within(grupoApontamentos()).queryAllByRole('listitem')).toHaveLength(0)
      expect(within(grupoDadoExterno()).getByText('Nenhum dado externo selecionado.')).toBeInTheDocument()

      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      expect(within(grupoApontamentos()).queryByText('Nenhum apontamento selecionado.')).not.toBeInTheDocument()
      await user.click(removerApontamento('Roteiro de visitas elaborado'))

      expect(within(grupoApontamentos()).getByText('Nenhum apontamento selecionado.')).toBeInTheDocument()
    })

    it('com apontamento escolhido, o dado externo fica bloqueado: sem botão "Selecionar dado externo" e com o texto de bloqueio do protótipo; "Remover" libera', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherApontamento(user, 'Roteiro de visitas elaborado')

      expect(within(grupoDadoExterno()).queryByRole('button', { name: 'Selecionar dado externo' })).not.toBeInTheDocument()
      expect(within(grupoDadoExterno()).getByText(BLOQUEIO_DADO_EXTERNO)).toBeInTheDocument()

      await user.click(removerApontamento('Roteiro de visitas elaborado'))

      expect(botaoDadoExterno()).toHaveAttribute('aria-expanded', 'false')
      expect(within(grupoDadoExterno()).queryByText(BLOQUEIO_DADO_EXTERNO)).not.toBeInTheDocument()
    })

    it('escolher um dado externo: aparece em "Dado externo escolhido" com "Remover {nome}", o painel fecha e não oferece outro', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherDadoExterno(user, 'Faturamento líquido')

      expect(within(escolhidoDadoExterno()).getAllByRole('listitem')).toHaveLength(1)
      expect(within(escolhidoDadoExterno()).getByText(/Faturamento líquido/)).toBeInTheDocument()
      expect(removerDadoExterno('Faturamento líquido')).toBeInTheDocument()
      expect(within(grupoDadoExterno()).queryByRole('listbox')).not.toBeInTheDocument()
      expect(within(grupoDadoExterno()).queryByRole('button', { name: 'Selecionar dado externo' })).not.toBeInTheDocument()
      expect(within(grupoDadoExterno()).queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('com dado externo escolhido, os apontamentos ficam bloqueados: sem botão "Selecionar apontamento" e com o texto de bloqueio do protótipo', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherDadoExterno(user, 'Faturamento líquido')

      expect(within(grupoApontamentos()).queryByRole('button', { name: 'Selecionar apontamento' })).not.toBeInTheDocument()
      expect(within(grupoApontamentos()).getByText(BLOQUEIO_APONTAMENTOS)).toBeInTheDocument()
      expect(within(grupoApontamentos()).getByText('Nenhum apontamento selecionado.')).toBeInTheDocument()
    })

    it('"Remover" do dado externo libera a seleção: "Selecionar dado externo" volta com as três opções e os apontamentos deixam de estar bloqueados', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherDadoExterno(user, 'Faturamento líquido')

      await user.click(removerDadoExterno('Faturamento líquido'))

      expect(within(grupoDadoExterno()).getByText('Nenhum dado externo selecionado.')).toBeInTheDocument()
      await user.click(botaoDadoExterno())
      expect(textosDaLista(listaDadosExternos())).toHaveLength(3)
      expect(botaoApontamento()).toBeInTheDocument()
      expect(within(grupoApontamentos()).queryByText(BLOQUEIO_APONTAMENTOS)).not.toBeInTheDocument()
    })

    it('a busca de apontamentos filtra as opções pelo nome, ignorando acentos e maiúsculas, e não repete os escolhidos', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')

      await user.type(buscaApontamento(), 'TREINAMÉNTO')

      expect(textosDaLista(listaApontamentos())).toEqual([expect.stringContaining('Horas de treinamento realizadas')])

      await user.clear(buscaApontamento())
      expect(textosDaLista(listaApontamentos())).toEqual([
        expect.stringContaining('Horas de treinamento realizadas'),
        expect.stringContaining('Chamados resolvidos no prazo'),
      ])
    })

    it('busca de apontamentos sem resultado mostra "Nenhum apontamento encontrado."', async () => {
      const user = usuarioRapido()
      renderizar()
      await abrirApontamentos(user)

      await user.type(buscaApontamento(), 'xyz')

      expect(within(grupoApontamentos()).getByText('Nenhum apontamento encontrado.')).toBeInTheDocument()
    })

    it('a busca de dados externos filtra as opções pelo nome, ignorando acentos e maiúsculas; sem resultado mostra "Nenhum dado externo encontrado."', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(botaoDadoExterno())

      await user.type(buscaDadoExterno(), 'faturamento liquido')

      expect(textosDaLista(listaDadosExternos())).toEqual([expect.stringContaining('Faturamento líquido')])

      await user.clear(buscaDadoExterno())
      await user.type(buscaDadoExterno(), 'nada')
      expect(within(grupoDadoExterno()).getByText('Nenhum dado externo encontrado.')).toBeInTheDocument()
    })
  })

  describe('validação (sem chamar onSalvar)', () => {
    it('enviar vazio mostra as mensagens de Nome, Meta, Sentido e composição e marca os campos como inválidos', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(salvar())

      for (const mensagem of [
        'Informe o nome.',
        'Informe uma meta maior que zero.',
        'Selecione o sentido.',
        'Escolha ao menos um apontamento ou um dado externo.',
      ]) {
        expect(screen.getByText(mensagem)).toBeInTheDocument()
      }
      for (const campo of [nome, meta, sentido]) expect(campo()).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText('Selecione o cálculo do realizado.')).not.toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('nome só com espaços conta como vazio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherDadoExterno(user, 'Faturamento líquido')
      await user.clear(nome())
      await user.type(nome(), '   ')

      await user.click(salvar())

      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it.each(['0', '0,00', '-5', 'abc', '1,5,5', '1.5'])('meta "%s" mostra "Informe uma meta maior que zero."', async (valor) => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherDadoExterno(user, 'Faturamento líquido')
      await user.clear(meta())
      await user.type(meta(), valor)

      await user.click(salvar())

      expect(screen.getByText('Informe uma meta maior que zero.')).toBeInTheDocument()
      expect(meta()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com apontamentos escolhidos e sem cálculo mostra "Selecione o cálculo do realizado."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherApontamento(user, 'Roteiro de visitas elaborado')

      await user.click(salvar())

      expect(screen.getByText('Selecione o cálculo do realizado.')).toBeInTheDocument()
      expect(calculo()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a mensagem da composição some ao escolher um componente', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(salvar())
      expect(screen.getByText('Escolha ao menos um apontamento ou um dado externo.')).toBeInTheDocument()

      await escolherDadoExterno(user, 'Faturamento líquido')

      expect(screen.queryByText('Escolha ao menos um apontamento ou um dado externo.')).not.toBeInTheDocument()
    })
  })

  describe('envio (onSalvar recebe NovoIndicador)', () => {
    it('composição por apontamentos: chama onSalvar uma vez com nome aparado, meta lida com vírgula, cálculo e os ids dos apontamentos escolhidos (sem dadoExterno)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Horas de treinamento realizadas')
      await escolher(user, calculo(), 'Média')
      await user.click(metaEditavel())

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({
        nome: 'Positivação da carteira',
        descricao: null,
        meta: 1500.5,
        sentido: 'maior_melhor',
        calculo: 'media',
        metaEditavel: true,
        apontamentos: [1, 3],
      })
    })

    it('composição por dado externo: envia dadoExterno e não envia calculo nem apontamentos; descrição aparada', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolher(user, sentido(), 'Menor é melhor (custo)')
      await colar(user, descricao(), '  Faturamento líquido coletado do ERP.  ')
      await escolherDadoExterno(user, 'Faturamento líquido')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({
        nome: 'Positivação da carteira',
        descricao: 'Faturamento líquido coletado do ERP.',
        meta: 1500.5,
        sentido: 'menor_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
    })

    it('meta inteira ("85") e decimal com vírgula ("12,5") são aceitas; meta > 0 mínima ("0,01") também', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherDadoExterno(user, 'Volume de vendas')

      for (const [texto, valor] of [
        ['85', 85],
        ['12,5', 12.5],
        ['0,01', 0.01],
      ] as const) {
        await user.clear(meta())
        await user.type(meta(), texto)
        await user.click(salvar())
        expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ meta: valor, dadoExterno: 6 }))
      }
      expect(onSalvar).toHaveBeenCalledTimes(3)
    })

    it('cálculo escolhido e depois o apontamento removido: ao escolher dado externo, calculo e apontamentos não são enviados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolher(user, calculo(), 'Soma')
      await user.click(removerApontamento('Roteiro de visitas elaborado'))
      await escolherDadoExterno(user, 'Faturamento líquido')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      const enviado = onSalvar.mock.calls[0][0] as Record<string, unknown>
      expect(enviado).toMatchObject({ dadoExterno: 1 })
      expect(enviado).not.toHaveProperty('calculo')
      expect(enviado).not.toHaveProperty('apontamentos')
    })
  })
})
