/**
 * Tipos do domínio do PED (INT-02).
 *
 * Enumerações como arrays `as const` (ordem de exibição), rótulos em pt-BR e as interfaces das
 * entidades no formato usado pela aplicação (camelCase). O formato da API (chaves com espaço) fica
 * restrito aos adaptadores em `src/services/adaptadores.ts`.
 */

// ---------------------------------------------------------------------------
// Enumerações e rótulos
// ---------------------------------------------------------------------------

export const PERFIS = ['admin', 'validador', 'preenchedor'] as const
export type Perfil = (typeof PERFIS)[number]
export const ROTULOS_PERFIL: Readonly<Record<Perfil, string>> = {
  admin: 'Admin',
  validador: 'Validador',
  preenchedor: 'Preenchedor',
}

export const TIPOS_VALOR = ['porcentagem', 'numeral', 'booleano'] as const
export type TipoValor = (typeof TIPOS_VALOR)[number]
export const ROTULOS_TIPO_VALOR: Readonly<Record<TipoValor, string>> = {
  porcentagem: 'Porcentagem',
  numeral: 'Numeral',
  booleano: 'Booleano',
}

export const PERIODICIDADES = ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] as const
export type Periodicidade = (typeof PERIODICIDADES)[number]
export const ROTULOS_PERIODICIDADE: Readonly<Record<Periodicidade, string>> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

/** Sentido do indicador: se um resultado maior ou menor é o melhor. */
export const SENTIDOS = ['maior_melhor', 'menor_melhor'] as const
export type Sentido = (typeof SENTIDOS)[number]
export const ROTULOS_SENTIDO: Readonly<Record<Sentido, string>> = {
  maior_melhor: 'Maior é melhor',
  menor_melhor: 'Menor é melhor (custo)',
}

/** Cálculo do indicador composto por apontamentos. */
export const CALCULOS = ['soma', 'media'] as const
export type Calculo = (typeof CALCULOS)[number]
export const ROTULOS_CALCULO: Readonly<Record<Calculo, string>> = {
  soma: 'Soma',
  media: 'Média',
}

/** Sentido do cálculo do dado externo ao longo da janela retroativa. */
export const SENTIDOS_CALCULO = ['soma', 'media', 'ultimo'] as const
export type SentidoCalculo = (typeof SENTIDOS_CALCULO)[number]
export const ROTULOS_SENTIDO_CALCULO: Readonly<Record<SentidoCalculo, string>> = {
  soma: 'Somar',
  media: 'Fazer a média',
  ultimo: 'Usar só o último valor',
}

/** Referência do dado externo (a API usa `zona` para "Zona de venda"). */
export const REFERENCIAS = ['filial', 'colaborador', 'zona'] as const
export type Referencia = (typeof REFERENCIAS)[number]
export const ROTULOS_REFERENCIA: Readonly<Record<Referencia, string>> = {
  filial: 'Filial',
  colaborador: 'Colaborador',
  zona: 'Zona de venda',
}

export const SISTEMAS_ORIGEM = ['senior_erp', 'senior_hcm', 'bitrix24', 'outro'] as const
export type SistemaOrigem = (typeof SISTEMAS_ORIGEM)[number]
export const ROTULOS_SISTEMA_ORIGEM: Readonly<Record<SistemaOrigem, string>> = {
  senior_erp: 'Senior ERP (Sapiens)',
  senior_hcm: 'Senior HCM',
  bitrix24: 'Bitrix24',
  outro: 'Outro sistema',
}

export const COLETAS = ['diaria', 'dia do mes'] as const
export type Coleta = (typeof COLETAS)[number]
export const ROTULOS_COLETA: Readonly<Record<Coleta, string>> = {
  diaria: 'Diária',
  'dia do mes': 'Data específica do mês',
}

/** Janela retroativa em meses: 1 = somente o mês de referência. */
export const JANELAS_RETROATIVAS = [1, 2, 3, 6, 12, 24] as const
export type JanelaRetroativa = (typeof JANELAS_RETROATIVAS)[number]

