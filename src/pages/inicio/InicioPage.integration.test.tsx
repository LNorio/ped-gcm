/**
 * F11.1 — Tela Início (integração: app completo com a rede simulada; RF-01, RF-06 a RF-11).
 *
 * A página Início (`src/pages/inicio/InicioPage.tsx`, rota `/`) mantém sempre o título `<h1>` "Início" e
 * consulta `GET /api/ped/inicio` (via `useInicio`/`obterInicio`) com a filial do cabeçalho: "Todas as
 * filiais" → sem `filial`; uma filial → `?filial={código}`. Trocar a filial consulta de novo. Durante a
 * carga, "Carregando o Início..." é anunciado (região de status); em erro, a mensagem aparece em
 * `role="alert"` com o botão "Tentar novamente", que consulta de novo.
 *
 * A rota é carregada sob demanda: os testes esperam a tela com `findBy*`/`waitFor` (timeout padrão do
 * projeto, `src/test/setup.ts`), sem depender de tempos curtos.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { MENSAGEM_FILIAL_INEXISTENTE, adiado, inicioAdminApi, rotasDoInicio } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/inicio'
const CARREGANDO = 'Carregando o Início...'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F11.1 — Tela Início (integração: GET /api/ped/inicio pela filial do cabeçalho)', () => {
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

  const getsInicio = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })

  async function abrirInicio() {
    renderizarApp('/')
    return await screen.findByRole('heading', { level: 1, name: 'Início' })
  }

  describe('Admin', () => {
    it('com "Todas as filiais": título "Início" e um único GET /api/ped/inicio sem filial, com o Bearer', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicio('admin'))

      await abrirInicio()

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
      await waitFor(() => expect(screen.queryByText(CARREGANDO)).not.toBeInTheDocument())
      expect(getsInicio(chamadas)).toHaveLength(1)
      expect(getsInicio(chamadas)[0].url.search).toBe('')
      expect(cabecalhoDaChamada(getsInicio(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('escolher a filial 101 no cabeçalho consulta de novo com ?filial=101; voltar a "Todas" consulta sem filial', async () => {
      const user = usuarioRapido()
      const chamadas = simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirInicio()
      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))

      await user.selectOptions(seletorFilial(), '101')

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
      expect([...getsInicio(chamadas)[1].url.searchParams.entries()]).toEqual([['filial', '101']])

      await user.selectOptions(seletorFilial(), 'todas')

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(3))
      expect(getsInicio(chamadas)[2].url.search).toBe('')
    })

    it('filial recusada pela API (404): mostra a mensagem da API e "Tentar novamente", mantendo o título', async () => {
      const user = usuarioRapido()
      const chamadas = simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirInicio()
      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))

      await user.selectOptions(seletorFilial(), '102')

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_FILIAL_INEXISTENTE)
      expect(getsInicio(chamadas).at(-1)!.url.searchParams.get('filial')).toBe('102')
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    })
  })

  describe('Validador', () => {
    it('com "Todas as filiais" (A-03): um GET /api/ped/inicio sem filial', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicio('validador'))

      await abrirInicio()

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
      expect(getsInicio(chamadas)[0].url.search).toBe('')
    })
  })

  describe('Preenchedor', () => {
    it('consulta com a própria filial do cabeçalho (?filial=101)', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicio('preenchedor'))

      await abrirInicio()

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
      expect([...getsInicio(chamadas)[0].url.searchParams.entries()]).toEqual([['filial', '101']])
    })
  })

  describe('carregamento e erros', () => {
    it('enquanto a API não responde, anuncia "Carregando o Início..."; ao responder, o anúncio some', async () => {
      const resposta = adiado<Response>()
      simularApi(fetchFalso, rotasDoInicio('admin', { [`GET ${ROTA}`]: () => resposta.promessa }))

      await abrirInicio()

      expect(await screen.findByText(CARREGANDO)).toBeInTheDocument()

      resposta.resolver(respostaJson(inicioAdminApi()))

      await waitFor(() => expect(screen.queryByText(CARREGANDO)).not.toBeInTheDocument())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('erro da API (500): mensagem em role="alert"; "Tentar novamente" consulta de novo e, no sucesso, o alerta some', async () => {
      const user = usuarioRapido()
      let tentativas = 0
      const chamadas = simularApi(
        fetchFalso,
        rotasDoInicio('admin', {
          [`GET ${ROTA}`]: () => {
            tentativas += 1
            return tentativas === 1 ? respostaErro(500, 'Falha ao montar o inicio.') : respostaJson(inicioAdminApi())
          },
        }),
      )
      await abrirInicio()

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao montar o inicio.')

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    })

    it('sem perfil no PED (403): mostra a mensagem da API', async () => {
      simularApi(fetchFalso, rotasDoInicio('validador', { [`GET ${ROTA}`]: () => respostaErro(403, 'Usuario sem acesso ao PED.') }))

      await abrirInicio()

      expect(await screen.findByRole('alert')).toHaveTextContent('Usuario sem acesso ao PED.')
    })

    it('sessão expirada (401): volta ao login com o aviso de sessão expirada', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin', { [`GET ${ROTA}`]: () => respostaErro(401) }))

      await abrirInicio()

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
      expect(obterToken()).toBeNull()
    })
  })
})
