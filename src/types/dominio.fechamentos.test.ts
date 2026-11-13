import { describe, expect, it } from 'vitest'
import { ROTULOS_SITUACAO_PERIODO, ROTULOS_TIPO_IMAGEM, SITUACOES_PERIODO, TIPOS_IMAGEM } from './dominio'

describe('F10.1 — Enums do domínio dos fechamentos e imagens congeladas (RF-79, RF-83, RF-84)', () => {
  it('tipos de imagem congelada (A-07): filial e colaborador, com rótulos em pt-BR', () => {
    expect(TIPOS_IMAGEM).toEqual(['filial', 'colaborador'])
    expect(ROTULOS_TIPO_IMAGEM).toEqual({ filial: 'Filial', colaborador: 'Colaborador' })
  })

  it('situações do período atual nos fechamentos (RF-79), com rótulos em pt-BR', () => {
    expect(SITUACOES_PERIODO).toEqual(['aberto', 'encerrado'])
    expect(ROTULOS_SITUACAO_PERIODO).toEqual({ aberto: 'Em aberto', encerrado: 'Encerrado' })
  })
})
