import { screen, waitFor, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  DADO_DEVOLUCOES_API,
  dadosExternosApi,
  identificadoresApi,
  respostaCriacaoApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
  type TarefaCriadaApiFalsa,
  tarefaBitrixCriadaApi,
} from '../../test/dadosExternosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

type Perfil = 'validador' | 'preenchedor'

const ROTA = '/api/ped/dados-externos-cadastro'
const DESCRICAO_TAREFA = 'Sistema de origem: Senior ERP (Sapiens). Campo ou cálculo: Soma das bonificações por filial.'
/** Frases de confirmação de FRONT-tarefas-bitrix.md (seção 2), publicadas pelo back-end em 06/11/2026. */
const fraseTarefaCriada = (numero: number) => `Tarefa #${numero} criada no Bitrix para a equipe de TI.`
const FRASE_TAREFA_NA_FILA = 'Salvo. A tarefa para a TI será criada no Bitrix em instantes.'
const AVISO_TAREFA = 'Ao salvar, será aberta uma tarefa para a equipe de TI.'

describe('F5.6 — Pedido de construção de dado externo (Validador/Preenchedor; integração: /dados-externos)', () => {
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
   * `respostaCriacao`: corpo do POST (padrão: { "dado externo", tarefa }). O novo dado é gravado
   * na lista da API falsa em qualquer caso, como faz a API.
   */
  function simularSessao(perfil: Perfil, tarefa: TarefaCriadaApiFalsa | null, respostaCriacao?: () => Response) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, nome: 'Fulano', tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, nome: 'Beltrano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`POST ${ROTA}`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as { nome: string; 'campo calculo': string }
        const criado: DadoExternoApiFalso = {
          ...DADO_DEVOLUCOES_API,
          id: 21,
          nome: corpo.nome,
          'campo calculo': corpo['campo calculo'],
          'tarefa bitrix': tarefa
            ? { id: tarefa['id bitrix'] ?? tarefa.id ?? null, status: tarefa.status ?? 'aguardando_envio', titulo: tarefa.titulo }
            : null,
          'cadastrado em': '2026-11-04 10:00:00',
          'cadastrado por': acesso.nome,
        }
        lista = [...lista, criado]
        return respostaCriacao ? respostaCriacao() : respostaJson(respostaCriacaoApi(criado, tarefa), 201)
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

  async function preencher(user: Usuario, dialogo: HTMLElement) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Bonificações')
    await escolher(user, dialogo, 'Tipo', 'Comercial')
    await escolher(user, dialogo, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, dialogo, 'Tipo de valor', 'Numeral')
    await escolher(user, dialogo, 'Referência', 'Filial')
    await escolher(user, dialogo, 'Coleta', 'Diária')
    await escolher(user, dialogo, 'Sentido do cálculo', 'Somar')
    await escolher(user, dialogo, 'Janela retroativa', '3 meses')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' }), 'Soma das bonificações por filial.')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Observação para a TI' }), 'Prioridade alta.')
  }

  it.each<Perfil>(['validador', 'preenchedor'])(
    '%s vê a variante de solicitação (Campo ou cálculo e Observação para a TI, sem identificador) e não consulta os identificadores',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil, null)
      const dialogo = await abrirCadastro(user)

      expect(within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' })).toHaveAttribute('aria-required', 'true')
      expect(within(dialogo).getByRole('textbox', { name: 'Observação para a TI' })).toBeInTheDocument()
      expect(within(dialogo).queryByLabelText('Identificador da consulta')).not.toBeInTheDocument()
      expect(chamadas.some((c) => c.caminho === `${ROTA}/identificadores`)).toBe(false)
    },
  )

  it.each<Perfil>(['validador', 'preenchedor'])(
    '%s vê no formulário o aviso "Ao salvar, será aberta uma tarefa para a equipe de TI."',
    async (perfil) => {
      const user = usuarioRapido()
      simularSessao(perfil, null)
      const dialogo = await abrirCadastro(user)

      expect(within(dialogo).getByText(AVISO_TAREFA)).toBeInTheDocument()
    },
  )

  it.each<Perfil>(['validador', 'preenchedor'])(
    '%s cadastra: POST sem identificador → tarefa já criada no Bitrix (status "enviada", "id bitrix" "1051") → "Tarefa #1051 criada no Bitrix para a equipe de TI." com o título e a descrição',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil, tarefaBitrixCriadaApi('[PED] Construir dado externo: Bonificações', '1051', DESCRICAO_TAREFA))
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
      expect(screen.queryByRole('dialog', { name: 'Novo dado externo' })).not.toBeInTheDocument()
      expect(within(resultado).getByText(fraseTarefaCriada(1051))).toBeInTheDocument()
      expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
      expect(within(resultado).getByText(DESCRICAO_TAREFA)).toBeInTheDocument()
      expect(within(resultado).queryByText(FRASE_TAREFA_NA_FILA)).not.toBeInTheDocument()
      expect(within(resultado).queryByText('Pedido de construção enviado à TI.')).not.toBeInTheDocument()
      expect(within(resultado).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({
        nome: 'Bonificações',
        identificador: null,
        'campo calculo': 'Soma das bonificações por filial.',
        observacao: 'Prioridade alta.',
      })

      await user.click(within(resultado).getByRole('button', { name: 'Entendi' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      const linha = (await screen.findByText('Bonificações')).closest('tr')!
      expect(within(linha).getByText('Em construção (TI)')).toBeInTheDocument()
      expect(within(linha).getByText('a definir pela TI')).toBeInTheDocument()
      expect(within(linha).getByText('#1051')).toBeInTheDocument()
    },
  )

  it('tarefa na fila (status "aguardando_envio", "id bitrix" null): "Salvo. A tarefa para a TI será criada no Bitrix em instantes." com o título e a descrição, sem número; a linha mostra "Aguardando envio ao Bitrix"', async () => {
    const user = usuarioRapido()
    simularSessao('preenchedor', tarefaBitrixCriadaApi('[PED] Construir dado externo: Bonificações', null, DESCRICAO_TAREFA))
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
    expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
    expect(within(resultado).getByText(DESCRICAO_TAREFA)).toBeInTheDocument()
    expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()

    await user.click(within(resultado).getByRole('button', { name: 'Entendi' }))
    const linha = (await screen.findByText('Bonificações')).closest('tr')!
    expect(within(linha).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
  })

  it('status "enviada" sem número: usa a frase sem número ("em instantes")', async () => {
    const user = usuarioRapido()
    simularSessao('validador', { ...tarefaBitrixCriadaApi('[PED] Construir dado externo: Bonificações', null, DESCRICAO_TAREFA), status: 'enviada' })
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
    expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()
  })

  it('formato anterior da tarefa ("id" sem "id bitrix", status "enviada"): continua mostrando "Tarefa #{id} criada no Bitrix para a equipe de TI."', async () => {
    const user = usuarioRapido()
    simularSessao('validador', { id: 1051, status: 'enviada', titulo: '[PED] Construir dado externo: Bonificações', descricao: DESCRICAO_TAREFA })
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText(fraseTarefaCriada(1051))).toBeInTheDocument()
  })

  it('tarefa sem id e sem status: mostra o título e a frase sem número', async () => {
    const user = usuarioRapido()
    simularSessao('validador', { titulo: '[PED] Construir dado externo: Bonificações', descricao: DESCRICAO_TAREFA })
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
    expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
    expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()
  })

  it('API sem a tarefa na resposta: mostra o título "[PED] Construir dado externo: {nome}" montado com o nome do dado', async () => {
    const user = usuarioRapido()
    simularSessao('preenchedor', null)
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
    expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
    expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Bonificações')).toBeInTheDocument())
  })

  it.each<Perfil>(['preenchedor', 'validador'])(
    '%s: POST 2xx só com { mensagem: "dado externo cadastrado" } → pedido enviado com o título montado com o nome digitado, sem alerta de erro, e o novo dado aparece na lista recarregada',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil, null, () => respostaJson({ mensagem: 'dado externo cadastrado' }, 201))
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
      expect(screen.queryByRole('dialog', { name: 'Novo dado externo' })).not.toBeInTheDocument()
      expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
      expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
      expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(1)
      await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))

      await user.click(within(resultado).getByRole('button', { name: 'Entendi' }))
      const linha = (await screen.findByText('Bonificações')).closest('tr')!
      expect(within(linha).getByText('Em construção (TI)')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
    },
  )

  it('POST 2xx com { mensagem, tarefa } sem o dado (formato documentado): o pedido mostra o título, a descrição e a frase com o número da tarefa da resposta', async () => {
    const user = usuarioRapido()
    const tarefa = tarefaBitrixCriadaApi('Construção TI: Bonificações', '1051', DESCRICAO_TAREFA)
    const chamadas = simularSessao('preenchedor', null, () => respostaJson({ mensagem: 'dado externo cadastrado', tarefa }, 201))
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText('Construção TI: Bonificações')).toBeInTheDocument()
    expect(within(resultado).queryByText('[PED] Construir dado externo: Bonificações')).not.toBeInTheDocument()
    expect(within(resultado).getByText(DESCRICAO_TAREFA)).toBeInTheDocument()
    expect(within(resultado).getByText(fraseTarefaCriada(1051))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))
  })

  it('POST 2xx com tarefa fora do formato e sem o dado: o pedido usa o título montado com o nome digitado, sem erro', async () => {
    const user = usuarioRapido()
    simularSessao('validador', null, () => respostaJson({ mensagem: 'ok', tarefa: { id: 'x', codigo: 9 } }, 201))
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(within(resultado).getByText('[PED] Construir dado externo: Bonificações')).toBeInTheDocument()
    expect(within(resultado).getByText(FRASE_TAREFA_NA_FILA)).toBeInTheDocument()
    expect(within(resultado).queryByText(/Tarefa #/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('o pedido não mostra a notificação do cadastro do Admin', async () => {
    const user = usuarioRapido()
    simularSessao('validador', null)
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
    expect(screen.queryByText('Dado externo cadastrado.')).not.toBeInTheDocument()
  })
})
