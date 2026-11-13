/**
 * Fechamentos e imagens congeladas no formato da API (chaves com espaço), para os testes da F10
 * (RF-77 a RF-84). Ver `docs/backend/API (28).md`, seção "fase 7: fechamentos, cálculo e imagens
 * congeladas", e `docs/backend/FRONT-PED-mudancas (1).md`, item 8 (`tipo` e `id colaborador`).
 *
 * Linhas de `GET /api/ped/fechamentos` (`fechamentosApi()`, na ordem da API: periodicidade e nome):
 * - (2) PED Gerentes — cargos ["Gerente de Loja"], mensal, 11/2026, **aberto**; 2 unidades (Ana Souza,
 *   filial 100, e Diego Rocha, filial 102), nenhuma encerrada, 2 com pendências, progresso 1 de 4;
 *   indicador com problema "Custo de frete por entrega"; filial 102 sem tabela de faixas;
 * - (1) PED Comercial — filiais 100, 101 e 102, trimestral, 4º tri/2026, **aberto**; 3 unidades, 1
 *   encerrada (100), 1 com pendências (102), progresso 5 de 6; filial 102 sem tabela de faixas;
 * - (6) PED Vendedores — colaboradores [12, 13], anual, 2026, **encerrado** (2 de 2), progresso 0 de 0.
 *
 * Imagens congeladas (`GET /api/ped/imagens/{id}`; lista em `imagensApi()`):
 * - (1) IMG-000001 · ENC-000001 · PED Comercial · 3º tri/2026 · filial 100 MATRIZ (`tipo: filial`) —
 *   exemplo do negócio: Resultado Operacional 451.590,62; faixa atual 400.000,00–600.000,00 (1,95%),
 *   anterior 0–399.999,99 (2,21%); A = 8.840,00, B = 8.806,02, opção A, base 8.840,00; PED 99,99%
 *   → pontuação 8.839,12; faixas "Resultado operacional" v2 (3 linhas); por Ana Costa;
 * - (2) IMG-000002 · ENC-000001 · PED Comercial · 3º tri/2026 · filial 101 CAMPO GRANDE (`tipo: filial`)
 *   — sem tabela de faixas (`calculada: false`, motivo), Faturamento **sem meta** (`meta: null`) e
 *   Cobertura com lançamento **pendente** (realizado `null`, RN-09); PED 0; uma pendência e um aviso;
 * - (3) IMG-000003 · ENC-000002 · PED Gerentes · 10/2026 · colaborador 11 Ana Souza (Gerente de Loja),
 *   filial 100 (`tipo: colaborador`) — "Vendas por colaborador" de dado externo **sem coleta ainda**
 *   (`"coleta disponivel": false`, realizado `null`; não é erro — F10.8); resultado acima da última
 *   faixa (vale a última, sem anterior: alíquota anterior 0, opção B); PED 20 → pontuação 150; por admin;
 * - (4) IMG-000004 · ENC-000002 · PED Gerentes · 10/2026 · colaborador 14 Diego Rocha (Gerente de Loja),
 *   filial 102 (`tipo: colaborador`) — sem tabela de faixas; PED 16.
 *
 * Prévia (`GET /api/ped/fechamentos/{id}/previa`): dashboard 1 gera as imagens das filiais 101 e 102
 * (a 100 já foi encerrada); dashboard 2 gera as de Ana Souza e Diego Rocha (11/2026); dashboard 6 não
 * gera nenhuma. Cada imagem da prévia traz `chave` e o conteúdo da imagem, sem `id`, `codigo`, `lote`,
 * "gerado em" e `usuario`.
 *
 * Formatos assumidos enquanto a API não detalha (ver as dúvidas da F10 em `docs/plano-implementacao.md`):
 * - listas puras (o serviço também aceita `{ fechamentos }` e `{ imagens }`);
 * - detalhe da imagem na raiz (o serviço também aceita `{ imagem }`);
 * - `dashboard` da imagem como objeto `{ id, nome, periodicidade, "pontuacao maxima", "tipo de vinculo",
 *   "formula de pontuacao" }`; `periodo` como `{ codigo, inicio, fim }`; `unidade` como `{ tipo, filial:
 *   { filial, "nome filial" }, colaborador: { "id colaborador", nome, cargo } | null }`;
 * - `pontuacao` com os passos (`"faixa atual"`/`"faixa anterior"` como `{ de, ate, aliquota }`,
 *   `"opcao selecionada"` `"a"`/`"b"`) ou `{ calculada: false, motivo }`; `faixas` como
 *   `{ versao, descricao, linhas }`; `pendencias` e `avisos` como listas de textos;
 * - `resumo` com "imagens a gerar" e "unidades ja encerradas" numéricos e "unidades com pendencias" e
 *   "unidades sem tabela de faixas" como listas de códigos de filial;
 * - encerramento: `{ mensagem, lote, periodo, "imagens geradas" (número), resumo }`;
 * - linha da consulta de imagens com exatamente os campos do contrato (`id`, `codigo`, `lote`, `tipo`,
 *   "id colaborador", `dashboard` e `periodo` em texto, `filial` código, `colaborador` nome ou `null`,
 *   "gerado em", `usuario`, "ped percentual" e `pontuacao` número ou `null`), sem "nome filial" e cargo.
 */
