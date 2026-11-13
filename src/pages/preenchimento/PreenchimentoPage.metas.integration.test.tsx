import { screen, waitFor, within } from '@testing-library/react'
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
  type AcessoApiFalso,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import {
  MENSAGEM_400_SEM_META_FILIAL,
  MENSAGEM_403_META_INTEGRACAO,
  criarApiMetasFalsa,
  janelaMetasComFinanceiroApi,
} from '../../test/metasPreenchimentoFalsos'
import {
  historicoPeriodosApi,
  janelaMetasApi,
  mesesPreenchimentoApi,
  periodoApi,
  telaPreenchimentoApi,
  type JanelaMetasApiFalsa,
} from '../../test/preenchimentoFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA_METAS = '/api/ped/metas'

/**
 * "Editar metas" na aba Preenchimento (F9.9 — RF-71, RF-72, RF-73, RN-07; contrato em
 * `docs/backend/API (28).md`, "Metas no preenchimento").
 *
 * Com a filial e o mês da tela (padrão: o mês aberto, de `GET /api/ped/preenchimento`), a página consulta
 * `GET /api/ped/metas?filial=&mes_de_referencia=AAAA-MM` e mostra na área de ações o botão
 * "Editar metas (N)", N = indicadores da janela (some com N = 0). O botão abre o diálogo "Editar metas";
 * "Salvar metas" envia o lote num único `PUT /api/ped/metas`; sucesso → notificação "Metas ajustadas.",
 * fecha o diálogo e recarrega a janela; `400`/`403` mantêm o diálogo aberto com a mensagem da API e os
 * erros por item (`errosDoAjusteMetas`) na linha. Indicador da fonte `integracao` não vem no `GET` e o
 * ajuste dele devolve `403` (só a mensagem). Filial sem meta → `400` ("não tem meta cadastrada para a
 * filial").
 *
 * Fixtures: `preenchimentoFalsos.ts` (tela, meses, período e `janelaMetasApi`: 12 "Cobertura de
 * clientes" ajustada e 13 "Faturamento") e `metasPreenchimentoFalsos.ts` (API falsa das metas).
 */
