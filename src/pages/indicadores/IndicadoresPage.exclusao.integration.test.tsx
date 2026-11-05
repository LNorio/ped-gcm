import { screen, waitFor, within } from '@testing-library/react'
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
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_JA_VINCULADO = 'O indicador já foi vinculado a dashboard e não pode ser excluído.'

/**
 * A rota `DELETE /api/ped/indicadores-cadastro/{id}` ainda não existe na API (ajuste A-09, acordado);
 * estes testes descrevem o comportamento do front quando ela estiver publicada.
 */
describe('F6.7 — Excluir indicador (integração: /indicadores com Admin e Validador)', () => {
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

  function simularSessao(
    perfil: 'admin' | 'validador',
    aoExcluir?: () => Response | Promise<Response> | undefined,
    aoAlterarSituacao?: () => Response,
  ) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = indicadoresApi()
    const rotaExcluir = (id: number) => () => {
      const personalizada = aoExcluir?.()
      if (personalizada) return personalizada
      lista = lista.filter((i) => i.id !== id)
      return new Response(null, { status: 204 })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`DELETE ${ROTA}/2`]: rotaExcluir(2),
      [`DELETE ${ROTA}/5`]: rotaExcluir(5),
      [`PUT ${ROTA}/2/situacao`]: aoAlterarSituacao ?? (() => respostaErro(500)),
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')

  async function abrirTela() {
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  it.each(['admin', 'validador'] as const)(
    '%s exclui: confirmação com o impacto → DELETE com o Bearer → "Indicador excluído." e a linha some',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil)
      await abrirTela()

      await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
      const dialogo = screen.getByRole('dialog', { name: 'Excluir indicador' })
      expect(
        within(dialogo).getByText('O indicador Rotinas financeiras em dia será excluído definitivamente. Esta ação não pode ser desfeita.'),
      ).toBeInTheDocument()
      await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

      const notificacao = await screen.findByText('Indicador excluído.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(1)
      expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/2`)
      expect(cabecalhoDaChamada(deletes(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      await waitFor(() => expect(screen.queryByText('Rotinas financeiras em dia')).not.toBeInTheDocument())
    },
  )

  it('excluir um indicador com componente desativado reduz o alerta da aba', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()
    expect(screen.getByText('3 indicadores com componente desativado.')).toBeInTheDocument()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Indicador excluído.')
    expect(screen.getByText('2 indicadores com componente desativado.')).toBeInTheDocument()
  })

  it('Admin exclui um indicador inativo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Capacitação'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Indicador excluído.')
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/5`)
  })

  it('indicadores vinculados a dashboard não oferecem "Excluir" no menu (RN-11)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    for (const nome of ['Cobertura de visitas', 'Faturamento líquido mensal', 'Custo de frete por entrega']) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))).not.toContain('Excluir')
    }
    expect(deletes(chamadas)).toHaveLength(0)
  })

  it('400 da API (já esteve vinculado): diálogo fecha, Aviso de erro com a mensagem e a linha mantida, sem notificação', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaJson({ mensagem: MENSAGEM_JA_VINCULADO }, 400))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_JA_VINCULADO)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Rotinas financeiras em dia')).toBeInTheDocument()
    expect(screen.queryByText('Indicador excluído.')).not.toBeInTheDocument()
  })

  it('404 (rota ainda não publicada — A-09): Aviso de erro com a mensagem padrão e a linha mantida', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(404))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Registro não encontrado.')
    expect(screen.getByText('Rotinas financeiras em dia')).toBeInTheDocument()
  })

  it('clique duplo em Excluir gera um único DELETE; Cancelar e Esc são ignorados durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const chamadas = simularSessao(
      'admin',
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(new Response(null, { status: 204 }))
        }),
    )
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir indicador' })
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Excluir' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Excluir indicador' })).toBeInTheDocument()
    liberar()
    await screen.findByText('Indicador excluído.')
    expect(deletes(chamadas)).toHaveLength(1)
  })

  it('um aviso de erro de ação por vez: o erro da exclusão substitui o da alteração de situação', async () => {
    const user = usuarioRapido()
    simularSessao(
      'admin',
      () => respostaJson({ mensagem: MENSAGEM_JA_VINCULADO }, 400),
      () => respostaErro(500, 'Falha ao alterar a situação.'),
    )
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao alterar a situação.')

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_JA_VINCULADO))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText('Falha ao alterar a situação.')).not.toBeInTheDocument()
  })

  it('401 ao excluir encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Excluir')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
