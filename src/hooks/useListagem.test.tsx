import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO, MENSAGEM_SEM_CONEXAO } from '../services/api'
import { useListagem } from './useListagem'

interface Item {
  id: number
  nome: string
}

const LISTA_A: Item[] = [
  { id: 1, nome: 'Comercial' },
  { id: 2, nome: 'Financeiro' },
  { id: 8, nome: 'Logística' },
]
const LISTA_B: Item[] = [
  { id: 1, nome: 'Comercial' },
  { id: 2, nome: 'Financeiro' },
]

/** Promessa controlada pelo teste, para simular respostas lentas e fora de ordem. */
function controlavel<T>() {
  let resolver: (valor: T) => void = () => {}
  let rejeitar: (erro: unknown) => void = () => {}
  const promessa = new Promise<T>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver: (valor: T) => resolver(valor), rejeitar: (erro: unknown) => rejeitar(erro) }
}

describe('F1.12 — useListagem (hook genérico de listagem)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('carga inicial', () => {
    it('começa carregando, com itens vazios e sem erro, e chama carregar uma vez ao montar', () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockReturnValue(controlavel<Item[]>().promessa)

      const { result } = renderHook(() => useListagem(carregar))

      expect(result.current.carregando).toBe(true)
      expect(result.current.itens).toEqual([])
      expect(result.current.erro).toBeNull()
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('quando carregar resolve, expõe a lista, encerra o carregamento e mantém erro nulo', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.itens).toEqual(LISTA_A)
      expect(result.current.erro).toBeNull()
    })

    it('lista vazia resulta em itens [] sem erro', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue([])

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.itens).toEqual([])
      expect(result.current.erro).toBeNull()
    })

    it('ApiError: erro recebe a mensagem da ApiError, carregamento encerra e itens ficam vazios', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockRejectedValue(new ApiError(500, 'Falha ao consultar.'))

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe('Falha ao consultar.')
      expect(result.current.itens).toEqual([])
    })

    it('ApiError de rede (status 0) expõe a mensagem de conexão', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockRejectedValue(new ApiError(0, MENSAGEM_SEM_CONEXAO))

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
    })

    it('erro que não é ApiError expõe a mensagem unificada de erro inesperado', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockRejectedValue(new Error('Cannot read properties of undefined'))

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
      expect(result.current.itens).toEqual([])
    })

    it('a carga inicial não propaga a rejeição de carregar (sem rejeição não tratada)', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const carregar = vi.fn<() => Promise<Item[]>>().mockRejectedValue(new Error('falhou'))

      const { result } = renderHook(() => useListagem(carregar))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      await act(async () => {})
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  describe('recarregar()', () => {
    it('chama carregar de novo e aplica a nova lista', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValueOnce(LISTA_A).mockResolvedValueOnce(LISTA_B)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.itens).toEqual(LISTA_A))

      await act(async () => {
        await result.current.recarregar()
      })

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(result.current.itens).toEqual(LISTA_B)
      expect(result.current.carregando).toBe(false)
      expect(result.current.erro).toBeNull()
    })

    it('indica carregando enquanto a nova chamada não termina e volta a false ao concluir', async () => {
      const lenta = controlavel<Item[]>()
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValueOnce(LISTA_A).mockReturnValueOnce(lenta.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))

      await act(async () => {
        lenta.resolver(LISTA_B)
        await promessa
      })

      expect(result.current.carregando).toBe(false)
      expect(result.current.itens).toEqual(LISTA_B)
    })

    it('resolve sem valor quando a carga tem sucesso', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let retorno: unknown = 'não resolvido'
      await act(async () => {
        retorno = await result.current.recarregar()
      })

      expect(retorno).toBeUndefined()
    })

    it('não rejeita quando carregar falha: a mensagem vai para erro', async () => {
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockResolvedValueOnce(LISTA_A)
        .mockRejectedValueOnce(new ApiError(500, 'Falha temporária.'))
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await expect(result.current.recarregar()).resolves.toBeUndefined()
      })

      expect(result.current.erro).toBe('Falha temporária.')
      expect(result.current.carregando).toBe(false)
    })

    it('não rejeita quando carregar falha com erro que não é ApiError (mensagem unificada)', async () => {
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockResolvedValueOnce(LISTA_A)
        .mockRejectedValueOnce(new TypeError('boom'))
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await expect(result.current.recarregar()).resolves.toBeUndefined()
      })

      expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('depois de um erro, mantém a mensagem enquanto a nova carga está em andamento e a limpa no sucesso', async () => {
      const lenta = controlavel<Item[]>()
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockRejectedValueOnce(new ApiError(500, 'Falha temporária.'))
        .mockReturnValueOnce(lenta.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.erro).toBe('Falha temporária.'))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))
      // A tela usa erro + carregando para manter o alerta visível com "Tentar novamente" desabilitado.
      expect(result.current.erro).toBe('Falha temporária.')

      await act(async () => {
        lenta.resolver(LISTA_A)
        await promessa
      })

      expect(result.current.erro).toBeNull()
      expect(result.current.itens).toEqual(LISTA_A)
      expect(result.current.carregando).toBe(false)
    })

    it('um novo erro substitui a mensagem anterior', async () => {
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockRejectedValueOnce(new ApiError(500, 'Primeira falha.'))
        .mockRejectedValueOnce(new ApiError(503, 'Segunda falha.'))
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.erro).toBe('Primeira falha.'))

      await act(async () => {
        await result.current.recarregar()
      })

      expect(result.current.erro).toBe('Segunda falha.')
    })
  })

  describe('proteção de corrida', () => {
    it('duas chamadas de recarregar: só o resultado da última é aplicado, mesmo que a primeira resolva depois', async () => {
      const primeira = controlavel<Item[]>()
      const segunda = controlavel<Item[]>()
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })
      expect(carregar).toHaveBeenCalledTimes(3)

      // A segunda (última) chamada responde primeiro.
      await act(async () => {
        segunda.resolver(LISTA_B)
        await promessa2
      })
      expect(result.current.itens).toEqual(LISTA_B)
      expect(result.current.carregando).toBe(false)

      // A primeira chega atrasada com dados antigos e deve ser ignorada.
      await act(async () => {
        primeira.resolver(LISTA_A)
        await promessa1
      })
      expect(result.current.itens).toEqual(LISTA_B)
      expect(result.current.carregando).toBe(false)
      expect(result.current.erro).toBeNull()
    })

    it('falha atrasada de uma chamada antiga não sobrescreve o sucesso da última', async () => {
      const primeira = controlavel<Item[]>()
      const segunda = controlavel<Item[]>()
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })

      await act(async () => {
        segunda.resolver(LISTA_A)
        await promessa2
      })
      await act(async () => {
        primeira.rejeitar(new ApiError(500, 'Falha antiga.'))
        await promessa1
      })

      expect(result.current.erro).toBeNull()
      expect(result.current.itens).toEqual(LISTA_A)
      expect(result.current.carregando).toBe(false)
    })

    it('enquanto a última chamada não responde, continua carregando mesmo que uma antiga tenha respondido', async () => {
      const primeira = controlavel<Item[]>()
      const segunda = controlavel<Item[]>()
      const carregar = vi
        .fn<() => Promise<Item[]>>()
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })

      await act(async () => {
        primeira.resolver(LISTA_A)
        await promessa1
      })
      expect(result.current.carregando).toBe(true)
      expect(result.current.itens).toEqual([])

      await act(async () => {
        segunda.resolver(LISTA_B)
        await promessa2
      })
      expect(result.current.carregando).toBe(false)
      expect(result.current.itens).toEqual(LISTA_B)
    })

    it('alteração local via setItens durante uma carga em andamento prevalece sobre o resultado antigo', async () => {
      const lenta = controlavel<Item[]>()
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValueOnce(LISTA_A).mockReturnValueOnce(lenta.promessa)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.itens).toEqual(LISTA_A))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      // Ex.: exclusão confirmada pela API enquanto um GET antigo ainda está no ar.
      act(() => {
        result.current.setItens((atual) => atual.filter((item) => item.id !== 8))
      })
      expect(result.current.itens.map((item) => item.id)).toEqual([1, 2])

      await act(async () => {
        lenta.resolver(LISTA_A) // lista antiga, ainda com o id 8
        await promessa
      })

      expect(result.current.itens.map((item) => item.id)).toEqual([1, 2])
      expect(result.current.carregando).toBe(false)
      expect(result.current.erro).toBeNull()
    })
  })

  describe('referência de carregar', () => {
    it('mudar a referência de carregar entre renders não dispara nova carga', async () => {
      const carregarA = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)
      const carregarB = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_B)
      const { result, rerender } = renderHook(({ carregar }: { carregar: () => Promise<Item[]> }) => useListagem(carregar), {
        initialProps: { carregar: carregarA },
      })
      await waitFor(() => expect(result.current.itens).toEqual(LISTA_A))

      rerender({ carregar: carregarB })
      await act(async () => {})

      expect(carregarA).toHaveBeenCalledTimes(1)
      expect(carregarB).not.toHaveBeenCalled()
      expect(result.current.itens).toEqual(LISTA_A)
      expect(result.current.carregando).toBe(false)
    })

    it('uma função inline (nova referência a cada render) carrega uma única vez', async () => {
      const buscar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)
      const { result, rerender } = renderHook(() => useListagem(() => buscar()))
      await waitFor(() => expect(result.current.itens).toEqual(LISTA_A))

      rerender()
      rerender()
      await act(async () => {})

      expect(buscar).toHaveBeenCalledTimes(1)
    })
  })

  describe('setItens', () => {
    it('aceita um valor e substitui a lista', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setItens(LISTA_B)
      })

      expect(result.current.itens).toEqual(LISTA_B)
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('aceita uma função atualizadora que recebe a lista atual', async () => {
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)
      const { result } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setItens((atual) => atual.filter((item) => item.id !== 8))
      })

      expect(result.current.itens).toEqual(LISTA_B)
      expect(result.current.erro).toBeNull()
      expect(result.current.carregando).toBe(false)
    })
  })

  describe('desmontagem e StrictMode', () => {
    it('desmontar durante a carga inicial não gera erro nem aviso de setState quando a resposta chega', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Item[]>()
      const carregar = vi.fn<() => Promise<Item[]>>().mockReturnValue(lenta.promessa)
      const { unmount } = renderHook(() => useListagem(carregar))

      unmount()
      await act(async () => {
        lenta.resolver(LISTA_A)
        await lenta.promessa
      })

      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('desmontar durante a carga inicial que falha não gera erro nem rejeição não tratada', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Item[]>()
      const carregar = vi.fn<() => Promise<Item[]>>().mockReturnValue(lenta.promessa)
      const { unmount } = renderHook(() => useListagem(carregar))

      unmount()
      await act(async () => {
        lenta.rejeitar(new ApiError(500, 'Falha.'))
        await lenta.promessa.catch(() => {})
      })

      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('desmontar durante recarregar não gera erro e a promessa de recarregar resolve', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Item[]>()
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValueOnce(LISTA_A).mockReturnValueOnce(lenta.promessa)
      const { result, unmount } = renderHook(() => useListagem(carregar))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      unmount()
      lenta.resolver(LISTA_B)

      await expect(promessa).resolves.toBeUndefined()
      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('em <StrictMode> termina com a lista carregada, carregando false e sem erro nem avisos no console', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const carregar = vi.fn<() => Promise<Item[]>>().mockResolvedValue(LISTA_A)

      const { result } = renderHook(() => useListagem(carregar), { wrapper: StrictMode })

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.itens).toEqual(LISTA_A)
      expect(result.current.erro).toBeNull()
      // StrictMode pode montar o efeito duas vezes; o número de chamadas não é fixado, só o resultado.
      expect(carregar.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('em <StrictMode> com falha termina com a mensagem de erro e carregando false', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const carregar = vi.fn<() => Promise<Item[]>>().mockRejectedValue(new ApiError(500, 'Falha.'))

      const { result } = renderHook(() => useListagem(carregar), { wrapper: StrictMode })

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe('Falha.')
      expect(result.current.itens).toEqual([])
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })
})
