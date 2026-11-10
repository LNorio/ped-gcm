import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import {
  indicadoresComMetaPendenteApi,
  respostaErrosPorFilial,
  rotaListarIndicadoresComMetaPendente,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

/**
 * F6.10 — Ajustes ao contrato real (API (26).md e FRONT-meta-por-filial.md, 2026-11-10), com a
 * aplicação completa (só a rede é simulada):
 * - 400 de meta por filial `{ mensagem, erros: [{ filial, mensagem }] }` no cadastro e no "Definir meta":
 *   a mensagem geral no alerta e cada erro com filial no campo daquela filial, sem fechar o diálogo;
 * - filtro de situação "Meta pendente por filial" → `?situacao=meta_filial_pendente`.
 *
 * Filiais do acesso: 100 MATRIZ, 101 CAMPO GRANDE, 102 DOURADOS.
 */
const ROTA = '/api/ped/indicadores-cadastro'
const REPLICAR = 'Replicar a meta para todas as filiais'

describe('F6.10 — Erros por filial e filtro "Meta pendente por filial" (integração: /indicadores)', () => {
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

  function simularSessao(rotas: { aoCriar?: () => Response; aoDefinir?: () => Response } = {}) {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    const lista = indicadoresComMetaPendenteApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetaPendente(() => lista),
      'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
      'GET /api/ped/dados-externos-cadastro': rotaListarDadosExternos(dadosExternosApi),
      [`POST ${ROTA}`]: () => (rotas.aoCriar ? rotas.aoCriar() : respostaJson({}, 201)),
      [`PUT ${ROTA}/4/meta`]: () => (rotas.aoDefinir ? rotas.aoDefinir() : respostaJson({})),
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const campo = (dialogo: HTMLElement, rotulo: string) => within(dialogo).getByRole('textbox', { name: `Meta da filial ${rotulo}` })

  async function abrirTela() {
    renderizarApp('/indicadores')
    return screen.findByRole('table', { name: 'Indicadores' })
  }

  async function selecionarFilialNoCabecalho(user: Usuario, rotulo: string) {
    const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    await user.selectOptions(seletor, within(seletor).getByRole('option', { name: rotulo }))
  }

  async function abrirCadastroPreenchido(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    const grupoDado = within(dialogo).getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupoDado).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupoDado).getByRole('listbox', { name: 'Dados externos' })
    await user.click(await within(lista).findByRole('option', { name: (nome) => nome.startsWith('Faturamento líquido') }))
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Positivação por filial')
    const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
    return dialogo
  }

  it('cadastro: 400 com erros por filial mostra a mensagem geral no alerta e cada erro no campo da filial; o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao({
      aoCriar: () =>
        respostaErrosPorFilial([
          { filial: '100', mensagem: 'a meta da filial 100 deve ser um numero maior que zero' },
          { filial: '102', mensagem: 'a meta da filial 102 ("1.500") e ambigua: envie como numero (1500) ou com virgula decimal' },
        ]),
    })
    await abrirTela()
    const dialogo = await abrirCadastroPreenchido(user)
    await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
    await colar(user, campo(dialogo, '100 - MATRIZ'), '10')
    await colar(user, campo(dialogo, '102 - DOURADOS'), '20')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(campo(dialogo, '100 - MATRIZ')).toHaveAttribute('aria-invalid', 'true'))
    // O alerta geral (Aviso) é o primeiro do formulário; os erros de campo também são role="alert".
    expect(within(dialogo).getAllByRole('alert')[0]).toHaveTextContent('a meta da filial 100 deve ser um numero maior que zero')
    expect(campo(dialogo, '100 - MATRIZ')).toHaveAccessibleDescription('a meta da filial 100 deve ser um numero maior que zero')
    expect(campo(dialogo, '102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    expect(campo(dialogo, '101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()

    await user.type(campo(dialogo, '100 - MATRIZ'), '0')
    expect(campo(dialogo, '100 - MATRIZ')).not.toHaveAttribute('aria-invalid', 'true')
    expect(campo(dialogo, '102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
  })

  it('cadastro: erro com filial null ("nunca as duas juntas") fica só no alerta geral', async () => {
    const user = usuarioRapido()
    const mensagem = 'envie a meta (para todas as filiais) ou as metas por filial, nunca as duas juntas'
    simularSessao({ aoCriar: () => respostaErrosPorFilial([{ filial: null, mensagem }]) })
    await abrirTela()
    const dialogo = await abrirCadastroPreenchido(user)
    await user.click(within(dialogo).getByRole('checkbox', { name: REPLICAR }))
    await colar(user, campo(dialogo, '101 - CAMPO GRANDE'), '10')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem)
    expect(campo(dialogo, '101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('"Definir meta" na visão de uma filial: o erro daquela filial vai para o campo "Meta da filial 101 - CAMPO GRANDE"', async () => {
    const user = usuarioRapido()
    simularSessao({ aoDefinir: () => respostaErrosPorFilial([{ filial: '101', mensagem: 'a meta da filial 101 deve ser um numero maior que zero' }]) })
    await abrirTela()
    await selecionarFilialNoCabecalho(user, '101 - CAMPO GRANDE')
    await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
    const dialogo = screen.getByRole('dialog', { name: 'Definir meta' })
    await user.type(campo(dialogo, '101 - CAMPO GRANDE'), '15')
    const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    await waitFor(() => expect(campo(dialogo, '101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true'))
    expect(campo(dialogo, '101 - CAMPO GRANDE')).toHaveAccessibleDescription('a meta da filial 101 deve ser um numero maior que zero')
    expect(within(dialogo).getAllByRole('alert')[0]).toHaveTextContent('a meta da filial 101 deve ser um numero maior que zero')
    expect(campo(dialogo, '101 - CAMPO GRANDE')).toHaveValue('15')
  })

  it('filtro "Meta pendente por filial": consulta na hora com situacao=meta_filial_pendente e lista só os ativos com filial sem meta', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    const opcao = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((item) => within(item).queryByText('Meta pendente por filial') !== null)
    expect(opcao).toBeDefined()
    await user.click(opcao!)

    await waitFor(() => expect(gets(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('meta_filial_pendente'))
    await waitFor(() => expect(within(tabela).queryByText('Cobertura de visitas')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Ticket médio por filial')).toBeInTheDocument()
    expect(within(tabela).queryByText('Margem bruta por filial')).not.toBeInTheDocument()
  })
})
