import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { adiado, criarApiConsultaImagensFalsa } from '../../test/consultaImagensFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { useConsultaImagens } from './useConsultaImagens'

const ROTA = '/api/ped/imagens'

/**
 * F10.6 — Hook da consulta retroativa de imagens (`src/pages/fechamentos/useConsultaImagens.ts`; RF-84, RN-18).
 *
 * `useConsultaImagens()` (sem parâmetros) devolve:
 * - `codigoFilial: string | null` — filial do cabeçalho (`useSessao().filialSelecionada`); `null` com
 *   "Todas as filiais" (ou sem filial), quando a consulta vai sem `filial` (Admin e Validador veem todas — A-05);
 * - `imagens: ImagemDaConsulta[]` — resultado com os filtros atuais, na ordem da API;
 * - `total: number` — imagens da filial **sem** os filtros de período, tipo e busca ("X de Y imagens");
 * - `periodos: string[]` — períodos distintos das imagens da filial (sem os filtros), na ordem em que
 *   aparecem na resposta da API (mais recentes primeiro); são as opções do filtro de período;
 * - `filtros: { periodo: string; tipo: TipoImagem | 'todas'; busca: string }` — padrão
 *   `{ periodo: '', tipo: 'todas', busca: '' }` (`periodo` vazio = todos os períodos);
 * - `filtrosAtivos: boolean` — algum filtro diferente do padrão;
 * - `definirFiltro('periodo' | 'tipo', valor)` consulta na hora; `setBusca(texto)` atualiza a busca na
 *   hora e consulta 500 ms após a última digitação; `limparFiltros()` volta ao padrão e consulta;
 * - `carregando`, `erro` (mensagem em pt-BR) e `recarregar()`.
 * Os filtros vão à API (`listarImagens`: `?filial=&periodo=&tipo=&busca=`). Trocar a filial do cabeçalho
 * consulta de novo, mantendo os filtros. Só a resposta da consulta mais recente é aplicada.
 */
