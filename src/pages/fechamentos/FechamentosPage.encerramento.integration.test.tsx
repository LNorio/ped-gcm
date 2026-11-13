import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import {
  MENSAGEM_DASHBOARD_NAO_ATIVO,
  MENSAGEM_TODAS_ENCERRADAS,
  criarApiFechamentosFalsa,
} from '../../test/fechamentosFalsos'
import { escolherAcao } from '../../test/menuAcoes'
import { ITEM_ENCERRAR, ITEM_PRE_VISUALIZAR, rotuloAcoesFechamento } from '../../test/previaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const TITULO_CONFIRMACAO = 'Encerrar PED Comercial — 4º tri/2026'
const TITULO_PREVIA = 'Pré-visualização — PED Comercial · 4º tri/2026'
const NOTIFICACAO_SUCESSO = 'Período 4º tri/2026 encerrado. Lote ENC-000003: 2 imagens geradas.'

/**
 * Encerramento manual com confirmação na aba Fechamentos (F10.5 — RF-77, RF-81, RF-82, RNF-07). Fluxo
 * completo: página (F10.2) + `MenuAcoes` + `DialogoEncerrarFechamento` (e `DialogoPreviaFechamento`) +
 * serviço (`obterPreviaFechamento`, `encerrarFechamento`), só a rede simulada
 * (`criarApiFechamentosFalsa`: o encerramento grava as imagens `IMG-` no lote `ENC-000003`, marca o
 * período como encerrado e não muda os outros dashboards).
 *
 * - "Encerrar período" (menu da linha) abre "Encerrar {nome} — {período}", que consulta a prévia para
 *   montar a confirmação; "Encerrar e gerar {N} imagens" na prévia abre a mesma confirmação com o resumo
 *   já carregado.
 * - Sucesso: os diálogos fecham, a notificação "Período {período} encerrado. Lote {ENC}: {N} imagens
 *   geradas." aparece e a lista é recarregada (`GET /api/ped/fechamentos`), com o período encerrado.
 * - Erro `400`: a mensagem da API aparece dentro do diálogo, que continua aberto.
 *
 * Sessão: Admin (ou Validador) com todas as filiais.
 */
