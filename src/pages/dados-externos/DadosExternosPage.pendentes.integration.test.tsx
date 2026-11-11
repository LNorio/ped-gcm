import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  type CorpoIntegracaoApiFalso,
  DADO_DEVOLUCOES_API,
  type DadoExternoApiFalso,
  dadosExternosAdminApi,
  identificadoresApi,
  rotaIntegracoesPendentes,
  rotaListarDadosExternos,
  variaveisIntegracaoApi,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dados-externos-cadastro'
const ROTA_PENDENTES = `${ROTA}/integracoes-pendentes`
const ETIQUETA = 'Integração pendente (TI)'
const AVISO_DOIS = '2 dados externos com integração pendente (TI).'
const AVISO_UM = '1 dado externo com integração pendente (TI).'

/**
 * Alerta de integração pendente (F5.17, mudança de 09/11/2026) — só Admin:
 * - a página consulta `GET .../integracoes-pendentes` ao carregar e depois de concluir uma construção ou
 *   salvar as configurações de uma integração;
 * - com quantidade > 0: aviso no topo da lista com a quantidade e o botão "Ver pendentes" (aplica o
 *   filtro "Integração pendente (TI)") e sinal "Com alertas" na aba "Dados Externos"
 *   (`definirAlerta('dados-externos', true)`); some quando a quantidade é 0;
 * - etiqueta "Integração pendente (TI)" na linha do dado com `integracao pendente`;
 * - Validador e Preenchedor não chamam a rota.
 */
