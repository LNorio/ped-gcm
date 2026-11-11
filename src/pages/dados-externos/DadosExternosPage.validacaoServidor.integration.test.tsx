import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  DADO_DEVOLUCOES_API,
  dadosExternosAdminApi,
  identificadoresApi,
  respostaConclusaoApi,
  rotaIntegracoesPendentes,
  rotaListarDadosExternos,
  variaveisIntegracaoApi,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'

const ROTA = '/api/ped/dados-externos-cadastro'
const ROTA_VALIDAR = '/api/ped/integracao/validar'
const ATRASO_MS = 400
const URL_VALIDA = 'https://ti.exemplo.com.br/api/devolucoes'

type CorpoValidar = {
  'parametros de saida'?: string
  'parametros de entrada'?: string
  finalidade?: string
}

/** Mensagem do `validar` do ambiente de testes (back-end sem a versão nova), vista no print do usuário de 11/11/2026. */
const ERRO_SAIDA_BACK_ANTIGO = 'a saida precisa ser uma lista (entre colchetes) com um item por filial'
/** Resultado de saída de um back-end antigo que recusa a saída em objeto (o front não envia mais a saída). */
const SAIDA_RECUSADA_BACK_ANTIGO = {
  valido: false,
  erro: { mensagem: ERRO_SAIDA_BACK_ANTIGO, linha: null, coluna: null },
  erros: [ERRO_SAIDA_BACK_ANTIGO],
}
const ENTRADA_SOAP = '{"operacao": "Consulta", "parametros": {"inicio": "%dataInicial% - 3m"}}'

/**
 * Validação híbrida "front primeiro, back depois" (F5.18) na página: a modal mostra o resultado do
 * motor local na hora e, ~400 ms depois de parar de digitar, chama `POST /api/ped/integracao/validar`;
 * a resposta do back-end prevalece para o texto atual. Falha da chamada mantém o resultado local.
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`):
 * o erro do print ("a saida precisa ser uma lista (entre colchetes)...") vinha do `validar` do ambiente, que
 * prevalecia sobre a validação local. Agora a saída é validada **só no front**: o POST leva só
 * `"parametros de entrada"` e `finalidade` (nunca `"parametros de saida"` nem `"campo da ..."`), mudar só a
 * saída não chama o back-end e um resultado de saída devolvido por um back-end antigo é ignorado.
 */