export const SITUACOES_DADO_EXTERNO = ['ativo', 'inativo', 'em_construcao'] as const
export type SituacaoDadoExterno = (typeof SITUACOES_DADO_EXTERNO)[number]
export const ROTULOS_SITUACAO_DADO_EXTERNO: Readonly<Record<SituacaoDadoExterno, string>> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_construcao: 'Em construção (TI)',
}

export const SITUACOES_DASHBOARD = ['ativo', 'inativo', 'em_construcao', 'em_modificacao'] as const
export type SituacaoDashboard = (typeof SITUACOES_DASHBOARD)[number]
export const ROTULOS_SITUACAO_DASHBOARD: Readonly<Record<SituacaoDashboard, string>> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_construcao: 'Em construção (TI)',
  em_modificacao: 'Em modificação (TI)',
}

export const TIPOS_VINCULO = ['filiais', 'cargos', 'colaboradores'] as const
export type TipoVinculo = (typeof TIPOS_VINCULO)[number]
export const ROTULOS_TIPO_VINCULO: Readonly<Record<TipoVinculo, string>> = {
  filiais: 'Filiais',
  cargos: 'Cargos',
  colaboradores: 'Colaboradores',
}

/** Situação do período atual de um dashboard nos fechamentos. */
export const SITUACOES_PERIODO = ['aberto', 'encerrado'] as const
export type SituacaoPeriodo = (typeof SITUACOES_PERIODO)[number]

/** Origem da meta do indicador (hoje só `manual` é aceita pela API). */
export const ORIGENS_META = ['manual', 'terceiro'] as const
export type OrigemMeta = (typeof ORIGENS_META)[number]

/** Tipo da composição do indicador. */
export const TIPOS_COMPOSICAO = ['apontamentos', 'dado_externo'] as const
export type TipoComposicao = (typeof TIPOS_COMPOSICAO)[number]

// ---------------------------------------------------------------------------
// Entidades (formato da aplicação)
// ---------------------------------------------------------------------------

/** Data/hora no formato devolvido pela API (`aaaa-mm-dd` ou `aaaa-mm-dd hh:mm:ss`). */
export type DataApi = string

/** Referência curta a outra entidade (ex.: tipo de apontamento, indicador vinculado). */
export interface ReferenciaNomeada {
  id: number
  nome: string
}

export interface Filial {
  codigo: string
  nome: string
  /** Código da empresa; `null` quando a API não informa (ex.: `GET /api/ped/acesso`). */
  empresa: string | null
}

/** Resposta de `GET /api/ped/acesso`: dados do usuário logado no PED. */
export interface Acesso {
  idColaborador: number
  nome: string
  /** `null` quando o usuário não tem acesso ao PED. */
  perfil: Perfil | null
  tipos: ReferenciaNomeada[]
  todasAsFiliais: boolean
  filiais: Filial[]
  periodoAberto: DataApi | null
}

/** Período (mês) aberto para preenchimento. */
export interface Periodo {
  mesDeReferencia: DataApi
  abertoPor: string | null
  abertoEm: DataApi | null
}

/** Origem de um tipo de apontamento: nasce na migration (`Fixo`) ou foi criado pelo Admin (`Personalizado`). */
export type OrigemTipo = 'Fixo' | 'Personalizado'

export interface TipoApontamento {
  id: number
  nome: string
  origem: OrigemTipo
  quantidadeUsuarios: number
  quantidadeApontamentos: number
}

/** Campos de auditoria comuns a apontamentos, dados externos e indicadores. */
export interface Auditoria {
  cadastradoEm: DataApi | null
  cadastradoPor: string | null
  situacaoAlteradaEm: DataApi | null
  situacaoAlteradaPor: string | null
}

export interface Apontamento extends Auditoria {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  idTipo: number
  tipo: string
  tipoValor: TipoValor
  indicadores: ReferenciaNomeada[]
  vinculadoADashboard: boolean
  desativadoMasUsadoEmIndicadorAtivo: boolean
}

