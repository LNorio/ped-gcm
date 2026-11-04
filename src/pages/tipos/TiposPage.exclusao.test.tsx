import { render, screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { TIPO_LOGISTICA_API, TIPO_MARKETING_API, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import type { Perfil } from '../../types/dominio'
import { TiposPage } from './TiposPage'

const IMPACTO_LOGISTICA = 'O tipo Logística será removido. Esta ação não pode ser desfeita.'
const BLOQUEIO_MARKETING = 'Este tipo possui 3 apontamento(s) vinculado(s) e não pode ser excluído.'

describe('F3.3 — Exclusão de tipo personalizado (TiposPage)', () => {
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

  /**
   * API com estado: o GET devolve a lista atual e o DELETE remove o tipo dela, para que a tela
   * possa tanto remover a linha localmente quanto recarregar a lista — os dois caminhos passam.
   */
  function simularApiComEstado(aoExcluir?: (id: number) => Response | Promise<Response> | undefined) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const excluirDaLista = (id: number) => {
      lista = lista.filter((tipo) => tipo.id !== id)
      return new Response(null, { status: 204 })
    }
    const rotaExcluir = (id: number) => () => {
      const personalizada = aoExcluir?.(id)
      if (personalizada) return personalizada
      return excluirDaLista(id)
    }
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: rotaExcluir(TIPO_LOGISTICA_API.id),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_MARKETING_API.id}`]: rotaExcluir(TIPO_MARKETING_API.id),
    })
    return chamadas
  }

  function exclusoes(chamadas: ChamadaRegistrada[]) {
    return chamadas.filter((c) => c.metodo === 'DELETE')
  }

  function renderizar(perfil: Perfil = 'admin') {
    return render(
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso({ perfil, todasAsFiliais: true, filiais: FILIAIS }) }}>
        <TiposPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(perfil: Perfil = 'admin') {
    renderizar(perfil)
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
  }

  describe('confirmação (RNF-07)', () => {
    it('clicar em "Excluir tipo Logística" abre o diálogo "Excluir tipo" com o impacto e os botões Excluir (perigo) e Cancelar', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))

      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_LOGISTICA)).toBeInTheDocument()
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeEnabled()
      expect(confirmar).toHaveClass('botao--perigo-cheio')
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('"Cancelar" fecha o diálogo sem chamar a API e mantém a linha', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(0)
      expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
      expect(screen.queryByText('Tipo excluído.')).not.toBeInTheDocument()
    })

    it('Esc fecha o diálogo sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(0)
    })

    it('o diálogo descreve o tipo clicado (não o primeiro personalizado)', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      expect(within(screen.getByRole('dialog')).getByText(IMPACTO_LOGISTICA)).toBeInTheDocument()
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Marketing' }))
      expect(within(screen.getByRole('dialog')).queryByText(IMPACTO_LOGISTICA)).not.toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).getByText(BLOQUEIO_MARKETING)).toBeInTheDocument()
    })
  })

  describe('bloqueio por apontamentos vinculados (RN-13)', () => {
    it('tipo personalizado com apontamentos abre o diálogo em modo bloqueio, com o motivo e só o botão "Entendi"', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Marketing' }))

      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      expect(within(dialogo).getByText(BLOQUEIO_MARKETING)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(0)
    })

    it('"Entendi" fecha o diálogo sem chamar a API e a linha permanece', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Marketing' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Entendi' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(0)
      expect(screen.getByRole('cell', { name: 'Marketing' })).toBeInTheDocument()
    })

    it('o motivo usa a quantidade de apontamentos do tipo clicado', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([{ ...TIPO_LOGISTICA_API, 'quantidade apontamentos': 1 }, TIPO_MARKETING_API]),
      })
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))

      expect(
        within(screen.getByRole('dialog')).getByText(
          'Este tipo possui 1 apontamento(s) vinculado(s) e não pode ser excluído.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('exclusão confirmada', () => {
    it('confirmar chama DELETE /api/ped/tipos-apontamento/{id} com o token, desabilita Excluir durante a chamada, fecha o diálogo, notifica "Tipo excluído." e remove a linha', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeDisabled())
      expect(exclusoes(chamadas)).toHaveLength(1)
      expect(exclusoes(chamadas)[0].caminho).toBe(`/api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`)
      expect(cabecalhoDaChamada(exclusoes(chamadas)[0], 'Authorization')).toBe('Bearer token-123')

      liberar()

      const notificacao = await screen.findByText('Tipo excluído.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
      expect(screen.getByRole('cell', { name: 'Marketing' })).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'Comercial' })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Excluir tipo / }).map((b) => b.getAttribute('aria-label'))).toEqual([
        'Excluir tipo Marketing',
      ])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('Cancelar e Esc são ignorados enquanto a exclusão está em andamento; o diálogo fecha quando a API responde', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      await user.click(within(dialogo).getByRole('button', { name: 'Excluir' }))
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeDisabled())

      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
      expect(screen.getByRole('dialog', { name: 'Excluir tipo' })).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog', { name: 'Excluir tipo' })).toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(1)

      liberar()

      await screen.findByText('Tipo excluído.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
    })

    it('clicar duas vezes em Excluir dispara uma única chamada DELETE', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(new Response(null, { status: 204 }))
          }),
      )
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      const confirmar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' })
      await user.click(confirmar)
      await user.click(confirmar)

      expect(exclusoes(chamadas)).toHaveLength(1)

      liberar()
      await screen.findByText('Tipo excluído.')
    })

    it('após a exclusão, a contagem do filtro Personalizado é atualizada', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))
      await screen.findByText('Tipo excluído.')

      await waitFor(() => {
        const lista = screen.getByRole('listbox', { name: 'Origem' })
        const personalizado = within(lista)
          .getAllByRole('option')
          .find((opcao) => within(opcao).queryByText('Personalizado') !== null)!
        expect(within(personalizado).getByText('1')).toBeInTheDocument()
      })
    })
  })

  describe('erros da API na exclusão', () => {
    it('400: fecha o diálogo, mostra a mensagem da API em um alerta de erro e mantém a linha, sem notificação de sucesso', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado(() => respostaErro(400, 'Tipo possui apontamentos vinculados.'))
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Tipo possui apontamentos vinculados.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
      expect(screen.queryByText('Tipo excluído.')).not.toBeInTheDocument()
      expect(exclusoes(chamadas)).toHaveLength(1)
    })

    it('403 ao Validador: mostra a mensagem da API (a tela não bloqueia o Validador; quem decide é a API)', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => respostaErro(403, 'Apenas o administrador pode excluir tipos.'))
      await abrirTela('validador')

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Apenas o administrador pode excluir tipos.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
    })

    it('erro sem mensagem usa a mensagem padrão do status', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => respostaErro(403))
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(403))
    })

    it('falha de rede mostra a mensagem padrão de conexão e mantém a linha', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => Promise.reject(new TypeError('Failed to fetch')))
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
      expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
    })

    it('depois de um erro, uma nova exclusão bem-sucedida remove o alerta e notifica o sucesso', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      simularApiComEstado(() => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : undefined
      })
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.')

      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      await screen.findByText('Tipo excluído.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
    })
  })

  describe('perfis', () => {
    it('Validador vê os botões Excluir dos personalizados e abre a confirmação como o Admin', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela('validador')

      expect(screen.getAllByRole('button', { name: /^Excluir tipo / })).toHaveLength(2)
      await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))

      expect(screen.getByRole('dialog', { name: 'Excluir tipo' })).toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    })
  })
})
