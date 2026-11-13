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
  /**
   * Executor das integrações (F5.22, 11/11/2026): data da última consulta **bem-sucedida**; `null`
   * antes da primeira consulta ou para quem não é Admin.
   */
  ultimaConsultaEm: DataApi | null
  /** Executor (F5.22): erro da última consulta; `null` quando não houve erro (ou não é Admin). */
  erroUltimaConsulta: string | null
}

/**
 * Integração do dado externo informada pela TI (F5.7, F5.16): corpo de `PUT .../concluir` e de
 * `PUT .../integracao`. Os quatro campos são obrigatórios; os JSONs vão como digitados. Desde 11/11/2026
 * (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`) não há mapeamento da saída: a saída
 * só descreve ao back-end os campos esperados do web service.
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

/**
 * Parâmetros de `POST /api/ped/integracao/validar` (F5.18); vazios ou ausentes não são enviados. Desde
 * 11/11/2026 (saída sem mapeamento) só a entrada vai ao servidor; a saída é validada só na tela.
 */
export interface ParametrosValidacaoIntegracao {
  parametrosEntrada?: string
  /**
   * Campo de valor exigido na saída (11/11/2026, `FRONT-meta-via-api-fase1.md`, item 2.2): `valor` na
   * modal do dado externo, `meta` na do indicador. Enviado só quando informado.
   */
  finalidade?: 'valor' | 'meta'
}

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

/**
 * Resposta de `POST /api/ped/integracao/validar`: `null` quando a entrada não foi enviada (ou veio vazia).
 * A `saida` que o back-end ainda possa devolver é ignorada (saída sem mapeamento, 11/11/2026).
 */