/** Tarefa registrada para a equipe de TI (Bitrix24). */
export interface TarefaBitrix {
  id: number
  /** Ex.: `aguardando_envio`, `concluida`. */
  status: string
  titulo: string
}

export interface DadoExterno extends Auditoria {
  id: number
  nome: string
  idTipo: number
  tipo: string
  situacao: SituacaoDadoExterno
  situacaoDescricao: string
  tarefaBitrix: TarefaBitrix | null
  sistemaOrigem: SistemaOrigem
  /** `null` = a definir pela TI. */
  identificador: string | null
  campoCalculo: string | null
  referencia: Referencia
  coleta: Coleta
  diaDaColeta: number | null
  coletaDescricao: string | null
  sentidoCalculo: SentidoCalculo
  /** `null` quando o sentido do cálculo é `ultimo`. */
  janelaRetroativa: JanelaRetroativa | null
  comentarios: string | null
  tipoValor: TipoValor
  /** O identificador tem coleta cadastrada no backend. */
  coletaDisponivel: boolean
  /** Nomes dos indicadores que o dado externo compõe (a API devolve só o nome na listagem). */
  indicadores: string[]
}

/** Tarefa gerada para a TI ao pedir a construção de um dado externo (POST de Validador/Preenchedor). */
export interface TarefaConstrucao {
  /** `null` quando a tarefa ainda não foi registrada no Bitrix24. */
  id: number | null
  status: string | null
  titulo: string
  descricao: string | null
}

/** Coleta existente que um identificador pode apontar, com quantos dados externos já a usam. */
export interface IdentificadorColeta {
  identificador: string
  quantidade: number
}

/** Valor de um mês considerado no realizado de um dado externo. */
export interface MesConsiderado {
  mes: DataApi
  valor: number
}

/** Realizado de um dado externo em uma filial e mês (RN-05). */
export interface RealizadoDadoExterno {
  /** `null` sem valores no período ou sem coleta disponível. */
  valor: number | null
  mesesConsiderados: MesConsiderado[]
  janelaRetroativa: JanelaRetroativa | null
  sentidoCalculo: SentidoCalculo
  coletaDisponivel: boolean
}

export interface ComponenteIndicador {
  id: number
  nome: string
  ativo: boolean
}

export interface ComposicaoIndicador {
  tipo: TipoComposicao
  itens: ComponenteIndicador[]
}

/** Problema de componente desativado (RF-40). */
export interface ProblemaIndicador {
  /** `dado_externo_desativado`, `todos_apontamentos_desativados` ou `apontamentos_parcialmente_desativados`. */
  tipo: string
  mensagem: string
}

export interface DashboardDoIndicador {
  id: number
  nome: string
  pontosBase: number
}

export interface Indicador extends Auditoria {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  composicao: ComposicaoIndicador
  tipos: string[]
  /** `null` em indicador automático ainda sem meta. */
  sentido: Sentido | null
  /** `null` quando a composição é um dado externo. */
  calculo: Calculo | null
  meta: number | null
  metaADefinir: boolean
  origemDaMeta: OrigemMeta | null
  metaEditavel: boolean
  criadoAutomaticamente: boolean
  componentesDesativados: boolean
  problema: ProblemaIndicador | null
  dashboards: DashboardDoIndicador[]
  vinculadoADashboard: boolean
}

export interface PontosDashboard {
  soma: number
  maximo: number
}

export interface AlertaDashboard {
  indicador: string
  motivo: string
  pontosAfetados: number
}

export interface Dashboard {
  id: number
  nome: string
  situacao: SituacaoDashboard
  situacaoDescricao: string
  tarefaBitrix: TarefaBitrix | null
  tipoVinculo: TipoVinculo
  /** Códigos de filial, nomes de cargo ou ids de colaborador, conforme `tipoVinculo`. */
  itensVinculados: string[]
  unidadesDeImagem: number
  periodicidade: Periodicidade
  periodoAtual: string
  quantidadeDeIndicadores: number
  pontos: PontosDashboard
  alertas: AlertaDashboard[]
  cadastradoEm: DataApi | null
  ultimaAlteracao: DataApi | null
}

