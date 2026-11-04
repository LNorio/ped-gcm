import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO } from '../services/api'
import { useAcoesSituacaoExclusao } from './useAcoesSituacaoExclusao'

interface Item {
  id: number
  nome: string
  ativo: boolean
}

const MARGEM: Item = { id: 4, nome: 'Margem de contribuição', ativo: true }
const FATURAMENTO: Item = { id: 7, nome: 'Faturamento ERP', ativo: false }

const MENSAGENS = { situacao: 'Situação alterada.', exclusao: 'Dado externo excluído.' }

type Acao = (item: Item) => Promise<unknown>
type Notificar = (mensagem: string) => void

/** Promessa controlada pelo teste, para simular uma ação lenta. */
function controlavel() {
  let resolver: (valor: unknown) => void = () => {}
  let rejeitar: (erro: unknown) => void = () => {}
  const promessa = new Promise<unknown>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver: (valor?: unknown) => resolver(valor), rejeitar: (erro: unknown) => rejeitar(erro) }
}

function montar(
  alterarSituacao = vi.fn<Acao>().mockResolvedValue({ ...MARGEM, ativo: false }),
  excluir = vi.fn<Acao>().mockResolvedValue(undefined),
  onNotificar = vi.fn<Notificar>(),
) {
  const resultado = renderHook(() =>
    useAcoesSituacaoExclusao<Item>({ alterarSituacao, excluir, onNotificar, mensagens: MENSAGENS }),
  )
  return { ...resultado, alterarSituacao, excluir, onNotificar }
}

