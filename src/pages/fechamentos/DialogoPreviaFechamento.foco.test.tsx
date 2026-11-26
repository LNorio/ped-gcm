import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { FECHAMENTO_COMERCIAL_API, FECHAMENTO_GERENTES_API, previaComercialApi, type PreviaFechamentoApiFalsa } from '../../test/fechamentosFalsos'
import { TIPO_PDF, conteudoPdfPrevia, nomePdfPrevia, respostaArquivo, simularUrlsDeObjeto } from '../../test/pdfFalsos'
import { carregarFechamentoDominio, previaGerentesComEquipeApi } from '../../test/previaFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Fechamento } from '../../types/dominio'
import { DialogoPreviaFechamento } from './DialogoPreviaFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const GERENTES = carregarFechamentoDominio(FECHAMENTO_GERENTES_API)

/**
 * F12.1 (RNF-05, item M14 da revisão de acessibilidade de 24/11/2026) — navegação da pré-visualização
 * ("Imagem anterior" e "Próxima imagem", `DialogoPreviaFechamento.tsx`).
 *
 * Na primeira e na última imagem, o botão usado fica desabilitado com o foco nele e o foco se perdia.
 * Regra: os botões continuam `disabled` nas pontas (F10.4), mas o foco vai para o outro botão de
 * navegação; no meio da lista, o foco fica no botão usado. A posição "Imagem X de N · Filial F" fica numa
 * região `role="status"` dentro do diálogo, para ser anunciada a cada troca.
 */
describe('F12.1 — DialogoPreviaFechamento: foco e anúncio na navegação das imagens (M14)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function renderizar(fechamento: Fechamento, id: number, previa: PreviaFechamentoApiFalsa) {
    simularApi(fetchFalso, {
      [`GET /api/ped/fechamentos/${id}/previa`]: () => respostaJson(previa),
      [`GET /api/ped/fechamentos/${id}/previa/pdf`]: (_init, url) => {
        const chave = url.searchParams.get('chave') ?? ''
        return respostaArquivo(conteudoPdfPrevia(id, chave), TIPO_PDF, nomePdfPrevia(id, chave))
      },
    })
    render(<DialogoPreviaFechamento fechamento={fechamento} onFechar={vi.fn()} onEncerrar={vi.fn()} />)
    const dialogo = await screen.findByRole('dialog', { name: /^Pré-visualização — / })
    await within(dialogo).findByRole('combobox', { name: 'Filial' })
    return dialogo
  }

  const anterior = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Imagem anterior' })
  const proxima = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Próxima imagem' })

  it('"Próxima imagem" até a última: o botão fica desabilitado e o foco vai para "Imagem anterior"', async () => {
    const user = usuarioRapido()
    const dialogo = await renderizar(COMERCIAL, 1, previaComercialApi())

    await user.click(proxima(dialogo))

    expect(within(dialogo).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()
    expect(proxima(dialogo)).toBeDisabled()
    expect(anterior(dialogo)).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('"Imagem anterior" até a primeira: o botão fica desabilitado e o foco vai para "Próxima imagem"', async () => {
    const user = usuarioRapido()
    const dialogo = await renderizar(COMERCIAL, 1, previaComercialApi())
    await user.click(proxima(dialogo))

    await user.click(anterior(dialogo))

    expect(within(dialogo).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
    expect(anterior(dialogo)).toBeDisabled()
    expect(proxima(dialogo)).toHaveFocus()
  })

  it('pelo teclado (Enter): chegar à última imagem também leva o foco a "Imagem anterior"', async () => {
    const user = usuarioRapido()
    const dialogo = await renderizar(COMERCIAL, 1, previaComercialApi())

    proxima(dialogo).focus()
    await user.keyboard('{Enter}')

    expect(within(dialogo).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()
    expect(anterior(dialogo)).toHaveFocus()
  })

  it('no meio da lista, o foco continua no botão usado', async () => {
    const user = usuarioRapido()
    const dialogo = await renderizar(GERENTES, 2, previaGerentesComEquipeApi())

    await user.click(proxima(dialogo))

    expect(within(dialogo).getByText(/^Imagem 2 de 4/)).toBeInTheDocument()
    expect(proxima(dialogo)).toBeEnabled()
    expect(proxima(dialogo)).toHaveFocus()
  })

  it('a posição "Imagem X de N · Filial F" fica numa região status dentro do diálogo e acompanha a navegação', async () => {
    const user = usuarioRapido()
    const dialogo = await renderizar(COMERCIAL, 1, previaComercialApi())

    const posicao = within(dialogo).getByText('Imagem 1 de 2 · Filial 101')
    const regiao = posicao.closest('[role="status"]')
    expect(regiao).not.toBeNull()
    expect(dialogo.contains(regiao)).toBe(true)

    await user.click(proxima(dialogo))

    expect(within(dialogo).getByText('Imagem 2 de 2 · Filial 102').closest('[role="status"]')).not.toBeNull()
  })
})
