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
/** Saída sem mapeamento (11/11/2026): o que falta não cita mais "campo da filial" / "campo do valor". */
const FALTA_TUDO = 'falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido'
/** Rótulos das listas do mapeamento que deixaram de existir (saída sem mapeamento, 11/11/2026). */
const ROTULOS_MAPEAMENTO = ['Campo da filial', 'Campo do valor', 'Campo da meta', 'Campo da competência']
/** Saída com competência e campos de vários tipos (saída por "chave: tipo", 11/11/2026). */
const SAIDA_COMPLETA = '{ "codemp": "string", "codfil": "string", "vlrLiq": "number", "datCpt": "date", "ativo": "boolean" }'
const FORMATO_ANTIGO = 'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.'
const TUDO_PREENCHIDO = 'Todos os campos obrigatórios preenchidos'
const AVISO_FILIAL = '%filial% não tem valor numa consulta que traz todas as filiais; use %empresas%.'
const SEM_FORMATO_SOAP = 'A entrada deve ter "operacao" e "parametros" (ou "chamadas")'

/**
 * Entrada SOAP `{ operacao, parametros }` (alteração de 11/11/2026 — executor das integrações,
 * `FRONT-meta-via-api-fase2.md`, seção 2.1): os caminhos dos cálculos e dos erros passam a ser
 * `parametros.<campo>`.
 */
