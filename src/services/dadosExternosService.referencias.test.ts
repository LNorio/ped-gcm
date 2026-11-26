import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  respostaCriacaoApi,
  respostaDadosExternosApi,
  tarefaBitrixCriadaApi,
  type DadoExternoApiFalso,
} from '../test/dadosExternosFalsos'
import type { NovoDadoExterno } from '../types/dominio'
import { criarDadoExterno, listarDadosExternos, obterRealizado } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'

type Referencia = 'colaborador' | 'zona'

const NOVO_ADMIN: NovoDadoExterno = {
  nome: 'Positivação por vendedor',
  idTipo: 1,
  sistemaOrigem: 'senior_erp',
  tipoValor: 'numeral',
  referencia: 'filial',
  coleta: 'diaria',
  diaDaColeta: null,
  sentidoCalculo: 'soma',
  janelaRetroativa: 1,
  comentarios: null,
  campoCalculo: 'Clientes positivados por vendedor.',
  identificador: 'positivacao',
  observacao: null,
}

const NOVO_SOLICITACAO: NovoDadoExterno = {
  ...NOVO_ADMIN,
  nome: 'Vendas por zona',
  identificador: null,
  observacao: 'Prioridade alta.',
}

/** Dado como a API devolve para colaborador e zona (A-11): cadastrado, mas ainda sem coleta. */
function dadoSemColetaApi(referencia: Referencia, base: DadoExternoApiFalso = DADO_FATURAMENTO_API): DadoExternoApiFalso {
  return { ...base, id: 30, nome: `Por ${referencia}`, referencia, 'coleta disponivel': false }
}

/**
 * F5.10 — Referências Colaborador e Zona de venda em dados externos, de ponta a ponta (RF-25, INT-03;
 * A-11 resolvida em parte em 06/11/2026, item 7 de docs/backend/FRONT-PED-mudancas (1).md e seção
 * "Referência" do API (31).md). O POST de /api/ped/dados-externos-cadastro aceita `referencia`
 * `colaborador` e `zona`, além de `filial`. Para essas duas ainda não há coleta: o dado vem com
 * `"coleta disponivel": false` e o realizado (GET .../{id}/realizado) com `"valor": null`, o que é
 * "sem coleta ainda", não erro: o serviço converte normalmente, sem rejeitar.
 *
 * Já cobertos em outros requisitos (não repetidos aqui): referência "colaborador" convertida na listagem
 * (dadosExternosService.test.ts, F5.1); realizado com valor null e "coleta disponivel" false, sem meses
 * (idem); as três referências habilitadas e enviadas pelo formulário (FormularioDadoExterno.cadastro.test.tsx,
 * F5.4); rótulos Filial/Colaborador/Zona de venda nos detalhes (TabelaDadosExternos.test.tsx, F5.2).
 */
describe('F5.10 — Serviço de dados externos: referências Colaborador e Zona de venda', () => {
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

  describe('criarDadoExterno (POST)', () => {
    it.each<Referencia>(['colaborador', 'zona'])('Admin: referência "%s" vai no corpo do POST como "referencia": "%s"', async (referencia) => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(dadoSemColetaApi(referencia), null), 201),
      })

      await criarDadoExterno({ ...NOVO_ADMIN, referencia })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(corpoDaChamada(chamadas[0])).toMatchObject({ referencia, identificador: 'POSITIVACAO' })
    })

    it.each<Referencia>(['colaborador', 'zona'])('solicitação (Validador/Preenchedor): referência "%s" vai no corpo do POST, sem identificador', async (referencia) => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(respostaCriacaoApi(dadoSemColetaApi(referencia, DADO_DEVOLUCOES_API), tarefaBitrixCriadaApi('[PED] Construir dado externo: Vendas por zona', '1051')), 201),
      })

      await criarDadoExterno({ ...NOVO_SOLICITACAO, referencia })

      expect(corpoDaChamada(chamadas[0])).toMatchObject({ referencia, identificador: null, observacao: 'Prioridade alta.' })
    })

    it.each<Referencia>(['colaborador', 'zona'])(
      'resposta 201 com o dado de referência "%s" e "coleta disponivel": false: resolve com o dado convertido (coletaDisponivel false), sem erro',
      async (referencia) => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(dadoSemColetaApi(referencia), null), 201),
        })

        const resultado = await criarDadoExterno({ ...NOVO_ADMIN, referencia })

        expect(resultado.dadoExterno).toMatchObject({ id: 30, nome: `Por ${referencia}`, referencia, coletaDisponivel: false })
      },
    )
  })

  describe('listarDadosExternos (GET)', () => {
    it('dados de referência "colaborador" e "zona" com "coleta disponivel": false são convertidos com a referência certa, sem "resposta inválida"', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            respostaDadosExternosApi([
              DADO_FATURAMENTO_API,
              { ...dadoSemColetaApi('colaborador'), id: 31, nome: 'Positivação por vendedor' },
              { ...dadoSemColetaApi('zona'), id: 32, nome: 'Vendas por zona' },
            ]),
          ),
      })

      const dados = await listarDadosExternos()

      expect(dados.map((dado) => [dado.nome, dado.referencia, dado.coletaDisponivel])).toEqual([
        ['Faturamento líquido', 'filial', true],
        ['Positivação por vendedor', 'colaborador', false],
        ['Vendas por zona', 'zona', false],
      ])
    })
  })

  describe('obterRealizado (GET .../{id}/realizado) — sem coleta ainda', () => {
    it(
      'dado de colaborador ou zona: "valor": null, "meses considerados": [] e "coleta disponivel": false resolvem como "sem coleta ainda" (valor null, coletaDisponivel false), sem rejeitar',
      async () => {
        const chamadas = simularApi(fetchFalso, {
          [`GET ${ROTA}/30/realizado`]: () =>
            respostaJson({
              valor: null,
              'meses considerados': [],
              'janela retroativa': 1,
              'sentido do calculo': 'soma',
              'coleta disponivel': false,
            }),
        })

        const realizado = await obterRealizado(30, { filial: '101', mesDeReferencia: '2026-10-01' })

        expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
        expect(chamadas[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10-01')
        expect(realizado).toEqual({
          valor: null,
          mesesConsiderados: [],
          janelaRetroativa: 1,
          sentidoCalculo: 'soma',
          coletaDisponivel: false,
        })
      },
    )
  })
})
