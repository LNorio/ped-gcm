import { screen, waitFor, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
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
  dadosExternosApi,
  identificadoresApi,
  respostaConclusaoApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
  variaveisIntegracaoApi,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { mensagemPadraoPorStatus } from '../../services/api'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const AVISO_INDICADOR = 'Indicador Devoluções de venda criado automaticamente. Defina a meta na aba Indicadores.'
const URL_VALIDA = 'https://api.exemplo.com/devolucoes'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'

/** Grupo "Variáveis disponíveis" da modal (as buscas por variável ficam neste grupo). */
const grupoVariaveis = (dialogo: HTMLElement) => within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })

/**
 * Corpo esperado do PUT .../concluir com os modelos: só os quatro campos (contrato de 09/11/2026). Desde
 * 11/11/2026 (saída sem mapeamento) não vão `"campo da filial"`, `"campo do valor"` nem `"campo da competencia"`.
 */
function corpoConclusao(identificador: string) {
  return {
    identificador,
    url: URL_VALIDA,
    'parametros de saida': MODELO_JSON_SAIDA,
    'parametros de entrada': MODELO_JSON_ENTRADA,
  }
}

describe('F5.7 — Concluir construção de dado externo (Admin registra a integração; integração: /dados-externos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  interface Opcoes {
    indicadorCriado?: { id: number; nome: string } | null
    aoConcluir?: () => Response | Promise<Response> | undefined
    /** Resposta do PUT de conclusão depois de gravar o dado (2xx sem o dado, por exemplo). */
    respostaConcluir?: () => Response
    /** Resposta de `GET /api/ped/integracao/variaveis` (padrão: as 13 variáveis, formato real). */
    aoListarVariaveis?: () => Response
  }

  function simularAdmin(opcoes: Opcoes = {}) {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA_VARIAVEIS}`]: () => (opcoes.aoListarVariaveis ? opcoes.aoListarVariaveis() : respostaJson(variaveisIntegracaoApi())),
      [`PUT ${ROTA}/${DADO_DEVOLUCOES_API.id}/concluir`]: (init) => {
        const personalizada = opcoes.aoConcluir?.()
        if (personalizada) return personalizada
        const { identificador } = JSON.parse(String(init?.body)) as { identificador: string }
        const concluido: DadoExternoApiFalso = {
          ...DADO_DEVOLUCOES_API,
          situacao: 'ativo',
          'situacao descricao': 'Ativo',
          identificador,
          'coleta disponivel': true,
        }
        lista = lista.map((d) => (d.id === concluido.id ? concluido : d))
        if (opcoes.respostaConcluir) return opcoes.respostaConcluir()
        const indicador = opcoes.indicadorCriado === undefined ? { id: 30, nome: 'Devoluções de venda' } : opcoes.indicadorCriado
        return respostaJson(respostaConclusaoApi(concluido, indicador))
      },
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const linha = (nome: string) => screen.getByText(nome).closest('tr')!

  async function abrirConclusao(user: Usuario) {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Concluir construção')
    return screen.getByRole('dialog', { name: 'Concluir construção' })
  }

  /**
   * Preenche URL e os dois JSONs com os modelos (o identificador fica a cargo de cada teste; sem mapeamento
   * desde 11/11/2026) e espera as variáveis da API: o modelo de entrada só é válido com elas carregadas.
   */
  async function preencherIntegracao(user: Usuario, dialogo: HTMLElement) {
    await within(grupoVariaveis(dialogo)).findByRole('button', { name: /%filial%/ })
    await colar(user, within(dialogo).getByLabelText('URL'), URL_VALIDA)
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
  }

  const botaoConcluir = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Concluir e ativar' })

  it('Admin conclui: PUT .../concluir com a integração completa (identificador em maiúsculas) → "Construção concluída.", dado Ativo e aviso do indicador criado', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    const notificacao = await screen.findByText('Construção concluída.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/3/concluir`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('DEVOLUCOES'))
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Ativo')).toBeInTheDocument())
    expect(within(linha('Devoluções de venda')).getByText('DEVOLUCOES')).toBeInTheDocument()

    const aviso = screen.getByText(AVISO_INDICADOR)
    expect(aviso.closest('[role="note"]')).not.toBeNull()
    // Concluído, o dado passa a ter "Configurações" (F5.16) no lugar de "Concluir construção".
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
      'Ver detalhes',
      'Configurações',
      'Desativar',
      'Excluir',
    ])
  })

  it('identificador com acento, espaço e caractere especial: o campo descarta os inválidos (mantendo "-" e ".") ao colar e ao digitar e o PUT leva o valor limpo', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)
    const campo = within(dialogo).getByLabelText('Identificador da consulta')

    await colar(user, campo, 'devoluções-venda')
    expect(campo).toHaveValue('DEVOLUES-VENDA')
    await user.type(campo, ' .2/')
    expect(campo).toHaveValue('DEVOLUES-VENDA.2')

    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    await screen.findByText('Construção concluída.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('DEVOLUES-VENDA.2'))
  })

  it('o diálogo mostra as sugestões de identificadores; escolher uma preenche o campo e é enviada', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)

    const grupo = await within(dialogo).findByRole('group', { name: 'Identificadores existentes' })
    await user.click(within(grupo).getByRole('button', { name: 'NOVOS_CLIENTES — usado por 0 dado(s)' }))
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    await screen.findByText('Construção concluída.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('NOVOS_CLIENTES'))
  })

  it('sem indicador criado na resposta, não mostra o aviso do indicador', async () => {
    const user = usuarioRapido()
    simularAdmin({ indicadorCriado: null })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    await screen.findByText('Construção concluída.')
    expect(screen.queryByText(/criado automaticamente/)).not.toBeInTheDocument()
  })

  it('Cancelar fecha sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('400 da API: mensagem em alerta dentro do diálogo, que continua aberto; o dado segue em construção', async () => {
    const user = usuarioRapido()
    simularAdmin({ aoConcluir: () => respostaErro(400, 'O identificador XPTO não tem coleta cadastrada.') })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'xpto')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O identificador XPTO não tem coleta cadastrada.')
    expect(screen.getByRole('dialog', { name: 'Concluir construção' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('XPTO')
    expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_VALIDA)
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(MODELO_JSON_SAIDA)
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue(MODELO_JSON_ENTRADA)
    expect(within(linha('Devoluções de venda')).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(screen.queryByText('Construção concluída.')).not.toBeInTheDocument()
  })

  it('400 { mensagem, erros } (contrato de 09/11/2026): mensagem geral no alerta e cada erro junto ao seu campo; nada é apagado', async () => {
    const user = usuarioRapido()
    simularAdmin({
      aoConcluir: () =>
        respostaJson(
          {
            mensagem: 'integracao invalida: URL ...',
            erros: [
              { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
              { campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 },
              { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' },
            ],
          },
          400,
        ),
    })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    const geral = await within(dialogo).findByText('integracao invalida: URL ...')
    expect(geral.closest('[role="alert"]')).not.toBeNull()
    expect(within(dialogo).getByLabelText('URL')).toHaveAccessibleDescription(
      expect.stringContaining('a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'),
    )
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveAccessibleDescription(
      expect.stringContaining("Linha 3, coluna 1: virgula sobrando antes de '}'"),
    )
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveAccessibleDescription(
      expect.stringContaining('Campo "inicio": divisao por zero em "5 / 0"'),
    )
    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('DEVOLUCOES')
    expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_VALIDA)
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(MODELO_JSON_SAIDA)
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue(MODELO_JSON_ENTRADA)
    expect(within(linha('Devoluções de venda')).getByText('Em construção (TI)')).toBeInTheDocument()
  })

  /**
   * Contrato final da saída (11/11/2026 — `docs/backend/FRONT-saida-chave-tipo (1).md`, seção 3): o 400 traz todos
   * os erros da saída de uma vez; cada um aparece junto ao campo "Parâmetros de saída" (com "Linha L, coluna C: "
   * quando vierem), sem interpretar o texto, e nada é apagado.
   */
  it('400 com dois erros da saída (um com linha/coluna): os dois aparecem juntos no campo "Parâmetros de saída"', async () => {
    const user = usuarioRapido()
    simularAdmin({
      aoConcluir: () =>
        respostaJson(
          {
            mensagem: 'integracao invalida: parametros de saida',
            erros: [
              { campo: 'parametros de saida', mensagem: 'o campo "x" da saida tem tipo "texto"; use string, number, date ou boolean' },
              { campo: 'parametros de saida', mensagem: 'JSON invalido', linha: 2, coluna: 7 },
            ],
          },
          400,
        ),
    })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    const geral = await within(dialogo).findByText('integracao invalida: parametros de saida')
    expect(geral.closest('[role="alert"]')).not.toBeNull()
    const campoSaida = within(dialogo).getByLabelText('Parâmetros de saída')
    expect(campoSaida).toHaveAttribute('aria-invalid', 'true')
    expect(campoSaida).toHaveAccessibleDescription(
      expect.stringContaining('o campo "x" da saida tem tipo "texto"; use string, number, date ou boolean'),
    )
    expect(campoSaida).toHaveAccessibleDescription(expect.stringContaining('Linha 2, coluna 7: JSON invalido'))
    expect(within(dialogo).getByLabelText('URL')).not.toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).not.toHaveAttribute('aria-invalid', 'true')
    expect(campoSaida).toHaveValue(MODELO_JSON_SAIDA)
    expect(within(linha('Devoluções de venda')).getByText('Em construção (TI)')).toBeInTheDocument()
  })

  it('depois do 400 com erros por campo, corrigir a URL tira só o erro dela (o alerta geral e os outros erros ficam); reenviar com novo 400 volta a marcar', async () => {
    const user = usuarioRapido()
    const MENSAGEM_URL = 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'
    const chamadas = simularAdmin({
      aoConcluir: () =>
        respostaJson(
          {
            mensagem: 'integracao invalida: URL ...',
            erros: [
              { campo: 'url', mensagem: MENSAGEM_URL },
              { campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 },
            ],
          },
          400,
        ),
    })
    const dialogo = await abrirConclusao(user)
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))
    await within(dialogo).findByText('integracao invalida: URL ...')
    const campoUrl = within(dialogo).getByLabelText('URL')
    const campoSaida = within(dialogo).getByLabelText('Parâmetros de saída')
    expect(campoUrl).toHaveAttribute('aria-invalid', 'true')

    await user.type(campoUrl, '-v2')

    expect(campoUrl).not.toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo).queryByText(MENSAGEM_URL)).not.toBeInTheDocument()
    expect(campoSaida).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo).getByText('integracao invalida: URL ...').closest('[role="alert"]')).not.toBeNull()

    await user.click(botaoConcluir(dialogo))

    await waitFor(() => expect(puts(chamadas)).toHaveLength(2))
    await waitFor(() => expect(campoUrl).toHaveAttribute('aria-invalid', 'true'))
    expect(campoUrl).toHaveAccessibleDescription(expect.stringContaining(MENSAGEM_URL))
  })

  it('400 sem "erros" (ex.: dado não está mais em construção) mostra só a mensagem geral, sem marcar campos', async () => {
    const user = usuarioRapido()
    simularAdmin({ aoConcluir: () => respostaErro(400, 'o dado nao esta em construcao') })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('o dado nao esta em construcao')
    expect(within(dialogo).getByLabelText('URL')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('clique duplo em Concluir gera um único PUT; Cancelar e Esc são ignorados durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const chamadas = simularAdmin({
      aoConcluir: () =>
        new Promise<Response>((resolve) => {
          liberar = () =>
            resolve(
              respostaJson(
                respostaConclusaoApi({ ...DADO_DEVOLUCOES_API, situacao: 'ativo', identificador: 'DEVOLUCOES' }, null),
              ),
            )
        }),
    })
    const dialogo = await abrirConclusao(user)
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')

    await preencherIntegracao(user, dialogo)
    await user.dblClick(botaoConcluir(dialogo))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Concluir construção' })).toBeInTheDocument()
    expect(botaoConcluir(dialogo)).toBeDisabled()
    liberar()
    await screen.findByText('Construção concluída.')
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('401 ao concluir encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularAdmin({ aoConcluir: () => respostaErro(401) })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')
    await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
  describe('F5.7 — resposta 2xx sem o dado (só mensagem ou vazia): a tela recarrega a lista', () => {
    it('Admin conclui com o PUT respondendo só { mensagem }: "Construção concluída.", sem alerta e a lista recarregada mostra Ativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin({ respostaConcluir: () => respostaJson({ mensagem: 'Construção concluída.' }) })
      const dialogo = await abrirConclusao(user)

      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

      const notificacao = await screen.findByText('Construção concluída.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('DEVOLUCOES'))
      await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Ativo')).toBeInTheDocument())
      expect(within(linha('Devoluções de venda')).getByText('DEVOLUCOES')).toBeInTheDocument()
      expect(screen.queryByText(/criado automaticamente/)).not.toBeInTheDocument()
    })

    it('Admin conclui com o PUT respondendo 200 vazio: "Construção concluída.", sem alerta e a lista recarregada mostra Ativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin({ respostaConcluir: () => new Response('', { status: 200 }) })
      const dialogo = await abrirConclusao(user)

      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')
      await preencherIntegracao(user, dialogo)
    await user.click(botaoConcluir(dialogo))

      const notificacao = await screen.findByText('Construção concluída.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
      await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Ativo')).toBeInTheDocument())
      expect(within(linha('Devoluções de venda')).getByText('DEVOLUCOES')).toBeInTheDocument()
    })
  })

  describe('F5.7 — modal da integração (identificador, URL, saída e entrada; alteração de 09/11/2026)', () => {
    const variaveisGets = (chamadas: ChamadaRegistrada[]) =>
      chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_VARIAVEIS)

    it('ao abrir, carrega as variáveis de GET /api/ped/integracao/variaveis e as mostra abaixo da entrada; o botão começa desabilitado com tudo faltando', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)

      const grupo = await within(dialogo).findByRole('group', { name: 'Variáveis disponíveis' })
      await waitFor(() => expect(within(grupo).getAllByRole('button')).toHaveLength(13))
      expect(within(grupo).getByRole('button', { name: /%dataInicial%/ })).toHaveTextContent('Primeiro dia do periodo')
      expect(variaveisGets(chamadas)).toHaveLength(1)
      expect(chamadas.map((c) => c.caminho)).not.toContain(`${ROTA}/variaveis`)
      expect(cabecalhoDaChamada(variaveisGets(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(botaoConcluir(dialogo)).toBeDisabled()
      expect(within(dialogo).getByText('falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido')).toBeInTheDocument()
    })

    it('não consulta mais GET /api/ped/integracao/variaveis-saida nem mostra "Marcadores da saída" (saída por "chave: tipo", 11/11/2026)', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)
      await within(grupoVariaveis(dialogo)).findByRole('button', { name: /%filial%/ })

      expect(chamadas.map((c) => c.caminho)).not.toContain('/api/ped/integracao/variaveis-saida')
      expect(within(dialogo).queryByRole('group', { name: 'Marcadores da saída' })).not.toBeInTheDocument()
    })

    it('com os campos válidos: "Todos os campos obrigatórios preenchidos" e o PUT leva só os quatro campos (sem mapeamento)', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)

      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)

      expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '3 campos: codigo_filial (string), quantidade (number), data (date)',
      )
      expect(within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de entrada' })).toHaveTextContent('JSON válido')
      await user.click(botaoConcluir(dialogo))

      await screen.findByText('Construção concluída.')
      expect(puts(chamadas)).toHaveLength(1)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('DEVOLUCOES'))
    })

    it('clicar em uma variável insere %nome% no ponto do cursor da entrada e a destaca; a prévia usa o exemplo da API (filial 100) e avisa sobre %filial%', async () => {
      const user = usuarioRapido()
      simularAdmin()
      const dialogo = await abrirConclusao(user)
      const entrada = within(dialogo).getByLabelText('Parâmetros de entrada') as HTMLTextAreaElement
      await within(grupoVariaveis(dialogo)).findByRole('button', { name: /%filial%/ })
      const texto = '{"operacao": "Consulta", "parametros": {"ECodFil": ""}}'

      await colar(user, entrada, texto)
      await user.pointer({ target: entrada, offset: texto.indexOf('""') + 1, keys: '[MouseLeft]' })
      await user.click(within(grupoVariaveis(dialogo)).getByRole('button', { name: /%filial%/ }))

      expect(entrada).toHaveValue('{"operacao": "Consulta", "parametros": {"ECodFil": "%filial%"}}')
      expect(within(grupoVariaveis(dialogo)).getByRole('button', { name: /%filial%/ })).toHaveAttribute('aria-pressed', 'true')
      const validacao = within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
      expect(validacao).toHaveTextContent('"ECodFil": "100"')
      expect(within(validacao).getByText('%filial% não tem valor numa consulta que traz todas as filiais; use %empresas%.')).toBeInTheDocument()
    })

    it('a prévia usa o exemplo da API (mesesRetro "3") em vez da janela retroativa do dado (Devoluções: 1 mês) → "(%mesesRetro% * 30) - 1" = 89', async () => {
      const user = usuarioRapido()
      simularAdmin()
      const dialogo = await abrirConclusao(user)
      await within(grupoVariaveis(dialogo)).findByRole('button', { name: /%mesesRetro%/ })

      await colar(
        user,
        within(dialogo).getByLabelText('Parâmetros de entrada'),
        '{"operacao": "Consulta", "parametros": {"dias": "(%mesesRetro% * 30) - 1"}}',
      )

      const validacao = within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
      expect(within(validacao).getByText('parametros.dias: (%mesesRetro% * 30) - 1 = 89')).toBeInTheDocument()
    })

    it('URL sem http:// ou https:// não é aceita: o botão fica bloqueado com "falta: URL válida"', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)

      const campoUrl = within(dialogo).getByLabelText('URL')
      await user.clear(campoUrl)
      await colar(user, campoUrl, 'api.exemplo.com/devolucoes')

      expect(within(dialogo).getByText('falta: URL válida')).toBeInTheDocument()
      expect(botaoConcluir(dialogo)).toBeDisabled()
      await user.click(botaoConcluir(dialogo))
      expect(puts(chamadas)).toHaveLength(0)
    })

    it('JSON de saída inválido mostra o erro com linha e coluna enquanto se digita e bloqueia o botão', async () => {
      const user = usuarioRapido()
      simularAdmin()
      const dialogo = await abrirConclusao(user)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)

      const campoSaida = within(dialogo).getByLabelText('Parâmetros de saída')
      await user.clear(campoSaida)
      await colar(user, campoSaida, '{\n  "valor": "1",\n}')

      const validacao = within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de saída' })
      expect(validacao).toHaveTextContent('JSON de saída inválido')
      expect(validacao).toHaveTextContent('Linha 2, coluna 15: vírgula sobrando')
      expect(within(dialogo).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(botaoConcluir(dialogo)).toBeDisabled()
    })

    it('saída por "chave: tipo" (11/11/2026): orientação do formato; lista (formato antigo) e tipo inválido bloqueiam e o PUT não sai; com a saída corrigida, o botão libera', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)
      expect(
        within(dialogo).getByText('Descreva um item da resposta do web service com o tipo de cada campo. É só referência para a equipe de desenvolvimento; os nomes são livres.'),
      ).toBeInTheDocument()

      const campoSaida = within(dialogo).getByLabelText('Parâmetros de saída')
      const validacao = () => within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de saída' })
      await user.clear(campoSaida)
      await colar(user, campoSaida, '[{"codfil": "101", "vlrLiq": "1"}]')
      expect(validacao()).toHaveTextContent('Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.')
      expect(botaoConcluir(dialogo)).toBeDisabled()

      await user.clear(campoSaida)
      await colar(user, campoSaida, '{"codfil": "string", "vlrLiq": "numero"}')
      expect(validacao()).toHaveTextContent('O campo "vlrLiq" da saída tem tipo "numero"; use string, number, date ou boolean')
      expect(within(dialogo).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      await user.click(botaoConcluir(dialogo))
      expect(puts(chamadas)).toHaveLength(0)

      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
      expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      await user.click(botaoConcluir(dialogo))
      await screen.findByText('Construção concluída.')
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual(corpoConclusao('DEVOLUCOES'))
    })

    /**
     * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): a modal não
     * tem as listas do mapeamento; qualquer saída válida libera o botão e o PUT leva só os quatro campos.
     */
    it('sem mapeamento: a modal não tem "Campo da filial"/"Campo do valor"/"Campo da competência" e uma saída qualquer (com date) vai como digitada, sem "campo da ..."', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)
      const saida = '{ "codemp": "string", "total": "number", "datCpt": "date" }'

      for (const rotulo of ['Campo da filial', 'Campo do valor', 'Campo da meta', 'Campo da competência']) {
        expect(within(dialogo).queryByLabelText(new RegExp(`^${rotulo}`))).not.toBeInTheDocument()
      }
      const campoSaida = within(dialogo).getByLabelText('Parâmetros de saída')
      await user.clear(campoSaida)
      await colar(user, campoSaida, saida)
      expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      await user.click(botaoConcluir(dialogo))

      await screen.findByText('Construção concluída.')
      const corpo = corpoDaChamada(puts(chamadas)[0]) as Record<string, unknown>
      expect(corpo).toEqual({ ...corpoConclusao('DEVOLUCOES'), 'parametros de saida': saida })
      for (const chave of ['campo da filial', 'campo do valor', 'campo da meta', 'campo da competencia']) {
        expect(corpo).not.toHaveProperty([chave])
      }
    })

    it('400 com erros "campo da filial"/"campo do valor" (back-end sem a versão nova): vão para o alerta geral e a modal continua aberta com os valores', async () => {
      const user = usuarioRapido()
      simularAdmin({
        aoConcluir: () =>
          respostaJson(
            {
              mensagem: 'integracao invalida: ...',
              erros: [
                { campo: 'campo da filial', mensagem: 'informe o "campo da filial"' },
                { campo: 'campo do valor', mensagem: 'informe o "campo do valor"' },
              ],
            },
            400,
          ),
      })
      const dialogo = await abrirConclusao(user)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await preencherIntegracao(user, dialogo)
      await user.click(botaoConcluir(dialogo))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent('integracao invalida: ...')
      expect(alerta).toHaveTextContent('informe o "campo da filial"')
      expect(alerta).toHaveTextContent('informe o "campo do valor"')
      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(MODELO_JSON_SAIDA)
      expect(within(dialogo).getByLabelText('Parâmetros de saída')).not.toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('dialog', { name: 'Concluir construção' })).toBeInTheDocument()
    })

    it('falha ao carregar as variáveis (500): mostra o erro, a lista fica vazia, o modelo de entrada acusa variáveis desconhecidas e o botão fica bloqueado', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin({ aoListarVariaveis: () => respostaErro(500) })
      const dialogo = await abrirConclusao(user)

      expect(await within(dialogo).findByText(mensagemPadraoPorStatus(500))).toBeInTheDocument()
      expect(within(grupoVariaveis(dialogo)).queryAllByRole('button', { name: /^%/ })).toHaveLength(0)

      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await colar(user, within(dialogo).getByLabelText('URL'), URL_VALIDA)
      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))

      const validacao = within(dialogo).getByRole('status', { name: 'Validação dos parâmetros de entrada' })
      expect(validacao).toHaveTextContent('JSON de entrada inválido')
      expect(within(validacao).getByText('Campo "parametros.EDatIni": variável desconhecida %dataInicial% em "%dataInicial%"')).toBeInTheDocument()
      expect(within(dialogo).getByText('falta: JSON de entrada válido')).toBeInTheDocument()
      expect(botaoConcluir(dialogo)).toBeDisabled()
      expect(puts(chamadas)).toHaveLength(0)
    })

    it('reabrir a modal consulta as variáveis de novo e começa com os campos vazios', async () => {
      const user = usuarioRapido()
      const chamadas = simularAdmin()
      const dialogo = await abrirConclusao(user)
      await preencherIntegracao(user, dialogo)
      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Concluir construção')
      const reaberto = screen.getByRole('dialog', { name: 'Concluir construção' })

      await within(grupoVariaveis(reaberto)).findByRole('button', { name: /%filial%/ })
      expect(variaveisGets(chamadas)).toHaveLength(2)
      expect(within(reaberto).getByLabelText('URL')).toHaveValue('')
      expect(within(reaberto).getByLabelText('Parâmetros de entrada')).toHaveValue('')
    })
  })
})
