/**
 * Adaptadores entre o formato da API PED (chaves em português, com espaço) e os tipos da
 * aplicação (INT-02, INT-03).
 *
 * - Ida (`para<Entidade>`): resposta da API → tipo do domínio. Campos ausentes viram `null`;
 *   listas ausentes viram `[]`.
 * - Volta (`paraCorpo<Acao>`): dados do formulário → corpo da requisição.
 *
 * Este é o único lugar que conhece as chaves da API; componentes e páginas usam só os tipos de
 * `src/types/dominio.ts`.
 */

import {
  type Acesso,
  type AjusteMetas,
  type AlertaDashboard,
  type Apontamento,
  type Auditoria,
  type Calculo,
  type Coleta,
  type ComponenteIndicador,
  type ComposicaoIndicador,
  type DadoExterno,
  type DadosDashboard,
  type Dashboard,
  type DashboardDoIndicador,
  type Faixa,
  type Fechamento,
  type Filial,
  type HistoricoMeta,
  type Indicador,
  type JanelaRetroativa,
  type NovaTabelaFaixas,
  type NovoApontamento,
  type NovoDadoExterno,
  type NovoIndicador,
  type OrigemMeta,
  type OrigemTipo,
  type Perfil,
  type Periodicidade,
  type Periodo,
  type Preenchimento,
  type ProblemaIndicador,
  type Progresso,
  type Referencia,
  type ReferenciaNomeada,
  type Sentido,
  type SentidoCalculo,
  type SistemaOrigem,
  type SituacaoDadoExterno,
  type SituacaoDashboard,
  type SituacaoPeriodo,
  type TabelaFaixas,
  type TarefaBitrix,
  type TipoApontamento,
  type TipoComposicao,
  type TipoValor,
  type TipoVinculo,
  TIPOS_VALOR,
} from '../types/dominio'

// ---------------------------------------------------------------------------
// Formato cru da API (entrada dos adaptadores de ida)
// ---------------------------------------------------------------------------

export interface ReferenciaNomeadaApi {
  id: number
  nome: string
}

export interface FilialApi {
  filial: string
  'nome filial': string
  empresa?: string | number | null
}

export interface AcessoApi {
  'id colaborador': number
  nome: string
  perfil: Perfil | null
  tipos?: ReferenciaNomeadaApi[] | null
  'todas as filiais': boolean
  filiais?: FilialApi[] | null
  'periodo aberto'?: string | null
}

export interface PeriodoApi {
  'mes de referencia': string
  'aberto por'?: string | null
  'aberto em'?: string | null
}

export interface TipoApontamentoApi {
  id: number
  nome: string
  origem: OrigemTipo
  'quantidade usuarios'?: number | null
  'quantidade apontamentos'?: number | null
}

/** Campos de auditoria devolvidos pela API em apontamentos, dados externos e indicadores. */
export interface AuditoriaApi {
  'cadastrado em'?: string | null
  'cadastrado por'?: string | null
  'situacao alterada em'?: string | null
  'situacao alterada por'?: string | null
}

export interface ApontamentoApi extends AuditoriaApi {
  id: number
  nome: string
  descricao?: string | null
  ativo: boolean
  'id tipo': number
  tipo: string
  'tipo de valor': string
  indicadores?: ReferenciaNomeadaApi[] | null
  'vinculado a dashboard'?: boolean | null
  'desativado mas usado em indicador ativo'?: boolean | null
}

export interface TarefaBitrixApi {
  id: number
  status: string
  titulo: string
}

export interface DadoExternoApi extends AuditoriaApi {
  id: number
  nome: string
  'id tipo': number
  tipo: string
  situacao: SituacaoDadoExterno
  'situacao descricao'?: string | null
  'tarefa bitrix'?: TarefaBitrixApi | null
  'sistema de origem': SistemaOrigem
  identificador?: string | null
  'campo calculo'?: string | null
  referencia: Referencia
  coleta: Coleta
  'dia da coleta'?: number | null
  'coleta descricao'?: string | null
  'sentido do calculo': SentidoCalculo
  'janela retroativa'?: JanelaRetroativa | null
  comentarios?: string | null
  'tipo de valor': string
  'coleta disponivel'?: boolean | null
  /** Nomes dos indicadores que o dado externo compõe (texto na listagem). */
  indicadores?: string[] | null
}

