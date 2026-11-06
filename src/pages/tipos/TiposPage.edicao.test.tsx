import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { escolherAcao, itensDoMenuAcoes } from '../../test/menuAcoes'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import {
  TIPOS_FIXOS_API,
  TIPO_LOGISTICA_API,
  colaboradoresApi,
  gruposApi,
  rotuloAcoesTipo,
  tiposApi,
  type TipoApontamentoApiFalso,
} from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { TiposPage } from './TiposPage'

const tituloEdicao = (nome: string) => `Editar grupos do tipo ${nome}`
const COMERCIAL_API = TIPOS_FIXOS_API[0]

/**
 * Envolve o fetch simulado: a partir da segunda chamada a GET /api/ped/tipos-apontamento (as recargas),
 * a resposta só sai depois de `liberar()`. `transformar` pode trocar a resposta de outras chamadas.
 */
function segurarRecargas(
  fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>,
  transformar: (metodo: string, resposta: Response) => Response = (_metodo, resposta) => resposta,
) {
  const original = fetchFalso.getMockImplementation()!
  let liberar: () => void = () => {}
  const portao = new Promise<void>((resolve) => {
    liberar = resolve
  })
  let listagensFeitas = 0
  fetchFalso.mockImplementation(async (entrada, init) => {
    const metodo = (init?.method ?? 'GET').toUpperCase()
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    if (metodo === 'GET' && new URL(texto, 'http://localhost').pathname === '/api/ped/tipos-apontamento') {
      listagensFeitas += 1
      if (listagensFeitas > 1) await portao
    }
    return transformar(metodo, await original(entrada, init))
  })
  return { liberar: () => liberar(), listagens: () => listagensFeitas }
}

