import { describe, expect, it } from 'vitest'
import { descreverImagensCongeladas } from './regrasPreenchimento'

const FINAL = ' Uma correção agora vale só para os períodos ainda abertos; a imagem já gerada não muda.'

/**
 * Aviso de mês já congelado (F9.8 — RF-70, RN-18): `descreverImagensCongeladas(imagens)` devolve o texto
 * do aviso da linha do apontamento, ou `null` quando o mês não está em nenhuma imagem.
 * Cada imagem é descrita como "{dashboard} · {período} ({código})"; partes ausentes são omitidas.
 */
describe('F9.8 — descreverImagensCongeladas (aviso de imagens congeladas)', () => {
  it('sem imagens → null (nenhum aviso)', () => {
    expect(descreverImagensCongeladas([])).toBeNull()
  })

  it('uma imagem completa: dashboard · período (código) e a regra da correção', () => {
    expect(descreverImagensCongeladas([{ codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' }])).toBe(
      `Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026 (IMG-000012).${FINAL}`,
    )
  })

  it('várias imagens, separadas por vírgula, na ordem recebida', () => {
    expect(
      descreverImagensCongeladas([
        { codigo: 'IMG-000012', dashboard: 'PED Gerentes', periodo: '3º tri/2026' },
        { codigo: 'IMG-000020', dashboard: 'PED Comercial', periodo: '10/2026' },
      ]),
    ).toBe(`Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026 (IMG-000012), PED Comercial · 10/2026 (IMG-000020).${FINAL}`)
  })

  it('sem código: só dashboard · período; só o código: o código', () => {
    expect(
      descreverImagensCongeladas([
        { codigo: null, dashboard: 'PED Gerentes', periodo: '3º tri/2026' },
        { codigo: 'IMG-000030', dashboard: null, periodo: null },
      ]),
    ).toBe(`Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026, IMG-000030.${FINAL}`)
  })

  it('sem período: dashboard (código)', () => {
    expect(descreverImagensCongeladas([{ codigo: 'IMG-000040', dashboard: 'PED Gerentes', periodo: null }])).toBe(
      `Este mês já foi congelado na imagem de: PED Gerentes (IMG-000040).${FINAL}`,
    )
  })

  it('imagem sem nenhuma identificação continua avisando: "imagem sem identificação"', () => {
    expect(descreverImagensCongeladas([{ codigo: null, dashboard: null, periodo: null }])).toBe(
      `Este mês já foi congelado na imagem de: imagem sem identificação.${FINAL}`,
    )
  })
})