export interface ComponenteIndicadorApi {
  id: number
  nome: string
  ativo: boolean
}

export interface ComposicaoIndicadorApi {
  tipo: TipoComposicao
  itens?: ComponenteIndicadorApi[] | null
}

export interface ProblemaIndicadorApi {
  tipo: string
  mensagem: string
}

export interface DashboardDoIndicadorApi {
  id: number
  nome: string
  'pontos base': number
}

export interface IndicadorApi extends AuditoriaApi {
  id: number
  nome: string
  descricao?: string | null
  ativo: boolean
  composicao: ComposicaoIndicadorApi
  tipos?: string[] | null
  sentido?: Sentido | null
  calculo?: Calculo | null
  meta?: number | null
  'meta a definir'?: boolean | null
  'origem da meta'?: OrigemMeta | null
  'meta editavel no preenchimento'?: boolean | null
  'criado automaticamente'?: boolean | null
  'componentes desativados'?: boolean | null
  problema?: ProblemaIndicadorApi | null
  dashboards?: DashboardDoIndicadorApi[] | null
  'vinculado a dashboard'?: boolean | null
}

export interface PontosDashboardApi {
  soma: number
  maximo: number
}

export interface AlertaDashboardApi {
  indicador: string
  motivo: string
  'pontos afetados': number
}

export interface DashboardApi {
  id: number
  nome: string
  situacao: SituacaoDashboard
  'situacao descricao'?: string | null
  'tarefa bitrix'?: TarefaBitrixApi | null
  'tipo de vinculo': TipoVinculo
  'itens vinculados'?: Array<string | number> | null
  'unidades de imagem'?: number | null
  periodicidade: Periodicidade
  'periodo atual': string
  'quantidade de indicadores'?: number | null
  pontos?: PontosDashboardApi | null
  alertas?: AlertaDashboardApi[] | null
  'cadastrado em'?: string | null
  'ultima alteracao'?: string | null
}

export interface FaixaApi {
  de: number
  ate: number
  aliquota: number
}

export interface TabelaFaixasApi {
  id: number
  'id dashboard': number
  dashboard: string
  'dashboard excluido'?: boolean | null
  filial: string
  'nome filial': string
  descricao?: string | null
  'versao vigente': number
  'data da versao'?: string | null
  'autor da versao'?: string | null
  'quantidade de faixas'?: number | null
  faixas?: FaixaApi[] | null
}

export interface HistoricoMetaApi {
  data: string
  filial: string
  'mes de referencia': string
  de?: number | null
  para: number
  usuario: string
  motivo: string
}

export interface ProgressoApi {
  preenchidos: number
  total: number
}

export interface FechamentoApi {
  id: number
  nome: string
  'tipo de vinculo': TipoVinculo
  'itens vinculados'?: Array<string | number> | null
  periodicidade: Periodicidade
  'periodo atual': string
  'situacao do periodo': SituacaoPeriodo
  'unidades de imagem'?: number | null
  'unidades encerradas'?: number | null
  'unidades com pendencias'?: number | null
  progresso?: ProgressoApi | null
  'indicadores com problema'?: string[] | null
  'unidades sem tabela de faixas'?: Array<string | number> | null
}

// ---------------------------------------------------------------------------
// Corpos de requisição (saída dos adaptadores de volta)
// ---------------------------------------------------------------------------

export interface CorpoNovoApontamento {
  nome: string
  'id tipo': number
  'tipo de valor': TipoValor
  descricao: string | null
}

export interface CorpoNovoDadoExterno {
  nome: string
  'id tipo': number
  'sistema de origem': SistemaOrigem
  'tipo de valor': TipoValor
  referencia: Referencia
  coleta: Coleta
  'dia da coleta': number | null
  'sentido do calculo': SentidoCalculo
  'janela retroativa': JanelaRetroativa | null
  comentarios: string | null
  'campo calculo': string | null
  identificador: string | null
  observacao: string | null
}

export interface CorpoNovoIndicador {
  nome: string
  descricao: string | null
  'origem da meta': OrigemMeta
  meta: number
  sentido: Sentido
  'meta editavel': boolean
  calculo?: Calculo
  apontamentos?: number[]
  'dado externo'?: number
}

export interface CorpoIndicadorDoDashboard {
  'id indicador': number
  'pontos base': number
}

