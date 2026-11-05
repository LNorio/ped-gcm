import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { criarApiFaixasFalsa } from '../../test/faixasFalsos'
import { escolherAcao, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import { formatarMoeda } from '../../utils/formato'

const ROTA = '/api/ped/faixas'
const COMERCIAL_101 = 'PED Comercial · Filial 101'

describe('F8.5 — Histórico de versões das faixas (integração: /faixas — RF-45, RNF-01)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' = 'admin') {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiFaixasFalsa()
    return simularApi(fetchFalso, { 'GET /api/ped/acesso': () => respostaJson(acesso), ...api.rotas })
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de versões' })

  async function abrirHistorico(user: Usuario) {
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
    await escolherAcao(user, rotuloAcoesTabelaFaixas(COMERCIAL_101), 'Histórico de versões')
    return await within(dialogo()).findByRole('table', { name: 'Versões' })
  }

  it('Admin abre o histórico pelo menu: GET .../1/historico com o Bearer e as versões com a vigente marcada', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()

    const versoes = await abrirHistorico(user)

    const consulta = gets(chamadas, `${ROTA}/1/historico`)
    expect(consulta).toHaveLength(1)
    expect(cabecalhoDaChamada(consulta[0], 'Authorization')).toBe('Bearer token-salvo')
    const [v2, v1] = within(versoes).getAllByRole('row').slice(1)
    expect(v2).toHaveTextContent('v2')
    expect(within(v2).getByText('Vigente')).toBeInTheDocument()
    expect(v2).toHaveTextContent('Reajuste do trimestre')
    expect(v1).toHaveTextContent('Cadastro inicial')
    expect(within(v1).queryByText('Vigente')).not.toBeInTheDocument()
  })

  it('ver as faixas da versão anterior consulta GET .../1/versoes/1 e as mostra no diálogo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirHistorico(user)

    await user.click(within(dialogo()).getByRole('button', { name: 'Ver faixas da versão v1' }))

    const faixas = await within(dialogo()).findByRole('table', { name: 'Faixas da versão v1' })
    expect(within(faixas).getByText(formatarMoeda(3000).replace(/\s/g, ' '))).toBeInTheDocument()
    expect(gets(chamadas, `${ROTA}/1/versoes/1`)).toHaveLength(1)
  })

  it('Validador também vê o histórico (documento prevalece — P-04)', async () => {
    const user = usuarioRapido()
    simularSessao('validador')

    const versoes = await abrirHistorico(user)

    expect(within(versoes).getAllByRole('row').slice(1)).toHaveLength(2)
  })

  it('"Fechar" fecha o histórico e a tabela de faixas continua na tela', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirHistorico(user)

    await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Tabelas de faixas' })).toBeInTheDocument()
  })
})
