import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTipoApontamento } from '../../services/adaptadores'
import { excluirTipo, listarTipos } from '../../services/tiposService'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { TIPO_LOGISTICA_API, tiposApi } from '../../test/tiposFalsos'
import { TiposPage } from './TiposPage'
import { useTipos } from './useTipos'

// O serviço é simulado (em vez do fetch) para provocar um erro que NÃO é ApiError na exclusão.
vi.mock('../../services/tiposService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/tiposService')>()
  return { ...original, listarTipos: vi.fn(), excluirTipo: vi.fn() }
})

const MENSAGEM_UNIFICADA = 'Não foi possível concluir a operação. Tente novamente.'

describe('F3.3 — Exclusão de tipo: erro inesperado (não ApiError)', () => {
  const listarTiposFalso = vi.mocked(listarTipos)
  const excluirTipoFalso = vi.mocked(excluirTipo)

  beforeEach(() => {
    listarTiposFalso.mockReset()
    excluirTipoFalso.mockReset()
    listarTiposFalso.mockResolvedValue(tiposApi().map(paraTipoApontamento))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderizar() {
    return render(
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS }) }}>
        <TiposPage />
      </ProvedorSessaoFalso>,
    )
  }

  it('useTipos.excluir repassa o erro original (não ApiError) e mantém a lista e o erro de carga', async () => {
    const falha = new Error('falha interna')
    excluirTipoFalso.mockRejectedValue(falha)
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(TIPO_LOGISTICA_API.id).catch((e: unknown) => e)
    })

    expect(erro).toBe(falha)
    expect(result.current.tipos).toHaveLength(9)
    expect(result.current.erro).toBeNull()
  })

  it('TiposPage: erro inesperado ao excluir fecha o diálogo, mostra a mensagem unificada e mantém a linha, sem notificação', async () => {
    const user = usuarioRapido()
    excluirTipoFalso.mockRejectedValue(new Error('detalhe técnico interno'))
    renderizar()
    await screen.findByRole('table', { name: 'Tipos de apontamento' })

    await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(MENSAGEM_UNIFICADA)
    expect(alerta).not.toHaveTextContent('detalhe técnico interno')
    expect(alerta).toHaveClass('aviso--erro')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
    expect(screen.queryByText('Tipo excluído.')).not.toBeInTheDocument()
    expect(excluirTipoFalso).toHaveBeenCalledWith(TIPO_LOGISTICA_API.id)
  })

  it('depois do erro inesperado, uma exclusão bem-sucedida remove o alerta e a linha', async () => {
    const user = usuarioRapido()
    excluirTipoFalso.mockRejectedValueOnce(new Error('falha interna')).mockResolvedValueOnce(undefined)
    renderizar()
    await screen.findByRole('table', { name: 'Tipos de apontamento' })

    await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_UNIFICADA)

    await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    await screen.findByText('Tipo excluído.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Logística' })).not.toBeInTheDocument())
  })
})
