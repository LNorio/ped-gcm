import { act, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../services/sessao'
import type { Aba } from '../sessao/permissoes'
import type { Perfil } from '../types/dominio'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { respostaJson, rotaEmSequencia, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../test/apiFalsa'
import {
  CHAVE_ROTA_ALERTAS_MENU,
  ROTA_ALERTAS_MENU,
  alertasMenuAdminApi,
  alertasMenuAdminSemAlertasApi,
} from '../test/alertasMenuFalsos'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { useAlertasMenu } from './AlertasMenu'
import { LayoutPrincipal } from './LayoutPrincipal'

/**
 * F2.12 — o `LayoutPrincipal` monta o verificador central dos alertas do menu: as abas acendem pelo
 * `GET /api/ped/alertas-menu`, sem abrir a tela, e o marcador "Com alertas" (F6.3) ganha como dica
 * (descrição acessível, ex.: `title`) as `descricao` dos itens unidas por " · ". A dica nunca é montada
 * a partir de `total`.
 */

/** Tela falsa que informa alerta pela própria listagem, como IndicadoresPage e DadosExternosPage. */
function TelaComAlerta({ aba }: { aba: Aba }) {
  const { definirAlerta } = useAlertasMenu()
  useEffect(() => {
    definirAlerta(aba, true)
  }, [definirAlerta, aba])
  return <p>{`Conteúdo de ${aba}`}</p>
}

function renderizar(perfil: Perfil, caminho = '/') {
  const acesso = acessoFalso({ perfil, todasAsFiliais: perfil !== 'preenchedor', filiais: FILIAIS })
  return render(
    <ProvedorSessaoFalso sessao={{ estado: 'autenticado', acesso }}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route element={<LayoutPrincipal />}>
            <Route path="/" element={<p>Conteúdo do Início</p>} />
            <Route path="/faixas" element={<TelaComAlerta aba="faixas" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

const abas = () => screen.getByRole('navigation', { name: 'Abas' })
const link = (nome: RegExp) => within(abas()).getByRole('link', { name: nome })
const marcador = (nome: RegExp) => within(link(nome)).queryByRole('img', { name: 'Com alertas' })

function consultas(chamadas: ChamadaRegistrada[]) {
  return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_ALERTAS_MENU)
}

describe('F2.12 — LayoutPrincipal: alertas das abas do menu pela rota e dica no marcador', () => {
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

  function simular(rota: RotaFalsa) {
    return simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: rota })
  }

  it('acende Indicadores e Dados Externos sem abrir as telas; as demais abas ficam sem marcador', async () => {
    const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
    renderizar('admin')

    await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
    expect(marcador(/^Dados Externos/)).not.toBeNull()
    for (const nome of [/^Início/, /^Tipos/, /^Apontamentos/, /^Faixas/, /^Dashboards/, /^Preenchimento/, /^Fechamentos/]) {
      expect(marcador(nome)).toBeNull()
    }
    expect(screen.getByText('Conteúdo do Início')).toBeInTheDocument()
    expect(consultas(chamadas)).toHaveLength(1)
  })

  it('o marcador mostra como dica as descricao dos itens unidas por " · ", na ordem da resposta', async () => {
    simular(() => respostaJson(alertasMenuAdminApi()))
    renderizar('admin')

    await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
    expect(marcador(/^Indicadores/)).toHaveAccessibleDescription(
      '2 indicadores aguardando definição de meta · 3 indicadores com filial sem meta · 1 indicador com integração da meta pendente',
    )
    expect(marcador(/^Dados Externos/)).toHaveAccessibleDescription('4 dados externos sem integração configurada')
  })

  it('a dica não muda o texto nem o nome do link (o link continua "Indicadores")', async () => {
    simular(() => respostaJson(alertasMenuAdminApi()))
    renderizar('admin')

    await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
    expect(link(/^Indicadores/).textContent).toBe('Indicadores')
    expect(link(/^Indicadores/)).toHaveClass('layout-principal__aba--com-alerta')
  })

  it('a dica nunca é montada a partir de total: itens sem descricao não geram texto com o número', async () => {
    simular(() =>
      respostaJson({
        abas: {
          indicadores: {
            total: 3,
            itens: [
              { codigo: 'aguardando meta', quantidade: 2, descricao: null },
              { codigo: 'com componente desativado', quantidade: 1, descricao: '1 indicador com componente desativado' },
            ],
          },
          'dados-externos': { total: 4, itens: [{ codigo: 'integracao pendente', quantidade: 4, descricao: null }] },
        },
      }),
    )
    renderizar('admin')

    await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
    expect(marcador(/^Indicadores/)).toHaveAccessibleDescription('1 indicador com componente desativado')
    const dicaDadosExternos = marcador(/^Dados Externos/)
    expect(dicaDadosExternos).not.toBeNull()
    expect(dicaDadosExternos).not.toHaveAccessibleDescription(/4/)
    expect(screen.queryByText(/3 indicadores/)).not.toBeInTheDocument()
  })

  it('a dica acompanha a resposta mais recente e some quando a aba apaga (total 0)', async () => {
    const chamadas = simular(
      rotaEmSequencia(
        () => respostaJson(alertasMenuAdminApi()),
        () =>
          respostaJson({
            abas: {
              ...alertasMenuAdminSemAlertasApi().abas,
              indicadores: {
                total: 1,
                itens: [{ codigo: 'aguardando meta', quantidade: 1, descricao: '1 indicador aguardando definição de meta' }],
              },
            },
          }),
      ),
    )
    renderizar('admin')
    await waitFor(() => expect(marcador(/^Dados Externos/)).not.toBeNull())

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
    await waitFor(() => expect(marcador(/^Dados Externos/)).toBeNull())
    expect(marcador(/^Indicadores/)).toHaveAccessibleDescription('1 indicador aguardando definição de meta')
  })

  it('aba acesa só pela tela (definirAlerta), sem itens da rota, mostra o marcador sem dica', async () => {
    simular(() => respostaJson({ abas: {} }))
    renderizar('admin', '/faixas')

    expect(await screen.findByText('Conteúdo de faixas')).toBeInTheDocument()
    await waitFor(() => expect(marcador(/^Faixas/)).not.toBeNull())
    expect(marcador(/^Faixas/)).toHaveAccessibleDescription('')
  })

  it('Preenchedor: só as abas do menu dele; Indicadores não aparece mesmo que a resposta traga a chave', async () => {
    const chamadas = simular(() =>
      respostaJson({
        abas: {
          inicio: { total: 0, itens: [] },
          apontamentos: { total: 0, itens: [] },
          'dados-externos': { total: 0, itens: [] },
          preenchimento: { total: 0, itens: [] },
          indicadores: { total: 2, itens: [{ codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' }] },
        },
      }),
    )
    renderizar('preenchedor')

    await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
    expect(within(abas()).queryByRole('link', { name: /Indicadores/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
  })
})