export interface ResultadoValidacaoIntegracao {
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
  /**
   * Executor das integrações (F6.11, fase 2): data da última consulta **bem-sucedida** da meta;
   * `null` antes da primeira consulta, fora da fonte `integracao` ou para quem não é Admin.
   */
  ultimaConsultaEm: DataApi | null
  /** Executor (F6.11, fase 2): erro da última consulta da meta; `null` quando não houve erro. */
  erroUltimaConsulta: string | null
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

/** Tipos de alerta de faixas do dashboard (F7.14 — proposta "faixa geral e situação", seção 6). */
export const TIPOS_ALERTA_FAIXAS = ['conflito', 'sem_faixa'] as const
export type TipoAlertaFaixas = (typeof TIPOS_ALERTA_FAIXAS)[number]

/** Alerta de faixas do dashboard (F7.14): faixas em conflito ou filial/dashboard sem faixa ativa. */
export interface AlertaFaixasDashboard {
  tipo: TipoAlertaFaixas
  mensagem: string
  /** Filial do alerta; `null` quando vale para o dashboard todo. */
  filial: string | null
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
  /** F7.14: alertas de faixas; `[]` quando a API não informa. */
  alertasDeFaixas: AlertaFaixasDashboard[]
  cadastradoEm: DataApi | null
  ultimaAlteracao: DataApi | null
}

export interface Faixa {
  de: number
  ate: number
  aliquota: number
}

/** Situação da tabela de faixas (F8.7). */
export const SITUACOES_TABELA_FAIXAS = ['ativa', 'inativa'] as const
export type SituacaoTabelaFaixas = (typeof SITUACOES_TABELA_FAIXAS)[number]

export interface TabelaFaixas {
  id: number
  idDashboard: number
  dashboard: string
  dashboardExcluido: boolean
  /** `null` na faixa geral (F8.7). */
  filial: string | null
  /** `null` na faixa geral (F8.7). */
  nomeFilial: string | null
  /** F8.7: `true` na faixa geral (todas as filiais). */
  geral: boolean
  /** F8.7: `ativa` quando a API não informa. */
  situacao: SituacaoTabelaFaixas
  /** F8.7: motivo, data e autor da última inativação/reativação; `null` se nunca mudou. */
  motivoDaSituacao: string | null
  dataDaSituacao: DataApi | null
  usuarioDaSituacao: string | null
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
  /** Código da filial, ou `'todas'` para a faixa geral (F8.7). */
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

// ---------------------------------------------------------------------------
// Preenchimento (F9.1 — RF-60 a RF-76)
// ---------------------------------------------------------------------------

/** Situação de um mês de competência na barra de meses do preenchimento (RF-61). */
export const SITUACOES_MES_PREENCHIMENTO = ['aberto', 'fechado', 'futuro'] as const
export type SituacaoMesPreenchimento = (typeof SITUACOES_MES_PREENCHIMENTO)[number]

/** Situação do mês na tela do preenchimento: só meses já abertos podem ser consultados. */
export type SituacaoMesConsultado = Exclude<SituacaoMesPreenchimento, 'futuro'>

/** Situação do apontamento no mês (RF-65): `nao_lancado` é o pendente de um mês fechado. */
export const SITUACOES_LANCAMENTO = ['pendente', 'nao_lancado', 'preenchido', 'corrigido'] as const
export type SituacaoLancamento = (typeof SITUACOES_LANCAMENTO)[number]
export const ROTULOS_SITUACAO_LANCAMENTO: Readonly<Record<SituacaoLancamento, string>> = {
  pendente: 'Pendente',
  nao_lancado: 'Não lançado',
  preenchido: 'Preenchido',
  corrigido: 'Corrigido',
}

/** Ação de uma linha do histórico do apontamento (RF-69). */
export const ACOES_LANCAMENTO = ['lancamento', 'correcao'] as const
export type AcaoLancamento = (typeof ACOES_LANCAMENTO)[number]
export const ROTULOS_ACAO_LANCAMENTO: Readonly<Record<AcaoLancamento, string>> = {
  lancamento: 'Lançamento',
  correcao: 'Correção',
}

/** Origem da meta do cadastro na janela "Editar metas" (RF-72): a da filial ou a geral. */
export const ORIGENS_META_DO_CADASTRO = ['filial', 'geral'] as const
export type OrigemMetaDoCadastro = (typeof ORIGENS_META_DO_CADASTRO)[number]

/** Valor lançado: número, ou `true`/`false` em apontamento booleano. */
export type ValorLancamento = number | boolean

/** Abertura de período (RF-75, RF-76): `reaberto` indica que um mês passado foi reaberto. */
export interface PeriodoAberto extends Periodo {
  reaberto: boolean
}

/** Mês da barra de meses (`GET /api/ped/preenchimento/meses`). */
export interface MesPreenchimento {
  /** 1 a 12. */
  mes: number
  /** Sempre `AAAA-MM-01`. */
  mesDeReferencia: DataApi
  situacao: SituacaoMesPreenchimento
  /** Apontamentos pendentes; a API só informa no mês aberto (`null` nos demais). */
  pendentes: number | null
}

/** Dashboard que usa o apontamento (RF-65); `id`/`periodicidade` `null` quando a API não informa. */
export interface DashboardDoApontamento {
  id: number | null
  nome: string
  periodicidade: Periodicidade | null
}

/** Imagem congelada que usou o valor do apontamento (RF-70). */
export interface ImagemCongeladaDoApontamento {
  codigo: string | null
  dashboard: string | null
  periodo: string | null
}

/** Apontamento na tela do preenchimento de uma filial e mês. */
export interface ApontamentoPreenchimento {
  id: number
  nome: string
  descricao: string | null
  tipoValor: TipoValor
  situacao: SituacaoLancamento
  /** `null` quando não há lançamento. */
  valor: ValorLancamento | null
  indicadores: IndicadorDoApontamento[]
  dashboards: DashboardDoApontamento[]
  imagensCongeladas: ImagemCongeladaDoApontamento[]
}

/** Tipo de apontamento (aba) na tela do preenchimento. */
export interface TipoPreenchimento {
  id: number
  nome: string
  quantidade: number
  apontamentos: ApontamentoPreenchimento[]
}

/** Resposta de `GET /api/ped/preenchimento` (RF-62 a RF-65). */
export interface TelaPreenchimento {
  filial: string
  nomeFilial: string | null
  mesDeReferencia: DataApi
  situacaoDoMes: SituacaoMesConsultado
  /** Só o mês aberto aceita lançamento e correção. */
  editavel: boolean
  periodoAberto: DataApi | null
  abertoPor: string | null
  abertoEm: DataApi | null
  progresso: Progresso
  tipos: TipoPreenchimento[]
}

/** Linha de `GET /api/ped/apontamentos/{id}/historico` (RF-69). */
export interface HistoricoLancamento {
  data: DataApi
  acao: AcaoLancamento
  valorAnterior: ValorLancamento | null
  valorNovo: ValorLancamento | null
  usuario: string | null
  motivo: string | null
}

/** Indicador da janela "Editar metas" (`GET /api/ped/metas` — RF-71, RF-72). */
export interface IndicadorMetaPreenchimento {
  id: number
  nome: string
  /** Nomes dos tipos. */
  tipos: string[]
  composicao: ComposicaoIndicador | null
  sentido: Sentido | null
  /** Meta da filial no cadastro; senão, a geral. */
  metaDoCadastro: number | null
  metaDoCadastroOrigem: OrigemMetaDoCadastro | null
  /** Meta que vale no mês (o ajuste do mês, se houver; senão, a do cadastro). */
  metaVigente: number | null
  /** `true` quando a meta do mês foi ajustada no preenchimento. */
  ajustada: boolean
}

/** Resposta de `GET /api/ped/metas`. */
export interface JanelaMetas {
  situacaoDoMes: SituacaoMesConsultado
  editavel: boolean
  indicadores: IndicadorMetaPreenchimento[]
}
