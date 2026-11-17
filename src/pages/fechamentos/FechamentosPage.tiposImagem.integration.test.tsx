import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { criarApiFechamentosFalsa } from '../../test/fechamentosFalsos'
import { escolherAcao } from '../../test/menuAcoes'
import { ITEM_ENCERRAR, ITEM_PRE_VISUALIZAR, rotuloAcoesFechamento } from '../../test/previaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

/**
 * Imagens de filial e de colaborador na prévia e na confirmação (F10.7 — RF-50, RF-80, RF-81, RF-82),
 * pela regra do back-end (A-07, `docs/backend/API (28).md`, "fase 7"): dashboard por **filiais** gera uma
 * imagem **de filial** por filial (`tipo: "filial"`); por **cargos** ou **colaboradores**, uma imagem por
 * colaborador (`tipo: "colaborador"`), na filial do colaborador.
 *
 * Fora de escopo de propósito: a regra do documento de requisitos para o vínculo por filiais (uma imagem
 * por colaborador **mais** a imagem "Filial (sem colaborador vinculado)"), cuja divergência com o back-end
 * continua em aberto (ver *Dúvidas em aberto* do plano). Aqui se verifica só que o front segue o que a API
 * devolve: no vínculo por filiais, exatamente uma opção (imagem de filial) por filial na lista pesquisável
 * "Imagem" (F1.20; alteração de 17/11/2026, no lugar das linhas da tabela "Imagens da filial {código}" e do
 * campo "Buscar colaborador ou cargo" fora do dropdown, que deixaram de existir; o gatilho é um botão não
 * editável e a busca fica dentro do dropdown aberto), sem opções de colaborador. O rótulo do colaborador dentro da `VisualizacaoImagem` é da F10.3. O tipo nas imagens da
 * consulta retroativa é coberto pelos testes da F10.6.
 *
 * Sessão: Admin com todas as filiais; back-end falso `criarApiFechamentosFalsa`.
 */
