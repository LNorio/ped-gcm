import { screen, waitFor, within } from '@testing-library/react'
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
  type RotaFalsa,
} from '../../test/apiFalsa'
import { dashboardsApi, respostaDashboardApi, rotaListarDashboards, type DashboardApiFalso } from '../../test/dashboardsFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const COMUNS = ['Ver pesos dos indicadores', 'Histórico de modificações']

describe('F7.10 — Ativar/desativar, concluir e excluir dashboard (integração: /dashboards com Admin)', () => {
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

  function simularSessao(rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    let lista: DashboardApiFalso[] = dashboardsApi()
    const atualizar = (id: number, mudanca: Partial<DashboardApiFalso>) => {
      lista = lista.map((d) => (d.id === id ? { ...d, ...mudanca } : d))
      return respostaJson(respostaDashboardApi(lista.find((d) => d.id === id)!))
    }
    const rotasSituacao: Record<string, RotaFalsa> = {}
    for (const id of [1, 2, 5]) {
      rotasSituacao[`PUT ${ROTA}/${id}/situacao`] = (init) => {
        const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
        return atualizar(id, { situacao: ativo ? 'ativo' : 'inativo', 'situacao descricao': ativo ? 'Ativo' : 'Inativo' })
      }
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      ...rotasSituacao,
      [`PUT ${ROTA}/3/concluir`]: () => atualizar(3, { situacao: 'ativo', 'situacao descricao': 'Ativo' }),
      [`PUT ${ROTA}/4/concluir`]: () => atualizar(4, { situacao: 'ativo', 'situacao descricao': 'Ativo' }),
      [`DELETE ${ROTA}/5`]: () => {
        lista = lista.filter((d) => d.id !== 5)
        return new Response(null, { status: 204 })
      },
      ...rotasExtras,
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function abrirTela() {
    renderizarApp('/dashboards')
    return await screen.findByRole('table', { name: 'Dashboards' })
  }

  const linha = (tabela: HTMLElement, nome: string) => within(tabela).getByText(nome).closest('tr')!

  it('desativar: confirmação com o impacto → PUT { ativo: false } → "Situação do dashboard alterada." → "Inativo" e "Ativar" no menu', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Desativar')
    const dialogo = screen.getByRole('dialog', { name: 'Desativar dashboard' })
    expect(within(dialogo).getByText(/sai do Início e dos Fechamentos/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Desativar' }))

    const notificacao = await screen.findByText('Situação do dashboard alterada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1/situacao`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    await waitFor(() => expect(within(linha(tabela, 'PED Comercial')).getByText('Inativo')).toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))).toEqual(['Editar', ...COMUNS, 'Ativar', 'Excluir'])
  })

  it('ativar um dashboard inativo envia { ativo: true } e ele volta a "Ativo", com "Preencher apontamentos"', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Financeiro'), 'Ativar')
    await user.click(within(screen.getByRole('dialog', { name: 'Ativar dashboard' })).getByRole('button', { name: 'Ativar' }))

    await screen.findByText('Situação do dashboard alterada.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
    await waitFor(() => expect(within(linha(tabela, 'PED Financeiro')).getByText('Ativo')).toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Financeiro'))).toEqual([
      'Editar',
      ...COMUNS,
      'Preencher apontamentos',
      'Desativar',
      'Excluir',
    ])
  })

  it('concluir construção: confirmação → PUT .../concluir → "Conclusão registrada." → "Ativo" e o menu passa a oferecer "Desativar"', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Supervisores'), 'Concluir construção (TI)')
    const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    await screen.findByText('Conclusão registrada.')
    expect(puts(chamadas).map((c) => c.caminho)).toEqual([`${ROTA}/3/concluir`])
    await waitFor(() => expect(within(linha(tabela, 'PED Supervisores')).getByText('Ativo')).toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Supervisores'))).toEqual([
      'Editar',
      ...COMUNS,
      'Preencher apontamentos',
      'Desativar',
      'Excluir',
    ])
  })

  it('concluir modificação usa o diálogo "Concluir modificação"', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Logística'), 'Concluir modificação (TI)')
    await user.click(within(screen.getByRole('dialog', { name: 'Concluir modificação' })).getByRole('button', { name: 'Concluir' }))

    await screen.findByText('Conclusão registrada.')
    expect(puts(chamadas).map((c) => c.caminho)).toEqual([`${ROTA}/4/concluir`])
  })

  it('excluir: confirmação com o impacto → DELETE → "Dashboard excluído." e a linha some', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Financeiro'), 'Excluir')
    const dialogo = screen.getByRole('dialog', { name: 'Excluir dashboard' })
    expect(within(dialogo).getByText(/As imagens congeladas já geradas são mantidas\./)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Dashboard excluído.')
    expect(chamadas.filter((c) => c.metodo === 'DELETE').map((c) => c.caminho)).toEqual([`${ROTA}/5`])
    await waitFor(() => expect(within(tabela).queryByText('PED Financeiro')).not.toBeInTheDocument())
  })

  it('Cancelar fecha a confirmação sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Financeiro'), 'Excluir')
    await user.click(within(screen.getByRole('dialog', { name: 'Excluir dashboard' })).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas.filter((c) => c.metodo === 'DELETE')).toHaveLength(0)
  })

  it.each([
    ['Desativar', 'PED Comercial', 'Desativar dashboard', 'Desativar', `PUT ${ROTA}/1/situacao`],
    ['Concluir construção (TI)', 'PED Supervisores', 'Concluir construção', 'Concluir', `PUT ${ROTA}/3/concluir`],
    ['Excluir', 'PED Financeiro', 'Excluir dashboard', 'Excluir', `DELETE ${ROTA}/5`],
  ])('erro em "%s": diálogo fecha, Aviso de erro com a mensagem da API e a linha mantida, sem notificação', async (acao, nome, titulo, botao, rota) => {
    const user = usuarioRapido()
    simularSessao({ [rota]: () => respostaErro(400, 'Operação recusada pela API.') })
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard(nome), acao)
    await user.click(within(screen.getByRole('dialog', { name: titulo })).getByRole('button', { name: botao }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Operação recusada pela API.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(tabela).getByText(nome)).toBeInTheDocument()
    expect(screen.queryByText(/Situação do dashboard alterada\.|Conclusão registrada\.|Dashboard excluído\./)).not.toBeInTheDocument()
  })
})
