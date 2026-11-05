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
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { indicadoresApi, respostaSituacaoApi, rotaListarIndicadores, type IndicadorApiFalso } from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const IMPACTO_INATIVAR =
  'Enquanto inativo, o indicador não pontua: seus pontos base ficam sem pontuação nos dashboards em que aparece. Imagens já congeladas são mantidas.'

describe('F6.6 — Inativar/reativar indicador (integração: /indicadores com Admin e Validador)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador', aoAlterar?: () => Response | Promise<Response> | undefined) {
    const acesso = acessoApi({ perfil, nome: 'Beltrano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = indicadoresApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAlterar?.()
      if (personalizada) return personalizada
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      let atualizado: IndicadorApiFalso | undefined
      lista = lista.map((i) => {
        if (i.id !== id) return i
        atualizado = { ...i, ativo, 'situacao alterada em': '2026-11-05 11:20:00', 'situacao alterada por': acesso.nome }
        return atualizado
      })
      return respostaJson(respostaSituacaoApi(atualizado!))
    }
    const rotas: Record<string, ReturnType<typeof rotaAlterar>> = {}
    for (const id of [1, 3, 5, 6]) rotas[`PUT ${ROTA}/${id}/situacao`] = rotaAlterar(id)
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      ...rotas,
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const linha = (nome: string) => screen.getByText(nome).closest('tr')!

  async function abrirTela() {
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
  }

  it('Admin inativa: confirmação com o impacto e os dashboards afetados → PUT { ativo: false } → "Situação alterada." → "Inativo", "Reativar" no menu e quem/quando nos detalhes', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    expect(within(dialogo).getByText(IMPACTO_INATIVAR)).toBeInTheDocument()
    const afetados = within(dialogo).getByRole('list', { name: 'Dashboards afetados' })
    expect(within(afetados).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'PED Comercial (60 pontos base)',
      'PED Gerentes (30 pontos base)',
    ])
    await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }))

    const notificacao = await screen.findByText('Situação alterada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/3/situacao`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    await waitFor(() => expect(within(linha('Faturamento líquido mensal')).getByText('Inativo')).toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento líquido mensal'))).toEqual([
      'Ver detalhes',
      'Histórico de metas',
      'Reativar',
    ])
    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Ver detalhes')
    const detalhes = linha('Faturamento líquido mensal').nextElementSibling as HTMLElement
    expect(within(detalhes).getByText('Situação alterada em 05/11/2026 11:20 por Beltrano')).toBeInTheDocument()
  })

  it('Validador reativa um indicador inativo ("Reativar indicador", "Nenhum dashboard é afetado.") → PUT { ativo: true } → etiqueta "Inativo" some', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Capacitação'), 'Reativar')
    const dialogo = screen.getByRole('dialog', { name: 'Reativar indicador' })
    expect(within(dialogo).getByText('Nenhum dashboard é afetado.')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Reativar' }))

    await screen.findByText('Situação alterada.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
    await waitFor(() => expect(within(linha('Capacitação')).queryByText('Inativo')).not.toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Inativar', 'Excluir'])
  })

  it('indicador vinculado a dashboard também pode ser inativado (RF-38: qualquer indicador)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Inativar')
    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    expect(within(dialogo).getByText('PED Comercial (40 pontos base)')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }))

    await screen.findByText('Situação alterada.')
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1/situacao`)
  })

  it('inativar um indicador com componente desativado reduz o alerta da aba', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()
    expect(screen.getByText('3 indicadores com componente desativado.')).toBeInTheDocument()

    await escolherAcao(user, rotuloAcoesIndicador('Custo de frete por entrega'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))

    await screen.findByText('Situação alterada.')
    expect(screen.getByText('2 indicadores com componente desativado.')).toBeInTheDocument()
  })

  it('Cancelar fecha sem chamar a API e devolve o foco ao gatilho do menu', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
    expect(screen.getByRole('button', { name: rotuloAcoesIndicador('Faturamento líquido mensal') })).toHaveFocus()
  })

  it('erro da API: diálogo fecha, Aviso de erro com a mensagem e a situação mantida', async () => {
    const user = usuarioRapido()
    simularSessao('validador', () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Apenas Admin e Validador alteram a situação.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(linha('Faturamento líquido mensal')).queryByText('Inativo')).not.toBeInTheDocument()
  })

  it('clique duplo em Inativar gera um único PUT; Cancelar e Esc são ignorados durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const inativado: IndicadorApiFalso = { ...indicadoresApi()[2], ativo: false }
    const chamadas = simularSessao(
      'admin',
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaSituacaoApi(inativado)))
        }),
    )
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Inativar' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Inativar indicador' })).toBeInTheDocument()
    liberar()
    await screen.findByText('Situação alterada.')
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('com o filtro "Ativos", o indicador inativado sai da tabela na hora, sem nova consulta', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    const opcaoAtivos = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText('Ativos') !== null)!
    await user.click(opcaoAtivos)
    await waitFor(() => expect(screen.queryByText('Capacitação')).not.toBeInTheDocument())
    const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))

    await screen.findByText('Situação alterada.')
    expect(screen.queryByText('Faturamento líquido mensal')).not.toBeInTheDocument()
    expect(screen.getByText('Cobertura de visitas')).toBeInTheDocument()
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes)
  })

  it('401 ao alterar a situação encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Inativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
