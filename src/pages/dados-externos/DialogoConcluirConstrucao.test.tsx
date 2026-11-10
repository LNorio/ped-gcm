import { render, screen, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import {
  DADO_DEVOLUCOES_API,
  identificadoresApi,
  variaveisIntegracao,
  variaveisIntegracaoSemExemplo,
} from '../../test/dadosExternosFalsos'
import type { ErroIntegracao, VariavelIntegracao } from '../../types/dominio'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'
import {
  type DadosConclusaoConstrucao,
  DialogoConcluirConstrucao,
  type DialogoConcluirConstrucaoProps,
} from './DialogoConcluirConstrucao'

/** Dado em construção com janela retroativa 1 (mesesRetro 1). */
const DEVOLUCOES = paraDadoExterno(DADO_DEVOLUCOES_API)
/** Mesmo dado com 3 meses retroativos e coleta no dia 20 (exemplos do documento). */
const DEVOLUCOES_3_MESES = paraDadoExterno({ ...DADO_DEVOLUCOES_API, 'janela retroativa': 3, 'dia da coleta': 20 })
/** Data fixa da prévia: período 10/2026. */
const HOJE = new Date(2026, 9, 15)
const URL_VALIDA = 'https://api.exemplo.com/devolucoes'
const FALTA_TUDO = 'falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido'
const TUDO_PREENCHIDO = 'Todos os campos obrigatórios preenchidos'

/**
 * Os testes usam por padrão as variáveis **sem exemplo** (`variaveisIntegracaoSemExemplo`): a prévia local
 * usa os valores calculados do dado e de `hoje`. Os exemplos vindos da API (alteração de 09/11/2026)
 * têm o seu próprio bloco abaixo.
 */
describe('F5.7 — DialogoConcluirConstrucao (Admin registra a integração e conclui a construção — RF-28)', () => {
  function renderizar(props: Partial<DialogoConcluirConstrucaoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosConclusaoConstrucao) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const montar = (extra: Partial<DialogoConcluirConstrucaoProps> = {}) => (
      <DialogoConcluirConstrucao
        dado={props.dado === undefined ? DEVOLUCOES : props.dado}
        identificadores={props.identificadores ?? identificadoresApi()}
        variaveis={props.variaveis ?? variaveisIntegracaoSemExemplo()}
        carregandoVariaveis={props.carregandoVariaveis ?? false}
        erroVariaveis={props.erroVariaveis ?? null}
        concluindo={props.concluindo ?? false}
        erro={props.erro ?? null}
        errosCampos={props.errosCampos ?? []}
        hoje={props.hoje ?? HOJE}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
        {...extra}
      />
    )
    const utils = render(montar())
    return { ...utils, onConfirmar, onCancelar, rerenderizar: (extra: Partial<DialogoConcluirConstrucaoProps>) => utils.rerender(montar(extra)) }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Concluir construção' })
  const identificador = () => within(dialogo()).getByLabelText('Identificador da consulta') as HTMLInputElement
  const url = () => within(dialogo()).getByLabelText('URL') as HTMLInputElement
  const saida = () => within(dialogo()).getByLabelText('Parâmetros de saída') as HTMLTextAreaElement
  const entrada = () => within(dialogo()).getByLabelText('Parâmetros de entrada') as HTMLTextAreaElement
  const concluir = () => within(dialogo()).getByRole('button', { name: 'Concluir e ativar' })
  const validacaoSaida = () => within(dialogo()).queryByRole('status', { name: 'Validação dos parâmetros de saída' })
  const validacaoEntrada = () => within(dialogo()).queryByRole('status', { name: 'Validação dos parâmetros de entrada' })
  const textoDe = (elemento: HTMLElement | null) => elemento?.textContent?.trim() ?? ''
  const variaveisDisponiveis = () => within(dialogo()).getByRole('group', { name: 'Variáveis disponíveis' })
  const botaoVariavel = (nome: string) => within(variaveisDisponiveis()).getByRole('button', { name: new RegExp(`%${nome}%`) })
  const operadores = () => within(dialogo()).getByRole('group', { name: 'Operadores' })

  /**
   * Posiciona o cursor (ou seleciona um trecho) na caixa como o usuário faz: clique no ponto `inicio`
   * e, com `fim`, arrasta até `fim`.
   */
  async function posicionarCursor(user: Usuario, campo: HTMLElement, inicio: number, fim = inicio) {
    if (fim === inicio) {
      await user.pointer({ target: campo, offset: inicio, keys: '[MouseLeft]' })
      return
    }
    await user.pointer([{ target: campo, offset: inicio, keys: '[MouseLeft>]' }, { offset: fim }, { keys: '[/MouseLeft]' }])
  }

  async function substituir(user: Usuario, campo: HTMLElement, texto: string) {
    await user.clear(campo)
    if (texto !== '') await colar(user, campo, texto)
  }

  /** Preenche URL, saída e entrada válidas (o identificador fica a cargo de cada teste). */
  async function preencherIntegracao(user: Usuario) {
    await colar(user, url(), URL_VALIDA)
    await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
    await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
  }

  it('com dado null não renderiza nada', () => {
    renderizar({ dado: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('campos', () => {
    it('abre "Concluir construção" citando o dado, com os quatro campos obrigatórios vazios, nesta ordem e com asterisco no rótulo', () => {
      renderizar()

      expect(dialogo()).toHaveTextContent('Devoluções de venda')
      const campos = [identificador(), url(), saida(), entrada()]
      const rotulos = ['Identificador da consulta', 'URL', 'Parâmetros de saída', 'Parâmetros de entrada']
      campos.forEach((campo, i) => {
        expect(campo).toHaveAttribute('aria-required', 'true')
        expect(campo).toHaveValue('')
        expect(campo.labels?.[0]?.textContent).toBe(`${rotulos[i]} *`)
        if (i > 0) expect(campos[i - 1].compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      })
      expect(saida().tagName).toBe('TEXTAREA')
      expect(entrada().tagName).toBe('TEXTAREA')
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    })

    it('limites do back-end no próprio campo: identificador com maxLength 60 e URL com maxLength 500', () => {
      renderizar()

      expect(identificador()).toHaveAttribute('maxLength', '60')
      expect(url()).toHaveAttribute('maxLength', '500')
    })

    it('"Inserir modelo de saída" e "Inserir modelo de entrada" preenchem os modelos prontos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      expect(saida()).toHaveValue(MODELO_JSON_SAIDA)
      expect(entrada()).toHaveValue('')

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(entrada()).toHaveValue(MODELO_JSON_ENTRADA)
    })
  })

  describe('botão "Concluir e ativar" e o que falta', () => {
    it('começa desabilitado com "falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido"', () => {
      renderizar()

      expect(concluir()).toBeDisabled()
      expect(within(dialogo()).getByText(FALTA_TUDO)).toBeInTheDocument()
      expect(concluir()).toHaveAccessibleDescription(FALTA_TUDO)
    })

    it('mostra só o que falta, na ordem, conforme os campos são preenchidos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), 'devolucoes')
      expect(within(dialogo()).getByText('falta: URL válida, JSON de saída válido, JSON de entrada válido')).toBeInTheDocument()

      await colar(user, url(), URL_VALIDA)
      expect(within(dialogo()).getByText('falta: JSON de saída válido, JSON de entrada válido')).toBeInTheDocument()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      expect(within(dialogo()).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(within(dialogo()).getByText(TUDO_PREENCHIDO)).toBeInTheDocument()
      expect(within(dialogo()).queryByText(/^falta:/)).not.toBeInTheDocument()
      expect(concluir()).toBeEnabled()
      expect(concluir()).toHaveAccessibleDescription(TUDO_PREENCHIDO)
    })

    it.each(['www.exemplo.com/consulta', 'ftp://exemplo.com', 'https://exemplo.com/minha consulta', 'https://'])(
      'URL inválida ("%s") continua em "falta: URL válida" e bloqueia o botão',
      async (texto) => {
        const user = usuarioRapido()
        renderizar()
        await user.type(identificador(), 'devolucoes')
        await preencherIntegracao(user)

        await substituir(user, url(), texto)

        expect(within(dialogo()).getByText('falta: URL válida')).toBeInTheDocument()
        expect(concluir()).toBeDisabled()
      },
    )

    it('JSON de saída inválido ou JSON de entrada com erro bloqueiam o botão', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)

      await substituir(user, saida(), '{"valor": 1,}')
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()

      await substituir(user, saida(), MODELO_JSON_SAIDA)
      await substituir(user, entrada(), '{"a": "%foo%"}')
      expect(within(dialogo()).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it.each(['   ', 'çã !/@'])(
      'identificador só com "%s" (descartado) continua faltando e não confirma',
      async (texto) => {
        const user = usuarioRapido()
        const { onConfirmar } = renderizar()
        await preencherIntegracao(user)

        await user.type(identificador(), texto)

        expect(identificador()).toHaveValue('')
        expect(within(dialogo()).getByText('falta: identificador')).toBeInTheDocument()
        expect(concluir()).toBeDisabled()
        await user.click(concluir())
        expect(onConfirmar).not.toHaveBeenCalled()
      },
    )

    it('Enter no identificador com campos faltando não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(identificador(), 'devolucoes{Enter}')

      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('com concluindo, "Concluir e ativar" fica desabilitado mesmo com tudo preenchido', async () => {
      const user = usuarioRapido()
      const { rerenderizar } = renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)
      expect(concluir()).toBeEnabled()

      rerenderizar({ concluindo: true })

      expect(concluir()).toBeDisabled()
    })
  })

  describe('confirmação', () => {
    it('confirma com o identificador limpo, a URL sem espaços nas pontas, os dois JSONs e as variáveis usadas', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(identificador(), ' devolucoes_venda ')
      expect(identificador()).toHaveValue('DEVOLUCOES_VENDA')
      await colar(user, url(), `  ${URL_VALIDA}  `)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith({
        identificador: 'DEVOLUCOES_VENDA',
        url: URL_VALIDA,
        parametrosSaida: MODELO_JSON_SAIDA,
        parametrosEntrada: MODELO_JSON_ENTRADA,
        variaveisUsadas: ['filial', 'competencia', 'dataInicial', 'dataFinal'],
      })
    })
  })

  describe('identificador: só A–Z, 0–9, "_", "-" e "." (regra do back-end de 06/11/2026), inválidos descartados na hora', () => {
    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOS-CLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
      ['fat.liq-2026 /!', 'FAT.LIQ-2026'],
    ])('ao digitar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOS-CLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
    ])('ao colar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it('confirma com o identificador já limpo', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await colar(user, identificador(), 'Devoluções de venda-2')
      await preencherIntegracao(user)
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'DEVOLUESDEVENDA-2' }))
    })

    it('escolher uma sugestão com caracteres inválidos preenche o campo com o identificador limpo, que é o confirmado', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ identificadores: [{ identificador: 'vendas líq-2', quantidade: 1 }] })

      const grupo = within(dialogo()).getByRole('group', { name: 'Identificadores existentes' })
      await user.click(within(grupo).getByRole('button', { name: /usado por 1 dado\(s\)/ }))
      expect(identificador()).toHaveValue('VENDASLQ-2')

      await preencherIntegracao(user)
      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'VENDASLQ-2' }))
    })

    it('mostra as sugestões "{IDENTIFICADOR} — usado por {n} dado(s)"; clicar preenche o campo', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      const grupo = within(dialogo()).getByRole('group', { name: 'Identificadores existentes' })
      expect(within(grupo).getAllByRole('button')).toHaveLength(4)
      await user.click(within(grupo).getByRole('button', { name: 'FATURAMENTO — usado por 1 dado(s)' }))
      expect(identificador()).toHaveValue('FATURAMENTO')

      await preencherIntegracao(user)
      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'FATURAMENTO' }))
    })

    it('sem identificadores recebidos não mostra a lista de sugestões', () => {
      renderizar({ identificadores: [] })

      expect(within(dialogo()).queryByRole('group', { name: 'Identificadores existentes' })).not.toBeInTheDocument()
    })
  })

  describe('validação em tempo real dos parâmetros de saída', () => {
    it('com o campo vazio nada aparece', () => {
      renderizar()

      expect(textoDe(validacaoSaida())).toBe('')
    })

    it('saída válida (lista com um item por filial): "JSON válido" com os campos e tipos do primeiro item', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '[{"filial": "101", "valor": "1500,00", "competencia": "10/2026"}, {"filial": "102", "valor": "980,50"}]')

      const validacao = validacaoSaida()!
      expect(validacao).toHaveTextContent('JSON válido')
      expect(validacao).toHaveTextContent('3 campos: filial (texto), valor (texto), competencia (texto)')
      expect(validacao).not.toHaveTextContent('inválido')
    })

    it('saída inválida: "JSON de saída inválido" com linha, coluna e explicação em português', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '{"valor": 1,}')

      const validacao = validacaoSaida()!
      expect(validacao).toHaveTextContent('JSON de saída inválido')
      expect(validacao).toHaveTextContent('Linha 1, coluna 12: vírgula sobrando')
    })

    it('saída que não é lista é inválida com a explicação', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '{}')

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('A saída deve ser uma lista com um item por filial')
    })

    it('apagar o conteúdo volta ao estado vazio', async () => {
      const user = usuarioRapido()
      renderizar()
      await colar(user, saida(), '{"valor": 1,}')

      await user.clear(saida())

      expect(textoDe(validacaoSaida())).toBe('')
    })
  })

  /**
   * Alteração de 10/11/2026 (seção 2.3 de `RESPOSTA-FINAL-meta-via-api.md`): a saída é uma lista com um
   * item por filial; na integração do dado externo (padrão `tipoAlvo="dado-externo"`) cada item precisa
   * de `filial` e `valor` (`competencia` opcional). Um texto abaixo do campo orienta o formato e
   * "Inserir modelo de saída" gera a lista de exemplo (`MODELO_JSON_SAIDA`).
   */
  describe('saída em lista (um item por filial: filial e valor)', () => {
    const ORIENTACAO = 'Lista com um item por filial: filial e valor (competencia opcional).'

    it('mostra o texto de orientação do formato, sem mencionar meta', () => {
      renderizar()

      expect(within(dialogo()).getByText(ORIENTACAO)).toBeInTheDocument()
      expect(within(dialogo()).queryByText(/filial e meta/)).not.toBeInTheDocument()
    })

    it('a orientação fica depois do campo de saída e antes do campo de entrada', () => {
      renderizar()

      const orientacao = within(dialogo()).getByText(ORIENTACAO)
      expect(saida().compareDocumentPosition(orientacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orientacao.compareDocumentPosition(entrada()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('"Inserir modelo de saída" gera a lista de exemplo, válida, com filial, valor e competencia', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))

      expect(saida()).toHaveValue(MODELO_JSON_SAIDA)
      expect(Array.isArray(JSON.parse(saida().value))).toBe(true)
      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (texto), competencia (texto)')
    })

    it('objeto solto (formato aceito antes) é inválido e bloqueia o botão', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)
      expect(concluir()).toBeEnabled()

      await substituir(user, saida(), '{"filial": "101", "valor": "1500,00"}')

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('A saída deve ser uma lista com um item por filial')
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it.each([
      ['item sem filial', '[{"valor": "1"}]', 'Item 1: falta o campo filial'],
      ['segundo item sem valor', '[{"filial": "101", "valor": "1"}, {"filial": "102"}]', 'Item 2: falta o campo valor'],
      ['item com meta no lugar de valor', '[{"filial": "101", "meta": "1"}]', 'Item 1: falta o campo valor'],
      ['item vazio', '[{}]', 'Item 1: faltam os campos filial e valor'],
      ['lista vazia', '[]', 'A lista está vazia'],
    ])('%s (%s) → "JSON de saída inválido" e a explicação do item', async (_nome, texto, mensagem) => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), texto)

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent(mensagem)
    })

    it('competencia é opcional: lista só com filial e valor libera o botão', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)

      await substituir(user, saida(), '[{"filial": "101", "valor": "0"}]')
      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (texto)')
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ parametrosSaida: '[{"filial": "101", "valor": "0"}]' }))
    })
  })

  describe('validação em tempo real dos parâmetros de entrada', () => {
    it('com o campo vazio nada aparece', () => {
      renderizar()

      expect(textoDe(validacaoEntrada())).toBe('')
    })

    it('entrada válida (modelo do documento): variáveis usadas, cálculos e prévia com valores de exemplo', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON válido')
      expect(within(validacao).getByText('Variáveis usadas: %filial%, %competencia%, %dataInicial%, %dataFinal%')).toBeInTheDocument()
      expect(within(validacao).getByText('inicio: %dataInicial% - 3m = 01/07/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('dias: %dataFinal% - %dataInicial% + 1 = 31')).toBeInTheDocument()
      expect(validacao.textContent).toContain('"filial": "101"')
      expect(validacao.textContent).toContain('"competencia": "10/2026"')
      expect(validacao.textContent).toContain('"inicio": "01/07/2026"')
      expect(validacao.textContent).toContain('"fim": "31/10/2026"')
      expect(validacao.textContent).toContain('"dias": "31"')
    })

    it('valores de exemplo vêm do dado: 3 meses retroativos → "(%mesesRetro% * 30) - 1" = 89; "31/01/2026 + 1m" = 28/02/2026', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES_3_MESES })

      await colar(user, entrada(), '{"dias": "(%mesesRetro% * 30) - 1", "data": "31/01/2026 + 1m", "inicio": "%dataInicial% - 30"}')

      const validacao = validacaoEntrada()!
      expect(within(validacao).getByText('dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
      expect(within(validacao).getByText('data: 31/01/2026 + 1m = 28/02/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('inicio: %dataInicial% - 30 = 01/09/2026')).toBeInTheDocument()
    })

    it('com janela retroativa 1 e coleta sem dia: mesesRetro 1 e diaColeta 1', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES })

      await colar(user, entrada(), '{"dias": "(%mesesRetro% * 30) - 1", "dia": "%diaColeta% + 0"}')

      expect(within(validacaoEntrada()!).getByText('dias: (%mesesRetro% * 30) - 1 = 29')).toBeInTheDocument()
      expect(within(validacaoEntrada()!).getByText('dia: %diaColeta% + 0 = 1')).toBeInTheDocument()
    })

    it('a data atual (hoje) define o período: hoje = 05/03/2026 → competência 03/2026', async () => {
      const user = usuarioRapido()
      renderizar({ hoje: new Date(2026, 2, 5) })

      await colar(user, entrada(), '{"c": "%competencia%", "fim": "%dataFinal% + 0"}')

      expect(validacaoEntrada()!.textContent).toContain('"c": "03/2026"')
      expect(within(validacaoEntrada()!).getByText('fim: %dataFinal% + 0 = 31/03/2026')).toBeInTheDocument()
    })

    it('entrada inválida: "JSON de entrada inválido" com a lista de todos os erros', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, entrada(), '{"a": "%foo%", "b": "5 / 0", "c": "%zona% + 1"}')

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacao).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Campo "a": variável desconhecida %foo% em "%foo%"',
        'Campo "b": divisão por zero em "5 / 0"',
        'Campo "c": variável de texto %zona% em conta em "%zona% + 1"',
      ])
    })

    it('entrada mal formada: erro com linha e coluna', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, entrada(), '{"a": "1",}')

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacao).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Linha 1, coluna 10: vírgula sobrando',
      ])
    })
  })

  describe('lista de variáveis (da API) e operadores', () => {
    it('mostra as variáveis recebidas como botões com %nome% e a descrição', () => {
      renderizar()

      const grupo = variaveisDisponiveis()
      expect(within(grupo).getAllByRole('button')).toHaveLength(13)
      for (const variavel of variaveisIntegracaoSemExemplo()) {
        expect(botaoVariavel(variavel.nome)).toHaveTextContent(`%${variavel.nome}%`)
        expect(botaoVariavel(variavel.nome)).toHaveTextContent(variavel.descricao)
      }
    })

    it('mostra os operadores + - * / ^ ( ), nesta ordem', () => {
      renderizar()

      expect(within(operadores()).getAllByRole('button').map((b) => b.textContent)).toEqual(['+', '-', '*', '/', '^', '(', ')'])
    })

    it('clicar em uma variável insere %nome% no ponto do cursor da entrada; cliques seguidos continuam do ponto inserido', async () => {
      const user = usuarioRapido()
      renderizar()
      await colar(user, entrada(), '{"a": ""}')
      await posicionarCursor(user, entrada(), 7)

      await user.click(botaoVariavel('mes'))
      expect(entrada()).toHaveValue('{"a": "%mes%"}')

      await user.click(within(operadores()).getByRole('button', { name: '+' }))
      expect(entrada()).toHaveValue('{"a": "%mes%+"}')

      await user.click(botaoVariavel('ano'))
      expect(entrada()).toHaveValue('{"a": "%mes%+%ano%"}')
    })

    it('com um trecho selecionado, a variável substitui a seleção', async () => {
      const user = usuarioRapido()
      renderizar()
      await colar(user, entrada(), '{"a": "xyz"}')
      await posicionarCursor(user, entrada(), 7, 10)

      await user.click(botaoVariavel('ano'))

      expect(entrada()).toHaveValue('{"a": "%ano%"}')
    })

    it.each([
      ['+', '{"a": "1+"}'],
      ['-', '{"a": "1-"}'],
      ['*', '{"a": "1*"}'],
      ['/', '{"a": "1/"}'],
      ['^', '{"a": "1^"}'],
      ['(', '{"a": "1("}'],
      [')', '{"a": "1)"}'],
    ])('operador "%s" é inserido no ponto do cursor', async (operador, esperado) => {
      const user = usuarioRapido()
      renderizar()
      await colar(user, entrada(), '{"a": "1"}')
      await posicionarCursor(user, entrada(), 8)

      await user.click(within(operadores()).getByRole('button', { name: operador }))

      expect(entrada()).toHaveValue(esperado)
    })

    describe('onde inserir quando o usuário ainda não posicionou o cursor (decisão de 10/11/2026: no fim)', () => {
      it('depois de "Inserir modelo de entrada", sem clicar na caixa, a variável vai para o fim do texto (não para o início)', async () => {
        const user = usuarioRapido()
        renderizar()
        await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))

        await user.click(botaoVariavel('mes'))

        expect(entrada()).toHaveValue(`${MODELO_JSON_ENTRADA}%mes%`)
      })

      it('"Inserir modelo de entrada" reinicia o cursor: a posição escolhida antes deixa de valer e a inserção vai para o fim', async () => {
        const user = usuarioRapido()
        renderizar()
        await colar(user, entrada(), '{"a": ""}')
        await posicionarCursor(user, entrada(), 7)

        await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
        await user.click(botaoVariavel('mes'))
        await user.click(within(operadores()).getByRole('button', { name: '+' }))

        expect(entrada()).toHaveValue(`${MODELO_JSON_ENTRADA}%mes%+`)
      })

      it('o cursor movido pelo teclado (digitação e setas) também conta como posicionado pelo usuário', async () => {
        const user = usuarioRapido()
        renderizar()
        await user.type(entrada(), '{{"a": ""}')
        await user.keyboard('{ArrowLeft}{ArrowLeft}')

        await user.click(botaoVariavel('ano'))

        expect(entrada()).toHaveValue('{"a": "%ano%"}')
      })

      it('a última posição da entrada continua valendo depois de usar outro campo', async () => {
        const user = usuarioRapido()
        renderizar()
        await colar(user, entrada(), '{"a": ""}')
        await posicionarCursor(user, entrada(), 7)
        await colar(user, url(), URL_VALIDA)

        await user.click(botaoVariavel('mes'))

        expect(entrada()).toHaveValue('{"a": "%mes%"}')
      })
    })

    it('em entrada vazia, clicar em uma variável insere %nome%', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoVariavel('filial'))

      expect(entrada()).toHaveValue('%filial%')
    })

    it('variáveis já usadas na entrada ficam destacadas (aria-pressed)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(botaoVariavel('filial')).toHaveAttribute('aria-pressed', 'false')
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))

      for (const nome of ['filial', 'competencia', 'dataInicial', 'dataFinal']) {
        expect(botaoVariavel(nome)).toHaveAttribute('aria-pressed', 'true')
      }
      for (const nome of ['colaborador', 'zona', 'mes', 'ano', 'hoje', 'diaColeta', 'mesesRetro']) {
        expect(botaoVariavel(nome)).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('enquanto as variáveis carregam, mostra "Carregando variáveis..."', () => {
      renderizar({ variaveis: [], carregandoVariaveis: true })

      expect(within(dialogo()).getByText('Carregando variáveis...')).toBeInTheDocument()
      expect(within(dialogo()).queryAllByRole('button', { name: /^%/ })).toHaveLength(0)
    })

    it('erro ao carregar as variáveis: mostra o erro, a lista fica vazia e toda variável é desconhecida', async () => {
      const user = usuarioRapido()
      renderizar({ variaveis: [], erroVariaveis: 'Não foi possível carregar as variáveis.' })

      expect(within(dialogo()).getByText('Não foi possível carregar as variáveis.')).toBeInTheDocument()
      expect(within(dialogo()).queryAllByRole('button', { name: /^%/ })).toHaveLength(0)

      await colar(user, entrada(), '{"filial": "%filial%"}')
      expect(within(validacaoEntrada()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Campo "filial": variável desconhecida %filial% em "%filial%"',
      ])
    })
  })

  describe('erro da API e cancelamento', () => {
    it('exibe o erro recebido em alerta dentro do diálogo, mantendo os campos preenchidos', async () => {
      const user = usuarioRapido()
      const { rerenderizar } = renderizar()
      await user.type(identificador(), 'xpto')
      await preencherIntegracao(user)

      rerenderizar({ identificadores: [], erro: 'Identificador sem coleta cadastrada.' })

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Identificador sem coleta cadastrada.')
      expect(identificador()).toHaveValue('XPTO')
      expect(url()).toHaveValue(URL_VALIDA)
      expect(saida()).toHaveValue(MODELO_JSON_SAIDA)
      expect(entrada()).toHaveValue(MODELO_JSON_ENTRADA)
    })

    it('Cancelar e Esc chamam onCancelar sem confirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(2)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('valores de exemplo da API (alteração de 09/11/2026): o exemplo de cada variável prevalece na prévia local', () => {
    function variavel(nome: string, exemplo: string | null): VariavelIntegracao[] {
      return variaveisIntegracaoSemExemplo().map((v) => (v.nome === nome ? { ...v, exemplo } : v))
    }

    it('com os exemplos da API (filial 100, período 10/2026, 3 meses retroativos), a prévia usa esses valores e não os do dado/hoje', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES, hoje: new Date(2026, 2, 5), variaveis: variaveisIntegracao() })

      await colar(
        user,
        entrada(),
        '{"filial": "%filial%", "c": "%competencia%", "dias": "(%mesesRetro% * 30) - 1", "inicio": "%dataInicial% - 30", "h": "%hoje% + 0"}',
      )

      const validacao = validacaoEntrada()!
      expect(validacao.textContent).toContain('"filial": "100"')
      expect(validacao.textContent).toContain('"c": "10/2026"')
      expect(within(validacao).getByText('dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
      expect(within(validacao).getByText('inicio: %dataInicial% - 30 = 01/09/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('h: %hoje% + 0 = 09/11/2026')).toBeInTheDocument()
    })

    it('número com vírgula no exemplo ("2,5") entra na conta', async () => {
      const user = usuarioRapido()
      renderizar({ variaveis: variavel('mesesRetro', '2,5') })

      await colar(user, entrada(), '{"x": "%mesesRetro% * 2"}')

      expect(within(validacaoEntrada()!).getByText('x: %mesesRetro% * 2 = 5')).toBeInTheDocument()
    })

    it('exemplo ausente (null) usa o valor do dado: Devoluções com 3 meses retroativos → 89', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES_3_MESES, variaveis: variavel('mesesRetro', null) })

      await colar(user, entrada(), '{"dias": "(%mesesRetro% * 30) - 1"}')

      expect(within(validacaoEntrada()!).getByText('dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
    })

    it('exemplo que não se converte no tipo ("abc" para número) usa o valor do dado: janela 1 → 29', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES, variaveis: variavel('mesesRetro', 'abc') })

      await colar(user, entrada(), '{"dias": "(%mesesRetro% * 30) - 1"}')

      expect(within(validacaoEntrada()!).getByText('dias: (%mesesRetro% * 30) - 1 = 29')).toBeInTheDocument()
    })

    it('exemplo de data fora de dd/mm/aaaa usa o valor calculado de hoje', async () => {
      const user = usuarioRapido()
      renderizar({ hoje: new Date(2026, 9, 15), variaveis: variavel('hoje', '2026-11-09') })

      await colar(user, entrada(), '{"h": "%hoje% + 0"}')

      expect(within(validacaoEntrada()!).getByText('h: %hoje% + 0 = 15/10/2026')).toBeInTheDocument()
    })
  })

  describe('erros por campo devolvidos pela API (400 { mensagem, erros } — alteração de 09/11/2026)', () => {
    const ERROS: ErroIntegracao[] = [
      { campo: 'identificador', mensagem: 'identificador invalido', linha: null, coluna: null, caminho: null, expressao: null },
      {
        campo: 'url',
        mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)',
        linha: null,
        coluna: null,
        caminho: null,
        expressao: null,
      },
      { campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1, caminho: null, expressao: null },
      { campo: 'parametros de entrada', mensagem: 'divisao por zero', linha: null, coluna: null, caminho: 'inicio', expressao: '5 / 0' },
      {
        campo: 'parametros de entrada',
        mensagem: 'variavel desconhecida: %foo%',
        linha: null,
        coluna: null,
        caminho: 'fim',
        expressao: '%foo%',
      },
    ]

    it('a mensagem geral fica no alerta do diálogo e cada erro aparece junto ao seu campo, formatado; os campos não são apagados', async () => {
      const user = usuarioRapido()
      const { rerenderizar } = renderizar()
      await user.type(identificador(), 'xpto')
      await preencherIntegracao(user)

      rerenderizar({ erro: 'integracao invalida: URL ...', errosCampos: ERROS })

      const geral = within(dialogo()).getByText('integracao invalida: URL ...')
      expect(geral.closest('[role="alert"]')).not.toBeNull()

      expect(identificador()).toHaveAttribute('aria-invalid', 'true')
      expect(identificador()).toHaveAccessibleDescription(expect.stringContaining('identificador invalido'))
      expect(url()).toHaveAttribute('aria-invalid', 'true')
      expect(url()).toHaveAccessibleDescription(
        expect.stringContaining('a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'),
      )
      expect(saida()).toHaveAttribute('aria-invalid', 'true')
      expect(saida()).toHaveAccessibleDescription(expect.stringContaining("Linha 3, coluna 1: virgula sobrando antes de '}'"))
      expect(entrada()).toHaveAttribute('aria-invalid', 'true')
      expect(entrada()).toHaveAccessibleDescription(expect.stringContaining('Campo "inicio": divisao por zero em "5 / 0"'))
      expect(entrada()).toHaveAccessibleDescription(expect.stringContaining('Campo "fim": variavel desconhecida: %foo% em "%foo%"'))

      expect(identificador()).toHaveValue('XPTO')
      expect(url()).toHaveValue(URL_VALIDA)
      expect(saida()).toHaveValue(MODELO_JSON_SAIDA)
      expect(entrada()).toHaveValue(MODELO_JSON_ENTRADA)
    })

    describe('o erro do 400 some do campo quando o usuário o altera (decisão de 10/11/2026)', () => {
      const ERRO_GERAL = 'integracao invalida: URL ...'
      const MENSAGEM_URL = 'a URL precisa comecar com http:// ou https://'

      /** Preenche tudo, recebe o 400 com os erros dos quatro campos e devolve o rerender. */
      async function comErrosDaApi(user: Usuario) {
        const utils = renderizar()
        await user.type(identificador(), 'xpto')
        await preencherIntegracao(user)
        utils.rerenderizar({ erro: ERRO_GERAL, errosCampos: ERROS })
        for (const campo of [identificador(), url(), saida(), entrada()]) {
          expect(campo).toHaveAttribute('aria-invalid', 'true')
        }
        return utils
      }

      /** O campo deixa de estar inválido (aria-invalid deixa de ser "true") e a mensagem da API some dele e da modal. */
      function semErroDaApi(campo: HTMLElement, mensagem: string) {
        expect(campo).not.toHaveAttribute('aria-invalid', 'true')
        expect(campo).not.toHaveAccessibleDescription(expect.stringContaining(mensagem))
        expect(within(dialogo()).queryByText(mensagem, { exact: false })).not.toBeInTheDocument()
      }

      function alertaGeralContinua() {
        expect(within(dialogo()).getByText(ERRO_GERAL).closest('[role="alert"]')).not.toBeNull()
      }

      it('digitar no identificador tira só o erro do identificador; os outros campos continuam com erro e o alerta geral fica', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.type(identificador(), '2')

        semErroDaApi(identificador(), 'identificador invalido')
        expect(url()).toHaveAttribute('aria-invalid', 'true')
        expect(saida()).toHaveAttribute('aria-invalid', 'true')
        expect(entrada()).toHaveAttribute('aria-invalid', 'true')
        alertaGeralContinua()
      })

      it('escolher uma sugestão de identificador também tira o erro do identificador', async () => {
        const user = usuarioRapido()
        // Sem digitar o identificador antes, para a sugestão ser a única alteração do campo.
        const { rerenderizar } = renderizar()
        await preencherIntegracao(user)
        rerenderizar({ erro: ERRO_GERAL, errosCampos: ERROS })
        expect(identificador()).toHaveAttribute('aria-invalid', 'true')

        const grupo = within(dialogo()).getByRole('group', { name: 'Identificadores existentes' })
        await user.click(within(grupo).getByRole('button', { name: 'FATURAMENTO — usado por 1 dado(s)' }))

        expect(identificador()).toHaveValue('FATURAMENTO')
        semErroDaApi(identificador(), 'identificador invalido')
        expect(url()).toHaveAttribute('aria-invalid', 'true')
      })

      it('digitar na URL tira só o erro da URL', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.type(url(), '/v2')

        semErroDaApi(url(), MENSAGEM_URL)
        expect(identificador()).toHaveAttribute('aria-invalid', 'true')
        expect(saida()).toHaveAttribute('aria-invalid', 'true')
        expect(entrada()).toHaveAttribute('aria-invalid', 'true')
        alertaGeralContinua()
      })

      it('digitar na saída tira só o erro da saída', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.type(saida(), ' ')

        semErroDaApi(saida(), "virgula sobrando antes de '}'")
        expect(identificador()).toHaveAttribute('aria-invalid', 'true')
        expect(url()).toHaveAttribute('aria-invalid', 'true')
        expect(entrada()).toHaveAttribute('aria-invalid', 'true')
        alertaGeralContinua()
      })

      it('"Inserir modelo de saída" também tira o erro da saída', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))

        semErroDaApi(saida(), "virgula sobrando antes de '}'")
        expect(entrada()).toHaveAttribute('aria-invalid', 'true')
      })

      it('digitar na entrada tira todos os erros da entrada (e só eles)', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.type(entrada(), ' ')

        semErroDaApi(entrada(), 'divisao por zero')
        semErroDaApi(entrada(), 'variavel desconhecida: %foo%')
        expect(identificador()).toHaveAttribute('aria-invalid', 'true')
        expect(url()).toHaveAttribute('aria-invalid', 'true')
        expect(saida()).toHaveAttribute('aria-invalid', 'true')
        alertaGeralContinua()
      })

      it('"Inserir modelo de entrada" também tira o erro da entrada', async () => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))

        semErroDaApi(entrada(), 'divisao por zero')
        expect(saida()).toHaveAttribute('aria-invalid', 'true')
      })

      it.each([
        ['uma variável', () => botaoVariavel('mes')],
        ['um operador', () => within(operadores()).getByRole('button', { name: '+' })],
      ])('inserir %s tira o erro da entrada', async (_nome, botao) => {
        const user = usuarioRapido()
        await comErrosDaApi(user)

        await user.click(botao())

        semErroDaApi(entrada(), 'divisao por zero')
        expect(saida()).toHaveAttribute('aria-invalid', 'true')
        alertaGeralContinua()
      })

      it('renderizar de novo com a mesma lista de erros (sem novo 400) não traz de volta o erro do campo alterado', async () => {
        const user = usuarioRapido()
        const { rerenderizar } = await comErrosDaApi(user)
        await user.type(url(), '/v2')

        rerenderizar({ erro: ERRO_GERAL, errosCampos: ERROS, concluindo: false })

        semErroDaApi(url(), MENSAGEM_URL)
      })

      it('um novo 400 (nova lista errosCampos nas props) volta a mostrar os erros, inclusive do campo já alterado', async () => {
        const user = usuarioRapido()
        const { rerenderizar } = await comErrosDaApi(user)
        await user.type(url(), '/v2')
        semErroDaApi(url(), MENSAGEM_URL)

        rerenderizar({ erro: ERRO_GERAL, errosCampos: [...ERROS] })

        expect(url()).toHaveAttribute('aria-invalid', 'true')
        expect(url()).toHaveAccessibleDescription(expect.stringContaining(MENSAGEM_URL))
        expect(identificador()).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('só os campos com erro ficam marcados como inválidos', () => {
      renderizar({ erro: 'integracao invalida', errosCampos: [ERROS[1]] })

      expect(url()).toHaveAttribute('aria-invalid', 'true')
      for (const campo of [identificador(), saida(), entrada()]) {
        expect(campo).not.toHaveAttribute('aria-invalid', 'true')
      }
    })

    it('sem errosCampos (padrão []), nenhum campo fica inválido', () => {
      renderizar({ erro: 'Falha ao concluir.' })

      for (const campo of [identificador(), url(), saida(), entrada()]) {
        expect(campo).not.toHaveAttribute('aria-invalid', 'true')
      }
    })
  })
})
