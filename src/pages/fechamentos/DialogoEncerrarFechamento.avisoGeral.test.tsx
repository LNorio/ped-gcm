import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { FECHAMENTO_COMERCIAL_API, respostaEncerramentoApi } from '../../test/fechamentosFalsos'
import {
  AVISO_DRG_API,
  carregarFechamentoDominio,
  carregarPreviaDominio,
  previaComercialComResumoRealApi,
} from '../../test/previaFalsos'
import { DialogoEncerrarFechamento } from './DialogoEncerrarFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const TITULO = 'Encerrar PED Comercial — 4º tri/2026'

/**
 * F10.5 — Confirmação do encerramento com o aviso geral da prévia (resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seção 4).
 *
 * Os itens de `resumo.avisos` da prévia (hoje, o aviso único do DRG: "Composicao do Resultado Operacional
 * indisponivel: fonte de dados (DRG) nao configurada.") aparecem **uma vez** na confirmação, junto dos
 * avisos de pendências e de falta de faixas — tanto com a prévia recebida da pré-visualização quanto com
 * a consultada pelo próprio diálogo (aberto pelo menu). O texto repetido nos avisos das imagens não se
 * repete. No bloqueio sem imagens a gerar, nada muda (só a explicação e "Entendi").
 */
describe('F10.5 — DialogoEncerrarFechamento: aviso geral do DRG uma vez só', () => {
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

  const dialogo = () => screen.getByRole('dialog', { name: TITULO })

  it('com a prévia recebida: o aviso do DRG aparece uma vez, com os avisos de pendências e de falta de faixas', async () => {
    const previa = await carregarPreviaDominio(fetchFalso, previaComercialComResumoRealApi(), 1)
    simularApi(fetchFalso, {})

    render(<DialogoEncerrarFechamento fechamento={COMERCIAL} previa={previa} onCancelar={vi.fn()} onEncerrado={vi.fn()} />)

    expect(within(dialogo()).getAllByText(AVISO_DRG_API)).toHaveLength(1)
    expect(within(dialogo()).getByText(/^Filiais com lançamentos pendentes: 102\./)).toBeInTheDocument()
    expect(within(dialogo()).getByText(/^Filiais sem tabela de faixas: 102\./)).toBeInTheDocument()
  })

  it('aberto pelo menu (consulta a prévia): o aviso do DRG aparece uma vez', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/fechamentos/1/previa': () => respostaJson(previaComercialComResumoRealApi()),
      'POST /api/ped/fechamentos/1/encerrar': () => respostaJson(respostaEncerramentoApi()),
    })

    render(<DialogoEncerrarFechamento fechamento={COMERCIAL} onCancelar={vi.fn()} onEncerrado={vi.fn()} />)

    await within(dialogo()).findByText('Total de imagens a gerar: 2 (uma por filial)')
    expect(within(dialogo()).getAllByText(AVISO_DRG_API)).toHaveLength(1)
  })

  it('sem resumo.avisos, o aviso do DRG não aparece na confirmação', async () => {
    const api = previaComercialComResumoRealApi()
    api.resumo.avisos = []
    const previa = await carregarPreviaDominio(fetchFalso, api, 1)
    simularApi(fetchFalso, {})

    render(<DialogoEncerrarFechamento fechamento={COMERCIAL} previa={previa} onCancelar={vi.fn()} onEncerrado={vi.fn()} />)

    expect(within(dialogo()).getByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
    expect(within(dialogo()).queryByText(AVISO_DRG_API)).not.toBeInTheDocument()
  })
})
