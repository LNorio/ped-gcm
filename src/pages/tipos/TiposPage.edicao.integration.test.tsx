import { screen, waitFor, within } from '@testing-library/react'
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
import { escolherAcao } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import {
  COLABORADOR_PREENCHEDOR_API,
  TIPOS_FIXOS_API,
  TIPO_MARKETING_API,
  colaboradoresApi,
  gruposApi,
  respostaRealTiposApi,
  rotuloAcoesTipo,
  tiposApi,
  type TipoApontamentoApiFalso,
} from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const FINANCEIRO_API = TIPOS_FIXOS_API[1]

describe('F3.5 — Edição dos vínculos de um tipo (integração: /tipos com Admin e Validador)', () => {
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

  /** Sessão + API de tipos com estado: o PUT troca só as listas enviadas e devolve o tipo gravado. */
  function simularSessao(perfil: 'admin' | 'validador', aoAtualizar?: () => Response | undefined) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
    const nomesUsuarios = new Map(colaboradoresApi().map((c) => [c['id colaborador'], c.nome]))
    const rotaPut = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAtualizar?.()
      if (personalizada) return personalizada
      const corpo = JSON.parse(String(init?.body)) as { grupos?: number[]; usuarios?: number[] }
      let atualizado: TipoApontamentoApiFalso | undefined
      lista = lista.map((tipo) => {
        if (tipo.id !== id) return tipo
        atualizado = {
          ...tipo,
          grupos: corpo.grupos ? corpo.grupos.map((g) => ({ id: g, nome: nomesGrupos.get(g) ?? '' })) : tipo.grupos,
          usuarios: corpo.usuarios ? corpo.usuarios.map((u) => ({ id: u, nome: nomesUsuarios.get(u) ?? '' })) : tipo.usuarios,
        }
        return atualizado
      })
      return respostaJson({ mensagem: 'tipo atualizado', tipo: atualizado })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      [`PUT /api/ped/tipos-apontamento/${FINANCEIRO_API.id}`]: rotaPut(FINANCEIRO_API.id),
      [`PUT /api/ped/tipos-apontamento/${TIPO_MARKETING_API.id}`]: rotaPut(TIPO_MARKETING_API.id),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function abrirTipos() {
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    await screen.findByRole('cell', { name: 'Marketing' })
  }

  async function abrirEdicao(user: Usuario, nome: string) {
    await escolherAcao(user, rotuloAcoesTipo(nome), 'Editar grupos')
    const dialogo = screen.getByRole('dialog', { name: `Editar grupos do tipo ${nome}` })
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    return dialogo
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, grupo: 'Grupos vinculados' | 'Usuários vinculados', rotulo: string) {
    const campo = within(dialogo).getByRole('group', { name: grupo })
    const botao = grupo === 'Grupos vinculados' ? 'Selecionar grupo' : 'Selecionar usuário'
    if (within(campo).queryByRole('listbox') === null) await user.click(within(campo).getByRole('button', { name: botao }))
    await user.click(within(campo).getByRole('option', { name: (nome) => nome.startsWith(rotulo) }))
  }

  function celulaGrupos(nome: string) {
    return within(screen.getByRole('cell', { name: nome }).closest('tr')!).getAllByRole('cell')[2]
  }

  it('Admin acrescenta um grupo a um tipo fixo: PUT só com { grupos } e o token → "Tipo atualizado." → tabela atualizada', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTipos()

    const dialogo = await abrirEdicao(user, 'Financeiro')
    expect(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' })).toHaveValue('Financeiro')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Tipo atualizado.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`/api/ped/tipos-apontamento/${FINANCEIRO_API.id}`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ grupos: [7, 9] })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    await waitFor(() => expect(celulaGrupos('Financeiro')).toHaveTextContent('DEF_ANALISTA FINANCEIRO'))
    expect(celulaGrupos('Financeiro')).toHaveTextContent('DEF_GERENTE DE LOJA')
  })

  it('Validador edita grupos e usuários de um tipo personalizado: PUT com as duas listas', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTipos()

    const dialogo = await abrirEdicao(user, 'Marketing')
    await user.click(within(dialogo).getByRole('button', { name: 'Remover DEF_OPERADOR DE CAIXA' }))
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_GERENTE DE LOJA')
    await escolher(user, dialogo, 'Usuários vinculados', 'Ciclano')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    await screen.findByText('Tipo atualizado.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ grupos: [7], usuarios: [21] })
    await waitFor(() => expect(celulaGrupos('Marketing')).toHaveTextContent('DEF_GERENTE DE LOJA'))
    expect(celulaGrupos('Marketing')).not.toHaveTextContent('DEF_OPERADOR DE CAIXA')
    expect(celulaGrupos('Marketing')).toHaveTextContent('1 usuário vinculado')
  })

  it('resposta real da API (usuários com "id colaborador"): "Editar grupos" mostra "Preenchedor" entre os usuários escolhidos e o PUT mantém o vínculo', async () => {
    const user = usuarioRapido()
    let lista = respostaRealTiposApi()
    const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores'
          ? respostaJson([...colaboradoresApi(), { ...COLABORADOR_PREENCHEDOR_API }])
          : respostaErro(400, 'tipo inválido'),
      // A API real devolve o tipo gravado no mesmo formato do GET (usuários com "id colaborador").
      'PUT /api/ped/tipos-apontamento/1': (init) => {
        const corpo = JSON.parse(String(init?.body)) as { grupos?: number[] }
        lista = lista.map((tipo) =>
          tipo.id === 1 && corpo.grupos ? { ...tipo, grupos: corpo.grupos.map((g) => ({ id: g, nome: nomesGrupos.get(g) ?? '' })) } : tipo,
        )
        return respostaJson({ mensagem: 'tipo atualizado', tipo: lista[0] })
      },
    })
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()

    const dialogo = await abrirEdicao(user, 'Comercial')
    const usuariosEscolhidos = within(dialogo).getByRole('list', { name: 'Usuários escolhidos' })
    expect(within(usuariosEscolhidos).getByText('Preenchedor')).toBeInTheDocument()
    expect(within(usuariosEscolhidos).getByRole('button', { name: 'Remover Preenchedor' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()

    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_OPERADOR DE CAIXA')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Tipo atualizado.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    // Usuários não mudaram: o colaborador 985 foi reconhecido como já vinculado, então só os grupos vão no PUT.
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ grupos: [4] })
    await waitFor(() => expect(celulaGrupos('Comercial')).toHaveTextContent('DEF_OPERADOR DE CAIXA'))
    expect(celulaGrupos('Comercial')).toHaveTextContent('1 usuário vinculado')
    expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
  })

  it('erro 400 da API aparece no diálogo, que continua aberto; a tabela não muda', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(400, 'grupo inexistente'))
    await abrirTipos()

    const dialogo = await abrirEdicao(user, 'Financeiro')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('grupo inexistente')
    expect(screen.getByRole('dialog', { name: 'Editar grupos do tipo Financeiro' })).toBeInTheDocument()
    expect(celulaGrupos('Financeiro')).not.toHaveTextContent('DEF_ANALISTA FINANCEIRO')
  })

  it('401 ao salvar (token recusado) encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTipos()

    const dialogo = await abrirEdicao(user, 'Financeiro')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