describe('F5.17 — Alerta de integração pendente (integração: /dados-externos)', () => {
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
    lista?: DadoExternoApiFalso[]
    /** Resposta personalizada de `GET .../integracoes-pendentes`. */
    aoListarPendentes?: () => Response
  }

  /** API com estado: salvar a integração ou concluir a construção atualiza a lista e os pendentes. */
  function simular(opcoes: Opcoes = {}) {
    const perfil = opcoes.perfil ?? 'admin'
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = opcoes.lista ?? dadosExternosAdminApi()
    const gravar = (id: number, extra: Partial<DadoExternoApiFalso> = {}) => (init: RequestInit | undefined) => {
      const corpo = JSON.parse(String(init?.body)) as CorpoIntegracaoApiFalso
      lista = lista.map(
        (d): DadoExternoApiFalso =>
          d.id === id
            ? {
                ...d,
                ...extra,
                identificador: corpo.identificador,
                url: corpo.url,
                'parametros de saida': JSON.parse(corpo['parametros de saida']) as unknown,
                'parametros de entrada': JSON.parse(corpo['parametros de entrada']) as unknown,
                'integracao pendente': false,
              }
            : d,
      )
      return respostaJson({ mensagem: 'ok' })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      'GET /api/ped/integracao/variaveis': () => respostaJson(variaveisIntegracaoApi()),
      [`GET ${ROTA_PENDENTES}`]: opcoes.aoListarPendentes ?? rotaIntegracoesPendentes(() => lista),
      [`PUT ${ROTA}/2/integracao`]: gravar(2),
      [`PUT ${ROTA}/5/integracao`]: gravar(5),
      [`PUT ${ROTA}/3/concluir`]: gravar(3, { situacao: 'ativo', 'situacao descricao': 'Ativo' }),
    })
  }

  const pendentesGets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_PENDENTES)
  const listaGets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const abas = () => screen.getByRole('navigation', { name: 'Abas' })
  const linkDadosExternos = () => within(abas()).getByRole('link', { name: /^Dados Externos/ })
  const marcador = () => within(linkDadosExternos()).queryByRole('img', { name: 'Com alertas' })
  const tabela = () => screen.getByRole('table', { name: 'Dados externos' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!

  async function abrirTela() {
    renderizarApp('/dados-externos')
    return await screen.findByRole('table', { name: 'Dados externos' })
  }

  /** Abre "Preencher integração" e salva com URL e modelos válidos. */
  async function preencherIntegracao(user: Usuario, nome: string) {
    await escolherAcao(user, rotuloAcoesDadoExterno(nome), 'Preencher integração')
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })
    await colar(user, within(dialogo).getByLabelText('URL'), 'https://ti.exemplo.com.br/api/consulta')
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
    // Saída por "chave: tipo" (11/11/2026): o mapeamento do modelo é obrigatório para salvar.
    await user.selectOptions(within(dialogo).getByLabelText('Campo da filial'), 'codfil')
    await user.selectOptions(within(dialogo).getByLabelText('Campo do valor'), 'vlrLiq')
    await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar configurações' }))
    await screen.findByText('Integração atualizada.')
  }

  describe('aviso no topo da lista e sinal na aba', () => {
    it('Admin: consulta os pendentes ao carregar (com o token) e mostra "2 dados externos com integração pendente (TI)." com "Ver pendentes"', async () => {
      const chamadas = simular()
      await abrirTela()

      const aviso = await screen.findByText(AVISO_DOIS)
      expect(aviso.closest('[role="note"]')).not.toBeNull()
      expect(screen.getByRole('button', { name: 'Ver pendentes' })).toBeInTheDocument()
      expect(pendentesGets(chamadas)).toHaveLength(1)
      expect(cabecalhoDaChamada(pendentesGets(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    })

    it('com 1 pendente, o texto fica no singular: "1 dado externo com integração pendente (TI)."', async () => {
      simular({ aoListarPendentes: () => respostaJson({ quantidade: 1, dados: [{ id: 2, nome: 'Cobertura de clientes', identificador: 'COBERTURA', situacao: 'inativo' }] }) })
      await abrirTela()

      expect(await screen.findByText(AVISO_UM)).toBeInTheDocument()
    })

    it('o aviso usa a quantidade informada pela API', async () => {
      simular({ aoListarPendentes: () => respostaJson({ quantidade: 11, dados: [] }) })
      await abrirTela()

      expect(await screen.findByText('11 dados externos com integração pendente (TI).')).toBeInTheDocument()
    })

    it('com pendentes, a aba "Dados Externos" do menu ganha o marcador "Com alertas", que permanece ao mudar de aba', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      await waitFor(() => expect(marcador()).not.toBeNull())
      await user.click(within(abas()).getByRole('link', { name: 'Início' }))
      await screen.findByRole('heading', { level: 1, name: 'Início' })
      expect(marcador()).not.toBeNull()
    })

    it('sem pendentes (quantidade 0), não há aviso nem marcador', async () => {
      const chamadas = simular({ aoListarPendentes: () => respostaJson({ quantidade: 0, dados: [] }) })
      await abrirTela()

      await waitFor(() => expect(pendentesGets(chamadas)).toHaveLength(1))
      expect(screen.queryByText(/com integração pendente \(TI\)\./)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ver pendentes' })).not.toBeInTheDocument()
      expect(marcador()).toBeNull()
    })

    it('falha ao consultar os pendentes (500): sem aviso, sem marcador e sem erro na tela; a lista aparece normalmente', async () => {
      const chamadas = simular({ aoListarPendentes: () => respostaErro(500) })
      await abrirTela()

      await waitFor(() => expect(pendentesGets(chamadas)).toHaveLength(1))
      expect(screen.queryByText(/com integração pendente \(TI\)\./)).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(marcador()).toBeNull()
      expect(within(tabela()).getByText('Faturamento líquido')).toBeInTheDocument()
    })
  })

  it('"Ver pendentes" aplica o filtro "Integração pendente (TI)": consulta com situacao=integracao_pendente e mostra só os pendentes', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    await abrirTela()

    await user.click(await screen.findByRole('button', { name: 'Ver pendentes' }))

    await waitFor(() => expect(listaGets(chamadas).at(-1)?.url.searchParams.get('situacao')).toBe('integracao_pendente'))
    await waitFor(() => expect(within(tabela()).queryByText('Faturamento líquido')).not.toBeInTheDocument())
    expect(within(tabela()).getByText('Cobertura de clientes')).toBeInTheDocument()
    expect(within(tabela()).getByText('Chamados atendidos no prazo')).toBeInTheDocument()
    const opcao = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((o) => within(o).queryByText(ETIQUETA) !== null)!
    expect(opcao).toHaveAttribute('aria-selected', 'true')
  })

  it('etiqueta "Integração pendente (TI)" só nas linhas pendentes', async () => {
    simular()
    await abrirTela()

    expect(within(linha('Cobertura de clientes')).getByText(ETIQUETA)).toBeInTheDocument()
    expect(within(linha('Chamados atendidos no prazo')).getByText(ETIQUETA)).toBeInTheDocument()
    for (const nome of ['Faturamento líquido', 'Devoluções de venda', 'Prazo médio de recebimento', 'Volume de vendas']) {
      expect(within(linha(nome)).queryByText(ETIQUETA)).not.toBeInTheDocument()
    }
  })

  describe('atualização depois de salvar a integração', () => {
    it('salvar a integração de um pendente consulta os pendentes de novo: o aviso passa a "1 dado externo ..."', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      await screen.findByText(AVISO_DOIS)

      await preencherIntegracao(user, 'Chamados atendidos no prazo')

      expect(await screen.findByText(AVISO_UM)).toBeInTheDocument()
      expect(pendentesGets(chamadas).length).toBeGreaterThanOrEqual(2)
      expect(within(linha('Chamados atendidos no prazo')).queryByText(ETIQUETA)).not.toBeInTheDocument()
    })

    it('salvar o último pendente faz o aviso e o marcador da aba sumirem', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()
      await screen.findByText(AVISO_DOIS)

      await preencherIntegracao(user, 'Chamados atendidos no prazo')
      await screen.findByText(AVISO_UM)
      await preencherIntegracao(user, 'Cobertura de clientes')

      await waitFor(() => expect(screen.queryByText(/com integração pendente \(TI\)\./)).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Ver pendentes' })).not.toBeInTheDocument()
      await waitFor(() => expect(marcador()).toBeNull())
    })

    it('concluir uma construção também consulta os pendentes de novo', async () => {
      const user = usuarioRapido()
      const chamadas = simular({ lista: dadosExternosAdminApi().map((d) => (d.id === DADO_DEVOLUCOES_API.id ? { ...d, 'integracao pendente': false } : d)) })
      await abrirTela()
      await waitFor(() => expect(pendentesGets(chamadas)).toHaveLength(1))

      await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Concluir construção')
      const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
      await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
      await colar(user, within(dialogo).getByLabelText('URL'), 'https://ti.exemplo.com.br/api/devolucoes')
      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de saída' }))
      await user.selectOptions(within(dialogo).getByLabelText('Campo da filial'), 'codfil')
      await user.selectOptions(within(dialogo).getByLabelText('Campo do valor'), 'vlrLiq')
      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
      await user.click(within(dialogo).getByRole('button', { name: 'Concluir e ativar' }))

      await screen.findByText('Construção concluída.')
      await waitFor(() => expect(pendentesGets(chamadas)).toHaveLength(2))
    })
  })

  describe.each(['validador', 'preenchedor'] as const)('%s', (perfil) => {
    it('não consulta os pendentes, não vê o aviso nem o marcador e não tem a opção "Integração pendente (TI)" no filtro', async () => {
      const chamadas = simular({ perfil })
      await abrirTela()

      expect(pendentesGets(chamadas)).toHaveLength(0)
      expect(screen.queryByText(/com integração pendente \(TI\)\./)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ver pendentes' })).not.toBeInTheDocument()
      expect(marcador()).toBeNull()
      const opcoes = within(screen.getByRole('listbox', { name: 'Situação' }))
        .getAllByRole('option')
        .map((o) => o.textContent)
      expect(opcoes).not.toContain(ETIQUETA)
    })
  })
})
