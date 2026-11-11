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
  'campo da filial'?: string
  'campo do valor'?: string
  'campo da competencia'?: string
}

/**
 * Validação híbrida "front primeiro, back depois" (F5.18) na página: a modal mostra o resultado do
 * motor local na hora e, ~400 ms depois de parar de digitar, chama `POST /api/ped/integracao/validar`;
 * a resposta do back-end prevalece para o texto atual. Falha da chamada mantém o resultado local.
 *
 * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `FRONT-saida-chave-tipo.md`, seção 4): o
 * mapeamento vai no POST com as chaves do back-end; a resposta traz `formato`, `resumo` e `mapeamento`
 * (o resumo prevalece na exibição) e os `erros` da saída podem vir como textos. Uma resposta válida sem
 * `formato: "tipos"` (lista, formato antigo) não libera a conclusão.
 */
describe('F5.18 — Validação da integração pelo back-end (integração: /dados-externos)', () => {
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

  /** Escolhe o campo da filial e o do valor (padrão: os do modelo de saída, codfil e vlrLiq). */
  async function escolherMapeamento(user: Usuario, dialogo: HTMLElement, filial = 'codfil', valor = 'vlrLiq') {
    await user.selectOptions(within(dialogo).getByLabelText('Campo da filial'), filial)
    await user.selectOptions(within(dialogo).getByLabelText('Campo do valor'), valor)
  }

  /** Saída válida do back-end no formato novo ("chave: tipo"), como no exemplo do documento. */
  const saidaTiposApi = (campos: { campo: string; tipo: string }[], extra: Record<string, unknown> = {}) => ({
    valido: true,
    formato: 'tipos',
    campos,
    ...extra,
  })

  it('400 ms depois de digitar, POST /api/ped/integracao/validar com o token e só o campo preenchido; a resposta substitui o resultado local', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() =>
      respostaJson({
        saida: saidaTiposApi([
          { campo: 'codfil', tipo: 'string' },
          { campo: 'vlrLiq', tipo: 'number' },
        ]),
        entrada: null,
      }),
    )
    const dialogo = await abrirConclusao(user)

    // O local vê "vlrLiq" como string e a resposta (simulada) como number: prova que o resultado do back-end aparece.
    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '{"codfil": "string", "vlrLiq": "string"}')
    expect(validacaoSaida(dialogo)).toHaveTextContent('2 campos: codfil (string), vlrLiq (string)')
    await avancar()

    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    // finalidade "valor": modal do dado externo (FRONT-meta-via-api-fase1.md, item 2.2 — 11/11/2026).
    expect(corpoDaChamada(posts(chamadas)[0])).toStrictEqual({ 'parametros de saida': '{"codfil": "string", "vlrLiq": "string"}', finalidade: 'valor' })
    await waitFor(() => expect(validacaoSaida(dialogo)).toHaveTextContent('2 campos: codfil (string), vlrLiq (number)'))
    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON válido')
  })

  it('o resumo devolvido pelo back-end ("resumo") é o exibido', async () => {
    const user = configurarUsuario()
    simular(() =>
      respostaJson({
        saida: saidaTiposApi([{ campo: 'codfil', tipo: 'string' }], { resumo: '3 campos: codemp (string), codfil (string), vlrLiq (number)' }),
        entrada: null,
      }),
    )
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '{"codemp": "string", "codfil": "string", "vlrLiq": "number"}')
    await avancar()

    await waitFor(() => expect(validacaoSaida(dialogo)).toHaveTextContent('3 campos: codemp (string), codfil (string), vlrLiq (number)'))
    expect(validacaoSaida(dialogo)).not.toHaveTextContent('1 campo')
  })

  it('escolher o mapeamento valida de novo com as chaves do back-end ("campo da filial", "campo do valor")', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: corpo['parametros de saida']
          ? saidaTiposApi(
              [
                { campo: 'codfil', tipo: 'string' },
                { campo: 'vlrLiq', tipo: 'number' },
              ],
              { mapeamento: { 'campo da filial': corpo['campo da filial'] ?? null, 'campo do valor': corpo['campo do valor'] ?? null } },
            )
          : null,
        entrada: null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await avancar()
    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))

    await escolherMapeamento(user, dialogo)
    await avancar()

    await waitFor(() => expect(posts(chamadas)).toHaveLength(2))
    expect(corpoDaChamada(posts(chamadas)[1])).toStrictEqual({
      'parametros de saida': MODELO_JSON_SAIDA,
      finalidade: 'valor',
      'campo da filial': 'codfil',
      'campo do valor': 'vlrLiq',
    })
  })

  it('erros da saída em lista de textos (exemplo do documento): aparecem na validação da saída e bloqueiam', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: corpo['parametros de saida']
          ? {
              valido: false,
              erro: { mensagem: 'integracao invalida', linha: null, coluna: null },
              erros: ['o "campo do valor" ("codfil") e do tipo string; precisa ser number'],
            }
          : null,
        entrada: null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    await preencherIdentificadorEUrl(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await escolherMapeamento(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
    expect(botaoConcluir(dialogo)).toBeEnabled()

    await avancar()

    await waitFor(() => expect(validacaoSaida(dialogo)).toHaveTextContent('JSON de saída inválido'))
    expect(within(validacaoSaida(dialogo)).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'o "campo do valor" ("codfil") e do tipo string; precisa ser number',
    ])
    expect(botaoConcluir(dialogo)).toBeDisabled()
    await user.click(botaoConcluir(dialogo))
    expect(puts(chamadas)).toHaveLength(0)
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
    await escolherMapeamento(user, dialogo)
    await colar(
      user,
      within(dialogo).getByLabelText('Parâmetros de entrada'),
      '{"operacao": "Consulta", "parametros": {"inicio": "%dataInicial% - 3m"}}',
    )
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

  it('divergência — o back-end aceita a entrada que o motor local recusa: prevalece o back-end e a conclusão é enviada com o mapeamento', async () => {
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
    await escolherMapeamento(user, dialogo)
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
      'campo da filial': 'codfil',
      'campo do valor': 'vlrLiq',
    })
  })

  it('formato antigo: a lista aceita pelo back-end (resposta sem "formato") continua bloqueada — a modal só salva no formato novo', async () => {
    const user = configurarUsuario()
    const chamadas = simular((corpo) =>
      respostaJson({
        saida: corpo['parametros de saida']
          ? { valido: true, campos: [{ campo: 'filial', tipo: 'texto' }, { campo: 'valor', tipo: 'numero' }] }
          : null,
        entrada: null,
      }),
    )
    const dialogo = await abrirConclusao(user)
    await preencherIdentificadorEUrl(user, dialogo)
    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '[{"filial": "101", "valor": 1}]')
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
    expect(validacaoSaida(dialogo)).toHaveTextContent('Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.')

    await avancar()
    await waitFor(() => expect(posts(chamadas).length).toBeGreaterThan(0))
    await avancar(50)

    expect(validacaoSaida(dialogo)).toHaveTextContent('Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.')
    expect(validacaoSaida(dialogo)).not.toHaveTextContent('filial (texto)')
    expect(botaoConcluir(dialogo)).toBeDisabled()
    await user.click(botaoConcluir(dialogo))
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('saída inválida pelo back-end: "JSON de saída inválido" com "Linha L, coluna C: mensagem" como veio', async () => {
    const user = configurarUsuario()
    simular(() =>
      respostaJson({ saida: { valido: false, erro: { mensagem: "virgula sobrando antes de '}'", linha: 1, coluna: 12 } }, entrada: null }),
    )
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '{"valor": 1,}')
    expect(validacaoSaida(dialogo)).toHaveTextContent('Linha 1, coluna 12: vírgula sobrando')
    await avancar()

    await waitFor(() => expect(validacaoSaida(dialogo)).toHaveTextContent("Linha 1, coluna 12: virgula sobrando antes de '}'"))
    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON de saída inválido')
  })

  it('falha do POST (500): mantém o resultado local, sem erro na tela', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() => respostaErro(500))
    const dialogo = await abrirConclusao(user)

    await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), '{"codfil": "string", "vlrLiq": "number"}')
    await avancar()
    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    await avancar(50)

    expect(validacaoSaida(dialogo)).toHaveTextContent('JSON válido')
    expect(validacaoSaida(dialogo)).toHaveTextContent('2 campos: codfil (string), vlrLiq (number)')
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

  it('a modal de Configurações também valida no back-end ao editar, levando o mapeamento salvo do dado', async () => {
    const user = configurarUsuario()
    const chamadas = simular(() =>
      respostaJson({
        saida: saidaTiposApi([
          { campo: 'codfil', tipo: 'string' },
          { campo: 'vlrLiq', tipo: 'number' },
          { campo: 'datCpt', tipo: 'date' },
        ]),
        entrada: null,
      }),
    )
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Configurações')
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })

    const saida = within(dialogo).getByLabelText('Parâmetros de saída')
    await user.clear(saida)
    await colar(user, saida, '{"codfil": "string", "vlrLiq": "string", "datCpt": "date"}')
    expect(validacaoSaida(dialogo)).toHaveTextContent('3 campos: codfil (string), vlrLiq (string), datCpt (date)')
    await avancar()

    await waitFor(() => expect(posts(chamadas).length).toBeGreaterThan(0))
    expect(corpoDaChamada(posts(chamadas).at(-1)!)).toMatchObject({
      'parametros de saida': '{"codfil": "string", "vlrLiq": "string", "datCpt": "date"}',
      finalidade: 'valor',
      'campo da filial': 'codfil',
      'campo do valor': 'vlrLiq',
      'campo da competencia': 'datCpt',
    })
    await waitFor(() => expect(validacaoSaida(dialogo)).toHaveTextContent('3 campos: codfil (string), vlrLiq (number), datCpt (date)'))
  })
})
