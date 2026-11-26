import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import previaReal from '../../../docs/backend/exemplos-reais/previa.json'
import { obterPreviaFechamento } from '../../services/fechamentosService'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import type { ImagemCongelada } from '../../types/dominio'
import { agruparPorFilial, rotuloFilial, textoImagens } from './previaFechamento'

/**
 * F10.4 / F10.5 — Agrupamento das imagens da prévia por filial (`agruparPorFilial` e `rotuloFilial`, de
 * `src/pages/fechamentos/previaFechamento.ts`), usado pela pré-visualização e pela confirmação do
 * encerramento. Motivo (24/11/2026): contra o servidor real, a pré-visualização mostrava
 * "Filial · 60 imagens" — o código da filial não era lido de `unidade.filial` em `{ codigo, nome }`
 * (`docs/backend/exemplos-reais/previa.json`) e todas as imagens caíam num grupo sem código.
 */
describe('F10.4 — Agrupamento das imagens da prévia por filial', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function imagensDaPreviaReal(): Promise<ImagemCongelada[]> {
    simularApi(fetchFalso, { 'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaReal) })
    return (await obterPreviaFechamento(2)).imagens
  }

  describe('com a prévia real (previa.json)', () => {
    it('agrupa em "Filial 101 - Filial 101" e "Filial 403 - Filial 403", em ordem de código, com 1 imagem cada', async () => {
      const grupos = agruparPorFilial(await imagensDaPreviaReal())

      expect(grupos.map((grupo) => rotuloFilial(grupo.codigo, grupo.nome))).toEqual([
        'Filial 101 - Filial 101',
        'Filial 403 - Filial 403',
      ])
      expect(grupos.map((grupo) => textoImagens(grupo.imagens.length))).toEqual(['1 imagem', '1 imagem'])
    })

    it('cada grupo tem as imagens da sua filial (André na 101, Alexandre na 403)', async () => {
      const [filial101, filial403] = agruparPorFilial(await imagensDaPreviaReal())

      expect(filial101.imagens.map((imagem) => imagem.unidade.colaborador)).toEqual(['Andre Luiz Mendes Monteiro'])
      expect(filial403.imagens.map((imagem) => imagem.unidade.colaborador)).toEqual(['Alexandre dos Santos Sousa'])
    })

    it('nunca há um grupo sem código (rótulo "Filial" sozinho)', async () => {
      const grupos = agruparPorFilial(await imagensDaPreviaReal())

      expect(grupos.every((grupo) => grupo.codigo !== '')).toBe(true)
      expect(grupos.map((grupo) => rotuloFilial(grupo.codigo, grupo.nome).trim())).not.toContain('Filial')
    })
  })
})
