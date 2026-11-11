import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_DEVOLUCOES_API, variaveisIntegracaoSemExemplo } from '../../test/dadosExternosFalsos'
import type {
  ParametrosValidacaoIntegracao,
  ResultadoValidacaoEntradaServidor,
  ResultadoValidacaoIntegracao,
} from '../../types/dominio'
import { MODELO_JSON_ENTRADA } from '../../utils/integracao/modelos'
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
/** Mensagem do `validar` do ambiente de testes (back-end sem a versão nova), vista no print do usuário de 11/11/2026. */
const ERRO_SAIDA_BACK_ANTIGO = 'a saida precisa ser uma lista (entre colchetes) com um item por filial'

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
 * Resposta de um back-end antigo, que ainda devolve o resultado da saída (formato anterior a 11/11/2026).
 * O `ResultadoValidacaoIntegracao` não tem mais `saida`; a modal deve ignorá-la.
 */
function respostaComSaidaAntiga(entrada: ResultadoValidacaoEntradaServidor | null): ResultadoValidacaoIntegracao {
  return {
    saida: { valido: false, erro: { mensagem: ERRO_SAIDA_BACK_ANTIGO, linha: null, coluna: null }, erros: [] },
    entrada,
  } as unknown as ResultadoValidacaoIntegracao
}

/**
 * Validação híbrida "front primeiro, back depois" (F5.18, decisão do usuário de 09/11/2026): o motor local
 * (F5.14) mostra o resultado na hora e, `ATRASO_VALIDACAO_SERVIDOR_MS` (400 ms) depois da última mudança, o
 * back-end valida; a resposta que corresponde ao texto atual substitui o resultado local; respostas
 * obsoletas são ignoradas; falha mantém o local, sem erro na tela.
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`):
 * o erro do print do usuário ("a saida precisa ser uma lista (entre colchetes)...") vinha do `validar` do
 * ambiente (back-end sem a versão nova), que prevalecia sobre a validação local. Agora:
 * - a **saída é validada só no front** (`validarSaida`): ela nunca vai ao servidor e um resultado de saída
 *   devolvido pelo back-end (versão antiga) é ignorado;
 * - só a **entrada** vai ao servidor: `validarNoServidor({ parametrosEntrada, finalidade })` — sem
 *   `parametrosSaida` e sem `mapeamento`; `finalidade` continua indo (`valor` no dado externo, `meta` no
 *   indicador), junto da entrada;
 * - mudar só a saída não chama o back-end; com a entrada vazia (ou só espaços) não chama;
 * - o resultado da entrada do back-end vale enquanto o texto da entrada for o enviado.
 */