export interface CorpoDashboard {
  nome: string
  periodicidade: Periodicidade
  'pontuacao base maxima': number
  'tipo de vinculo': TipoVinculo
  'itens vinculados': Array<string | number>
  indicadores: CorpoIndicadorDoDashboard[]
  'indicador base da faixa': number
  'formula de pontuacao': string
  'observacao para ti': string | null
  'enviar tarefa ti'?: boolean
}

export interface CorpoNovaTabelaFaixas {
  dashboard: number
  filial: string
  descricao: string | null
  faixas: FaixaApi[]
}

export interface CorpoItemPreenchimento {
  'id apontamento': number
  valor: number | boolean
  motivo?: string
}

export interface CorpoPreenchimento {
  filial: string
  'mes de referencia': string
  itens: CorpoItemPreenchimento[]
}

export interface CorpoItemAjusteMeta {
  'id indicador': number
  meta: number
  motivo: string
}

export interface CorpoAjusteMetas {
  filial: string
  'mes de referencia': string
  itens: CorpoItemAjusteMeta[]
}

// ---------------------------------------------------------------------------
// Auxiliares de leitura segura
// ---------------------------------------------------------------------------

/** Devolve o valor ou `null` quando ausente (`undefined`/`null`). */
function ouNulo<T>(valor: T | null | undefined): T | null {
  return valor ?? null
}

/** Devolve a lista convertida, ou `[]` quando ausente. */
function lista<T, R>(valores: T[] | null | undefined, converter: (item: T) => R): R[] {
  return Array.isArray(valores) ? valores.map(converter) : []
}

/** Lista de textos (ex.: itens vinculados), normalizando números para string. */
function listaDeTextos(valores: Array<string | number> | null | undefined): string[] {
  return lista(valores, (item) => String(item))
}

function paraReferenciaNomeada(item: ReferenciaNomeadaApi): ReferenciaNomeada {
  return { id: item.id, nome: item.nome }
}

function paraTarefaBitrix(tarefa: TarefaBitrixApi | null | undefined): TarefaBitrix | null {
  if (!tarefa) return null
  return { id: tarefa.id, status: tarefa.status, titulo: tarefa.titulo }
}

function paraAuditoria(dado: AuditoriaApi): Auditoria {
  return {
    cadastradoEm: ouNulo(dado['cadastrado em']),
    cadastradoPor: ouNulo(dado['cadastrado por']),
    situacaoAlteradaEm: ouNulo(dado['situacao alterada em']),
    situacaoAlteradaPor: ouNulo(dado['situacao alterada por']),
  }
}

function paraFaixa(faixa: FaixaApi): Faixa {
  return { de: faixa.de, ate: faixa.ate, aliquota: faixa.aliquota }
}

function paraProgresso(progresso: ProgressoApi | null | undefined): Progresso {
  return { preenchidos: progresso?.preenchidos ?? 0, total: progresso?.total ?? 0 }
}

// ---------------------------------------------------------------------------
// Ida: resposta da API → tipo do domínio
// ---------------------------------------------------------------------------

/**
 * Converte o tipo de valor devolvido pela API (`Porcentagem`, `Numeral`, `Booleano`, em qualquer
 * caixa) para o enum da aplicação. Lança erro se o valor não for reconhecido.
 */
export function paraTipoValor(valor: string): TipoValor {
  const normalizado = valor.trim().toLowerCase()
  const encontrado = TIPOS_VALOR.find((tipo) => tipo === normalizado)
  if (!encontrado) throw new Error(`Tipo de valor desconhecido: "${valor}".`)
  return encontrado
}

export function paraFilial(filial: FilialApi): Filial {
  return {
    codigo: String(filial.filial),
    nome: filial['nome filial'],
    empresa: filial.empresa === undefined || filial.empresa === null ? null : String(filial.empresa),
  }
}

export function paraAcesso(acesso: AcessoApi): Acesso {
  return {
    idColaborador: acesso['id colaborador'],
    nome: acesso.nome,
    perfil: ouNulo(acesso.perfil),
    tipos: lista(acesso.tipos, paraReferenciaNomeada),
    todasAsFiliais: acesso['todas as filiais'] === true,
    filiais: lista(acesso.filiais, paraFilial),
    periodoAberto: ouNulo(acesso['periodo aberto']),
  }
}

