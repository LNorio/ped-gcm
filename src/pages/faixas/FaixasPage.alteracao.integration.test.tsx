import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
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
import { criarApiFaixasFalsa } from '../../test/faixasFalsos'
import { escolherAcao, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'
import { formatarPercentual } from '../../utils/formato'

const ROTA = '/api/ped/faixas'
const COMERCIAL_101 = 'PED Comercial · Filial 101'
const MENSAGEM_SUCESSO = 'Nova versão das faixas salva. A versão anterior permanece no histórico.'

describe('F8.4 — Alterar faixas (integração: /faixas — RF-44, RF-43, RN-14)', () => {
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

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')
  const getsFaixas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const dialogo = () => screen.getByRole('dialog', { name: 'Alterar faixas' })
  const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => within(dialogo()).getByRole('textbox', { name: `${nome}, faixa ${n}` })

  async function abrirAlteracao(user: Usuario, nome = COMERCIAL_101) {
    renderizarApp('/faixas')
    await screen.findByRole('table', { name: 'Tabelas de faixas' })
    await escolherAcao(user, rotuloAcoesTabelaFaixas(nome), 'Alterar faixas')
    return dialogo()
  }

  it('Admin: diálogo largo com a próxima versão e as faixas vigentes; salvar faz PUT { motivo, faixas }, fecha, notifica e a tabela passa à v3', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await abrirAlteracao(user)

    expect(janela).toHaveClass('dialogo--largo')
    expect(within(janela).getByText('Alterando faixas — será gerada a versão v3')).toBeInTheDocument()
    expect(campo('Até', 1)).toHaveValue('1.000,00')

    await user.clear(campo('Alíquota', 3))
    await user.type(campo('Alíquota', 3), '3,5')
    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Reajuste do trimestre')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    const notificacao = await screen.findByText(MENSAGEM_SUCESSO)
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/1`)
    expect(cabecalhoDaChamada(puts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      motivo: 'Reajuste do trimestre',
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
        { de: 2000.01, ate: 5000, aliquota: 3.5 },
      ],
    })

    const linha = screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(COMERCIAL_101) }).closest('tr')!
    await waitFor(() => expect(within(linha).getByText('v3')).toBeInTheDocument())
    await escolherAcao(user, rotuloAcoesTabelaFaixas(COMERCIAL_101), 'Ver faixas')
    expect(within(screen.getByRole('table', { name: `Faixas vigentes de ${COMERCIAL_101}` })).getByText(formatarPercentual(3.5))).toBeInTheDocument()
  })

  it('sem motivo: "Informe o motivo da alteração." e nenhum PUT', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await abrirAlteracao(user)

    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    expect(within(janela).getByText('Informe o motivo da alteração.')).toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('linhas inválidas (RF-43): mensagem no diálogo e nenhum PUT', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await abrirAlteracao(user)

    await user.clear(campo('Alíquota', 2))
    await user.type(campo('Alíquota', 2), '-1')
    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Teste')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    expect(within(janela).getByRole('alert')).toHaveTextContent('A alíquota da faixa 2 não pode ser negativa.')
    expect(puts(chamadas)).toHaveLength(0)
  })

  it('400 da API (faixas iguais às vigentes): mensagem no diálogo, que continua aberto, sem notificação', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', {
      [`PUT ${ROTA}/1`]: () => respostaErro(400, 'As faixas são iguais às da versão vigente.'),
    })
    const janela = await abrirAlteracao(user)

    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Sem mudança')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('As faixas são iguais às da versão vigente.')
    expect(screen.queryByText(MENSAGEM_SUCESSO)).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(1)
  })

  it('falha de rede: "Não foi possível conectar ao servidor." no diálogo', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      [`PUT ${ROTA}/1`]: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const janela = await abrirAlteracao(user)

    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Reajuste')
    await user.clear(campo('Alíquota', 1))
    await user.type(campo('Alíquota', 1), '0,5')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
  })

  it('PUT com 2xx sem a tabela no corpo conta como gravado: fecha, notifica e recarrega a lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', { [`PUT ${ROTA}/1`]: () => new Response(null, { status: 204 }) })
    const janela = await abrirAlteracao(user)

    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Reajuste')
    await user.clear(campo('Alíquota', 1))
    await user.type(campo('Alíquota', 1), '0,5')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    expect(await screen.findByText(MENSAGEM_SUCESSO)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(getsFaixas(chamadas).length).toBeGreaterThanOrEqual(2))
  })

  it('Validador também altera faixas (documento prevalece — P-04)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    const janela = await abrirAlteracao(user, 'PED Comercial · Filial 102')

    expect(within(janela).getByText('Alterando faixas — será gerada a versão v2')).toBeInTheDocument()
    await user.clear(campo('Alíquota', 2))
    await user.type(campo('Alíquota', 2), '2,5')
    await colar(user, within(janela).getByRole('textbox', { name: 'Motivo da alteração' }), 'Ajuste')
    await user.click(within(janela).getByRole('button', { name: 'Salvar nova versão' }))

    await screen.findByText(MENSAGEM_SUCESSO)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/2`)
  })

  it('"Cancelar" fecha o diálogo sem PUT e a tabela continua na versão vigente', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const janela = await abrirAlteracao(user)

    await user.click(within(janela).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(puts(chamadas)).toHaveLength(0)
    const linha = screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(COMERCIAL_101) }).closest('tr')!
    expect(within(linha).getByText('v2')).toBeInTheDocument()
  })
})
