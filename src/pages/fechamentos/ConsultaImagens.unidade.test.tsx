import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { simularApi } from '../../test/apiFalsa'
import {
  TEXTO_FILIAL_SEM_COLABORADOR,
  TITULO_CONSULTA_IMAGENS,
  criarApiConsultaImagensFalsa,
  rotuloVisualizarImagem,
} from '../../test/consultaImagensFalsos'
import { adicionarRotasPdf, simularUrlsDeObjeto } from '../../test/pdfFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { ConsultaImagens } from './ConsultaImagens'

/**
 * F10.6 — Consulta retroativa com as linhas de `GET /api/ped/imagens` no formato do Swagger de 25/11/2026
 * (bloco `unidade`; resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seção 5, item 7).
 *
 * Com `unidade`: a coluna Filial mostra "{código} - {nome}" (código da raiz, nome de
 * `unidade.filial.nome`) e a coluna Colaborador mostra o nome (raiz) e o cargo (`unidade.colaborador.cargo`).
 * Imagem antiga (`unidade.filial.nome` e `unidade.colaborador` nulos): Filial só com o código e o
 * colaborador sem cargo. Imagens de filial: "Filial (sem colaborador vinculado)".
 *
 * Colunas: Dashboard (0), Colaborador (1), Tipo (2), Período (3), Filial (4), Gerada em (5), Por (6), PED (7), Ação (8).
 */
describe('F10.6 — ConsultaImagens: filial e cargo pelo bloco "unidade" da consulta', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
    sessao = { acesso: acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS }), filialSelecionada: 'todas' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function simular(formatoUnidade: 'unidade' | 'antiga') {
    const api = adicionarRotasPdf(criarApiConsultaImagensFalsa({ formatoUnidade }))
    return simularApi(fetchFalso, api.rotas)
  }

  async function abrir() {
    render(
      <ProvedorSessaoFalso sessao={sessao}>
        <ConsultaImagens />
      </ProvedorSessaoFalso>,
    )
    const regiao = screen.getByRole('region', { name: TITULO_CONSULTA_IMAGENS })
    await waitFor(() => expect(within(regiao).getAllByRole('button', { name: /^Visualizar imagem / }).length).toBeGreaterThan(0))
  }

  const linhaDa = (codigo: string) => screen.getByRole('button', { name: rotuloVisualizarImagem(codigo) }).closest('tr')!
  const celulas = (codigo: string) => within(linhaDa(codigo)).getAllByRole('cell')

  it('imagem de colaborador com unidade: Filial "100 - MATRIZ" e o cargo "Gerente de Loja" abaixo do nome', async () => {
    simular('unidade')

    await abrir()

    const linha = linhaDa('IMG-000003')
    expect(within(linha).getByText('Ana Souza')).toBeInTheDocument()
    expect(within(linha).getByText('Gerente de Loja')).toBeInTheDocument()
    expect(celulas('IMG-000003')[4]).toHaveTextContent(/^100 - MATRIZ$/)
    expect(celulas('IMG-000004')[4]).toHaveTextContent(/^102 - DOURADOS$/)
  })

  it('imagem de filial com unidade: Filial "101 - CAMPO GRANDE" e "Filial (sem colaborador vinculado)"', async () => {
    simular('unidade')

    await abrir()

    expect(celulas('IMG-000002')[1]).toHaveTextContent(TEXTO_FILIAL_SEM_COLABORADOR)
    expect(celulas('IMG-000002')[4]).toHaveTextContent(/^101 - CAMPO GRANDE$/)
  })

  it('imagem antiga (sem nome da filial nem colaborador em unidade): Filial só com o código e o colaborador sem cargo', async () => {
    simular('antiga')

    await abrir()

    expect(celulas('IMG-000003')[1]).toHaveTextContent(/^Ana Souza$/)
    expect(celulas('IMG-000003')[4]).toHaveTextContent(/^100$/)
    expect(celulas('IMG-000001')[4]).toHaveTextContent(/^100$/)
  })
})
