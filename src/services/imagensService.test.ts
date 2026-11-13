import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  IMAGEM_COMERCIAL_101_SEM_FAIXA_API,
  IMAGEM_GERENTES_ANA_API,
  imagemDaListaApi,
  imagensApi,
} from '../test/fechamentosFalsos'
import type { ImagemDaConsulta } from '../types/dominio'
import { MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { listarImagens, obterImagem } from './imagensService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/imagens'

const ITEM_ANA: ImagemDaConsulta = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  tipo: 'colaborador',
  idColaborador: 11,
  idDashboard: null,
  dashboard: 'PED Gerentes',
  periodo: '10/2026',
  filial: '100',
  nomeFilial: null,
  colaborador: 'Ana Souza',
  cargo: null,
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
  pedPercentual: 20,
  pontuacao: 150,
}

const ITEM_ANA_API = imagemDaListaApi(IMAGEM_GERENTES_ANA_API)

/** Lista com um único item (para testar a conversão de uma linha). */
function listaCom(item: Record<string, unknown>): unknown[] {
  return [item]
}

/**
 * F10.1 — Serviço das imagens congeladas (`src/services/imagensService.ts`), contrato de
 * `docs/backend/API (28).md` ("fase 7") e `docs/backend/FRONT-PED-mudancas (1).md`, item 8:
 * - `listarImagens(filtros?)` → `GET /api/ped/imagens?filial=&periodo=&dashboard=&tipo=&id_colaborador=&busca=`
 *   (lista pura ou `{ imagens }`) → `ImagemDaConsulta[]` (RF-84);
 * - `obterImagem(id)` → `GET /api/ped/imagens/{id}` (na raiz ou em `{ imagem }`) → `ImagemCongelada`
 *   (RF-83; conteúdo detalhado em `imagensService.conteudo.test.ts`).
 * Não existe rota para alterar ou excluir imagem (RN-18): o serviço só lê.
 */
