import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { imagemDaListaAntigaApi, imagemDaListaComUnidadeApi } from '../test/consultaImagensFalsos'
import { IMAGEM_COMERCIAL_100_API, IMAGEM_GERENTES_ANA_API } from '../test/fechamentosFalsos'
import type { ImagemDaConsulta } from '../types/dominio'
import { listarImagens } from './imagensService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/imagens'

/**
 * F10.1 — Bloco `unidade` nas linhas de `GET /api/ped/imagens` (Swagger de 25/11/2026, l. 5119–5148;
 * resposta do back-end de 25/11/2026, `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`,
 * seção 5, item 7).
 *
 * Cada linha traz `unidade { tipo, filial { codigo, nome }, colaborador { id, nome, cargo } | null }`;
 * `filial` na raiz é o **código** (texto) e `colaborador` na raiz é o **nome** (texto). Em imagem antiga,
 * `unidade.filial.nome` e `unidade.colaborador` vêm nulos.
 *
 * Regra (interface `ImagemDaConsulta`, sem campos novos):
 * - `nomeFilial` ← `unidade.filial.nome`; `cargo` ← `unidade.colaborador.cargo` (quando houver);
 * - `filial` (código) e `colaborador` (nome) continuam vindo da raiz, mesmo que `unidade` traga outro texto;
 * - sem o bloco (ou com os nulos da imagem antiga), `nomeFilial` e `cargo` ficam `null`, como hoje.
 */
describe('F10.1 — Serviço das imagens: bloco "unidade" na consulta retroativa', () => {
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

  function responder(linhas: unknown[]) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(linhas) })
  }

  it('contrato (exemplo do Swagger de 25/11/2026): imagem de filial com unidade.filial.nome "Filial 101"', async () => {
    responder([
      {
        id: 15,
        codigo: 'IMG-000015',
        lote: 'ENC-000006',
        dashboard: 'PED Exemplo',
        periodo: '10/2026',
        filial: '101',
        tipo: 'filial',
        'id colaborador': null,
        colaborador: null,
        unidade: { tipo: 'filial', filial: { codigo: '101', nome: 'Filial 101' }, colaborador: null },
        'gerado em': '2026-11-02 09:00:00-04:00',
        usuario: 'Fulano de Tal',
        'ped percentual': 100,
        pontuacao: 8806.02,
      },
    ])

    await expect(listarImagens()).resolves.toEqual<ImagemDaConsulta[]>([
      {
        id: 15,
        codigo: 'IMG-000015',
        lote: 'ENC-000006',
        tipo: 'filial',
        idColaborador: null,
        idDashboard: null,
        dashboard: 'PED Exemplo',
        periodo: '10/2026',
        filial: '101',
        nomeFilial: 'Filial 101',
        colaborador: null,
        cargo: null,
        geradoEm: '2026-11-02 09:00:00-04:00',
        usuario: 'Fulano de Tal',
        pedPercentual: 100,
        pontuacao: 8806.02,
      },
    ])
  })

  it('imagem de colaborador: nome e código da raiz, nome da filial e cargo de unidade', async () => {
    responder([imagemDaListaComUnidadeApi(IMAGEM_GERENTES_ANA_API)])

    const [ana] = await listarImagens()

    expect(ana).toEqual<ImagemDaConsulta>({
      id: 3,
      codigo: 'IMG-000003',
      lote: 'ENC-000002',
      tipo: 'colaborador',
      idColaborador: 11,
      idDashboard: null,
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
    })
  })

  it('imagem de filial (formato com unidade): nome da filial de unidade, sem colaborador nem cargo', async () => {
    responder([imagemDaListaComUnidadeApi(IMAGEM_COMERCIAL_100_API)])

    const [imagem] = await listarImagens()

    expect(imagem).toMatchObject({ tipo: 'filial', filial: '100', nomeFilial: 'MATRIZ', colaborador: null, cargo: null })
  })

  it('o código da filial e o nome do colaborador continuam vindo da raiz, mesmo com outro texto em unidade', async () => {
    const linha = imagemDaListaComUnidadeApi(IMAGEM_GERENTES_ANA_API)
    responder([
      {
        ...linha,
        unidade: { tipo: 'colaborador', filial: { codigo: '999', nome: 'MATRIZ' }, colaborador: { id: 11, nome: 'Ana S.', cargo: 'Gerente de Loja' } },
      },
    ])

    const [ana] = await listarImagens()

    expect(ana).toMatchObject({ filial: '100', nomeFilial: 'MATRIZ', colaborador: 'Ana Souza', cargo: 'Gerente de Loja' })
  })

  it('imagem antiga (unidade com filial.nome e colaborador nulos): nomeFilial e cargo null; código e nome da raiz', async () => {
    responder([imagemDaListaAntigaApi(IMAGEM_GERENTES_ANA_API)])

    const [ana] = await listarImagens()

    expect(ana).toMatchObject({
      tipo: 'colaborador',
      idColaborador: 11,
      filial: '100',
      nomeFilial: null,
      colaborador: 'Ana Souza',
      cargo: null,
    })
  })

  it('cargo null em unidade.colaborador vira cargo null, sem rejeitar a linha', async () => {
    const linha = imagemDaListaComUnidadeApi(IMAGEM_GERENTES_ANA_API)
    responder([{ ...linha, unidade: { tipo: 'colaborador', filial: { codigo: '100', nome: 'MATRIZ' }, colaborador: { id: 11, nome: 'Ana Souza', cargo: null } } }])

    const [ana] = await listarImagens()

    expect(ana).toMatchObject({ colaborador: 'Ana Souza', cargo: null, nomeFilial: 'MATRIZ' })
  })
})
