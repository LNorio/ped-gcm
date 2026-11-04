import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTipoApontamento } from '../../services/adaptadores'
import { listarTipos } from '../../services/tiposService'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { tiposApi } from '../../test/tiposFalsos'
import { TiposPage } from './TiposPage'
import { useTipos } from './useTipos'

// O serviço é simulado (em vez do fetch) para provocar um erro que NÃO é ApiError
// (ex.: falha interna de conversão), caso que o cliente HTTP nunca produz.
vi.mock('../../services/tiposService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/tiposService')>()
  return { ...original, listarTipos: vi.fn(), excluirTipo: vi.fn() }
})

const MENSAGEM_UNIFICADA = 'Não foi possível concluir a operação. Tente novamente.'

describe('F3.2 — Listagem de tipos: erro inesperado (não ApiError) na carga', () => {
  const listarTiposFalso = vi.mocked(listarTipos)

  beforeEach(() => {
    listarTiposFalso.mockReset()
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

  it('useTipos: erro que não é ApiError expõe a mensagem unificada em erro e encerra o carregamento', async () => {
    listarTiposFalso.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'map')"))

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe(MENSAGEM_UNIFICADA)
    expect(result.current.tipos).toEqual([])
  })

  it('TiposPage: mostra a mensagem unificada em um alerta de erro com "Tentar novamente", sem vazar o texto técnico', async () => {
    listarTiposFalso.mockRejectedValue(new Error('detalhe técnico interno'))
    renderizar()

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(MENSAGEM_UNIFICADA)
    expect(alerta).not.toHaveTextContent('detalhe técnico interno')
    expect(alerta).toHaveClass('aviso--erro')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('"Tentar novamente" depois do erro inesperado recupera a listagem e remove o alerta', async () => {
    const user = usuarioRapido()
    listarTiposFalso.mockRejectedValueOnce(new Error('falha interna')).mockResolvedValueOnce(tiposApi().map(paraTipoApontamento))
    renderizar()
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    const tabela = await screen.findByRole('table', { name: 'Tipos de apontamento' })
    expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(9)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(listarTiposFalso).toHaveBeenCalledTimes(2)
  })
})