import type { Periodicidade, SituacaoPeriodo, TipoVinculo } from '../types/dominio'
import type { RotaFalsa } from './apiFalsa'
import { respostaErro, respostaJson } from './apiFalsa'

// ---------------------------------------------------------------------------
// Tipos (formato da API)
// ---------------------------------------------------------------------------

export type TipoImagemApiFalso = 'filial' | 'colaborador'

export interface FaixaImagemApiFalsa {
  de: number
  ate: number
  aliquota: number
}

export interface FechamentoApiFalso {
  id: number
  nome: string
  'tipo de vinculo': TipoVinculo
  'itens vinculados': Array<string | number>
  periodicidade: Periodicidade
  'periodo atual': string
  'situacao do periodo': SituacaoPeriodo
  'unidades de imagem': number
  'unidades encerradas': number
  'unidades com pendencias': number
  progresso: { preenchidos: number; total: number }
  'indicadores com problema': string[]
  'unidades sem tabela de faixas': string[]
}

export interface DashboardDaImagemApiFalso {
  id: number | null
  nome: string
  periodicidade: Periodicidade
  'pontuacao maxima': number
  'tipo de vinculo': TipoVinculo
  'formula de pontuacao': string | null
}

export interface PeriodoDaImagemApiFalso {
  codigo: string
  inicio: string
  fim: string
}

export interface UnidadeDaImagemApiFalsa {
  tipo: TipoImagemApiFalso
  filial: { filial: string; 'nome filial': string }
  colaborador: { 'id colaborador': number; nome: string; cargo: string } | null
}

export interface IndicadorDaImagemApiFalso {
  indicador: string
  meta: number | null
  realizado: number | null
  atingimento: number | null
  'pontos base': number
  'pontos realizados': number | null
  observacao: string | null
  /** Dado externo de referência colaborador/zona ainda sem coleta (F10.8): `false`. */
  'coleta disponivel'?: boolean
}

export type PontuacaoDaImagemApiFalsa =
  | {
      calculada: true
      'faixa atual': FaixaImagemApiFalsa
      'faixa anterior': FaixaImagemApiFalsa | null
      'aliquota anterior': number
      'aliquota atual': number
      'piso da faixa': number
      'opcao a': number
      'opcao b': number
      'opcao selecionada': 'a' | 'b'
      'base de calculo': number
      valor: number
    }
  | { calculada: false; motivo: string }

export interface FaixasDaImagemApiFalsas {
  versao: number
  descricao: string | null
  linhas: FaixaImagemApiFalsa[]
}

/** Conteúdo da imagem (RF-83), comum à prévia e ao detalhe. */
export interface ConteudoImagemApiFalso {
  tipo: TipoImagemApiFalso
  'id colaborador': number | null
  dashboard: DashboardDaImagemApiFalso
  periodo: PeriodoDaImagemApiFalso
  unidade: UnidadeDaImagemApiFalsa
  'resultado operacional': { indicador: string; valor: number | null; observacao: string | null }
  'ped percentual': number
  'pontos base total': number
  indicadores: IndicadorDaImagemApiFalso[]
  pontuacao: PontuacaoDaImagemApiFalsa
  faixas: FaixasDaImagemApiFalsas | null
  pendencias: string[]
  avisos: string[]
}

/** Imagem gravada (`GET /api/ped/imagens/{id}`). */
export interface ImagemApiFalsa extends ConteudoImagemApiFalso {
  id: number
  codigo: string
  lote: string
  'gerado em': string
  usuario: string
}

/** Imagem da prévia: `chave` e o conteúdo, sem código, lote, data e usuário. */
export interface ImagemPreviaApiFalsa extends ConteudoImagemApiFalso {
  chave: string
}

