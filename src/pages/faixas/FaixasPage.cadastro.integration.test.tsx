import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { dashboardsApi, rotaListarDashboards } from '../../test/dashboardsFalsos'
import { criarApiFaixasFalsa } from '../../test/faixasFalsos'
import { rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA = '/api/ped/faixas'
const NOTA_JA_EXISTE =
  'Já existe uma tabela de faixas para este dashboard nesta filial. Para mudar os valores, use “Alterar faixas” nela — o histórico de versões é mantido.'

describe('F8.3 — Nova tabela de faixas (integração: /faixas — RF-42, RF-43, RN-14)', () => {
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
    const api = criarApiFaixasFalsa()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      'GET /api/ped/dashboards': rotaListarDashboards(dashboardsApi),
      ...api.rotas,
      ...rotasExtras,
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsFaixas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const dialogo = () => screen.getByRole('dialog', { name: 'Nova tabela de faixas' })
  const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => within(dialogo()).getByRole('textbox', { name: `${nome}, faixa ${n}` })

  async function abrirFormulario(user: Usuario) {
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
    await user.click(screen.getByRole('button', { name: 'Nova tabela de faixas' }))
    const combo = await within(dialogo()).findByRole('combobox', { name: 'Dashboard' })
    await waitFor(() => expect(within(combo).getByRole('option', { name: 'PED Gerentes' })).toBeInTheDocument())
    return combo
  }

  async function preencherLinha(user: Usuario, n: number, de: string, ate: string, aliquota: string) {
    await user.type(campo('De', n), de)
    await user.type(campo('Até', n), ate)
    await user.type(campo('Alíquota', n), aliquota)
  }

  it('Admin abre o diálogo largo, os dashboards vêm de GET /api/ped/dashboards e o cadastro faz POST, fecha, notifica e recarrega a lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const comboDashboard = await abrirFormulario(user)

    expect(dialogo()).toHaveClass('dialogo--largo')
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dashboards')).toBe(true)

    await user.selectOptions(comboDashboard, 'PED Gerentes')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '101')
    await colar(user, within(dialogo()).getByRole('textbox', { name: 'Descrição (opcional)' }), 'Régua 2026')
    await preencherLinha(user, 1, '0', '1.000,00', '0')
    await user.click(within(dialogo()).getByRole('button', { name: /Adicionar faixa/ }))
    await preencherLinha(user, 2, '1.000,01', '2.500', '1,25')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    const notificacao = await screen.findByText('Tabela de faixas cadastrada.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      dashboard: 2,
      filial: '101',
      descricao: 'Régua 2026',
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2500, aliquota: 1.25 },
      ],
    })
    await waitFor(() => expect(getsFaixas(chamadas).length).toBeGreaterThanOrEqual(2))
    expect(await screen.findByRole('button', { name: rotuloAcoesTabelaFaixas('PED Gerentes · Filial 101') })).toBeInTheDocument()
  })

  it('com a filial 101 no cabeçalho: o diálogo não pede filial e o POST usa a filial do cabeçalho', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
    await user.selectOptions(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' }), '101')
    await waitFor(() => expect(getsFaixas(chamadas)).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: 'Nova tabela de faixas' }))
    const comboDashboard = await within(dialogo()).findByRole('combobox', { name: 'Dashboard' })
    await waitFor(() => expect(within(comboDashboard).getByRole('option', { name: 'PED Supervisores' })).toBeInTheDocument())

    expect(within(dialogo()).queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument()
    expect(within(dialogo()).getByText('Filial 101 - CAMPO GRANDE')).toBeInTheDocument()

    await user.selectOptions(comboDashboard, 'PED Supervisores')
    await preencherLinha(user, 1, '0', '800', '2')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    await screen.findByText('Tabela de faixas cadastrada.')
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      dashboard: 3,
      filial: '101',
      descricao: null,
      faixas: [{ de: 0, ate: 800, aliquota: 2 }],
    })
  })

  it('dashboard e filial que já têm tabela: orientação para usar "Alterar faixas" e salvar desabilitado, sem POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const comboDashboard = await abrirFormulario(user)

    await user.selectOptions(comboDashboard, 'PED Comercial')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '102')

    expect(within(dialogo()).getByText(NOTA_JA_EXISTE)).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' })).toBeDisabled()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('linhas inválidas (RF-43): mensagem no diálogo e nenhum POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const comboDashboard = await abrirFormulario(user)

    await user.selectOptions(comboDashboard, 'PED Gerentes')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '101')
    await preencherLinha(user, 1, '1.000', '500', '1')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Na faixa 1, o valor “De” deve ser menor que “Até”.')
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('400 da API: a mensagem aparece no diálogo, que continua aberto e com os dados, sem notificação', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', {
      [`POST ${ROTA}`]: () => respostaErro(400, 'Existe sobreposição entre as faixas.'),
    })
    const comboDashboard = await abrirFormulario(user)

    await user.selectOptions(comboDashboard, 'PED Gerentes')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '101')
    await preencherLinha(user, 1, '0', '1.000', '0')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Existe sobreposição entre as faixas.')
    expect(campo('Até', 1)).toHaveValue('1.000')
    expect(screen.queryByText('Tabela de faixas cadastrada.')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
  })

  it('POST com 2xx sem a tabela no corpo conta como gravado: fecha, notifica e recarrega a lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', {
      [`POST ${ROTA}`]: () => respostaJson({ mensagem: 'Tabela de faixas cadastrada.' }, 201),
    })
    const comboDashboard = await abrirFormulario(user)

    await user.selectOptions(comboDashboard, 'PED Gerentes')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '101')
    await preencherLinha(user, 1, '0', '1.000', '0')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Tabela de faixas cadastrada.')).toBeInTheDocument()
    await waitFor(() => expect(getsFaixas(chamadas).length).toBeGreaterThanOrEqual(2))
  })

  it('falha ao carregar os dashboards: aviso de erro no diálogo com "Tentar novamente"', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { 'GET /api/ped/dashboards': () => respostaErro(500, 'Falha ao consultar os dashboards.') })
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })

    await user.click(screen.getByRole('button', { name: 'Nova tabela de faixas' }))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar os dashboards.')
    expect(within(dialogo()).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('Validador também cadastra (documento prevalece — P-04)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    const comboDashboard = await abrirFormulario(user)

    await user.selectOptions(comboDashboard, 'PED Gerentes')
    await user.selectOptions(within(dialogo()).getByRole('combobox', { name: 'Filial' }), '102')
    await preencherLinha(user, 1, '0', '1.000', '0')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar tabela de faixas' }))

    await screen.findByText('Tabela de faixas cadastrada.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ dashboard: 2, filial: '102' })
  })

  it('"Cancelar" fecha o diálogo sem POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirFormulario(user)

    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })
})