function soap(parametros: Record<string, unknown>): string {
  return JSON.stringify({ operacao: 'Consulta', parametros })
}

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

  /**
   * Preenche URL, saída (modelo) e entrada válidas (o identificador fica a cargo de cada teste). Sem
   * mapeamento desde 11/11/2026.
   */
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

      // Saída sem mapeamento (11/11/2026): com a saída válida, só a entrada falta.
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
      expect(within(dialogo()).getByText(TUDO_PREENCHIDO)).toBeInTheDocument()
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
    it('confirma com o identificador limpo, a URL sem espaços nas pontas, os dois JSONs e as variáveis usadas (sem mapeamento)', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(identificador(), ' devolucoes_venda ')
      expect(identificador()).toHaveValue('DEVOLUCOES_VENDA')
      await colar(user, url(), `  ${URL_VALIDA}  `)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(vi.mocked(onConfirmar).mock.calls[0][0]).toStrictEqual({
        identificador: 'DEVOLUCOES_VENDA',
        url: URL_VALIDA,
        parametrosSaida: MODELO_JSON_SAIDA,
        parametrosEntrada: MODELO_JSON_ENTRADA,
        variaveisUsadas: ['dataInicial', 'dataFinal', 'empresas'],
      })
    })

    it('saída com vários campos e tipos (inclusive date e boolean) confirma o texto como digitado, sem mapeamento', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)

      await substituir(user, saida(), SAIDA_COMPLETA)
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ parametrosSaida: SAIDA_COMPLETA }))
      expect(vi.mocked(onConfirmar).mock.calls[0][0]).not.toHaveProperty('mapeamento')
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

    it('saída válida ("chave: tipo"): "JSON válido" com o resumo "N campos: campo (tipo), ..."', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '{ "codemp": "string", "codfil": "string", "vlrLiq": "number" }')

      const validacao = validacaoSaida()!
      expect(validacao).toHaveTextContent('JSON válido')
      expect(validacao).toHaveTextContent('3 campos: codemp (string), codfil (string), vlrLiq (number)')
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

    it('tipo desconhecido é inválido com a explicação', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '{"codfil": "texto"}')

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('O campo "codfil" da saída tem tipo "texto"; use string, number, date ou boolean')
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
   * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `docs/propostas-backend/FRONT-saida-chave-tipo.md`):
   * a saída descreve **um item** da resposta como objeto `{ "campo": "tipo" }` (`string`, `number`, `date`,
   * `boolean`). Um texto abaixo do campo orienta o formato; "Inserir modelo de saída" gera
   * `{ "codfil": "string", "vlrLiq": "number" }`. A lista (formato antigo) é inválida: a modal só salva no
   * formato novo (decisão do usuário). O grupo "Marcadores da saída" (F5.21) foi retirado.
   */
  describe('saída por "chave: tipo"', () => {
    const ORIENTACAO = 'Descreva um item da resposta como { "campo": "tipo" }, com os tipos string, number, date ou boolean.'

    it('mostra o texto de orientação do formato, depois do campo de saída e antes do campo de entrada', () => {
      renderizar()

      const orientacao = within(dialogo()).getByText(ORIENTACAO)
      expect(saida().compareDocumentPosition(orientacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orientacao.compareDocumentPosition(entrada()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(within(dialogo()).queryByText(/Lista com um item por filial/)).not.toBeInTheDocument()
    })

    it('"Inserir modelo de saída" gera { "codfil": "string", "vlrLiq": "number" }, válido', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))

      expect(saida()).toHaveValue(MODELO_JSON_SAIDA)
      expect(JSON.parse(saida().value)).toEqual({ codfil: 'string', vlrLiq: 'number' })
      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('2 campos: codfil (string), vlrLiq (number)')
    })

    it.each([
      ['lista com valores', '[{"codfil": "101", "vlrLiq": "1500,00"}]'],
      ['lista com marcadores', '[{"codfil": "%filial%", "vlrLiq": "%valor%"}]'],
    ])('%s (formato antigo) é inválida e bloqueia o botão', async (_nome, texto) => {
      const user = usuarioRapido()
      renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)
      expect(concluir()).toBeEnabled()

      await substituir(user, saida(), texto)

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent(FORMATO_ANTIGO)
      expect(concluir()).toBeDisabled()
    })

    it('objeto vazio → "JSON de saída inválido" com a mensagem e o exemplo', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, saida(), '{}')

      expect(validacaoSaida()).toHaveTextContent('A saída precisa descrever ao menos um campo, ex.: { "codfil": "string", "vlrLiq": "number" }')
    })

    it('não há mais o grupo "Marcadores da saída" nem botões de marcador fora das "Variáveis disponíveis"', () => {
      renderizar()

      expect(within(dialogo()).queryByRole('group', { name: 'Marcadores da saída' })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: /%valor%/ })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: /%meta%/ })).not.toBeInTheDocument()
      // %competencia% é variável da entrada (F5.15): continua só no grupo "Variáveis disponíveis".
      expect(within(variaveisDisponiveis()).getByRole('button', { name: /%competencia%/ })).toBeInTheDocument()
      const marcadoresForaDasVariaveis = within(dialogo())
        .queryAllByRole('button', { name: /%[^%\s]+%/ })
        .filter((botao) => !variaveisDisponiveis().contains(botao))
      expect(marcadoresForaDasVariaveis).toHaveLength(0)
    })
  })

  /**
   * Alteração de 11/11/2026 (saída sem mapeamento — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`):
   * os parâmetros de saída servem só para mostrar ao back-end qual a saída esperada do web service; **não há
   * amarração** na modal. As listas "Campo da filial", "Campo do valor", "Campo da meta" e "Campo da
   * competência" deixam de existir, o "falta: ..." não cita mais nenhum "campo da ..." e qualquer saída
   * válida (objeto `{ "campo": "tipo" }` não vazio) libera o botão, sem exigir campos de filial ou valor.
   */
  describe('sem mapeamento da saída', () => {
    it('não há as listas "Campo da filial", "Campo do valor", "Campo da meta" nem "Campo da competência"', async () => {
      const user = usuarioRapido()
      renderizar()
      await colar(user, saida(), SAIDA_COMPLETA)

      for (const rotulo of ROTULOS_MAPEAMENTO) {
        expect(within(dialogo()).queryByLabelText(new RegExp(`^${rotulo}`))).not.toBeInTheDocument()
      }
      expect(within(dialogo()).queryAllByRole('combobox')).toHaveLength(0)
      expect(within(dialogo()).queryByText('Selecione o campo')).not.toBeInTheDocument()
    })

    it('qualquer saída válida libera o botão, mesmo sem campos com cara de filial ou valor', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)

      await substituir(user, saida(), '{ "descricao": "string", "ativo": "boolean" }')

      expect(validacaoSaida()).toHaveTextContent('2 campos: descricao (string), ativo (boolean)')
      expect(within(dialogo()).getByText(TUDO_PREENCHIDO)).toBeInTheDocument()
      expect(concluir()).toBeEnabled()
      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ parametrosSaida: '{ "descricao": "string", "ativo": "boolean" }' }))
    })

    it('o "falta: ..." nunca cita um "campo da ..." (nem com a saída vazia, inválida ou válida)', async () => {
      const user = usuarioRapido()
      renderizar()
      const rodape = () => within(dialogo()).getByText(/^(falta:|Todos os campos)/)

      expect(rodape()).not.toHaveTextContent(/campo d[ao]/)
      await colar(user, saida(), '{"codfil": "string",')
      expect(rodape()).not.toHaveTextContent(/campo d[ao]/)
      await substituir(user, saida(), SAIDA_COMPLETA)
      expect(rodape()).not.toHaveTextContent(/campo d[ao]/)
    })
  })

  describe('validação em tempo real dos parâmetros de entrada', () => {
    it('com o campo vazio nada aparece', () => {
      renderizar()

      expect(textoDe(validacaoEntrada())).toBe('')
    })

    it('entrada válida (modelo SOAP do documento): variáveis usadas e prévia com valores de exemplo', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON válido')
      expect(within(validacao).getByText('Variáveis usadas: %dataInicial%, %dataFinal%, %empresas%')).toBeInTheDocument()
      expect(validacao.textContent).toContain('"operacao": "NomeDaOperacao"')
      expect(validacao.textContent).toContain('"EDatIni": "01/10/2026"')
      expect(validacao.textContent).toContain('"EDatFim": "31/10/2026"')
      expect(validacao.textContent).toContain('"ECodEmp": "1,6,7,8,9"')
      expect(validacao).not.toHaveTextContent('%filial% não tem valor')
    })

    it('com cálculos: cada um como "<caminho>: <expressão> = <resultado>", com o caminho completo', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, entrada(), soap({ EDatIni: '%dataInicial% - 3m', EDias: '%dataFinal% - %dataInicial% + 1' }))

      const validacao = validacaoEntrada()!
      expect(within(validacao).getByText('parametros.EDatIni: %dataInicial% - 3m = 01/07/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('parametros.EDias: %dataFinal% - %dataInicial% + 1 = 31')).toBeInTheDocument()
      expect(validacao.textContent).toContain('"EDatIni": "01/07/2026"')
      expect(validacao.textContent).toContain('"EDias": "31"')
    })

    it('valores de exemplo vêm do dado: 3 meses retroativos → "(%mesesRetro% * 30) - 1" = 89; "31/01/2026 + 1m" = 28/02/2026', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES_3_MESES })

      await colar(user, entrada(), soap({ dias: '(%mesesRetro% * 30) - 1', data: '31/01/2026 + 1m', inicio: '%dataInicial% - 30' }))

      const validacao = validacaoEntrada()!
      expect(within(validacao).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
      expect(within(validacao).getByText('parametros.data: 31/01/2026 + 1m = 28/02/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('parametros.inicio: %dataInicial% - 30 = 01/09/2026')).toBeInTheDocument()
    })

    it('com janela retroativa 1 e coleta sem dia: mesesRetro 1 e diaColeta 1', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES })

      await colar(user, entrada(), soap({ dias: '(%mesesRetro% * 30) - 1', dia: '%diaColeta% + 0' }))

      expect(within(validacaoEntrada()!).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 29')).toBeInTheDocument()
      expect(within(validacaoEntrada()!).getByText('parametros.dia: %diaColeta% + 0 = 1')).toBeInTheDocument()
    })

    it('a data atual (hoje) define o período: hoje = 05/03/2026 → competência 03/2026', async () => {
      const user = usuarioRapido()
      renderizar({ hoje: new Date(2026, 2, 5) })

      await colar(user, entrada(), soap({ c: '%competencia%', fim: '%dataFinal% + 0' }))

      expect(validacaoEntrada()!.textContent).toContain('"c": "03/2026"')
      expect(within(validacaoEntrada()!).getByText('parametros.fim: %dataFinal% + 0 = 31/03/2026')).toBeInTheDocument()
    })

    it('entrada inválida: "JSON de entrada inválido" com a lista de todos os erros', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, entrada(), soap({ a: '%foo%', b: '5 / 0', c: '%zona% + 1' }))

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacao).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Campo "parametros.a": variável desconhecida %foo% em "%foo%"',
        'Campo "parametros.b": divisão por zero em "5 / 0"',
        'Campo "parametros.c": variável de texto %zona% em conta em "%zona% + 1"',
      ])
    })

    /**
     * Alteração de 11/11/2026 (executor — `FRONT-meta-via-api-fase2.md`, seção 2.1): a entrada precisa do
     * formato SOAP `{ operacao, parametros }` (ou `chamadas`); o formato antigo bloqueia o botão.
     */
    it('formato antigo (sem operacao nem parametros): "JSON de entrada inválido" com a explicação e botão bloqueado', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.type(identificador(), 'devolucoes')
      await preencherIntegracao(user)
      expect(concluir()).toBeEnabled()

      await substituir(user, entrada(), '{"filial": "%filial%", "competencia": "%competencia%"}')

      const validacao = validacaoEntrada()!
      expect(validacao).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacao).getAllByRole('listitem').map((item) => item.textContent)).toEqual([SEM_FORMATO_SOAP])
      expect(within(dialogo()).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it.each([
      ['operacao com espaço', '{"operacao": "Vol Ven", "parametros": {}}', '"operacao" só aceita letras, números e _'],
      ['operacao vazia', '{"operacao": "", "parametros": {}}', '"operacao" não pode ficar vazia'],
      ['parametros em lista', '{"operacao": "Consulta", "parametros": []}', '"parametros" deve ser um objeto'],
      ['chamada sem parametros', '{"operacao": "Consulta", "chamadas": [{}]}', 'Chamada 1: falta "parametros"'],
    ])('%s → "JSON de entrada inválido" com "%s"', async (_nome, texto, mensagem) => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, entrada(), texto)

      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacaoEntrada()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([mensagem])
    })

    it('várias chamadas ("chamadas") são aceitas e os cálculos mostram o caminho da chamada', async () => {
      const user = usuarioRapido()
      renderizar()

      await colar(
        user,
        entrada(),
        JSON.stringify({ operacao: 'Consulta', chamadas: [{ parametros: { EDatIni: '%dataInicial%' } }, { parametros: { EDatIni: '%dataInicial% - 1m' } }] }),
      )

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(within(validacaoEntrada()!).getByText('chamadas[1].parametros.EDatIni: %dataInicial% - 1m = 01/09/2026')).toBeInTheDocument()
    })

    /**
     * Aviso não bloqueante (fase 2, seção 2.3): numa chamada que traz todas as filiais, %filial%,
     * %colaborador% e %zona% não têm valor. Aparece dentro da região "Validação dos parâmetros de entrada",
     * com a entrada válida, e não impede concluir.
     */
    describe('aviso de %filial% (consulta que traz todas as filiais)', () => {
      it('entrada válida com %filial%: "JSON válido", o aviso e o botão continua habilitado', async () => {
        const user = usuarioRapido()
        const { onConfirmar } = renderizar()
        await user.type(identificador(), 'devolucoes')
        await preencherIntegracao(user)

        await substituir(user, entrada(), soap({ ECodFil: '%filial%', EDatIni: '%dataInicial%' }))

        const validacao = validacaoEntrada()!
        expect(validacao).toHaveTextContent('JSON válido')
        expect(within(validacao).getByText(AVISO_FILIAL)).toBeInTheDocument()
        expect(within(dialogo()).getByText(TUDO_PREENCHIDO)).toBeInTheDocument()
        expect(concluir()).toBeEnabled()
        await user.click(concluir())
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ variaveisUsadas: ['filial', 'dataInicial'] }))
      })

      it('%colaborador% e %zona% também avisam, um aviso por variável', async () => {
        const user = usuarioRapido()
        renderizar()

        await colar(user, entrada(), soap({ c: '%colaborador%', z: '%zona%' }))

        expect(within(validacaoEntrada()!).getByText('%colaborador% não tem valor numa consulta que traz todas as filiais; use %empresas%.')).toBeInTheDocument()
        expect(within(validacaoEntrada()!).getByText('%zona% não tem valor numa consulta que traz todas as filiais; use %empresas%.')).toBeInTheDocument()
      })

      it('sem %filial% (com %empresas%) não há aviso', async () => {
        const user = usuarioRapido()
        renderizar()

        await colar(user, entrada(), soap({ ECodEmp: '%empresas%' }))

        expect(validacaoEntrada()).toHaveTextContent('JSON válido')
        expect(within(dialogo()).queryByText(/não tem valor numa consulta/)).not.toBeInTheDocument()
      })

      it('entrada inválida não mostra o aviso', async () => {
        const user = usuarioRapido()
        renderizar()

        await colar(user, entrada(), soap({ f: '%filial%', x: '%foo%' }))

        expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
        expect(within(dialogo()).queryByText(AVISO_FILIAL)).not.toBeInTheDocument()
      })
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

      for (const nome of ['dataInicial', 'dataFinal', 'empresas']) {
        expect(botaoVariavel(nome)).toHaveAttribute('aria-pressed', 'true')
      }
      for (const nome of ['filial', 'empresa', 'colaborador', 'zona', 'mes', 'ano', 'competencia', 'hoje', 'diaColeta', 'mesesRetro']) {
        expect(botaoVariavel(nome)).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('enquanto as variáveis carregam, mostra "Carregando variáveis..."', () => {
      renderizar({ variaveis: [], carregandoVariaveis: true })

      expect(within(dialogo()).getByText('Carregando variáveis...')).toBeInTheDocument()
      expect(within(variaveisDisponiveis()).queryAllByRole('button', { name: /^%/ })).toHaveLength(0)
    })

    it('erro ao carregar as variáveis: mostra o erro, a lista fica vazia e toda variável é desconhecida', async () => {
      const user = usuarioRapido()
      renderizar({ variaveis: [], erroVariaveis: 'Não foi possível carregar as variáveis.' })

      expect(within(dialogo()).getByText('Não foi possível carregar as variáveis.')).toBeInTheDocument()
      expect(within(variaveisDisponiveis()).queryAllByRole('button', { name: /^%/ })).toHaveLength(0)

      await colar(user, entrada(), soap({ ECodEmp: '%empresas%' }))
      expect(within(validacaoEntrada()!).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Campo "parametros.ECodEmp": variável desconhecida %empresas% em "%empresas%"',
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
        soap({ filial: '%filial%', c: '%competencia%', dias: '(%mesesRetro% * 30) - 1', inicio: '%dataInicial% - 30', h: '%hoje% + 0' }),
      )

      const validacao = validacaoEntrada()!
      expect(validacao.textContent).toContain('"filial": "100"')
      expect(validacao.textContent).toContain('"c": "10/2026"')
      expect(within(validacao).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
      expect(within(validacao).getByText('parametros.inicio: %dataInicial% - 30 = 01/09/2026')).toBeInTheDocument()
      expect(within(validacao).getByText('parametros.h: %hoje% + 0 = 09/11/2026')).toBeInTheDocument()
    })

    it('número com vírgula no exemplo ("2,5") entra na conta', async () => {
      const user = usuarioRapido()
      renderizar({ variaveis: variavel('mesesRetro', '2,5') })

      await colar(user, entrada(), soap({ x: '%mesesRetro% * 2' }))

      expect(within(validacaoEntrada()!).getByText('parametros.x: %mesesRetro% * 2 = 5')).toBeInTheDocument()
    })

    it('exemplo ausente (null) usa o valor do dado: Devoluções com 3 meses retroativos → 89', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES_3_MESES, variaveis: variavel('mesesRetro', null) })

      await colar(user, entrada(), soap({ dias: '(%mesesRetro% * 30) - 1' }))

      expect(within(validacaoEntrada()!).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
    })

    it('exemplo que não se converte no tipo ("abc" para número) usa o valor do dado: janela 1 → 29', async () => {
      const user = usuarioRapido()
      renderizar({ dado: DEVOLUCOES, variaveis: variavel('mesesRetro', 'abc') })

      await colar(user, entrada(), soap({ dias: '(%mesesRetro% * 30) - 1' }))

      expect(within(validacaoEntrada()!).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 29')).toBeInTheDocument()
    })

    it('exemplo de data fora de dd/mm/aaaa usa o valor calculado de hoje', async () => {
      const user = usuarioRapido()
      renderizar({ hoje: new Date(2026, 9, 15), variaveis: variavel('hoje', '2026-11-09') })

      await colar(user, entrada(), soap({ h: '%hoje% + 0' }))

      expect(within(validacaoEntrada()!).getByText('parametros.h: %hoje% + 0 = 15/10/2026')).toBeInTheDocument()
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

    /**
     * Alteração de 11/11/2026 (saída sem mapeamento): não há mais listas do mapeamento, então um 400 com
     * `campo` `"campo da filial"`, `"campo do valor"`, `"campo da meta"` ou `"campo da competencia"` (back-end
     * ainda sem a versão nova) vai para a lista do **alerta geral**, sem marcar a saída nem outro campo.
     */
    describe('erros do 400 com "campo da ..." (mapeamento que deixou de existir)', () => {
      it.each(['campo da filial', 'campo do valor', 'campo da meta', 'campo da competencia'])(
        '"%s" vai para o alerta geral',
        async (campo) => {
          const user = usuarioRapido()
          const { rerenderizar } = renderizar()
          await user.type(identificador(), 'xpto')
          await preencherIntegracao(user)

          rerenderizar({
            erro: 'integracao invalida: ...',
            errosCampos: [{ campo, mensagem: `informe o "${campo}"`, linha: null, coluna: null, caminho: null, expressao: null }],
          })

          const alerta = within(dialogo()).getByRole('alert')
          expect(alerta).toHaveTextContent('integracao invalida: ...')
          expect(alerta).toHaveTextContent(`informe o "${campo}"`)
          for (const elemento of [identificador(), url(), saida(), entrada()]) {
            expect(elemento).not.toHaveAttribute('aria-invalid', 'true')
          }
        },
      )
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
