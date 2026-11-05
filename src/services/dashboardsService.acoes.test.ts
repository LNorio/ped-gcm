import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_LOGISTICA_API,
  DASHBOARD_SUPERVISORES_API,
  historicoDashboardApi,
  respostaDashboardApi,
  tarefasDashboardApi,
} from '../test/dashboardsFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  alterarSituacaoDashboard,
  concluirDashboard,
  excluirDashboard,
  listarHistoricoDashboard,
  listarTarefasDashboard,
} from './dashboardsService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dashboards'

describe('F7.1 — Serviço de dashboards: concluir, situação, exclusão, histórico e tarefas', () => {
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

  describe('concluirDashboard(id) — RF-55/RF-56 (Admin); 2xx significa gravado', () => {
    it('PUT .../{id}/concluir sem corpo e devolve o dashboard convertido', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaDashboardApi({ ...DASHBOARD_SUPERVISORES_API, situacao: 'ativo', 'situacao descricao': 'Ativo' })),
      })

      const dashboard = await concluirDashboard(3)

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/concluir`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(dashboard).toMatchObject({ id: 3, situacao: 'ativo' })
    })

    it('aceita o dashboard na raiz, com ou sem mensagem', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/concluir`]: () => respostaJson({ ...DASHBOARD_LOGISTICA_API, situacao: 'ativo', mensagem: 'Modificação concluída.' }),
      })

      await expect(concluirDashboard(4)).resolves.toMatchObject({ id: 4, situacao: 'ativo' })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Construção concluída.' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['dashboard incompleto', () => respostaJson({ dashboard: { id: 3 } })],
    ])('resposta 2xx com %s resolve null, sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: resposta })

      await expect(concluirDashboard(3)).resolves.toBeNull()
    })

    it('400 (dashboard fora de construção/modificação) e 403 (Validador) chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/concluir`]: () => respostaErro(400, 'O dashboard não está em construção nem em modificação.') })
      await expect(concluirDashboard(1)).rejects.toMatchObject({ status: 400, mensagem: 'O dashboard não está em construção nem em modificação.' })

      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaErro(403, 'Apenas o Admin conclui a construção.') })
      await expect(concluirDashboard(3)).rejects.toMatchObject({ status: 403, mensagem: 'Apenas o Admin conclui a construção.' })
    })
  })

  describe('alterarSituacaoDashboard(id, ativo) — RF-58 (Admin); 2xx significa gravado', () => {
    it('PUT .../{id}/situacao com { ativo: false } e devolve o dashboard convertido', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/1/situacao`]: () => respostaJson(respostaDashboardApi({ ...DASHBOARD_COMERCIAL_API, situacao: 'inativo', 'situacao descricao': 'Inativo' })),
      })

      const dashboard = await alterarSituacaoDashboard(1, false)

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/situacao`)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: false })
      expect(dashboard).toMatchObject({ id: 1, situacao: 'inativo' })
    })

    it('ativar envia { ativo: true }; aceita o dashboard na raiz', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ ...DASHBOARD_COMERCIAL_API, mensagem: 'Dashboard ativado.' }),
      })

      const dashboard = await alterarSituacaoDashboard(1, true)

      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: true })
      expect(dashboard?.situacao).toBe('ativo')
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Situação alterada.' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
    ])('resposta 2xx com %s resolve null, sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: resposta })

      await expect(alterarSituacaoDashboard(1, false)).resolves.toBeNull()
    })

    it('400 (em construção ou modificação) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/situacao`]: () => respostaErro(400, 'Dashboard em construção não pode ser ativado nem desativado.'),
      })

      await expect(alterarSituacaoDashboard(3, true)).rejects.toMatchObject({
        status: 400,
        mensagem: 'Dashboard em construção não pode ser ativado nem desativado.',
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(alterarSituacaoDashboard(1, false)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('excluirDashboard(id) — RF-59 (Admin)', () => {
    it('DELETE .../{id} com o token; resolve sem valor em 204', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/5`]: () => new Response(null, { status: 204 }) })

      await expect(excluirDashboard(5)).resolves.toBeUndefined()

      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe(`${ROTA}/5`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('resolve sem valor em 200 com corpo', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/5`]: () => respostaJson({ mensagem: 'Dashboard excluído.' }) })

      await expect(excluirDashboard(5)).resolves.toBeUndefined()
    })

    it('403 (Validador) chega como ApiError com a mensagem da API; 500 com a mensagem padrão', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/5`]: () => respostaErro(403, 'Apenas o Admin exclui dashboards.') })
      const erro = await excluirDashboard(5).catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 403, mensagem: 'Apenas o Admin exclui dashboards.' })

      simularApi(fetchFalso, { [`DELETE ${ROTA}/5`]: () => respostaErro(500) })
      await expect(excluirDashboard(5)).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })
  })

  describe('listarHistoricoDashboard(id) — RF-57, RNF-01', () => {
    it('GET .../{id}/historico e devolve a lista convertida, na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()) })

      const historico = await listarHistoricoDashboard(1)

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/historico`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(historico).toEqual([
        {
          acao: 'edicao',
          acaoDescricao: 'Edição',
          data: '2026-10-20 15:30:00',
          usuario: 'Ana Costa',
          alteracoes: ['Pontos de Cobertura de visitas: 50 → 40 pts', 'Indicador incluído: Faturamento líquido mensal (60 pts)'],
          tarefa: null,
          observacao: null,
        },
        {
          acao: 'concluida',
          acaoDescricao: 'Construção concluída',
          data: '2026-09-03 09:00:00',
          usuario: 'Maria Souza',
          alteracoes: [],
          tarefa: 31,
          observacao: null,
        },
        {
          acao: 'cadastro',
          acaoDescricao: 'Cadastro',
          data: '2026-09-01 10:00:00',
          usuario: 'Maria Souza',
          alteracoes: [],
          tarefa: 31,
          observacao: 'Usar a régua de faixas do ano passado.',
        },
      ])
    })

    it('aceita a lista dentro de { historico }; campos opcionais ausentes viram padrões ("" , [] e null)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/historico`]: () => respostaJson({ historico: [{ acao: 'desativado', data: '2026-11-01 08:00:00', usuario: 'Ana Costa' }] }),
      })

      const historico = await listarHistoricoDashboard(1)

      expect(historico).toEqual([
        { acao: 'desativado', acaoDescricao: '', data: '2026-11-01 08:00:00', usuario: 'Ana Costa', alteracoes: [], tarefa: null, observacao: null },
      ])
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([]) })

      await expect(listarHistoricoDashboard(1)).resolves.toEqual([])
    })

    it.each([
      ['sem usuário', { acao: 'edicao', data: '2026-10-20 15:30:00' }],
      ['sem data', { acao: 'edicao', usuario: 'Ana' }],
      ['com alterações fora de lista', { acao: 'edicao', data: '2026-10-20 15:30:00', usuario: 'Ana', alteracoes: 'nome' }],
      ['com tarefa em texto', { acao: 'edicao', data: '2026-10-20 15:30:00', usuario: 'Ana', 'tarefa bitrix': 'trinta e um' }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([historicoDashboardApi()[0], item]) })

      await expect(listarHistoricoDashboard(1)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta que não é lista nem { historico } vira ApiError "resposta inválida"; 403 chega com a mensagem', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson({ mensagem: 'ok' }) })
      await expect(listarHistoricoDashboard(1)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })

      simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(listarHistoricoDashboard(1)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })
  })

  describe('listarTarefasDashboard(id) — RF-56 (tarefas anteriores)', () => {
    it('GET .../{id}/tarefas e devolve a lista convertida, na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/2/tarefas`]: () => respostaJson(tarefasDashboardApi()) })

      const tarefas = await listarTarefasDashboard(2)

      expect(chamadas[0].caminho).toBe(`${ROTA}/2/tarefas`)
      expect(tarefas).toEqual([
        {
          id: 21,
          tipo: 'construcao',
          status: 'concluida',
          titulo: '[PED] Construir dashboard: PED Gerentes',
          descricao: 'Construir o dashboard “PED Gerentes” no PED.',
          criadaEm: '2026-08-01 10:00:00',
        },
        {
          id: 25,
          tipo: 'modificacao',
          status: 'concluida',
          titulo: '[PED] Modificar dashboard: PED Gerentes',
          descricao: 'Modificar o dashboard “PED Gerentes” no PED.',
          criadaEm: '2026-09-10 14:00:00',
        },
      ])
    })

    it('aceita { tarefas: [...] }; sem número, tipo, status, descrição ou data, viram null', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/tarefas`]: () => respostaJson({ tarefas: [{ titulo: '[PED] Construir dashboard: PED Supervisores' }] }) })

      await expect(listarTarefasDashboard(3)).resolves.toEqual([
        { id: null, tipo: null, status: null, titulo: '[PED] Construir dashboard: PED Supervisores', descricao: null, criadaEm: null },
      ])
    })

    it('item sem título ou resposta fora do formato vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/2/tarefas`]: () => respostaJson([{ id: 21, status: 'concluida' }]) })
      await expect(listarTarefasDashboard(2)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })

      simularApi(fetchFalso, { [`GET ${ROTA}/2/tarefas`]: () => respostaJson('nenhuma') })
      await expect(listarTarefasDashboard(2)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarTarefasDashboard(2)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
