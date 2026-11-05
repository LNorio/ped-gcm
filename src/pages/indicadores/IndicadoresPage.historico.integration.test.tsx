import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { indicadoresApi, rotaHistoricoMetas, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_HISTORICO = `${ROTA}/3/metas-historico`

describe('F6.8 — Histórico de alterações de meta (integração: /indicadores, filtrado pela filial do cabeçalho)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(perfil: 'admin' | 'validador', aoListarHistorico?: RotaFalsa) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(indicadoresApi),
      [`GET ${ROTA_HISTORICO}`]: aoListarHistorico ?? rotaHistoricoMetas(),
    })
  }

  const getsHistorico = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_HISTORICO)
  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de metas' })
  const linhas = () => within(within(dialogo()).getByRole('table', { name: 'Histórico de metas' })).getAllByRole('row').slice(1)

  async function abrirHistorico(user: ReturnType<typeof usuarioRapido>) {
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Histórico de metas')
    return dialogo()
  }

  it('"Histórico de metas" só aparece em indicadores com meta editável', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })

    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento líquido mensal'))).toContain('Histórico de metas')
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))).toContain('Histórico de metas')
    for (const nome of ['Cobertura de visitas', 'Devoluções de venda', 'Capacitação']) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))).not.toContain('Histórico de metas')
    }
  })

  it('Admin com "Todas as filiais" no cabeçalho: GET .../metas-historico sem filial, com o Bearer, e a tabela com todos os ajustes', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirHistorico(user)

    await waitFor(() => expect(linhas()).toHaveLength(3))
    expect(getsHistorico(chamadas)).toHaveLength(1)
    expect(getsHistorico(chamadas)[0].url.search).toBe('')
    expect(cabecalhoDaChamada(getsHistorico(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(within(dialogo()).getByText('Todas as filiais')).toBeInTheDocument()
    expect(within(linhas()[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '28/10/2026 09:12',
      '101',
      '10/2026',
      '1.500.000,50',
      '1.600.000,00',
      'Ana Costa',
      'Sazonalidade de outubro',
    ])
    expect(within(linhas()[2]).getAllByRole('cell')[3]).toHaveTextContent(/^—$/)
  })

  it('trocar a filial no cabeçalho com o diálogo aberto refaz a consulta com filial=<código> e filtra as linhas', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirHistorico(user)
    await waitFor(() => expect(linhas()).toHaveLength(3))

    await user.selectOptions(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' }), '102')

    await waitFor(() => expect(getsHistorico(chamadas)).toHaveLength(2))
    expect(getsHistorico(chamadas)[1].url.searchParams.get('filial')).toBe('102')
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(within(dialogo()).getByText('Filial 102')).toBeInTheDocument()
    expect(within(linhas()[0]).getAllByRole('cell')[5]).toHaveTextContent('Beltrano')
  })

  it('com uma filial já escolhida no cabeçalho, abrir o histórico consulta direto com filial=<código>', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await user.selectOptions(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' }), '101')

    await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Histórico de metas')

    await waitFor(() => expect(getsHistorico(chamadas)).toHaveLength(1))
    expect(getsHistorico(chamadas)[0].url.searchParams.get('filial')).toBe('101')
    await waitFor(() => expect(linhas()).toHaveLength(2))
  })

  it('sem ajustes mostra "Nenhuma alteração de meta registrada."', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaJson([]))
    await abrirHistorico(user)

    expect(await within(dialogo()).findByText('Nenhuma alteração de meta registrada.')).toBeInTheDocument()
  })

  it('erro na consulta mostra o Aviso de erro com "Tentar novamente" dentro do diálogo; tentar de novo carrega a tabela', async () => {
    const user = usuarioRapido()
    let falhar = true
    simularSessao('admin', (init, url) => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : rotaHistoricoMetas()(init, url)))
    await abrirHistorico(user)

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')

    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(linhas()).toHaveLength(3))
  })

  it('"Fechar" fecha o diálogo e devolve o foco ao gatilho do menu; a lista continua intacta', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirHistorico(user)
    await waitFor(() => expect(linhas()).toHaveLength(3))

    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: rotuloAcoesIndicador('Faturamento líquido mensal') })).toHaveFocus()
    expect(screen.getByRole('table', { name: 'Indicadores' })).toBeInTheDocument()
  })
})
