import { describe, expect, it } from 'vitest'
import tema from './tema.css?raw'
import main from '../main.tsx?raw'

const variavel = (nome: string, valor: string) => new RegExp(`${nome}\\s*:\\s*${valor}\\s*;`, 'i')

describe('F1.5 — Identidade visual (tema)', () => {
  it('define os tokens de cor do protótipo como variáveis CSS', () => {
    expect(tema).toMatch(variavel('--cor-primaria', '#0062AF'))
    expect(tema).toMatch(variavel('--cor-dourado', '#C49A4E'))
    expect(tema).toMatch(variavel('--cor-dourado-escuro', '#C99A4C'))
    expect(tema).toMatch(variavel('--cor-fundo', '#F2F5F9'))
    expect(tema).toMatch(variavel('--cor-texto', '#1D2A36'))
  })

  it('usa a fonte Ubuntu na família de fontes padrão', () => {
    expect(tema).toMatch(/font-family\s*:\s*['"]?Ubuntu['"]?/i)
  })

  it('não carrega fontes do Google Fonts', () => {
    expect(tema).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i)
    expect(main).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i)
  })

  it('main.tsx importa a fonte Ubuntu do pacote local @fontsource/ubuntu e o tema', () => {
    expect(main).toMatch(/import\s+['"]@fontsource\/ubuntu/)
    expect(main).toMatch(/import\s+['"]\.\/estilos\/tema\.css['"]/)
  })
})
