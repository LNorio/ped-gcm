import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_DEVOLUCOES_API, variaveisIntegracaoSemExemplo } from '../../test/dadosExternosFalsos'
import type {
  ParametrosValidacaoIntegracao,
  ResultadoValidacaoEntradaServidor,
  ResultadoValidacaoIntegracao,
  ResultadoValidacaoSaidaServidor,
} from '../../types/dominio'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'
import {
  ATRASO_VALIDACAO_SERVIDOR_MS,
  type DadosConclusaoConstrucao,
  DialogoConcluirConstrucao,
  type DialogoConcluirConstrucaoProps,
} from './DialogoConcluirConstrucao'

const DEVOLUCOES = paraDadoExterno(DADO_DEVOLUCOES_API)
const HOJE = new Date(2026, 9, 15)
const URL_VALIDA = 'https://api.exemplo.com/devolucoes'

type Validar = (parametros: ParametrosValidacaoIntegracao) => Promise<ResultadoValidacaoIntegracao>

interface Pendente {
  parametros: ParametrosValidacaoIntegracao
  resolver: (resultado: ResultadoValidacaoIntegracao) => void
  rejeitar: (falha: unknown) => void
}

/** Saídas por "chave: tipo" (11/11/2026), válidas pelo motor local. */
const SAIDA = '{"codfil": "string", "vlrLiq": "number"}'
const RESUMO_SAIDA = '2 campos: codfil (string), vlrLiq (number)'
const SAIDA_COM_DATA = '{"codfil": "string", "vlrLiq": "number", "datCpt": "date"}'
const FORMATO_ANTIGO = 'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.'