describe('F1.14 — useAcoesSituacaoExclusao (ativar/desativar e excluir com confirmação)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('começa com os dois diálogos fechados, sem execução e sem erro', () => {
    const { result, alterarSituacao, excluir, onNotificar } = montar()

    expect(result.current.situacao.alvo).toBeNull()
    expect(result.current.exclusao.alvo).toBeNull()
    expect(result.current.situacao.executando).toBe(false)
    expect(result.current.exclusao.executando).toBe(false)
    expect(result.current.erro).toBeNull()
    expect(alterarSituacao).not.toHaveBeenCalled()
    expect(excluir).not.toHaveBeenCalled()
    expect(onNotificar).not.toHaveBeenCalled()
  })

  it('situacao.abrir(item) abre só o diálogo de situação, sem executar; cancelar fecha', () => {
    const { result, alterarSituacao } = montar()

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    expect(result.current.situacao.alvo).toBe(MARGEM)
    expect(result.current.exclusao.alvo).toBeNull()
    expect(alterarSituacao).not.toHaveBeenCalled()

    act(() => {
      result.current.situacao.cancelar()
    })
    expect(result.current.situacao.alvo).toBeNull()
    expect(alterarSituacao).not.toHaveBeenCalled()
  })

  it('confirmar a situação chama alterarSituacao(item); no sucesso fecha o diálogo e notifica a mensagem de situação', async () => {
    const { result, alterarSituacao, excluir, onNotificar } = montar()

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await result.current.situacao.confirmar()
    })

    expect(alterarSituacao).toHaveBeenCalledTimes(1)
    expect(alterarSituacao).toHaveBeenCalledWith(MARGEM)
    expect(excluir).not.toHaveBeenCalled()
    expect(result.current.situacao.alvo).toBeNull()
    expect(result.current.erro).toBeNull()
    expect(onNotificar).toHaveBeenCalledTimes(1)
    expect(onNotificar).toHaveBeenCalledWith('Situação alterada.')
  })

  it('confirmar a exclusão chama excluir(item); no sucesso fecha o diálogo e notifica a mensagem de exclusão', async () => {
    const { result, alterarSituacao, excluir, onNotificar } = montar()

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    expect(result.current.exclusao.alvo).toBe(FATURAMENTO)
    await act(async () => {
      await result.current.exclusao.confirmar()
    })

    expect(excluir).toHaveBeenCalledTimes(1)
    expect(excluir).toHaveBeenCalledWith(FATURAMENTO)
    expect(alterarSituacao).not.toHaveBeenCalled()
    expect(result.current.exclusao.alvo).toBeNull()
    expect(result.current.erro).toBeNull()
    expect(onNotificar).toHaveBeenCalledTimes(1)
    expect(onNotificar).toHaveBeenCalledWith('Dado externo excluído.')
  })

  it('executando fica true só na ação em andamento', async () => {
    const pendente = controlavel()
    const { result } = montar(vi.fn<Acao>().mockReturnValue(pendente.promessa))

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    let confirmacao: Promise<void> = Promise.resolve()
    act(() => {
      confirmacao = result.current.situacao.confirmar()
    })

    expect(result.current.situacao.executando).toBe(true)
    expect(result.current.exclusao.executando).toBe(false)

    await act(async () => {
      pendente.resolver()
      await confirmacao
    })
    expect(result.current.situacao.executando).toBe(false)
  })

  it('confirmar duas vezes seguidas executa a ação uma única vez e notifica uma vez', async () => {
    const pendente = controlavel()
    const excluir = vi.fn<Acao>().mockReturnValue(pendente.promessa)
    const { result, onNotificar } = montar(undefined, excluir)

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    let primeira: Promise<void> = Promise.resolve()
    let segunda: Promise<void> = Promise.resolve()
    act(() => {
      primeira = result.current.exclusao.confirmar()
      segunda = result.current.exclusao.confirmar()
    })
    await act(async () => {
      pendente.resolver()
      await Promise.all([primeira, segunda])
    })

    expect(excluir).toHaveBeenCalledTimes(1)
    expect(onNotificar).toHaveBeenCalledTimes(1)
  })

  it('falha na situação: diálogo fecha, erro = mensagem da ApiError, sem notificação; confirmar não rejeita', async () => {
    const alterarSituacao = vi.fn<Acao>().mockRejectedValue(new ApiError(403, 'Sem permissão para alterar a situação.'))
    const { result, onNotificar } = montar(alterarSituacao)

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await expect(result.current.situacao.confirmar()).resolves.toBeUndefined()
    })

    expect(result.current.situacao.alvo).toBeNull()
    expect(result.current.erro).toBe('Sem permissão para alterar a situação.')
    expect(onNotificar).not.toHaveBeenCalled()
  })

  it('falha na exclusão com erro que não é ApiError vira a mensagem genérica', async () => {
    const excluir = vi.fn<Acao>().mockRejectedValue(new Error('detalhe técnico'))
    const { result, onNotificar } = montar(undefined, excluir)

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    await act(async () => {
      await result.current.exclusao.confirmar()
    })

    expect(result.current.exclusao.alvo).toBeNull()
    expect(result.current.erro).toBe(MENSAGEM_ERRO_INESPERADO)
    expect(onNotificar).not.toHaveBeenCalled()
  })

  it('um único erro por vez: confirmar a exclusão limpa na hora o erro anterior da situação', async () => {
    const pendente = controlavel()
    const alterarSituacao = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha ao alterar a situação.'))
    const excluir = vi.fn<Acao>().mockReturnValue(pendente.promessa)
    const { result } = montar(alterarSituacao, excluir)

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await result.current.situacao.confirmar()
    })
    expect(result.current.erro).toBe('Falha ao alterar a situação.')

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    expect(result.current.erro).toBe('Falha ao alterar a situação.')

    let confirmacao: Promise<void> = Promise.resolve()
    act(() => {
      confirmacao = result.current.exclusao.confirmar()
    })
    expect(result.current.erro).toBeNull()

    await act(async () => {
      pendente.rejeitar(new ApiError(400, 'O dado externo já compôs indicadores.'))
      await confirmacao
    })
    expect(result.current.erro).toBe('O dado externo já compôs indicadores.')
  })

  it('um único erro por vez: confirmar a situação limpa na hora o erro anterior da exclusão', async () => {
    const pendente = controlavel()
    const alterarSituacao = vi.fn<Acao>().mockReturnValue(pendente.promessa)
    const excluir = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha ao excluir.'))
    const { result, onNotificar } = montar(alterarSituacao, excluir)

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    await act(async () => {
      await result.current.exclusao.confirmar()
    })
    expect(result.current.erro).toBe('Falha ao excluir.')

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    let confirmacao: Promise<void> = Promise.resolve()
    act(() => {
      confirmacao = result.current.situacao.confirmar()
    })
    expect(result.current.erro).toBeNull()

    await act(async () => {
      pendente.resolver({ ...MARGEM, ativo: false })
      await confirmacao
    })
    expect(result.current.erro).toBeNull()
    expect(onNotificar).toHaveBeenCalledWith('Situação alterada.')
  })

  it('a última falha prevalece: erro mostra sempre a mensagem da última ação que falhou', async () => {
    const alterarSituacao = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha na situação.'))
    const excluir = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha na exclusão.'))
    const { result } = montar(alterarSituacao, excluir)

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    await act(async () => {
      await result.current.exclusao.confirmar()
    })
    expect(result.current.erro).toBe('Falha na exclusão.')

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await result.current.situacao.confirmar()
    })
    expect(result.current.erro).toBe('Falha na situação.')
  })

  it('cancelar um diálogo não limpa o erro existente', async () => {
    const alterarSituacao = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha na situação.'))
    const { result } = montar(alterarSituacao)

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await result.current.situacao.confirmar()
    })
    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    act(() => {
      result.current.exclusao.cancelar()
    })

    expect(result.current.erro).toBe('Falha na situação.')
  })

  it('limparErros() zera o erro (usado após cadastro ou conclusão bem-sucedidos)', async () => {
    const excluir = vi.fn<Acao>().mockRejectedValue(new ApiError(500, 'Falha ao excluir.'))
    const { result } = montar(undefined, excluir)

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    await act(async () => {
      await result.current.exclusao.confirmar()
    })
    expect(result.current.erro).toBe('Falha ao excluir.')

    act(() => {
      result.current.limparErros()
    })
    expect(result.current.erro).toBeNull()
  })

  it('limparErros() sem erro não quebra', () => {
    const { result } = montar()

    act(() => {
      result.current.limparErros()
    })

    expect(result.current.erro).toBeNull()
  })

  it('usa as referências mais recentes de alterarSituacao, excluir e onNotificar', async () => {
    const primeiroAlterar = vi.fn<Acao>().mockResolvedValue(undefined)
    const segundoAlterar = vi.fn<Acao>().mockResolvedValue(undefined)
    const primeiroNotificar = vi.fn<Notificar>()
    const segundoNotificar = vi.fn<Notificar>()
    const excluir = vi.fn<Acao>().mockResolvedValue(undefined)

    const { result, rerender } = renderHook(
      ({ alterarSituacao, onNotificar }: { alterarSituacao: Acao; onNotificar: Notificar }) =>
        useAcoesSituacaoExclusao<Item>({ alterarSituacao, excluir, onNotificar, mensagens: { ...MENSAGENS } }),
      { initialProps: { alterarSituacao: primeiroAlterar, onNotificar: primeiroNotificar } },
    )
    rerender({ alterarSituacao: segundoAlterar, onNotificar: segundoNotificar })

    act(() => {
      result.current.situacao.abrir(MARGEM)
    })
    await act(async () => {
      await result.current.situacao.confirmar()
    })

    expect(primeiroAlterar).not.toHaveBeenCalled()
    expect(segundoAlterar).toHaveBeenCalledWith(MARGEM)
    expect(primeiroNotificar).not.toHaveBeenCalled()
    expect(segundoNotificar).toHaveBeenCalledWith('Situação alterada.')
  })

  it('desmontar com a ação em andamento não notifica nem gera erro no console', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pendente = controlavel()
    const { result, unmount, onNotificar } = montar(undefined, vi.fn<Acao>().mockReturnValue(pendente.promessa))

    act(() => {
      result.current.exclusao.abrir(FATURAMENTO)
    })
    let confirmacao: Promise<void> = Promise.resolve()
    act(() => {
      confirmacao = result.current.exclusao.confirmar()
    })
    unmount()

    await act(async () => {
      pendente.resolver()
      await confirmacao
    })

    expect(onNotificar).not.toHaveBeenCalled()
    expect(consoleErro).not.toHaveBeenCalled()
  })
})