export function paraPeriodo(periodo: PeriodoApi): Periodo {
  return {
    mesDeReferencia: periodo['mes de referencia'],
    abertoPor: ouNulo(periodo['aberto por']),
    abertoEm: ouNulo(periodo['aberto em']),
  }
}

export function paraTipoApontamento(tipo: TipoApontamentoApi): TipoApontamento {
  return {
    id: tipo.id,
    nome: tipo.nome,
    origem: tipo.origem,
    quantidadeUsuarios: tipo['quantidade usuarios'] ?? 0,
    quantidadeApontamentos: tipo['quantidade apontamentos'] ?? 0,
  }
}

export function paraApontamento(apontamento: ApontamentoApi): Apontamento {
  return {
    id: apontamento.id,
    nome: apontamento.nome,
    descricao: ouNulo(apontamento.descricao),
    ativo: apontamento.ativo === true,
    idTipo: apontamento['id tipo'],
    tipo: apontamento.tipo,
    tipoValor: paraTipoValor(apontamento['tipo de valor']),
    indicadores: lista(apontamento.indicadores, paraReferenciaNomeada),
    vinculadoADashboard: apontamento['vinculado a dashboard'] === true,
    desativadoMasUsadoEmIndicadorAtivo: apontamento['desativado mas usado em indicador ativo'] === true,
    ...paraAuditoria(apontamento),
  }
}

export function paraDadoExterno(dado: DadoExternoApi): DadoExterno {
  return {
    id: dado.id,
    nome: dado.nome,
    idTipo: dado['id tipo'],
    tipo: dado.tipo,
    situacao: dado.situacao,
    situacaoDescricao: dado['situacao descricao'] ?? '',
    tarefaBitrix: paraTarefaBitrix(dado['tarefa bitrix']),
    sistemaOrigem: dado['sistema de origem'],
    identificador: ouNulo(dado.identificador),
    campoCalculo: ouNulo(dado['campo calculo']),
    referencia: dado.referencia,
    coleta: dado.coleta,
    diaDaColeta: ouNulo(dado['dia da coleta']),
    coletaDescricao: ouNulo(dado['coleta descricao']),
    sentidoCalculo: dado['sentido do calculo'],
    janelaRetroativa: ouNulo(dado['janela retroativa']),
    comentarios: ouNulo(dado.comentarios),
    tipoValor: paraTipoValor(dado['tipo de valor']),
    coletaDisponivel: dado['coleta disponivel'] === true,
    indicadores: lista(dado.indicadores, (nome) => nome),
    ...paraAuditoria(dado),
  }
}

function paraComponenteIndicador(item: ComponenteIndicadorApi): ComponenteIndicador {
  return { id: item.id, nome: item.nome, ativo: item.ativo === true }
}

function paraComposicao(composicao: ComposicaoIndicadorApi): ComposicaoIndicador {
  return { tipo: composicao.tipo, itens: lista(composicao.itens, paraComponenteIndicador) }
}

function paraProblema(problema: ProblemaIndicadorApi | null | undefined): ProblemaIndicador | null {
  if (!problema) return null
  return { tipo: problema.tipo, mensagem: problema.mensagem }
}

function paraDashboardDoIndicador(dashboard: DashboardDoIndicadorApi): DashboardDoIndicador {
  return { id: dashboard.id, nome: dashboard.nome, pontosBase: dashboard['pontos base'] }
}

export function paraIndicador(indicador: IndicadorApi): Indicador {
  return {
    id: indicador.id,
    nome: indicador.nome,
    descricao: ouNulo(indicador.descricao),
    ativo: indicador.ativo === true,
    composicao: paraComposicao(indicador.composicao),
    tipos: lista(indicador.tipos, (tipo) => tipo),
    sentido: ouNulo(indicador.sentido),
    calculo: ouNulo(indicador.calculo),
    meta: ouNulo(indicador.meta),
    metaADefinir: indicador['meta a definir'] === true,
    origemDaMeta: ouNulo(indicador['origem da meta']),
    metaEditavel: indicador['meta editavel no preenchimento'] === true,
    criadoAutomaticamente: indicador['criado automaticamente'] === true,
    componentesDesativados: indicador['componentes desativados'] === true,
    problema: paraProblema(indicador.problema),
    dashboards: lista(indicador.dashboards, paraDashboardDoIndicador),
    vinculadoADashboard: indicador['vinculado a dashboard'] === true,
    ...paraAuditoria(indicador),
  }
}

