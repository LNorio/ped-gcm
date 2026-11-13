import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import {
  IMAGEM_COMERCIAL_100_API,
  IMAGEM_COMERCIAL_101_SEM_FAIXA_API,
  IMAGEM_GERENTES_ANA_API,
  MOTIVO_SEM_FAIXA,
  copiarImagem,
} from '../test/fechamentosFalsos'
import type { ImagemCongelada, PontuacaoDaImagem } from '../types/dominio'
import { MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { obterImagem } from './imagensService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/imagens/3'

/** IMG-000003 (colaborador Ana Souza, PED Gerentes, 10/2026) no formato do domínio. */
const IMAGEM_ANA: ImagemCongelada = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  chave: null,
  tipo: 'colaborador',
  idColaborador: 11,
  dashboard: {
    id: 2,
    nome: 'PED Gerentes',
    periodicidade: 'mensal',
    pontuacaoMaxima: 50,
    tipoVinculo: 'cargos',
    formulaDePontuacao: null,
  },
  periodo: { codigo: '10/2026', inicio: '2026-10-01', fim: '2026-10-31' },
  unidade: { filial: '100', nomeFilial: 'MATRIZ', colaborador: 'Ana Souza', cargo: 'Gerente de Loja' },
  resultadoOperacional: { indicador: 'Faturamento', valor: 150000, observacao: null },
  pedPercentual: 20,
  pontosBaseTotal: 50,
  indicadores: [
    {
      indicador: 'Custo de frete por entrega',
      meta: 12,
      realizado: 10,
      coletaDisponivel: true,
      atingimento: 120,
      pontosBase: 20,
      pontosRealizados: 20,
      observacao: 'Menor é melhor',
    },
    {
      indicador: 'Vendas por colaborador',
      meta: 50000,
      realizado: null,
      coletaDisponivel: false,
      atingimento: null,
      pontosBase: 30,
      pontosRealizados: null,
      observacao: 'Sem coleta ainda',
    },
  ],
  pontuacao: {
    calculada: true,
    motivo: null,
    faixaAtual: { de: 0, ate: 3000, aliquota: 0.5 },
    faixaAnterior: null,
    aliquotaAnterior: 0,
    aliquotaAtual: 0.5,
    pisoDaFaixa: 0,
    opcaoA: 0,
    opcaoB: 750,
    opcaoSelecionada: 'B',
    baseDeCalculo: 750,
    valor: 150,
  },
  faixas: { nome: null, versao: 1, linhas: [{ de: 0, ate: 3000, aliquota: 0.5 }] },
  pendencias: [],
  avisos: ['Vendas por colaborador: sem coleta ainda'],
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
}

const PONTUACAO_NAO_CALCULADA: PontuacaoDaImagem = {
  calculada: false,
  motivo: null,
  faixaAtual: null,
  faixaAnterior: null,
  aliquotaAnterior: null,
  aliquotaAtual: null,
  pisoDaFaixa: null,
  opcaoA: null,
  opcaoB: null,
  opcaoSelecionada: null,
  baseDeCalculo: null,
  valor: null,
}

type ImagemApiEditavel = Record<string, unknown> & {
  dashboard: Record<string, unknown>
  unidade: Record<string, unknown>
  indicadores: Array<Record<string, unknown>>
  pontuacao: Record<string, unknown>
  faixas: (Record<string, unknown> & { linhas: Array<Record<string, unknown>> }) | null
}

/** Cópia editável da imagem da Ana (formato da API). */
function ana(): ImagemApiEditavel {
  return copiarImagem(IMAGEM_GERENTES_ANA_API) as unknown as ImagemApiEditavel
}

/**
 * F10.1 — Conteúdo da imagem congelada (RF-83, RN-01 a RN-10, A-07), lido por `obterImagem` e pelo
 * mesmo conversor usado nas imagens da prévia (`obterPreviaFechamento`). Contrato de
 * `docs/backend/API (28).md` ("Conteúdo da imagem"): `dashboard`, `periodo`, `unidade`,
 * "resultado operacional", "ped percentual", "pontos base total", `indicadores`, `pontuacao` (os
 * passos ou `calculada: false` com o `motivo`), `faixas` (`versao` e `linhas`), `pendencias`, `avisos`,
 * `codigo`, `lote`, "gerado em" e `usuario`, mais `tipo` e "id colaborador".
 *
 * Regras de leitura: números aceitam número ou texto decimal canônico ("451590.62"); texto em pt-BR
 * ("451.590,62") ou outro tipo é resposta inválida. `meta: null` é "sem meta" (nunca 0 — F6.10* e F6.11);
 * realizado `null` é lançamento pendente (RN-09) ou dado externo sem coleta (`"coleta disponivel":
 * false` — F10.8), sem erro. Campos informativos ausentes viram `null` ou `[]`.
 */
