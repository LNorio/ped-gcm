/**
 * Tela Início no formato da API (chaves com espaço), para os testes da F11 (RF-06 a RF-11).
 * Ver `docs/backend/API (28).md`, seção "Cadastro e Preenchimento — fase 9: tela Início".
 *
 * `GET /api/ped/inicio` devolve tudo numa chamada só. O Admin pode informar `?filial=<código>` (omitir
 * ou `todas` = todas as filiais; código inexistente = `404`); os demais perfis usam sempre a própria
 * filial (o parâmetro é ignorado pela API).
 *
 * Respostas (`criarApiInicioFalsa`):
 * - **Admin, todas as filiais** (`inicioAdminApi`): aviso de acesso `null`; resumo com os 5 indicadores do
 *   Admin (pendentes 1.234); 3 períodos em aberto (PED Comercial trimestral 5 de 9, PED Gerentes mensal
 *   1 de 4, PED Vendedores anual **encerrado**, 0 de 0); 6 últimas alterações (filiais 100, 101 e 102,
 *   com lançamento sem valor anterior, correção numérica e correção booleana);
 * - **Admin, filial 101** (`inicioAdminFilial101Api`): resumo com outros valores (pendentes 3), só o
 *   PED Comercial (2 de 3) e duas alterações da filial 101;
 * - **Admin, filial 102**: `404` (filial sem cadastro, para exercitar o erro);
 * - **Validador** (`inicioValidadorApi`): aviso de acesso `null`; resumo com os 5 indicadores do
 *   Validador; 2 períodos; 1 alteração;
 * - **Preenchedor** (`inicioPreenchedorApi`): filial 101; aviso de acesso com os tipos Comercial e
 *   Logística e a filial "101 - CAMPO GRANDE"; resumo com 4 indicadores (sem "Dashboards ativos");
 *   1 período (PED Comercial 2 de 3); sem alterações.
 *
 * Formatos assumidos onde o contrato não detalha: datas `aaaa-mm-dd hh:mm:ss`; `rotulo` do resumo já em
 * pt-BR com acentos; `filial` das alterações como código em texto.
 */
import type { AcessoApiFalso, RotaFalsa } from './apiFalsa'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson } from './apiFalsa'

// ---------------------------------------------------------------------------
// Tipos (formato da API)
// ---------------------------------------------------------------------------

export type PerfilInicioApiFalso = 'admin' | 'validador' | 'preenchedor'

export interface FilialInicioApiFalsa {
  filial: string | number
  'nome filial': string
}

export interface PeriodoAbertoInicioApiFalso {
  'mes de referencia': string
  'aberto por': string | null
  'aberto em': string | null
  aviso: string | null
}

export interface AvisoDeAcessoApiFalso {
  tipo: string
  mensagem: string | null
  tipos?: string[]
  filiais?: string[]
}

export interface ItemResumoApiFalso {
  chave: string
  rotulo: string
  valor: number
}

export interface PeriodoEmAbertoApiFalso {
  id: number
  nome: string
  periodicidade: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  'periodo atual': string
  'periodo encerrado': boolean
  'filiais abertas': number
  progresso: { preenchidos: number; total: number }
}

export interface UltimaAlteracaoApiFalsa {
  acao: 'lancamento' | 'correcao'
  apontamento: string
  competencia: string
  filial: string | number
  'valor anterior': number | boolean | null
  'valor novo': number | boolean | null
  data: string
  usuario: string | null
}

