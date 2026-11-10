import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import {
  dadosExternosApi,
  identificadoresApi,
  rotaListarDadosExternos,
  variaveisIntegracaoApi,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import {
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  META_VIA_API_COMPLETA,
  URL_INTEGRACAO_DADO_FATURAMENTO,
  indicadoresComFonteDaMetaApi,
  integracaoMetaPendenteApi,
  respostaIndicadorApi,
  rotaListarIndicadoresComFonteDaMeta,
  tarefaMetaApi,
  type IndicadorApiFalso,
  type MetaViaApiDisponivelApiFalsa,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

/**
 * F6.11 — Fonte da meta, situação, tarefa e integração do dado externo (integração: /indicadores com a
 * aplicação completa; só a rede é simulada). Contrato final: `RESPOSTA-FINAL-meta-via-api.md` e
 * `CONFIRMACAO-FRONT-meta-via-api.md` (10/11/2026).
 *
 * - Cadastro e "Definir meta" com "Buscar metas via API": `"fonte da meta"` `dado_externo` (dado com
 *   `fornece meta: true` e "Meta vinda do dado externo" marcado, o padrão) ou `integracao`.
 * - Cadastro da fonte `integracao` pelo Validador: "Indicador cadastrado. " + a frase da tarefa do Bitrix
 *   (`fraseTarefaGravada`); Admin (e a fonte `dado_externo`): "Indicador cadastrado.".
 * - `"meta via api".integracao === false` (fase 1): aviso "A consulta desta fonte ainda não está
 *   disponível. ..." na fonte `integracao`, sem bloquear o envio.
 * - 400 do back-end: a mensagem aparece no alerta do diálogo.
 * - Filtro "Integração pendente (TI)" só para o Admin (`situacao=integracao_pendente`).
 * - Admin, fonte `dado_externo`: "Ver integração do dado externo" abre a modal da integração em modo
 *   leitura ("Integração do dado externo", só "Fechar"), sem gravar nada.
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_DADOS_EXTERNOS = '/api/ped/dados-externos-cadastro'
const BUSCAR_VIA_API = 'Buscar metas via API'
const META_DO_DADO = 'Meta vinda do dado externo'
const AVISO =
  'A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá ser configurada; a meta chegará quando a consulta for liberada.'

type DadoComFornecimento = DadoExternoApiFalso & { 'fornece meta': boolean }

describe('F6.11 — Fonte da meta via API (integração: /indicadores)', () => {
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

  interface Opcoes {
    perfil?: 'admin' | 'validador'
    /** `"meta via api"` do topo da listagem (padrão: fase 1, integracao false). */
    metaViaApi?: MetaViaApiDisponivelApiFalsa
    /** Ids dos dados externos com `fornece meta: true` (padrão: Faturamento líquido 1 e Volume de vendas 6). */
    fornecemMeta?: number[]
    /** `"id bitrix"` da tarefa devolvida no POST da fonte integracao pelo Validador (padrão 4600). */
    idTarefa?: number | null
    aoCriar?: () => Response
  }

  function simular(opcoes: Opcoes = {}) {
    const perfil = opcoes.perfil ?? 'admin'
    const fornecem = new Set(opcoes.fornecemMeta ?? [1, 6])
    const idTarefa = opcoes.idTarefa === undefined ? 4600 : opcoes.idTarefa
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    const dados = (): DadoComFornecimento[] => dadosExternosApi().map((dado) => ({ ...dado, 'fornece meta': fornecem.has(dado.id) }))
    let lista = indicadoresComFonteDaMetaApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComFonteDaMeta(() => lista, opcoes.metaViaApi),
      'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
      [`GET ${ROTA_DADOS_EXTERNOS}`]: rotaListarDadosExternos(dados),
      [`GET ${ROTA_DADOS_EXTERNOS}/identificadores`]: () => respostaJson(identificadoresApi()),
      'GET /api/ped/integracao/variaveis': () => respostaJson(variaveisIntegracaoApi()),
      [`POST ${ROTA}`]: (init) => {
        if (opcoes.aoCriar) return opcoes.aoCriar()
        const corpo = JSON.parse(String(init?.body)) as { nome: string; 'fonte da meta'?: string }
        const base = corpo['fonte da meta'] === 'dado_externo' ? INDICADOR_META_DADO_EXTERNO_API : INDICADOR_META_API_PENDENTE_API
        const tarefa =
          corpo['fonte da meta'] === 'integracao' && perfil === 'validador'
            ? tarefaMetaApi(`[PED] Integração da meta: ${corpo.nome}`, idTarefa)
            : null
        const criado: IndicadorApiFalso = { ...base, id: 30, nome: corpo.nome, tarefa }
        lista = [...lista, criado]
        return respostaJson(respostaIndicadorApi(criado), 201)
      },
      [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as { 'fonte da meta'?: 'dado_externo' | 'integracao' }
        const fonte = corpo['fonte da meta'] ?? 'integracao'
        const atualizado: IndicadorApiFalso = {
          ...INDICADOR_DEVOLUCOES_API,
          sentido: 'maior_melhor',
          'sentido descricao': 'Maior é melhor',
          'meta a definir': false,
          'origem da meta': 'terceiro',
          ...integracaoMetaPendenteApi(),
          'integracao pendente': fonte === 'integracao',
          'fonte da meta': fonte,
          'situacao da meta via api': fonte === 'integracao' ? 'integracao_pendente' : 'ok',
        }
        lista = lista.map((i) => (i.id === INDICADOR_DEVOLUCOES_API.id ? atualizado : i))
        return respostaJson(respostaIndicadorApi(atualizado))
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!

  async function abrirTela() {
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Atingimento de faturamento')
    const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
    return dialogo
  }

  async function escolherDado(user: Usuario, dialogo: HTMLElement, nome: string) {
    const grupo = within(dialogo).getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupo).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupo).getByRole('listbox', { name: 'Dados externos' })
    await user.click(await within(lista).findByRole('option', { name: (rotulo) => rotulo.startsWith(nome) }))
  }

  async function escolherApontamento(user: Usuario, dialogo: HTMLElement) {
    const grupo = within(dialogo).getByRole('group', { name: 'Apontamentos' })
    await user.click(within(grupo).getByRole('button', { name: 'Selecionar apontamento' }))
    const lista = within(grupo).getByRole('listbox', { name: 'Apontamentos' })
    await user.click(await within(lista).findByRole('option', { name: (rotulo) => rotulo.startsWith('Roteiro de visitas elaborado') }))
    await user.click(within(grupo).getByRole('button', { name: 'Selecionar apontamento' }))
    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Cálculo do realizado' }), 'Soma')
  }

  /** Cadastro com "Buscar metas via API" e o dado Faturamento líquido; `fonte` define o "Meta vinda do dado externo". */
  async function cadastrarComFaturamento(user: Usuario, fonte: 'dado_externo' | 'integracao') {
    const dialogo = await abrirCadastro(user)
    await escolherDado(user, dialogo, 'Faturamento líquido')
    await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))
    const flag = within(dialogo).getByRole('checkbox', { name: META_DO_DADO })
    expect(flag).toBeChecked()
    if (fonte === 'integracao') await user.click(flag)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
    return dialogo
  }

  describe('cadastro', () => {
    it('Admin, fonte dado_externo: POST com "fonte da meta" dado_externo; "Indicador cadastrado." e a linha com "Via API", sem etiqueta de pendência', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      await cadastrarComFaturamento(user, 'dado_externo')

      expect(await screen.findByText('Indicador cadastrado.')).toBeInTheDocument()
      expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
        nome: 'Atingimento de faturamento',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'dado_externo',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
      const criado = (await within(tabela()).findByText('Atingimento de faturamento')).closest('tr')!
      expect(within(criado).getByText('Via API')).toBeInTheDocument()
      expect(within(criado).queryByText('Integração pendente (TI)')).not.toBeInTheDocument()
    })

    it('Validador, fonte integracao: "Indicador cadastrado. Tarefa #4600 criada no Bitrix para a equipe de TI." e a linha com a etiqueta e "#4600"', async () => {
      const user = usuarioRapido()
      const chamadas = simular({ perfil: 'validador' })
      await abrirTela()

      await cadastrarComFaturamento(user, 'integracao')

      expect(await screen.findByText('Indicador cadastrado. Tarefa #4600 criada no Bitrix para a equipe de TI.')).toBeInTheDocument()
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', 'meta editavel': false })
      const criado = (await within(tabela()).findByText('Atingimento de faturamento')).closest('tr')!
      expect(within(criado).getByText('Integração pendente (TI)')).toBeInTheDocument()
      expect(within(criado).getByText('#4600')).toBeInTheDocument()
    })

    it('Validador, fonte integracao com a tarefa ainda na fila: "Indicador cadastrado. A tarefa para a TI será criada no Bitrix em instantes."', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador', idTarefa: null })
      await abrirTela()

      await cadastrarComFaturamento(user, 'integracao')

      expect(await screen.findByText('Indicador cadastrado. A tarefa para a TI será criada no Bitrix em instantes.')).toBeInTheDocument()
    })

    it('Admin, fonte integracao: "Indicador cadastrado." (o Admin não gera tarefa)', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      await cadastrarComFaturamento(user, 'integracao')

      expect(await screen.findByText('Indicador cadastrado.')).toBeInTheDocument()
      expect(screen.queryByText(/criada no Bitrix/)).not.toBeInTheDocument()
    })

    it('Validador, fonte dado_externo: "Indicador cadastrado." (sem tarefa)', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador' })
      await abrirTela()

      await cadastrarComFaturamento(user, 'dado_externo')

      expect(await screen.findByText('Indicador cadastrado.')).toBeInTheDocument()
    })

    it('apontamentos: sem "Meta vinda do dado externo" e POST com "fonte da meta" integracao', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await escolherApontamento(user, dialogo)

      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))
      expect(within(dialogo).queryByRole('checkbox', { name: META_DO_DADO })).not.toBeInTheDocument()
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', apontamentos: [1], calculo: 'soma' })
      expect(await screen.findByText('Indicador cadastrado.')).toBeInTheDocument()
    })

    it('fase 1 ("meta via api".integracao false): aviso da consulta na fonte integracao, sem bloquear o envio; some na fonte dado_externo', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await escolherDado(user, dialogo, 'Faturamento líquido')
      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))
      expect(within(dialogo).queryByText(AVISO)).not.toBeInTheDocument()

      await user.click(within(dialogo).getByRole('checkbox', { name: META_DO_DADO }))
      expect(within(dialogo).getByText(AVISO)).toBeInTheDocument()

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
      await screen.findByText('Indicador cadastrado.')
      expect(posts(chamadas)).toHaveLength(1)
    })

    it('"meta via api".integracao true: sem o aviso na fonte integracao', async () => {
      const user = usuarioRapido()
      simular({ metaViaApi: META_VIA_API_COMPLETA })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await escolherApontamento(user, dialogo)

      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))

      expect(within(dialogo).queryByText(AVISO)).not.toBeInTheDocument()
    })

    it('400 do back-end: a mensagem aparece no alerta do diálogo, que continua aberto', async () => {
      const user = usuarioRapido()
      simular({ aoCriar: () => respostaErro(400, 'o dado externo Faturamento líquido nao fornece meta; informe a meta manualmente') })
      await abrirTela()

      const dialogo = await cadastrarComFaturamento(user, 'dado_externo')

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'o dado externo Faturamento líquido nao fornece meta; informe a meta manualmente',
      )
      expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
      expect(screen.queryByText('Indicador cadastrado.')).not.toBeInTheDocument()
    })
  })

  describe('"Definir meta" do automático', () => {
    async function abrirDefinirMeta(user: Usuario) {
      await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
      const dialogo = screen.getByRole('dialog', { name: 'Definir meta' })
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
      return dialogo
    }

    it('dado de origem com "fornece meta": carrega os dados externos, "Meta vinda do dado externo" marcado e PUT com "fonte da meta" dado_externo', async () => {
      const user = usuarioRapido()
      const chamadas = simular({ fornecemMeta: [INDICADOR_DEVOLUCOES_API.composicao.itens[0].id] })
      await abrirTela()

      const dialogo = await abrirDefinirMeta(user)
      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))

      expect(await within(dialogo).findByRole('checkbox', { name: META_DO_DADO })).toBeChecked()
      expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === ROTA_DADOS_EXTERNOS)).toBe(true)
      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      await screen.findByText('Meta definida.')
      const put = puts(chamadas).find((c) => c.caminho === `${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`)!
      expect(corpoDaChamada(put)).toEqual({
        'origem da meta': 'terceiro',
        'fonte da meta': 'dado_externo',
        sentido: 'maior_melhor',
        'meta editavel': false,
      })
      await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Via API')).toBeInTheDocument())
      expect(within(linha('Devoluções de venda')).queryByText('Integração pendente (TI)')).not.toBeInTheDocument()
    })

    it('dado de origem sem "fornece meta": sem o checkbox, aviso da fase 1 e PUT com "fonte da meta" integracao', async () => {
      const user = usuarioRapido()
      const chamadas = simular({ fornecemMeta: [] })
      await abrirTela()

      const dialogo = await abrirDefinirMeta(user)
      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))

      expect(within(dialogo).queryByRole('checkbox', { name: META_DO_DADO })).not.toBeInTheDocument()
      expect(within(dialogo).getByText(AVISO)).toBeInTheDocument()
      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      await screen.findByText('Meta definida.')
      const put = puts(chamadas).find((c) => c.caminho === `${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`)!
      expect(corpoDaChamada(put)).toMatchObject({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao' })
      await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Integração pendente (TI)')).toBeInTheDocument())
    })
  })

  describe('listagem e filtro', () => {
    it('Validador vê as etiquetas de situação e a tarefa, sem as ações de integração', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador' })
      await abrirTela()

      expect(within(linha('Novos clientes com meta da TI')).getByText('Aguardando primeira consulta')).toBeInTheDocument()
      expect(within(linha('Novos clientes com meta da TI')).getByText('#4521')).toBeInTheDocument()
      expect(within(linha('Cobertura com meta da TI')).getByText('Erro na consulta da meta')).toBeInTheDocument()
      expect(within(linha('Volume Mann com meta do ERP')).getByText('Sem meta no mês')).toBeInTheDocument()
      expect(within(linha('Faturamento com meta da TI')).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
      const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta do ERP'))
      expect(itens).not.toContain('Ver integração do dado externo')
    })

    it('Admin: filtro "Integração pendente (TI)" por último; escolher consulta situacao=integracao_pendente e mostra só os pendentes da fonte integracao', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
        'Todas',
        'Ativos',
        'Inativos',
        'Aguardando meta',
        'Meta pendente por filial',
        'Com problemas',
        'Integração pendente (TI)',
      ])

      await user.click(opcoes[opcoes.length - 1])

      await waitFor(() =>
        expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).at(-1)?.url.searchParams.get('situacao')).toBe(
          'integracao_pendente',
        ),
      )
      await waitFor(() => expect(within(tabela()).queryByText('Margem com meta da TI')).not.toBeInTheDocument())
      expect(within(tabela()).getByText('Faturamento com meta da TI')).toBeInTheDocument()
    })

    it('Validador: o filtro não oferece "Integração pendente (TI)"', async () => {
      simular({ perfil: 'validador' })
      await abrirTela()

      const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).not.toContain('Integração pendente (TI)')
    })
  })

  describe('"Ver integração do dado externo" (Admin, fonte dado_externo)', () => {
    /** O valor aparece num campo (só leitura) ou como texto na modal. */
    function contemValor(dialogo: HTMLElement, valor: string): boolean {
      return within(dialogo).queryByDisplayValue(valor) !== null || within(dialogo).queryByText(valor) !== null
    }

    it('abre a modal "Integração do dado externo" só leitura, com a integração do dado; "Fechar" fecha sem gravar', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesIndicador('Faturamento com meta do ERP'), 'Ver integração do dado externo')

      const dialogo = await screen.findByRole('dialog', { name: 'Integração do dado externo' })
      expect(contemValor(dialogo, 'FATURAMENTO')).toBe(true)
      expect(contemValor(dialogo, URL_INTEGRACAO_DADO_FATURAMENTO)).toBe(true)
      expect(within(dialogo).queryByRole('button', { name: 'Salvar configurações' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()

      const fechar = within(dialogo).getAllByRole('button', { name: 'Fechar' })
      await user.click(fechar[fechar.length - 1])

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(0)
    })

    it('a fonte integracao continua abrindo "Configurações da integração"', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesIndicador('Novos clientes com meta da TI'), 'Configurações')

      expect(screen.getByRole('dialog', { name: 'Configurações da integração' })).toBeInTheDocument()
    })
  })
})