export interface Faixa {
  de: number
  ate: number
  aliquota: number
}

export interface TabelaFaixas {
  id: number
  idDashboard: number
  dashboard: string
  dashboardExcluido: boolean
  filial: string
  nomeFilial: string
  descricao: string | null
  versaoVigente: number
  dataDaVersao: DataApi | null
  autorDaVersao: string | null
  quantidadeDeFaixas: number
  faixas: Faixa[]
}

export interface HistoricoMeta {
  data: DataApi
  filial: string
  mesDeReferencia: DataApi
  de: number | null
  para: number
  usuario: string
  motivo: string
}

export interface Progresso {
  preenchidos: number
  total: number
}

/** Linha de `GET /api/ped/fechamentos`. */
export interface Fechamento {
  id: number
  nome: string
  tipoVinculo: TipoVinculo
  itensVinculados: string[]
  periodicidade: Periodicidade
  periodoAtual: string
  situacaoDoPeriodo: SituacaoPeriodo
  unidadesDeImagem: number
  unidadesEncerradas: number
  unidadesComPendencias: number
  progresso: Progresso
  indicadoresComProblema: string[]
  unidadesSemTabelaDeFaixas: string[]
}

// ---------------------------------------------------------------------------
// Dados de entrada (formulários → corpo da API, via adaptadores)
// ---------------------------------------------------------------------------

export interface NovoApontamento {
  nome: string
  idTipo: number
  tipoValor: TipoValor
  descricao?: string | null
}

export interface NovoDadoExterno {
  nome: string
  idTipo: number
  sistemaOrigem: SistemaOrigem
  tipoValor: TipoValor
  referencia: Referencia
  coleta: Coleta
  diaDaColeta: number | null
  sentidoCalculo: SentidoCalculo
  janelaRetroativa: JanelaRetroativa | null
  /** Obrigatório quando a origem é `outro`. */
  comentarios: string | null
  /** Obrigatório para Validador e Preenchedor. */
  campoCalculo: string | null
  /** Obrigatório para o Admin; ignorado pela API nos demais perfis. */
  identificador: string | null
  /** Só entra na tarefa da TI. */
  observacao: string | null
}

export interface NovoIndicador {
  nome: string
  descricao: string | null
  meta: number
  sentido: Sentido
  /** Só com apontamentos; a API assume `soma` quando omitido. */
  calculo?: Calculo
  metaEditavel: boolean
  /** Composição por apontamentos (exclusivo com `dadoExterno`). */
  apontamentos?: number[]
  /** Composição por dado externo (exclusivo com `apontamentos`). */
  dadoExterno?: number
}

export interface IndicadorDoDashboard {
  idIndicador: number
  pontosBase: number
}

export interface DadosDashboard {
  nome: string
  periodicidade: Periodicidade
  pontuacaoBaseMaxima: number
  tipoVinculo: TipoVinculo
  itensVinculados: Array<string | number>
  indicadores: IndicadorDoDashboard[]
  indicadorBaseDaFaixa: number
  formulaDePontuacao: string
  observacaoParaTi: string | null
  /** Só na edição: `true` gera a tarefa de modificação para a TI. */
  enviarTarefaTi?: boolean
}

export interface NovaTabelaFaixas {
  dashboard: number
  filial: string
  descricao: string | null
  faixas: Faixa[]
}

export interface ItemPreenchimento {
  idApontamento: number
  /** Número, ou `true`/`false` em apontamento booleano. */
  valor: number | boolean
  /** Obrigatório na correção de um valor já lançado. */
  motivo?: string
}

export interface Preenchimento {
  filial: string
  mesDeReferencia: DataApi
  itens: ItemPreenchimento[]
}

export interface ItemAjusteMeta {
  idIndicador: number
  meta: number
  motivo: string
}

export interface AjusteMetas {
  filial: string
  mesDeReferencia: DataApi
  itens: ItemAjusteMeta[]
}
