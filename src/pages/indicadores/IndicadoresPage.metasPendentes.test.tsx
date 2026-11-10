import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { podeExecutar } from '../../sessao/permissoes'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_TICKET_MEDIO_API,
  indicadoresComMetaPendenteApi,
  rotaListarIndicadoresComMetaPendente,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { IndicadoresPage } from './IndicadoresPage'

vi.mock('../../sessao/permissoes', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../sessao/permissoes')>()
  return { ...real, podeExecutar: vi.fn(real.podeExecutar) }
})

/**
 * F6.12 — "Definir metas pendentes" na página: a ação usa a mesma permissão de "Definir meta"
 * (`definir-meta-indicador`: Admin e Validador; o Preenchedor não vê) e respeita a filial do cabeçalho.
 */
const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'
const ITEM = 'Definir metas pendentes'

describe('F6.12 — IndicadoresPage: permissão e visão da ação "Definir metas pendentes"', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(async () => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    const real = await vi.importActual<typeof import('../../sessao/permissoes')>('../../sessao/permissoes')
    vi.mocked(podeExecutar).mockClear()
    vi.mocked(podeExecutar).mockImplementation(real.podeExecutar)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function abrirTela(perfil: Perfil, filialSelecionada: FilialSelecionada = 'todas', lista: IndicadorApiFalso[] = indicadoresComMetaPendenteApi()) {
    simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarIndicadoresComMetaPendente(() => lista) })
    const acesso = acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso, filialSelecionada }}>
        <IndicadoresPage />
      </ProvedorSessaoFalso>,
    )
    await screen.findByRole('table', { name: 'Indicadores' })
  }

  const itensDoTicket = () => itensDoMenuAcoes(usuarioRapido(), rotuloAcoesIndicador('Ticket médio por filial'))

  it.each(['admin', 'validador'] as const)('%s vê "Definir metas pendentes" no indicador com filiais sem meta', async (perfil) => {
    await abrirTela(perfil)

    expect(await itensDoTicket()).toContain(ITEM)
  })

  it('o Preenchedor não vê a ação', async () => {
    await abrirTela('preenchedor')

    expect(await itensDoTicket()).not.toContain(ITEM)
  })

  it('quem decide é a permissão "definir-meta-indicador": negada, nem o Admin vê a ação', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'definir-meta-indicador')
    await abrirTela('admin')

    expect(await itensDoTicket()).not.toContain(ITEM)
  })

  it('com a filial 101 (pendente) no cabeçalho, a ação aparece', async () => {
    await abrirTela('admin', FILIAIS[1])
    expect(await itensDoTicket()).toContain(ITEM)
  })

  it('com a filial 100 (já tem meta) no cabeçalho, a ação não aparece', async () => {
    await abrirTela('admin', FILIAIS[0])
    expect(await itensDoTicket()).not.toContain(ITEM)
  })

  it('indicador de meta via API (F6.11) com filiais sem meta não oferece a ação', async () => {
    const viaApi: IndicadorApiFalso = {
      ...INDICADOR_META_API_PENDENTE_API,
      'metas por filial': INDICADOR_TICKET_MEDIO_API['metas por filial'],
      'filiais sem meta': ['101', '102'],
      'meta por filial': true,
    }
    await abrirTela('admin', 'todas', [viaApi])

    expect(await itensDoMenuAcoes(usuarioRapido(), rotuloAcoesIndicador('Faturamento com meta da TI'))).not.toContain(ITEM)
  })
})
