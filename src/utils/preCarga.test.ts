import { describe, expect, it, vi } from 'vitest'
import { preCarregar } from './preCarga'

interface ModuloFalso {
  nome: string
}

/** Promessa controlada pelo teste (o módulo só "chega" quando o teste quiser). */
function adiado<T>() {
  let resolver!: (valor: T) => void
  let rejeitar!: (motivo: unknown) => void
  const promessa = new Promise<T>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver, rejeitar }
}

/** Esvazia a fila de microtarefas. */
async function esperarMicrotarefas() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

describe('F2.9 — Pré-carga de páginas sob demanda (preCarregar)', () => {
  it('chama o import uma única vez, já na criação, mesmo com várias chamadas a carregar()', async () => {
    const modulo: ModuloFalso = { nome: 'Início' }
    const importar = vi.fn(() => Promise.resolve(modulo))

    const pagina = preCarregar(importar)
    expect(importar).toHaveBeenCalledTimes(1)

    const antes = pagina.carregar()
    await esperarMicrotarefas()
    const depois1 = pagina.carregar()
    const depois2 = pagina.carregar()

    await expect(antes).resolves.toBe(modulo)
    await expect(depois1).resolves.toBe(modulo)
    await expect(depois2).resolves.toBe(modulo)
    expect(importar).toHaveBeenCalledTimes(1)
  })

  it('antes de o módulo chegar, carregado() é null e o then de carregar() é assíncrono', async () => {
    const chegada = adiado<ModuloFalso>()
    const pagina = preCarregar(() => chegada.promessa)

    expect(pagina.carregado()).toBeNull()

    let recebido: ModuloFalso | null = null
    void pagina.carregar().then((m) => {
      recebido = m
    })
    expect(recebido).toBeNull()

    const modulo = { nome: 'Início' }
    chegada.resolver(modulo)
    expect(recebido).toBeNull()

    await esperarMicrotarefas()
    expect(recebido).toBe(modulo)
    expect(pagina.carregado()).toBe(modulo)
  })

  it('enquanto o módulo está chegando, carregar() não baixa de novo', async () => {
    const chegada = adiado<ModuloFalso>()
    const importar = vi.fn(() => chegada.promessa)
    const pagina = preCarregar(importar)

    const p1 = pagina.carregar()
    const p2 = pagina.carregar()
    chegada.resolver({ nome: 'Início' })

    await expect(p1).resolves.toEqual({ nome: 'Início' })
    await expect(p2).resolves.toEqual({ nome: 'Início' })
    expect(importar).toHaveBeenCalledTimes(1)
  })

  it('depois que o módulo chega, o then de carregar() entrega o módulo de forma síncrona', async () => {
    const modulo: ModuloFalso = { nome: 'Início' }
    const pagina = preCarregar(() => Promise.resolve(modulo))
    await esperarMicrotarefas()

    expect(pagina.carregado()).toBe(modulo)

    let recebido: ModuloFalso | null = null
    void pagina.carregar().then((m) => {
      recebido = m
    })
    expect(recebido).toBe(modulo)
  })

  it('depois que o módulo chega, um then encadeado também é síncrono (adaptação ao default do lazy)', async () => {
    const modulo: ModuloFalso = { nome: 'Início' }
    const pagina = preCarregar(() => Promise.resolve(modulo))
    await esperarMicrotarefas()

    let final: { default: string } | null = null
    void pagina
      .carregar()
      .then((m) => ({ default: m.nome }))
      .then((adaptado) => {
        final = adaptado
      })

    expect(final).toEqual({ default: 'Início' })
  })

  it('depois que o módulo chega, a promessa de carregar() continua utilizável com await', async () => {
    const modulo: ModuloFalso = { nome: 'Início' }
    const pagina = preCarregar(() => Promise.resolve(modulo))
    await esperarMicrotarefas()

    await expect(pagina.carregar()).resolves.toBe(modulo)
    expect(await pagina.carregar().then((m) => m.nome)).toBe('Início')
  })

  it('um erro no callback do then síncrono vira promessa rejeitada (não lança na hora)', async () => {
    const pagina = preCarregar(() => Promise.resolve({ nome: 'Início' }))
    await esperarMicrotarefas()

    const erro = new Error('falha ao adaptar')
    let resultado: Promise<unknown> | undefined
    expect(() => {
      resultado = pagina.carregar().then(() => {
        throw erro
      })
    }).not.toThrow()

    await expect(resultado).rejects.toBe(erro)
  })

  it('um erro no import() vira promessa rejeitada em carregar() e carregado() continua null', async () => {
    const erro = new Error('Falha ao baixar o chunk')
    const pagina = preCarregar<ModuloFalso>(() => Promise.reject(erro))

    await expect(pagina.carregar()).rejects.toBe(erro)
    expect(pagina.carregado()).toBeNull()
  })

  it('a falha da pré-carga não gera rejeição não tratada quando ninguém chama carregar()', async () => {
    const naoTratadas: unknown[] = []
    const aoRejeitar = (motivo: unknown) => {
      naoTratadas.push(motivo)
    }
    process.on('unhandledRejection', aoRejeitar)
    try {
      preCarregar<ModuloFalso>(() => Promise.reject(new Error('sem rede')))
      await new Promise((resolver) => setTimeout(resolver, 0))
      expect(naoTratadas).toEqual([])
    } finally {
      process.off('unhandledRejection', aoRejeitar)
    }
  })

  it('depois de a pré-carga falhar, carregar() tenta o import de novo', async () => {
    const modulo: ModuloFalso = { nome: 'Início' }
    const importar = vi
      .fn<() => Promise<ModuloFalso>>()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValueOnce(modulo)
    const pagina = preCarregar(importar)
    await esperarMicrotarefas()

    await expect(pagina.carregar()).resolves.toBe(modulo)
    expect(importar).toHaveBeenCalledTimes(2)
  })
})
