import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_TREINAMENTOS_API,
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA = '/api/ped/apontamentos'
const IMPACTO_CHAMADOS =
  'O apontamento Chamados resolvidos no prazo e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.'
const BLOQUEIO_TREINAMENTOS =
  'Este apontamento compõe os indicadores: Capacitação, Desenvolvimento de equipe e não pode ser excluído.'

describe('F4.6 — Exclusão de apontamento (ApontamentosPage)', () => {
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

  /** API com estado: o DELETE remove o apontamento da lista devolvida pelo GET. */
  function simularApiComEstado(aoExcluir?: (id: number) => Response | Promise<Response> | undefined) {
    let lista = apontamentosApi()
    const rotaExcluir = (id: number) => () => {
      const personalizada = aoExcluir?.(id)
      if (personalizada) return personalizada
      lista = lista.filter((a) => a.id !== id)
      return new Response(null, { status: 204 })
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`DELETE ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}`]: rotaExcluir(APONTAMENTO_CHAMADOS_API.id),
      [`DELETE ${ROTA}/${APONTAMENTO_RELATORIO_API.id}`]: rotaExcluir(APONTAMENTO_RELATORIO_API.id),
      [`DELETE ${ROTA}/${APONTAMENTO_TREINAMENTOS_API.id}`]: rotaExcluir(APONTAMENTO_TREINAMENTOS_API.id),
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')

  function renderizar(perfil: Perfil = 'admin') {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(perfil: Perfil = 'admin') {
    renderizar(perfil)
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  async function confirmarExclusao(user: ReturnType<typeof userEvent.setup>, nome: string) {
    await user.click(screen.getByRole('button', { name: `Excluir apontamento ${nome}` }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
    await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))
    return dialogo
  }

  describe('botão por perfil (matriz da seção 2)', () => {
    it('Admin vê "Excluir apontamento {nome}" em todas as linhas', async () => {
      simularApiComEstado()
      await abrirTela('admin')

      expect(screen.getAllByRole('button', { name: /^Excluir apontamento / }).map((b) => b.getAttribute('aria-label'))).toEqual(
        NOMES_APONTAMENTOS.map((nome) => `Excluir apontamento ${nome}`),
      )
    })

    it.each<Perfil>(['validador', 'preenchedor'])('%s não vê botão Excluir', async (perfil) => {
      simularApiComEstado()
      await abrirTela(perfil)

      expect(screen.queryByRole('button', { name: /^Excluir apontamento / })).not.toBeInTheDocument()
    })
  })

  describe('confirmação (RNF-07)', () => {
    it('clicar em Excluir de um apontamento sem indicadores abre "Excluir apontamento" com o impacto e os botões Excluir (perigo) e Cancelar', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))

      const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_CHAMADOS)).toBeInTheDocument()
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeEnabled()
      expect(confirmar).toHaveClass('botao--perigo-cheio')
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
    })

    it('Cancelar fecha sem chamar a API e mantém a linha', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
    })

    it('Esc fecha sem chamar a API', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
    })

    it('o diálogo descreve o apontamento clicado', async () => {
      const user = userEvent.setup()
      simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Relatório mensal entregue' }))

      expect(
        within(screen.getByRole('dialog')).getByText(
          'O apontamento Relatório mensal entregue e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('bloqueio por indicadores (RN-11, RN-12) — decidido no front, sem chamar a API', () => {
    it('apontamento com indicadores abre em modo bloqueio listando os indicadores e só "Entendi"', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Horas de treinamento realizadas' }))

      const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
      expect(within(dialogo).getByText(BLOQUEIO_TREINAMENTOS)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
    })

    it('o apontamento vinculado a dashboard (com indicador) também é bloqueado', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Roteiro de visitas elaborado' }))

      expect(
        within(screen.getByRole('dialog')).getByText('Este apontamento compõe os indicadores: Cobertura de visitas e não pode ser excluído.'),
      ).toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
    })

    it('"Entendi" fecha o diálogo, não chama a API e a linha permanece', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Horas de treinamento realizadas' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Entendi' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(0)
      expect(screen.getByText('Horas de treinamento realizadas')).toBeInTheDocument()
    })
  })

  describe('exclusão confirmada', () => {
    it('confirmar chama DELETE /api/ped/apontamentos/{id} com o token, desabilita Excluir durante a chamada, fecha o diálogo, notifica "Apontamento excluído." e remove a linha', async () => {
      const user = userEvent.setup()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      await abrirTela()

      const dialogo = await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeDisabled())
      expect(deletes(chamadas)).toHaveLength(1)
      expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_CHAMADOS_API.id}`)
      expect(cabecalhoDaChamada(deletes(chamadas)[0], 'Authorization')).toBe('Bearer token-123')

      liberar()

      const notificacao = await screen.findByText('Apontamento excluído.')
      expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument())
      expect(screen.getByText('Roteiro de visitas elaborado')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Excluir apontamento / })).toHaveLength(4)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('Cancelar e Esc são ignorados durante a exclusão; clicar duas vezes gera um único DELETE', async () => {
      const user = userEvent.setup()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))
      const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' })
      await user.click(confirmar)
      await user.click(confirmar)
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeDisabled())

      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
      expect(screen.getByRole('dialog', { name: 'Excluir apontamento' })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog', { name: 'Excluir apontamento' })).toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(1)

      liberar()
      await screen.findByText('Apontamento excluído.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('um apontamento inativo sem indicadores também pode ser excluído', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await confirmarExclusao(user, 'Relatório mensal entregue')

      await screen.findByText('Apontamento excluído.')
      expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_RELATORIO_API.id}`)
      await waitFor(() => expect(screen.queryByText('Relatório mensal entregue')).not.toBeInTheDocument())
    })
  })

  describe('erros da API na exclusão', () => {
    it('400 com { mensagem, indicadores } (caso "já compôs", A-10): fecha o diálogo, mostra a mensagem da API em um Aviso de erro e mantém a linha', async () => {
      const user = userEvent.setup()
      const chamadas = simularApiComEstado(() =>
        respostaJson(
          {
            mensagem: 'Este apontamento já compôs o indicador Cobertura de visitas e não pode ser excluído.',
            indicadores: [{ id: 1, nome: 'Cobertura de visitas' }],
          },
          400,
        ),
      )
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Este apontamento já compôs o indicador Cobertura de visitas e não pode ser excluído.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
      expect(screen.queryByText('Apontamento excluído.')).not.toBeInTheDocument()
      expect(deletes(chamadas)).toHaveLength(1)
    })

    it('400 sem lista de indicadores também mostra a mensagem', async () => {
      const user = userEvent.setup()
      simularApiComEstado(() => respostaErro(400, 'Apontamento não pode ser excluído.'))
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      expect(await screen.findByRole('alert')).toHaveTextContent('Apontamento não pode ser excluído.')
    })

    it('403 mostra a mensagem da API e mantém a linha', async () => {
      const user = userEvent.setup()
      simularApiComEstado(() => respostaErro(403, 'Apenas o administrador exclui apontamentos.'))
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      expect(await screen.findByRole('alert')).toHaveTextContent('Apenas o administrador exclui apontamentos.')
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
    })

    it('erro sem mensagem usa a mensagem padrão do status', async () => {
      const user = userEvent.setup()
      simularApiComEstado(() => respostaErro(500))
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      expect(await screen.findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    })

    it('falha de rede mostra a mensagem padrão de conexão e mantém a linha', async () => {
      const user = userEvent.setup()
      simularApiComEstado(() => Promise.reject(new TypeError('Failed to fetch')))
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
    })

    it('depois de um erro, uma exclusão bem-sucedida remove o alerta e notifica', async () => {
      const user = userEvent.setup()
      let tentativa = 0
      simularApiComEstado(() => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : undefined
      })
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')
      expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.')

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      await screen.findByText('Apontamento excluído.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument())
    })
  })
  describe('botões de tipo após a exclusão', () => {
    function chipTipo(nome: string) {
      return within(screen.getByRole('group', { name: 'Tipo' }))
        .queryAllByRole('button')
        .find((botao) => within(botao).queryByText(nome) !== null)
    }

    it('excluir um apontamento decrementa a quantidade no botão do tipo dele', async () => {
      const user = userEvent.setup()
      simularApiComEstado()
      await abrirTela()
      expect(within(chipTipo('Comercial')!).getByText('2')).toBeInTheDocument()

      await confirmarExclusao(user, 'Relatório mensal entregue')

      await screen.findByText('Apontamento excluído.')
      await waitFor(() => expect(within(chipTipo('Comercial')!).getByText('1')).toBeInTheDocument())
    })

    it('excluir o único apontamento de um tipo remove o botão desse tipo', async () => {
      const user = userEvent.setup()
      simularApiComEstado()
      await abrirTela()
      expect(chipTipo('Tecnologia da Informação')).toBeDefined()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      await screen.findByText('Apontamento excluído.')
      await waitFor(() => expect(chipTipo('Tecnologia da Informação')).toBeUndefined())
      expect(chipTipo('Comercial')).toBeDefined()
    })

    it('uma exclusão recusada não muda os botões de tipo', async () => {
      const user = userEvent.setup()
      simularApiComEstado(() => respostaErro(403, 'Apenas o administrador exclui apontamentos.'))
      await abrirTela()

      await confirmarExclusao(user, 'Chamados resolvidos no prazo')

      await screen.findByRole('alert')
      expect(within(chipTipo('Tecnologia da Informação')!).getByText('1')).toBeInTheDocument()
    })
  })
})
