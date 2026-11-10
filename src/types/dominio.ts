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

/** Origem da meta do indicador: `manual` (digitada) ou `terceiro` (buscada via API — F6.11, proposta). */
export const ORIGENS_META = ['manual', 'terceiro'] as const
export type OrigemMeta = (typeof ORIGENS_META)[number]

/**
 * Fonte da meta buscada via API (F6.11, contrato final — `RESPOSTA-FINAL-meta-via-api.md`): o próprio
 * dado externo da composição (`dado_externo`) ou uma integração do indicador configurada pela TI
 * (`integracao`).
 */
export const FONTES_META = ['dado_externo', 'integracao'] as const
export type FonteMeta = (typeof FONTES_META)[number]

/** Situação da meta via API do indicador (F6.11, contrato final). */
export const SITUACOES_META_VIA_API = ['ok', 'sem_meta_no_mes', 'integracao_pendente', 'aguardando_consulta', 'erro'] as const
export type SituacaoMetaViaApi = (typeof SITUACOES_META_VIA_API)[number]

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
  /** Grupos do ERP vinculados (A-02); `null` quando a API não informa (ex.: perfil Preenchedor). */
  grupos: ReferenciaNomeada[] | null
  /** Usuários vinculados diretamente (A-02); `null` quando a API não informa (ex.: perfil Preenchedor). */
  usuarios: ReferenciaNomeada[] | null
}

/** Campos de auditoria comuns a apontamentos, dados externos e indicadores. */
export interface Auditoria {
  cadastradoEm: DataApi | null
  cadastradoPor: string | null
  situacaoAlteradaEm: DataApi | null
  situacaoAlteradaPor: string | null
}

/**
 * Indicador que um apontamento compõe. A API real devolve só o nome (`"indicadores": ["Margem"]`), e
 * aí `id` é `null`; quando ela manda `{ id, nome }`, o id é mantido.
 */
export interface IndicadorDoApontamento {
  id: number | null
  nome: string
}

export interface Apontamento extends Auditoria {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  idTipo: number
  tipo: string
  tipoValor: TipoValor
  indicadores: IndicadorDoApontamento[]
  vinculadoADashboard: boolean
  desativadoMasUsadoEmIndicadorAtivo: boolean
}

/** Tarefa registrada para a equipe de TI (Bitrix24). */
export interface TarefaBitrix {
  /** Número da tarefa no Bitrix24; `null` enquanto ela só está registrada (ainda não enviada). */
  id: number | null
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
  // Integração (contrato de 09/11/2026): só o Admin recebe estes campos; para Validador e
  // Preenchedor ficam vazios (`null`, `[]`, `false`).
  /** URL da consulta; `null` enquanto a integração não foi gravada. */
  url: string | null
  /** JSON de saída gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosSaida: unknown
  /** JSON de entrada gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosEntrada: unknown
  /** Variáveis usadas na entrada (nomes sem `%`). */
  variaveisUsadas: string[]
  /** Dado `ativo`/`inativo` sem integração (alerta para a TI). */
  integracaoPendente: boolean
  integracaoAlteradaEm: DataApi | null
  integracaoAlteradaPor: string | null
  /**
   * A coleta do dado também traz a meta (10/11/2026, seção 2.5 de `RESPOSTA-FINAL-meta-via-api.md`):
   * todos os perfis recebem; ausente ou `null` → `false`.
   */
  forneceMeta: boolean
}

/**
 * Integração do dado externo informada pela TI (F5.7, F5.16): corpo de `PUT .../concluir` e de
 * `PUT .../integracao`. Os quatro campos são obrigatórios; os JSONs vão como digitados.
 */
export interface IntegracaoDadoExterno {
  identificador: string
  url: string
  /** Texto do JSON de saída, como digitado. */
  parametrosSaida: string
  /** Texto do JSON de entrada, como digitado. */
  parametrosEntrada: string
}

/**
 * Erro da integração apontado pelo back-end (400 do concluir/integracao e `POST .../integracao/validar`).
 * As mensagens vêm em português e são mostradas como vierem.
 */