export interface InicioApiFalso {
  perfil: PerfilInicioApiFalso
  filiais: FilialInicioApiFalsa[]
  'periodo aberto': PeriodoAbertoInicioApiFalso | null
  'aviso de acesso': AvisoDeAcessoApiFalso | null
  resumo: ItemResumoApiFalso[]
  'periodos em aberto': PeriodoEmAbertoApiFalso[]
  'ultimas alteracoes': UltimaAlteracaoApiFalsa[]
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

export const FILIAIS_INICIO_API: FilialInicioApiFalsa[] = [
  { filial: '100', 'nome filial': 'MATRIZ' },
  { filial: '101', 'nome filial': 'CAMPO GRANDE' },
  { filial: '102', 'nome filial': 'DOURADOS' },
]

export const PERIODO_ABERTO_API: PeriodoAbertoInicioApiFalso = {
  'mes de referencia': '2026-10-01',
  'aberto por': 'Ana Costa',
  'aberto em': '2026-10-01 08:00:00',
  aviso: 'Somente um periodo fica aberto por vez.',
}

/** Texto do aviso do período aberto (RF-06) para outubro de 2026. */
export const TEXTO_AVISO_PERIODO = 'Período aberto para preenchimento: 10/2026. Apenas um período fica aberto por vez.'

/** Texto do aviso de acesso do Preenchedor de `inicioPreenchedorApi` (RF-07). */
export const TEXTO_AVISO_PREENCHEDOR =
  'Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, Logística, somente na filial 101 - CAMPO GRANDE.'

export const AVISO_ACESSO_PREENCHEDOR_API: AvisoDeAcessoApiFalso = {
  tipo: 'preenchedor',
  mensagem: 'Voce acessa apenas os seus tipos e filiais.',
  tipos: ['Comercial', 'Logística'],
  filiais: ['101 - CAMPO GRANDE'],
}

export const RESUMO_ADMIN_API: ItemResumoApiFalso[] = [
  { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
  { chave: 'dados externos ativos', rotulo: 'Dados externos ativos', valor: 5 },
  { chave: 'total de indicadores', rotulo: 'Total de indicadores', valor: 8 },
  { chave: 'dados externos em construcao', rotulo: 'Dados externos em construção (TI)', valor: 2 },
  { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1234 },
]

export const RESUMO_ADMIN_101_API: ItemResumoApiFalso[] = [
  { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
  { chave: 'dados externos ativos', rotulo: 'Dados externos ativos', valor: 5 },
  { chave: 'total de indicadores', rotulo: 'Total de indicadores', valor: 8 },
  { chave: 'dados externos em construcao', rotulo: 'Dados externos em construção (TI)', valor: 2 },
  { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 3 },
]

export const RESUMO_VALIDADOR_API: ItemResumoApiFalso[] = [
  { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
  { chave: 'dashboards com meus apontamentos', rotulo: 'Dashboards com meus apontamentos', valor: 3 },
  { chave: 'meus dados externos em construcao', rotulo: 'Meus dados externos em construção (TI)', valor: 1 },
  { chave: 'dashboards ativos', rotulo: 'Dashboards ativos', valor: 4 },
  { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 9 },
]

export const RESUMO_PREENCHEDOR_API: ItemResumoApiFalso[] = [
  { chave: 'apontamentos dos meus tipos', rotulo: 'Apontamentos dos meus tipos', valor: 3 },
  { chave: 'dashboards com meus apontamentos', rotulo: 'Dashboards com meus apontamentos', valor: 1 },
  { chave: 'meus dados externos em construcao', rotulo: 'Meus dados externos em construção (TI)', valor: 0 },
  { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1 },
]

export const PERIODO_COMERCIAL_API: PeriodoEmAbertoApiFalso = {
  id: 1,
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  'periodo atual': '4º tri/2026',
  'periodo encerrado': false,
  'filiais abertas': 3,
  progresso: { preenchidos: 5, total: 9 },
}

export const PERIODO_GERENTES_API: PeriodoEmAbertoApiFalso = {
  id: 2,
  nome: 'PED Gerentes',
  periodicidade: 'mensal',
  'periodo atual': '10/2026',
  'periodo encerrado': false,
  'filiais abertas': 2,
  progresso: { preenchidos: 1, total: 4 },
}

export const PERIODO_VENDEDORES_ENCERRADO_API: PeriodoEmAbertoApiFalso = {
  id: 6,
  nome: 'PED Vendedores',
  periodicidade: 'anual',
  'periodo atual': '2026',
  'periodo encerrado': true,
  'filiais abertas': 0,
  progresso: { preenchidos: 0, total: 0 },
}

export const PERIODO_COMERCIAL_101_API: PeriodoEmAbertoApiFalso = {
  ...PERIODO_COMERCIAL_API,
  'filiais abertas': 1,
  progresso: { preenchidos: 2, total: 3 },
}

/** 6 alterações mais recentes (todas as filiais), da mais recente para a mais antiga. */
export const ULTIMAS_ADMIN_API: UltimaAlteracaoApiFalsa[] = [
  {
    acao: 'correcao',
    apontamento: 'Cobertura de clientes',
    competencia: '2026-10-01',
    filial: '101',
    'valor anterior': 5,
    'valor novo': 6.5,
    data: '2026-11-12 14:30:00',
    usuario: 'Ana Costa',
  },
  {
    acao: 'lancamento',
    apontamento: 'Faturamento líquido',
    competencia: '2026-10-01',
    filial: '100',
    'valor anterior': null,
    'valor novo': 451590.62,
    data: '2026-11-12 10:05:00',
    usuario: 'Bruno Lima',
  },
  {
    acao: 'correcao',
    apontamento: 'Loja auditada',
    competencia: '2026-10-01',
    filial: '102',
    'valor anterior': false,
    'valor novo': true,
    data: '2026-11-11 17:45:00',
    usuario: 'Carla Dias',
  },
  {
    acao: 'lancamento',
    apontamento: 'Ruptura de gôndola',
    competencia: '2026-10-01',
    filial: '101',
    'valor anterior': null,
    'valor novo': 3,
    data: '2026-11-11 09:00:00',
    usuario: 'Ana Costa',
  },
  {
    acao: 'lancamento',
    apontamento: 'Devoluções',
    competencia: '2026-10-01',
    filial: '102',
    'valor anterior': null,
    'valor novo': 12,
    data: '2026-11-10 16:20:00',
    usuario: 'Diego Rocha',
  },
  {
    acao: 'lancamento',
    apontamento: 'Treinamentos realizados',
    competencia: '2026-09-01',
    filial: '100',
    'valor anterior': null,
    'valor novo': 4,
    data: '2026-11-10 08:10:00',
    usuario: 'Bruno Lima',
  },
]

export const ULTIMAS_ADMIN_101_API: UltimaAlteracaoApiFalsa[] = [ULTIMAS_ADMIN_API[0], ULTIMAS_ADMIN_API[3]]

export const ULTIMAS_VALIDADOR_API: UltimaAlteracaoApiFalsa[] = [ULTIMAS_ADMIN_API[2]]

// ---------------------------------------------------------------------------
// Fábricas
// ---------------------------------------------------------------------------

export function inicioAdminApi(sobrescrever: Partial<InicioApiFalso> = {}): InicioApiFalso {
  return {
    perfil: 'admin',
    filiais: FILIAIS_INICIO_API,
    'periodo aberto': PERIODO_ABERTO_API,
    'aviso de acesso': null,
    resumo: RESUMO_ADMIN_API,
    'periodos em aberto': [PERIODO_COMERCIAL_API, PERIODO_GERENTES_API, PERIODO_VENDEDORES_ENCERRADO_API],
    'ultimas alteracoes': ULTIMAS_ADMIN_API,
    ...sobrescrever,
  }
}

export function inicioAdminFilial101Api(sobrescrever: Partial<InicioApiFalso> = {}): InicioApiFalso {
  return inicioAdminApi({
    filiais: [FILIAIS_INICIO_API[1]],
    resumo: RESUMO_ADMIN_101_API,
    'periodos em aberto': [PERIODO_COMERCIAL_101_API],
    'ultimas alteracoes': ULTIMAS_ADMIN_101_API,
    ...sobrescrever,
  })
}

export function inicioValidadorApi(sobrescrever: Partial<InicioApiFalso> = {}): InicioApiFalso {
  return {
    perfil: 'validador',
    filiais: FILIAIS_INICIO_API,
    'periodo aberto': PERIODO_ABERTO_API,
    'aviso de acesso': null,
    resumo: RESUMO_VALIDADOR_API,
    'periodos em aberto': [PERIODO_COMERCIAL_API, PERIODO_GERENTES_API],
    'ultimas alteracoes': ULTIMAS_VALIDADOR_API,
    ...sobrescrever,
  }
}

export function inicioPreenchedorApi(sobrescrever: Partial<InicioApiFalso> = {}): InicioApiFalso {
  return {
    perfil: 'preenchedor',
    filiais: [FILIAIS_INICIO_API[1]],
    'periodo aberto': PERIODO_ABERTO_API,
    'aviso de acesso': AVISO_ACESSO_PREENCHEDOR_API,
    resumo: RESUMO_PREENCHEDOR_API,
    'periodos em aberto': [PERIODO_COMERCIAL_101_API],
    'ultimas alteracoes': [],
    ...sobrescrever,
  }
}

export const MENSAGEM_FILIAL_INEXISTENTE = 'Filial nao encontrada.'

/**
 * Rota `GET /api/ped/inicio` simulada para o perfil informado. O Admin responde pela `?filial=`:
 * sem filial ou `todas` → `inicioAdminApi()`; `101` → `inicioAdminFilial101Api()`; outra → `404`.
 * Validador e Preenchedor ignoram o parâmetro (como a API).
 */
export function rotaInicioFalsa(perfil: PerfilInicioApiFalso): RotaFalsa {
  return (_init, url) => {
    if (perfil === 'validador') return respostaJson(inicioValidadorApi())
    if (perfil === 'preenchedor') return respostaJson(inicioPreenchedorApi())
    const filial = url.searchParams.get('filial')
    if (filial === null || filial === 'todas') return respostaJson(inicioAdminApi())
    if (filial === '101') return respostaJson(inicioAdminFilial101Api())
    return respostaErro(404, MENSAGEM_FILIAL_INEXISTENTE)
  }
}

/** Rotas da tela Início para `simularApi` (só `GET /api/ped/inicio`; o acesso fica por conta do teste). */
export function criarApiInicioFalsa(perfil: PerfilInicioApiFalso): Record<string, RotaFalsa> {
  return { 'GET /api/ped/inicio': rotaInicioFalsa(perfil) }
}

/**
 * Acesso (`GET /api/ped/acesso`) usado nos testes de integração do Início: Admin e Validador com todas as
 * filiais (A-03; o cabeçalho começa em "Todas as filiais"); Preenchedor só com a filial 101.
 */
export function acessoDoInicio(perfil: PerfilInicioApiFalso): AcessoApiFalso {
  return perfil === 'preenchedor'
    ? acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
    : acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
}

/** Rotas de sessão + Início para `simularApi`; `extras` substitui ou acrescenta rotas. */
export function rotasDoInicio(perfil: PerfilInicioApiFalso, extras: Record<string, RotaFalsa> = {}): Record<string, RotaFalsa> {
  return {
    'GET /api/ped/acesso': () => respostaJson(acessoDoInicio(perfil)),
    ...criarApiInicioFalsa(perfil),
    ...extras,
  }
}

/** Promessa controlada pelo teste (para segurar uma resposta). */
export function adiado<T>(): { promessa: Promise<T>; resolver: (valor: T) => void } {
  let resolver!: (valor: T) => void
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}
