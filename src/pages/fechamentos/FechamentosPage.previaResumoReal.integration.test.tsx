import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { criarApiFechamentosFalsa } from '../../test/fechamentosFalsos'
import { escolherAcao } from '../../test/menuAcoes'
import { adicionarRotasPdf, simularUrlsDeObjeto } from '../../test/pdfFalsos'
import {
  AVISO_DRG_API,
  ITEM_PRE_VISUALIZAR,
  previaComercialComResumoRealApi,
  rotuloAcoesFechamento,
} from '../../test/previaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const TITULO_PREVIA = 'Pré-visualização — PED Comercial · 4º tri/2026'
const TITULO_CONFIRMACAO = 'Encerrar PED Comercial — 4º tri/2026'

/**
 * F10.4 — Pré-visualização na aba Fechamentos com o resumo de 24/11/2026 (integração: página + menu da
 * linha + `DialogoPreviaFechamento` + `DialogoEncerrarFechamento` + serviço, só a rede simulada; resposta do
 * back-end de 25/11/2026, `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seções 2 e 4).
 *
 * - "Progresso da filial {código}: {preenchidos} de {total}" acompanha a filial escolhida;
 * - o aviso geral do DRG (`resumo.avisos`) aparece uma vez na prévia e uma vez na confirmação aberta por
 *   "Encerrar e gerar 2 imagens", embora venha também nos avisos de cada imagem.
 */
describe('F10.4 — Fechamentos: prévia com progresso por filial e aviso do DRG uma vez só (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao() {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    const api = adicionarRotasPdf(criarApiFechamentosFalsa())
    Object.assign(api.rotas, { 'GET /api/ped/fechamentos/1/previa': () => respostaJson(previaComercialComResumoRealApi()) })
    return simularApi(fetchFalso, { 'GET /api/ped/acesso': () => respostaJson(acesso), ...api.rotas })
  }

  it('mostra o progresso da filial escolhida e o aviso do DRG uma vez; a confirmação também o mostra uma vez', async () => {
    const user = usuarioRapido()
    simularSessao()
    renderizarApp('/fechamentos')
    await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })

    await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)
    const previa = await screen.findByRole('dialog', { name: TITULO_PREVIA })
    const filial = await within(previa).findByRole('combobox', { name: 'Filial' })

    expect(within(previa).getByText('Progresso da filial 101: 3 de 3')).toBeInTheDocument()
    expect(within(previa).getAllByText(AVISO_DRG_API)).toHaveLength(1)

    await user.selectOptions(filial, '102')
    expect(await within(previa).findByText('Progresso da filial 102: 2 de 3')).toBeInTheDocument()
    expect(within(previa).getAllByText(AVISO_DRG_API)).toHaveLength(1)

    await user.click(within(previa).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

    const confirmacao = await screen.findByRole('dialog', { name: TITULO_CONFIRMACAO })
    expect(within(confirmacao).getAllByText(AVISO_DRG_API)).toHaveLength(1)
  })
})
