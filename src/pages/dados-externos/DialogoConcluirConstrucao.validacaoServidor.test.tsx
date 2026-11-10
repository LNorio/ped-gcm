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

const SAIDA_VALIDA_SERVIDOR: ResultadoValidacaoSaidaServidor = {
  valido: true,
  campos: [
    { nome: 'filial', tipo: 'texto' },
    { nome: 'valor', tipo: 'numero' },
    { nome: 'itens', tipo: 'lista' },
  ],
}
const SAIDA_INVALIDA_SERVIDOR: ResultadoValidacaoSaidaServidor = {
  valido: false,
  erro: { mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 },
}
const ENTRADA_VALIDA_SERVIDOR: ResultadoValidacaoEntradaServidor = {
  valido: true,
  variaveisUsadas: ['dataInicial', 'filial'],
  calculos: [{ caminho: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
  previa: { filial: '100', inicio: '01/07/2026' },
}
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
 *   `validarNoServidor({ parametrosSaida?, parametrosEntrada? })` só com os campos não vazios (nenhuma
 *   chamada com os dois vazios);
 * - a resposta que corresponde ao texto atual de um campo substitui o resultado local daquele campo
 *   (o "falta: ..." e o botão passam a usar o resultado do back-end); respostas obsoletas são
 *   ignoradas; falha mantém o resultado local, sem erro na tela.
 * Prop nova (opcional): `validarNoServidor?: (parametros) => Promise<ResultadoValidacaoIntegracao>`.
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

  const dialogo = () => screen.getByRole('dialog', { name: 'Concluir construção' })
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

  describe('quando chamar', () => {
    it('o resultado local aparece na hora; a chamada ao back-end só sai 400 ms depois da última mudança, com o texto atual', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')

      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (numero)')
      expect(validar).not.toHaveBeenCalled()
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS - 100)
      expect(validar).not.toHaveBeenCalled()
      await avancar(100)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: '[{"filial": "101", "valor": 1}]' })
    })

    it('cada mudança reinicia a espera: só uma chamada, com o texto final', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '[{"filial": "101", "valor": 1}')
      await avancar(250)
      await user.type(saida(), ']')
      await avancar(250)
      expect(validar).not.toHaveBeenCalled()

      await avancar(150)
      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: '[{"filial": "101", "valor": 1}]' })
    })

    it('com os dois JSONs preenchidos, uma única chamada leva os dois textos', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(1)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: MODELO_JSON_SAIDA, parametrosEntrada: MODELO_JSON_ENTRADA })
    })

    it('campo vazio (ou só com espaços) não é enviado', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '   ')
      await colar(user, entrada(), '{"a": "1"}')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosEntrada: '{"a": "1"}' })
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
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
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

      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (numero)')
    })

    it('fechar a modal (dado null) antes dos 400 ms cancela a chamada', async () => {
      const user = configurarUsuario()
      const { validar } = criarValidador()
      const { rerenderizar } = renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')

      rerenderizar({ dado: null })
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS * 2)

      expect(validar).not.toHaveBeenCalled()
    })
  })

  describe('resultado do back-end substitui o local do campo', () => {
    it('saída válida: "JSON válido" e "N campos: ..." com os tipos como vieram do back-end (mesmo divergindo do local)', async () => {
      // Desde 10/11/2026 o motor local usa os mesmos nomes de tipo do back-end ("numero" sem acento); para
      // provar que o resultado do back-end prevalece, o local vê "valor" como texto e o back-end como numero.
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": "1", "itens": []}]')
      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (texto), itens (lista)')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (numero), itens (lista)')
      expect(validacaoSaida()).not.toHaveTextContent('valor (texto)')
    })

    it('os tipos do motor local têm os mesmos nomes do back-end: o mesmo JSON mostra o mesmo resumo antes e depois da resposta', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1, "itens": []}]')
      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (numero), itens (lista)')
      expect(validacaoSaida()).not.toHaveTextContent('número')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (numero), itens (lista)')
      expect(validacaoSaida()).not.toHaveTextContent('número')
    })

    it('divergência — o local aceita e o back-end recusa a saída: prevalece o back-end ("JSON de saída inválido" com linha e coluna) e o botão bloqueia', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(concluir()).toBeEnabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: ENTRADA_VALIDA_SERVIDOR })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent("Linha 3, coluna 1: virgula sobrando antes de '}'")
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(concluir()).toBeDisabled()
    })

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
      await responder(0, {
        saida: { valido: true, campos: [{ nome: 'valor', tipo: 'texto' }] },
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

    it('saída em lista (alteração de 10/11/2026) — o local recusa o objeto solto e o back-end o aceita: prevalece o back-end e o botão libera', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await preencherIdentificadorEUrl(user)
      await colar(user, saida(), '{"filial": "101", "valor": 1}')
      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de entrada' }))
      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('A saída deve ser uma lista com um item por filial')
      expect(concluir()).toBeDisabled()

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: { valido: true, campos: [{ nome: 'filial', tipo: 'texto' }, { nome: 'valor', tipo: 'numero' }] },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (numero)')
      expect(validacaoSaida()).not.toHaveTextContent('inválido')
      expect(concluir()).toBeEnabled()
    })

    it('saída em lista — o local aceita e o back-end recusa um item: prevalece a mensagem do back-end', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      expect(validacaoSaida()).toHaveTextContent('JSON válido')

      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, {
        saida: { valido: false, erro: { mensagem: 'item 1 sem filial valida', linha: null, coluna: null } },
        entrada: null,
      })

      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')
      expect(validacaoSaida()).toHaveTextContent('item 1 sem filial valida')
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
      await colar(user, entrada(), '{"inicio": "%dataInicial% - 3m"}')
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
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })
      expect(validacaoSaida()).toHaveTextContent('JSON de saída inválido')

      await substituir(user, saida(), '[{"filial": "101", "valor": 2}]')

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (numero)')
    })
  })

  describe('respostas obsoletas e falhas', () => {
    it('resposta que chega depois de o texto mudar é ignorada; vale a resposta do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })

      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await substituir(user, saida(), '[{"filial": "101", "valor": 1, "itens": []}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar).toHaveBeenCalledTimes(2)

      // A resposta da segunda chamada (texto atual) chega primeiro; a da primeira chega depois.
      await responder(1, { saida: SAIDA_VALIDA_SERVIDOR, entrada: null })
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (numero), itens (lista)')
      expect(validacaoSaida()).not.toHaveTextContent('inválido')
    })

    it('resposta de um texto antigo, sem nova resposta, mantém o resultado local do texto atual', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await substituir(user, saida(), '[{"filial": "101", "valor": 1, "total": 1}]')
      await responder(0, { saida: SAIDA_INVALIDA_SERVIDOR, entrada: null })

      expect(validacaoSaida()).toHaveTextContent('3 campos: filial (texto), valor (numero), total (numero)')
      expect(validacaoSaida()).not.toHaveTextContent('inválido')
    })

    it('a correspondência é por campo: a saída não mudou e recebe o resultado do back-end; a entrada mudou e fica com o local', async () => {
      const user = configurarUsuario()
      const { validar, responder } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await colar(user, entrada(), '{"a": "1"}')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      expect(validar.mock.calls[0][0]).toStrictEqual({ parametrosSaida: '[{"filial": "101", "valor": 1}]', parametrosEntrada: '{"a": "1"}' })

      await substituir(user, entrada(), '{"b": "2"}')
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
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      await falhar(0, new Error('Não foi possível conectar ao servidor.'))

      expect(validacaoSaida()).toHaveTextContent('JSON válido')
      expect(validacaoSaida()).toHaveTextContent('2 campos: filial (texto), valor (numero)')
      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText('Não foi possível conectar ao servidor.')).not.toBeInTheDocument()
    })

    it('depois de uma falha, a próxima mudança tenta de novo', async () => {
      const user = configurarUsuario()
      const { validar, falhar } = criarValidador()
      renderizar({ validarNoServidor: validar })
      await colar(user, saida(), '[{"filial": "101", "valor": 1}]')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)
      await falhar(0, new Error('falhou'))

      await user.type(saida(), ' ')
      await avancar(ATRASO_VALIDACAO_SERVIDOR_MS)

      expect(validar).toHaveBeenCalledTimes(2)
      expect(validar.mock.calls[1][0]).toStrictEqual({ parametrosSaida: '[{"filial": "101", "valor": 1}] ' })
    })
  })
})