describe('F5.18 — Validação da integração pelo back-end: só a entrada (integração: /dados-externos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  type Usuario = ReturnType<typeof configurarUsuario>

  async function avancar(ms = ATRASO_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simular(aoValidar: (corpo: CorpoValidar) => Response) {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    const lista = dadosExternosAdminApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA}/integracoes-pendentes`]: rotaIntegracoesPendentes(() => lista),
      'GET /api/ped/integracao/variaveis': () => respostaJson(variaveisIntegracaoApi()),
      [`POST ${ROTA_VALIDAR}`]: (init) => aoValidar(JSON.parse(String(init?.body)) as CorpoValidar),
      [`PUT ${ROTA}/3/concluir`]: () =>
        respostaJson(respostaConclusaoApi({ ...DADO_DEVOLUCOES_API, situacao: 'ativo', identificador: 'DEVOLUCOES' }, null)),
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA_VALIDAR)
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function colar(user: Usuario, campo: HTMLElement, texto: string) {
    await user.click(campo)
    await user.paste(texto)
  }

  async function abrirConclusao(user: Usuario) {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Concluir construção')
    const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })
    return dialogo
  }

  async function preencherIdentificadorEUrl(user: Usuario, dialogo: HTMLElement) {
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await colar(user, within(dialogo).getByLabelText('URL'), URL_VALIDA)
  }

  const validacaoSaida = (dialogo: HTMLElement) => within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de saída' })
  const validacaoEntrada = (dialogo: HTMLElement) => within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
  const botaoConcluir = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Concluir e ativar' })

  it('400 ms depois de digitar a entrada, POST /api/ped/integracao/validar com o token, só a entrada e a finalidade; a resposta substitui o resultado local', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() =>
      respostaJson({ saida: null, entrada: { valido: false, erros: [{ campo: 'inicio', expressao: '%dataInicial% - 3m', mensagem: 'data inexistente' }] } }),
    )
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de entrada'), ENTRADA_SOAP)
    expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON válido')
    await avancar()

    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(corpoDaChamada(posts(chamadas)[0])).toStrictEqual({ 'parametros de entrada': ENTRADA_SOAP, finalidade: 'valor' })
    await waitFor(() => expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON de entrada inválido'))
  })

  it('só a saída preenchida: nenhum POST de validação; a saída mostra o resultado local', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() => respostaJson({ saida: SAIDA_RECUSADA_BACK_ANTIGO, entrada: null }))
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '{"codfil": "string", "vlrLiq": "number"}')
    await avancar(ATRASO_MS * 3)

    expect(posts(chamadas)).toHaveLength(0)
    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON válido')
    expect(validacaoSaida(dialogo)).toHaveTextContent('2 campos: codfil (string), vlrLiq (number)')
  })

  it('o caso do print: saída correta e back-end antigo que recusa a saída — o erro não aparece, o POST não leva a saída e a conclusão sai só com os quatro campos', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: SAIDA_RECUSADA_BACK_ANTIGO,
        entrada: corpo['parametros de entrada']
          ? { valido: true, 'variaveis usadas': ['dataInicial'], calculos: [], previa: { inicio: '01/07/2026' } }
          : null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    const saida = '{ "codfil": "string", "vlrLiq": "number", "filial": "number", "valor": "number" }'
    await preencherIdentificadorEUrl(user, dialogo)
    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), saida)
    await colar(user, within(dialogo).getByLabelText('Parâmetros de entrada'), ENTRADA_SOAP)
    await avancar()
    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    await avancar(50)

    expect(corpoDaChamada(posts(chamadas)[0])).toStrictEqual({ 'parametros de entrada': ENTRADA_SOAP, finalidade: 'valor' })
    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON válido')
    expect(validacaoSaida(dialogo)).toHaveTextContent('4 campos: codfil (string), vlrLiq (number), filial (number), valor (number)')
    expect(dialogo).not.toHaveTextContent('a saida precisa ser uma lista')
    expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()

    await user.click(botaoConcluir(dialogo))
    await screen.findByText('Construção concluída.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      identificador: 'DEVOLUCOES',
      url: URL_VALIDA,
      'parametros de saida': saida,
      'parametros de entrada': ENTRADA_SOAP,
    })
  })

  it('divergência — o back-end recusa a entrada que o motor local aceita: prevalece o back-end, o botão bloqueia e o PUT não sai', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: null,
        entrada: corpo['parametros de entrada']
          ? { valido: false, erros: [{ campo: 'inicio', expressao: '%dataInicial% - 3m', mensagem: 'data inexistente' }] }
          : null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    await preencherIdentificadorEUrl(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await colar(user, within(dialogo).getByLabelText('Parâmetros de entrada'), ENTRADA_SOAP)
    expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON válido')
    expect(botaoConcluir(dialogo)).toBeEnabled()

    await avancar()

    await waitFor(() => expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON de entrada inválido'))
    expect(within(validacaoEntrada(dialogo)).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'Campo "inicio": data inexistente em "%dataInicial% - 3m"',
    ])
    expect(within(dialogo).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
    expect(botaoConcluir(dialogo)).toBeDisabled()
    await user.click(botaoConcluir(dialogo))
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('divergência — o back-end aceita a entrada que o motor local recusa: prevalece o back-end e a conclusão é enviada só com os quatro campos', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: null,
        entrada: corpo['parametros de entrada']
          ? { valido: true, 'variaveis usadas': ['regiao'], calculos: [], previa: { r: 'Centro-Oeste' } }
          : null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    await preencherIdentificadorEUrl(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await colar(user, within(dialogo).getByLabelText('Parâmetros de entrada'), '{"r": "%regiao%"}')
    expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON de entrada inválido')
    expect(botaoConcluir(dialogo)).toBeDisabled()

    await avancar()

    await waitFor(() => expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument())
    expect(validacaoEntrada(dialogo)).toHaveTextContent('Variáveis usadas: %regiao%')
    expect(validacaoEntrada(dialogo).textContent).toContain('"r": "Centro-Oeste"')
    await user.click(botaoConcluir(dialogo))

    await screen.findByText('Construção concluída.')
    expect(puts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      identificador: 'DEVOLUCOES',
      url: URL_VALIDA,
      'parametros de saida': MODELO_JSON_SAIDA,
      'parametros de entrada': '{"r": "%regiao%"}',
    })
  })

  it('formato antigo: a saída em lista continua bloqueada pelo motor local, sem depender do back-end', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() =>
      respostaJson({ saida: { valido: true, campos: [{ campo: 'filial', tipo: 'texto' }, { campo: 'valor', tipo: 'numero' }] }, entrada: null }),
    )
    const dialogo = await abrirConclusao(user)
    await preencherIdentificadorEUrl(user, dialogo)
    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '[{"filial": "101", "valor": 1}]')
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
    await avancar()
    await waitFor(() => expect(posts(chamadas).length).toBeGreaterThan(0))
    await avancar(50)

    expect(corpoDaChamada(posts(chamadas)[0])).not.toHaveProperty(['parametros de saida'])
    expect(validacaoSaida(dialogo)).toHaveTextContent('Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.')
    expect(validacaoSaida(dialogo)).not.toHaveTextContent('filial (texto)')
    expect(botaoConcluir(dialogo)).toBeDisabled()
    await user.click(botaoConcluir(dialogo))
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('falha do POST (500): mantém o resultado local, sem erro na tela', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() => respostaErro(500))
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de entrada'), ENTRADA_SOAP)
    await avancar()
    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    await avancar(50)

    expect(validacaoEntrada(dialogo)).toHaveTextContent('JSON válido')
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('só identificador e URL preenchidos (JSONs vazios): nenhuma chamada de validação', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() => respostaJson({ saida: null, entrada: null }))
    const dialogo = await abrirConclusao(user)

    await preencherIdentificadorEUrl(user, dialogo)
    await avancar(ATRASO_MS * 2)

    expect(posts(chamadas)).toHaveLength(0)
  })

  it('a modal de Configurações: editar só a saída não valida no back-end; editar a entrada valida só a entrada, sem mapeamento', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() => respostaJson({ saida: SAIDA_RECUSADA_BACK_ANTIGO, entrada: null }))
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Configurações')
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })

    const saida = within(dialogo).getByLabelText('Parâmetros de saída')
    await user.clear(saida)
    await colar(user, saida, '{"codfil": "string", "vlrLiq": "string", "datCpt": "date"}')
    await avancar(ATRASO_MS * 2)
    expect(posts(chamadas)).toHaveLength(0)
    expect(validacaoSaida(dialogo)).toHaveTextContent('3 campos: codfil (string), vlrLiq (string), datCpt (date)')

    const entrada = within(dialogo).getByLabelText('Parâmetros de entrada')
    await user.clear(entrada)
    await colar(user, entrada, ENTRADA_SOAP)
    await avancar()

    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(posts(chamadas)[0])).toStrictEqual({ 'parametros de entrada': ENTRADA_SOAP, finalidade: 'valor' })
    await avancar(50)
    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON válido')
    expect(dialogo).not.toHaveTextContent('a saida precisa ser uma lista')
  })
})
