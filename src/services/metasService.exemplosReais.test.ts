import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import metasReais from '../../docs/backend/exemplos-reais/metas.json'
import { respostaJson, simularApi } from '../test/apiFalsa'
import type { JanelaMetas } from '../types/dominio'
import { listarMetasPreenchimento } from './metasService'
import { definirToken, limparToken } from './sessao'

/**
 * Garantia de contrato (F9.13*): o serviço de metas converte, sem erro e com os valores certos, a
 * resposta real de `GET /api/ped/metas` salva em `docs/backend/exemplos-reais/metas.json` (enviada
 * pelo usuário em 16/11/2026 e resumida a três indicadores).
 *
 * - `composicao` vem como lista de textos (nomes dos itens) e vira `string[]` no domínio;
 * - o envelope traz `filial`, `"mes de referencia"` e `quantidade`, tolerados e fora da `JanelaMetas`.
 *
 * O JSON não pode ser alterado para fazer o teste passar: ele é a resposta real.
 */
const ROTA = '/api/ped/metas'

describe('F9.1 — Serviço de metas no preenchimento: contrato com a resposta real (F9.13*)', () => {
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

  it('converte a janela sem erro, com a composição pelos nomes dos itens e os campos extras do envelope tolerados', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(metasReais) })

    await expect(listarMetasPreenchimento({ filial: '100', mesDeReferencia: '2026-10' })).resolves.toEqual<JanelaMetas>({
      situacaoDoMes: 'aberto',
      editavel: true,
      indicadores: [
        {
          id: 17,
          nome: 'Indicadores de Financeiro',
          tipos: ['Financeiro'],
          composicao: ['Documento não fiscal', 'Pagamento com multas/juros', 'Pagamento fora da programação', 'Qualidade do lançamento'],
          sentido: 'maior_melhor',
          metaDoCadastro: 4,
          metaDoCadastroOrigem: 'geral',
          metaVigente: 4,
          ajustada: false,
        },
        {
          id: 3,
          nome: 'teste 2',
          tipos: ['Contabilidade', 'Tecnologia da Informação'],
          composicao: ['teste', 'teste 2'],
          sentido: 'maior_melhor',
          metaDoCadastro: 300,
          metaDoCadastroOrigem: 'geral',
          metaVigente: 300,
          ajustada: false,
        },
        {
          id: 2,
          nome: 'teste externo',
          tipos: ['Contabilidade'],
          composicao: ['teste 2'],
          sentido: 'menor_melhor',
          metaDoCadastro: 120,
          metaDoCadastroOrigem: 'geral',
          metaVigente: 120,
          ajustada: false,
        },
      ],
    })
  })
})
