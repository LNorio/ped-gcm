import { screen, waitFor, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
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
  DADO_FATURAMENTO_API,
  dadosExternosApi,
  identificadoresApi,
  respostaCriacaoApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'

describe('F5.5 — Cadastro de dado externo pelo Admin (integração: /dados-externos)', () => {
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

  /**
   * `respostaCriacao`: corpo do POST (padrão: { "dado externo", tarefa: null }). O novo dado é
   * gravado na lista da API falsa em qualquer caso, como faz a API.
   */
  function simularAdmin(
    opcoes: { identificadores?: () => Response; respostaCriacao?: (criado: DadoExternoApiFalso) => Response } = {},
  ) {
    const acesso = acessoApi({ perfil: 'admin', nome: 'Beltrano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: opcoes.identificadores ?? (() => respostaJson(identificadoresApi())),
      [`POST ${ROTA}`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as { nome: string; identificador: string; 'campo calculo': string | null }
        const criado: DadoExternoApiFalso = {
          ...DADO_FATURAMENTO_API,
          id: 20,
          nome: corpo.nome,
          identificador: corpo.identificador,
          'campo calculo': corpo['campo calculo'],
          'cadastrado em': '2026-11-04 10:00:00',
          'cadastrado por': 'Beltrano',
        }
        lista = [...lista, criado]
        return opcoes.respostaCriacao ? opcoes.respostaCriacao(criado) : respostaJson(respostaCriacaoApi(criado, null), 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsLista = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await user.click(screen.getByRole('button', { name: 'Novo dado externo' }))
    return screen.getByRole('dialog', { name: 'Novo dado externo' })
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, campo: string, rotulo: string) {
    const select = within(dialogo).getByRole('combobox', { name: campo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  const campoCalculo = (dialogo: HTMLElement) => within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' })

  /** Preenche os campos comuns e, salvo `comCampoCalculo: false`, o "Campo ou cálculo" (com espaços nas pontas). */
  async function preencherComuns(user: Usuario, dialogo: HTMLElement, { comCampoCalculo = true }: { comCampoCalculo?: boolean } = {}) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Novos clientes')
    await escolher(user, dialogo, 'Tipo', 'Comercial')
    await escolher(user, dialogo, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, dialogo, 'Tipo de valor', 'Numeral')
    await escolher(user, dialogo, 'Referência', 'Filial')
    await escolher(user, dialogo, 'Coleta', 'Data específica do mês')
    await user.type(within(dialogo).getByRole('spinbutton', { name: 'Dia' }), '10')
    await escolher(user, dialogo, 'Sentido do cálculo', 'Somar')
    await escolher(user, dialogo, 'Janela retroativa', '2 meses')
    if (comCampoCalculo) await colar(user, campoCalculo(dialogo), '  Clientes com a primeira compra no mês.  ')
  }

  it('Admin vê a variante Admin (Identificador da consulta e Campo ou cálculo obrigatórios, sem Observação para a TI) com as sugestões de GET .../identificadores', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirCadastro(user)

    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveAttribute('aria-required', 'true')
    expect(campoCalculo(dialogo)).toHaveAttribute('aria-required', 'true')
    expect(within(dialogo).queryByLabelText('Observação para a TI')).not.toBeInTheDocument()
    const grupo = await within(dialogo).findByRole('group', { name: 'Identificadores existentes' })
    expect(within(grupo).getByRole('button', { name: 'VOLUME_VENDAS — usado por 2 dado(s)' })).toBeInTheDocument()
    const getIdentificadores = chamadas.find((c) => c.metodo === 'GET' && c.caminho === `${ROTA}/identificadores`)!
    expect(cabecalhoDaChamada(getIdentificadores, 'Authorization')).toBe('Bearer token-salvo')
  })

  it('sem Campo ou cálculo (vazio ou só espaços) mostra "Descreva o campo a buscar ou o cálculo a fazer." e não faz o POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirCadastro(user)
    await preencherComuns(user, dialogo, { comCampoCalculo: false })
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'novos_clientes')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
    expect(within(dialogo).getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(campoCalculo(dialogo)).toHaveAttribute('aria-invalid', 'true')

    await user.type(campoCalculo(dialogo), '   ')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(within(dialogo).getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo dado externo' })).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('cadastra: POST com identificador em maiúsculas e campo ou cálculo sem espaços nas pontas → diálogo fecha, "Dado externo cadastrado." e o novo dado aparece Ativo', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirCadastro(user)
    await preencherComuns(user, dialogo)
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'novos_clientes')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const notificacao = await screen.findByText('Dado externo cadastrado.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      nome: 'Novos clientes',
      'id tipo': 1,
      'sistema de origem': 'senior_erp',
      'tipo de valor': 'numeral',
      referencia: 'filial',
      coleta: 'dia do mes',
      'dia da coleta': 10,
      'sentido do calculo': 'soma',
      'janela retroativa': 2,
      comentarios: null,
      'campo calculo': 'Clientes com a primeira compra no mês.',
      identificador: 'NOVOS_CLIENTES',
      observacao: null,
    })
    await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))
    const linha = (await screen.findByText('Novos clientes')).closest('tr')!
    expect(within(linha).getByText('Ativo')).toBeInTheDocument()
    expect(within(linha).getByText('NOVOS_CLIENTES')).toBeInTheDocument()
  })

  it.each<[string, () => Response]>([
    ['só { mensagem: "dado externo cadastrado" }', () => respostaJson({ mensagem: 'dado externo cadastrado' }, 201)],
    ['201 com corpo vazio', () => new Response('', { status: 201 })],
  ])(
    'POST 2xx com %s (sem o dado): diálogo fecha, "Dado externo cadastrado.", sem alerta de erro e o novo dado aparece na lista recarregada',
    async (_caso, resposta) => {
      const user = usuarioRapido()
      const chamadas = simularAdmin({ respostaCriacao: () => resposta() })
      const dialogo = await abrirCadastro(user)
      await preencherComuns(user, dialogo)
      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'novos_clientes')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      const notificacao = await screen.findByText('Dado externo cadastrado.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(1)
      await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))
      const linha = (await screen.findByText('Novos clientes')).closest('tr')!
      expect(within(linha).getByText('Ativo')).toBeInTheDocument()
      expect(within(linha).getByText('NOVOS_CLIENTES')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
    },
  )

  it('identificador com acento, espaço e caractere especial: o campo descarta os inválidos ao colar e ao digitar e o POST leva o valor limpo', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirCadastro(user)
    await preencherComuns(user, dialogo)
    const campo = within(dialogo).getByLabelText('Identificador da consulta')

    await colar(user, campo, 'NOVOS-CLIENTES 2')
    expect(campo).toHaveValue('NOVOSCLIENTES2')
    await user.type(campo, ' ação')
    expect(campo).toHaveValue('NOVOSCLIENTES2AO')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Dado externo cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ identificador: 'NOVOSCLIENTES2AO' })
  })

  it('escolher uma sugestão preenche o identificador e ele é enviado', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirCadastro(user)
    await preencherComuns(user, dialogo)

    const grupo = await within(dialogo).findByRole('group', { name: 'Identificadores existentes' })
    await user.click(within(grupo).getByRole('button', { name: 'NOVOS_CLIENTES — usado por 0 dado(s)' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Dado externo cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({
      identificador: 'NOVOS_CLIENTES',
      'campo calculo': 'Clientes com a primeira compra no mês.',
    })
  })

  it('falha em GET .../identificadores não impede o cadastro (formulário sem sugestões)', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin({ identificadores: () => respostaErro(500, 'Falha.') })
    const dialogo = await abrirCadastro(user)

    await waitFor(() => expect(chamadas.some((c) => c.caminho === `${ROTA}/identificadores`)).toBe(true))
    expect(within(dialogo).queryByRole('group', { name: 'Identificadores existentes' })).not.toBeInTheDocument()
    await preencherComuns(user, dialogo)
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'x1')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Dado externo cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ identificador: 'X1' })
  })
})
