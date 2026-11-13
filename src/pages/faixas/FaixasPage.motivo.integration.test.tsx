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
import {
  NOME_COMERCIAL_100_INATIVA,
  NOME_GERAL_SUPERVISORES,
  criarApiFaixasFalsa,
  tabelasFaixasComSituacaoApi,
} from '../../test/faixasFalsos'
import { escolherAcao, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA = '/api/ped/faixas'
const COMERCIAL_101 = 'PED Comercial · Filial 101'

/**
 * "Ver motivo" (pedido do usuário de 12/11/2026: "ter um botão que mostra o motivo da alteração da
 * versão das faixas"): botão em cada linha da aba Faixas que abre "Motivo da última alteração" com a
 * linha mais recente de `GET .../{id}/historico` (rota existente).
 */
describe('F8.8 — "Ver motivo" na aba Faixas (integração: /faixas)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiFaixasFalsa(tabelasFaixasComSituacaoApi())
    return simularApi(fetchFalso, { 'GET /api/ped/acesso': () => respostaJson(acesso), ...api.rotas, ...rotasExtras })
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const dialogo = () => screen.getByRole('dialog', { name: 'Motivo da última alteração' })
  const linha = (nome: string) => screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(nome) }).closest('tr')!
  function valor(rotulo: string): string | null {
    const termo = within(dialogo()).queryByText(rotulo, { selector: 'dt' })
    return termo === null ? null : (termo.nextElementSibling?.textContent ?? null)
  }

  async function abrirTela() {
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
  }

  async function verMotivo(user: Usuario, nome: string) {
    await user.click(within(linha(nome)).getByRole('button', { name: 'Ver motivo' }))
    return dialogo()
  }

  it('Admin: "Ver motivo" consulta GET .../1/historico com o Bearer e mostra ação, motivo, autor e data da última alteração', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTela()

    await verMotivo(user, COMERCIAL_101)

    await waitFor(() => expect(valor('Motivo')).toBe('Reajuste do trimestre'))
    expect(valor('Ação')).toBe('Alteração das faixas')
    expect(valor('Autor')).toBe('Ana Costa')
    expect(valor('Data')).toBe('20/10/2026 15:30')
    const consulta = gets(chamadas, `${ROTA}/1/historico`)
    expect(consulta).toHaveLength(1)
    expect(cabecalhoDaChamada(consulta[0], 'Authorization')).toBe('Bearer token-salvo')
  })

  it('tabela inativa (filtro "Inativas"): mostra a inativação e o motivo da situação', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação' }), screen.getByRole('option', { name: 'Inativas' }))
    await waitFor(() => expect(screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA) })).toBeInTheDocument())

    await verMotivo(user, NOME_COMERCIAL_100_INATIVA)

    await waitFor(() => expect(valor('Ação')).toBe('Inativação'))
    expect(valor('Motivo da inativação')).toBe('Filial passou a usar outra régua')
    expect(valor('Inativada em')).toBe('10/11/2026 08:00 por Ana Costa')
  })

  it('depois de inativar, "Ver motivo" (filtro "Todas") mostra a nova inativação, com o motivo informado e o autor', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()

    await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES), 'Inativar tabela')
    const inativar = screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })
    await colar(user, within(inativar).getByRole('textbox', { name: 'Motivo da inativação' }), 'passou a valer faixa por filial')
    await user.click(within(inativar).getByRole('button', { name: 'Inativar' }))
    await screen.findByText('Tabela de faixas inativada.')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação' }), screen.getByRole('option', { name: 'Todas' }))
    await waitFor(() => expect(screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES) })).toBeInTheDocument())
    await verMotivo(user, NOME_GERAL_SUPERVISORES)

    await waitFor(() => expect(valor('Ação')).toBe('Inativação'))
    expect(valor('Motivo')).toBe('passou a valer faixa por filial')
    expect(valor('Autor')).toBe('Fulano')
    expect(valor('Data')).toBe('12/11/2026 09:00')
  })

  it('erro na consulta: alerta no diálogo com a mensagem da API; "Fechar" volta à lista', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { [`GET ${ROTA}/1/historico`]: () => respostaErro(500, 'Falha ao consultar o histórico.') })
    await abrirTela()

    await verMotivo(user, COMERCIAL_101)

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')
    await user.click(within(dialogo()).getAllByRole('button', { name: 'Fechar' })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Tabelas de faixas' })).toBeInTheDocument()
  })

  it('Validador também vê o motivo, inclusive da faixa geral', async () => {
    const user = usuarioRapido()
    simularSessao('validador')
    await abrirTela()

    await verMotivo(user, NOME_GERAL_SUPERVISORES)

    await waitFor(() => expect(valor('Ação')).toBe('Cadastro'))
    expect(valor('Motivo')).toBe('Cadastro inicial')
    expect(valor('Autor')).toBe('Ana Costa')
  })
})