describe('F10.1 — Conteúdo da imagem congelada (RF-83)', () => {
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

  function responder(corpo: unknown) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })
  }

  it('imagem de colaborador: dashboard, período, unidade com colaborador e cargo, indicadores, pontuação (opção B), faixas, avisos, data e usuário', async () => {
    responder(IMAGEM_GERENTES_ANA_API)

    await expect(obterImagem(3)).resolves.toEqual(IMAGEM_ANA)
  })

  it('imagem de filial com o exemplo do negócio (P-10): A = 8.840,00, B = 8.806,02, opção A, base 8.840,00 e pontuação 8.839,12', async () => {
    responder(IMAGEM_COMERCIAL_100_API)

    const imagem = await obterImagem(3)

    expect(imagem).toMatchObject({
      tipo: 'filial',
      idColaborador: null,
      unidade: { filial: '100', nomeFilial: 'MATRIZ', colaborador: null, cargo: null },
      resultadoOperacional: { indicador: 'Faturamento', valor: 451590.62 },
      pedPercentual: 99.99,
      pontosBaseTotal: 100,
      faixas: { nome: 'Resultado operacional', versao: 2 },
    })
    expect(imagem.pontuacao).toEqual<PontuacaoDaImagem>({
      calculada: true,
      motivo: null,
      faixaAtual: { de: 400000, ate: 600000, aliquota: 1.95 },
      faixaAnterior: { de: 0, ate: 399999.99, aliquota: 2.21 },
      aliquotaAnterior: 2.21,
      aliquotaAtual: 1.95,
      pisoDaFaixa: 400000,
      opcaoA: 8840,
      opcaoB: 8806.02,
      opcaoSelecionada: 'A',
      baseDeCalculo: 8840,
      valor: 8839.12,
    })
    expect(imagem.faixas?.linhas).toHaveLength(3)
  })

  it('unidade sem tabela de faixas: calculada false com o motivo e faixas null; sem meta (null, não 0) e lançamento pendente sem valor', async () => {
    responder(IMAGEM_COMERCIAL_101_SEM_FAIXA_API)

    const imagem = await obterImagem(3)

    expect(imagem.pontuacao).toEqual<PontuacaoDaImagem>({ ...PONTUACAO_NAO_CALCULADA, motivo: MOTIVO_SEM_FAIXA })
    expect(imagem.faixas).toBeNull()
    expect(imagem.indicadores[0]).toMatchObject({ indicador: 'Faturamento', meta: null, realizado: 320000, atingimento: null, pontosRealizados: null })
    expect(imagem.indicadores[1]).toMatchObject({ indicador: 'Cobertura de clientes', meta: 80, realizado: null, coletaDisponivel: true })
    expect(imagem.pendencias).toEqual(['Visitas a clientes (3º tri/2026): sem lançamento'])
    expect(imagem.avisos).toEqual(['Filial 101 sem tabela de faixas: sem pontuação'])
  })

  it('números em texto decimal canônico viram número (indicadores, pontuação, faixas, PED e resultado operacional)', async () => {
    const api = ana()
    api['ped percentual'] = '20.00'
    api['pontos base total'] = '50'
    ;(api['resultado operacional'] as Record<string, unknown>).valor = '150000.00'
    api.indicadores[0].meta = '12.00'
    api.indicadores[0].realizado = '10'
    api.indicadores[0].atingimento = '120.00'
    api.pontuacao['opcao b'] = '750.00'
    api.pontuacao.valor = '150.00'
    api.faixas!.linhas[0].ate = '3000.00'
    responder(api)

    await expect(obterImagem(3)).resolves.toEqual(IMAGEM_ANA)
  })

  it.each([
    ['"pontuacao base maxima", "vinculo" e "formula"', { 'pontuacao base maxima': 50, vinculo: 'cargos', formula: 'Base × PED ÷ 100' }],
    [
      '"pontuacao base maxima", "tipo de vinculo" e "formula de pontuacao"',
      { 'pontuacao base maxima': 50, 'tipo de vinculo': 'cargos', 'formula de pontuacao': 'Base × PED ÷ 100' },
    ],
  ])('dashboard da imagem com as chaves %s', async (_caso, chaves) => {
    const api = ana()
    const { 'pontuacao maxima': _maxima, 'tipo de vinculo': _vinculo, 'formula de pontuacao': _formula, ...resto } = api.dashboard
    api.dashboard = { ...resto, ...chaves }
    responder(api)

    await expect(obterImagem(3)).resolves.toMatchObject({
      dashboard: { ...IMAGEM_ANA.dashboard, formulaDePontuacao: 'Base × PED ÷ 100' },
    })
  })

  it('dashboard em texto vira só o nome; dashboard excluído (sem "dashboard") usa "dashboard_nome"; sem nenhum, null (RN-18)', async () => {
    const emTexto = { ...ana(), dashboard: 'PED Gerentes' }
    const { dashboard: _dashboard, ...semDashboard } = ana()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(emTexto),
      'GET /api/ped/imagens/4': () => respostaJson({ ...semDashboard, dashboard_nome: 'PED Antigo' }),
      'GET /api/ped/imagens/5': () => respostaJson(semDashboard),
    })

    await expect(obterImagem(3)).resolves.toMatchObject({
      dashboard: { id: null, nome: 'PED Gerentes', periodicidade: null, pontuacaoMaxima: null, tipoVinculo: null, formulaDePontuacao: null },
    })
    await expect(obterImagem(4)).resolves.toMatchObject({ dashboard: { id: null, nome: 'PED Antigo' } })
    await expect(obterImagem(5)).resolves.toMatchObject({ dashboard: null })
  })

  it('período em texto vira { codigo, inicio: null, fim: null }; ausente, null', async () => {
    const { periodo: _periodo, ...semPeriodo } = ana()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson({ ...ana(), periodo: '10/2026' }),
      'GET /api/ped/imagens/4': () => respostaJson(semPeriodo),
    })

    await expect(obterImagem(3)).resolves.toMatchObject({ periodo: { codigo: '10/2026', inicio: null, fim: null } })
    await expect(obterImagem(4)).resolves.toMatchObject({ periodo: null })
  })

  it('unidade com filial e colaborador em texto (filial numérica vira texto); cargo na unidade', async () => {
    const api = ana()
    api.unidade = { tipo: 'colaborador', filial: 100, colaborador: 'Ana Souza', cargo: 'Gerente de Loja' }
    responder(api)

    await expect(obterImagem(3)).resolves.toMatchObject({
      unidade: { filial: '100', nomeFilial: null, colaborador: 'Ana Souza', cargo: 'Gerente de Loja' },
    })
  })

  it('sem "unidade": usa filial, "nome filial", colaborador e cargo da raiz (formato do item 8 do FRONT-PED-mudancas)', async () => {
    const { unidade: _unidade, ...api } = ana()
    responder({ ...api, filial: '101', 'nome filial': 'CAMPO GRANDE', colaborador: 'Fulano', cargo: 'Vendedor' })

    await expect(obterImagem(3)).resolves.toMatchObject({
      unidade: { filial: '101', nomeFilial: 'CAMPO GRANDE', colaborador: 'Fulano', cargo: 'Vendedor' },
    })
  })

  it('tipo: da raiz; senão de unidade.tipo; senão "colaborador" com "id colaborador" e "filial" sem. "id colaborador" também vem de unidade.colaborador', async () => {
    const { tipo: _tipo, 'id colaborador': _id, ...semTipoNemId } = ana()
    const { tipo: _tipoFilial, ...filialSemTipo } = copiarImagem(IMAGEM_COMERCIAL_100_API) as unknown as Record<string, unknown>
    const unidadeSemTipo = { ...(semTipoNemId.unidade as Record<string, unknown>), tipo: undefined }
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(semTipoNemId),
      'GET /api/ped/imagens/4': () => respostaJson({ ...semTipoNemId, unidade: unidadeSemTipo, 'id colaborador': 11 }),
      'GET /api/ped/imagens/5': () => respostaJson({ ...filialSemTipo, unidade: { filial: { filial: '100', 'nome filial': 'MATRIZ' } } }),
    })

    await expect(obterImagem(3)).resolves.toMatchObject({ tipo: 'colaborador', idColaborador: 11 })
    await expect(obterImagem(4)).resolves.toMatchObject({ tipo: 'colaborador', idColaborador: 11 })
    await expect(obterImagem(5)).resolves.toMatchObject({ tipo: 'filial', idColaborador: null })
  })

  it('indicador: nome em "nome" quando falta "indicador"; realizado como { valor, "coleta disponivel" } (F10.8: sem coleta não é erro)', async () => {
    const api = ana()
    const { indicador: _indicador, ...semNome } = api.indicadores[0]
    const { 'coleta disponivel': _coleta, ...vendas } = api.indicadores[1]
    api.indicadores = [
      { ...semNome, nome: 'Custo de frete por entrega', realizado: { valor: 10 } },
      { ...vendas, realizado: { valor: null, 'coleta disponivel': false } },
    ]
    responder(api)

    const imagem = await obterImagem(3)

    expect(imagem.indicadores).toEqual(IMAGEM_ANA.indicadores)
  })

  it.each([
    ['"a"', 'a', 'A'],
    ['"B"', 'B', 'B'],
    ['"opcao a"', 'opcao a', 'A'],
    ['"Opção B"', 'Opção B', 'B'],
    ['desconhecida', 'c', null],
    ['ausente', undefined, null],
  ])('opção selecionada %s vira %s', async (_caso, valor, esperado) => {
    const api = ana()
    api.pontuacao['opcao selecionada'] = valor
    responder(api)

    await expect(obterImagem(3)).resolves.toMatchObject({ pontuacao: { opcaoSelecionada: esperado } })
  })

  it('pontuação sem "calculada" mas com os passos é calculada; pontuação ausente ou null não é calculada (sem motivo)', async () => {
    const comPassos = ana()
    delete comPassos.pontuacao.calculada
    const { pontuacao: _pontuacao, ...semPontuacao } = ana()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(comPassos),
      'GET /api/ped/imagens/4': () => respostaJson(semPontuacao),
      'GET /api/ped/imagens/5': () => respostaJson({ ...semPontuacao, pontuacao: null }),
    })

    await expect(obterImagem(3)).resolves.toMatchObject({ pontuacao: IMAGEM_ANA.pontuacao })
    await expect(obterImagem(4)).resolves.toMatchObject({ pontuacao: PONTUACAO_NAO_CALCULADA })
    await expect(obterImagem(5)).resolves.toMatchObject({ pontuacao: PONTUACAO_NAO_CALCULADA })
  })

  it('faixas: nome em "nome" ou "descricao"; sem "linhas" = []; ausentes = null', async () => {
    const comNome = ana()
    comNome.faixas = { versao: 3, nome: 'Régua única' } as unknown as ImagemApiEditavel['faixas']
    const { faixas: _faixas, ...semFaixas } = ana()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(comNome),
      'GET /api/ped/imagens/4': () => respostaJson(semFaixas),
    })

    await expect(obterImagem(3)).resolves.toMatchObject({ faixas: { nome: 'Régua única', versao: 3, linhas: [] } })
    await expect(obterImagem(4)).resolves.toMatchObject({ faixas: null })
  })

  it('pendências e avisos: textos e { mensagem } são lidos, outros itens ignorados; ausentes = []; resultado operacional ausente = null', async () => {
    const api = ana()
    api.pendencias = ['Visitas (10/2026): sem lançamento', { mensagem: 'Vitrine (10/2026): sem lançamento' }, 7, null]
    delete api.avisos
    delete api['resultado operacional']
    responder(api)

    await expect(obterImagem(3)).resolves.toMatchObject({
      pendencias: ['Visitas (10/2026): sem lançamento', 'Vitrine (10/2026): sem lançamento'],
      avisos: [],
      resultadoOperacional: null,
    })
  })

  it('resultado operacional com o indicador em { nome } e sem observação', async () => {
    const api = ana()
    api['resultado operacional'] = { indicador: { id: 20, nome: 'Faturamento' }, valor: 150000 }
    responder(api)

    await expect(obterImagem(3)).resolves.toMatchObject({ resultadoOperacional: { indicador: 'Faturamento', valor: 150000, observacao: null } })
  })

  it('imagem mínima (só o código): listas vazias, pontuação não calculada e os demais campos null', async () => {
    responder({ id: 3, codigo: 'IMG-000003' })

    await expect(obterImagem(3)).resolves.toEqual<ImagemCongelada>({
      id: 3,
      codigo: 'IMG-000003',
      lote: null,
      chave: null,
      tipo: 'filial',
      idColaborador: null,
      dashboard: null,
      periodo: null,
      unidade: { filial: null, nomeFilial: null, colaborador: null, cargo: null },
      resultadoOperacional: null,
      pedPercentual: null,
      pontosBaseTotal: null,
      indicadores: [],
      pontuacao: PONTUACAO_NAO_CALCULADA,
      faixas: null,
      pendencias: [],
      avisos: [],
      geradoEm: null,
      usuario: null,
    })
  })

  it.each<[string, (api: ImagemApiEditavel) => void]>([
    ['tipo desconhecido', (api) => (api.tipo = 'zona')],
    ['"indicadores" que não é lista', (api) => (api.indicadores = { indicador: 'Faturamento' } as never)],
    ['indicador sem nome', (api) => delete api.indicadores[0].indicador],
    ['meta em formato pt-BR', (api) => (api.indicadores[0].meta = '1.234,56')],
    ['"pontos base" booleano', (api) => (api.indicadores[0]['pontos base'] = true)],
    ['"ped percentual" em formato pt-BR', (api) => (api['ped percentual'] = '20,00')],
    ['valor da pontuação em texto não numérico', (api) => (api.pontuacao.valor = 'cento e cinquenta')],
    ['linha de faixa com "de" em formato pt-BR', (api) => (api.faixas!.linhas[0].de = '1.000,00')],
  ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, alterar) => {
    const api = ana()
    alterar(api)
    responder(api)

    await expect(obterImagem(3)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })
})
