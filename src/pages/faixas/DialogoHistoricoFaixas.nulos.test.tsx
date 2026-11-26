import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { TABELA_COMERCIAL_101_API, historicoComAcaoFaixasApi, historicoComNulosFaixasApi, versaoFaixasApi } from '../../test/faixasFalsos'
import { DialogoHistoricoFaixas } from './DialogoHistoricoFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const ROTA = '/api/ped/faixas'
const SEM_VALOR = '—'

/**
 * D2 — Histórico de versões com os nulos do contrato real (resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`).
 *
 * Regra de exibição (padrão do projeto para dado ausente, o mesmo "—" da coluna Faixas):
 * - `motivo` null (cadastro da versão 1 sem motivo): a célula "Motivo" mostra "—";
 * - `versao` null: a célula "Versão" mostra "—" (nunca "vnull") e a linha **não** oferece
 *   "Ver faixas da versão …" (não há versão para consultar), mesmo numa linha de cadastro/alteração;
 * - `"quantidade de faixas"` null (inativação, reativação, exclusão): "—" na coluna Faixas (já era assim).
 * O histórico não é rejeitado: não aparece erro nem "Tentar novamente".
 *
 * Colunas com ação: Versão (0), Ação (1), Motivo (2), Data (3), Autor (4), Faixas (5), Ações (6).
 */
describe('F8.5 — DialogoHistoricoFaixas: motivo e versão nulos (D2)', () => {
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

  function renderizar(historico: RotaFalsa = () => respostaJson(historicoComNulosFaixasApi())) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: historico,
      [`GET ${ROTA}/1/versoes/1`]: () => respostaJson(versaoFaixasApi(1)),
    })
    render(<DialogoHistoricoFaixas tabela={COMERCIAL_101} onFechar={vi.fn()} />)
    return chamadas
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de versões' })
  const tabelaVersoes = () => within(dialogo()).getByRole('table', { name: 'Versões' })
  const linhas = () => within(tabelaVersoes()).getAllByRole('row').slice(1)
  const celulas = (linha: HTMLElement) => within(linha).getAllByRole('cell')

  it('mostra o histórico (sem erro) com as três linhas: Reativação, Inativação e Cadastro', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    expect(linhas().map((linha) => celulas(linha)[1].textContent)).toEqual(['Reativação', 'Inativação', 'Cadastro'])
    expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('cadastro da versão 1 sem motivo: "—" em Motivo; versão, vigente, data, autor, "2 faixas" e "Ver faixas da versão v1"', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const cadastro = linhas()[2]
    const [versao, , motivo, data, autor, faixas] = celulas(cadastro)
    expect(versao).toHaveTextContent('v1')
    expect(within(versao).getByText('Vigente')).toBeInTheDocument()
    expect(motivo).toHaveTextContent(new RegExp(`^${SEM_VALOR}$`))
    expect(data).toHaveTextContent('01/11/2026 08:00')
    expect(autor).toHaveTextContent('Maria Souza')
    expect(faixas).toHaveTextContent('2 faixas')
    expect(within(cadastro).getByRole('button', { name: 'Ver faixas da versão v1' })).toBeInTheDocument()
    expect(cadastro).not.toHaveTextContent(/null/)
  })

  it('linha com versão null: "—" em Versão (nunca "vnull") e sem "Ver faixas da versão"', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const inativacao = linhas()[1]
    expect(celulas(inativacao)[0]).toHaveTextContent(new RegExp(`^${SEM_VALOR}$`))
    expect(celulas(inativacao)[2]).toHaveTextContent('Filial fechada para reforma')
    expect(celulas(inativacao)[5]).toHaveTextContent(new RegExp(`^${SEM_VALOR}$`))
    expect(within(inativacao).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
    expect(inativacao).not.toHaveTextContent(/null/)
  })

  it('linha de alteração com versão null: "—" em Versão e sem "Ver faixas da versão" (não há versão para consultar)', async () => {
    const [, alteracao, cadastro] = historicoComAcaoFaixasApi()
    const chamadas = renderizar(() => respostaJson([{ ...alteracao, versao: null }, cadastro]))

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const [linhaAlteracao, linhaCadastro] = linhas()
    expect(celulas(linhaAlteracao)[1]).toHaveTextContent('Alteração das faixas')
    expect(celulas(linhaAlteracao)[0]).toHaveTextContent(new RegExp(`^${SEM_VALOR}(Vigente)?$`))
    expect(linhaAlteracao).not.toHaveTextContent(/null/)
    expect(within(linhaAlteracao).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
    expect(within(linhaCadastro).getByRole('button', { name: 'Ver faixas da versão v1' })).toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho.includes('/versoes/'))).toHaveLength(0)
  })

  it('reativação sem quantidade de faixas: "—" em Faixas e sem "Ver faixas da versão"', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const reativacao = linhas()[0]
    expect(celulas(reativacao)[5]).toHaveTextContent(new RegExp(`^${SEM_VALOR}$`))
    expect(within(reativacao).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
  })
})
