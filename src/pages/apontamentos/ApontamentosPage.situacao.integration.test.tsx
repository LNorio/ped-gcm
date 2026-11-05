import { screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesApontamento } from '../../test/menuAcoes'
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
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_RELATORIO_API,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/apontamentos'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F4.5 — Ativar/desativar apontamento (integração: /apontamentos com Admin, Validador e Preenchedor)', () => {
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
    perfil: 'admin' | 'validador' | 'preenchedor',
    aoAlterar?: () => Response | undefined,
    respostaPut?: () => Response,
  ) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, nome: 'Beltrano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = apontamentosApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAlterar?.()
      if (personalizada) return personalizada
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      let atualizado: ApontamentoApiFalso | undefined
      lista = lista.map((a) => {
        if (a.id !== id) return a
        atualizado = { ...a, ativo, 'situacao alterada em': '2026-11-03 11:20:00', 'situacao alterada por': acesso.nome }
        return atualizado
      })
      return respostaPut ? respostaPut() : respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`PUT ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CHAMADOS_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_RELATORIO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_RELATORIO_API.id),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function abrirTela() {
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  function linha(nome: string) {
    return screen.getByText(nome).closest('tr')!
  }

  it('Admin desativa: confirmação → PUT /{id}/situacao { ativo: false } com o Bearer → "Situação alterada." → etiqueta Inativo e detalhe com quem/quando', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
    const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
    expect(
      within(dialogo).getByText(
        'Desativado, o apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Desativar' }))

    const notificacao = await screen.findByText('Situação alterada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    await waitFor(() => expect(within(linha('Chamados resolvidos no prazo')).getByText('Inativo')).toHaveClass('etiqueta--neutro'))
    await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Ver detalhes')
    expect(screen.getByText('Situação alterada em 03/11/2026 11:20 por Beltrano')).toBeInTheDocument()
  })

  it('Validador ativa um apontamento inativo do mesmo modo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTela()
    expect(screen.getByText('Validador')).toBeInTheDocument()

    await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
    await user.click(within(screen.getByRole('dialog', { name: 'Ativar apontamento' })).getByRole('button', { name: 'Ativar' }))

    await screen.findByText('Situação alterada.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
    await waitFor(() => expect(within(linha('Relatório mensal entregue')).getByText('Ativo')).toHaveClass('etiqueta--sucesso'))
  })

  it('Preenchedor não tem Desativar/Ativar no menu de ações (só "Ver detalhes" onde há detalhes)', async () => {
    const user = usuarioRapido()
    simularSessao('preenchedor')
    await abrirTela()

    expect(screen.getByText('Preenchedor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: rotuloAcoesApontamento('Chamados resolvidos no prazo') })).not.toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Relatório mensal entregue'))).toEqual(['Ver detalhes'])
  })

  it('403 da API: mensagem exibida em alerta, diálogo fechado, situação mantida, sessão preservada', async () => {
    const user = usuarioRapido()
    simularSessao('validador', () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Apenas Admin e Validador alteram a situação.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(linha('Chamados resolvidos no prazo')).getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Apontamentos' })).toBeInTheDocument()
  })

  it('401 ao alterar (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
  it('Admin com o filtro "Ativos" desativa um apontamento: a linha sai da tabela na hora e o botão do tipo que zerou some', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    const opcaoAtivos = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((item) => within(item).queryByText('Ativos') !== null)!
    await user.click(opcaoAtivos)
    await waitFor(() => expect(screen.queryByText('Conciliação bancária concluída')).not.toBeInTheDocument())
    const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

    await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
    await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))

    await screen.findByText('Situação alterada.')
    expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument()
    expect(screen.getByText('Roteiro de visitas elaborado')).toBeInTheDocument()
    const chips = within(screen.getByRole('group', { name: 'Tipo' })).queryAllByRole('button')
    expect(chips.find((chip) => within(chip).queryByText('Tecnologia da Informação') !== null)).toBeUndefined()
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes)
  })
  describe('F4.5 — resposta 2xx sem o apontamento (só mensagem ou vazia): a tela recarrega a lista', () => {
    it('Admin ativa com o PUT respondendo só { mensagem }: "Situação alterada.", sem alerta de erro e a lista recarregada mostra Ativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', undefined, () => respostaJson({ mensagem: 'situação alterada' }))
      await abrirTela()
      const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Ativar apontamento' })).getByRole('button', { name: 'Ativar' }))

      const notificacao = await screen.findByText('Situação alterada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
      await waitFor(() => expect(within(linha('Relatório mensal entregue')).getByText('Ativo')).toHaveClass('etiqueta--sucesso'))
      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes + 1)
    })

    it('Admin ativa com o PUT respondendo 200 vazio: "Situação alterada.", sem alerta e a lista recarregada mostra Ativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', undefined, () => new Response('', { status: 200 }))
      await abrirTela()
      const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Ativar apontamento' })).getByRole('button', { name: 'Ativar' }))

      const notificacao = await screen.findByText('Situação alterada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(within(linha('Relatório mensal entregue')).getByText('Ativo')).toHaveClass('etiqueta--sucesso'))
      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes + 1)
    })

    it('Admin desativa com o PUT respondendo só { mensagem }: sem alerta e a lista recarregada mostra Inativo', async () => {
      const user = usuarioRapido()
      simularSessao('admin', undefined, () => respostaJson({ mensagem: 'situação alterada' }))
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))

      await screen.findByText('Situação alterada.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(within(linha('Chamados resolvidos no prazo')).getByText('Inativo')).toHaveClass('etiqueta--neutro'))
    })
  })

})