describe('F3.5 — Edição dos grupos e usuários vinculados a um tipo (TiposPage)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /**
   * API com estado: o PUT aplica só as listas enviadas ao tipo da lista do GET (como o back faz) e
   * devolve o tipo atualizado. `aoAtualizar` pode devolver outra resposta.
   */
  function simularApiComEstado(aoAtualizar?: () => Response | Promise<Response> | undefined) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const rotaPut = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAtualizar?.()
      if (personalizada) return personalizada
      const corpo = JSON.parse(String(init?.body)) as { grupos?: number[]; usuarios?: number[] }
      const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
      const nomesUsuarios = new Map(colaboradoresApi().map((c) => [c['id colaborador'], c.nome]))
      let atualizado: TipoApontamentoApiFalso | undefined
      lista = lista.map((tipo) => {
        if (tipo.id !== id) return tipo
        atualizado = {
          ...tipo,
          grupos: corpo.grupos ? corpo.grupos.map((g) => ({ id: g, nome: nomesGrupos.get(g) ?? `Grupo ${g}` })) : tipo.grupos,
          usuarios: corpo.usuarios ? corpo.usuarios.map((u) => ({ id: u, nome: nomesUsuarios.get(u) ?? `Usuário ${u}` })) : tipo.usuarios,
        }
        return atualizado
      })
      return respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      [`PUT /api/ped/tipos-apontamento/${COMERCIAL_API.id}`]: rotaPut(COMERCIAL_API.id),
      [`PUT /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: rotaPut(TIPO_LOGISTICA_API.id),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  function renderizar(perfil: Perfil = 'admin') {
    return render(
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso({ perfil, todasAsFiliais: true, filiais: FILIAIS }) }}>
        <TiposPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(perfil: Perfil = 'admin') {
    renderizar(perfil)
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
  }

  async function abrirEdicao(user: Usuario, nome: string) {
    await escolherAcao(user, rotuloAcoesTipo(nome), 'Editar grupos')
    const dialogo = screen.getByRole('dialog', { name: tituloEdicao(nome) })
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    return dialogo
  }

  async function escolherGrupo(user: Usuario, dialogo: HTMLElement, rotulo: string) {
    const grupo = within(dialogo).getByRole('group', { name: 'Grupos vinculados' })
    if (within(grupo).queryByRole('listbox') === null) await user.click(within(grupo).getByRole('button', { name: 'Selecionar grupo' }))
    await user.click(within(grupo).getByRole('option', { name: (nome) => nome.startsWith(rotulo) }))
  }

  function celulaGrupos(nome: string) {
    return within(screen.getByRole('cell', { name: nome }).closest('tr')!).getAllByRole('cell')[2]
  }

  it.each<Perfil>(['admin', 'validador'])('%s vê "Editar grupos" no menu de todos os tipos, fixos e personalizados', async (perfil) => {
    const user = usuarioRapido()
    simularApiComEstado()
    await abrirTela(perfil)

    for (const nome of ['Comercial', 'Contabilidade', 'Logística', 'Marketing']) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo(nome))).toContain('Editar grupos')
    }
  })

  it('perfil sem a ação editar-tipo (Preenchedor, se chegar à tela) não vê "Editar grupos"', async () => {
    simularApiComEstado()
    await abrirTela('preenchedor')

    expect(screen.queryByRole('button', { name: rotuloAcoesTipo('Comercial') })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Editar grupos' })).not.toBeInTheDocument()
  })

  it('"Editar grupos" abre o diálogo largo "Editar grupos do tipo {nome}" com o nome somente leitura e os vínculos atuais, carregando as listas da API', async () => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    await abrirTela()

    const dialogo = await abrirEdicao(user, 'Comercial')

    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveClass('dialogo--largo')
    const nome = within(dialogo).getByRole('textbox', { name: 'Nome do tipo' })
    expect(nome).toHaveValue('Comercial')
    expect(nome).toHaveAttribute('readonly')
    const escolhidos = within(dialogo).getByRole('list', { name: 'Grupos escolhidos' })
    expect(within(escolhidos).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('DEF_OPERADOR DE CAIXA'),
      expect.stringContaining('DEF_GERENTE DE LOJA'),
    ])
    expect(within(within(dialogo).getByRole('list', { name: 'Usuários escolhidos' })).getByText(/Fulano/)).toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho === '/api/ped/grupos')).toHaveLength(1)
    expect(chamadas.filter((c) => c.caminho === '/api/ped/vinculos')).toHaveLength(1)
    expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
  })

  it('tipo fixo: trocar os grupos faz PUT /{id} só com { grupos }, fecha o diálogo, notifica "Tipo atualizado." e a tabela mostra os novos grupos', async () => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')

    await user.click(within(dialogo).getByRole('button', { name: 'Remover DEF_GERENTE DE LOJA' }))
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    const notificacao = await screen.findByText('Tipo atualizado.')
    expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`/api/ped/tipos-apontamento/${COMERCIAL_API.id}`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ grupos: [4, 9] })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-123')
    await waitFor(() => expect(celulaGrupos('Comercial')).toHaveTextContent('DEF_ANALISTA FINANCEIRO'))
    expect(celulaGrupos('Comercial')).not.toHaveTextContent('DEF_GERENTE DE LOJA')
    expect(celulaGrupos('Comercial')).toHaveTextContent('1 usuário vinculado')
  })

  it('tipo personalizado: alterar só os usuários envia { usuarios }', async () => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Logística')

    await user.click(within(dialogo).getByRole('button', { name: 'Remover Fulano' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await screen.findByText('Tipo atualizado.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ usuarios: [] })
    await waitFor(() => expect(celulaGrupos('Logística')).not.toHaveTextContent('usuário'))
  })

  it('"2xx = gravado": resposta sem tipo reconhecível recarrega a lista e mostra os vínculos gravados', async () => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    // Substitui só o corpo da resposta do PUT, mantendo a gravação na lista.
    const original = fetchFalso.getMockImplementation()!
    fetchFalso.mockImplementation(async (entrada, init) => {
      const resposta = await original(entrada, init)
      return init?.method === 'PUT' ? respostaJson({ mensagem: 'tipo atualizado' }) : resposta
    })
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')

    await escolherGrupo(user, dialogo, 'DEF_SUPERVISÃO LOGÍSTICA')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await screen.findByText('Tipo atualizado.')
    await waitFor(() => expect(celulaGrupos('Comercial')).toHaveTextContent('DEF_SUPERVISÃO LOGÍSTICA'))
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento').length).toBeGreaterThanOrEqual(2)
  })

  it('"Salvar alterações" fica desabilitado durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    simularApiComEstado(
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson({ mensagem: 'tipo atualizado' }))
        }),
    )
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeDisabled())
    liberar()
    await screen.findByText('Tipo atualizado.')
  })

  it('erro da API (403): o diálogo continua aberto com a mensagem, a tabela não muda e não há notificação', async () => {
    const user = usuarioRapido()
    simularApiComEstado(() => respostaErro(403, 'Sem permissão.'))
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Sem permissão.')
    expect(screen.getByRole('dialog', { name: tituloEdicao('Comercial') })).toBeInTheDocument()
    expect(screen.queryByText('Tipo atualizado.')).not.toBeInTheDocument()
    expect(celulaGrupos('Comercial')).not.toHaveTextContent('DEF_ANALISTA FINANCEIRO')
  })

  it('falha de rede mostra a mensagem padrão de conexão dentro do diálogo', async () => {
    const user = usuarioRapido()
    simularApiComEstado(() => Promise.reject(new TypeError('Failed to fetch')))
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
  })

  it('"Cancelar" fecha sem chamar a API e devolve o foco ao gatilho do menu da linha', async () => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
    expect(screen.getByRole('button', { name: rotuloAcoesTipo('Comercial') })).toHaveFocus()
  })

  it('reabrir a edição depois de cancelar mostra os vínculos originais (descarta o que não foi salvo)', async () => {
    const user = usuarioRapido()
    simularApiComEstado()
    await abrirTela()
    let dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    dialogo = await abrirEdicao(user, 'Comercial')

    const escolhidos = within(dialogo).getByRole('list', { name: 'Grupos escolhidos' })
    expect(within(escolhidos).getAllByRole('listitem')).toHaveLength(2)
    expect(escolhidos).not.toHaveTextContent('DEF_ANALISTA FINANCEIRO')
  })

  it.each([
    ['Buscar grupo', 'Selecionar grupo', 'Grupos vinculados'],
    ['Buscar usuário', 'Selecionar usuário', 'Usuários vinculados'],
  ])('Enter na busca "%s" não envia o formulário (sem PUT), mesmo com os vínculos alterados', async (rotuloBusca, rotuloBotao, rotuloGrupo) => {
    const user = usuarioRapido()
    const chamadas = simularApiComEstado()
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_ANALISTA FINANCEIRO')
    expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
    const grupo = within(dialogo).getByRole('group', { name: rotuloGrupo })
    if (within(grupo).queryByRole('searchbox') === null) await user.click(within(grupo).getByRole('button', { name: rotuloBotao }))

    await user.type(within(grupo).getByRole('searchbox', { name: rotuloBusca }), 'a{Enter}')

    expect(puts(chamadas)).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: tituloEdicao('Comercial') })).toBeInTheDocument()
    expect(screen.queryByText('Tipo atualizado.')).not.toBeInTheDocument()
  })

  it('"2xx = gravado" (resposta sem tipo): a tabela continua visível durante a recarga e, ao terminar, o foco volta ao gatilho do menu da linha', async () => {
    const user = usuarioRapido()
    simularApiComEstado()
    // O PUT grava na lista mas responde sem o tipo; as recargas do GET ficam pendentes até liberar().
    const recargas = segurarRecargas(fetchFalso, (metodo, resposta) =>
      metodo === 'PUT' ? respostaJson({ mensagem: 'tipo atualizado' }) : resposta,
    )
    await abrirTela()
    const dialogo = await abrirEdicao(user, 'Comercial')
    await escolherGrupo(user, dialogo, 'DEF_SUPERVISÃO LOGÍSTICA')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(recargas.listagens()).toBe(2))
    expect(screen.getByRole('table', { name: 'Tipos de apontamento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: rotuloAcoesTipo('Comercial') })).toBeInTheDocument()

    recargas.liberar()

    await screen.findByText('Tipo atualizado.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(celulaGrupos('Comercial')).toHaveTextContent('DEF_SUPERVISÃO LOGÍSTICA')
    expect(screen.getByRole('button', { name: rotuloAcoesTipo('Comercial') })).toHaveFocus()
  })
})
