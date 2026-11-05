import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAcoesSituacaoExclusao } from '../../hooks/useAcoesSituacaoExclusao'
import { definirToken, limparToken } from '../../services/sessao'
import { podeExecutar } from '../../sessao/permissoes'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { IndicadoresPage } from './IndicadoresPage'

// Envolve as implementações reais: o comportamento é o mesmo, mas o teste consegue verificar que a
// página consulta a matriz de ações e conduz o par inativar/excluir pelo hook genérico.
vi.mock('../../sessao/permissoes', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../sessao/permissoes')>()
  return { ...real, podeExecutar: vi.fn(real.podeExecutar) }
})
vi.mock('../../hooks/useAcoesSituacaoExclusao', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../hooks/useAcoesSituacaoExclusao')>()
  return { ...real, useAcoesSituacaoExclusao: vi.fn(real.useAcoesSituacaoExclusao) }
})

const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.6 — IndicadoresPage: ações decididas pela matriz de permissões e par situação/exclusão via useAcoesSituacaoExclusao', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(async () => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    const real = await vi.importActual<typeof import('../../sessao/permissoes')>('../../sessao/permissoes')
    vi.mocked(podeExecutar).mockClear()
    vi.mocked(podeExecutar).mockImplementation(real.podeExecutar)
    vi.mocked(useAcoesSituacaoExclusao).mockClear()
    simularApi(fetchFalso, { [`GET ${ROTA}`]: rotaListarIndicadores(indicadoresApi) })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function abrirTela(perfil: Perfil) {
    const acesso = acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <IndicadoresPage />
      </ProvedorSessaoFalso>,
    )
    await screen.findByRole('table', { name: 'Indicadores' })
  }

  it('a página consulta a matriz para as cinco ações da aba (via usePermissoes().podeAcao)', async () => {
    await abrirTela('validador')

    for (const acao of [
      'cadastrar-indicador',
      'definir-meta-indicador',
      'alterar-situacao-indicador',
      'excluir-indicador',
      'ver-historico-metas-indicador',
    ] as const) {
      expect(podeExecutar).toHaveBeenCalledWith('validador', acao)
    }
  })

  it('quem decide é a matriz: com "alterar-situacao-indicador" e "excluir-indicador" negadas, nem o Admin vê Inativar/Reativar e Excluir', async () => {
    const user = usuarioRapido()
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'alterar-situacao-indicador' && acao !== 'excluir-indicador')
    await abrirTela('admin')

    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))).toEqual(['Ver detalhes', 'Histórico de metas'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes'])
  })

  it('com "cadastrar-indicador" negada, o botão "Novo indicador" não aparece', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'cadastrar-indicador')
    await abrirTela('admin')

    expect(screen.queryByRole('button', { name: 'Novo indicador' })).not.toBeInTheDocument()
  })

  it('com "definir-meta-indicador" e "ver-historico-metas-indicador" negadas, os itens somem', async () => {
    const user = usuarioRapido()
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'definir-meta-indicador' && acao !== 'ver-historico-metas-indicador')
    await abrirTela('admin')

    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual(['Ver detalhes', 'Inativar', 'Excluir'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento líquido mensal'))).toEqual(['Ver detalhes', 'Inativar'])
  })

  it('com as ações liberadas pela matriz, os itens aparecem mesmo para um perfil que normalmente não os tem', async () => {
    const user = usuarioRapido()
    vi.mocked(podeExecutar).mockImplementation(() => true)
    await abrirTela('preenchedor')

    expect(screen.getByRole('button', { name: 'Novo indicador' })).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Reativar', 'Excluir'])
  })

  it('o par Inativar/Reativar + Excluir é conduzido por useAcoesSituacaoExclusao', async () => {
    await abrirTela('admin')

    expect(useAcoesSituacaoExclusao).toHaveBeenCalled()
    const opcoes = vi.mocked(useAcoesSituacaoExclusao).mock.calls[0][0]
    expect(opcoes.mensagens).toEqual({ situacao: 'Situação alterada.', exclusao: 'Indicador excluído.' })
  })
})
