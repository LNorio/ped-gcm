import { afterEach, describe, expect, it, vi } from 'vitest'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { avisarAcessoObtido, ouvirAcessoObtido, type AcessoObtido } from './acessoObtido'

function obtido(parcial: Partial<AcessoObtido> = {}): AcessoObtido {
  return { acesso: acessoFalso({ perfil: 'admin' }), filialSelecionada: FILIAIS[1], ...parcial }
}

describe('F2.1 — Aviso de acesso obtido (ouvirAcessoObtido / avisarAcessoObtido)', () => {
  const cancelamentos: Array<() => void> = []

  /** Inscreve e guarda o cancelamento para limpar ao fim do teste (o registro é global). */
  function ouvir(ouvinte: (o: AcessoObtido) => void) {
    const cancelar = ouvirAcessoObtido(ouvinte)
    cancelamentos.push(cancelar)
    return cancelar
  }

  afterEach(() => {
    for (const cancelar of cancelamentos.splice(0)) cancelar()
  })

  it('o ouvinte recebe o aviso com o acesso e a filial selecionada', () => {
    const ouvinte = vi.fn()
    ouvir(ouvinte)
    const aviso = obtido({ filialSelecionada: 'todas' })

    avisarAcessoObtido(aviso)

    expect(ouvinte).toHaveBeenCalledTimes(1)
    expect(ouvinte).toHaveBeenCalledWith(aviso)
  })

  it('avisar sem ouvintes não falha', () => {
    expect(() => avisarAcessoObtido(obtido())).not.toThrow()
  })

  it('cancelar a inscrição para de avisar', () => {
    const ouvinte = vi.fn()
    const cancelar = ouvir(ouvinte)
    avisarAcessoObtido(obtido())

    cancelar()
    avisarAcessoObtido(obtido())

    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('cancelar duas vezes não tem efeito adicional', () => {
    const ouvinte = vi.fn()
    const cancelar = ouvir(ouvinte)
    cancelar()

    expect(() => cancelar()).not.toThrow()
    avisarAcessoObtido(obtido())
    expect(ouvinte).not.toHaveBeenCalled()
  })

  it('avisa todos os ouvintes inscritos, e cancelar um não afeta os outros', () => {
    const primeiro = vi.fn()
    const segundo = vi.fn()
    const terceiro = vi.fn()
    ouvir(primeiro)
    const cancelarSegundo = ouvir(segundo)
    ouvir(terceiro)
    const aviso = obtido()

    avisarAcessoObtido(aviso)
    cancelarSegundo()
    avisarAcessoObtido(aviso)

    expect(primeiro).toHaveBeenCalledTimes(2)
    expect(segundo).toHaveBeenCalledTimes(1)
    expect(terceiro).toHaveBeenCalledTimes(2)
    expect(primeiro).toHaveBeenCalledWith(aviso)
    expect(terceiro).toHaveBeenCalledWith(aviso)
  })

  it('um ouvinte com falha não impede os demais nem propaga o erro', () => {
    const comFalha = vi.fn(() => {
      throw new Error('falha do ouvinte')
    })
    const depois = vi.fn()
    ouvir(comFalha)
    ouvir(depois)

    expect(() => avisarAcessoObtido(obtido())).not.toThrow()
    expect(comFalha).toHaveBeenCalledTimes(1)
    expect(depois).toHaveBeenCalledTimes(1)
  })

  it('um ouvinte que cancela a própria inscrição durante o aviso não impede os demais', () => {
    const depois = vi.fn()
    let cancelarPrimeiro: () => void = () => {}
    const primeiro = vi.fn(() => cancelarPrimeiro())
    cancelarPrimeiro = ouvir(primeiro)
    ouvir(depois)

    avisarAcessoObtido(obtido())
    avisarAcessoObtido(obtido())

    expect(primeiro).toHaveBeenCalledTimes(1)
    expect(depois).toHaveBeenCalledTimes(2)
  })
})
