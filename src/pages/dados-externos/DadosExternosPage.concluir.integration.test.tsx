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
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const AVISO_INDICADOR = 'Indicador Devoluções de venda criado automaticamente. Defina a meta na aba Indicadores.'

describe('F5.7 — Concluir construção de dado externo (Admin; integração: /dados-externos)', () => {
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
  }

  function simularAdmin(opcoes: Opcoes = {}) {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
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

  it('Admin conclui: PUT .../concluir com o identificador em maiúsculas → "Construção concluída.", dado Ativo e aviso do indicador criado', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'devolucoes')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    const notificacao = await screen.findByText('Construção concluída.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/3/concluir`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ identificador: 'DEVOLUCOES' })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Ativo')).toBeInTheDocument())
    expect(within(linha('Devoluções de venda')).getByText('DEVOLUCOES')).toBeInTheDocument()

    const aviso = screen.getByText(AVISO_INDICADOR)
    expect(aviso.closest('[role="note"]')).not.toBeNull()
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
      'Ver detalhes',
      'Desativar',
      'Excluir',
    ])
  })

  it('identificador com acento, espaço e caractere especial: o campo descarta os inválidos ao colar e ao digitar e o PUT leva o valor limpo', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)
    const campo = within(dialogo).getByLabelText('Identificador da consulta')

    await colar(user, campo, 'devoluções-venda')
    expect(campo).toHaveValue('DEVOLUESVENDA')
    await user.type(campo, ' 2')
    expect(campo).toHaveValue('DEVOLUESVENDA2')

    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    await screen.findByText('Construção concluída.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ identificador: 'DEVOLUESVENDA2' })
  })

  it('o diálogo mostra as sugestões de identificadores; escolher uma preenche o campo e é enviada', async () => {
    const user = usuarioRapido()
    const chamadas = simularAdmin()
    const dialogo = await abrirConclusao(user)

    const grupo = await within(dialogo).findByRole('group', { name: 'Identificadores existentes' })
    await user.click(within(grupo).getByRole('button', { name: 'NOVOS_CLIENTES — usado por 0 dado(s)' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    await screen.findByText('Construção concluída.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ identificador: 'NOVOS_CLIENTES' })
  })

  it('sem indicador criado na resposta, não mostra o aviso do indicador', async () => {
    const user = usuarioRapido()
    simularAdmin({ indicadorCriado: null })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

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
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O identificador XPTO não tem coleta cadastrada.')
    expect(screen.getByRole('dialog', { name: 'Concluir construção' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('XPTO')
    expect(within(linha('Devoluções de venda')).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(screen.queryByText('Construção concluída.')).not.toBeInTheDocument()
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

    await user.dblClick(within(dialogo).getByRole('button', { name: 'Concluir' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Concluir construção' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Concluir' })).toBeDisabled()
    liberar()
    await screen.findByText('Construção concluída.')
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('401 ao concluir encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularAdmin({ aoConcluir: () => respostaErro(401) })
    const dialogo = await abrirConclusao(user)

    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'DEVOLUCOES')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
