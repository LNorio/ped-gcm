import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
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
} from '../../test/dadosExternosFalsos'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_META_API_PENDENTE_API,
  SAIDA_META_VIA_API,
  URL_META_VIA_API,
  indicadoresComMetaViaApiApi,
  integracaoMetaPendenteApi,
  mapeamentoDoCorpoApi,
  respostaIndicadorApi,
  rotaListarIndicadoresComIntegracao,
  type CorpoIntegracaoIndicadorApiFalso,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { MODELO_JSON_ENTRADA } from '../../utils/integracao/modelos'

/**
 * F6.11 — Meta buscada via API (integração: /indicadores com a aplicação completa; só a rede é simulada).
 *
 * Contrato proposto (seção 5 de `docs/propostas-backend/PROPOSTA-meta-por-filial.md`):
 * - cadastro e "Definir meta" com "Buscar metas via API": `"origem da meta": "terceiro"`, sem `meta` nem
 *   `metas por filial`, `"meta editavel": false`; o indicador fica com a integração pendente;
 * - Admin: menu "Preencher integração" (pendente) / "Configurações" (configurada) → a mesma modal da
 *   integração do dado externo ("Configurações da integração") → `PUT .../{id}/integracao` → fecha,
 *   "Integração atualizada." e recarrega a lista (a etiqueta "Integração pendente (TI)" some);
 * - Validador não vê os itens nem a modal.
 *
 * Contrato final (RESPOSTA-FINAL-meta-via-api.md, 10/11/2026): aqui a fonte é sempre `integracao`
 * (`"fonte da meta": "integracao"`; nenhum dado externo fornece meta); salvar a integração leva a
 * situação a `aguardando_consulta`.
 *
 * Saída por "chave: tipo" (docs/propostas-backend/FRONT-saida-chave-tipo.md, 11/11/2026): a saída é um objeto
 * `{ chave: tipo }` (`SAIDA_META_VIA_API` = `{ codfil: string, metVlr: number }`), a modal tem as listas
 * "Campo da filial", "Campo da meta" e "Campo da competência" (sem "Campo do valor" nem o grupo
 * "Marcadores da saída") e o PUT leva `campo da filial` / `campo da meta` (ver também
 * IndicadoresPage.saidaTipos.integration.test.tsx).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_APONTAMENTOS = '/api/ped/apontamentos'
const ROTA_DADOS_EXTERNOS = '/api/ped/dados-externos-cadastro'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'
const BUSCAR_VIA_API = 'Buscar metas via API'
const SAIDA_TEXTO = JSON.stringify(SAIDA_META_VIA_API, null, 2)
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const URL_NOVA = 'https://ti.exemplo.com.br/api/metas-v2'
/** Saída digitada no "Preencher integração" (formato novo, "chave: tipo"). */
const SAIDA_DIGITADA = '{ "codfil": "string", "metVlr": "number" }'

