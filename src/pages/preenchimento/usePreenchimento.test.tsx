import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { mesesPreenchimentoApi, telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usePreenchimento } from './usePreenchimento'

const ROTA_TELA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

/**
 * Hook da aba Preenchimento (F9.2 — RF-60): a filial vem do cabeçalho (`useSessao().filialSelecionada`).
 * - Sem filial (`'todas'` ou `null`): `codigoFilial` `null`, nenhuma consulta, `tela` `null`, sem carga.
 * - Com filial: consulta `obterPreenchimento({ filial })` (sem mês = mês aberto) e os meses do ano do
 *   período aberto; trocar a filial consulta de novo; voltar a "Todas" limpa a tela.
 * - Erro de carga em `erro` (mensagem em pt-BR); `recarregar()` repete a consulta.
 * Relógio fixo em 13/11/2026 (só `Date`), pois o serviço dos meses limita o ano ao ano atual.
 */
describe('F9.2 — usePreenchimento (filial obrigatória e carga da tela do mês)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: acessoFalso(), filialSelecionada: FILIAIS[1] }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })

  function simular(rotas: Record<string, RotaFalsa> = {}) {
    return simularApi(fetchFalso, {
      [`GET ${ROTA_TELA}`]: () => respostaJson(telaPreenchimentoApi()),
      [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi()),
      ...rotas,
    })
  }

  function renderizar() {
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => usePreenchimento(), { wrapper })
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)

  describe('sem filial (RF-60)', () => {
    it('Admin com "Todas as filiais": codigoFilial null, tela null, sem carga e nenhuma chamada', async () => {
      sessao = { acesso: admin(), filialSelecionada: 'todas' }
      const chamadas = simular()

      const { result } = renderizar()

      expect(result.current.codigoFilial).toBeNull()
      expect(result.current.tela).toBeNull()
      expect(result.current.carregando).toBe(false)
      expect(result.current.erro).toBeNull()
      // Dá tempo a um eventual efeito assíncrono.
      await new Promise((resolver) => setTimeout(resolver, 20))
      expect(chamadas).toHaveLength(0)
    })

    it('filial null também não consulta', async () => {
      sessao = { acesso: acessoFalso({ filiais: [] }), filialSelecionada: null }
      const chamadas = simular()

      const { result } = renderizar()

      expect(result.current.codigoFilial).toBeNull()
      await new Promise((resolver) => setTimeout(resolver, 20))
      expect(chamadas).toHaveLength(0)
    })
  })

  describe('com filial', () => {
    it('começa carregando, sem tela e sem erro', () => {
      simular()

      const { result } = renderizar()

      expect(result.current.codigoFilial).toBe('101')
      expect(result.current.carregando).toBe(true)
      expect(result.current.tela).toBeNull()
      expect(result.current.erro).toBeNull()
    })

    it('Preenchedor: consulta a própria filial (101), sem mês (o mês aberto) e sem busca, e expõe a tela convertida', async () => {
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(gets(chamadas, ROTA_TELA)).toHaveLength(1)
      const query = gets(chamadas, ROTA_TELA)[0].url.searchParams
      expect(query.get('filial')).toBe('101')
      expect(query.has('mes_de_referencia')).toBe(false)
      expect(query.has('busca')).toBe(false)
      expect(result.current.tela).toEqual(
        expect.objectContaining({ filial: '101', nomeFilial: 'CAMPO GRANDE', mesDeReferencia: '2026-10-01', situacaoDoMes: 'aberto', editavel: true }),
      )
      expect(result.current.tela?.tipos.map((tipo) => tipo.nome)).toEqual(['Comercial', 'Financeiro'])
    })

    it('Admin com uma filial escolhida no cabeçalho consulta ?filial={código}', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[2] }
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.codigoFilial).toBe('102')
      expect(gets(chamadas, ROTA_TELA)[0].url.searchParams.get('filial')).toBe('102')
    })

    it('trocar a filial do cabeçalho consulta de novo com a nova filial', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
      const chamadas = simular()
      const { result, rerender } = renderizar()
      await waitFor(() => expect(result.current.carregando).toBe(false))

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[2] }
      rerender()

      await waitFor(() => expect(gets(chamadas, ROTA_TELA)).toHaveLength(2))
      expect(gets(chamadas, ROTA_TELA)[1].url.searchParams.get('filial')).toBe('102')
      await waitFor(() => expect(result.current.codigoFilial).toBe('102'))
    })

    it('voltar a "Todas as filiais" limpa a tela e não consulta', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
      const chamadas = simular()
      const { result, rerender } = renderizar()
      await waitFor(() => expect(result.current.tela).not.toBeNull())
      const antes = gets(chamadas, ROTA_TELA).length

      sessao = { acesso: admin(), filialSelecionada: 'todas' }
      rerender()

      await waitFor(() => expect(result.current.tela).toBeNull())
      expect(result.current.codigoFilial).toBeNull()
      expect(gets(chamadas, ROTA_TELA)).toHaveLength(antes)
    })
  })

  describe('erros de carga', () => {
    it('erro da API: erro com a mensagem, sem tela, carregamento encerrado', async () => {
      simular({ [`GET ${ROTA_TELA}`]: () => respostaErro(500, 'Falha ao consultar o preenchimento.') })

      const { result } = renderizar()

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe('Falha ao consultar o preenchimento.')
      expect(result.current.tela).toBeNull()
    })

    it('falha de rede: "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      const { result } = renderizar()

      await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
    })

    it('recarregar() consulta de novo, limpa o erro e expõe a tela', async () => {
      let falhar = true
      const chamadas = simular({
        [`GET ${ROTA_TELA}`]: () => (falhar ? respostaErro(500, 'Falhou.') : respostaJson(telaPreenchimentoApi())),
      })
      const { result } = renderizar()
      await waitFor(() => expect(result.current.erro).toBe('Falhou.'))

      falhar = false
      await act(() => result.current.recarregar())

      await waitFor(() => expect(result.current.tela).not.toBeNull())
      expect(result.current.erro).toBeNull()
      expect(gets(chamadas, ROTA_TELA).length).toBeGreaterThanOrEqual(2)
    })
  })
})
