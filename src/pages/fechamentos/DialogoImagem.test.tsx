import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { adiado, tituloDialogoImagem } from '../../test/consultaImagensFalsos'
import { IMAGEM_COMERCIAL_100_API, IMAGEM_GERENTES_ANA_API } from '../../test/fechamentosFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { ImagemCongelada, ImagemDaConsulta } from '../../types/dominio'
import { DialogoImagem } from './DialogoImagem'

// A visualização é da F10.3 (testes próprios): aqui só se confere que ela recebe a imagem consultada.
const visualizacao = vi.hoisted(() => vi.fn())
vi.mock('./VisualizacaoImagem', () => ({
  VisualizacaoImagem: (props: { imagem: ImagemCongelada }) => {
    visualizacao(props)
    return <section aria-label={`Imagem ${props.imagem.codigo ?? ''}`} />
  },
}))

const LINHA_ANA: ImagemDaConsulta = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  tipo: 'colaborador',
  idColaborador: 11,
  idDashboard: 2,
  dashboard: 'PED Gerentes',
  periodo: '10/2026',
  filial: '100',
  nomeFilial: 'MATRIZ',
  colaborador: 'Ana Souza',
  cargo: 'Gerente de Loja',
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
  pedPercentual: 20,
  pontuacao: 150,
}

const LINHA_COMERCIAL_100: ImagemDaConsulta = {
  ...LINHA_ANA,
  id: 1,
  codigo: 'IMG-000001',
  lote: 'ENC-000001',
  tipo: 'filial',
  idColaborador: null,
  idDashboard: 1,
  dashboard: 'PED Comercial',
  periodo: '3º tri/2026',
  colaborador: null,
  cargo: null,
  geradoEm: '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
  pedPercentual: 99.99,
  pontuacao: 8839.12,
}

/**
 * F10.6 — Diálogo de uma imagem da consulta retroativa (`src/pages/fechamentos/DialogoImagem.tsx`; RF-84, RN-18).
 *
 * Props: `{ imagem: ImagemDaConsulta | null; onFechar: () => void }`.
 * - `imagem` null: não renderiza nada nem consulta;
 * - aberto: diálogo "Imagem congelada {código}"; consulta `obterImagem(imagem.id)` (`GET /api/ped/imagens/{id}`),
 *   anuncia "Carregando imagem..." e mostra a `VisualizacaoImagem` (F10.3) com a imagem consultada;
 * - erro: alerta com a mensagem dentro do diálogo e "Tentar novamente";
 * - trocar a imagem consulta a nova; só a resposta mais recente é aplicada;
 * - "Fechar" e Esc chamam `onFechar`; a imagem é somente leitura (só GET; sem alterar ou excluir).
 */
describe('F10.6 — DialogoImagem (visualizar imagem congelada)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    visualizacao.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function simular(rotas: Record<string, RotaFalsa> = {}) {
    return simularApi(fetchFalso, {
      'GET /api/ped/imagens/1': () => respostaJson(IMAGEM_COMERCIAL_100_API),
      'GET /api/ped/imagens/3': () => respostaJson(IMAGEM_GERENTES_ANA_API),
      ...rotas,
    })
  }

  const getsDetalhe = (chamadas: ChamadaRegistrada[], id: number) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/imagens/${id}`)
  const ultimaImagemVisualizada = () => (visualizacao.mock.calls.at(-1)?.[0] as { imagem: ImagemCongelada } | undefined)?.imagem

  it('sem imagem (null): não mostra diálogo e não consulta a API', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={null} onFechar={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(chamadas).toHaveLength(0)
  })

  it('com imagem: diálogo "Imagem congelada {código}", um GET do detalhe e a visualização com a imagem consultada', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
    expect(getsDetalhe(chamadas, 3)).toHaveLength(1)
    expect(ultimaImagemVisualizada()).toMatchObject({ id: 3, codigo: 'IMG-000003', tipo: 'colaborador', idColaborador: 11 })
  })

  it('enquanto consulta, anuncia "Carregando imagem..." e ainda não mostra a visualização', async () => {
    const lenta = adiado<void>()
    simular({ 'GET /api/ped/imagens/3': () => lenta.promessa.then(() => respostaJson(IMAGEM_GERENTES_ANA_API)) })

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByText('Carregando imagem...')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()

    lenta.resolver()

    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
    expect(within(dialogo).queryByText('Carregando imagem...')).not.toBeInTheDocument()
  })

  it('imagem de filial também é consultada e visualizada', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000001') })
    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000001' })).toBeInTheDocument()
    expect(getsDetalhe(chamadas, 1)).toHaveLength(1)
    expect(ultimaImagemVisualizada()).toMatchObject({ id: 1, codigo: 'IMG-000001', tipo: 'filial', idColaborador: null })
  })

  it('erro HTTP: alerta com a mensagem no diálogo; "Tentar novamente" consulta de novo e mostra a imagem', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simular({
      'GET /api/ped/imagens/3': () => (falhar ? respostaErro(500) : respostaJson(IMAGEM_GERENTES_ANA_API)),
    })
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    expect(within(dialogo).queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()

    falhar = false
    await user.click(within(dialogo).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
    expect(getsDetalhe(chamadas, 3)).toHaveLength(2)
  })

  it('falha de rede: alerta com a mensagem de sem conexão', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
  })

  it('imagem inexistente (404): alerta com a mensagem do servidor', async () => {
    simular({ 'GET /api/ped/imagens/3': () => respostaErro(404, 'recurso nao encontrado') })

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('alert')).not.toBeEmptyDOMElement()
    expect(within(dialogo).queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()
  })

  it('trocar a imagem consulta a nova e mostra o título e a visualização dela', async () => {
    const chamadas = simular()
    const { rerender } = render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    expect(await screen.findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()

    rerender(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000001') })
    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000001' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()
    expect(getsDetalhe(chamadas, 1)).toHaveLength(1)
  })

  it('só a resposta da imagem mais recente é aplicada (resposta lenta da anterior é descartada)', async () => {
    const lenta = adiado<void>()
    simular({ 'GET /api/ped/imagens/3': () => lenta.promessa.then(() => respostaJson(IMAGEM_GERENTES_ANA_API)) })
    const { rerender } = render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    rerender(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)
    expect(await screen.findByRole('region', { name: 'Imagem IMG-000001' })).toBeInTheDocument()

    lenta.resolver()
    await new Promise((r) => setTimeout(r, 20))

    expect(screen.getByRole('region', { name: 'Imagem IMG-000001' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()
    expect(ultimaImagemVisualizada()).toMatchObject({ codigo: 'IMG-000001' })
  })

  it('"Fechar" e Esc chamam onFechar', async () => {
    const user = usuarioRapido()
    simular()
    const onFechar = vi.fn()
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={onFechar} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })

    await user.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('somente leitura (RN-18): só GET e nenhuma ação de alterar ou excluir no diálogo', async () => {
    const chamadas = simular()
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })

    await waitFor(() => expect(chamadas.length).toBeGreaterThan(0))
    expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true)
    expect(within(dialogo).queryByRole('button', { name: /alterar|editar|excluir/i })).not.toBeInTheDocument()
  })
})