describe('F6.11 — Meta buscada via API (integração: /indicadores)', () => {
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
    /** Resposta personalizada do PUT .../integracao (erro, por exemplo). */
    aoAtualizar?: () => Response | undefined
  }

  const CRIADO: IndicadorApiFalso = {
    ...INDICADOR_META_API_PENDENTE_API,
    id: 30,
    nome: 'Atingimento de faturamento',
  }

  /** API com estado: PUT .../integracao grava a integração; POST e PUT .../meta (terceiro) deixam a integração pendente. */
  function simular(opcoes: Opcoes = {}) {
    const perfil = opcoes.perfil ?? 'admin'
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = indicadoresComMetaViaApiApi()
    const atualizar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = opcoes.aoAtualizar?.()
      if (personalizada) return personalizada
      const corpo = JSON.parse(String(init?.body)) as CorpoIntegracaoIndicadorApiFalso
      lista = lista.map(
        (i): IndicadorApiFalso =>
          i.id === id
            ? {
                ...i,
                identificador: corpo.identificador,
                url: corpo.url,
                'parametros de saida': JSON.parse(corpo['parametros de saida']) as unknown,
                'parametros de entrada': JSON.parse(corpo['parametros de entrada']) as unknown,
                'mapeamento da saida': mapeamentoDoCorpoApi(corpo),
                'integracao pendente': false,
                'situacao da meta via api': 'aguardando_consulta',
              }
            : i,
      )
      return respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComIntegracao(() => lista),
      [`GET ${ROTA_APONTAMENTOS}`]: rotaListarApontamentos(apontamentosApi),
      // Contrato final (10/11/2026): nenhum dado externo fornece meta aqui, então a fonte é sempre
      // `integracao` (a fonte `dado_externo` está em IndicadoresPage.fonteDaMeta.integration.test.tsx).
      [`GET ${ROTA_DADOS_EXTERNOS}`]: rotaListarDadosExternos(() => dadosExternosApi().map((dado) => ({ ...dado, 'fornece meta': false }))),
      [`GET ${ROTA_DADOS_EXTERNOS}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA_VARIAVEIS}`]: () => respostaJson(variaveisIntegracaoApi()),
      [`PUT ${ROTA}/10/integracao`]: atualizar(10),
      [`PUT ${ROTA}/11/integracao`]: atualizar(11),
      [`POST ${ROTA}`]: () => {
        lista = [...lista, CRIADO]
        return respostaJson(respostaIndicadorApi(CRIADO), 201)
      },
      [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: () => {
        const atualizado: IndicadorApiFalso = {
          ...INDICADOR_DEVOLUCOES_API,
          sentido: 'maior_melhor',
          'sentido descricao': 'Maior é melhor',
          'meta a definir': false,
          'origem da meta': 'terceiro',
          ...integracaoMetaPendenteApi(),
          'fonte da meta': 'integracao',
          'situacao da meta via api': 'integracao_pendente',
        }
        lista = lista.map((i) => (i.id === INDICADOR_DEVOLUCOES_API.id ? atualizado : i))
        return respostaJson(respostaIndicadorApi(atualizado))
      },
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!
  const salvarConfiguracoes = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Salvar configurações' })
  const listaDoMapeamento = (dialogo: HTMLElement, nome: 'Campo da filial' | 'Campo da meta' | 'Campo da competência' | 'Campo do valor') =>
    within(dialogo).queryByRole('combobox', { name: nome })

  async function abrirTela() {
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  async function abrirConfiguracoes(user: Usuario, nome: string, item: 'Configurações' | 'Preencher integração' = 'Configurações') {
    await escolherAcao(user, rotuloAcoesIndicador(nome), item)
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    // Restrito ao grupo das variáveis da entrada (o botão %filial% é uma variável da entrada).
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })
    return dialogo
  }

  async function abrirCadastroComDadoExterno(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    const grupoDado = within(dialogo).getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupoDado).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupoDado).getByRole('listbox', { name: 'Dados externos' })
    await user.click(await within(lista).findByRole('option', { name: (nome) => nome.startsWith('Faturamento líquido') }))
    return dialogo
  }

  describe('listagem e menu de ações', () => {
    it('Admin: etiqueta "Integração pendente (TI)" e coluna Meta "Via API"; menu "Preencher integração" (pendente) e "Configurações" (configurada)', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      expect(within(linha('Faturamento com meta da TI')).getByText('Integração pendente (TI)')).toBeInTheDocument()
      expect(within(linha('Margem com meta da TI')).queryByText('Integração pendente (TI)')).not.toBeInTheDocument()
      expect(within(linha('Faturamento com meta da TI')).getByText('Via API')).toBeInTheDocument()
      expect(within(linha('Margem com meta da TI')).getByText('Via API')).toBeInTheDocument()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta da TI'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Inativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Margem com meta da TI'))).toEqual([
        'Ver detalhes',
        'Configurações',
        'Inativar',
        'Excluir',
      ])
      const manual = await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))
      expect(manual).not.toContain('Configurações')
      expect(manual).not.toContain('Preencher integração')
    })

    it('Validador não vê "Configurações" nem "Preencher integração"', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador' })
      await abrirTela()

      for (const nome of ['Faturamento com meta da TI', 'Margem com meta da TI']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))
        expect(itens).not.toContain('Configurações')
        expect(itens).not.toContain('Preencher integração')
      }
    })
  })

  describe('Configurações da integração (Admin)', () => {
    it('"Configurações" abre a modal da integração com os valores salvos do indicador e consulta as variáveis', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      const dialogo = await abrirConfiguracoes(user, 'Margem com meta da TI')

      expect(within(dialogo).getByText('Revise a integração do indicador Margem com meta da TI e salve as configurações.')).toBeInTheDocument()
      expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('META_MARGEM')
      expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_META_VIA_API)
      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_TEXTO)
      expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue(ENTRADA_TEXTO)
      // Saída "chave: tipo": listas do mapeamento com os campos salvos; sem "Campo do valor" nem marcadores da saída.
      expect(listaDoMapeamento(dialogo, 'Campo da filial')).toHaveValue('codfil')
      expect(listaDoMapeamento(dialogo, 'Campo da meta')).toHaveValue('metVlr')
      expect(listaDoMapeamento(dialogo, 'Campo da competência')).toHaveValue('')
      expect(listaDoMapeamento(dialogo, 'Campo do valor')).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('group', { name: 'Marcadores da saída' })).not.toBeInTheDocument()
      expect(gets(chamadas, ROTA_VARIAVEIS)).toHaveLength(1)
      expect(salvarConfiguracoes(dialogo)).toBeEnabled()
    })

    it('salvar: PUT .../{id}/integracao com os quatro campos e o mapeamento da saída → fecha, "Integração atualizada." e recarrega a lista', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const listasAntes = gets(chamadas, ROTA).length
      const dialogo = await abrirConfiguracoes(user, 'Margem com meta da TI')

      const campoUrl = within(dialogo).getByLabelText('URL')
      await user.clear(campoUrl)
      await colar(user, campoUrl, URL_NOVA)
      await user.click(salvarConfiguracoes(dialogo))

      const notificacao = await screen.findByText('Integração atualizada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/11/integracao`)
      expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
        identificador: 'META_MARGEM',
        url: URL_NOVA,
        'parametros de saida': SAIDA_TEXTO,
        'parametros de entrada': ENTRADA_TEXTO,
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
      })
      expect(chamadas.some((c) => c.caminho === `${ROTA_DADOS_EXTERNOS}/11/integracao`)).toBe(false)
      await waitFor(() => expect(gets(chamadas, ROTA).length).toBeGreaterThan(listasAntes))
    })

    it('"Preencher integração" abre com os campos vazios; com a saída "chave: tipo" e o mapeamento escolhido, salva e a etiqueta "Integração pendente (TI)" sai da linha', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      const dialogo = await abrirConfiguracoes(user, 'Faturamento com meta da TI', 'Preencher integração')
      expect(within(dialogo).getByLabelText('Identificador da consulta')).toHaveValue('')
      expect(within(dialogo).getByLabelText('URL')).toHaveValue('')
      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue('')
      expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveValue('')
      expect(salvarConfiguracoes(dialogo)).toBeDisabled()

      await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'META_FATURAMENTO')
      await colar(user, within(dialogo).getByLabelText('URL'), URL_META_VIA_API)
      await colar(user, within(dialogo).getByLabelText('Parâmetros de saída'), SAIDA_DIGITADA)
      await user.click(within(dialogo).getByRole('button', { name: 'Inserir modelo de entrada' }))
      // Sem o mapeamento (campo da filial e campo da meta obrigatórios) não salva.
      expect(salvarConfiguracoes(dialogo)).toBeDisabled()
      await user.selectOptions(listaDoMapeamento(dialogo, 'Campo da filial')!, 'codfil')
      await user.selectOptions(listaDoMapeamento(dialogo, 'Campo da meta')!, 'metVlr')
      expect(salvarConfiguracoes(dialogo)).toBeEnabled()
      await user.click(salvarConfiguracoes(dialogo))

      await screen.findByText('Integração atualizada.')
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
        identificador: 'META_FATURAMENTO',
        url: URL_META_VIA_API,
        'parametros de saida': SAIDA_DIGITADA,
        'parametros de entrada': MODELO_JSON_ENTRADA,
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
      })
      await waitFor(() =>
        expect(within(linha('Faturamento com meta da TI')).queryByText('Integração pendente (TI)')).not.toBeInTheDocument(),
      )
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento com meta da TI'))).toContain('Configurações')
    })

    it('400 { mensagem, erros }: mensagem geral no alerta e erros junto aos campos; a modal continua aberta com os valores', async () => {
      const user = usuarioRapido()
      const chamadas = simular({
        aoAtualizar: () =>
          respostaJson(
            {
              mensagem: 'integracao invalida: URL ...',
              erros: [
                { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
                { campo: 'parametros de entrada', caminho: 'parametros.ECompet', expressao: '5 / 0', mensagem: 'divisao por zero' },
              ],
            },
            400,
          ),
      })
      await abrirTela()
      const dialogo = await abrirConfiguracoes(user, 'Margem com meta da TI')

      await user.click(salvarConfiguracoes(dialogo))

      const geral = await within(dialogo).findByText('integracao invalida: URL ...')
      expect(geral.closest('[role="alert"]')).not.toBeNull()
      expect(within(dialogo).getByLabelText('URL')).toHaveAccessibleDescription(
        expect.stringContaining('a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'),
      )
      expect(within(dialogo).getByLabelText('Parâmetros de entrada')).toHaveAccessibleDescription(
        expect.stringContaining('Campo "parametros.ECompet": divisao por zero em "5 / 0"'),
      )
      expect(screen.getByRole('dialog', { name: 'Configurações da integração' })).toBeInTheDocument()
      expect(within(dialogo).getByLabelText('URL')).toHaveValue(URL_META_VIA_API)
      expect(screen.queryByText('Integração atualizada.')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
    })

    it('Cancelar fecha sem chamar a API; reabrir mostra de novo os valores salvos', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirConfiguracoes(user, 'Margem com meta da TI')
      await user.clear(within(dialogo).getByLabelText('URL'))

      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(0)
      const reaberto = await abrirConfiguracoes(user, 'Margem com meta da TI')
      expect(within(reaberto).getByLabelText('URL')).toHaveValue(URL_META_VIA_API)
    })

    it('clique duplo em "Salvar configurações" gera um único PUT', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirConfiguracoes(user, 'Margem com meta da TI')

      await user.dblClick(salvarConfiguracoes(dialogo))

      await screen.findByText('Integração atualizada.')
      expect(puts(chamadas)).toHaveLength(1)
    })
  })

  describe('cadastro com "Buscar metas via API"', () => {
    it('POST com "origem da meta" terceiro, sem meta e "meta editavel" false; o indicador aparece com "Integração pendente (TI)" e "Via API"', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirCadastroComDadoExterno(user)

      await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Atingimento de faturamento')
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
      await user.click(within(dialogo).getByRole('checkbox', { name: 'Meta editável no preenchimento' }))
      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))
      expect(within(dialogo).queryByRole('textbox', { name: 'Meta' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('checkbox', { name: 'Meta editável no preenchimento' })).not.toBeInTheDocument()
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Indicador cadastrado.')
      expect(posts(chamadas)).toHaveLength(1)
      const corpo = corpoDaChamada(posts(chamadas)[0])
      expect(corpo).toEqual({
        nome: 'Atingimento de faturamento',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'integracao',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
      const linhaCriado = (await within(tabela()).findByText('Atingimento de faturamento')).closest('tr')!
      expect(within(linhaCriado).getByText('Integração pendente (TI)')).toBeInTheDocument()
      expect(within(linhaCriado).getByText('Via API')).toBeInTheDocument()
    })

    it('Validador também vê o checkbox "Buscar metas via API" no cadastro', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador' })
      await abrirTela()

      const dialogo = await abrirCadastroComDadoExterno(user)

      expect(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API })).not.toBeChecked()
    })
  })

  describe('"Definir meta" com "Buscar metas via API"', () => {
    it('PUT .../{id}/meta com { "origem da meta": "terceiro", sentido, "meta editavel": false } → "Meta definida." e o indicador passa a ter a integração pendente', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
      const dialogo = screen.getByRole('dialog', { name: 'Definir meta' })
      await user.click(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API }))
      expect(within(dialogo).queryByRole('textbox', { name: 'Meta' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('checkbox', { name: 'Meta editável no preenchimento' })).not.toBeInTheDocument()
      const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
      await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      await screen.findByText('Meta definida.')
      const put = puts(chamadas).find((c) => c.caminho === `${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`)!
      expect(corpoDaChamada(put)).toEqual({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', sentido: 'maior_melhor', 'meta editavel': false })
      await waitFor(() => expect(within(linha('Devoluções de venda')).getByText('Integração pendente (TI)')).toBeInTheDocument())
      expect(within(linha('Devoluções de venda')).getByText('Via API')).toBeInTheDocument()
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toContain('Preencher integração')
    })

    it('Validador também vê o checkbox "Buscar metas via API" no "Definir meta"', async () => {
      const user = usuarioRapido()
      simular({ perfil: 'validador' })
      await abrirTela()

      await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')

      const dialogo = screen.getByRole('dialog', { name: 'Definir meta' })
      expect(within(dialogo).getByRole('checkbox', { name: BUSCAR_VIA_API })).not.toBeChecked()
    })
  })
})
