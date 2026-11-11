import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  type DadoExternoApiFalso,
  dadosExternosAdminApi,
  dadosExternosApi,
  identificadoresApi,
  rotaIntegracoesPendentes,
  rotaListarDadosExternos,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dados-externos-cadastro'
const ETIQUETA_ERRO = 'Erro na última consulta'

/**
 * Lista do Admin com o estado do executor (11/11/2026 — `FRONT-meta-via-api-fase2.md`, seção 1):
 * Faturamento líquido consultado com sucesso; Volume de vendas com erro na última consulta (o último
 * sucesso foi no dia anterior) e `"tipo de servico": "soap"`; os demais sem consulta.
 */
function listaAdminComConsultas(): DadoExternoApiFalso[] {
  return dadosExternosAdminApi().map((dado) => {
    if (dado.nome === 'Faturamento líquido') return { ...dado, 'ultima consulta em': '2026-11-11 02:30:00', 'erro da ultima consulta': null }
    if (dado.nome === 'Volume de vendas') {
      return {
        ...dado,
        'tipo de servico': 'soap',
        'ultima consulta em': '2026-11-10 02:30:00',
        'erro da ultima consulta': 'valor ambiguo: 1.500 na filial 101',
      }
    }
    return dado
  })
}

/**
 * F5.22 — Última consulta do dado externo na página (integração: /dados-externos). O Admin vê na linha a
 * etiqueta "Erro na última consulta" e, nos detalhes, os pares "Última consulta" (dd/mm/aaaa hh:mm) e
 * "Erro da última consulta" (texto do back-end). `"tipo de servico"` na lista não impede a carga. Validador e
 * Preenchedor não recebem os campos e não veem nada disso.
 */
describe('F5.22 — Última consulta do dado externo (integração: /dados-externos)', () => {
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

  function simular(perfil: 'admin' | 'validador', lista: DadoExternoApiFalso[]) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`GET ${ROTA}/integracoes-pendentes`]: rotaIntegracoesPendentes(() => lista),
    })
  }

  const linha = (nome: string) => within(screen.getByRole('table', { name: 'Dados externos' })).getByText(nome).closest('tr')!

  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`) dos detalhes. */
  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    return termo.nextElementSibling as HTMLElement
  }

  it('Admin: a lista carrega (com "tipo de servico"), a linha com erro mostra a etiqueta e os detalhes mostram a data e o erro', async () => {
    const user = usuarioRapido()
    simular('admin', listaAdminComConsultas())
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })

    expect(within(linha('Volume de vendas')).getByText(ETIQUETA_ERRO)).toBeInTheDocument()
    expect(within(linha('Faturamento líquido')).queryByText(ETIQUETA_ERRO)).not.toBeInTheDocument()
    expect(screen.getAllByText(ETIQUETA_ERRO)).toHaveLength(1)

    await escolherAcao(user, rotuloAcoesDadoExterno('Volume de vendas'), 'Ver detalhes')
    const detalhesVolume = linha('Volume de vendas').nextElementSibling as HTMLElement
    expect(valorDetalhe(detalhesVolume, 'Última consulta')).toHaveTextContent(/^10\/11\/2026 02:30$/)
    expect(valorDetalhe(detalhesVolume, 'Erro da última consulta')).toHaveTextContent(/^valor ambiguo: 1\.500 na filial 101$/)

    await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Ver detalhes')
    const detalhesFaturamento = linha('Faturamento líquido').nextElementSibling as HTMLElement
    expect(valorDetalhe(detalhesFaturamento, 'Última consulta')).toHaveTextContent(/^11\/11\/2026 02:30$/)
    expect(within(detalhesFaturamento).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
  })

  it('"tipo de servico" "rest" na lista também não impede a carga', async () => {
    simular(
      'admin',
      dadosExternosAdminApi().map((dado) => ({ ...dado, 'tipo de servico': dado.url ? 'rest' : null })),
    )
    renderizarApp('/dados-externos')

    expect(await screen.findByRole('table', { name: 'Dados externos' })).toBeInTheDocument()
    expect(screen.queryByText('Resposta inválida do servidor.')).not.toBeInTheDocument()
    expect(linha('Volume de vendas')).toBeInTheDocument()
  })

  it('Validador (lista sem os campos do Admin): sem etiqueta de erro nem "Última consulta" nos detalhes', async () => {
    const user = usuarioRapido()
    simular('validador', dadosExternosApi())
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })

    expect(screen.queryByText(ETIQUETA_ERRO)).not.toBeInTheDocument()
    await escolherAcao(user, rotuloAcoesDadoExterno('Volume de vendas'), 'Ver detalhes')
    const detalhes = linha('Volume de vendas').nextElementSibling as HTMLElement
    expect(within(detalhes).queryByText(/última consulta/i)).not.toBeInTheDocument()
  })
})