/** Linha de `GET /api/ped/imagens` (só os campos do contrato). */
export interface ImagemDaListaApiFalsa {
  id: number
  codigo: string
  lote: string
  tipo: TipoImagemApiFalso
  'id colaborador': number | null
  dashboard: string
  periodo: string
  filial: string
  colaborador: string | null
  'gerado em': string
  usuario: string
  'ped percentual': number
  pontuacao: number | null
}

export interface ResumoFechamentoApiFalso {
  'imagens a gerar': number
  'unidades ja encerradas': number
  'unidades com pendencias': string[]
  'unidades sem tabela de faixas': string[]
  avisos: string[]
}

export interface PreviaFechamentoApiFalsa {
  dashboard: DashboardDaImagemApiFalso
  periodo: PeriodoDaImagemApiFalso
  resumo: ResumoFechamentoApiFalso
  imagens: ImagemPreviaApiFalsa[]
}

export interface EncerramentoApiFalso {
  mensagem: string
  lote: string
  periodo: string
  'imagens geradas': number
  resumo: ResumoFechamentoApiFalso
}

// ---------------------------------------------------------------------------
// Mensagens da API
// ---------------------------------------------------------------------------

/** `400` ao encerrar quando todas as unidades já têm imagem no período (RF-82). */
export const MENSAGEM_TODAS_ENCERRADAS = 'todas as unidades deste dashboard ja foram encerradas no periodo atual'
/** `400` na prévia/encerramento de dashboard que não está ativo (RN-17). */
export const MENSAGEM_DASHBOARD_NAO_ATIVO = 'o dashboard precisa estar ativo para o fechamento'
/** Mensagem de sucesso do encerramento. */
export const MENSAGEM_ENCERRAMENTO = 'periodo encerrado'

// ---------------------------------------------------------------------------
// Fechamentos
// ---------------------------------------------------------------------------

export const FECHAMENTO_GERENTES_API: FechamentoApiFalso = {
  id: 2,
  nome: 'PED Gerentes',
  'tipo de vinculo': 'cargos',
  'itens vinculados': ['Gerente de Loja'],
  periodicidade: 'mensal',
  'periodo atual': '11/2026',
  'situacao do periodo': 'aberto',
  'unidades de imagem': 2,
  'unidades encerradas': 0,
  'unidades com pendencias': 2,
  progresso: { preenchidos: 1, total: 4 },
  'indicadores com problema': ['Custo de frete por entrega'],
  'unidades sem tabela de faixas': ['102'],
}

export const FECHAMENTO_COMERCIAL_API: FechamentoApiFalso = {
  id: 1,
  nome: 'PED Comercial',
  'tipo de vinculo': 'filiais',
  'itens vinculados': ['100', '101', '102'],
  periodicidade: 'trimestral',
  'periodo atual': '4º tri/2026',
  'situacao do periodo': 'aberto',
  'unidades de imagem': 3,
  'unidades encerradas': 1,
  'unidades com pendencias': 1,
  progresso: { preenchidos: 5, total: 6 },
  'indicadores com problema': [],
  'unidades sem tabela de faixas': ['102'],
}

export const FECHAMENTO_VENDEDORES_API: FechamentoApiFalso = {
  id: 6,
  nome: 'PED Vendedores',
  'tipo de vinculo': 'colaboradores',
  'itens vinculados': [12, 13],
  periodicidade: 'anual',
  'periodo atual': '2026',
  'situacao do periodo': 'encerrado',
  'unidades de imagem': 2,
  'unidades encerradas': 2,
  'unidades com pendencias': 0,
  progresso: { preenchidos: 0, total: 0 },
  'indicadores com problema': [],
  'unidades sem tabela de faixas': [],
}

export function copiarFechamento(fechamento: FechamentoApiFalso): FechamentoApiFalso {
  return structuredClone(fechamento)
}

/** Lista de `GET /api/ped/fechamentos`, na ordem da API (periodicidade e nome). */
export function fechamentosApi(): FechamentoApiFalso[] {
  return [FECHAMENTO_GERENTES_API, FECHAMENTO_COMERCIAL_API, FECHAMENTO_VENDEDORES_API].map(copiarFechamento)
}

// ---------------------------------------------------------------------------
// Partes da imagem
// ---------------------------------------------------------------------------

export const DASHBOARD_COMERCIAL_IMAGEM_API: DashboardDaImagemApiFalso = {
  id: 1,
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  'pontuacao maxima': 100,
  'tipo de vinculo': 'filiais',
  'formula de pontuacao': 'Base de cálculo × PED (%) ÷ 100',
}

export const DASHBOARD_GERENTES_IMAGEM_API: DashboardDaImagemApiFalso = {
  id: 2,
  nome: 'PED Gerentes',
  periodicidade: 'mensal',
  'pontuacao maxima': 50,
  'tipo de vinculo': 'cargos',
  'formula de pontuacao': null,
}