describe('F10.5 — Encerramento manual com confirmação (integração: /fechamentos)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiFechamentosFalsa()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const getsLista = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/fechamentos')
  const getsPrevia = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/fechamentos/1/previa')
  const postsEncerrar = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'POST' && /^\/api\/ped\/fechamentos\/\d+\/encerrar$/.test(c.caminho))
  const linha = (nome: string) => screen.getByRole('button', { name: rotuloAcoesFechamento(nome) }).closest('tr')!
  const itensPorFilial = (elemento: HTMLElement) =>
    within(within(elemento).getByRole('list', { name: 'Imagens por filial' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim())

  async function abrirTela() {
    renderizarApp('/fechamentos')
    await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })
  }

  async function abrirConfirmacaoPeloMenu(user: Usuario) {
    await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_ENCERRAR)
    const confirmacao = await screen.findByRole('dialog', { name: TITULO_CONFIRMACAO })
    await within(confirmacao).findByText('Total de imagens a gerar: 2 (uma por filial)')
    return confirmacao
  }

  describe('confirmação (RF-81)', () => {
    it('pelo menu, consulta a prévia e mostra total, imagens por filial, outros dashboards, pendências e faixas', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      const confirmacao = await abrirConfirmacaoPeloMenu(user)

      expect(getsPrevia(chamadas)).toHaveLength(1)
      expect(itensPorFilial(confirmacao)).toEqual(['Filial 101 - CAMPO GRANDE: 1 imagem', 'Filial 102 - DOURADOS: 1 imagem'])
      expect(
        within(confirmacao).getByText('Os outros dashboards não são afetados: cada dashboard é encerrado individualmente.'),
      ).toBeInTheDocument()
      expect(
        within(confirmacao).getByText(
          'Filiais com lançamentos pendentes: 102. Se o período for encerrado agora, eles serão congelados sem valor.',
        ),
      ).toBeInTheDocument()
      expect(
        within(confirmacao).getByText('Filiais sem tabela de faixas: 102. As imagens dessas filiais ficarão sem pontuação.'),
      ).toBeInTheDocument()
      expect(postsEncerrar(chamadas)).toHaveLength(0)
    })

    it('"Cancelar" fecha a confirmação sem encerrar', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      const confirmacao = await abrirConfirmacaoPeloMenu(user)

      await user.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }))

      await waitFor(() => expect(screen.queryByRole('dialog', { name: TITULO_CONFIRMACAO })).not.toBeInTheDocument())
      expect(postsEncerrar(chamadas)).toHaveLength(0)
    })
  })

  describe('encerramento (RF-77, RF-82)', () => {
    it.each(['admin', 'validador'] as const)(
      'o %s encerra pelo menu: um POST, notificação com o lote ENC, lista recarregada e período encerrado',
      async (perfil) => {
        const user = usuarioRapido()
        const { chamadas, api } = simularSessao(perfil)
        await abrirTela()
        const listasAntes = getsLista(chamadas).length
        const confirmacao = await abrirConfirmacaoPeloMenu(user)

        await user.click(within(confirmacao).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

        expect(await screen.findByText(NOTIFICACAO_SUCESSO)).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(postsEncerrar(chamadas).map((c) => c.caminho)).toEqual(['/api/ped/fechamentos/1/encerrar'])
        await waitFor(() => expect(getsLista(chamadas).length).toBeGreaterThan(listasAntes))
        await waitFor(() => expect(within(linha('PED Comercial')).getByText('Encerrado')).toBeInTheDocument())
        expect(api.imagens().filter((imagem) => imagem.lote === 'ENC-000003')).toHaveLength(2)
      },
    )

    it('os outros dashboards não são afetados: o PED Gerentes continua em aberto após encerrar o PED Comercial', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      const confirmacao = await abrirConfirmacaoPeloMenu(user)

      await user.click(within(confirmacao).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))
      await screen.findByText(NOTIFICACAO_SUCESSO)
      await waitFor(() => expect(within(linha('PED Comercial')).getByText('Encerrado')).toBeInTheDocument())

      expect(within(linha('PED Gerentes')).getByText('Em aberto')).toBeInTheDocument()
      expect(postsEncerrar(chamadas)).toHaveLength(1)
    })

    it('a partir da prévia: confirma, encerra e fecha a prévia e a confirmação, sem consultar a prévia de novo', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)
      const previa = await screen.findByRole('dialog', { name: TITULO_PREVIA })

      await user.click(await within(previa).findByRole('button', { name: 'Encerrar e gerar 2 imagens' }))
      const confirmacao = await screen.findByRole('dialog', { name: TITULO_CONFIRMACAO })
      await user.click(within(confirmacao).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

      expect(await screen.findByText(NOTIFICACAO_SUCESSO)).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(getsPrevia(chamadas)).toHaveLength(1)
      expect(postsEncerrar(chamadas)).toHaveLength(1)
    })

    it('resposta 2xx sem corpo (204): o período é dado como encerrado, com a notificação sem lote', async () => {
      const user = usuarioRapido()
      simularSessao('admin', {
        'POST /api/ped/fechamentos/1/encerrar': () => new Response(null, { status: 204 }),
      })
      await abrirTela()
      const confirmacao = await abrirConfirmacaoPeloMenu(user)

      await user.click(within(confirmacao).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

      expect(await screen.findByText('Período 4º tri/2026 encerrado.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('erros 400 dentro do diálogo', () => {
    it.each([
      ['todas as unidades já encerradas', MENSAGEM_TODAS_ENCERRADAS],
      ['dashboard não ativo', MENSAGEM_DASHBOARD_NAO_ATIVO],
    ])('%s: a mensagem da API aparece na confirmação, que continua aberta', async (_caso, mensagem) => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao('admin', {
        'POST /api/ped/fechamentos/1/encerrar': () => respostaErro(400, mensagem),
      })
      await abrirTela()
      const confirmacao = await abrirConfirmacaoPeloMenu(user)

      await user.click(within(confirmacao).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

      expect(await within(confirmacao).findByRole('alert')).toHaveTextContent(mensagem)
      expect(screen.getByRole('dialog', { name: TITULO_CONFIRMACAO })).toBeInTheDocument()
      expect(postsEncerrar(chamadas)).toHaveLength(1)
      expect(screen.queryByText(/^Período 4º tri\/2026 encerrado/)).not.toBeInTheDocument()
    })
  })
})
