import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  TIPOS_FIXOS_ACESSO_API,
  acessoApi,
  respostaErro,
  respostaJson,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { escolherAcao } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { TIPOS_FIXOS_API, colaboradoresApi, gruposApi, rotuloAcoesTipo, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const FINANCEIRO_API = TIPOS_FIXOS_API[1]

describe('F3.5 — Edição dos vínculos de um tipo: acesso relido depois de salvar (integração: /tipos)', () => {
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

  const acessoAdmin = () => acessoApi({ perfil: 'admin', tipos: TIPOS_FIXOS_ACESSO_API, 'todas as filiais': true, filiais: FILIAIS_API })

  function simularSessao(opcoes: { releituras?: RotaFalsa[]; aoAtualizar?: () => Response } = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
    const releituras = opcoes.releituras ?? [() => respostaJson(acessoAdmin())]
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': rotaEmSequencia(() => respostaJson(acessoAdmin()), ...releituras),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      [`PUT /api/ped/tipos-apontamento/${FINANCEIRO_API.id}`]: (init) => {
        if (opcoes.aoAtualizar) return opcoes.aoAtualizar()
        const corpo = JSON.parse(String(init?.body)) as { grupos?: number[] }
        let atualizado: TipoApontamentoApiFalso | undefined
        lista = lista.map((tipo) => {
          if (tipo.id !== FINANCEIRO_API.id) return tipo
          atualizado = {
            ...tipo,
            grupos: corpo.grupos ? corpo.grupos.map((g) => ({ id: g, nome: nomesGrupos.get(g) ?? '' })) : tipo.grupos,
          }
          return atualizado
        })
        return respostaJson({ mensagem: 'tipo atualizado', tipo: atualizado })
      },
    })
  }

  const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')

  async function abrirTipos() {
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    await screen.findByRole('cell', { name: 'Marketing' })
  }

  async function acrescentarGrupoAoFinanceiro(user: Usuario) {
    await escolherAcao(user, rotuloAcoesTipo('Financeiro'), 'Editar grupos')
    const dialogo = screen.getByRole('dialog', { name: 'Editar grupos do tipo Financeiro' })
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    const campo = within(dialogo).getByRole('group', { name: 'Grupos vinculados' })
    if (within(campo).queryByRole('listbox') === null) await user.click(within(campo).getByRole('button', { name: 'Selecionar grupo' }))
    await user.click(within(campo).getByRole('option', { name: (nome) => nome.startsWith('DEF_ANALISTA FINANCEIRO') }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))
    return dialogo
  }

  it('depois do "Tipo atualizado.", GET /api/ped/acesso é chamado de novo com o Bearer, sem deslogar', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    await acrescentarGrupoAoFinanceiro(user)

    expect(await screen.findByText('Tipo atualizado.')).toBeInTheDocument()
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))
    expect(new Headers(getsAcesso(chamadas).at(-1)!.init?.headers).get('Authorization')).toBe('Bearer token-salvo')
    expect(screen.getByRole('table', { name: 'Tipos de apontamento' })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Olá, Fulano')).toBeInTheDocument()
  })

  it('erro no PUT (403): o diálogo mostra o erro e o acesso não é relido', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ aoAtualizar: () => respostaErro(403, 'Sem permissão.') })
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    const dialogo = await acrescentarGrupoAoFinanceiro(user)

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Sem permissão.')
    expect(getsAcesso(chamadas)).toHaveLength(antes)
  })

  it('falha de rede na releitura do acesso depois de salvar não mostra erro nem desloga', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ releituras: [() => Promise.reject(new TypeError('Failed to fetch'))] })
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    await acrescentarGrupoAoFinanceiro(user)

    expect(await screen.findByText('Tipo atualizado.')).toBeInTheDocument()
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Olá, Fulano')).toBeInTheDocument()
    expect(obterToken()).toBe('token-salvo')
  })
})