describe('F10.1 — Serviço das imagens congeladas: consulta retroativa e detalhe (RF-83, RF-84, RN-18)', () => {
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

  describe('listarImagens(filtros?) — GET /api/ped/imagens (RF-84)', () => {
    it('sem filtros faz GET sem query, com o token, e devolve as linhas convertidas na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(imagensApi()) })

      const imagens = await listarImagens()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect([...chamadas[0].url.searchParams.keys()]).toEqual([])
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(imagens.map((i) => i.codigo)).toEqual(['IMG-000004', 'IMG-000003', 'IMG-000002', 'IMG-000001'])
      expect(imagens[1]).toEqual(ITEM_ANA)
    })

    it('imagem de filial: tipo "filial", sem colaborador, e pontuação null quando não foi calculada', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([imagemDaListaApi(IMAGEM_COMERCIAL_101_SEM_FAIXA_API)]) })

      await expect(listarImagens()).resolves.toEqual<ImagemDaConsulta[]>([
        {
          id: 2,
          codigo: 'IMG-000002',
          lote: 'ENC-000001',
          tipo: 'filial',
          idColaborador: null,
          idDashboard: null,
          dashboard: 'PED Comercial',
          periodo: '3º tri/2026',
          filial: '101',
          nomeFilial: null,
          colaborador: null,
          cargo: null,
          geradoEm: '2026-09-30 18:00:00-04:00',
          usuario: 'Ana Costa',
          pedPercentual: 0,
          pontuacao: null,
        },
      ])
    })

    it('aceita a lista envolvida em { imagens }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ imagens: [ITEM_ANA_API] }) })

      await expect(listarImagens()).resolves.toEqual([ITEM_ANA])
    })

    it('envia filial, periodo, dashboard, tipo, id_colaborador e busca na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarImagens({ filial: '101', periodo: '4º tri/2026', dashboard: 2, tipo: 'colaborador', idColaborador: 11, busca: 'ana' })

      const parametros = chamadas[0].url.searchParams
      expect([...parametros.keys()].sort()).toEqual(['busca', 'dashboard', 'filial', 'id_colaborador', 'periodo', 'tipo'])
      expect(parametros.get('filial')).toBe('101')
      expect(parametros.get('periodo')).toBe('4º tri/2026')
      expect(parametros.get('dashboard')).toBe('2')
      expect(parametros.get('tipo')).toBe('colaborador')
      expect(parametros.get('id_colaborador')).toBe('11')
      expect(parametros.get('busca')).toBe('ana')
    })

    it('filial "todas" ou vazia, tipo "todas" e período/busca vazios ou só com espaços não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarImagens({ filial: 'todas', tipo: 'todas', periodo: '', busca: '' })
      await listarImagens({ filial: '  ', periodo: '   ', busca: '   ' })

      for (const chamada of chamadas) expect([...chamada.url.searchParams.keys()]).toEqual([])
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await expect(listarImagens()).resolves.toEqual([])
    })

    it('dashboard como { id, nome } ou com "id dashboard"; período como { codigo }; filial numérica ou { filial, "nome filial" }', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            { ...ITEM_ANA_API, dashboard: { id: 2, nome: 'PED Gerentes' }, periodo: { codigo: '10/2026' }, filial: 100 },
            { ...ITEM_ANA_API, 'id dashboard': 2, filial: { filial: '100', 'nome filial': 'MATRIZ' } },
          ]),
      })

      const [primeira, segunda] = await listarImagens()

      expect(primeira).toMatchObject({ idDashboard: 2, dashboard: 'PED Gerentes', periodo: '10/2026', filial: '100', nomeFilial: null })
      expect(segunda).toMatchObject({ idDashboard: 2, dashboard: 'PED Gerentes', filial: '100', nomeFilial: 'MATRIZ' })
    })

    it('dashboard excluído: sem "dashboard", o nome vem de "dashboard_nome" (RN-18); sem nenhum dos dois, null', async () => {
      const { dashboard: _dashboard, ...semDashboard } = ITEM_ANA_API
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson([{ ...semDashboard, dashboard_nome: 'PED Antigo' }, semDashboard]),
      })

      const imagens = await listarImagens()

      expect(imagens.map((i) => i.dashboard)).toEqual(['PED Antigo', null])
    })

    it('colaborador como { "id colaborador", nome, cargo } e "nome filial"/cargo na linha também são lidos (RF-84)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            { ...ITEM_ANA_API, 'id colaborador': undefined, colaborador: { 'id colaborador': 11, nome: 'Ana Souza', cargo: 'Gerente de Loja' } },
            { ...ITEM_ANA_API, 'nome filial': 'MATRIZ', cargo: 'Gerente de Loja' },
          ]),
      })

      const [primeira, segunda] = await listarImagens()

      expect(primeira).toMatchObject({ idColaborador: 11, colaborador: 'Ana Souza', cargo: 'Gerente de Loja' })
      expect(segunda).toMatchObject({ nomeFilial: 'MATRIZ', colaborador: 'Ana Souza', cargo: 'Gerente de Loja' })
    })

    it('"ped percentual" e pontuação em texto decimal ("99.99") viram número; pontuação { valor } ou { calculada: false } também', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            { ...ITEM_ANA_API, 'ped percentual': '99.99', pontuacao: '8839.12' },
            { ...ITEM_ANA_API, pontuacao: { calculada: true, valor: 150 } },
            { ...ITEM_ANA_API, pontuacao: { calculada: false, motivo: 'unidade sem tabela de faixas' } },
          ]),
      })

      const imagens = await listarImagens()

      expect(imagens.map((i) => [i.pedPercentual, i.pontuacao])).toEqual([
        [99.99, 8839.12],
        [20, 150],
        [20, null],
      ])
    })

    it('sem "tipo": "colaborador" quando há "id colaborador", senão "filial"; opcionais ausentes viram null', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson([{ id: 3, codigo: 'IMG-000003', 'id colaborador': 11 }, { id: 2, codigo: 'IMG-000002' }]),
      })

      await expect(listarImagens()).resolves.toEqual<ImagemDaConsulta[]>([
        {
          id: 3,
          codigo: 'IMG-000003',
          lote: null,
          tipo: 'colaborador',
          idColaborador: 11,
          idDashboard: null,
          dashboard: null,
          periodo: null,
          filial: null,
          nomeFilial: null,
          colaborador: null,
          cargo: null,
          geradoEm: null,
          usuario: null,
          pedPercentual: null,
          pontuacao: null,
        },
        expect.objectContaining({ id: 2, tipo: 'filial', idColaborador: null }) as ImagemDaConsulta,
      ])
    })

    it.each([
      ['um objeto sem a lista', { total: 1 }],
      ['um texto', 'nada'],
      ['uma linha sem id', listaCom({ ...ITEM_ANA_API, id: undefined })],
      ['uma linha sem código', listaCom({ ...ITEM_ANA_API, codigo: undefined })],
      ['tipo desconhecido', listaCom({ ...ITEM_ANA_API, tipo: 'zona' })],
      ['"id colaborador" em texto', listaCom({ ...ITEM_ANA_API, 'id colaborador': 'onze' })],
      ['"ped percentual" em formato pt-BR', listaCom({ ...ITEM_ANA_API, 'ped percentual': '99,99' })],
      ['pontuação booleana', listaCom({ ...ITEM_ANA_API, pontuacao: true })],
    ])('resposta 2xx com %s vira ApiError "resposta inválida" (um item inválido rejeita a lista)', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      await expect(listarImagens()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 chega como ApiError com a mensagem da API; falha de rede vira ApiError de conexão', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'voce nao tem acesso a esta filial') })
      await expect(listarImagens({ filial: '102' })).rejects.toMatchObject({ status: 403, mensagem: 'voce nao tem acesso a esta filial' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarImagens()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterImagem(id) — GET /api/ped/imagens/{id} (RF-83)', () => {
    it('faz GET da imagem, com o token, e devolve a imagem gravada (código, lote, data e usuário)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/3`]: () => respostaJson(IMAGEM_GERENTES_ANA_API) })

      const imagem = await obterImagem(3)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(imagem).toMatchObject({
        id: 3,
        codigo: 'IMG-000003',
        lote: 'ENC-000002',
        chave: null,
        tipo: 'colaborador',
        idColaborador: 11,
        geradoEm: '2026-11-01 09:00:00-04:00',
        usuario: 'admin',
      })
    })

    it('aceita a imagem envolvida em { imagem }', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/3`]: () => respostaJson(IMAGEM_GERENTES_ANA_API),
        [`GET ${ROTA}/30`]: () => respostaJson({ imagem: IMAGEM_GERENTES_ANA_API }),
      })

      await expect(obterImagem(30)).resolves.toEqual(await obterImagem(3))
    })

    it.each([
      ['uma lista', [IMAGEM_GERENTES_ANA_API]],
      ['um texto', 'nada'],
      ['{ imagem } que não é objeto', { imagem: 'IMG-000003' }],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3`]: () => respostaJson(corpo) })

      await expect(obterImagem(3)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('404 e 403 chegam como ApiError com a mensagem da API; falha de rede vira ApiError de conexão', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/99`]: () => respostaErro(404, 'recurso nao encontrado'),
        [`GET ${ROTA}/4`]: () => respostaErro(403, 'voce nao tem acesso a esta filial'),
      })
      await expect(obterImagem(99)).rejects.toMatchObject({ status: 404, mensagem: 'recurso nao encontrado' })
      await expect(obterImagem(4)).rejects.toMatchObject({ status: 403, mensagem: 'voce nao tem acesso a esta filial' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(obterImagem(3)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
