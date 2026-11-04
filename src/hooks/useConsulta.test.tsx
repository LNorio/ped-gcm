import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO, MENSAGEM_SEM_CONEXAO } from '../services/api'
import { useConsulta } from './useConsulta'

/** Resultado genérico (não precisa ser array): a consulta da F4 devolve lista + contagem. */
interface Pagina {
  itens: string[]
  total: number
}

const VAZIA: Pagina = { itens: [], total: 0 }
const PAGINA_A: Pagina = { itens: ['Comercial', 'Financeiro', 'Logística'], total: 3 }
const PAGINA_B: Pagina = { itens: ['Comercial', 'Financeiro'], total: 2 }
const PAGINA_C: Pagina = { itens: ['Comercial'], total: 1 }

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

type Carregar = () => Promise<Pagina>

describe('F1.13 — useConsulta (hook genérico de consulta)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('carga inicial', () => {
    it('começa com os dados iniciais, carregando, sem erro, carregouUmaVez false, e chama carregar uma vez ao montar', () => {
      const carregar = vi.fn<Carregar>().mockReturnValue(controlavel<Pagina>().promessa)

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      expect(result.current.dados).toBe(VAZIA)
      expect(result.current.carregando).toBe(true)
      expect(result.current.erro).toBeNull()
      expect(result.current.carregouUmaVez).toBe(false)
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('quando carregar resolve, expõe os dados, encerra o carregamento e marca carregouUmaVez', async () => {
      const carregar = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.dados).toEqual(PAGINA_A)
      expect(result.current.erro).toBeNull()
      expect(result.current.carregouUmaVez).toBe(true)
    })

    it('ApiError: erro recebe a mensagem, os dados ficam com o valor inicial e carregouUmaVez vira true (resposta com erro também conta)', async () => {
      const carregar = vi.fn<Carregar>().mockRejectedValue(new ApiError(500, 'Falha ao consultar.'))

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe('Falha ao consultar.')
      expect(result.current.dados).toBe(VAZIA)
      expect(result.current.carregouUmaVez).toBe(true)
    })

    it('ApiError de rede (status 0) expõe a mensagem de conexão', async () => {
      const carregar = vi.fn<Carregar>().mockRejectedValue(new ApiError(0, MENSAGEM_SEM_CONEXAO))

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
    })

    it('erro que não é ApiError expõe a mensagem unificada de erro inesperado', async () => {
      const carregar = vi.fn<Carregar>().mockRejectedValue(new TypeError('Cannot read properties of undefined'))

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('a carga inicial não propaga a rejeição de carregar (sem rejeição não tratada)', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const carregar = vi.fn<Carregar>().mockRejectedValue(new Error('falhou'))

      const { result } = renderHook(() => useConsulta(carregar, VAZIA))

      await waitFor(() => expect(result.current.carregando).toBe(false))
      await act(async () => {})
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  describe('recarregar()', () => {
    it('chama carregar de novo e aplica os novos dados; resolve sem valor', async () => {
      const carregar = vi.fn<Carregar>().mockResolvedValueOnce(PAGINA_A).mockResolvedValue(PAGINA_B)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      let retorno: unknown = 'não resolvido'
      await act(async () => {
        retorno = await result.current.recarregar()
      })

      expect(retorno).toBeUndefined()
      expect(carregar).toHaveBeenCalledTimes(2)
      expect(result.current.dados).toEqual(PAGINA_B)
      expect(result.current.carregando).toBe(false)
    })

    it('indica carregando durante a recarga, mantendo os dados anteriores e carregouUmaVez true', async () => {
      const lenta = controlavel<Pagina>()
      const carregar = vi.fn<Carregar>().mockResolvedValueOnce(PAGINA_A).mockReturnValueOnce(lenta.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))
      expect(result.current.dados).toEqual(PAGINA_A)
      expect(result.current.carregouUmaVez).toBe(true)

      await act(async () => {
        lenta.resolver(PAGINA_B)
        await promessa
      })

      expect(result.current.carregando).toBe(false)
      expect(result.current.dados).toEqual(PAGINA_B)
    })

    it('não rejeita quando carregar falha: a mensagem vai para erro e os dados anteriores são mantidos', async () => {
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockRejectedValueOnce(new ApiError(500, 'Falha temporária.'))
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await expect(result.current.recarregar()).resolves.toBeUndefined()
      })

      expect(result.current.erro).toBe('Falha temporária.')
      expect(result.current.dados).toEqual(PAGINA_A)
      expect(result.current.carregando).toBe(false)
    })

    it('depois de um erro, mantém a mensagem enquanto a nova carga está em andamento e a limpa no sucesso', async () => {
      const lenta = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockRejectedValueOnce(new ApiError(500, 'Falha temporária.'))
        .mockReturnValueOnce(lenta.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.erro).toBe('Falha temporária.'))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))
      expect(result.current.erro).toBe('Falha temporária.')

      await act(async () => {
        lenta.resolver(PAGINA_A)
        await promessa
      })

      expect(result.current.erro).toBeNull()
      expect(result.current.dados).toEqual(PAGINA_A)
    })
  })

  describe('proteção de corrida', () => {
    it('duas chamadas de recarregar: só o resultado da última é aplicado, mesmo que a primeira resolva depois', async () => {
      const primeira = controlavel<Pagina>()
      const segunda = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(VAZIA)
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })

      await act(async () => {
        segunda.resolver(PAGINA_B)
        await promessa2
      })
      expect(result.current.dados).toEqual(PAGINA_B)
      expect(result.current.carregando).toBe(false)

      await act(async () => {
        primeira.resolver(PAGINA_A)
        await promessa1
      })
      expect(result.current.dados).toEqual(PAGINA_B)
      expect(carregar).toHaveBeenCalledTimes(3)
    })

    it('falha atrasada de uma chamada antiga não sobrescreve o sucesso da última', async () => {
      const primeira = controlavel<Pagina>()
      const segunda = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(VAZIA)
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })
      await act(async () => {
        segunda.resolver(PAGINA_A)
        await promessa2
      })
      await act(async () => {
        primeira.rejeitar(new ApiError(500, 'Falha antiga.'))
        await promessa1
      })

      expect(result.current.erro).toBeNull()
      expect(result.current.dados).toEqual(PAGINA_A)
      expect(result.current.carregando).toBe(false)
    })

    it('enquanto a última chamada não responde, continua carregando mesmo que uma antiga tenha respondido', async () => {
      const primeira = controlavel<Pagina>()
      const segunda = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(VAZIA)
        .mockReturnValueOnce(primeira.promessa)
        .mockReturnValueOnce(segunda.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa1: Promise<void> = Promise.resolve()
      let promessa2: Promise<void> = Promise.resolve()
      act(() => {
        promessa1 = result.current.recarregar()
        promessa2 = result.current.recarregar()
      })
      await act(async () => {
        primeira.resolver(PAGINA_A)
        await promessa1
      })
      expect(result.current.carregando).toBe(true)
      expect(result.current.dados).toEqual(VAZIA)

      await act(async () => {
        segunda.resolver(PAGINA_B)
        await promessa2
      })
      expect(result.current.carregando).toBe(false)
      expect(result.current.dados).toEqual(PAGINA_B)
    })
  })

  describe('setDados', () => {
    it('aceita um valor e substitui os dados, sem nova consulta quando não há carga pendente', async () => {
      const carregar = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setDados(PAGINA_B)
      })
      await act(async () => {})

      expect(result.current.dados).toEqual(PAGINA_B)
      expect(result.current.carregando).toBe(false)
      expect(carregar).toHaveBeenCalledTimes(1)
    })

    it('aceita uma função atualizadora que recebe os dados atuais', async () => {
      const carregar = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setDados((atual) => ({ itens: atual.itens.filter((item) => item !== 'Logística'), total: atual.total - 1 }))
      })

      expect(result.current.dados).toEqual(PAGINA_B)
      expect(result.current.erro).toBeNull()
      expect(carregar).toHaveBeenCalledTimes(1)
    })
  })

  describe('setDados com carga pendente (padrão: recarregar após a mutação)', () => {
    it('descarta o resultado pendente e, quando ele termina, recarrega automaticamente; os dados finais são os da nova consulta', async () => {
      const lenta = controlavel<Pagina>()
      const nova = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockReturnValueOnce(lenta.promessa)
        .mockReturnValueOnce(nova.promessa)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      // Ex.: exclusão confirmada pela API enquanto um GET (de um filtro novo) ainda está no ar.
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      expect(result.current.dados).toEqual(PAGINA_B)

      await act(async () => {
        lenta.resolver(PAGINA_A) // resultado antigo: descartado
        await promessa
      })
      expect(result.current.dados).toEqual(PAGINA_B)
      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(3))
      expect(result.current.carregando).toBe(true)

      await act(async () => {
        nova.resolver(PAGINA_C)
      })
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.dados).toEqual(PAGINA_C)
      expect(result.current.erro).toBeNull()
    })

    it('a falha da carga descartada não vai para erro; a recarga automática acontece do mesmo modo', async () => {
      const lenta = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockReturnValueOnce(lenta.promessa)
        .mockResolvedValueOnce(PAGINA_C)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      await act(async () => {
        lenta.rejeitar(new ApiError(500, 'Falha antiga.'))
        await promessa
      })

      await waitFor(() => expect(carregar).toHaveBeenCalledTimes(3))
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.erro).toBeNull()
      expect(result.current.dados).toEqual(PAGINA_C)
    })

    it('várias mutações durante a mesma carga pendente geram uma única recarga automática', async () => {
      const lenta = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockReturnValueOnce(lenta.promessa)
        .mockResolvedValue(PAGINA_C)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      act(() => {
        result.current.setDados(PAGINA_C)
      })
      await act(async () => {
        lenta.resolver(PAGINA_A)
        await promessa
      })
      await waitFor(() => expect(result.current.carregando).toBe(false))
      await act(async () => {})

      expect(carregar).toHaveBeenCalledTimes(3)
      expect(result.current.dados).toEqual(PAGINA_C)
    })

    it('a recarga automática usa a referência mais recente de carregar (ex.: filtros novos)', async () => {
      const lenta = controlavel<Pagina>()
      const carregarA = vi.fn<Carregar>().mockResolvedValueOnce(PAGINA_A).mockReturnValueOnce(lenta.promessa)
      const carregarB = vi.fn<Carregar>().mockResolvedValue(PAGINA_C)
      const { result, rerender } = renderHook(({ carregar }: { carregar: Carregar }) => useConsulta(carregar, VAZIA), {
        initialProps: { carregar: carregarA },
      })
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      rerender({ carregar: carregarB })
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      await act(async () => {
        lenta.resolver(PAGINA_A)
        await promessa
      })

      await waitFor(() => expect(carregarB).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_C))
      expect(carregarA).toHaveBeenCalledTimes(2)
    })

    it('com { recarregarAposMutacao: false }, a carga pendente é descartada sem recarga automática (semântica do useListagem)', async () => {
      const lenta = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockReturnValueOnce(lenta.promessa)
        .mockResolvedValue(PAGINA_C)
      const { result } = renderHook(() => useConsulta(carregar, VAZIA, { recarregarAposMutacao: false }))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      await act(async () => {
        lenta.resolver(PAGINA_A)
        await promessa
      })
      await act(async () => {})

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(result.current.dados).toEqual(PAGINA_B)
      expect(result.current.carregando).toBe(false)
    })

    it('desmontar com a carga pendente depois de uma mutação não dispara a recarga automática nem gera erro', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Pagina>()
      const carregar = vi
        .fn<Carregar>()
        .mockResolvedValueOnce(PAGINA_A)
        .mockReturnValueOnce(lenta.promessa)
        .mockResolvedValue(PAGINA_C)
      const { result, unmount } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      act(() => {
        result.current.setDados(PAGINA_B)
      })
      unmount()
      lenta.resolver(PAGINA_A)
      await expect(promessa).resolves.toBeUndefined()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(carregar).toHaveBeenCalledTimes(2)
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  describe('referência de carregar', () => {
    it('mudar a referência de carregar entre renders não dispara nova carga', async () => {
      const carregarA = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)
      const carregarB = vi.fn<Carregar>().mockResolvedValue(PAGINA_B)
      const { result, rerender } = renderHook(({ carregar }: { carregar: Carregar }) => useConsulta(carregar, VAZIA), {
        initialProps: { carregar: carregarA },
      })
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      rerender({ carregar: carregarB })
      await act(async () => {})

      expect(carregarA).toHaveBeenCalledTimes(1)
      expect(carregarB).not.toHaveBeenCalled()
    })

    it('recarregar() usa a última referência de carregar recebida', async () => {
      const carregarA = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)
      const carregarB = vi.fn<Carregar>().mockResolvedValue(PAGINA_B)
      const { result, rerender } = renderHook(({ carregar }: { carregar: Carregar }) => useConsulta(carregar, VAZIA), {
        initialProps: { carregar: carregarA },
      })
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      rerender({ carregar: carregarB })
      await act(async () => {
        await result.current.recarregar()
      })

      expect(carregarB).toHaveBeenCalledTimes(1)
      expect(result.current.dados).toEqual(PAGINA_B)
    })

    it('uma função inline (nova referência a cada render) e um valor inicial inline carregam uma única vez', async () => {
      const buscar = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)
      const { result, rerender } = renderHook(() => useConsulta(() => buscar(), { itens: [], total: 0 }))
      await waitFor(() => expect(result.current.dados).toEqual(PAGINA_A))

      rerender()
      rerender()
      await act(async () => {})

      expect(buscar).toHaveBeenCalledTimes(1)
      expect(result.current.dados).toEqual(PAGINA_A)
    })
  })

  describe('desmontagem e StrictMode', () => {
    it('desmontar durante a carga inicial não gera erro nem aviso de setState quando a resposta chega', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Pagina>()
      const carregar = vi.fn<Carregar>().mockReturnValue(lenta.promessa)
      const { unmount } = renderHook(() => useConsulta(carregar, VAZIA))

      unmount()
      await act(async () => {
        lenta.resolver(PAGINA_A)
        await lenta.promessa
      })

      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('desmontar durante recarregar não gera erro e a promessa de recarregar resolve', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel<Pagina>()
      const carregar = vi.fn<Carregar>().mockResolvedValueOnce(PAGINA_A).mockReturnValueOnce(lenta.promessa)
      const { result, unmount } = renderHook(() => useConsulta(carregar, VAZIA))
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.recarregar()
      })
      unmount()
      lenta.rejeitar(new ApiError(500, 'Falha.'))

      await expect(promessa).resolves.toBeUndefined()
      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('em <StrictMode> termina com os dados carregados, carregando false, carregouUmaVez true e sem avisos', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const carregar = vi.fn<Carregar>().mockResolvedValue(PAGINA_A)

      const { result } = renderHook(() => useConsulta(carregar, VAZIA), { wrapper: StrictMode })

      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.dados).toEqual(PAGINA_A)
      expect(result.current.carregouUmaVez).toBe(true)
      expect(carregar.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })
})