describe('F9.9 — Editar metas no Preenchimento (integração: /preenchimento)', () => {
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

  interface OpcoesSessao {
    acesso?: AcessoApiFalso
    janela?: JanelaMetasApiFalsa
    respostaPut?: Parameters<typeof criarApiMetasFalsa>[1]
    rotasExtras?: Record<string, RotaFalsa>
  }

  /** Preenchedor da filial 101 (padrão de `acessoApi`), com a tela de outubro/2026 aberta. */
  function simularSessao({ acesso = acessoApi(), janela = janelaMetasApi(), respostaPut, rotasExtras = {} }: OpcoesSessao = {}) {
    const api = criarApiMetasFalsa(janela, respostaPut)
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      'GET /api/ped/periodo': () => respostaJson(periodoApi()),
      'GET /api/ped/periodo/historico': () => respostaJson(historicoPeriodosApi()),
      'GET /api/ped/preenchimento/meses': () => respostaJson(mesesPreenchimentoApi()),
      'GET /api/ped/preenchimento': (_init, url) => {
        const filial = url.searchParams.get('filial') ?? '101'
        const nome = FILIAIS_API.find((f) => f.filial === filial)?.['nome filial'] ?? null
        return respostaJson(telaPreenchimentoApi({ filial, 'nome filial': nome }))
      },
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const getsMetas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_METAS)
  const putsMetas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT' && c.caminho === ROTA_METAS)
  const dialogo = () => screen.getByRole('dialog', { name: 'Editar metas' })
  const tabela = () => within(dialogo()).getByRole('table', { name: 'Metas dos indicadores' })
  const titulos = () => within(tabela()).getAllByRole('columnheader').map((c) => c.textContent ?? '')
  function linha(nome: string): HTMLElement {
    const encontrada = within(tabela())
      .getAllByRole('row')
      .slice(1)
      .find((l) => within(l).getAllByRole('cell')[0]?.textContent?.startsWith(nome))
    if (!encontrada) throw new Error(`Linha não encontrada: ${nome}`)
    return encontrada
  }
  const celula = (nome: string, coluna: string) => within(linha(nome)).getAllByRole('cell')[titulos().indexOf(coluna)]
  const novaMeta = (nome: string) => within(dialogo()).getByRole('textbox', { name: `Nova meta de ${nome}` })
  const motivo = (nome: string) => within(dialogo()).getByRole('textbox', { name: `Motivo do ajuste de ${nome}` })
  function valor(rotulo: string): string | null {
    const termo = within(dialogo()).queryByText(rotulo, { selector: 'dt' })
    return termo?.nextElementSibling?.textContent ?? null
  }

  async function abrirTela(quantidade = 2) {
    renderizarApp('/preenchimento')
    return await screen.findByRole('button', { name: `Editar metas (${quantidade})` })
  }

  async function abrirJanela(user: Usuario, quantidade = 2) {
    await user.click(await abrirTela(quantidade))
    return dialogo()
  }

  async function ajustar(user: Usuario, nome: string, meta: string, textoMotivo: string) {
    await user.type(novaMeta(nome), meta)
    await colar(user, motivo(nome), textoMotivo)
  }

  describe('botão "Editar metas (N)" (RF-71)', () => {
    it('com a filial e o mês aberto, consulta GET /api/ped/metas com filial e mes_de_referencia e mostra "Editar metas (2)"', async () => {
      const { chamadas } = simularSessao()

      await abrirTela()

      expect(getsMetas(chamadas)).toHaveLength(1)
      const parametros = getsMetas(chamadas)[0].url.searchParams
      expect(parametros.get('filial')).toBe('101')
      expect(parametros.get('mes_de_referencia')).toBe('2026-10')
      expect(cabecalhoDaChamada(getsMetas(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    })

    it('a contagem acompanha a quantidade de indicadores da janela', async () => {
      simularSessao({ janela: janelaMetasComFinanceiroApi() })

      expect(await abrirTela(3)).toBeInTheDocument()
    })

    it('sem indicadores na janela, o botão não aparece', async () => {
      const { chamadas } = simularSessao({ janela: janelaMetasApi({ indicadores: [] }) })
      renderizarApp('/preenchimento')

      await waitFor(() => expect(getsMetas(chamadas)).toHaveLength(1))
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(screen.queryByRole('button', { name: /^Editar metas/ })).not.toBeInTheDocument()
    })

    it('falha no GET /api/ped/metas não derruba a tela: o botão só não aparece', async () => {
      const { chamadas } = simularSessao({ rotasExtras: { [`GET ${ROTA_METAS}`]: () => respostaErro(500) } })
      renderizarApp('/preenchimento')

      await waitFor(() => expect(getsMetas(chamadas)).toHaveLength(1))
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(screen.queryByRole('button', { name: /^Editar metas/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('Admin: ao escolher a filial no cabeçalho, consulta as metas daquela filial', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao({ acesso: acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API }) })
      renderizarApp('/preenchimento')

      const filial = await within(await screen.findByRole('banner')).findByRole('combobox', { name: 'Filial' })
      await user.selectOptions(filial, '102')

      expect(await screen.findByRole('button', { name: 'Editar metas (2)' })).toBeInTheDocument()
      expect(getsMetas(chamadas).at(-1)!.url.searchParams.get('filial')).toBe('102')
      expect(getsMetas(chamadas).every((c) => c.url.searchParams.get('filial') !== 'todas')).toBe(true)
    })
  })

  describe('janela (RF-72)', () => {
    it('abre "Editar metas" com filial, mês, situação e os indicadores com meta do cadastro × vigente e "Ajustada"', async () => {
      const user = usuarioRapido()
      simularSessao()

      await abrirJanela(user)

      expect(valor('Filial')).toBe('101 - CAMPO GRANDE')
      expect(valor('Mês')).toBe('10/2026')
      expect(valor('Situação')).toBe('Aberto')
      expect(celula('Cobertura de clientes', 'Tipos')).toHaveTextContent('Comercial')
      expect(celula('Cobertura de clientes', 'Composição')).toHaveTextContent('Visitas a clientes')
      expect(celula('Cobertura de clientes', 'Meta do cadastro')).toHaveTextContent('1.500,00')
      expect(celula('Cobertura de clientes', 'Meta do cadastro')).toHaveTextContent('Meta geral')
      expect(celula('Cobertura de clientes', 'Meta vigente')).toHaveTextContent('2.000,25')
      expect(within(celula('Cobertura de clientes', 'Indicador')).getByText('Ajustada')).toBeInTheDocument()
      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('500.000,00')
      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('Meta da filial')
      expect(within(celula('Faturamento', 'Indicador')).queryByText('Ajustada')).not.toBeInTheDocument()
    })

    it('filtro "Tipo" mostra só os indicadores do tipo escolhido', async () => {
      const user = usuarioRapido()
      simularSessao({ janela: janelaMetasComFinanceiroApi() })
      await abrirJanela(user, 3)

      const filtro = within(dialogo()).getByRole('combobox', { name: 'Tipo' })
      await user.selectOptions(filtro, within(filtro).getByRole('option', { name: 'Financeiro' }))

      expect(within(tabela()).getAllByRole('row').slice(1)).toHaveLength(1)
      expect(linha('Inadimplência')).toBeInTheDocument()
    })

    it('mês não editável: somente consulta, sem campos nem "Salvar metas"', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao({ janela: janelaMetasApi({ 'situacao do mes': 'aberto', editavel: false }) })
      await abrirJanela(user)

      expect(within(dialogo()).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Salvar metas' })).not.toBeInTheDocument()
      expect(within(dialogo()).getByText('Somente consulta: o ajuste de meta só é permitido no mês aberto.')).toBeInTheDocument()
      expect(putsMetas(chamadas)).toHaveLength(0)
    })
  })

  describe('ajuste (RF-73, RN-07)', () => {
    it('envia o lote num único PUT, notifica "Metas ajustadas.", fecha a janela e recarrega as metas', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520.000,50', 'reforma da loja')
      await ajustar(user, 'Cobertura de clientes', '1800', 'sazonalidade')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      const notificacao = await screen.findByText('Metas ajustadas.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Editar metas' })).not.toBeInTheDocument()
      expect(putsMetas(chamadas)).toHaveLength(1)
      expect(cabecalhoDaChamada(putsMetas(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(corpoDaChamada(putsMetas(chamadas)[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [
          { 'id indicador': 12, meta: 1800, motivo: 'sazonalidade' },
          { 'id indicador': 13, meta: 520000.5, motivo: 'reforma da loja' },
        ],
      })
      await waitFor(() => expect(getsMetas(chamadas)).toHaveLength(2))
    })

    it('depois da recarga, a janela mostra a nova meta vigente e a etiqueta "Ajustada"', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520.000,50', 'reforma da loja')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))
      await screen.findByText('Metas ajustadas.')
      await waitFor(() => expect(getsMetas(chamadas)).toHaveLength(2))

      await user.click(await screen.findByRole('button', { name: 'Editar metas (2)' }))

      await waitFor(() => expect(celula('Faturamento', 'Meta vigente')).toHaveTextContent('520.000,50'))
      expect(within(celula('Faturamento', 'Indicador')).getByText('Ajustada')).toBeInTheDocument()
      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('500.000,00')
      expect(novaMeta('Faturamento')).toHaveValue('')
    })

    it('validação no front: meta igual à vigente e motivo vazio não chamam a API', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '500000', 'sem mudança')
      await user.type(novaMeta('Cobertura de clientes'), '1900')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      expect(novaMeta('Faturamento')).toHaveAccessibleDescription('A nova meta deve ser diferente da meta vigente.')
      expect(motivo('Cobertura de clientes')).toHaveAccessibleDescription('Informe o motivo do ajuste.')
      expect(putsMetas(chamadas)).toHaveLength(0)
      expect(dialogo()).toBeInTheDocument()
    })

    it('"Salvar metas" sem nenhuma linha mostra "Informe a nova meta de ao menos um indicador." e não chama a API', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirJanela(user)

      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      expect(within(dialogo()).getByText('Informe a nova meta de ao menos um indicador.')).toBeInTheDocument()
      expect(putsMetas(chamadas)).toHaveLength(0)
    })

    it('"Cancelar" fecha sem chamar a API', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '600000', 'teste')
      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog', { name: 'Editar metas' })).not.toBeInTheDocument()
      expect(putsMetas(chamadas)).toHaveLength(0)
      expect(screen.getByRole('button', { name: 'Editar metas (2)' })).toBeInTheDocument()
    })
  })

  describe('erros do ajuste', () => {
    it('403 (meta pela integração ou tipo sem acesso): a janela continua aberta com a mensagem da API, sem notificação', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao({ respostaPut: () => respostaErro(403, MENSAGEM_403_META_INTEGRACAO) })
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520000', 'reforma da loja')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_403_META_INTEGRACAO)
      expect(putsMetas(chamadas)).toHaveLength(1)
      expect(screen.queryByText('Metas ajustadas.')).not.toBeInTheDocument()
      expect(novaMeta('Faturamento')).toHaveValue('520000')
      expect(motivo('Faturamento')).toHaveValue('reforma da loja')
      expect(getsMetas(chamadas)).toHaveLength(1)
    })

    it('403 sem mensagem mostra a mensagem padrão de permissão', async () => {
      const user = usuarioRapido()
      simularSessao({ respostaPut: () => respostaErro(403) })
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520000', 'reforma da loja')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.')
    })

    it('400 de filial sem meta: mensagem no alerta e o erro do item na linha do indicador', async () => {
      const user = usuarioRapido()
      simularSessao({
        respostaPut: () =>
          respostaJson({ mensagem: MENSAGEM_400_SEM_META_FILIAL, erros: [{ 'id indicador': 13, mensagem: MENSAGEM_400_SEM_META_FILIAL }] }, 400),
      })
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520000', 'reforma da loja')
      await ajustar(user, 'Cobertura de clientes', '1800', 'sazonalidade')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_400_SEM_META_FILIAL)
      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Faturamento')).toHaveAccessibleDescription(MENSAGEM_400_SEM_META_FILIAL)
      expect(novaMeta('Cobertura de clientes')).not.toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText('Metas ajustadas.')).not.toBeInTheDocument()
    })

    it('depois de um erro, corrigir e salvar de novo envia e conclui', async () => {
      const user = usuarioRapido()
      let falhar = true
      const { chamadas } = simularSessao({
        respostaPut: () => (falhar ? respostaErro(400, 'a nova meta deve ser diferente da vigente') : respostaJson({ mensagem: 'metas ajustadas', ajustadas: 1 })),
      })
      await abrirJanela(user)

      await ajustar(user, 'Faturamento', '520000', 'reforma da loja')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))
      await within(dialogo()).findByRole('alert')

      falhar = false
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar metas' }))

      await screen.findByText('Metas ajustadas.')
      expect(putsMetas(chamadas)).toHaveLength(2)
      expect(screen.queryByRole('dialog', { name: 'Editar metas' })).not.toBeInTheDocument()
    })
  })
})
