import { screen, waitFor, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'
import { escolherAcao, itensDoMenuAcoes } from '../../test/menuAcoes'
import { TIPO_LOGISTICA_API, TIPO_MARKETING_API, rotuloAcoesTipo, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F3.3 — Exclusão de tipo personalizado (integração: /tipos com Admin e Validador)', () => {
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
   * Sessão do perfil + API de tipos com estado (o DELETE remove o tipo da lista devolvida pelo GET),
   * para aceitar tanto a remoção local da linha quanto a recarga da lista após excluir.
   */
  function simularSessao(perfil: 'admin' | 'validador', aoExcluir?: (id: number) => Response | undefined) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const rotaExcluir = (id: number) => () => {
      const personalizada = aoExcluir?.(id)
      if (personalizada) return personalizada
      lista = lista.filter((tipo) => tipo.id !== id)
      return new Response(null, { status: 204 })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: rotaExcluir(TIPO_LOGISTICA_API.id),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_MARKETING_API.id}`]: rotaExcluir(TIPO_MARKETING_API.id),
    })
  }

  function exclusoes(chamadas: ChamadaRegistrada[]) {
    return chamadas.filter((c) => c.metodo === 'DELETE')
  }

  async function abrirTipos() {
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    await screen.findByRole('cell', { name: 'Logística' })
  }

  async function confirmarExclusao(user: Usuario, nome: string) {
    await escolherAcao(user, rotuloAcoesTipo(nome), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))
  }

  it('Admin exclui um tipo personalizado: confirmação → DELETE com o token → notificação "Tipo excluído." → linha removida', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTipos()

    await escolherAcao(user, rotuloAcoesTipo('Logística'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
    expect(
      within(dialogo).getByText('O tipo Logística será removido. Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    const notificacao = await screen.findByText('Tipo excluído.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
    expect(screen.getByRole('cell', { name: 'Marketing' })).toBeInTheDocument()

    const deletes = exclusoes(chamadas)
    expect(deletes).toHaveLength(1)
    expect(deletes[0].caminho).toBe(`/api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`)
    expect(cabecalhoDaChamada(deletes[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(deletes[0].init?.body).toBeUndefined()
  })

  it('Validador exclui um tipo personalizado do mesmo modo que o Admin (documento de requisitos prevalece)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTipos()
    expect(screen.getByText('Validador')).toBeInTheDocument()

    await confirmarExclusao(user, 'Logística')

    await screen.findByText('Tipo excluído.')
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
    expect(exclusoes(chamadas)).toHaveLength(1)
    expect(cabecalhoDaChamada(exclusoes(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
  })

  it('Validador recusado pela API (403): a mensagem da API é exibida, o diálogo fecha e a linha permanece', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador', () => respostaErro(403, 'Apenas o administrador pode excluir tipos.'))
    await abrirTipos()

    await confirmarExclusao(user, 'Logística')

    expect(await screen.findByRole('alert')).toHaveTextContent('Apenas o administrador pode excluir tipos.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
    expect(screen.queryByText('Tipo excluído.')).not.toBeInTheDocument()
    expect(exclusoes(chamadas)).toHaveLength(1)
    // 403 não encerra a sessão: a tela continua em Tipos.
    expect(screen.getByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
  })

  it('Admin recebe 400 da API (regra do back-end): a mensagem é exibida e a linha permanece', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(400, 'Tipo possui apontamentos vinculados.'))
    await abrirTipos()

    await confirmarExclusao(user, 'Logística')

    expect(await screen.findByRole('alert')).toHaveTextContent('Tipo possui apontamentos vinculados.')
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
  })

  it('tipo com apontamentos: diálogo bloqueado com o motivo e "Entendi"; nenhuma chamada DELETE', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTipos()

    await escolherAcao(user, rotuloAcoesTipo('Marketing'), 'Excluir')

    const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
    expect(
      within(dialogo).getByText('Este tipo possui 3 apontamento(s) vinculado(s) e não pode ser excluído.'),
    ).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Marketing' })).toBeInTheDocument()
    expect(exclusoes(chamadas)).toHaveLength(0)
  })

  it('Cancelar na confirmação não chama a API e mantém a linha', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTipos()

    await escolherAcao(user, rotuloAcoesTipo('Logística'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
    expect(exclusoes(chamadas)).toHaveLength(0)
  })

  it('tipos fixos não têm "Excluir" no menu de ações na tela completa', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTipos()

    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Comercial'))).not.toContain('Excluir')
    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Contabilidade'))).not.toContain('Excluir')
    expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Logística'))).toContain('Excluir')
  })

  it('401 ao excluir (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTipos()

    await confirmarExclusao(user, 'Logística')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
