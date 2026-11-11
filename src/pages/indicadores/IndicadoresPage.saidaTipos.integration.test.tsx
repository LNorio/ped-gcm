import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, identificadoresApi, rotaListarDadosExternos, variaveisIntegracaoApi } from '../../test/dadosExternosFalsos'
import {
  ENTRADA_META_VIA_API,
  SAIDA_META_COM_COMPETENCIA,
  SAIDA_META_VIA_API_ANTIGA,
  URL_META_VIA_API,
  indicadoresComSaidaPorTiposApi,
  rotaListarIndicadoresComIntegracao,
  type CorpoIntegracaoIndicadorApiFalso,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

/**
 * F6.11 — Saída da integração da meta por "chave: tipo" na aba Indicadores (integração: /indicadores com a
 * aplicação completa; só a rede é simulada). Contrato: docs/propostas-backend/FRONT-saida-chave-tipo.md
 * (11/11/2026, opção B do back-end). Decisões do usuário: a modal só salva no formato novo e os marcadores da
 * saída foram retirados.
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): os parâmetros de
 * saída só mostram ao back-end a saída esperada; não há amarração.
 * - "Configurações" (Admin, fonte `integracao`) abre a modal (`tipoAlvo` "indicador") com a saída salva e
 *   **sem** as listas do mapeamento, mesmo com o `mapeamento da saida` que a listagem ainda traz;
 * - salvar envia só os quatro campos (sem `campo da filial`, `campo da meta`, `campo da competencia`);
 * - integração salva no formato antigo (saída em lista) abre com a lista salva e "Salvar configurações"
 *   bloqueado; reescrita no formato novo, salva sem escolher nada;
 * - 400 do back-end com erro em `campo: "parametros de saida"` aparece junto da saída.
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_APONTAMENTOS = '/api/ped/apontamentos'
const ROTA_DADOS_EXTERNOS = '/api/ped/dados-externos-cadastro'
const ROTA_VARIAVEIS = '/api/ped/integracao/variaveis'
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const SAIDA_COM_COMPETENCIA_TEXTO = JSON.stringify(SAIDA_META_COM_COMPETENCIA, null, 2)
const SAIDA_ANTIGA_TEXTO = JSON.stringify(SAIDA_META_VIA_API_ANTIGA, null, 2)
const SAIDA_NOVA_DIGITADA = '{ "codfil": "string", "metVlr": "number" }'

type NomeDaLista = 'Campo da filial' | 'Campo da meta' | 'Campo da competência' | 'Campo do valor'

describe('F6.11 — Saída "chave: tipo" na integração do indicador (integração: /indicadores)', () => {
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
    /** Resposta personalizada do PUT .../integracao (erro, por exemplo). */
    aoAtualizar?: () => Response | undefined
  }

  /** API com estado (Admin): PUT .../integracao grava a saída e a entrada como o back-end devolve na listagem. */
  function simular(opcoes: Opcoes = {}) {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let indicadores = indicadoresComSaidaPorTiposApi()
    const atualizar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = opcoes.aoAtualizar?.()
      if (personalizada) return personalizada
      const corpo = JSON.parse(String(init?.body)) as CorpoIntegracaoIndicadorApiFalso
      indicadores = indicadores.map(
        (i): IndicadorApiFalso =>
          i.id === id
            ? {
                ...i,
                identificador: corpo.identificador,
                url: corpo.url,
                'parametros de saida': JSON.parse(corpo['parametros de saida']) as unknown,
                'parametros de entrada': JSON.parse(corpo['parametros de entrada']) as unknown,
                'integracao pendente': false,
              }
            : i,
      )
      return respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] })
    }
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComIntegracao(() => indicadores),
      [`GET ${ROTA_APONTAMENTOS}`]: rotaListarApontamentos(apontamentosApi),
      [`GET ${ROTA_DADOS_EXTERNOS}`]: rotaListarDadosExternos(() => dadosExternosApi().map((dado) => ({ ...dado, 'fornece meta': false }))),
      [`GET ${ROTA_DADOS_EXTERNOS}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA_VARIAVEIS}`]: () => respostaJson(variaveisIntegracaoApi()),
      [`PUT ${ROTA}/18/integracao`]: atualizar(18),
      [`PUT ${ROTA}/19/integracao`]: atualizar(19),
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const salvarConfiguracoes = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Salvar configurações' })
  const listaDoMapeamento = (dialogo: HTMLElement, nome: NomeDaLista) => within(dialogo).queryByRole('combobox', { name: nome })

  async function abrirTela() {
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  async function abrirConfiguracoes(user: Usuario, nome: string) {
    await escolherAcao(user, rotuloAcoesIndicador(nome), 'Configurações')
    const dialogo = screen.getByRole('dialog', { name: 'Configurações da integração' })
    await within(within(dialogo).getByRole('group', { name: 'Variáveis disponíveis' })).findByRole('button', { name: /%filial%/ })
    return dialogo
  }

  describe('formato novo (saída com campo de competência)', () => {
    it('"Configurações" mostra a saída { chave: tipo } e nenhuma lista do mapeamento; o salvar fica liberado', async () => {
      const user = usuarioRapido()
      simular()
      await abrirTela()

      const dialogo = await abrirConfiguracoes(user, 'Volume com meta da TI')

      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_COM_COMPETENCIA_TEXTO)
      for (const nome of ['Campo da filial', 'Campo da meta', 'Campo da competência', 'Campo do valor'] as const) {
        expect(listaDoMapeamento(dialogo, nome)).not.toBeInTheDocument()
      }
      expect(salvarConfiguracoes(dialogo)).toBeEnabled()
    })

    it('salvar envia só os quatro campos (sem "campo da ..."); reabrir mostra a saída gravada', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const listasAntes = gets(chamadas, ROTA).length
      const dialogo = await abrirConfiguracoes(user, 'Volume com meta da TI')

      await user.click(salvarConfiguracoes(dialogo))

      await screen.findByText('Integração atualizada.')
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/19/integracao`)
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
        identificador: 'META_VOLUME',
        url: URL_META_VIA_API,
        'parametros de saida': SAIDA_COM_COMPETENCIA_TEXTO,
        'parametros de entrada': ENTRADA_TEXTO,
      })
      await waitFor(() => expect(gets(chamadas, ROTA).length).toBeGreaterThan(listasAntes))

      const reaberto = await abrirConfiguracoes(user, 'Volume com meta da TI')
      expect(within(reaberto).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_COM_COMPETENCIA_TEXTO)
      expect(listaDoMapeamento(reaberto, 'Campo da competência')).not.toBeInTheDocument()
    })

    it('400 com erro na saída (campo "parametros de saida"): mensagem geral no alerta e o erro junto da saída; a modal continua aberta', async () => {
      const user = usuarioRapido()
      const chamadas = simular({
        aoAtualizar: () =>
          respostaJson(
            {
              mensagem: 'integracao invalida: campo da meta',
              erros: [{ campo: 'parametros de saida', mensagem: 'o "campo da meta" ("codfil") e do tipo string; precisa ser number' }],
            },
            400,
          ),
      })
      await abrirTela()
      const dialogo = await abrirConfiguracoes(user, 'Volume com meta da TI')

      await user.click(salvarConfiguracoes(dialogo))

      const geral = await within(dialogo).findByText('integracao invalida: campo da meta')
      expect(geral.closest('[role="alert"]')).not.toBeNull()
      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveAccessibleDescription(
        expect.stringContaining('o "campo da meta" ("codfil") e do tipo string; precisa ser number'),
      )
      expect(screen.getByRole('dialog', { name: 'Configurações da integração' })).toBeInTheDocument()
      expect(screen.queryByText('Integração atualizada.')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
    })
  })

  describe('integração salva no formato antigo (saída em lista)', () => {
    it('abre com a lista salva e "Salvar configurações" bloqueado; nenhum PUT', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()

      const dialogo = await abrirConfiguracoes(user, 'Cobertura com meta da TI')

      expect(within(dialogo).getByLabelText('Parâmetros de saída')).toHaveValue(SAIDA_ANTIGA_TEXTO)
      expect(salvarConfiguracoes(dialogo)).toBeDisabled()
      await user.click(salvarConfiguracoes(dialogo))
      expect(puts(chamadas)).toHaveLength(0)
    })

    it('reescrita no formato novo, salva sem escolher nada e o corpo não leva nenhum "campo da ..."', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrirTela()
      const dialogo = await abrirConfiguracoes(user, 'Cobertura com meta da TI')

      const saida = within(dialogo).getByLabelText('Parâmetros de saída')
      await user.clear(saida)
      await colar(user, saida, SAIDA_NOVA_DIGITADA)
      expect(salvarConfiguracoes(dialogo)).toBeEnabled()
      await user.click(salvarConfiguracoes(dialogo))

      await screen.findByText('Integração atualizada.')
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/18/integracao`)
      const corpo = corpoDaChamada(puts(chamadas)[0]) as Record<string, unknown>
      expect(corpo).toMatchObject({
        identificador: 'META_COBERTURA',
        'parametros de saida': SAIDA_NOVA_DIGITADA,
        'parametros de entrada': ENTRADA_TEXTO,
      })
      expect(Object.keys(corpo).sort()).toEqual(['identificador', 'parametros de entrada', 'parametros de saida', 'url'])
    })
  })
})