describe('F5.18 — DialogoConcluirConstrucao: validação pelo back-end (só a entrada; saída só no front)', () => {
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
        tipoAlvo={props.tipoAlvo}
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
  const validacaoSaida = () => within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })
  const validacaoEntrada = () => within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
  const concluir = () => within(dialogo()).getByRole('button', { name: 'Concluir e ativar' })
  const itensEntrada = () => within(validacaoEntrada()).queryAllByRole('listitem').map((item) => item.textContent)

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

  it('a espera é de 400 ms', () => {
    expect(ATRASO_VALIDACAO_SERVIDOR_MS).toBe(400)
  })

  describe('quando chamar (só a entrada vai ao servidor)', () => {
    it('o resultado local aparece na hora; a chamada só sai 400 ms depois da última mudança na entrada, com o texto atual e a finalidade', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, entrada(), ENTRADA_A)

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validar).not.toHaveBeenCalled()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS - 100)
      expect(validar).not.toHaveBeenCalled()
      await avancar(100)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: ENTRADA_A, finalidade: 'valor' })
    })

    it('cada mudança na entrada reinicia a espera: só uma chamada, com o texto final', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, entrada(), '{"operacao": "Consulta", "parametros": {"a": "1"}')
      await avancar(250)
      await user.type(entrada(), '}')
      await avancar(250)
      expect(validar).not.toHaveBeenCalled()

      await avancar(150)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: ENTRADA_A, finalidade: 'valor' })
    })

    it('só a saída preenchida: o back-end não é chamado e a saída mostra o resultado local', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), SAIDA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 3)

      expect(validar).not.toHaveBeenCalled()
      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
    })

    it('com os dois JSONs preenchidos, a chamada leva só a entrada (nunca "parametrosSaida" nem "mapeamento")', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: MODELO_JSON_ENTRADA, finalidade: 'valor' })
      expect(validar.mock.calls[0][0]).not.toHaveProperty('parametrosSaida')
      expect(validar.mock.calls[0][0]).not.toHaveProperty('mapeamento')
    })

    it('mudar só a saída depois de validar a entrada não gera nova chamada', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_VALIDA_SERVIDOR })

      await colar(user, saida(), SAIDA)
      await substituir(user, saida(), SAIDA_COM_DATA)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).toHaveBeenCalledTimes(1)
    })

    it('entrada vazia ou só com espaços não chama (nem com a saída preenchida)', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), SAIDA)
      await colar(user, entrada(), '   ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })

    it('com os dois JSONs vazios não chama (mudar só o identificador e a URL não valida no back-end)', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await preencherIdentificadorEUrl(user)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })

    it('apagar a entrada depois de validar não gera nova chamada e nada aparece', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_INICIO)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_VALIDA_SERVIDOR })

      await user.clear(entrada())
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validacaoEntrada().textContent?.trim()).toBe('')
    })

    it('sem validarNoServidor, a modal funciona só com o motor local', async () => {
      const user = configurarUsuario()
      renderizar()

      await colar(user, saida(), SAIDA)
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
    })

    it('fechar a modal (dado null) antes dos 400 ms cancela a chamada', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      const { rerenderizar } = renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)

      rerenderizar({ dado: null })
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })

    it('integração do indicador (tipoAlvo "indicador", modo configurar): finalidade "meta", junto da entrada', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({
        modo: 'configurar',
        tipoAlvo: 'indicador',
        validarNoServidor: validar,
        dado: { id: 11, nome: 'Margem', identificador: null, url: null, parametrosSaida: null, parametrosEntrada: null },
      })

      await colar(user, saida(), '{"codfil": "string", "metVlr": "number"}')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar).not.toHaveBeenCalled()

      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: ENTRADA_A, finalidade: 'meta' })
    })

    it('modo configurar: abrir com os valores salvos não chama; mudar a saída também não; mudar a entrada chama', async () => {
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
        },
      })
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)
      expect(validar).not.toHaveBeenCalled()

      await user.type(saida(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)
      expect(validar).not.toHaveBeenCalled()

      await user.type(entrada(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({
        parametrosEntrada: `${JSON.stringify({ operacao: 'Consulta', parametros: { a: '1' } }, null, 2)} `,
        finalidade: 'valor',
      })
    })
  })

  /**
   * O bug do print (11/11/2026): com a saída correta no formato `{ "campo": "tipo" }`, o `validar` do
   * ambiente respondia "a saida precisa ser uma lista (entre colchetes)..." e essa resposta prevalecia.
   * Agora a saída vale sempre pelo motor local, mesmo que um back-end antigo devolva um resultado de saída.
   */
  describe('saída validada só no front', () => {
    it('resposta de back-end antigo com erro na saída é ignorada: a saída correta continua "JSON válido" e o botão libera', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      const { onConfirmar } = renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await colar(user, saida(), SAIDA)
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, respostaComSaidaAntiga({ valido: true, variaveisUsadas: [], calculos: [], previa: { a: '1' } }))

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent(RESUMO_SAIDA)
      expect(dialogo()).not.toHaveTextContent('a saida precisa ser uma lista')
      expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(concluir()).toBeEnabled()
      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ parametrosSaida: SAIDA }))
    })

    it('saída em lista (formato antigo) continua inválida pelo motor local, sem depender do back-end', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent(FORMATO_ANTIGO)
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it('saída inválida pelo motor local (tipo desconhecido) não vira válida por resposta do back-end', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '{"codfil": "string", "qtd": "integer"}')
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, {
        saida: { valido: true, campos: [{ nome: 'codfil', tipo: 'string' }, { nome: 'qtd', tipo: 'number' }], formato: 'tipos', resumo: null },
        entrada: null,
      } as unknown as ResultadoValidacaoIntegracao)

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).not.toHaveTextContent('qtd (number)')
    })
  })

  describe('resultado do back-end substitui o local da entrada', () => {
    it('divergência — o local recusa e o back-end aceita a entrada: prevalece o back-end e o botão libera', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      const { onConfirmar } = renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await colar(user, entrada(), '{"r": "%regiao%"}')
      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(concluir()).toBeDisabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: { valido: true, variaveisUsadas: ['regiao'], calculos: [], previa: { r: 'Centro-Oeste' } } })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validacaoEntrada()).not.toHaveTextContent('inválido')
      expect(within(validacaoEntrada()).getByText('Variáveis usadas: %regiao%')).toBeInTheDocument()
      expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(concluir()).toBeEnabled()

      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith(
        expect.objectContaining({ identificador: 'DEVOLUCOES', url: URL_VALIDA, parametrosEntrada: '{"r": "%regiao%"}', variaveisUsadas: ['regiao'] }),
      )
    })

    it('divergência — o local aceita e o back-end recusa a entrada: prevalece o back-end e o botão bloqueia', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await colar(user, entrada(), ENTRADA_INICIO)
      expect(concluir()).toBeEnabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_INVALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(itensEntrada()).toEqual(['Campo "inicio": divisao por zero em "5 / 0"', 'Linha 1, coluna 10: virgula sobrando'])
      expect(within(dialogo()).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

    it('entrada válida: "JSON válido", variáveis usadas com %, cada cálculo "<caminho>: <expressão> = <resultado>" e a prévia com 2 espaços', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), '{"filial": "%filial%", "inicio": "%dataInicial% - 3m"}')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_VALIDA_SERVIDOR })

      const validacao = validacaoEntrada()
      expect(validacao).toHaveTextContent('JSON válido')
      expect(within(validacao).getByText('Variáveis usadas: %dataInicial%, %filial%')).toBeInTheDocument()
      expect(within(validacao).getByText('inicio: %dataInicial% - 3m = 01/07/2026')).toBeInTheDocument()
      expect(validacao.textContent).toContain(JSON.stringify(ENTRADA_VALIDA_SERVIDOR.valido ? ENTRADA_VALIDA_SERVIDOR.previa : null, null, 2))
      expect(validacao.textContent).toContain('"filial": "100"')
    })

    it('erro da entrada sem caminho (falta "operacao" — campo "" no back-end): o item mostra só a mensagem', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, {
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
      await colar(user, entrada(), ENTRADA_INICIO)
      expect(within(dialogo()).queryByText(/não tem valor numa consulta/)).not.toBeInTheDocument()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await responder(0, { entrada: ENTRADA_VALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(
        within(validacaoEntrada()).getByText('%filial% não tem valor numa consulta que traz todas as filiais; use %empresas%.'),
      ).toBeInTheDocument()
      expect(concluir()).toBeEnabled()
    })

    it('editar a entrada depois da resposta volta a mostrar o resultado local na hora (a resposta não é mais do texto atual)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_INVALIDA_SERVIDOR })
      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')

      await substituir(user, entrada(), ENTRADA_B)

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validacaoEntrada().textContent).toContain('"b": "2"')
    })

    it('mudar a saída não descarta o resultado do back-end da entrada (que não mudou)', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { entrada: ENTRADA_INVALIDA_SERVIDOR })

      await colar(user, saida(), SAIDA)

      expect(validacaoEntrada()).toHaveTextContent('JSON de entrada inválido')
      expect(itensEntrada()).toEqual(['Campo "inicio": divisao por zero em "5 / 0"', 'Linha 1, coluna 10: virgula sobrando'])
    })
  })

  describe('respostas obsoletas e falhas', () => {
    it('resposta que chega depois de a entrada mudar é ignorada; vale a resposta do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await substituir(user, entrada(), ENTRADA_INICIO)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar).toHaveBeenCalledTimes(2)

      // A resposta da segunda chamada (texto atual) chega primeiro; a da primeira chega depois.
      await responder(1, { entrada: ENTRADA_VALIDA_SERVIDOR })
      await responder(0, { entrada: ENTRADA_INVALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(validacaoEntrada()).not.toHaveTextContent('inválido')
    })

    it('resposta de um texto antigo, sem nova resposta, mantém o resultado local do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await substituir(user, entrada(), ENTRADA_B)
      await responder(0, { entrada: ENTRADA_INVALIDA_SERVIDOR })

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(itensEntrada()).toEqual([])
    })

    it('falha da chamada mantém o resultado local, sem mensagem de erro na tela', async () => {
      const user = configurarUsuario()
      const { validar, falhar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await falhar(0, new Error('Não foi possível conectar ao servidor.'))

      expect(validacaoEntrada()).toHaveTextContent('JSON válido')
      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText('Não foi possível conectar ao servidor.')).not.toBeInTheDocument()
    })

    it('depois de uma falha, a próxima mudança na entrada tenta de novo', async () => {
      const user = configurarUsuario()
      const { validar, falhar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, entrada(), ENTRADA_A)
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await falhar(0, new Error('falhou'))

      await user.type(entrada(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(2)
      expect(validar.mock.calls[1][0]).toStrictEqual({ parametrosEntrada: `${ENTRADA_A} `, finalidade: 'valor' })
    })
  })
})
