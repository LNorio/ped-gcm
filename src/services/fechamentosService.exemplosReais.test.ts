import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fechamentosReais from '../../docs/backend/exemplos-reais/fechamentos.json'
import imagensReais from '../../docs/backend/exemplos-reais/imagens.json'
import previaReal from '../../docs/backend/exemplos-reais/previa.json'
import { respostaJson, simularApi } from '../test/apiFalsa'
import type { Fechamento, FaixasDaImagem, ResumoFechamento } from '../types/dominio'
import { listarFechamentos, obterPreviaFechamento } from './fechamentosService'
import { listarImagens } from './imagensService'
import { definirToken, limparToken } from './sessao'

/**
 * Garantia de contrato (F10.1): os serviços da aba Fechamentos convertem, sem erro e com os valores
 * certos, as respostas reais do back-end salvas em `docs/backend/exemplos-reais/` (enviadas pelo usuário
 * em 16/11/2026). Motivo: contra o servidor real, a aba mostrava "Resposta inválida do servidor.".
 *
 * - `fechamentos.json` (`GET /api/ped/fechamentos`): "indicadores com problema" e "unidades sem tabela
 *   de faixas" chegam como **contagens numéricas** (0), não como listas; "periodo atual" "11/2026".
 * - `imagens.json` (`GET /api/ped/imagens`): lista vazia.
 * - `previa.json` (`GET /api/ped/fechamentos/{id}/previa`, enviado em 24/11/2026, resumido em 2 imagens):
 *   `unidade.filial` como `{ codigo, nome }`, `unidade.colaborador` como `{ id, nome, cargo }` e as faixas
 *   dentro de `pontuacao.faixas`. Motivo: a pré-visualização mostrava "Filial · 60 imagens", sem o código.
 *
 * Os JSONs não podem ser alterados para fazer o teste passar: eles são a resposta real.
 */