export interface ErroIntegracao {
  /** Campo da modal (`identificador`, `url`, `parametros de saida`, `parametros de entrada`); `null` se não informado. */
  campo: string | null
  mensagem: string
  /** Só em erro de JSON mal formado. */
  linha: number | null
  coluna: number | null
  /** Ponto do JSON de entrada (ex.: `filtro.inicio`, `lista[0]`); só em erro de conta. */
  caminho: string | null
  expressao: string | null
}

/** Item de `GET .../integracoes-pendentes` (F5.17). */
export interface DadoIntegracaoPendente {
  id: number
  nome: string
  identificador: string | null
  situacao: SituacaoDadoExterno
}

/** Resposta de `GET .../integracoes-pendentes` (F5.17); `quantidade` é a informada pela API. */
export interface IntegracoesPendentes {
  quantidade: number
  dados: DadoIntegracaoPendente[]
}

/** Parâmetros de `POST /api/ped/integracao/validar` (F5.18); vazios ou ausentes não são enviados. */
export interface ParametrosValidacaoIntegracao {
  parametrosSaida?: string
  parametrosEntrada?: string
}

/** Campo do JSON de saída validado pelo back-end. `tipo`: `texto`, `numero`, `booleano`, `lista`, `objeto` ou `nulo`. */
export interface CampoSaidaServidor {
  nome: string
  tipo: string
}

/** Erro de JSON da saída (validação do back-end). */
export interface ErroJsonServidor {
  mensagem: string
  linha: number | null
  coluna: number | null
}

/** Resultado da validação do JSON de saída pelo back-end. */
export type ResultadoValidacaoSaidaServidor =
  | { valido: true; campos: CampoSaidaServidor[] }
  | { valido: false; erro: ErroJsonServidor }

/** Conta resolvida na prévia do JSON de entrada (back-end). */
export interface CalculoEntradaServidor {
  caminho: string
  expressao: string
  resultado: string
}

/** Resultado da validação do JSON de entrada pelo back-end. */
export type ResultadoValidacaoEntradaServidor =
  | { valido: true; variaveisUsadas: string[]; calculos: CalculoEntradaServidor[]; previa: unknown }
  | { valido: false; erros: ErroIntegracao[] }

