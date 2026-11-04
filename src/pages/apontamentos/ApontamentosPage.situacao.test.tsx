import { render, screen, waitFor, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesApontamento } from '../../test/menuAcoes'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_ROTEIRO_API,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA = '/api/ped/apontamentos'
const IMPACTO_DESATIVAR =
  'Desativado, o apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos.'
const IMPACTO_ATIVAR = 'Ativado, o apontamento volta ao Preenchimento.'

describe('F4.5 — Ativar/desativar apontamento (ApontamentosPage)', () => {
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

  /** API com estado: o PUT grava a situação (com quem e quando) e o GET seguinte reflete a mudança. */
  function simularApiComEstado(aoAlterar?: (id: number) => Response | Promise<Response> | undefined) {
    let lista = apontamentosApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = aoAlterar?.(id)
      if (personalizada) return personalizada
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      let atualizado: ApontamentoApiFalso | undefined
      lista = lista.map((a) => {
        if (a.id !== id) return a
        atualizado = { ...a, ativo, 'situacao alterada em': '2026-11-03 11:20:00', 'situacao alterada por': 'Fulano' }
        return atualizado
      })
      return respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`PUT ${ROTA}/${APONTAMENTO_ROTEIRO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_ROTEIRO_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CHAMADOS_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_RELATORIO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_RELATORIO_API.id),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

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

  function linhaDoApontamento(nome: string): HTMLElement {
    const linha = screen.getByText(nome).closest('tr')
    if (!linha) throw new Error(`Linha "${nome}" não encontrada`)
    return linha
  }

  function etiquetaSituacao(nome: string) {
    return within(within(linhaDoApontamento(nome)).getAllByRole('cell')[3]).getByText(/^(Ativo|Inativo)$/)
  }

  describe('itens do menu de ações por perfil (matriz da seção 2)', () => {
    it.each<Perfil>(['admin', 'validador'])('%s vê "Desativar" nos ativos e "Ativar" nos inativos, no menu de ações de cada apontamento', async (perfil) => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela(perfil)

      for (const nome of ['Roteiro de visitas elaborado', 'Horas de treinamento realizadas', 'Chamados resolvidos no prazo']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))
        expect(itens).toContain('Desativar')
        expect(itens).not.toContain('Ativar')
      }
      for (const nome of ['Conciliação bancária concluída', 'Relatório mensal entregue']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))
        expect(itens).toContain('Ativar')
        expect(itens).not.toContain('Desativar')
      }
    })

    it('Preenchedor não tem Desativar/Ativar: sem detalhes a linha não tem menu; com detalhes o menu tem só "Ver detalhes"', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela('preenchedor')

      expect(screen.queryByRole('button', { name: rotuloAcoesApontamento('Chamados resolvidos no prazo') })).not.toBeInTheDocument()
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Relatório mensal entregue'))).toEqual(['Ver detalhes'])
    })

    it('o apontamento vinculado a dashboard também pode ser desativado (qualquer apontamento, RF-21)', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela('validador')

      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Roteiro de visitas elaborado'))).toEqual(['Desativar'])
    })
  })

  describe('confirmação (RNF-07)', () => {
    it('escolher "Desativar" no menu de ações abre o diálogo "Desativar apontamento" com o impacto e os botões Desativar e Cancelar', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')

      const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_DESATIVAR)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeEnabled()
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(0)
    })

    it('escolher "Ativar" no menu de ações abre o diálogo "Ativar apontamento" com o impacto e o botão Ativar', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')

      const dialogo = screen.getByRole('dialog', { name: 'Ativar apontamento' })
      expect(within(dialogo).getByText(IMPACTO_ATIVAR)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Ativar' })).toBeEnabled()
    })

    it('Cancelar fecha o diálogo sem chamar a API e a situação não muda', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(0)
      expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Ativo')
      expect(screen.queryByText('Situação alterada.')).not.toBeInTheDocument()
    })

    it('Cancelar devolve o foco ao gatilho do menu de ações da linha', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: rotuloAcoesApontamento('Chamados resolvidos no prazo') })).toHaveFocus()
    })

    it('Esc fecha o diálogo sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(0)
    })
  })

  describe('alteração confirmada', () => {
    it('Desativar: PUT /{id}/situacao { ativo: false } com o token; botão desabilitado durante a chamada; sucesso → etiqueta "Inativo", notificação "Situação alterada." e o item do menu vira "Ativar"', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () =>
              resolve(
                respostaJson({
                  ...APONTAMENTO_CHAMADOS_API,
                  ativo: false,
                  'situacao alterada em': '2026-11-03 11:20:00',
                  'situacao alterada por': 'Fulano',
                }),
              )
          }),
      )
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
      await user.click(within(dialogo).getByRole('button', { name: 'Desativar' }))

      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeDisabled())
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
      expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-123')

      liberar()

      const notificacao = await screen.findByText('Situação alterada.')
      expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Inativo'))
      expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveClass('etiqueta--neutro')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      const itens = await itensDoMenuAcoes(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'))
      expect(itens).toContain('Ativar')
      expect(itens).not.toContain('Desativar')
    })

    it('após desativar, o menu da linha ganha "Ver detalhes", que mostra "Situação alterada em … por …" com os dados da resposta (RNF-01)', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'))).not.toContain('Ver detalhes')

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))
      await screen.findByText('Situação alterada.')

      await waitFor(() => expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Inativo'))
      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Ver detalhes')
      expect(screen.getByText('Situação alterada em 03/11/2026 11:20 por Fulano')).toBeInTheDocument()
    })

    it('Ativar: PUT { ativo: true }; sucesso → etiqueta "Ativo", notificação e o item do menu vira "Desativar"', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela('validador')

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Ativar apontamento' })).getByRole('button', { name: 'Ativar' }))

      await screen.findByText('Situação alterada.')
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/${APONTAMENTO_RELATORIO_API.id}/situacao`)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
      await waitFor(() => expect(etiquetaSituacao('Relatório mensal entregue')).toHaveTextContent('Ativo'))
      expect(etiquetaSituacao('Relatório mensal entregue')).toHaveClass('etiqueta--sucesso')
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Relatório mensal entregue'))).toContain('Desativar')
    })

    it('as demais linhas não mudam', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))
      await screen.findByText('Situação alterada.')

      expect(etiquetaSituacao('Roteiro de visitas elaborado')).toHaveTextContent('Ativo')
      expect(etiquetaSituacao('Horas de treinamento realizadas')).toHaveTextContent('Ativo')
      expect(etiquetaSituacao('Conciliação bancária concluída')).toHaveTextContent('Inativo')
    })

    it('Cancelar e Esc são ignorados enquanto a alteração está em andamento; clicar duas vezes gera um único PUT', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      const chamadas = simularApiComEstado(
        () =>
          new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson({ ...APONTAMENTO_CHAMADOS_API, ativo: false }))
          }),
      )
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
      const confirmar = within(dialogo).getByRole('button', { name: 'Desativar' })
      await user.click(confirmar)
      await user.click(confirmar)
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeDisabled())

      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
      expect(screen.getByRole('dialog', { name: 'Desativar apontamento' })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog', { name: 'Desativar apontamento' })).toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)

      liberar()
      await screen.findByText('Situação alterada.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('erros da API', () => {
    it('403: fecha o diálogo, mostra a mensagem da API em um Aviso de erro, mantém a situação e não notifica', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado(() => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'))
      await abrirTela('validador')

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Apenas Admin e Validador alteram a situação.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Ativo')
      expect(screen.queryByText('Situação alterada.')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
    })

    it('erro sem mensagem usa a mensagem padrão do status', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => respostaErro(500))
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    })

    it('falha de rede mostra a mensagem padrão de conexão', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => Promise.reject(new TypeError('Failed to fetch')))
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ativar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
      expect(etiquetaSituacao('Relatório mensal entregue')).toHaveTextContent('Inativo')
    })

    it('depois de um erro, uma alteração bem-sucedida remove o alerta e notifica', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      simularApiComEstado(() => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : undefined
      })
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária.')

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

      await screen.findByText('Situação alterada.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await waitFor(() => expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Inativo'))
    })
  })
  describe('item que deixa de corresponder ao filtro de situação (decisão de 04/11/2026)', () => {
    function opcaoSituacao(rotulo: string) {
      const opcao = within(screen.getByRole('listbox', { name: 'Situação' }))
        .getAllByRole('option')
        .find((item) => within(item).queryByText(rotulo) !== null)
      if (!opcao) throw new Error(`Opção "${rotulo}" não encontrada`)
      return opcao
    }

    function chipTipo(nome: string) {
      return within(screen.getByRole('group', { name: 'Tipo' }))
        .queryAllByRole('button')
        .find((botao) => within(botao).queryByText(nome) !== null)
    }

    async function filtrarPor(user: Usuario, rotulo: string, nomeEsperado: string) {
      await user.click(opcaoSituacao(rotulo))
      await waitFor(() => expect(opcaoSituacao(rotulo)).toHaveAttribute('aria-selected', 'true'))
      await screen.findByText(nomeEsperado)
      await waitFor(() => expect(screen.queryByText('Carregando apontamentos...')).not.toBeInTheDocument())
    }

    it('com "Ativos", desativar tira a linha da tabela na hora e o botão do tipo que zerou some', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()
      await filtrarPor(user, 'Ativos', 'Chamados resolvidos no prazo')
      expect(chipTipo('Tecnologia da Informação')).toBeDefined()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))

      await screen.findByText('Situação alterada.')
      expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument()
      expect(screen.getByText('Roteiro de visitas elaborado')).toBeInTheDocument()
      expect(screen.getByText('Horas de treinamento realizadas')).toBeInTheDocument()
      expect(chipTipo('Tecnologia da Informação')).toBeUndefined()
    })

    it('com "Inativos", ativar tira a linha da tabela e decrementa o botão do tipo', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()
      await filtrarPor(user, 'Inativos', 'Relatório mensal entregue')
      expect(within(chipTipo('Comercial')!).getByText('1')).toBeInTheDocument()

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Ativar apontamento' })).getByRole('button', { name: 'Ativar' }))

      await screen.findByText('Situação alterada.')
      expect(screen.queryByText('Relatório mensal entregue')).not.toBeInTheDocument()
      expect(screen.getByText('Conciliação bancária concluída')).toBeInTheDocument()
      expect(chipTipo('Comercial')).toBeUndefined()
    })

    it('com "Todas", a linha continua na tabela, só com a etiqueta trocada', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))

      await screen.findByText('Situação alterada.')
      await waitFor(() => expect(etiquetaSituacao('Chamados resolvidos no prazo')).toHaveTextContent('Inativo'))
      expect(within(chipTipo('Tecnologia da Informação')!).getByText('1')).toBeInTheDocument()
    })

    it('com "Ativos", uma falha na alteração mantém a linha e o botão do tipo', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'))
      await abrirTela()
      await filtrarPor(user, 'Ativos', 'Chamados resolvidos no prazo')

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))

      await screen.findByRole('alert')
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
      expect(chipTipo('Tecnologia da Informação')).toBeDefined()
    })
  })
})