/** Saída válida do back-end no formato novo (`formato: "tipos"`), sem `resumo`: o resumo sai dos campos. */
const SAIDA_VALIDA_SERVIDOR: ResultadoValidacaoSaidaServidor = {
  valido: true,
  campos: [
    { nome: 'codfil', tipo: 'string' },
    { nome: 'vlrLiq', tipo: 'number' },
    { nome: 'datCpt', tipo: 'date' },
  ],
  formato: 'tipos',
  resumo: null,
  mapeamento: null,
}
const SAIDA_INVALIDA_SERVIDOR: ResultadoValidacaoSaidaServidor = {
  valido: false,
  erro: { mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 },
  erros: [],
}
const ENTRADA_VALIDA_SERVIDOR: ResultadoValidacaoEntradaServidor = {
  valido: true,
  variaveisUsadas: ['dataInicial', 'filial'],
  calculos: [{ caminho: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
  previa: { filial: '100', inicio: '01/07/2026' },
}
/** Entradas SOAP (formato exigido desde 11/11/2026), válidas pelo motor local. */
const ENTRADA_A = '{"operacao": "Consulta", "parametros": {"a": "1"}}'
const ENTRADA_B = '{"operacao": "Consulta", "parametros": {"b": "2"}}'
const ENTRADA_INICIO = '{"operacao": "Consulta", "parametros": {"inicio": "%dataInicial% - 3m"}}'

const ENTRADA_INVALIDA_SERVIDOR: ResultadoValidacaoEntradaServidor = {
  valido: false,
  erros: [
    { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero', linha: null, coluna: null },
    { campo: 'parametros de entrada', caminho: null, expressao: null, mensagem: 'virgula sobrando', linha: 1, coluna: 10 },
  ],
}

/**
 * Validação híbrida "front primeiro, back depois" (F5.18, decisão do usuário de 09/11/2026):
 * - o motor local (F5.14) mostra o resultado na hora;
 * - `ATRASO_VALIDACAO_SERVIDOR_MS` (400 ms) depois da última mudança nos JSONs, a modal chama
 *   `validarNoServidor({ parametrosSaida?, parametrosEntrada?, finalidade, mapeamento? })` só com os campos
 *   não vazios (nenhuma chamada com os dois vazios);
 * - a resposta que corresponde ao texto atual de um campo substitui o resultado local daquele campo
 *   (o "falta: ..." e o botão passam a usar o resultado do back-end); respostas obsoletas são
 *   ignoradas; falha mantém o resultado local, sem erro na tela.
 *
 * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `FRONT-saida-chave-tipo.md`, seção 4):
 * - `mapeamento` vai na chamada quando o usuário escolheu ao menos um campo do mapeamento (ou a modal abriu
 *   com um mapeamento salvo), no formato da escolha atual: dado externo `{ campoFilial, campoValor,
 *   campoCompetencia }` (`''` no obrigatório não escolhido, `null` sem competência); indicador com
 *   `campoMeta` no lugar de `campoValor`. Sem nenhuma escolha, a chave não vai;
 * - mudar o mapeamento também dispara a validação (mesma espera de 400 ms), se houver JSON preenchido;
 * - o resultado da saída do back-end só vale enquanto o texto **e** o mapeamento forem os enviados;
 * - saída válida do back-end: com `resumo`, ele é o exibido; sem `resumo`, monta-se pelos `campos`;
 * - saída válida do back-end **sem** `formato: "tipos"` (formato antigo, lista) não prevalece: vale o
 *   resultado local ("Formato antigo (lista)..."), pois a modal só salva no formato novo;
 * - as listas do mapeamento usam os campos do resultado da saída em vigor (o do back-end quando vale).
 */
describe('F5.18 — DialogoConcluirConstrucao: validação pelo back-end (híbrida, front primeiro)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  async function avancar(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  /** `validarNoServidor` controlado: cada chamada fica pendente até o teste resolver ou rejeitar. */
  function criarValidador() {
    const pendentes: Pendente[] = []
    const validar = vi.fn<Validar>(
      (parametros) =>
        new Promise<ResultadoValidacaoIntegracao>((resolve, reject) => {
          pendentes.push({ parametros, resolver: resolve, rejeitar: reject })
        }),
    )
    async function responder(indice: number, resultado: ResultadoValidacaoIntegracao) {
      await act(async () => {
        pendentes[indice].resolver(resultado)
        await vi.advanceTimersByTimeAsync(0)
      })
    }
    async function falhar(indice: number, falha: unknown) {
      await act(async () => {
        pendentes[indice].rejeitar(falha)
        await vi.advanceTimersByTimeAsync(0)
      })
    }
    return { validar, pendentes, responder, falhar }
  }

  function renderizar(props: Partial<DialogoConcluirConstrucaoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosConclusaoConstrucao) => void>()
    const montar = (extra: Partial<DialogoConcluirConstrucaoProps> = {}) => (
      <DialogoConcluirConstrucao
        modo={props.modo}
        dado={props.dado === undefined ? DEVOLUCOES : props.dado}
        identificadores={[]}
        variaveis={props.variaveis ?? variaveisIntegracaoSemExemplo()}
        carregandoVariaveis={false}
        erroVariaveis={null}
        concluindo={false}
        erro={null}
        hoje={HOJE}
        validarNoServidor={props.validarNoServidor}
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
        {...extra}
      />
    )
    const utils = render(montar())
    return { ...utils, onConfirmar, rerenderizar: (extra: Partial<DialogoConcluirConstrucaoProps>) => utils.rerender(montar(extra)) }
  }

  const dialogo = () => screen.getByRole('dialog', { name: /Concluir construção|Configurações da integração/ })
  const identificador = () => within(dialogo()).getByLabelText('Identificador da consulta')
  const url = () => within(dialogo()).getByLabelText('URL')
  const saida = () => within(dialogo()).getByLabelText('Parâmetros de saída')
  const entrada = () => within(dialogo()).getByLabelText('Parâmetros de entrada')
  const campoFilial = () => within(dialogo()).getByLabelText('Campo da filial') as HTMLSelectElement
  const campoValor = () => within(dialogo()).getByLabelText('Campo do valor') as HTMLSelectElement
  const validacaoSaida = () => within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })
  const validacaoEntrada = () => within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
  const concluir = () => within(dialogo()).getByRole('button', { name: 'Concluir e ativar' })
  const itensEntrada = () => within(validacaoEntrada()).queryAllByRole('listitem').map((item) => item.textContent)
  const opcoesDe = (select: HTMLSelectElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)

  async function colar(user: ReturnType<typeof configurarUsuario>, campo: HTMLElement, texto: string) {
    await user.click(campo)
    await user.paste(texto)
  }

  async function substituir(user: ReturnType<typeof configurarUsuario>, campo: HTMLElement, texto: string) {
    await user.clear(campo)
    if (texto !== '') await colar(user, campo, texto)
  }

  /** Identificador e URL válidos (os JSONs ficam a cargo de cada teste). */
  async function preencherIdentificadorEUrl(user: ReturnType<typeof configurarUsuario>) {
    await user.type(identificador(), 'devolucoes')
    await colar(user, url(), URL_VALIDA)
  }

  /** Escolhe o campo da filial e o do valor do modelo de saída (codfil e vlrLiq). */
  async function escolherMapeamento(user: ReturnType<typeof configurarUsuario>) {
    await user.selectOptions(campoFilial(), 'codfil')
    await user.selectOptions(campoValor(), 'vlrLiq')
  }

  it('a espera é de 400 ms', () => {
    expect(ATRASO_VALIDACAO_SERVIDOR_MS).toBe(400)
  })

  describe('quando chamar', () => {
    it('o resultado local aparece na hora; a chamada ao back-end só sai 400 ms depois da última mudança, com o texto atual', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), SAIDA)

      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
      expect(validar).not.toHaveBeenCalled()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS - 100)
      expect(validar).not.toHaveBeenCalled()
      await avancar(100)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: SAIDA, finalidade: 'valor' })
    })

    it('cada mudança reinicia a espera: só uma chamada, com o texto final', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '{"codfil": "string", "vlrLiq": "number"')
      await avancar(250)
      await user.type(saida(), '}')
      await avancar(250)
      expect(validar).not.toHaveBeenCalled()

      await avancar(150)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: SAIDA, finalidade: 'valor' })
    })

    it('com os dois JSONs preenchidos, uma única chamada leva os dois textos', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: MODELO_JSON_SAIDA, parametrosEntrada: MODELO_JSON_ENTRADA, finalidade: 'valor' })
    })

    it('campo vazio (ou só com espaços) não é enviado', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '   ')
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: ENTRADA_A, finalidade: 'valor' })
    })

    it('com os dois JSONs vazios não chama (mudar só o identificador e a URL não valida no back-end)', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await preencherIdentificadorEUrl(user)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })

    it('apagar os dois JSONs depois de validar não gera nova chamada e nada aparece', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      await user.clear(saida())
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validacaoSaida().textContent?.trim()).toBe('')
    })

    it('sem validarNoServidor, a modal funciona só com o motor local', async () => {
      const user = configurarUsuario()
      renderizar()

      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
    })

    it('fechar a modal (dado null) antes dos 400 ms cancela a chamada', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      const { rerenderizar } = renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)

      rerenderizar({ dado: null })
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })
  })

  describe('resultado do back-end substitui o local do campo', () => {
    it('saída válida: "JSON válido" e "N campos: ..." com os tipos como vieram do back-end (mesmo divergindo do local)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '{"codfil": "string", "vlrLiq": "string", "datCpt": "date"}')
      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (string), datCpt (date)')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)')
      expect(validacaoSaida()).not.toHaveTextContent('vlrLiq (string)')
    })

    it('com "resumo" na resposta, o resumo do back-end é o exibido (prevalece sobre os campos)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: { ...SAIDA_VALIDA_SERVIDOR, campos: [{ nome: 'codfil', tipo: 'string' }], resumo: '2 campos: codfil (string), vlrLiq (number) — back-end' },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('2 campos: codfil (string), vlrLiq (number) — back-end')
      expect(validacaoSaida()).not.toHaveTextContent('1 campo')
    })

    it('o mesmo JSON mostra o mesmo resumo antes e depois da resposta (mesmos nomes de tipo)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA_COM_DATA)
      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)')
    })

    it('divergência — o local aceita e o back-end recusa a saída: prevalece o back-end ("JSON de saída inválido" com linha e coluna), as listas ficam sem campos e o botão bloqueia', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await escolherMapeamento(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(concluir()).toBeEnabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: ENTRADA_VALIDA_SERVIDOR })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent("Linha 3, coluna 1: virgula sobrando antes de '}'")
      expect(within(dialogo()).getByText('falta: JSON de saída válido, campo da filial, campo do valor')).toBeInTheDocument()
      expect(campoFilial()).toBeDisabled()
      expect(concluir()).toBeDisabled()
    })

    it('divergência — o local recusa e o back-end aceita a saída (formato "tipos"): prevalece o back-end e as listas usam os campos do back-end', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '{"codfil": "string", "qtd": "integer"}')
      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(campoFilial()).toBeDisabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: { ...SAIDA_VALIDA_SERVIDOR, campos: [{ nome: 'codfil', tipo: 'string' }, { nome: 'qtd', tipo: 'number' }] },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('2 campos: codfil (string), qtd (number)')
      expect(campoFilial()).toBeEnabled()
      expect(opcoesDe(campoValor())).toEqual(['Selecione o campo', 'codfil', 'qtd'])
    })

    it('formato antigo — o local recusa a lista e o back-end a aceita sem "formato": continua valendo o local (só salva no formato novo)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(validacaoSaida()).toHaveTextContent(FORMATO_ANTIGO)

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: {
          valido: true,
          campos: [
            { nome: 'filial', tipo: 'texto' },
            { nome: 'valor', tipo: 'numero' },
          ],
          formato: null,
          resumo: null,
          mapeamento: null,
        },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent(FORMATO_ANTIGO)
      expect(validacaoSaida()).not.toHaveTextContent('filial (texto)')
      expect(concluir()).toBeDisabled()
    })

    it('divergência — o local recusa e o back-end aceita a entrada: prevalece o back-end e o botão libera', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      const { onConfirmar } = renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await escolherMapeamento(user)
      await colar(user, entrada(), '{"r": "%regiao%"}')
      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(concluir()).toBeDisabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: null,
        entrada: { valido: true, variaveisUsadas: ['regiao'], calculos: [], previa: { r: 'Centro-Oeste' } },
      })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validacaoEntrada()).not.toHaveTextContent('inválido')
      expect(within(validacaoEntrada()).getByText('Variáveis usadas: %regiao%')).toBeInTheDocument()
      expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(concluir()).toBeEnabled()

      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(
        expect.objectContaining({ identificador: 'DEVOLUCOES', url: URL_VALIDA, parametrosEntrada: '{"r": "%regiao%"}' }),
      )
    })

    it('o local aceita e o back-end recusa com a lista "erros" (textos do back-end, já convertidos pelo serviço): prevalece a mensagem do back-end', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      expect(validacaoSaida()).toHaveTextContent('JSON válido')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: {
          valido: false,
          erro: { mensagem: 'integracao invalida', linha: null, coluna: null },
          erros: [
            {
              campo: 'parametros de saida',
              mensagem: 'informe o "campo da filial" (o nome do campo da saida que traz o codigo da filial)',
              linha: null,
              coluna: null,
              caminho: null,
              expressao: null,
            },
          ],
        },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(within(validacaoSaida()).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'informe o "campo da filial" (o nome do campo da saida que traz o codigo da filial)',
      ])
    })

    it('entrada válida: "JSON válido", variáveis usadas com %, cada cálculo "<caminho>: <expressão> = <resultado>" e a prévia com 2 espaços', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), '{"filial": "%filial%", "inicio": "%dataInicial% - 3m"}')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: null, entrada: ENTRADA_VALIDA_SERVIDOR })

      const validacao = validacaoEntrada()
      expect(validacao).toHaveTextContent('JSON válido')
      expect(within(validacao).getByText('Variáveis usadas: %dataInicial%, %filial%')).toBeInTheDocument()
      expect(within(validacao).getByText('inicio: %dataInicial% - 3m = 01/07/2026')).toBeInTheDocument()
      expect(validacao.textContent).toContain(JSON.stringify(ENTRADA_VALIDA_SERVIDOR.valido ? ENTRADA_VALIDA_SERVIDOR.previa : null, null, 2))
      expect(validacao.textContent).toContain('"filial": "100"')
      expect(validacao.textContent).not.toContain('"filial": "101"')
    })

    it('entrada inválida: "JSON de entrada inválido" e um item por erro, formatado', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_INICIO)
      expect(validacaoEntrada()).toHaveTextContent('JSON válido')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: null, entrada: ENTRADA_INVALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(itensEntrada()).toEqual(['Campo "inicio": divisao por zero em "5 / 0"', 'Linha 1, coluna 10: virgula sobrando'])
    })

    it('editar o campo depois da resposta volta a mostrar o resultado local na hora (a resposta não é mais do texto atual)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })
      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')

      await substituir(user, saida(), SAIDA_COM_DATA)

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)')
    })
  })

  describe('respostas obsoletas e falhas', () => {
    it('resposta que chega depois de o texto mudar é ignorada; vale a resposta do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await substituir(user, saida(), SAIDA_COM_DATA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar).toHaveBeenCalledTimes(2)

      // A resposta da segunda chamada (texto atual) chega primeiro; a da primeira chega depois.
      await responder(1, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)')
      expect(validacaoSaida()).not.toHaveTextContent('inválido')
    })

    it('resposta de um texto antigo, sem nova resposta, mantém o resultado local do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await substituir(user, saida(), '{"codfil": "string", "vlrLiq": "number", "total": "number"}')
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), total (number)')
      expect(validacaoSaida()).not.toHaveTextContent('inválido')
    })

    it('a correspondência é por campo: a saída não mudou e recebe o resultado do back-end; a entrada mudou e fica com o local', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar.mock.calls[0][0]).toStrictEqual({
        parametrosSaida: SAIDA,
        parametrosEntrada: ENTRADA_A,
        finalidade: 'valor',
      })

      await substituir(user, entrada(), ENTRADA_B)
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: ENTRADA_INVALIDA_SERVIDOR })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validacaoEntrada().textContent).toContain('"b": "2"')
      expect(itensEntrada()).toEqual([])
    })

    it('falha da chamada mantém o resultado local, sem mensagem de erro na tela', async () => {
      const user = configurarUsuario()
      const { validar, falhar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await falhar(0, new Error('Não foi possível conectar ao servidor.'))

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText('Não foi possível conectar ao servidor.')).not.toBeInTheDocument()
    })

    it('depois de uma falha, a próxima mudança tenta de novo', async () => {
      const user = configurarUsuario()
      const { validar, falhar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await falhar(0, new Error('falhou'))

      await user.type(saida(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(2)
      expect(validar.mock.calls[1][0]).toStrictEqual({ parametrosSaida: `${SAIDA} `, finalidade: 'valor' })
    })
  })

  /**
   * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `FRONT-saida-chave-tipo.md`, seção 4): o
   * mapeamento vai na validação e faz parte do que a resposta da saída "vale para".
   */
  describe('mapeamento na validação pelo back-end (11/11/2026)', () => {
    it('escolher o campo da filial dispara a validação (400 ms) com o mapeamento da escolha atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      await user.selectOptions(campoFilial(), 'codfil')
      expect(validar).toHaveBeenCalledTimes(1)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(2)
      expect(validar.mock.calls[1][0]).toStrictEqual({
        parametrosSaida: SAIDA,
        finalidade: 'valor',
        mapeamento: { campoFilial: 'codfil', campoValor: '', campoCompetencia: null },
      })
    })

    it('com a filial, o valor e a competência escolhidos, o mapeamento completo vai junto dos dois JSONs', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA_COM_DATA)
      await escolherMapeamento(user)
      await user.selectOptions(within(dialogo()).getByLabelText('Campo da competência'), 'datCpt')
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({
        parametrosSaida: SAIDA_COM_DATA,
        parametrosEntrada: ENTRADA_A,
        finalidade: 'valor',
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: 'datCpt' },
      })
    })

    it('mudar o mapeamento depois da resposta volta a mostrar o resultado local da saída (a resposta era de outro mapeamento)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await escolherMapeamento(user)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: { ...SAIDA_VALIDA_SERVIDOR, resumo: 'resumo do back-end' }, entrada: null })
      expect(validacaoSaida()).toHaveTextContent('resumo do back-end')

      await user.selectOptions(campoFilial(), 'vlrLiq')

      expect(validacaoSaida()).not.toHaveTextContent('resumo do back-end')
      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
    })

    it('modo configurar: o mapeamento salvo vai na primeira validação (abrir não chama)', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({
        modo: 'configurar',
        validarNoServidor: validar,
        dado: {
          ...DEVOLUCOES,
          situacao: 'ativo',
          identificador: 'DEVOLUCOES',
          url: URL_VALIDA,
          parametrosSaida: { codfil: 'string', vlrLiq: 'number' },
          parametrosEntrada: { operacao: 'Consulta', parametros: { a: '1' } },
          mapeamentoSaida: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null },
        },
      })
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)
      expect(validar).not.toHaveBeenCalled()

      await user.type(saida(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toMatchObject({
        finalidade: 'valor',
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null },
      })
    })
  })

  /**
   * Alteração de 11/11/2026 (`FRONT-meta-via-api-fase1.md`, item 2.2; `FRONT-meta-via-api-fase2.md`,
   * seções 2.1 e 2.3):
   * - a modal envia `finalidade` conforme o tipo da integração: `"valor"` no dado externo (padrão) e
   *   `"meta"` no indicador (`tipoAlvo="indicador"`);
   * - saída inválida não sintática (`linha`/`coluna` null) mostra só a mensagem; os itens de `erros`
   *   aparecem como lista, sem repetir o texto da mensagem;
   * - erro da entrada sem caminho (falta `operacao`, `campo: ""`) aparece como item com a mensagem;
   * - o aviso de `%filial%` também aparece com o resultado válido do back-end (pelas variáveis usadas
   *   devolvidas).
   */
  describe('finalidade, erros da saída, entrada SOAP e aviso (11/11/2026)', () => {
    it('integração do indicador (tipoAlvo "indicador", modo configurar): finalidade "meta" e o mapeamento com campoMeta', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      render(
        <DialogoConcluirConstrucao
          modo="configurar"
          tipoAlvo="indicador"
          dado={{ id: 11, nome: 'Margem', identificador: null, url: null, parametrosSaida: null, parametrosEntrada: null }}
          identificadores={[]}
          variaveis={variaveisIntegracaoSemExemplo()}
          carregandoVariaveis={false}
          erroVariaveis={null}
          concluindo={false}
          erro={null}
          hoje={HOJE}
          validarNoServidor={validar}
          onConfirmar={vi.fn()}
          onCancelar={vi.fn()}
        />,
      )
      const modal = screen.getByRole('dialog', { name: 'Configurações da integração' })

      await colar(user, within(modal).getByLabelText('Parâmetros de saída'), '{"codfil": "string", "metVlr": "number"}')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: '{"codfil": "string", "metVlr": "number"}', finalidade: 'meta' })

      await user.selectOptions(within(modal).getByLabelText('Campo da meta'), 'metVlr')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar.mock.calls[1][0]).toStrictEqual({
        parametrosSaida: '{"codfil": "string", "metVlr": "number"}',
        finalidade: 'meta',
        mapeamento: { campoFilial: '', campoMeta: 'metVlr', campoCompetencia: null },
      })
    })

    it('saída recusada pelo back-end sem posição (linha e coluna null): só a mensagem, sem "Linha null"', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, {
        saida: {
          valido: false,
          erro: { mensagem: 'a saida precisa descrever ao menos um campo', linha: null, coluna: null },
          erros: [],
        },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('a saida precisa descrever ao menos um campo')
      expect(validacaoSaida()).not.toHaveTextContent('null')
      expect(validacaoSaida()).not.toHaveTextContent('Linha')
    })

    it('saída inválida com "erros": um item por erro (formatado), sem repetir a mensagem geral; o botão bloqueia', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await colar(user, saida(), SAIDA)
      await escolherMapeamento(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(concluir()).toBeEnabled()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, {
        saida: {
          valido: false,
          erro: { mensagem: 'parametros de saida invalidos', linha: null, coluna: null },
          erros: [
            { campo: 'parametros de saida', mensagem: 'parametros de saida invalidos', linha: null, coluna: null, caminho: null, expressao: null },
            {
              campo: 'parametros de saida',
              mensagem: 'o campo "vlrLiq" da saida tem tipo "texto"; use string, number, date ou boolean',
              linha: null,
              coluna: null,
              caminho: null,
              expressao: null,
            },
            { campo: 'parametros de saida', mensagem: 'item 2 sem valor', linha: null, coluna: null, caminho: '[1]', expressao: '{}' },
          ],
        },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(within(validacaoSaida()).getByText('parametros de saida invalidos')).toBeInTheDocument()
      expect(within(validacaoSaida()).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'o campo "vlrLiq" da saida tem tipo "texto"; use string, number, date ou boolean',
        'Campo "[1]": item 2 sem valor em "{}"',
      ])
      expect(within(dialogo()).getByText('falta: JSON de saída válido, campo da filial, campo do valor')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it('erro da entrada sem caminho (falta "operacao" — campo "" no back-end): o item mostra só a mensagem', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, {
        saida: null,
        entrada: {
          valido: false,
          erros: [
            {
              campo: 'parametros de entrada',
              caminho: null,
              expressao: null,
              mensagem: 'a entrada SOAP precisa de "operacao" e "parametros" (ou "chamadas")',
              linha: null,
              coluna: null,
            },
          ],
        },
      })

      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(itensEntrada()).toEqual(['a entrada SOAP precisa de "operacao" e "parametros" (ou "chamadas")'])
    })

    it('entrada válida pelo back-end com %filial% nas variáveis usadas: mostra o aviso, sem bloquear', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await escolherMapeamento(user)
      await colar(user, entrada(), ENTRADA_INICIO)
      expect(within(dialogo()).queryByText(/não tem valor numa consulta/)).not.toBeInTheDocument()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, { saida: null, entrada: ENTRADA_VALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(
        within(validacaoEntrada()).getByText('%filial% não tem valor numa consulta que traz todas as filiais; use %empresas%.'),
      ).toBeInTheDocument()
      expect(concluir()).toBeEnabled()
    })
  })
})