describe('F10.7 — Imagens de filial e de colaborador (integração: /fechamentos)', () => {
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
    const api = criarApiFechamentosFalsa()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  async function abrirTela() {
    renderizarApp('/fechamentos')
    await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })
  }

  async function abrirPrevia(user: Usuario, nome: string, titulo: string) {
    await escolherAcao(user, rotuloAcoesFechamento(nome), ITEM_PRE_VISUALIZAR)
    const dialogo = await screen.findByRole('dialog', { name: titulo })
    await within(dialogo).findByRole('combobox', { name: 'Filial' })
    return dialogo
  }

  async function abrirConfirmacao(user: Usuario, nome: string, titulo: string) {
    await escolherAcao(user, rotuloAcoesFechamento(nome), ITEM_ENCERRAR)
    const dialogo = await screen.findByRole('dialog', { name: titulo })
    await within(dialogo).findByRole('list', { name: 'Imagens por filial' })
    return dialogo
  }

  /**
   * Abre a lista pesquisável "Imagem" da filial exibida e devolve o texto das opções (rótulo — colaborador ou
   * "Imagem da filial" — e descrição, que traz o cargo nas imagens de colaborador); fecha a lista com Esc.
   */
  async function opcoesDaFilial(user: Usuario, dialogo: HTMLElement) {
    await user.click(within(dialogo).getByRole('combobox', { name: 'Imagem' }))
    const textos = within(within(dialogo).getByRole('listbox'))
      .getAllByRole('option')
      .map((opcao) => opcao.textContent ?? '')
    await user.keyboard('{Escape}')
    return textos
  }

  describe('dashboard por filiais (PED Comercial): imagens de filial', () => {
    it('na prévia, cada filial tem uma única imagem da filial na lista "Imagem", sem colaborador', async () => {
      const user = usuarioRapido()
      simularSessao()
      await abrirTela()

      const dialogo = await abrirPrevia(user, 'PED Comercial', 'Pré-visualização — PED Comercial · 4º tri/2026')

      const da101 = await opcoesDaFilial(user, dialogo)
      expect(da101).toHaveLength(1)
      expect(da101[0]).toContain('Imagem da filial')
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '102')
      const da102 = await opcoesDaFilial(user, dialogo)
      expect(da102).toHaveLength(1)
      expect(da102[0]).toContain('Imagem da filial')
      expect(within(dialogo).getByRole('combobox', { name: 'Imagem' })).toHaveTextContent('Imagem da filial')
      expect(within(dialogo).queryByRole('searchbox', { name: 'Buscar colaborador ou cargo' })).not.toBeInTheDocument()
    })

    it('na confirmação, as imagens são contadas "uma por filial"', async () => {
      const user = usuarioRapido()
      simularSessao()
      await abrirTela()

      const dialogo = await abrirConfirmacao(user, 'PED Comercial', 'Encerrar PED Comercial — 4º tri/2026')

      expect(within(dialogo).getByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
    })
  })

  describe('dashboard por cargos (PED Gerentes): uma imagem por colaborador, na filial dele', () => {
    it('na prévia, cada colaborador aparece com o cargo na filial dele, na lista pesquisável "Imagem"', async () => {
      const user = usuarioRapido()
      simularSessao()
      await abrirTela()

      const dialogo = await abrirPrevia(user, 'PED Gerentes', 'Pré-visualização — PED Gerentes · 11/2026')

      const opcoes = within(within(dialogo).getByRole('combobox', { name: 'Filial' }))
        .getAllByRole('option')
        .map((opcao) => opcao.textContent)
      expect(opcoes).toEqual([
        'Filial 100 - MATRIZ · 1 imagem · lançamentos pendentes',
        'Filial 102 - DOURADOS · 1 imagem · lançamentos pendentes · sem tabela de faixas',
      ])
      const da100 = await opcoesDaFilial(user, dialogo)
      expect(da100).toHaveLength(1)
      expect(da100[0]).toContain('Ana Souza')
      expect(da100[0]).toContain('Gerente de Loja')
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '102')
      const da102 = await opcoesDaFilial(user, dialogo)
      expect(da102).toHaveLength(1)
      expect(da102[0]).toContain('Diego Rocha')
      expect(da102[0]).toContain('Gerente de Loja')
      expect(within(dialogo).getByRole('combobox', { name: 'Imagem' })).toHaveTextContent('Diego Rocha')
      expect([...da100, ...da102].some((texto) => texto.includes('Imagem da filial'))).toBe(false)
      expect(within(dialogo).queryByText('Imagem da filial')).not.toBeInTheDocument()
    })

    it('na confirmação, as imagens são contadas "uma por colaborador", agrupadas pela filial do colaborador', async () => {
      const user = usuarioRapido()
      simularSessao()
      await abrirTela()

      const dialogo = await abrirConfirmacao(user, 'PED Gerentes', 'Encerrar PED Gerentes — 11/2026')

      expect(within(dialogo).getByText('Total de imagens a gerar: 2 (uma por colaborador)')).toBeInTheDocument()
      const itens = within(within(dialogo).getByRole('list', { name: 'Imagens por filial' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent?.trim())
      expect(itens).toEqual(['Filial 100 - MATRIZ: 1 imagem', 'Filial 102 - DOURADOS: 1 imagem'])
    })

    it('ao encerrar, as imagens gravadas são de colaborador, uma por colaborador', async () => {
      const user = usuarioRapido()
      const { api } = simularSessao()
      await abrirTela()
      const dialogo = await abrirConfirmacao(user, 'PED Gerentes', 'Encerrar PED Gerentes — 11/2026')

      await user.click(within(dialogo).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

      expect(await screen.findByText('Período 11/2026 encerrado. Lote ENC-000003: 2 imagens geradas.')).toBeInTheDocument()
      const novas = api.imagens().filter((imagem) => imagem.lote === 'ENC-000003')
      expect(novas.map((imagem) => [imagem.tipo, imagem['id colaborador']])).toEqual([
        ['colaborador', 11],
        ['colaborador', 14],
      ])
    })
  })
})
