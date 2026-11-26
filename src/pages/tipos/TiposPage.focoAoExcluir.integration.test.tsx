import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { escolherAcao } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { TIPO_LOGISTICA_API, rotuloAcoesTipo, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { usuarioRapido } from '../../test/usuario'

/**
 * F12.1 (RNF-05, item M3 da revisão de acessibilidade de 24/11/2026) — foco depois de excluir uma linha
 * pelo menu de ações (integração: /tipos com a aplicação completa).
 *
 * O diálogo devolvia o foco ao gatilho do menu da linha, que some com a exclusão, e o foco caía no
 * `<body>`. Depois da exclusão, com a linha fora da tabela, o foco fica num destino estável da página: o
 * `<h1>` "Tipos" ou o `<main>` do layout; nunca o `<body>`. Cancelar continua devolvendo o foco ao gatilho
 * (coberto em `TiposPage.exclusao.test.tsx`, F3.3).
 */
describe('F12.1 — Tipos: foco depois de excluir uma linha (M3, integração)', () => {
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

  function simularSessao() {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: () => {
        lista = lista.filter((tipo) => tipo.id !== TIPO_LOGISTICA_API.id)
        return new Response(null, { status: 204 })
      },
    })
  }

  it('Admin exclui "Logística": com a linha removida, o foco fica no <h1> "Tipos" ou no <main>, não no <body>', async () => {
    const user = usuarioRapido()
    simularSessao()
    renderizarApp('/tipos')
    await screen.findByRole('cell', { name: 'Logística' })

    await escolherAcao(user, rotuloAcoesTipo('Logística'), 'Excluir')
    await user.click(within(screen.getByRole('dialog', { name: 'Excluir tipo' })).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Tipo excluído.')
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: rotuloAcoesTipo('Logística') })).not.toBeInTheDocument()

    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    const destinos = [screen.getByRole('heading', { level: 1, name: 'Tipos' }), screen.getByRole('main')]
    expect(destinos).toContain(document.activeElement)
  })
})
