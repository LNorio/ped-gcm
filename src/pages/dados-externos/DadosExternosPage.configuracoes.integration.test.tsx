import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  type CorpoIntegracaoApiFalso,
  type DadoExternoApiFalso,
  ENTRADA_FATURAMENTO_API,
  NOMES_DADOS_EXTERNOS,
  SAIDA_FATURAMENTO_API,
  URL_FATURAMENTO,
  dadosExternosAdminApi,
  identificadoresApi,
  rotaIntegracoesPendentes,
  rotaListarDadosExternos,
  variaveisIntegracaoApi,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'

const ROTA = '/api/ped/dados-externos-cadastro'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'
const ROTA_PENDENTES = `${ROTA}/integracoes-pendentes`
const URL_NOVA = 'https://ti.exemplo.com.br/api/faturamento-v2'
const SAIDA_TEXTO = JSON.stringify(SAIDA_FATURAMENTO_API, null, 2)
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_FATURAMENTO_API, null, 2)

/**
 * Configurações da integração (F5.16, mudança de 09/11/2026) — Admin, dado ativo ou inativo:
 * menu "Configurações" ("Preencher integração" quando pendente) → mesma modal em modo configuração
 * ("Configurações da integração", campos preenchidos, "Salvar configurações") → PUT
 * `.../{id}/integracao` → fecha, "Integração atualizada.", recarrega a lista e os pendentes. Não muda a
 * situação nem cria indicador. A URL aparece abaixo do identificador.
 */
