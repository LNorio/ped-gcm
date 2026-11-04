import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstadoCarga } from '../../components/EstadoCarga'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  filtrarApontamentosApi,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { ApontamentosPage } from './ApontamentosPage'

// Envolve o EstadoCarga real para verificar que a página o usa para carga e erro de carga.
vi.mock('../../components/EstadoCarga', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../components/EstadoCarga')>()
  return { ...real, EstadoCarga: vi.fn(real.EstadoCarga) }
})

const ROTA = '/api/ped/apontamentos'

describe('F4.2 — ApontamentosPage: EstadoCarga e lista durante reconsultas', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    vi.mocked(EstadoCarga).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  /** Props recebidas pelo EstadoCarga em cada render, na ordem. */
  const propsDoEstadoCarga = () => vi.mocked(EstadoCarga).mock.calls.map((chamada) => chamada[0])
  const ultimasPropsDoEstadoCarga = () => propsDoEstadoCarga().at(-1)

  function renderizar() {
    return render(
      <ProvedorSessaoFalso
        sessao={{ acesso: acessoFalso({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS }) }}
      >
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
  }

  function nomesListados() {
    return within(screen.getByRole('table', { name: 'Apontamentos' }))
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
      .map((linha) => {
        const celulaNome = within(linha).getAllByRole('cell')[0]
        return NOMES_APONTAMENTOS.find((nome) => within(celulaNome).queryByText(nome) !== null) ?? celulaNome.textContent
      })
  }

  function opcaoSituacao(rotulo: string) {
    const opcao = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((item) => within(item).queryByText(rotulo) !== null)
    if (!opcao) throw new Error(`Opção "${rotulo}" não encontrada`)
    return opcao
  }

  function chipTipo(nome: string) {
    const chip = within(screen.getByRole('group', { name: 'Tipo' }))
      .getAllByRole('button')
      .find((botao) => within(botao).queryByText(nome) !== null)
    if (!chip) throw new Error(`Chip de tipo "${nome}" não encontrado`)
    return chip
  }

  describe('EstadoCarga', () => {
    it('a página usa EstadoCarga com a mensagem "Carregando apontamentos..." e o estado da consulta', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: (_init, url) => respostaJson(filtrarApontamentosApi(apontamentosApi(), url)) })
      renderizar()

      expect(propsDoEstadoCarga()).toContainEqual(
        expect.objectContaining({ carregando: true, mensagemCarregando: 'Carregando apontamentos...', erro: null }),
      )
      await screen.findByRole('table', { name: 'Apontamentos' })
      expect(ultimasPropsDoEstadoCarga()).toEqual(
        expect.objectContaining({ carregando: false, mensagemCarregando: 'Carregando apontamentos...', erro: null }),
      )
    })

    it('com erro de carga, EstadoCarga recebe a mensagem e onTentarNovamente repete a consulta', async () => {
      const user = userEvent.setup()
      let tentativa = 0
      const chamadas = simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) => {
          tentativa += 1
          return tentativa === 1
            ? respostaErro(500, 'Falha ao consultar os apontamentos.')
            : respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
        },
      })
      renderizar()

      await screen.findByRole('alert')
      expect(ultimasPropsDoEstadoCarga()).toEqual(
        expect.objectContaining({ carregando: false, erro: 'Falha ao consultar os apontamentos.' }),
      )

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      await screen.findByRole('table', { name: 'Apontamentos' })
      expect(gets(chamadas)).toHaveLength(2)
    })
  })

  describe('reconsulta filtrada', () => {
    it('a tabela permanece visível com a lista anterior enquanto a consulta filtrada está em andamento', async () => {
      const user = userEvent.setup()
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) => {
          const corpo = filtrarApontamentosApi(apontamentosApi(), url)
          if (!url.searchParams.has('situacao')) return respostaJson(corpo)
          return new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(corpo))
          })
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      await user.click(opcaoSituacao('Inativos'))

      expect(await screen.findByText('Carregando apontamentos...')).toBeInTheDocument()
      expect(screen.getByRole('table', { name: 'Apontamentos' })).toBeInTheDocument()
      expect(nomesListados()).toEqual([...NOMES_APONTAMENTOS])

      liberar()
      await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída', 'Relatório mensal entregue']))
      expect(screen.queryByText('Carregando apontamentos...')).not.toBeInTheDocument()
    })

    it('exclusão concluída com o GET de um tipo pendente: ao final, a tabela mostra a lista do filtro novo (recarga automática)', async () => {
      const user = userEvent.setup()
      let lista: ApontamentoApiFalso[] = apontamentosApi()
      let liberar: () => void = () => {}
      let pendente = false
      const chamadas = simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) => {
          if (url.searchParams.get('tipo') === '1' && !pendente) {
            pendente = true
            const instantaneo = filtrarApontamentosApi(lista, url)
            return new Promise<Response>((resolve) => {
              liberar = () => resolve(respostaJson(instantaneo))
            })
          }
          return respostaJson(filtrarApontamentosApi(lista, url))
        },
        [`DELETE ${ROTA}/4`]: () => {
          lista = lista.filter((a) => a.id !== 4)
          return new Response(null, { status: 204 })
        },
      })
      renderizar()
      await screen.findByRole('table', { name: 'Apontamentos' })

      await user.click(chipTipo('Comercial'))
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))
      await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento' })).getByRole('button', { name: 'Excluir' }))
      await screen.findByText('Apontamento excluído.')

      liberar()

      await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
      expect(gets(chamadas)[2].url.searchParams.get('tipo')).toBe('1')
      await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado', 'Relatório mensal entregue']))
      expect(chipTipo('Comercial')).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
