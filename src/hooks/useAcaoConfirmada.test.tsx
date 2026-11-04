import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO } from '../services/api'
import { useAcaoConfirmada } from './useAcaoConfirmada'

interface Alvo {
  id: number
  nome: string
}

const CHAMADOS: Alvo = { id: 4, nome: 'Chamados resolvidos no prazo' }
const RELATORIO: Alvo = { id: 5, nome: 'Relatório mensal entregue' }

/** Promessa controlada pelo teste, para simular uma ação lenta. */
function controlavel() {
  let resolver: () => void = () => {}
  let rejeitar: (erro: unknown) => void = () => {}
  const promessa = new Promise<void>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver: () => resolver(), rejeitar: (erro: unknown) => rejeitar(erro) }
}

type Acao = (alvo: Alvo) => Promise<void>

describe('F1.13 — useAcaoConfirmada (ação com diálogo de confirmação)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('começa sem alvo, sem execução e sem erro', () => {
    const acao = vi.fn<Acao>().mockResolvedValue(undefined)

    const { result } = renderHook(() => useAcaoConfirmada(acao))

    expect(result.current.alvo).toBeNull()
    expect(result.current.executando).toBe(false)
    expect(result.current.erro).toBeNull()
    expect(acao).not.toHaveBeenCalled()
  })

  it('abrir(alvo) define o alvo sem executar a ação', () => {
    const acao = vi.fn<Acao>().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAcaoConfirmada(acao))

    act(() => {
      result.current.abrir(CHAMADOS)
    })

    expect(result.current.alvo).toBe(CHAMADOS)
    expect(acao).not.toHaveBeenCalled()
  })

  it('cancelar() fecha (alvo null) sem executar a ação', () => {
    const acao = vi.fn<Acao>().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAcaoConfirmada(acao))

    act(() => {
      result.current.abrir(CHAMADOS)
    })
    act(() => {
      result.current.cancelar()
    })

    expect(result.current.alvo).toBeNull()
    expect(acao).not.toHaveBeenCalled()
  })

  it('confirmar() sem alvo não executa a ação', async () => {
    const acao = vi.fn<Acao>().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAcaoConfirmada(acao))

    await act(async () => {
      await result.current.confirmar()
    })

    expect(acao).not.toHaveBeenCalled()
    expect(result.current.executando).toBe(false)
  })

  describe('confirmação com sucesso', () => {
    it('executa a ação com o alvo, indica executando enquanto ela não termina e, no sucesso, fecha, mantém erro nulo e chama onSucesso(alvo)', async () => {
      const lenta = controlavel()
      const acao = vi.fn<Acao>().mockReturnValue(lenta.promessa)
      const onSucesso = vi.fn<(alvo: Alvo) => void>()
      const { result } = renderHook(() => useAcaoConfirmada(acao, { onSucesso }))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.confirmar()
      })

      expect(acao).toHaveBeenCalledTimes(1)
      expect(acao).toHaveBeenCalledWith(CHAMADOS)
      expect(result.current.executando).toBe(true)
      expect(result.current.alvo).toBe(CHAMADOS)
      expect(onSucesso).not.toHaveBeenCalled()

      await act(async () => {
        lenta.resolver()
        await promessa
      })

      expect(result.current.executando).toBe(false)
      expect(result.current.alvo).toBeNull()
      expect(result.current.erro).toBeNull()
      expect(onSucesso).toHaveBeenCalledTimes(1)
      expect(onSucesso).toHaveBeenCalledWith(CHAMADOS)
    })

    it('funciona sem opções (onSucesso é opcional)', async () => {
      const acao = vi.fn<Acao>().mockResolvedValue(undefined)
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(RELATORIO)
      })
      await act(async () => {
        await result.current.confirmar()
      })

      expect(acao).toHaveBeenCalledWith(RELATORIO)
      expect(result.current.alvo).toBeNull()
      expect(result.current.erro).toBeNull()
    })

    it('confirmar duas vezes seguidas (clique duplo) executa a ação uma única vez', async () => {
      const lenta = controlavel()
      const acao = vi.fn<Acao>().mockReturnValue(lenta.promessa)
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      let primeira: Promise<void> = Promise.resolve()
      let segunda: Promise<void> = Promise.resolve()
      act(() => {
        primeira = result.current.confirmar()
        segunda = result.current.confirmar()
      })

      expect(acao).toHaveBeenCalledTimes(1)

      await act(async () => {
        lenta.resolver()
        await primeira
        await segunda
      })
      expect(acao).toHaveBeenCalledTimes(1)
    })

    it('cancelar() é ignorado enquanto a ação está em andamento (o diálogo continua com o alvo)', async () => {
      const lenta = controlavel()
      const acao = vi.fn<Acao>().mockReturnValue(lenta.promessa)
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.confirmar()
      })
      act(() => {
        result.current.cancelar()
      })

      expect(result.current.alvo).toBe(CHAMADOS)
      expect(result.current.executando).toBe(true)

      await act(async () => {
        lenta.resolver()
        await promessa
      })
      expect(result.current.alvo).toBeNull()
    })

    it('usa a referência mais recente da ação e de onSucesso', async () => {
      const acaoA = vi.fn<Acao>().mockResolvedValue(undefined)
      const acaoB = vi.fn<Acao>().mockResolvedValue(undefined)
      const onSucessoA = vi.fn<(alvo: Alvo) => void>()
      const onSucessoB = vi.fn<(alvo: Alvo) => void>()
      const { result, rerender } = renderHook(
        ({ acao, onSucesso }: { acao: Acao; onSucesso: (alvo: Alvo) => void }) => useAcaoConfirmada(acao, { onSucesso }),
        { initialProps: { acao: acaoA, onSucesso: onSucessoA } },
      )

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      rerender({ acao: acaoB, onSucesso: onSucessoB })
      await act(async () => {
        await result.current.confirmar()
      })

      expect(acaoA).not.toHaveBeenCalled()
      expect(acaoB).toHaveBeenCalledWith(CHAMADOS)
      expect(onSucessoA).not.toHaveBeenCalled()
      expect(onSucessoB).toHaveBeenCalledWith(CHAMADOS)
    })
  })

  describe('confirmação com falha', () => {
    it('ApiError: fecha (alvo null), encerra a execução, expõe erro = mensagem da API e não chama onSucesso; confirmar não rejeita', async () => {
      const acao = vi.fn<Acao>().mockRejectedValue(new ApiError(403, 'Apenas o administrador exclui apontamentos.'))
      const onSucesso = vi.fn<(alvo: Alvo) => void>()
      const { result } = renderHook(() => useAcaoConfirmada(acao, { onSucesso }))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await expect(result.current.confirmar()).resolves.toBeUndefined()
      })

      expect(result.current.alvo).toBeNull()
      expect(result.current.executando).toBe(false)
      expect(result.current.erro).toBe('Apenas o administrador exclui apontamentos.')
      expect(onSucesso).not.toHaveBeenCalled()
    })

    it('erro que não é ApiError expõe a mensagem unificada de erro inesperado', async () => {
      const acao = vi.fn<Acao>().mockRejectedValue(new TypeError('boom'))
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await result.current.confirmar()
      })

      expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('uma confirmação bem-sucedida depois de uma falha limpa o erro', async () => {
      const acao = vi
        .fn<Acao>()
        .mockRejectedValueOnce(new ApiError(500, 'Falha temporária.'))
        .mockResolvedValueOnce(undefined)
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await result.current.confirmar()
      })
      expect(result.current.erro).toBe('Falha temporária.')

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await result.current.confirmar()
      })

      expect(result.current.erro).toBeNull()
      expect(acao).toHaveBeenCalledTimes(2)
    })

    it('depois de uma falha, a ação pode ser confirmada de novo (a trava de execução é liberada)', async () => {
      const acao = vi.fn<Acao>().mockRejectedValueOnce(new ApiError(500, 'Falha.')).mockResolvedValue(undefined)
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await result.current.confirmar()
      })
      act(() => {
        result.current.abrir(RELATORIO)
      })
      await act(async () => {
        await result.current.confirmar()
      })

      expect(acao).toHaveBeenNthCalledWith(2, RELATORIO)
    })

    it('limparErro() apaga a mensagem de erro', async () => {
      const acao = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha.'))
      const { result } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      await act(async () => {
        await result.current.confirmar()
      })
      expect(result.current.erro).toBe('Falha.')

      act(() => {
        result.current.limparErro()
      })

      expect(result.current.erro).toBeNull()
    })
  })

  describe('desmontagem', () => {
    it('desmontar com a ação em andamento não gera erro no console e a promessa de confirmar resolve (sucesso)', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel()
      const acao = vi.fn<Acao>().mockReturnValue(lenta.promessa)
      const onSucesso = vi.fn<(alvo: Alvo) => void>()
      const { result, unmount } = renderHook(() => useAcaoConfirmada(acao, { onSucesso }))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.confirmar()
      })
      unmount()
      lenta.resolver()

      await expect(promessa).resolves.toBeUndefined()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('desmontar com a ação em andamento que falha não gera erro no console nem rejeição', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const lenta = controlavel()
      const acao = vi.fn<Acao>().mockReturnValue(lenta.promessa)
      const { result, unmount } = renderHook(() => useAcaoConfirmada(acao))

      act(() => {
        result.current.abrir(CHAMADOS)
      })
      let promessa: Promise<void> = Promise.resolve()
      act(() => {
        promessa = result.current.confirmar()
      })
      unmount()
      lenta.rejeitar(new ApiError(500, 'Falha.'))

      await expect(promessa).resolves.toBeUndefined()
      await waitFor(() => expect(consoleErro).not.toHaveBeenCalled())
    })
  })
})
