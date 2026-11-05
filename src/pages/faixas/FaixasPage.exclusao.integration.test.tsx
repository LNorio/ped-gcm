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
import { criarApiFaixasFalsa } from '../../test/faixasFalsos'
import { escolherAcao, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA = '/api/ped/faixas'
const ANTIGO_101 = 'PED Antigo · Filial 101'
const COMERCIAL_101 = 'PED Comercial · Filial 101'

describe('F8.6 — Excluir tabela de faixas (integração: /faixas — RF-46, RN-18, RNF-07)', () => {
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
      ...api.rotas,
      ...rotasExtras,
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')
  const dialogo = () => screen.getByRole('dialog', { name: 'Excluir tabela de faixas' })
  const gatilho = (nome: string) => screen.queryByRole('button', { name: rotuloAcoesTabelaFaixas(nome) })

  async function pedirExclusao(user: Usuario, nome: string) {
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
    await escolherAcao(user, rotuloAcoesTabelaFaixas(nome), 'Excluir tabela')
    return dialogo()
  }

  it('Admin exclui a tabela de dashboard excluído: confirmação com o impacto → DELETE → "Tabela de faixas excluída." e a linha sai', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await pedirExclusao(user, ANTIGO_101)

    expect(janela).toHaveTextContent('Imagens já congeladas mantêm as faixas vigentes no fechamento.')
    await user.click(within(janela).getByRole('button', { name: 'Excluir' }))

    const notificacao = await screen.findByText('Tabela de faixas excluída.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(1)
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/4`)
    expect(cabecalhoDaChamada(deletes(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    await waitFor(() => expect(gatilho(ANTIGO_101)).not.toBeInTheDocument())
    expect(gatilho(COMERCIAL_101)).toBeInTheDocument()
  })

  it('tabela de dashboard existente: o diálogo explica o bloqueio, só "Entendi", e nenhum DELETE', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await pedirExclusao(user, COMERCIAL_101)

    expect(janela).toHaveTextContent('Esta tabela pertence a um dashboard existente e não pode ser excluída')
    expect(within(janela).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    await user.click(within(janela).getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(0)
    expect(gatilho(COMERCIAL_101)).toBeInTheDocument()
  })

  it('"Cancelar" fecha sem DELETE e a linha continua', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await pedirExclusao(user, ANTIGO_101)

    await user.click(within(janela).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deletes(chamadas)).toHaveLength(0)
    expect(gatilho(ANTIGO_101)).toBeInTheDocument()
  })

  it('400 da API: o diálogo fecha, a página mostra o Aviso de erro com a mensagem da API e a linha continua, sem notificação', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      [`DELETE ${ROTA}/4`]: () => respostaErro(400, 'A tabela só pode ser excluída depois que o dashboard for excluído.'),
    })
    const janela = await pedirExclusao(user, ANTIGO_101)

    await user.click(within(janela).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A tabela só pode ser excluída depois que o dashboard for excluído.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gatilho(ANTIGO_101)).toBeInTheDocument()
    expect(screen.queryByText('Tabela de faixas excluída.')).not.toBeInTheDocument()
  })

  it('clique duplo em "Excluir" gera um único DELETE', async () => {
    const user = usuarioRapido()
    let liberar: () => void = () => {}
    const chamadas = simularSessao('admin', {
      [`DELETE ${ROTA}/4`]: () =>
        new Promise<Response>((resolver) => {
          liberar = () => resolver(new Response(null, { status: 204 }))
        }),
    })
    const janela = await pedirExclusao(user, ANTIGO_101)

    const excluir = within(janela).getByRole('button', { name: 'Excluir' })
    await user.dblClick(excluir)
    liberar()

    await screen.findByText('Tabela de faixas excluída.')
    expect(deletes(chamadas)).toHaveLength(1)
  })

  it('Validador também exclui tabela de dashboard excluído (documento prevalece — P-04)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    const janela = await pedirExclusao(user, ANTIGO_101)

    await user.click(within(janela).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Tabela de faixas excluída.')
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/4`)
  })
})