export const PERIODO_3TRI_2026_API: PeriodoDaImagemApiFalso = { codigo: '3º tri/2026', inicio: '2026-07-01', fim: '2026-09-30' }
export const PERIODO_4TRI_2026_API: PeriodoDaImagemApiFalso = { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' }
export const PERIODO_10_2026_API: PeriodoDaImagemApiFalso = { codigo: '10/2026', inicio: '2026-10-01', fim: '2026-10-31' }
export const PERIODO_11_2026_API: PeriodoDaImagemApiFalso = { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' }

const FILIAL_100 = { filial: '100', 'nome filial': 'MATRIZ' }
const FILIAL_101 = { filial: '101', 'nome filial': 'CAMPO GRANDE' }
const FILIAL_102 = { filial: '102', 'nome filial': 'DOURADOS' }

/** Faixas do PED Comercial (v2) usadas no exemplo do negócio. */
export const FAIXAS_COMERCIAL_IMAGEM_API: FaixasDaImagemApiFalsas = {
  versao: 2,
  descricao: 'Resultado operacional',
  linhas: [
    { de: 0, ate: 399999.99, aliquota: 2.21 },
    { de: 400000, ate: 600000, aliquota: 1.95 },
    { de: 600000.01, ate: 1000000, aliquota: 1.5 },
  ],
}

/** Faixas do PED Gerentes na filial 100 (v1). */
export const FAIXAS_GERENTES_IMAGEM_API: FaixasDaImagemApiFalsas = {
  versao: 1,
  descricao: null,
  linhas: [{ de: 0, ate: 3000, aliquota: 0.5 }],
}

/** Pontuação do exemplo do negócio (P-10), com PED 99,99%. */
export const PONTUACAO_EXEMPLO_API: PontuacaoDaImagemApiFalsa = {
  calculada: true,
  'faixa atual': { de: 400000, ate: 600000, aliquota: 1.95 },
  'faixa anterior': { de: 0, ate: 399999.99, aliquota: 2.21 },
  'aliquota anterior': 2.21,
  'aliquota atual': 1.95,
  'piso da faixa': 400000,
  'opcao a': 8840,
  'opcao b': 8806.02,
  'opcao selecionada': 'a',
  'base de calculo': 8840,
  valor: 8839.12,
}

export const MOTIVO_SEM_FAIXA = 'unidade sem tabela de faixas'
export const PONTUACAO_SEM_FAIXA_API: PontuacaoDaImagemApiFalsa = { calculada: false, motivo: MOTIVO_SEM_FAIXA }

const INDICADORES_COMERCIAL_CALCULADO: IndicadorDaImagemApiFalso[] = [
  {
    indicador: 'Faturamento',
    meta: 400000,
    realizado: 451590.62,
    atingimento: 112.9,
    'pontos base': 60,
    'pontos realizados': 60,
    observacao: 'Pontos limitados aos pontos base',
  },
  {
    indicador: 'Cobertura de clientes',
    meta: 80,
    realizado: 79.98,
    atingimento: 99.98,
    'pontos base': 40,
    'pontos realizados': 39.99,
    observacao: null,
  },
]

const INDICADORES_COMERCIAL_SEM_META_E_PENDENTE: IndicadorDaImagemApiFalso[] = [
  {
    indicador: 'Faturamento',
    meta: null,
    realizado: 320000,
    atingimento: null,
    'pontos base': 60,
    'pontos realizados': null,
    observacao: 'Filial sem meta',
  },
  {
    indicador: 'Cobertura de clientes',
    meta: 80,
    realizado: null,
    atingimento: null,
    'pontos base': 40,
    'pontos realizados': null,
    observacao: 'Lançamento pendente: entrou sem valor',
  },
]

function indicadoresGerentes(realizadoFrete: number, atingimentoFrete: number, pontosFrete: number): IndicadorDaImagemApiFalso[] {
  return [
    {
      indicador: 'Custo de frete por entrega',
      meta: 12,
      realizado: realizadoFrete,
      atingimento: atingimentoFrete,
      'pontos base': 20,
      'pontos realizados': pontosFrete,
      observacao: 'Menor é melhor',
    },
    {
      indicador: 'Vendas por colaborador',
      meta: 50000,
      realizado: null,
      atingimento: null,
      'pontos base': 30,
      'pontos realizados': null,
      observacao: 'Sem coleta ainda',
      'coleta disponivel': false,
    },
  ]
}

function conteudoComercialCalculado(filial: typeof FILIAL_100, periodo: PeriodoDaImagemApiFalso): ConteudoImagemApiFalso {
  return {
    tipo: 'filial',
    'id colaborador': null,
    dashboard: { ...DASHBOARD_COMERCIAL_IMAGEM_API },
    periodo: { ...periodo },
    unidade: { tipo: 'filial', filial: { ...filial }, colaborador: null },
    'resultado operacional': { indicador: 'Faturamento', valor: 451590.62, observacao: 'Realizado do indicador base da faixa' },
    'ped percentual': 99.99,
    'pontos base total': 100,
    indicadores: structuredClone(INDICADORES_COMERCIAL_CALCULADO),
    pontuacao: structuredClone(PONTUACAO_EXEMPLO_API),
    faixas: structuredClone(FAIXAS_COMERCIAL_IMAGEM_API),
    pendencias: [],
    avisos: [],
  }
}

function conteudoComercialSemFaixa(filial: typeof FILIAL_100, periodo: PeriodoDaImagemApiFalso): ConteudoImagemApiFalso {
  return {
    tipo: 'filial',
    'id colaborador': null,
    dashboard: { ...DASHBOARD_COMERCIAL_IMAGEM_API },
    periodo: { ...periodo },
    unidade: { tipo: 'filial', filial: { ...filial }, colaborador: null },
    'resultado operacional': { indicador: 'Faturamento', valor: 320000, observacao: null },
    'ped percentual': 0,
    'pontos base total': 100,
    indicadores: structuredClone(INDICADORES_COMERCIAL_SEM_META_E_PENDENTE),
    pontuacao: { ...PONTUACAO_SEM_FAIXA_API },
    faixas: null,
    pendencias: [`Visitas a clientes (${periodo.codigo}): sem lançamento`],
    avisos: [`Filial ${filial.filial} sem tabela de faixas: sem pontuação`],
  }
}

function conteudoGerenteAna(periodo: PeriodoDaImagemApiFalso): ConteudoImagemApiFalso {
  return {
    tipo: 'colaborador',
    'id colaborador': 11,
    dashboard: { ...DASHBOARD_GERENTES_IMAGEM_API },
    periodo: { ...periodo },
    unidade: {
      tipo: 'colaborador',
      filial: { ...FILIAL_100 },
      colaborador: { 'id colaborador': 11, nome: 'Ana Souza', cargo: 'Gerente de Loja' },
    },
    'resultado operacional': { indicador: 'Faturamento', valor: 150000, observacao: null },
    'ped percentual': 20,
    'pontos base total': 50,
    indicadores: indicadoresGerentes(10, 120, 20),
    pontuacao: {
      calculada: true,
      'faixa atual': { de: 0, ate: 3000, aliquota: 0.5 },
      'faixa anterior': null,
      'aliquota anterior': 0,
      'aliquota atual': 0.5,
      'piso da faixa': 0,
      'opcao a': 0,
      'opcao b': 750,
      'opcao selecionada': 'b',
      'base de calculo': 750,
      valor: 150,
    },
    faixas: structuredClone(FAIXAS_GERENTES_IMAGEM_API),
    pendencias: [],
    avisos: ['Vendas por colaborador: sem coleta ainda'],
  }
}

function conteudoGerenteDiego(periodo: PeriodoDaImagemApiFalso): ConteudoImagemApiFalso {
  return {
    tipo: 'colaborador',
    'id colaborador': 14,
    dashboard: { ...DASHBOARD_GERENTES_IMAGEM_API },
    periodo: { ...periodo },
    unidade: {
      tipo: 'colaborador',
      filial: { ...FILIAL_102 },
      colaborador: { 'id colaborador': 14, nome: 'Diego Rocha', cargo: 'Gerente de Loja' },
    },
    'resultado operacional': { indicador: 'Faturamento', valor: 98000, observacao: null },
    'ped percentual': 16,
    'pontos base total': 50,
    indicadores: indicadoresGerentes(15, 80, 16),
    pontuacao: { ...PONTUACAO_SEM_FAIXA_API },
    faixas: null,
    pendencias: [],
    avisos: ['Filial 102 sem tabela de faixas: sem pontuação'],
  }
}

// ---------------------------------------------------------------------------
// Imagens gravadas
// ---------------------------------------------------------------------------

export const IMAGEM_COMERCIAL_100_API: ImagemApiFalsa = {
  id: 1,
  codigo: 'IMG-000001',
  lote: 'ENC-000001',
  ...conteudoComercialCalculado(FILIAL_100, PERIODO_3TRI_2026_API),
  'gerado em': '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
}

export const IMAGEM_COMERCIAL_101_SEM_FAIXA_API: ImagemApiFalsa = {
  id: 2,
  codigo: 'IMG-000002',
  lote: 'ENC-000001',
  ...conteudoComercialSemFaixa(FILIAL_101, PERIODO_3TRI_2026_API),
  'gerado em': '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
}

export const IMAGEM_GERENTES_ANA_API: ImagemApiFalsa = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  ...conteudoGerenteAna(PERIODO_10_2026_API),
  'gerado em': '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
}

export const IMAGEM_GERENTES_DIEGO_API: ImagemApiFalsa = {
  id: 4,
  codigo: 'IMG-000004',
  lote: 'ENC-000002',
  ...conteudoGerenteDiego(PERIODO_10_2026_API),
  'gerado em': '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
}

export function copiarImagem<T extends ConteudoImagemApiFalso>(imagem: T): T {
  return structuredClone(imagem)
}

/** Imagens gravadas (detalhe), em ordem de id. */
export function imagensDetalheApi(): ImagemApiFalsa[] {
  return [IMAGEM_COMERCIAL_100_API, IMAGEM_COMERCIAL_101_SEM_FAIXA_API, IMAGEM_GERENTES_ANA_API, IMAGEM_GERENTES_DIEGO_API].map(
    copiarImagem,
  )
}

/** Linha da consulta (`GET /api/ped/imagens`) correspondente a uma imagem gravada. */
export function imagemDaListaApi(imagem: ImagemApiFalsa): ImagemDaListaApiFalsa {
  return {
    id: imagem.id,
    codigo: imagem.codigo,
    lote: imagem.lote,
    tipo: imagem.tipo,
    'id colaborador': imagem['id colaborador'],
    dashboard: imagem.dashboard.nome,
    periodo: imagem.periodo.codigo,
    filial: imagem.unidade.filial.filial,
    colaborador: imagem.unidade.colaborador?.nome ?? null,
    'gerado em': imagem['gerado em'],
    usuario: imagem.usuario,
    'ped percentual': imagem['ped percentual'],
    pontuacao: imagem.pontuacao.calculada ? imagem.pontuacao.valor : null,
  }
}

/** Lista de `GET /api/ped/imagens` (sem filtros), na ordem da API (mais recentes primeiro). */
export function imagensApi(): ImagemDaListaApiFalsa[] {
  return imagensDetalheApi().reverse().map(imagemDaListaApi)
}

// ---------------------------------------------------------------------------
// Prévia e encerramento
// ---------------------------------------------------------------------------

function resumoApi(sobrescrever: Partial<ResumoFechamentoApiFalso> = {}): ResumoFechamentoApiFalso {
  return {
    'imagens a gerar': 0,
    'unidades ja encerradas': 0,
    'unidades com pendencias': [],
    'unidades sem tabela de faixas': [],
    avisos: [],
    ...sobrescrever,
  }
}

/** Resumo da prévia/encerramento do PED Comercial no 4º tri/2026 (101 e 102 a gerar; 100 encerrada). */
export function resumoComercialApi(): ResumoFechamentoApiFalso {
  return resumoApi({
    'imagens a gerar': 2,
    'unidades ja encerradas': 1,
    'unidades com pendencias': ['102'],
    'unidades sem tabela de faixas': ['102'],
    avisos: ['Lançamentos pendentes serão congelados sem valor.', 'Filial 102 sem tabela de faixas: sem pontuação.'],
  })
}

/** Resumo do PED Gerentes em 11/2026 (Ana e Diego a gerar). */
export function resumoGerentesApi(): ResumoFechamentoApiFalso {
  return resumoApi({
    'imagens a gerar': 2,
    'unidades com pendencias': ['100', '102'],
    'unidades sem tabela de faixas': ['102'],
    avisos: ['Lançamentos pendentes serão congelados sem valor.'],
  })
}

/** Prévia do PED Comercial (dashboard 1): imagens das filiais 101 (calculada) e 102 (sem faixas). */
export function previaComercialApi(): PreviaFechamentoApiFalsa {
  return {
    dashboard: { ...DASHBOARD_COMERCIAL_IMAGEM_API },
    periodo: { ...PERIODO_4TRI_2026_API },
    resumo: resumoComercialApi(),
    imagens: [
      { chave: 'filial:101', ...conteudoComercialCalculado(FILIAL_101, PERIODO_4TRI_2026_API) },
      { chave: 'filial:102', ...conteudoComercialSemFaixa(FILIAL_102, PERIODO_4TRI_2026_API) },
    ],
  }
}

/** Prévia do PED Gerentes (dashboard 2): imagens de Ana Souza (100) e Diego Rocha (102) em 11/2026. */
export function previaGerentesApi(): PreviaFechamentoApiFalsa {
  return {
    dashboard: { ...DASHBOARD_GERENTES_IMAGEM_API },
    periodo: { ...PERIODO_11_2026_API },
    resumo: resumoGerentesApi(),
    imagens: [
      { chave: 'colaborador:11', ...conteudoGerenteAna(PERIODO_11_2026_API) },
      { chave: 'colaborador:14', ...conteudoGerenteDiego(PERIODO_11_2026_API) },
    ],
  }
}

/** Resposta do encerramento (`POST .../encerrar`). */
export function respostaEncerramentoApi(sobrescrever: Partial<EncerramentoApiFalso> = {}): EncerramentoApiFalso {
  return {
    mensagem: MENSAGEM_ENCERRAMENTO,
    lote: 'ENC-000003',
    periodo: '4º tri/2026',
    'imagens geradas': 2,
    resumo: resumoComercialApi(),
    ...sobrescrever,
  }
}

// ---------------------------------------------------------------------------
// Back-end falso (testes de tela e de integração da F10)
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Filtro de `GET /api/ped/fechamentos`: `periodicidade`, `situacao` e `busca` (dashboard, grupo, período). */
export function filtrarFechamentosApi(lista: FechamentoApiFalso[], url: URL): FechamentoApiFalso[] {
  const periodicidade = url.searchParams.get('periodicidade')
  const situacao = url.searchParams.get('situacao')
  const busca = normalizar(url.searchParams.get('busca')?.trim() ?? '')
  return lista.filter((fechamento) => {
    const textos = [fechamento.nome, fechamento['periodo atual'], ...fechamento['itens vinculados'].map(String)]
    return (
      (periodicidade === null || periodicidade === fechamento.periodicidade) &&
      (situacao === null || situacao === fechamento['situacao do periodo']) &&
      (busca === '' || textos.some((texto) => normalizar(texto).includes(busca)))
    )
  })
}

/**
 * Filtro de `GET /api/ped/imagens`: `filial` (omitida ou `todas` = todas), `periodo`, `dashboard` (id),
 * `tipo`, `id_colaborador` e `busca` (dashboard, filial, código da imagem ou do lote, colaborador ou
 * usuário; sem diferenciar acentos e maiúsculas).
 */
export function filtrarImagensApi(lista: ImagemApiFalsa[], url: URL): ImagemApiFalsa[] {
  const filial = url.searchParams.get('filial')
  const periodo = url.searchParams.get('periodo')
  const dashboard = url.searchParams.get('dashboard')
  const tipo = url.searchParams.get('tipo')
  const idColaborador = url.searchParams.get('id_colaborador')
  const busca = normalizar(url.searchParams.get('busca')?.trim() ?? '')
  return lista.filter((imagem) => {
    const textos = [
      imagem.dashboard.nome,
      imagem.unidade.filial.filial,
      imagem.unidade.filial['nome filial'],
      imagem.codigo,
      imagem.lote,
      imagem.unidade.colaborador?.nome ?? '',
      imagem.usuario,
    ]
    return (
      (filial === null || filial === '' || filial === 'todas' || imagem.unidade.filial.filial === filial) &&
      (periodo === null || imagem.periodo.codigo === periodo) &&
      (dashboard === null || String(imagem.dashboard.id) === dashboard) &&
      (tipo === null || imagem.tipo === tipo) &&
      (idColaborador === null || String(imagem['id colaborador']) === idColaborador) &&
      (busca === '' || textos.some((texto) => normalizar(texto).includes(busca)))
    )
  })
}

export interface OpcoesApiFechamentosFalsa {
  fechamentos?: FechamentoApiFalso[]
  imagens?: ImagemApiFalsa[]
  /** Usuário gravado nas imagens geradas pelo encerramento. */
  usuario?: string
  /** Data gravada nas imagens geradas pelo encerramento. */
  geradoEm?: string
}

/**
 * Back-end falso dos fechamentos e imagens, em memória:
 * - `GET /api/ped/fechamentos` (filtros `periodicidade`, `situacao` e `busca`);
 * - `GET /api/ped/fechamentos/{id}/previa` (1: `previaComercialApi`, 2: `previaGerentesApi`, demais
 *   e já encerrados: sem imagens a gerar); id desconhecido = `404`;
 * - `POST /api/ped/fechamentos/{id}/encerrar`: grava as imagens da prévia com código `IMG-` e lote
 *   `ENC-` sequenciais (a partir de `IMG-000005` e `ENC-000003`), marca o período como encerrado e
 *   responde `{ mensagem, lote, periodo, "imagens geradas", resumo }`; sem imagens a gerar = `400`
 *   (`MENSAGEM_TODAS_ENCERRADAS`); os outros dashboards não mudam (RF-81);
 * - `GET /api/ped/imagens` (filtros de `filtrarImagensApi`, mais recentes primeiro) e
 *   `GET /api/ped/imagens/{id}` (`404` se não existir).
 * Devolve as rotas e leitores do estado atual.
 */
export function criarApiFechamentosFalsa(opcoes: OpcoesApiFechamentosFalsa = {}) {
  let fechamentos = (opcoes.fechamentos ?? fechamentosApi()).map(copiarFechamento)
  let imagens = (opcoes.imagens ?? imagensDetalheApi()).map(copiarImagem)
  const encerrados = new Set<number>(fechamentos.filter((f) => f['situacao do periodo'] === 'encerrado').map((f) => f.id))
  const usuario = opcoes.usuario ?? 'Fulano'
  const geradoEm = opcoes.geradoEm ?? '2026-11-13 10:00:00-04:00'
  let proximaImagem = Math.max(4, ...imagens.map((imagem) => imagem.id)) + 1
  let proximoLote = 3

  const codigo = (prefixo: string, numero: number) => `${prefixo}-${String(numero).padStart(6, '0')}`

  function previaDe(id: number): PreviaFechamentoApiFalsa | null {
    const fechamento = fechamentos.find((f) => f.id === id)
    if (!fechamento) return null
    if (!encerrados.has(id) && id === 1) return previaComercialApi()
    if (!encerrados.has(id) && id === 2) return previaGerentesApi()
    return {
      dashboard: {
        id: fechamento.id,
        nome: fechamento.nome,
        periodicidade: fechamento.periodicidade,
        'pontuacao maxima': 100,
        'tipo de vinculo': fechamento['tipo de vinculo'],
        'formula de pontuacao': null,
      },
      periodo: { codigo: fechamento['periodo atual'], inicio: '', fim: '' },
      resumo: resumoApi({ 'unidades ja encerradas': fechamento['unidades encerradas'] }),
      imagens: [],
    }
  }

  const rotas: Record<string, RotaFalsa> = {
    'GET /api/ped/fechamentos': (_init, url) => respostaJson(filtrarFechamentosApi(fechamentos, url)),
    'GET /api/ped/imagens': (_init, url) =>
      respostaJson(filtrarImagensApi([...imagens].reverse(), url).map(imagemDaListaApi)),
  }

  for (const fechamento of fechamentos) {
    const id = fechamento.id
    rotas[`GET /api/ped/fechamentos/${id}/previa`] = () => respostaJson(previaDe(id))
    rotas[`POST /api/ped/fechamentos/${id}/encerrar`] = () => {
      const previa = previaDe(id)!
      if (previa.imagens.length === 0) return respostaErro(400, MENSAGEM_TODAS_ENCERRADAS)
      const lote = codigo('ENC', proximoLote++)
      const novas: ImagemApiFalsa[] = previa.imagens.map(({ chave: _chave, ...conteudo }) => {
        const numero = proximaImagem++
        return { id: numero, codigo: codigo('IMG', numero), lote, ...conteudo, 'gerado em': geradoEm, usuario }
      })
      imagens = [...imagens, ...novas]
      encerrados.add(id)
      fechamentos = fechamentos.map((item) =>
        item.id === id
          ? {
              ...item,
              'situacao do periodo': 'encerrado',
              'unidades encerradas': item['unidades de imagem'],
              'unidades com pendencias': 0,
              progresso: { preenchidos: 0, total: 0 },
            }
          : item,
      )
      registrarRotasDeImagem(novas)
      return respostaJson(
        respostaEncerramentoApi({ lote, periodo: previa.periodo.codigo, 'imagens geradas': novas.length, resumo: previa.resumo }),
      )
    }
  }

  function registrarRotasDeImagem(lista: ImagemApiFalsa[]) {
    for (const imagem of lista) {
      rotas[`GET /api/ped/imagens/${imagem.id}`] = () => {
        const atual = imagens.find((item) => item.id === imagem.id)
        return atual ? respostaJson(atual) : respostaErro(404, 'recurso nao encontrado')
      }
    }
  }
  registrarRotasDeImagem(imagens)

  return {
    rotas,
    fechamentos: () => fechamentos,
    imagens: () => imagens,
  }
}
