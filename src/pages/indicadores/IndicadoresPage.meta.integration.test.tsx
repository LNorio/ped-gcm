import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  indicadoresApi,
  respostaIndicadorApi,
  rotaListarIndicadores,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_JA_DEFINIDA = 'A meta deste indicador já foi definida.'

describe('F6.5 — Definir meta do indicador automático (integração: /indicadores)', () => {
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

  function simularSessao(
    perfil: 'admin' | 'validador',
    lista: IndicadorApiFalso[] = indicadoresApi(),
    aoDefinir?: () => Response | Promise<Response>,
  ) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let atual = lista
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => atual),
      [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: (init) => {
        if (aoDefinir) return aoDefinir()
        const corpo = JSON.parse(String(init?.body)) as { meta: number; sentido: 'maior_melhor' | 'menor_melhor'; 'meta editavel': boolean }
        const comMeta: IndicadorApiFalso = {
          ...INDICADOR_DEVOLUCOES_API,
          sentido: corpo.sentido,
          'sentido descricao': corpo.sentido === 'maior_melhor' ? 'Maior é melhor' : 'Menor é melhor (custo)',
          meta: corpo.meta,
          'meta a definir': false,
          'origem da meta': 'manual',
          'meta editavel no preenchimento': corpo['meta editavel'],
        }
        atual = atual.map((i) => (i.id === comMeta.id ? comMeta : i))
        return respostaJson(respostaIndicadorApi(comMeta))
      },
    })
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const linhaDevolucoes = () => screen.getByText('Devoluções (dado externo)', { selector: '.etiqueta--dourado' }).closest('tr')!

  async function abrirDefinirMeta(user: Usuario) {
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
    return screen.getByRole('dialog', { name: 'Definir meta' })
  }

  async function preencher(user: Usuario, dialogo: HTMLElement) {
    await user.type(within(dialogo).getByRole('textbox', { name: 'Meta' }), '2.500,00')
    const sentido = within(dialogo).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Meta editável no preenchimento' }))
  }

  it('"Definir meta" só aparece no indicador criado automaticamente que ainda não tem meta', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })

    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toContain('Definir meta')
    for (const nome of ['Cobertura de visitas', 'Faturamento líquido mensal', 'Capacitação']) {
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))).not.toContain('Definir meta')
    }
  })

  it.each(['admin', 'validador'] as const)(
    '%s define a meta: diálogo com o dado de origem → PUT .../meta com o Bearer → "Meta definida.", linha com a meta e sem "Meta a definir"; o item some do menu',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil)
      const dialogo = await abrirDefinirMeta(user)
      expect(within(dialogo).getByText('Dado externo de origem: Devoluções (dado externo)')).toBeInTheDocument()
      await preencher(user, dialogo)

      await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

      const notificacao = await screen.findByText('Meta definida.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
      expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/4/meta`)
      expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ meta: 2500, sentido: 'maior_melhor', 'meta editavel': true })

      await waitFor(() => expect(within(linhaDevolucoes()).getByText('2.500,00')).toBeInTheDocument())
      expect(within(linhaDevolucoes()).queryByText('Meta a definir')).not.toBeInTheDocument()
      expect(within(linhaDevolucoes()).getByText('Criado automaticamente')).toBeInTheDocument()
      expect(within(linhaDevolucoes()).getByText('Meta editável')).toBeInTheDocument()
      expect(within(linhaDevolucoes()).getByText('Maior é melhor')).toBeInTheDocument()
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Histórico de metas',
        'Inativar',
        'Excluir',
      ])
    },
  )

  it('ao definir a única meta pendente, o alerta "aguardando definição de meta" some da aba', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    const dialogo = await abrirDefinirMeta(user)
    expect(screen.getByText('1 indicador aguardando definição de meta.')).toBeInTheDocument()
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    await screen.findByText('Meta definida.')
    expect(screen.queryByText(/aguardando definição de meta/)).not.toBeInTheDocument()
  })

  it('sem outros alertas, definir a meta também apaga o marcador "Com alertas" da aba no menu', async () => {
    const user = usuarioRapido()
    simularSessao('admin', [INDICADOR_COBERTURA_VISITAS_API, INDICADOR_DEVOLUCOES_API])
    const dialogo = await abrirDefinirMeta(user)
    const link = () => within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Indicadores/ })
    expect(within(link()).getByRole('img', { name: 'Com alertas' })).toBeInTheDocument()
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    await screen.findByText('Meta definida.')
    await waitFor(() => expect(within(link()).queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument())
  })

  it('com o filtro "Aguardando meta", o indicador sai da tabela na hora, sem nova consulta', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    const opcaoMeta = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText('Aguardando meta') !== null)!
    await user.click(opcaoMeta)
    await waitFor(() => expect(screen.queryByText('Cobertura de visitas')).not.toBeInTheDocument())
    const getsAntes = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA).length

    await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')
    const dialogo = screen.getByRole('dialog', { name: 'Definir meta' })
    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    await screen.findByText('Meta definida.')
    expect(screen.queryByRole('button', { name: rotuloAcoesIndicador('Devoluções de venda') })).not.toBeInTheDocument()
    expect(screen.getByText('Nenhum indicador encontrado para os filtros.')).toBeInTheDocument()
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(getsAntes)
  })

  it('Cancelar fecha sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirDefinirMeta(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('validação local impede o PUT', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    const dialogo = await abrirDefinirMeta(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    expect(within(dialogo).getByText('Informe uma meta maior que zero.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('400 (meta já definida) aparece dentro do diálogo, que permanece aberto com os dados; a linha não muda', async () => {
    const user = usuarioRapido()
    simularSessao('admin', indicadoresApi(), () => respostaErro(400, MENSAGEM_JA_DEFINIDA))
    const dialogo = await abrirDefinirMeta(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_JA_DEFINIDA)
    expect(screen.getByRole('dialog', { name: 'Definir meta' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('textbox', { name: 'Meta' })).toHaveValue('2.500,00')
    expect(within(linhaDevolucoes()).getByText('Meta a definir')).toBeInTheDocument()
    expect(screen.queryByText('Meta definida.')).not.toBeInTheDocument()
  })

  it('clique duplo em "Definir meta" gera um único PUT; Cancelar e Esc são ignorados durante a chamada', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const comMeta: IndicadorApiFalso = { ...INDICADOR_DEVOLUCOES_API, sentido: 'maior_melhor', meta: 2500, 'meta a definir': false, 'origem da meta': 'manual' }
    const chamadas = simularSessao(
      'admin',
      indicadoresApi(),
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaIndicadorApi(comMeta)))
        }),
    )
    const dialogo = await abrirDefinirMeta(user)
    await preencher(user, dialogo)

    await user.dblClick(within(dialogo).getByRole('button', { name: 'Definir meta' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Definir meta' })).toBeInTheDocument()
    liberar()
    await screen.findByText('Meta definida.')
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('401 ao definir a meta encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', indicadoresApi(), () => respostaErro(401))
    const dialogo = await abrirDefinirMeta(user)
    await preencher(user, dialogo)

    await user.click(within(dialogo).getByRole('button', { name: 'Definir meta' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    await waitFor(() => expect(obterToken()).toBeNull())
  })
})