describe('F10.6 — useConsultaImagens (consulta retroativa de imagens congeladas)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  const validador = () => acessoFalso({ perfil: 'validador', todasAsFiliais: true, filiais: FILIAIS })

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: admin(), filialSelecionada: 'todas' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function simular(rotas: Record<string, RotaFalsa> = {}) {
    const api = criarApiConsultaImagensFalsa()
    return simularApi(fetchFalso, { ...api.rotas, ...rotas })
  }

  function renderizar() {
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => useConsultaImagens(), { wrapper })
  }

  const getsImagens = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const ultimoGet = (chamadas: ChamadaRegistrada[]) => getsImagens(chamadas).at(-1)!
  const parametros = (chamada: ChamadaRegistrada) => Object.fromEntries(chamada.url.searchParams.entries())
  const codigos = (imagens: { codigo: string }[]) => imagens.map((i) => i.codigo)

  describe('carga e filial do cabeçalho (RF-84, A-05)', () => {
    it('Admin com "Todas as filiais": codigoFilial null, GET sem filial e todas as imagens na ordem da API', async () => {
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.codigoFilial).toBeNull()
      expect(result.current.erro).toBeNull()
      expect(codigos(result.current.imagens)).toEqual(['IMG-000004', 'IMG-000003', 'IMG-000002', 'IMG-000001'])
      expect(result.current.total).toBe(4)
      expect(getsImagens(chamadas).length).toBeGreaterThan(0)
      for (const chamada of getsImagens(chamadas)) expect(parametros(chamada)).toEqual({})
    })

    it('filtros começam no padrão (todos os períodos, todos os tipos, sem busca) e filtrosAtivos é false', async () => {
      simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.filtros).toEqual({ periodo: '', tipo: 'todas', busca: '' })
      expect(result.current.filtrosAtivos).toBe(false)
    })

    it('periodos: períodos distintos das imagens, na ordem em que aparecem na resposta', async () => {
      simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.periodos).toEqual(['10/2026', '3º tri/2026']))
    })

    it('Validador também consulta todas as filiais (A-05)', async () => {
      sessao = { acesso: validador(), filialSelecionada: 'todas' }
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      for (const chamada of getsImagens(chamadas)) expect(parametros(chamada)).toEqual({})
    })

    it('sem filial selecionada (null) consulta como "Todas as filiais"', async () => {
      sessao = { acesso: admin(), filialSelecionada: null }
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      expect(result.current.codigoFilial).toBeNull()
      for (const chamada of getsImagens(chamadas)) expect(chamada.url.searchParams.has('filial')).toBe(false)
    })

    it('com uma filial no cabeçalho: toda consulta vai com ?filial={código} e só as imagens dela aparecem', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[0] }
      const chamadas = simular()

      const { result } = renderizar()

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000003', 'IMG-000001']))
      expect(result.current.codigoFilial).toBe('100')
      expect(result.current.total).toBe(2)
      expect(result.current.periodos).toEqual(['10/2026', '3º tri/2026'])
      for (const chamada of getsImagens(chamadas)) expect(parametros(chamada)).toEqual({ filial: '100' })
    })

    it('trocar a filial do cabeçalho consulta de novo; voltar a "Todas" consulta sem filial', async () => {
      const chamadas = simular()
      const { result, rerender } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[2] }
      rerender()

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000004']))
      expect(result.current.codigoFilial).toBe('102')
      expect(result.current.total).toBe(1)
      expect(result.current.periodos).toEqual(['10/2026'])
      expect(parametros(ultimoGet(chamadas))).toEqual({ filial: '102' })

      sessao = { acesso: admin(), filialSelecionada: 'todas' }
      rerender()

      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      expect(parametros(ultimoGet(chamadas))).toEqual({})
    })

    it('a troca de filial mantém os filtros escolhidos', async () => {
      const chamadas = simular()
      const { result, rerender } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      act(() => result.current.definirFiltro('tipo', 'colaborador'))
      await waitFor(() => expect(result.current.imagens).toHaveLength(2))

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[0] }
      rerender()

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000003']))
      expect(result.current.filtros.tipo).toBe('colaborador')
      expect(parametros(ultimoGet(chamadas))).toEqual({ filial: '100', tipo: 'colaborador' })
    })

    it('só a resposta da consulta mais recente é aplicada (troca de filial com resposta lenta da anterior)', async () => {
      const lenta = adiado<void>()
      const api = criarApiConsultaImagensFalsa()
      const rotaNormal = api.rotas[`GET ${ROTA}`]
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[0] }
      simularApi(fetchFalso, {
        ...api.rotas,
        [`GET ${ROTA}`]: (init, url) =>
          url.searchParams.get('filial') === '100' ? lenta.promessa.then(() => rotaNormal(init, url)) : rotaNormal(init, url),
      })
      const { result, rerender } = renderizar()

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
      rerender()
      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000002']))

      await act(async () => {
        lenta.resolver()
        await new Promise((r) => setTimeout(r, 20))
      })

      expect(codigos(result.current.imagens)).toEqual(['IMG-000002'])
      expect(result.current.total).toBe(1)
      expect(result.current.codigoFilial).toBe('101')
    })
  })

  describe('filtros (RF-84; ?tipo= da A-07)', () => {
    it('período: consulta na hora com ?periodo= e mantém total e opções de período sem o filtro', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))

      act(() => result.current.definirFiltro('periodo', '3º tri/2026'))

      expect(result.current.filtros.periodo).toBe('3º tri/2026')
      expect(result.current.filtrosAtivos).toBe(true)
      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000002', 'IMG-000001']))
      expect(parametros(ultimoGet(chamadas))).toEqual({ periodo: '3º tri/2026' })
      expect(result.current.total).toBe(4)
      expect(result.current.periodos).toEqual(['10/2026', '3º tri/2026'])
    })

    it('tipo "colaborador": consulta com ?tipo=colaborador e só as imagens de colaborador', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))

      act(() => result.current.definirFiltro('tipo', 'colaborador'))

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000004', 'IMG-000003']))
      expect(parametros(ultimoGet(chamadas))).toEqual({ tipo: 'colaborador' })
      expect(result.current.filtrosAtivos).toBe(true)
    })

    it('tipo "filial": consulta com ?tipo=filial e só as imagens de filial', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))

      act(() => result.current.definirFiltro('tipo', 'filial'))

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000002', 'IMG-000001']))
      expect(parametros(ultimoGet(chamadas))).toEqual({ tipo: 'filial' })
    })

    it('busca: atualiza filtros.busca na hora, não consulta antes da espera e consulta com ?busca= depois de 500 ms', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      const antes = getsImagens(chamadas).length

      act(() => result.current.setBusca('diego'))

      expect(result.current.filtros.busca).toBe('diego')
      expect(result.current.filtrosAtivos).toBe(true)
      expect(getsImagens(chamadas)).toHaveLength(antes)
      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000004']))
      expect(parametros(ultimoGet(chamadas))).toEqual({ busca: 'diego' })
      expect(result.current.total).toBe(4)
    })

    it('busca digitada em sequência consulta uma vez só, com o último texto', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      const antes = getsImagens(chamadas).length

      act(() => result.current.setBusca('a'))
      act(() => result.current.setBusca('an'))
      act(() => result.current.setBusca('ana souza'))

      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000003']))
      const comBusca = getsImagens(chamadas).slice(antes).filter((c) => c.url.searchParams.has('busca'))
      expect(comBusca.map((c) => c.url.searchParams.get('busca'))).toEqual(['ana souza'])
    })

    it('período, tipo e busca juntos vão na mesma consulta, com a filial do cabeçalho', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[0] }
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(2))

      act(() => result.current.definirFiltro('periodo', '10/2026'))
      act(() => result.current.definirFiltro('tipo', 'colaborador'))
      act(() => result.current.setBusca('ana'))

      await waitFor(() =>
        expect(parametros(ultimoGet(chamadas))).toEqual({ filial: '100', periodo: '10/2026', tipo: 'colaborador', busca: 'ana' }),
      )
      await waitFor(() => expect(codigos(result.current.imagens)).toEqual(['IMG-000003']))
    })

    it('filtro sem resultado: imagens vazias, total e períodos mantidos', async () => {
      simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))

      act(() => result.current.setBusca('inexistente'))

      await waitFor(() => expect(result.current.imagens).toEqual([]))
      expect(result.current.total).toBe(4)
      expect(result.current.periodos).toEqual(['10/2026', '3º tri/2026'])
      expect(result.current.erro).toBeNull()
    })

    it('limparFiltros: volta ao padrão, consulta sem período, tipo e busca e mostra todas', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      act(() => result.current.definirFiltro('periodo', '3º tri/2026'))
      act(() => result.current.definirFiltro('tipo', 'filial'))
      await waitFor(() => expect(result.current.imagens).toHaveLength(2))

      act(() => result.current.limparFiltros())

      expect(result.current.filtros).toEqual({ periodo: '', tipo: 'todas', busca: '' })
      expect(result.current.filtrosAtivos).toBe(false)
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      expect(parametros(ultimoGet(chamadas))).toEqual({})
    })
  })

  describe('erros e somente leitura (RN-18)', () => {
    it('erro HTTP: mensagem em pt-BR em erro, sem imagens; recarregar() consulta de novo e limpa o erro', async () => {
      let falhar = true
      const api = criarApiConsultaImagensFalsa()
      simularApi(fetchFalso, {
        ...api.rotas,
        [`GET ${ROTA}`]: (init, url) => (falhar ? respostaErro(500) : api.rotas[`GET ${ROTA}`](init, url)),
      })
      const { result } = renderizar()

      await waitFor(() => expect(result.current.erro).toBe(mensagemPadraoPorStatus(500)))
      expect(result.current.imagens).toEqual([])
      expect(result.current.carregando).toBe(false)

      falhar = false
      act(() => result.current.recarregar())

      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      expect(result.current.erro).toBeNull()
      expect(result.current.total).toBe(4)
    })

    it('falha de rede: erro com a mensagem de sem conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      const { result } = renderizar()

      await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
      expect(result.current.imagens).toEqual([])
    })

    it('a consulta só lê: todas as chamadas são GET', async () => {
      const chamadas = simular()
      const { result } = renderizar()
      await waitFor(() => expect(result.current.imagens).toHaveLength(4))
      act(() => result.current.definirFiltro('tipo', 'filial'))
      await waitFor(() => expect(result.current.imagens).toHaveLength(2))

      expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true)
    })
  })
})
