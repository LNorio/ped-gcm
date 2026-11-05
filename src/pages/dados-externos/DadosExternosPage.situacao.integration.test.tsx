import { screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
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
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  DADO_COBERTURA_API,
  DADO_FATURAMENTO_API,
  dadosExternosApi,
  identificadoresApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'
const IMPACTO_DESATIVAR =
  'Desativado, o dado deixa de ser coletado e de compor os indicadores dos próximos fechamentos. Imagens já congeladas são mantidas.'

describe('F5.8 — Ativar/desativar dado externo (integração: /dados-externos com Admin, Validador e Preenchedor)', () => {
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
    let lista = dadosExternosApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAlterar?.()
      if (personalizada) return personalizada
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      let atualizado: DadoExternoApiFalso | undefined
      lista = lista.map((d) => {
        if (d.id !== id) return d
        atualizado = {
          ...d,
          situacao: ativo ? 'ativo' : 'inativo',
          'situacao descricao': ativo ? 'Ativo' : 'Inativo',
          'situacao alterada em': '2026-11-04 11:20:00',
          'situacao alterada por': acesso.nome,
        }
        return atualizado
      })
      return respostaPut ? respostaPut() : respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`PUT ${ROTA}/${DADO_FATURAMENTO_API.id}/situacao`]: rotaAlterar(DADO_FATURAMENTO_API.id),
      [`PUT ${ROTA}/${DADO_COBERTURA_API.id}/situacao`]: rotaAlterar(DADO_COBERTURA_API.id),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const linha = (nome: string) => screen.getByText(nome).closest('tr')!

  async function abrirTela() {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
  }

  it('Admin desativa: confirmação com o impacto → PUT { ativo: false } → "Situação alterada." → Inativo e quem/quando no detalhe', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
    const dialogo = screen.getByRole('dialog', { name: 'Desativar dado externo' })
    expect(within(dialogo).getByText(IMPACTO_DESATIVAR)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Desativar' }))

    const notificacao = await screen.findByText('Situação alterada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1/situacao`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    await waitFor(() => expect(within(linha('Faturamento líquido')).getByText('Inativo')).toBeInTheDocument())
    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Ver detalhes')
    const detalhes = linha('Faturamento líquido').nextElementSibling as HTMLElement
    expect(within(detalhes).getByText('Situação alterada em 04/11/2026 11:20 por Beltrano')).toBeInTheDocument()
  })

  it('Validador ativa um dado inativo ("Ativado, o dado volta a ser coletado.")', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Cobertura de clientes'), 'Ativar')
    const dialogo = screen.getByRole('dialog', { name: 'Ativar dado externo' })
    expect(within(dialogo).getByText('Ativado, o dado volta a ser coletado.')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Ativar' }))

    await screen.findByText('Situação alterada.')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
    await waitFor(() => expect(within(linha('Cobertura de clientes')).getByText('Ativo')).toBeInTheDocument())
  })

  it('dados em construção não têm Ativar/Desativar (só mudam pela conclusão)', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    for (const nome of ['Devoluções de venda', 'Prazo médio de recebimento']) {
      const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))
      expect(itens).not.toContain('Ativar')
      expect(itens).not.toContain('Desativar')
    }
  })

  it('Preenchedor não vê Ativar/Desativar', async () => {
    const user = usuarioRapido()
    simularSessao('preenchedor')
    await abrirTela()

    for (const nome of ['Faturamento líquido', 'Cobertura de clientes']) {
      const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))
      expect(itens).not.toContain('Ativar')
      expect(itens).not.toContain('Desativar')
    }
  })

  it('Cancelar fecha sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
    expect(screen.getByRole('button', { name: rotuloAcoesDadoExterno('Faturamento líquido') })).toHaveFocus()
  })

  it('erro da API: diálogo fecha, Aviso de erro com a mensagem e a situação mantida', async () => {
    const user = usuarioRapido()
    simularSessao('validador', () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'))
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Apenas Admin e Validador alteram a situação.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(linha('Faturamento líquido')).getByText('Ativo')).toBeInTheDocument()
  })

  it('com o filtro "Ativos", o dado desativado sai da tabela na hora, sem nova consulta', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    const opcaoAtivos = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText('Ativos') !== null)!
    await user.click(opcaoAtivos)
    await waitFor(() => expect(screen.queryByText('Cobertura de clientes')).not.toBeInTheDocument())
    const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

    await screen.findByText('Situação alterada.')
    expect(screen.queryByText('Faturamento líquido')).not.toBeInTheDocument()
    expect(screen.getByText('Volume de vendas')).toBeInTheDocument()
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes)
  })
  describe('F5.8 — resposta 2xx sem o dado (só mensagem ou vazia): a tela recarrega a lista', () => {
    it('Admin desativa com o PUT respondendo só { mensagem }: "Situação alterada.", sem alerta e a lista recarregada mostra Inativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', undefined, () => respostaJson({ mensagem: 'situação alterada' }))
      await abrirTela()
      const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

      await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar dado externo' })).getByRole('button', { name: 'Desativar' }))

      const notificacao = await screen.findByText('Situação alterada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
      await waitFor(() => expect(within(linha('Faturamento líquido')).getByText('Inativo')).toBeInTheDocument())
      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes + 1)
    })

    it('Admin desativa com o PUT respondendo 200 vazio: "Situação alterada.", sem alerta e a lista recarregada mostra Inativo', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', undefined, () => new Response('', { status: 200 }))
      await abrirTela()
      const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

      await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar dado externo' })).getByRole('button', { name: 'Desativar' }))

      const notificacao = await screen.findByText('Situação alterada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(within(linha('Faturamento líquido')).getByText('Inativo')).toBeInTheDocument())
      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes + 1)
    })
  })

})