function paraAlertaDashboard(alerta: AlertaDashboardApi): AlertaDashboard {
  return { indicador: alerta.indicador, motivo: alerta.motivo, pontosAfetados: alerta['pontos afetados'] }
}

export function paraDashboard(dashboard: DashboardApi): Dashboard {
  return {
    id: dashboard.id,
    nome: dashboard.nome,
    situacao: dashboard.situacao,
    situacaoDescricao: dashboard['situacao descricao'] ?? '',
    tarefaBitrix: paraTarefaBitrix(dashboard['tarefa bitrix']),
    tipoVinculo: dashboard['tipo de vinculo'],
    itensVinculados: listaDeTextos(dashboard['itens vinculados']),
    unidadesDeImagem: dashboard['unidades de imagem'] ?? 0,
    periodicidade: dashboard.periodicidade,
    periodoAtual: dashboard['periodo atual'],
    quantidadeDeIndicadores: dashboard['quantidade de indicadores'] ?? 0,
    pontos: { soma: dashboard.pontos?.soma ?? 0, maximo: dashboard.pontos?.maximo ?? 0 },
    alertas: lista(dashboard.alertas, paraAlertaDashboard),
    cadastradoEm: ouNulo(dashboard['cadastrado em']),
    ultimaAlteracao: ouNulo(dashboard['ultima alteracao']),
  }
}

export function paraTabelaFaixas(tabela: TabelaFaixasApi): TabelaFaixas {
  const faixas = lista(tabela.faixas, paraFaixa)
  return {
    id: tabela.id,
    idDashboard: tabela['id dashboard'],
    dashboard: tabela.dashboard,
    dashboardExcluido: tabela['dashboard excluido'] === true,
    filial: String(tabela.filial),
    nomeFilial: tabela['nome filial'],
    descricao: ouNulo(tabela.descricao),
    versaoVigente: tabela['versao vigente'],
    dataDaVersao: ouNulo(tabela['data da versao']),
    autorDaVersao: ouNulo(tabela['autor da versao']),
    quantidadeDeFaixas: tabela['quantidade de faixas'] ?? faixas.length,
    faixas,
  }
}

export function paraHistoricoMeta(historico: HistoricoMetaApi): HistoricoMeta {
  return {
    data: historico.data,
    filial: String(historico.filial),
    mesDeReferencia: historico['mes de referencia'],
    de: ouNulo(historico.de),
    para: historico.para,
    usuario: historico.usuario,
    motivo: historico.motivo,
  }
}

export function paraFechamento(fechamento: FechamentoApi): Fechamento {
  return {
    id: fechamento.id,
    nome: fechamento.nome,
    tipoVinculo: fechamento['tipo de vinculo'],
    itensVinculados: listaDeTextos(fechamento['itens vinculados']),
    periodicidade: fechamento.periodicidade,
    periodoAtual: fechamento['periodo atual'],
    situacaoDoPeriodo: fechamento['situacao do periodo'],
    unidadesDeImagem: fechamento['unidades de imagem'] ?? 0,
    unidadesEncerradas: fechamento['unidades encerradas'] ?? 0,
    unidadesComPendencias: fechamento['unidades com pendencias'] ?? 0,
    progresso: paraProgresso(fechamento.progresso),
    indicadoresComProblema: lista(fechamento['indicadores com problema'], (nome) => nome),
    unidadesSemTabelaDeFaixas: listaDeTextos(fechamento['unidades sem tabela de faixas']),
  }
}

// ---------------------------------------------------------------------------
// Volta: dados do formulário → corpo da requisição
// ---------------------------------------------------------------------------

