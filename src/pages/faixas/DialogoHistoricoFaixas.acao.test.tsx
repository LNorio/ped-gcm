import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  TABELA_COMERCIAL_100_INATIVA_API,
  TABELA_COMERCIAL_101_API,
  TABELA_EXCLUIDO_101_API,
  historicoComAcaoFaixasApi,
  historicoExcluidaFaixasApi,
  historicoFaixasApi,
  versaoFaixasApi,
} from '../../test/faixasFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoHistoricoFaixas } from './DialogoHistoricoFaixas'

const INATIVA_100 = paraTabelaFaixas(TABELA_COMERCIAL_100_INATIVA_API)
const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const EXCLUIDO_101 = paraTabelaFaixas(TABELA_EXCLUIDO_101_API)
const ROTA = '/api/ped/faixas'
const COLUNAS_COM_ACAO = ['Versão', 'Ação', 'Motivo', 'Data', 'Autor', 'Faixas', 'Ações']
const COLUNAS_SEM_ACAO = ['Versão', 'Motivo', 'Data', 'Autor', 'Faixas', 'Ações']

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 7: com `acao` nas linhas, o histórico mostra
 * a coluna "Ação" (Cadastro, Alteração das faixas, Inativação, Reativação; linha sem `acao` =
 * alteração das faixas). Inativação e reativação não criam versão nem têm faixas próprias: essas
 * linhas não têm o botão "Ver faixas da versão vN".
 *
 * Contrato final (F8.12*): quinta ação, `exclusao` ("Exclusão"), que também não é versão (sem "Ver
 * faixas da versão"); as linhas de inativação/reativação/exclusão vêm com `vigente: false` (sem a
 * etiqueta "Vigente") e "quantidade de faixas" `null` ("—"); a data `2026-11-10 08:00:00-04:00`
 * aparece como "10/11/2026 08:00".
 */