describe('F5.16 — Configurações da integração do dado externo (integração: /dados-externos)', () => {
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
    perfil?: 'admin' | 'validador' | 'preenchedor'
    /** Resposta personalizada do PUT .../integracao (erro, por exemplo). */
    aoAtualizar?: () => Response | undefined
  }

  /** API com estado: o PUT .../integracao grava URL e parâmetros e tira o dado dos pendentes. */
  function simular(opcoes: Opcoes = {}) {
    const perfil = opcoes.perfil ?? 'admin'
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosAdminApi()
    const atualizar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = opcoes.aoAtualizar?.()
      if (personalizada) return personalizada
      const corpo = JSON.parse(String(init?.body)) as CorpoIntegracaoApiFalso
      lista = lista.map(
        (d): DadoExternoApiFalso =>
          d.id === id
            ? {
                ...d,
                identificador: corpo.identificador,
                url: corpo.url,
                'parametros de saida': JSON.parse(corpo['parametros de saida']) as unknown,
                'parametros de entrada': JSON.parse(corpo['parametros de entrada']) as unknown,
                'integracao pendente': false,
              }
            : d,
      )
      return respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': ['filial'] })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA_VARIAVEIS}`]: () => respostaJson(variaveisIntegracaoApi()),
      [`GET ${ROTA_PENDENTES}`]: rotaIntegracoesPendentes(() => lista),
      [`PUT ${ROTA}/1/integracao`]: atualizar(1),
      [`PUT ${ROTA}/2/integracao`]: atualizar(2),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const linha = (nome: string) => within(screen.getByRole('table', { name: 'Dados externos' })).getByText(nome).closest('tr')!
  const salvar = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Salvar configurações' })

  async function abrirTela() {
    renderizarApp('/dados-externos')
    return await screen.findByRole('table', { name: 'Dados externos' })
  }

  async function abrirConfiguracoes(user: Usuario, nome: string, item: 'Configurações' | 'Preencher integração' = 'Configurações') {
    await escolherAcao(user, rotuloAcoesDadoExterno(nome), item)
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    await within(dialogo).findByRole('button', { name: /%filial%/ })
    return dialogo
  }

  describe('menu de ações', () => {
    it('Admin: ativo/inativo com integração → "Configurações"; pendente → "Preencher integração"; em construção → "Concluir construção"', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual([
        'Ver detalhes',
        'Configurações',
        'Desativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Ativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Concluir construção',
        'Excluir',
      ])
    })

    it.each(['validador', 'preenchedor'] as const)('%s não vê "Configurações", "Preencher integração" nem "Concluir construção"', async (perfil) => {
      const user = usuarioRapido()
      simular({ perfil })
      await abrirTela()

      for (const nome of NOMES_DADOS_EXTERNOS) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))
        expect(itens).not.toContain('Configurações')
        expect(itens).not.toContain('Preencher integração')
        expect(itens).not.toContain('Concluir construção')
      }
    })
  })

  it('Admin vê a URL abaixo do identificador na linha', async () => {
    simular()
    await abrirTela()

    const celula = within(linha('Faturamento líquido')).getByText('FATURAMENTO').closest('td')!
    expect(within(celula).getByText(URL_FATURAMENTO)).toBeInTheDocument()
  })

  it('"Configurações" abre a modal com os valores salvos e consulta as variáveis da API', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()

    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')

    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('FATURAMENTO')
    expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_FATURAMENTO)
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_TEXTO)
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue(ENTRADA_TEXTO)
    expect(gets(chamadas, ROTA_VARIAVEIS)).toHaveLength(1)
    expect(within(dialogo).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
    expect(salvar(dialogo)).toBeEnabled()
  })

  it('salvar: PUT .../{id}/integracao com os quatro campos → fecha, "Integração atualizada.", recarrega lista e pendentes; situação mantida e nenhum indicador criado', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()
    const listasAntes = gets(chamadas, ROTA).length
    const pendentesAntes = gets(chamadas, ROTA_PENDENTES).length
    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')

    const campoUrl = within(dialogo).getByLabelText('URL')
    await user.clear(campoUrl)
    await colar(user, campoUrl, URL_NOVA)
    await user.click(salvar(dialogo))

    const notificacao = await screen.findByText('Integração atualizada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1/integracao`)
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      identificador: 'FATURAMENTO',
      url: URL_NOVA,
      'parametros de saida': SAIDA_TEXTO,
      'parametros de entrada': ENTRADA_TEXTO,
    })
    await waitFor(() => expect(gets(chamadas, ROTA).length).toBeGreaterThan(listasAntes))
    await waitFor(() => expect(gets(chamadas, ROTA_PENDENTES).length).toBeGreaterThan(pendentesAntes))
    await waitFor(() => expect(within(linha('Faturamento líquido')).getByText(URL_NOVA)).toBeInTheDocument())
    expect(within(linha('Faturamento líquido')).getByText('Ativo')).toBeInTheDocument()
    expect(chamadas.some((c) => c.caminho.endsWith('/concluir'))).toBe(false)
    expect(screen.queryByText(/criado automaticamente/)).not.toBeInTheDocument()
  })

  it('"Preencher integração" (dado pendente) abre com os campos vazios (só o identificador) e, ao salvar, a etiqueta de pendente sai da linha', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()
    expect(within(linha('Cobertura de clientes')).getByText('Integração pendente (TI)')).toBeInTheDocument()

    const dialogo = await abrirConfiguracoes(user, 'Cobertura de clientes', 'Preencher integração')
    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('COBERTURA')
    expect(within(dialogo).getByLabelText('URL')).toHaveValue('')
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue('')
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue('')
    expect(salvar(dialogo)).toBeDisabled()

    await colar(user, within(dialogo).getByLabelText('URL'), 'https://ti.exemplo.com.br/api/cobertura')
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
    await user.click(salvar(dialogo))

    await screen.findByText('Integração atualizada.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      identificador: 'COBERTURA',
      url: 'https://ti.exemplo.com.br/api/cobertura',
      'parametros de saida': MODELO_JSON_SAIDA,
      'parametros de entrada': MODELO_JSON_ENTRADA,
    })
    await waitFor(() => expect(within(linha('Cobertura de clientes')).queryByText('Integração pendente (TI)')).not.toBeInTheDocument())
    expect(within(linha('Cobertura de clientes')).getByText('Inativo')).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toContain('Configurações')
  })

  it('400 { mensagem, erros }: mensagem geral no alerta e erros junto aos campos; a modal continua aberta com os valores', async () => {
    const user = usuarioRapido()
    const chamadas = simular({
      aoAtualizar: () =>
        respostaJson(
          {
            mensagem: 'integracao invalida: URL ...',
            erros: [
              { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
              { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' },
            ],
          },
          400,
        ),
    })
    await abrirTela()
    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')

    await user.click(salvar(dialogo))

    const geral = await within(dialogo).findByText('integracao invalida: URL ...')
    expect(geral.closest('[role="alert"]')).not.toBeNull()
    expect(within(dialogo).getByLabelText('URL')).toHaveAccessibleDescription(
      expect.stringContaining('a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'),
    )
    expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveAccessibleDescription(
      expect.stringContaining('Campo "inicio": divisao por zero em "5 / 0"'),
    )
    expect(screen.getByRole('dialog', { name: 'Configurações da integração' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_FATURAMENTO)
    expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_TEXTO)
    expect(screen.queryByText('Integração atualizada.')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('clicar numa variável sem antes clicar na caixa de entrada insere no fim do texto salvo (não antes do "{")', async () => {
    const user = usuarioRapido()
    simular()
    await abrirTela()
    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')
    const entrada = within(dialogo).getByLabelText('Parâmetros de entrada')
    const variaveis = within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })

    await user.click(within(variaveis).getByRole('button', { name: /%mes%/ }))

    expect(entrada).toHaveValue(`${ENTRADA_TEXTO}%mes%`)
  })

  it('Cancelar fecha sem chamar a API; reabrir mostra de novo os valores salvos', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()
    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')
    await user.clear(within(dialogo).getByLabelText('URL'))

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
    const reaberto = await abrirConfiguracoes(user, 'Faturamento líquido')
    expect(within(reaberto).getByLabelText('URL')).toHaveValue(URL_FATURAMENTO)
  })

  it('clique duplo em "Salvar configurações" gera um único PUT', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()
    const dialogo = await abrirConfiguracoes(user, 'Faturamento líquido')

    await user.dblClick(salvar(dialogo))

    await screen.findByText('Integração atualizada.')
    expect(puts(chamadas)).toHaveLength(1)
  })
})