/** Resposta de `POST /api/ped/integracao/validar`: `null` no campo não enviado (ou vazio). */
export interface ResultadoValidacaoIntegracao {
  saida: ResultadoValidacaoSaidaServidor | null
  entrada: ResultadoValidacaoEntradaServidor | null
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

/** Tipos aceitos para as variáveis da integração de dados externos (F5.15). */
export const TIPOS_VARIAVEL_INTEGRACAO = ['numero', 'texto', 'data'] as const

/** Tipo de uma variável da integração: só `numero` e `data` entram em contas. */
export type TipoVariavelIntegracao = (typeof TIPOS_VARIAVEL_INTEGRACAO)[number]

/**
 * Variável que pode ser usada nos parâmetros de entrada da integração (F5.15), escrita entre `%`
 * no JSON (ex.: `%filial%`). A lista vem da API de variáveis do PED.
 */
export interface VariavelIntegracao {
  /** Nome sem os `%` (ex.: `filial`). */
  nome: string
  /** Conteúdo da variável; texto vazio quando a API não informa. */
  descricao: string
  tipo: TipoVariavelIntegracao
  /** Valor de exemplo usado pelo back-end na prévia (ex.: `"100"`); `null` quando a API não informa. */
  exemplo: string | null
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

/** Meta de uma filial enviada no cadastro ou no "Definir meta" (F6.10, contrato proposto). */
export interface MetaDaFilial {
  /** Código da filial. */
  filial: string
  meta: number
}

/**
 * Meta de uma filial na listagem de indicadores (F6.10, contrato proposto): `meta` é `null` quando a
 * filial está pendente (sem meta).
 */
export interface MetaPorFilialIndicador {
  /** Código da filial (a API pode mandar número; vira texto). */
  filial: string
  /** `null` quando a API não informa o nome. */
  nomeFilial: string | null
  meta: number | null
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
  /** Meta única (replicada para todas as filiais); `null` sem meta ou com meta por filial. */
  meta: number | null
  metaADefinir: boolean
  /** Metas por filial (F6.10); `[]` quando a meta é única ou a API não traz o campo. */
  metasPorFilial: MetaPorFilialIndicador[]
  /**
   * Meta cadastrada por filial (F6.10, campo `"meta por filial"` da API real). Quando a API não informa,
   * é derivado de `metasPorFilial` não vazia.
   */
  metaPorFilial: boolean
  /** Códigos das filiais sem meta (F6.10); `[]` quando nenhuma está pendente. */
  filiaisSemMeta: string[]
  origemDaMeta: OrigemMeta | null
  metaEditavel: boolean
  criadoAutomaticamente: boolean
  componentesDesativados: boolean
  problema: ProblemaIndicador | null
  dashboards: DashboardDoIndicador[]
  vinculadoADashboard: boolean
  /**
   * Integração da meta buscada via API (F6.11, contrato proposto): presente **só** quando
   * `origemDaMeta === 'terceiro'`; `undefined` nos indicadores de meta manual.
   */
  integracao?: IntegracaoDoIndicador
  /**
   * Contrato final da meta via API (F6.11): os quatro campos abaixo só existem com
   * `origemDaMeta === 'terceiro'` (`undefined` nos indicadores de meta manual).
   * Fonte da meta; ausente na API → `integracao`.
   */
  fonteDaMeta?: FonteMeta
  /** Situação da meta via API; `null` quando a API não informa. */
  situacaoDaMetaViaApi?: SituacaoMetaViaApi | null
  /** Tarefa do Bitrix da integração da meta (fonte `integracao`); `null` sem tarefa. */
  tarefaBitrix?: TarefaBitrix | null
  /** Integração do dado externo da composição, só leitura (fonte `dado_externo`, Admin); senão `null`. */
  integracaoDoDadoExterno?: IntegracaoDoDadoExternoDoIndicador | null
}

/** Integração do dado externo exibida (só leitura) no indicador com fonte da meta `dado_externo`. */
export interface IntegracaoDoDadoExternoDoIndicador {
  identificador: string | null
  url: string | null
  /** JSON de saída gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosSaida: unknown
  /** JSON de entrada gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosEntrada: unknown
}

/**
 * Integração da meta do indicador (F6.11, contrato proposto — seção 5 de
 * `docs/propostas-backend/PROPOSTA-meta-por-filial.md`). Só o Admin recebe os campos na listagem; para
 * os demais perfis ficam vazios (`null`, `[]`, `false`).
 */
export interface IntegracaoDoIndicador {
  identificador: string | null
  url: string | null
  /** JSON de saída gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosSaida: unknown
  /** JSON de entrada gravado (objeto ou lista, já decodificado); `null` se não há. */
  parametrosEntrada: unknown
  /** Variáveis usadas na entrada (nomes sem `%`). */
  variaveisUsadas: string[]
  /** Meta via API ainda sem integração salva (alerta para a TI). */
  pendente: boolean
  alteradaEm: DataApi | null
  alteradaPor: string | null
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

/**
 * Dados do cadastro de indicador. Informe exatamente um entre `meta` (meta única, replicada para todas
 * as filiais) e `metasPorFilial` (F6.10: só as filiais com meta) — ou nenhum dos dois com
 * `origemDaMeta: 'terceiro'` (F6.11: meta buscada via API, sempre com `metaEditavel: false`).
 */
export interface NovoIndicador {
  nome: string
  descricao: string | null
  /** F6.11: `'terceiro'` = meta buscada via API; ausente = meta manual (digitada). */
  origemDaMeta?: OrigemMeta
  /** F6.11 (contrato final): fonte da meta via API; só vale com `origemDaMeta: 'terceiro'` (ausente → `integracao`). */
  fonteDaMeta?: FonteMeta
  meta?: number
  metasPorFilial?: MetaDaFilial[]
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