/** Texto opcional: `undefined`, `null` ou só espaços viram `null`. */
function textoOuNulo(valor: string | null | undefined): string | null {
  if (valor === undefined || valor === null) return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

/** Corpo de `POST /api/ped/apontamentos`. */
export function paraCorpoNovoApontamento(dados: NovoApontamento): CorpoNovoApontamento {
  return {
    nome: dados.nome,
    'id tipo': dados.idTipo,
    'tipo de valor': dados.tipoValor,
    descricao: textoOuNulo(dados.descricao),
  }
}

/**
 * Corpo de `POST /api/ped/dados-externos-cadastro`. O identificador é enviado em maiúsculas, como
 * a API grava; `null` quando não informado (pedido de construção à TI).
 */
export function paraCorpoNovoDadoExterno(dados: NovoDadoExterno): CorpoNovoDadoExterno {
  const identificador = textoOuNulo(dados.identificador)
  return {
    nome: dados.nome,
    'id tipo': dados.idTipo,
    'sistema de origem': dados.sistemaOrigem,
    'tipo de valor': dados.tipoValor,
    referencia: dados.referencia,
    coleta: dados.coleta,
    'dia da coleta': dados.diaDaColeta ?? null,
    'sentido do calculo': dados.sentidoCalculo,
    'janela retroativa': dados.janelaRetroativa ?? null,
    comentarios: dados.comentarios ?? null,
    'campo calculo': dados.campoCalculo ?? null,
    identificador: identificador === null ? null : identificador.toUpperCase(),
    observacao: dados.observacao ?? null,
  }
}

/**
 * Corpo de `POST /api/ped/indicadores-cadastro`. A composição é por `apontamentos` (com `calculo`)
 * ou por `dado externo` (sem `calculo` nem `apontamentos`); a origem da meta é sempre `manual`.
 */
export function paraCorpoNovoIndicador(dados: NovoIndicador): CorpoNovoIndicador {
  const corpo: CorpoNovoIndicador = {
    nome: dados.nome,
    descricao: dados.descricao ?? null,
    'origem da meta': 'manual',
    meta: dados.meta,
    sentido: dados.sentido,
    'meta editavel': dados.metaEditavel,
  }

  if (dados.dadoExterno !== undefined) {
    corpo['dado externo'] = dados.dadoExterno
    return corpo
  }

  corpo.apontamentos = dados.apontamentos ?? []
  if (dados.calculo !== undefined) corpo.calculo = dados.calculo
  return corpo
}

/**
 * Corpo de `POST`/`PUT /api/ped/dashboards`. `enviar tarefa ti` só entra quando informado
 * (edição que gera tarefa de modificação para a TI).
 */
export function paraCorpoDashboard(dados: DadosDashboard): CorpoDashboard {
  const corpo: CorpoDashboard = {
    nome: dados.nome,
    periodicidade: dados.periodicidade,
    'pontuacao base maxima': dados.pontuacaoBaseMaxima,
    'tipo de vinculo': dados.tipoVinculo,
    'itens vinculados': [...dados.itensVinculados],
    indicadores: dados.indicadores.map((item) => ({
      'id indicador': item.idIndicador,
      'pontos base': item.pontosBase,
    })),
    'indicador base da faixa': dados.indicadorBaseDaFaixa,
    'formula de pontuacao': dados.formulaDePontuacao,
    'observacao para ti': dados.observacaoParaTi ?? null,
  }

  if (dados.enviarTarefaTi !== undefined) corpo['enviar tarefa ti'] = dados.enviarTarefaTi
  return corpo
}

/** Corpo de `POST /api/ped/faixas`. */
export function paraCorpoNovaTabelaFaixas(dados: NovaTabelaFaixas): CorpoNovaTabelaFaixas {
  return {
    dashboard: dados.dashboard,
    filial: dados.filial,
    descricao: dados.descricao ?? null,
    faixas: dados.faixas.map(paraFaixa),
  }
}

/** Corpo de `PUT /api/ped/preenchimento` (lançamento e correção; `motivo` só na correção). */
export function paraCorpoPreenchimento(dados: Preenchimento): CorpoPreenchimento {
  return {
    filial: dados.filial,
    'mes de referencia': dados.mesDeReferencia,
    itens: dados.itens.map((item) => {
      const corpoItem: CorpoItemPreenchimento = { 'id apontamento': item.idApontamento, valor: item.valor }
      if (item.motivo !== undefined) corpoItem.motivo = item.motivo
      return corpoItem
    }),
  }
}

/** Corpo de `PUT /api/ped/metas`. */
export function paraCorpoAjusteMetas(dados: AjusteMetas): CorpoAjusteMetas {
  return {
    filial: dados.filial,
    'mes de referencia': dados.mesDeReferencia,
    itens: dados.itens.map((item) => ({
      'id indicador': item.idIndicador,
      meta: item.meta,
      motivo: item.motivo,
    })),
  }
}