describe('F10.1 — Serviços dos fechamentos: contrato com as respostas reais', () => {
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

  describe('GET /api/ped/fechamentos (fechamentos.json)', () => {
    it('converte a linha do PED sem erro, com as contagens 0 de indicadores com problema e de unidades sem tabela de faixas', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/fechamentos': () => respostaJson(fechamentosReais) })

      await expect(listarFechamentos()).resolves.toEqual<Fechamento[]>([
        {
          id: 2,
          nome: 'PED',
          tipoVinculo: 'cargos',
          itensVinculados: ['Consultor de Vendas Balcão'],
          periodicidade: 'mensal',
          periodoAtual: '11/2026',
          situacaoDoPeriodo: 'aberto',
          unidadesDeImagem: 60,
          unidadesEncerradas: 0,
          unidadesComPendencias: 60,
          progresso: { preenchidos: 0, total: 420 },
          indicadoresComProblema: [],
          quantidadeIndicadoresComProblema: 0,
          unidadesSemTabelaDeFaixas: [],
          quantidadeUnidadesSemTabelaDeFaixas: 0,
        },
      ])
    })

    it('com contagens diferentes de 0 no mesmo formato, as quantidades são as do número e as listas ficam vazias', async () => {
      const [linha] = fechamentosReais
      simularApi(fetchFalso, {
        'GET /api/ped/fechamentos': () =>
          respostaJson([{ ...linha, 'indicadores com problema': 2, 'unidades sem tabela de faixas': 5 }]),
      })

      const [fechamento] = await listarFechamentos()

      expect(fechamento.quantidadeIndicadoresComProblema).toBe(2)
      expect(fechamento.quantidadeUnidadesSemTabelaDeFaixas).toBe(5)
      expect(fechamento.indicadoresComProblema).toEqual([])
      expect(fechamento.unidadesSemTabelaDeFaixas).toEqual([])
    })
  })

  describe('GET /api/ped/imagens (imagens.json)', () => {
    it('lista vazia resolve [] sem erro', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/imagens': () => respostaJson(imagensReais) })

      await expect(listarImagens()).resolves.toEqual([])
    })
  })

  describe('GET /api/ped/fechamentos/{id}/previa (previa.json)', () => {
    const FAIXAS_V2: FaixasDaImagem = {
      nome: null,
      versao: 2,
      linhas: [
        { de: 0, ate: 200000, aliquota: 2.75 },
        { de: 200000.01, ate: 300000, aliquota: 2.22 },
        { de: 300000.01, ate: 400000, aliquota: 2.21 },
        { de: 400000.01, ate: 500000, aliquota: 1.95 },
        { de: 500000.01, ate: 600000, aliquota: 1.8 },
        { de: 600000.01, ate: 700000, aliquota: 1.68 },
      ],
    }

    function responderPrevia() {
      simularApi(fetchFalso, { 'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaReal) })
    }

    it('converte a prévia real sem erro, com o dashboard (texto "PED"), o período e o resumo numérico', async () => {
      responderPrevia()

      const previa = await obterPreviaFechamento(2)

      expect(previa.dashboard).toMatchObject({ nome: 'PED' })
      expect(previa.periodo).toEqual({ codigo: '10/2026', inicio: '2026-10-01', fim: '2026-10-31' })
      expect(previa.resumo).toEqual<ResumoFechamento>({
        imagensAGerar: 33,
        unidadesJaEncerradas: { quantidade: 60, unidades: [] },
        unidadesComPendencias: { quantidade: 32, unidades: [] },
        unidadesSemTabelaDeFaixas: { quantidade: 0, unidades: [] },
        avisos: [],
      })
      expect(previa.imagens).toHaveLength(2)
    })

    it('filial em { codigo, nome } vira filial "403"/"Filial 403" e "101"/"Filial 101" (nunca null)', async () => {
      responderPrevia()

      const { imagens } = await obterPreviaFechamento(2)

      expect(imagens.map((imagem) => imagem.unidade.filial)).toEqual(['403', '101'])
      expect(imagens.map((imagem) => imagem.unidade.nomeFilial)).toEqual(['Filial 403', 'Filial 101'])
    })

    it('colaborador em { id, nome, cargo }: tipo "colaborador", idColaborador 242/250, nome, cargo e a chave da prévia', async () => {
      responderPrevia()

      const [alexandre, andre] = await obterPreviaFechamento(2).then((previa) => previa.imagens)

      expect(alexandre).toMatchObject({
        chave: 'colaborador:242',
        tipo: 'colaborador',
        idColaborador: 242,
        unidade: { filial: '403', nomeFilial: 'Filial 403', colaborador: 'Alexandre dos Santos Sousa', cargo: 'Gerente' },
      })
      expect(andre).toMatchObject({
        chave: 'colaborador:250',
        tipo: 'colaborador',
        idColaborador: 250,
        unidade: { filial: '101', nomeFilial: 'Filial 101', colaborador: 'Andre Luiz Mendes Monteiro', cargo: 'Gerente' },
      })
    })

    it('faixas lidas de "pontuacao.faixas" (versão 2, 6 linhas), já que não vêm na raiz da imagem', async () => {
      responderPrevia()

      const { imagens } = await obterPreviaFechamento(2)

      expect(imagens[0].faixas).toEqual(FAIXAS_V2)
      expect(imagens[1].faixas).toEqual(FAIXAS_V2)
    })

    it('demais campos da imagem real: dashboard em objeto, PED, pontuação, indicadores, pendências e avisos ("composicao do resultado", "id indicador" e "sentido" tolerados)', async () => {
      responderPrevia()

      const [alexandre, andre] = await obterPreviaFechamento(2).then((previa) => previa.imagens)

      expect(alexandre.dashboard).toEqual({
        id: 2,
        nome: 'PED',
        periodicidade: 'mensal',
        pontuacaoMaxima: 120,
        tipoVinculo: 'cargos',
        formulaDePontuacao: 'teste',
      })
      expect(alexandre).toMatchObject({
        id: null,
        pedPercentual: 47.59,
        pontosBaseTotal: 120,
        resultadoOperacional: { indicador: 'Faturamento', valor: 4087767.24 },
        pontuacao: {
          calculada: true,
          faixaAtual: { de: 600000.01, ate: 700000, aliquota: 1.68 },
          opcaoSelecionada: 'B',
          baseDeCalculo: 68674.49,
          valor: 32682.19,
        },
      })
      expect(alexandre.indicadores).toHaveLength(6)
      expect(alexandre.indicadores[5]).toMatchObject({ indicador: 'Litragem Texaco', meta: null, realizado: null })
      expect(alexandre.pendencias).toHaveLength(7)
      expect(alexandre.avisos).toHaveLength(2)
      expect(andre).toMatchObject({ pedPercentual: 87.41, pendencias: [], pontuacao: { valor: 69494.53 } })
    })
  })
})