describe('F8.5 — DialogoHistoricoFaixas: coluna "Ação" e linhas de inativação/reativação', () => {
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

  function renderizar(tabela = INATIVA_100, rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/6/historico`]: () => respostaJson(historicoComAcaoFaixasApi()),
      [`GET ${ROTA}/6/versoes/2`]: () => respostaJson({ versao: 2, faixas: TABELA_COMERCIAL_100_INATIVA_API.faixas }),
      [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoFaixasApi()),
      [`GET ${ROTA}/1/versoes/2`]: () => respostaJson(versaoFaixasApi(2)),
      [`GET ${ROTA}/4/historico`]: () => respostaJson(historicoExcluidaFaixasApi()),
      [`GET ${ROTA}/4/versoes/3`]: () => respostaJson({ versao: 3, faixas: TABELA_EXCLUIDO_101_API.faixas }),
      ...rotas,
    })
    render(<DialogoHistoricoFaixas tabela={tabela} onFechar={vi.fn()} />)
    return chamadas
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Histórico de versões' })
  const tabelaVersoes = () => within(dialogo()).getByRole('table', { name: 'Versões' })
  const linhas = () => within(tabelaVersoes()).getAllByRole('row').slice(1)
  const celulaAcao = (linha: HTMLElement) => within(linha).getAllByRole('cell')[1]
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)

  it('com "acao" nas linhas: coluna "Ação" depois de "Versão", com Inativação, Alteração das faixas e Cadastro', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    expect(within(tabelaVersoes()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS_COM_ACAO)
    expect(linhas().map((linha) => celulaAcao(linha).textContent)).toEqual(['Inativação', 'Alteração das faixas', 'Cadastro'])
    expect(linhas()[0]).toHaveTextContent('Filial passou a usar outra régua')
    expect(linhas()[0]).toHaveTextContent('10/11/2026 08:00')
    expect(linhas()[0]).toHaveTextContent('Ana Costa')
  })

  it('a linha de inativação não tem "Ver faixas da versão"; as de alteração e cadastro têm', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const [inativacao, alteracao, cadastro] = linhas()
    expect(within(inativacao).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
    expect(within(alteracao).getByRole('button', { name: 'Ver faixas da versão v2' })).toBeInTheDocument()
    expect(within(cadastro).getByRole('button', { name: 'Ver faixas da versão v1' })).toBeInTheDocument()
  })

  it('"Ver faixas da versão v2" na linha de alteração consulta e mostra as faixas, mesmo com a linha de inativação da mesma versão acima', async () => {
    const user = usuarioRapido()
    const chamadas = renderizar()
    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    await user.click(within(linhas()[1]).getByRole('button', { name: 'Ver faixas da versão v2' }))

    expect(await within(dialogo()).findByRole('table', { name: 'Faixas da versão v2' })).toBeInTheDocument()
    expect(gets(chamadas, `${ROTA}/6/versoes/2`)).toHaveLength(1)
  })

  it('linha de reativação mostra "Reativação" e não tem "Ver faixas da versão"; linha sem "acao" entre as demais mostra "Alteração das faixas"', async () => {
    const [inativacao, alteracao, cadastro] = historicoComAcaoFaixasApi()
    const { acao: _acao, ...semAcao } = alteracao
    renderizar(INATIVA_100, {
      [`GET ${ROTA}/6/historico`]: () =>
        respostaJson([
          { ...inativacao, acao: 'reativacao', motivo: 'Voltou a valer para a filial', data: '2026-11-12 09:00:00' },
          semAcao,
          cadastro,
        ]),
    })

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    expect(linhas().map((linha) => celulaAcao(linha).textContent)).toEqual(['Reativação', 'Alteração das faixas', 'Cadastro'])
    expect(within(linhas()[0]).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
  })

  it('linha de inativação no formato final (vigente false, sem quantidade, data com fuso): sem "Vigente", "—" em Faixas e data dd/mm/aaaa hh:mm', async () => {
    renderizar()

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    const [inativacao] = linhas()
    const celulas = within(inativacao).getAllByRole('cell')
    expect(within(inativacao).queryByText('Vigente')).not.toBeInTheDocument()
    expect(celulas[3]).toHaveTextContent('10/11/2026 08:00')
    expect(celulas[5]).toHaveTextContent('—')
    expect(inativacao).not.toHaveTextContent(/inválida/i)
  })

  it('histórico de faixa já excluída: "Exclusão" na linha mais recente, sem "Ver faixas da versão"; as versões continuam com o botão', async () => {
    renderizar(EXCLUIDO_101)

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    expect(within(tabelaVersoes()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS_COM_ACAO)
    expect(linhas().map((linha) => celulaAcao(linha).textContent)).toEqual(['Exclusão', 'Alteração das faixas', 'Cadastro'])
    const [exclusao, alteracao, cadastro] = linhas()
    expect(within(exclusao).queryByRole('button', { name: /Ver faixas da versão/ })).not.toBeInTheDocument()
    expect(within(exclusao).queryByText('Vigente')).not.toBeInTheDocument()
    expect(exclusao).toHaveTextContent('Dashboard encerrado em 2025')
    expect(exclusao).toHaveTextContent('12/11/2026 14:05')
    expect(within(exclusao).getAllByRole('cell')[5]).toHaveTextContent('—')
    expect(within(alteracao).getByRole('button', { name: 'Ver faixas da versão v3' })).toBeInTheDocument()
    expect(within(cadastro).getByRole('button', { name: 'Ver faixas da versão v1' })).toBeInTheDocument()
  })

  it('"Ver faixas da versão v3" na linha de alteração abaixo da exclusão consulta a versão uma vez', async () => {
    const user = usuarioRapido()
    const chamadas = renderizar(EXCLUIDO_101)
    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    await user.click(within(linhas()[1]).getByRole('button', { name: 'Ver faixas da versão v3' }))

    expect(await within(dialogo()).findByRole('table', { name: 'Faixas da versão v3' })).toBeInTheDocument()
    expect(gets(chamadas, `${ROTA}/4/versoes/3`)).toHaveLength(1)
  })

  it('sem "acao" em nenhuma linha (formato atual da API), a coluna "Ação" não aparece', async () => {
    renderizar(COMERCIAL_101)

    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())

    expect(within(tabelaVersoes()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS_SEM_ACAO)
  })

  it('mesma versão em linhas de reativação, inativação e alteração: "Ver faixas" da alteração abre só essa linha e consulta a versão uma só vez, também ao reabrir', async () => {
    const user = usuarioRapido()
    const [inativacao, alteracao, cadastro] = historicoComAcaoFaixasApi()
    const chamadas = renderizar(INATIVA_100, {
      [`GET ${ROTA}/6/historico`]: () =>
        respostaJson([
          { ...inativacao, acao: 'reativacao', motivo: 'Voltou a valer para a filial', data: '2026-11-12 09:00:00' },
          inativacao,
          alteracao,
          cadastro,
        ]),
    })
    await waitFor(() => expect(tabelaVersoes()).toBeInTheDocument())
    expect(linhas()).toHaveLength(4)

    const botao = within(linhas()[2]).getByRole('button', { name: 'Ver faixas da versão v2' })
    await user.click(botao)

    const faixasV2 = await within(dialogo()).findAllByRole('table', { name: 'Faixas da versão v2' })
    /** Linhas do corpo da tabela "Versões", sem as linhas da tabela de faixas aninhada. */
    const linhasProprias = () => linhas().filter((linha) => linha.closest('table') === tabelaVersoes())
    expect(faixasV2).toHaveLength(1)
    // Só uma linha de detalhes, logo abaixo da linha de alteração; reativação e inativação seguem fechadas.
    const todas = linhasProprias()
    expect(todas).toHaveLength(5)
    expect(within(todas[3]).getByRole('table', { name: 'Faixas da versão v2' })).toBe(faixasV2[0])
    expect(within(todas[0]).queryByRole('table')).not.toBeInTheDocument()
    expect(within(todas[1]).queryByRole('table')).not.toBeInTheDocument()
    expect(within(todas[2]).getByRole('button', { name: 'Ocultar faixas da versão v2' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(todas[4]).getByRole('button', { name: 'Ver faixas da versão v1' })).toHaveAttribute('aria-expanded', 'false')
    expect(gets(chamadas, `${ROTA}/6/versoes/2`)).toHaveLength(1)

    await user.click(within(todas[2]).getByRole('button', { name: 'Ocultar faixas da versão v2' }))
    expect(within(dialogo()).queryByRole('table', { name: 'Faixas da versão v2' })).not.toBeInTheDocument()
    expect(linhasProprias()).toHaveLength(4)

    await user.click(within(linhas()[2]).getByRole('button', { name: 'Ver faixas da versão v2' }))
    expect(await within(dialogo()).findAllByRole('table', { name: 'Faixas da versão v2' })).toHaveLength(1)
    expect(gets(chamadas, `${ROTA}/6/versoes/2`)).toHaveLength(1)
    expect(gets(chamadas, `${ROTA}/6/versoes/1`)).toHaveLength(0)
  })
})
