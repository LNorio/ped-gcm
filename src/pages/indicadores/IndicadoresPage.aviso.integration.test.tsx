import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const ORIENTACAO = 'Reative o componente ou inative o indicador.'

describe('F6.9 — Aviso de componente desativado (integração: /indicadores)', () => {
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

  async function abrirTela(perfil: 'admin' | 'validador' = 'admin') {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(indicadoresApi),
    })
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  function detalhesDe(tabela: HTMLElement, nome: string) {
    const linha = within(tabela)
      .getAllByRole('row')
      .find((l) => within(l).queryAllByRole('cell')[0]?.textContent?.includes(nome))!
    return linha.nextElementSibling as HTMLElement
  }

  it('indicador com dado externo desativado: a linha marca o componente e os detalhes explicam que fica sem resultado, com a orientação', async () => {
    const user = usuarioRapido()
    const tabela = await abrirTela()

    const linha = within(tabela).getByText('Cobertura da carteira').closest('tr')!
    expect(within(linha).getByText('Componentes desativados')).toBeInTheDocument()
    expect(within(linha).getByText('Cobertura de clientes (desativado)')).toBeInTheDocument()

    await escolherAcao(user, rotuloAcoesIndicador('Cobertura da carteira'), 'Ver detalhes')

    const aviso = within(detalhesDe(tabela, 'Cobertura da carteira')).getByRole('note')
    expect(aviso).toHaveTextContent('O dado externo Cobertura de clientes está desativado: o indicador fica sem resultado.')
    expect(aviso).toHaveTextContent(ORIENTACAO)
  })

  it('todos os apontamentos desativados: aviso de indicador sem resultado', async () => {
    const user = usuarioRapido()
    const tabela = await abrirTela('validador')

    await escolherAcao(user, rotuloAcoesIndicador('Custo de frete por entrega'), 'Ver detalhes')

    const aviso = within(detalhesDe(tabela, 'Custo de frete por entrega')).getByRole('note')
    expect(aviso).toHaveTextContent('Todos os apontamentos estão desativados: o indicador fica sem resultado.')
    expect(aviso).toHaveTextContent(ORIENTACAO)
  })

  it('parte dos apontamentos desativada: aviso de cálculo que segue sem eles e pode distorcer o resultado', async () => {
    const user = usuarioRapido()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Rotinas financeiras em dia'), 'Ver detalhes')

    const aviso = within(detalhesDe(tabela, 'Rotinas financeiras em dia')).getByRole('note')
    expect(aviso).toHaveTextContent(
      'O apontamento Conciliação bancária concluída está desativado: o cálculo segue sem ele e pode distorcer o resultado.',
    )
    expect(aviso).toHaveTextContent(ORIENTACAO)
  })

  it('indicador sem componente desativado não tem aviso nos detalhes', async () => {
    const user = usuarioRapido()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Ver detalhes')

    expect(within(detalhesDe(tabela, 'Cobertura de visitas')).queryByRole('note')).not.toBeInTheDocument()
  })
})
