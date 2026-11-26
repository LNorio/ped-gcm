import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import {
  TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API,
  TIPOS_FIXOS_ACESSO_API,
  corpoDaChamada,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { APONTAMENTO_CHAMADOS_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Acesso } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA = '/api/ped/apontamentos'

describe('F4.4 — Cadastro de apontamento: tipos do acesso relidos ao abrir "Novo apontamento" (ApontamentosPage)', () => {
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

  function simular() {
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => apontamentosApi()),
      [`POST ${ROTA}`]: () => respostaJson({ ...APONTAMENTO_CHAMADOS_API, id: 10 }, 201),
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  const acessoAdmin = (tipos: Acesso['tipos']) => acessoFalso({ perfil: 'admin', tipos, todasAsFiliais: true, filiais: FILIAIS })

  function renderizar(recarregarAcesso: () => Promise<void>, acesso: Acesso = acessoAdmin(TIPOS_FIXOS_ACESSO_API)) {
    const resultado = render(
      <ProvedorSessaoFalso sessao={{ acesso, recarregarAcesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
    const trocarAcesso = (novo: Acesso) =>
      resultado.rerender(
        <ProvedorSessaoFalso sessao={{ acesso: novo, recarregarAcesso }}>
          <ApontamentosPage />
        </ProvedorSessaoFalso>,
      )
    return { ...resultado, trocarAcesso }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Novo apontamento' })
  const opcoesTipo = () =>
    within(within(dialogo()).getByRole('combobox', { name: 'Tipo' }))
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)

  async function abrirFormulario(user: Usuario) {
    await screen.findByRole('table', { name: 'Apontamentos' })
    await user.click(screen.getByRole('button', { name: 'Novo apontamento' }))
    return dialogo()
  }

  it('abrir o "Novo apontamento" chama recarregarAcesso() da sessão uma vez', async () => {
    const user = usuarioRapido()
    simular()
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    renderizar(recarregarAcesso)
    await screen.findByRole('table', { name: 'Apontamentos' })
    const antes = recarregarAcesso.mock.calls.length

    await abrirFormulario(user)

    expect(recarregarAcesso).toHaveBeenCalledTimes(antes + 1)
    expect(recarregarAcesso).toHaveBeenLastCalledWith()
  })

  it('cada abertura do diálogo relê o acesso (abrir, cancelar e abrir de novo → duas chamadas)', async () => {
    const user = usuarioRapido()
    simular()
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    renderizar(recarregarAcesso)
    await screen.findByRole('table', { name: 'Apontamentos' })
    const antes = recarregarAcesso.mock.calls.length

    await abrirFormulario(user)
    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await abrirFormulario(user)

    expect(recarregarAcesso).toHaveBeenCalledTimes(antes + 2)
  })

  it('enquanto a releitura não volta, o select mostra os tipos atuais e o cadastro não fica bloqueado', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    const recarregarAcesso = vi.fn(() => new Promise<void>(() => {}))
    renderizar(recarregarAcesso)

    const form = await abrirFormulario(user)

    expect(opcoesTipo()).toEqual(['Selecione', ...TIPOS_FIXOS_ACESSO_API.map((tipo) => tipo.nome)])
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Chamados abertos')
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Tipo' }), 'Comercial')
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Tipo de valor' }), 'Numeral')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'Chamados abertos', 'id tipo': 1 })
  })

  it('quando o acesso da sessão muda com o diálogo aberto, o select passa a mostrar os novos tipos sem fechar o diálogo nem apagar o que foi digitado', async () => {
    const user = usuarioRapido()
    simular()
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    const { trocarAcesso } = renderizar(recarregarAcesso)
    const form = await abrirFormulario(user)
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Admissões no mês')

    trocarAcesso(acessoAdmin(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API))

    expect(opcoesTipo()).toEqual(['Selecione', ...TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API.map((tipo) => tipo.nome)])
    expect(within(dialogo()).getByRole('textbox', { name: 'Nome' })).toHaveValue('Admissões no mês')
  })
})
