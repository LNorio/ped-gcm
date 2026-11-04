import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO } from '../services/api'
import { useFiltrosConsulta } from './useFiltrosConsulta'

type Situacao = 'todas' | 'ativos' | 'inativos'

interface Filtros {
  busca: string
  situacao: Situacao
  tipo: number | null
}

const PADRAO: Filtros = { busca: '', situacao: 'todas', tipo: null }

/** Atraso padrão da busca (decisão de 04/11/2026). */
const ATRASO_PADRAO_MS = 500

type Carregar = (filtros: Filtros) => Promise<string[]>

/** Resultado "eco": permite ver na lista com quais filtros a consulta foi feita. */
function eco(filtros: Filtros): string[] {
  return [`${filtros.busca}|${filtros.situacao}|${filtros.tipo ?? '-'}`]
}

/** Promessa controlada pelo teste, para simular uma consulta lenta. */
function controlavel<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((res) => {
    resolver = res
  })
  return { promessa, resolver: (valor: T) => resolver(valor) }
}

describe('F1.14 — useFiltrosConsulta (filtros de consulta com espera na busca)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Avança o relógio falso e deixa as promessas resolverem. */
  async function avancar(ms = ATRASO_PADRAO_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  async function montar(carregar = vi.fn<Carregar>(async (f) => eco(f)), atrasoBuscaMs?: number) {
    const resultado = renderHook(() =>
      useFiltrosConsulta<Filtros, string[]>({
        carregar,
        inicial: [],
        filtrosPadrao: PADRAO,
        ...(atrasoBuscaMs === undefined ? {} : { atrasoBuscaMs }),
      }),
    )
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, carregar }
  }

  describe('carga inicial', () => {
    it('começa com dados = inicial, carregando, sem erro, filtros = filtrosPadrao e consulta uma vez com os filtros padrão', async () => {
      const pendente = controlavel<string[]>()
      const carregar = vi.fn<Carregar>().mockReturnValue(pendente.promessa)

      const { result } = renderHook(() =>
        useFiltrosConsulta<Filtros, string[]>({ carregar, inicial: ['inicial'], filtrosPadrao: PADRAO }),
      )

      expect(result.current.dados).toEqual(['inicial'])
      expect(result.current.carregando).toBe(true)
      expect(result.current.carregouUmaVez).toBe(false)
      expect(result.current.erro).toBeNull()
      expect(result.current.filtros).toEqual(PADRAO)
      expect(carregar).toHaveBeenCalledTimes(1)
      expect(carregar).toHaveBeenLastCalledWith(PADRAO)

      await act(async () => {
        pendente.resolver(['carregado'])
      })

      expect(result.current.dados).toEqual(['carregado'])
      expect(result.current.carregando).toBe(false)
      expect(result.current.carregouUmaVez).toBe(true)
    })

    it('falha na consulta vira mensagem em erro (ApiError → mensagem; outro erro → mensagem genérica)', async () => {
      const carregar = vi
        .fn<Carregar>()
        .mockRejectedValueOnce(new ApiError(500, 'Falha ao consultar.'))
        .mockRejectedValueOnce(new Error('detalhe técnico'))
      const { result } = await montar(carregar)

      expect(result.current.erro).toBe('Falha ao consultar.')
      expect(result.current.carregouUmaVez).toBe(true)

      await act(async () => {
        await result.current.recarregar()
      })
      expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('re-renderizar com novas referências de carregar e filtrosPadrao não dispara nova consulta; a próxima consulta usa o carregar mais recente', async () => {
      const primeiro = vi.fn<Carregar>(async (f) => eco(f))
      const segundo = vi.fn<Carregar>(async () => ['do segundo'])
      const { result, rerender } = renderHook(
        ({ carregar }: { carregar: Carregar }) =>
          useFiltrosConsulta<Filtros, string[]>({ carregar, inicial: [], filtrosPadrao: { ...PADRAO } }),
        { initialProps: { carregar: primeiro } },
      )
      await waitFor(() => expect(result.current.carregando).toBe(false))

      rerender({ carregar: segundo })
      rerender({ carregar: segundo })
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(primeiro).toHaveBeenCalledTimes(1)
      expect(segundo).not.toHaveBeenCalled()

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      await waitFor(() => expect(result.current.dados).toEqual(['do segundo']))
      expect(primeiro).toHaveBeenCalledTimes(1)
      expect(segundo).toHaveBeenCalledTimes(1)
    })
  })

  describe('setBusca (com espera)', () => {
    it('atualiza filtros.busca na hora e só consulta após a espera de 500 ms, com a busca digitada', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      expect(result.current.filtros).toEqual({ ...PADRAO, busca: 'visitas' })

      await avancar(ATRASO_PADRAO_MS - 100)
      expect(carregar).toHaveBeenCalledTimes(1)

      await avancar(100)
      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(2))
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, busca: 'visitas' })
      await waitFor(() => expect(result.current.dados).toEqual(['visitas|todas|-']))
    })

    it('mudanças rápidas reiniciam a espera: uma única consulta com o último texto, 500 ms após a última mudança', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('a')
      })
      await avancar(200)
      act(() => {
        result.current.setBusca('ab')
      })
      await avancar(200)
      act(() => {
        result.current.setBusca('abc')
      })
      await avancar(ATRASO_PADRAO_MS - 100)
      expect(carregar).toHaveBeenCalledTimes(1)

      await avancar(100)
      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(2))
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, busca: 'abc' })

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(2)
    })

    it('voltar ao texto da última consulta durante a espera cancela a espera e não consulta', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('vis')
      })
      await avancar(100)
      act(() => {
        result.current.setBusca('')
      })
      expect(result.current.filtros.busca).toBe('')

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('a "última consulta" acompanha qualquer consulta: após consultar "abc", digitar "abcd" e voltar a "abc" não consulta', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('abc')
      })
      await avancar()
      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(2))

      act(() => {
        result.current.setBusca('abcd')
      })
      await avancar(100)
      act(() => {
        result.current.setBusca('abc')
      })
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(result.current.filtros.busca).toBe('abc')
    })

    it('setBusca com o mesmo valor atual não consulta', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('')
      })
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('atrasoBuscaMs personalizado substitui os 500 ms', async () => {
      const { result, carregar } = await montar(undefined, 1000)

      act(() => {
        result.current.setBusca('x')
      })
      await avancar(900)
      expect(carregar).toHaveBeenCalledTimes(1)

      await avancar(100)
      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(2))
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, busca: 'x' })
    })

    it('desmontar durante a espera cancela a consulta pendente, sem erro no console', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result, carregar, unmount } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      unmount()
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(carregar).toHaveBeenCalledTimes(1)
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  describe('definirFiltro (consulta na hora)', () => {
    it('atualiza o filtro e consulta na hora com todos os filtros atuais', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      expect(result.current.filtros).toEqual({ ...PADRAO, situacao: 'ativos' })
      expect(carregar).toHaveBeenCalledTimes(2)
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, situacao: 'ativos' })
      await waitFor(() => expect(result.current.dados).toEqual(['|ativos|-']))

      act(() => {
        result.current.definirFiltro('tipo', 7)
      })
      expect(carregar).toHaveBeenCalledTimes(3)
      expect(carregar).toHaveBeenLastCalledWith({ busca: '', situacao: 'ativos', tipo: 7 })
      await waitFor(() => expect(result.current.dados).toEqual(['|ativos|7']))
    })

    it('mesmo valor, sem espera pendente, não consulta', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.definirFiltro('situacao', 'todas')
      })
      act(() => {
        result.current.definirFiltro('tipo', null)
      })
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('durante a espera da busca, consulta na hora já com a busca digitada e cancela a consulta da espera', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      await avancar(100)
      act(() => {
        result.current.definirFiltro('situacao', 'inativos')
      })

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(carregar).toHaveBeenLastCalledWith({ busca: 'visitas', situacao: 'inativos', tipo: null })

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(2)
    })

    it('mesmo valor durante a espera da busca também consulta na hora (com a busca digitada) e cancela a espera', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      await avancar(100)
      act(() => {
        result.current.definirFiltro('situacao', 'todas')
      })

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, busca: 'visitas' })

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(2)
    })

    it('proteção de corrida: a resposta atrasada de um filtro antigo não sobrescreve a do filtro atual', async () => {
      const lenta = controlavel<string[]>()
      const carregar = vi
        .fn<Carregar>(async (f) => eco(f))
        .mockImplementationOnce(async (f) => eco(f))
        .mockImplementationOnce(() => lenta.promessa)
      const { result } = await montar(carregar)

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      act(() => {
        result.current.definirFiltro('situacao', 'inativos')
      })
      await waitFor(() => expect(result.current.dados).toEqual(['|inativos|-']))

      await act(async () => {
        lenta.resolver(['antigo'])
      })

      expect(result.current.dados).toEqual(['|inativos|-'])
      expect(result.current.carregando).toBe(false)
    })
  })

  describe('limparFiltros', () => {
    it('volta aos filtros padrão e consulta na hora com eles', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      act(() => {
        result.current.definirFiltro('tipo', 3)
      })
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(carregar).toHaveBeenCalledTimes(3)

      act(() => {
        result.current.limparFiltros()
      })

      expect(result.current.filtros).toEqual(PADRAO)
      expect(carregar).toHaveBeenCalledTimes(4)
      expect(carregar).toHaveBeenLastCalledWith(PADRAO)
      await waitFor(() => expect(result.current.dados).toEqual(['|todas|-']))
    })

    it('durante a espera da busca, limpa, consulta na hora sem busca e cancela a consulta da espera', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      await avancar(100)
      act(() => {
        result.current.limparFiltros()
      })

      expect(result.current.filtros).toEqual(PADRAO)
      expect(carregar).toHaveBeenCalledTimes(2)
      expect(carregar).toHaveBeenLastCalledWith(PADRAO)

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(2)
    })

    it('com os filtros já no padrão e sem espera pendente, não faz nada', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.limparFiltros()
      })
      await avancar(ATRASO_PADRAO_MS * 2)

      expect(carregar).toHaveBeenCalledTimes(1)
      expect(result.current.filtros).toEqual(PADRAO)
    })

    it('não altera o objeto filtrosPadrao recebido', async () => {
      const { result } = await montar()

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      act(() => {
        result.current.limparFiltros()
      })
      act(() => {
        result.current.definirFiltro('tipo', 9)
      })

      expect(PADRAO).toEqual({ busca: '', situacao: 'todas', tipo: null })
    })
  })

  describe('recarregar', () => {
    it('consulta com os filtros atuais e resolve depois da resposta', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.definirFiltro('tipo', 2)
      })
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await result.current.recarregar()
      })

      expect(carregar).toHaveBeenCalledTimes(3)
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, tipo: 2 })
      expect(result.current.carregando).toBe(false)
    })

    it('durante a espera da busca, consulta na hora com a busca digitada e cancela a espera', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      await avancar(100)
      await act(async () => {
        await result.current.recarregar()
      })

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, busca: 'visitas' })

      await avancar(ATRASO_PADRAO_MS * 2)
      expect(carregar).toHaveBeenCalledTimes(2)
    })

    it('nunca rejeita: a falha vai para erro, que é limpo na próxima consulta bem-sucedida', async () => {
      const carregar = vi
        .fn<Carregar>(async (f) => eco(f))
        .mockImplementationOnce(async (f) => eco(f))
        .mockRejectedValueOnce(new ApiError(503, 'Serviço indisponível.'))
      const { result } = await montar(carregar)

      await act(async () => {
        await expect(result.current.recarregar()).resolves.toBeUndefined()
      })
      expect(result.current.erro).toBe('Serviço indisponível.')

      await act(async () => {
        await result.current.recarregar()
      })
      expect(result.current.erro).toBeNull()
      expect(result.current.dados).toEqual(['|todas|-'])
    })
  })

  describe('setDados (alteração local)', () => {
    it('sem consulta pendente, só troca os dados', async () => {
      const { result, carregar } = await montar()

      act(() => {
        result.current.setDados((atual) => [...atual, 'local'])
      })

      expect(result.current.dados).toEqual(['|todas|-', 'local'])
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('com consulta pendente, descarta o resultado pendente e reconsulta uma vez quando ele chega (recarga após mutação)', async () => {
      const lenta = controlavel<string[]>()
      const carregar = vi
        .fn<Carregar>(async () => ['depois da mutação'])
        .mockImplementationOnce(async (f) => eco(f))
        .mockImplementationOnce(() => lenta.promessa)
      const { result } = await montar(carregar)

      act(() => {
        result.current.definirFiltro('situacao', 'ativos')
      })
      act(() => {
        result.current.setDados(['local'])
      })
      expect(result.current.dados).toEqual(['local'])

      await act(async () => {
        lenta.resolver(['antigo'])
      })

      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(3))
      expect(carregar).toHaveBeenLastCalledWith({ ...PADRAO, situacao: 'ativos' })
      await waitFor(() => expect(result.current.dados).toEqual(['depois da mutação']))
      expect(result.current.carregando).toBe(false)
    })
  })
})
