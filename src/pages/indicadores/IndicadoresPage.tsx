/**
 * Aba "Indicadores" (F6.2–F6.9 — RF-32 a RF-40, RNF-01, RNF-07, RNF-09).
 *
 * Lista os indicadores filtrados pela API (busca e situação) e reúne as ações conforme a matriz de
 * permissões (`usePermissoes().podeAcao`), que libera a aba a Admin e Validador (excluir só o Admin):
 * - cadastro ("Novo indicador"): carrega os apontamentos e dados externos ativos ao abrir o diálogo;
 * - definir meta do automático sem meta, com o dado externo de origem (`DialogoDefinirMeta`);
 * - histórico de metas, filtrado pela filial do cabeçalho (`DialogoHistoricoMetas`);
 * - inativar/reativar e excluir, sempre com confirmação (`useAcoesSituacaoExclusao`), com um único
 *   aviso de erro de ação na página; o 400 da exclusão lista os dashboards que usam o indicador.
 * Indicadores não são editáveis (RF-37). Os alertas da aba (aguardando meta e com componente
 * desativado) aparecem no topo e marcam a aba no menu (`useAlertasMenu`).
 * Meta por filial (F6.10): a filial do cabeçalho e as filiais do acesso chegam ao cadastro, ao
 * "Definir meta" e à tabela (coluna Meta); a pendência por filial (`metaPendentePorFilial`) também
 * marca a aba no menu, sem aviso no topo (a etiqueta e os detalhes ficam na tabela).
 * Meta via API (F6.11): só o Admin (`configurar-integracao-indicador`) vê "Preencher integração" /
 * "Configurações" na tabela, que abrem a modal da integração do dado externo (`DialogoConcluirConstrucao`,
 * modo "configurar", `tipoAlvo` "indicador" — ver `useIntegracaoIndicador`) com a validação no back-end
 * (`validarIntegracao`); salvar grava, recarrega a lista e mostra "Integração atualizada.". O alerta
 * `integracaoPendente` também marca a aba no menu, só para o Admin, sem aviso no topo.
 * Erros 400 por filial (F6.10, contrato real): no POST do cadastro e no `PUT .../meta`, a mensagem
 * geral fica no alerta do diálogo e `errosPorFilial(falha)` vai para os campos das filiais
 * (`errosFiliais`), limpos ao reenviar e ao fechar.
 * Metas pendentes (F6.12): com `definir-meta-indicador` (Admin e Validador), "Definir metas pendentes"
 * abre `DialogoDefinirMetasPendentes` (ver `useMetasPendentesIndicador`); salvar grava, recarrega a
 * lista e mostra "Metas definidas.".
 * Contrato final da meta via API (F6.11): o filtro ganha "Integração pendente (TI)" (por último) só para
 * quem tem `configurar-integracao-indicador`; o cadastro e o "Definir meta" recebem
 * `consultaIntegracaoDisponivel` (`metaViaApi.integracao !== false`) e o "Definir meta" a lista de dados
 * externos, carregada ao abrir; "Ver integração do dado externo" (fonte `dado_externo`) abre a modal da
 * integração em modo leitura. No cadastro da fonte `integracao` por quem não configura a integração
 * (Validador), a notificação traz a frase da tarefa do Bitrix (`fraseTarefaGravada`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcoesSituacaoExclusao } from '../../hooks/useAcoesSituacaoExclusao'
import { useAlertasMenu } from '../../layout/AlertasMenu'
import { ApiError, mensagemDeErro } from '../../services/api'
import { listarApontamentos } from '../../services/apontamentosService'
import { listarDadosExternos, validarIntegracao } from '../../services/dadosExternosService'
import {
  type DadosMeta,
  type ErroDeFilial,
  ROTULOS_SITUACAO_FILTRO_INDICADOR,
  ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN,
  SITUACOES_FILTRO_INDICADOR,
  SITUACOES_FILTRO_INDICADOR_ADMIN,
  type SituacaoFiltroIndicador,
  errosPorFilial,
} from '../../services/indicadoresService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { Apontamento, DadoExterno, Filial, Indicador, NovoIndicador } from '../../types/dominio'
import { fraseTarefaGravada } from '../../utils/tarefaBitrix'
import { type AlvoIntegracao, DialogoConcluirConstrucao } from '../dados-externos/DialogoConcluirConstrucao'
import { DialogoDefinirMeta } from './DialogoDefinirMeta'
import { DialogoDefinirMetasPendentes } from './DialogoDefinirMetasPendentes'
import { DialogoExcluirIndicador } from './DialogoExcluirIndicador'
import { DialogoHistoricoMetas } from './DialogoHistoricoMetas'
import { DialogoSituacaoIndicador } from './DialogoSituacaoIndicador'
import { FormularioIndicador } from './FormularioIndicador'
import { TabelaIndicadores } from './TabelaIndicadores'
import { FILTROS_PADRAO, useIndicadores } from './useIndicadores'
import { useIntegracaoIndicador } from './useIntegracaoIndicador'
import { useMetasPendentesIndicador } from './useMetasPendentesIndicador'
import './IndicadoresPage.css'

const SEM_FILIAIS: Filial[] = []
const SEM_ERROS_FILIAIS: ErroDeFilial[] = []

const MENSAGEM_CADASTRADO = 'Indicador cadastrado.'
const MENSAGEM_META_DEFINIDA = 'Meta definida.'
const MENSAGEM_INTEGRACAO_ATUALIZADA = 'Integração atualizada.'
const MENSAGEM_METAS_DEFINIDAS = 'Metas definidas.'
const MENSAGENS_ACOES = { situacao: 'Situação alterada.', exclusao: 'Indicador excluído.' }

/**
 * Erro 400 da exclusão (FRONT-PED-mudancas.md, item 5): `{ mensagem, dashboards: [nomes] }` quando o
 * indicador está em dashboards (ou é o indicador-base das faixas de um). A mensagem passa a trazer, em
 * seguida, "Dashboards: {nomes separados por ", "}.". Lista vazia, ausente ou fora do formato (não é
 * lista de textos) mantém só a mensagem da API; outros erros seguem sem alteração.
 */
function comDashboardsDoErro(falha: unknown): unknown {
  if (!(falha instanceof ApiError) || falha.status !== 400) return falha
  const dados: unknown = falha.dados
  if (typeof dados !== 'object' || dados === null || !('dashboards' in dados)) return falha
  const { dashboards } = dados
  if (!Array.isArray(dashboards) || dashboards.length === 0) return falha
  if (!dashboards.every((nome): nome is string => typeof nome === 'string')) return falha
  const mensagem = falha.mensagem.trim()
  const separador = /[.!?:]$/.test(mensagem) ? ' ' : '. '
  return new ApiError(falha.status, `${mensagem}${separador}Dashboards: ${dashboards.join(', ')}.`, falha.dados)
}

const OPCOES_SITUACAO: OpcaoSituacao[] = SITUACOES_FILTRO_INDICADOR.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_INDICADOR[situacao],
}))

/** F6.11: o Admin vê também "Integração pendente (TI)", por último. */
const OPCOES_SITUACAO_ADMIN: OpcaoSituacao[] = SITUACOES_FILTRO_INDICADOR_ADMIN.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN[situacao],
}))

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroIndicador {
  return (SITUACOES_FILTRO_INDICADOR_ADMIN as readonly string[]).includes(valor)
}

/**
 * Alvo da modal em modo leitura (F6.11, fonte `dado_externo`): o dado externo da composição com a
 * integração recebida no indicador (vazia quando a API não a traz).
 */
function alvoLeituraDoDadoExterno(indicador: Indicador): AlvoIntegracao {
  const componente = indicador.composicao.itens[0]
  return {
    id: componente?.id ?? indicador.id,
    nome: componente?.nome ?? indicador.nome,
    identificador: null,
    url: null,
    parametrosSaida: null,
    parametrosEntrada: null,
    ...indicador.integracaoDoDadoExterno,
  }
}

/** "1 indicador ..." ou "2 indicadores ...", conforme a contagem. */
function textoContagem(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

export function IndicadoresPage() {
  const {
    indicadores,
    alertas,
    metaViaApi,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    definirMeta,
    alterarSituacao,
    excluir,
    atualizarIntegracao,
    definirMetasPendentes,
  } = useIndicadores()
  const { acesso, filialSelecionada } = useSessao()
  const filiaisDoAcesso = acesso?.filiais ?? SEM_FILIAIS
  const { podeAcao } = usePermissoes()
  const { definirAlerta } = useAlertasMenu()

  const podeCadastrar = podeAcao('cadastrar-indicador')
  const podeDefinirMeta = podeAcao('definir-meta-indicador')
  const podeVerHistorico = podeAcao('ver-historico-metas-indicador')
  const podeAlterarSituacao = podeAcao('alterar-situacao-indicador')
  const podeExcluir = podeAcao('excluir-indicador')
  const podeConfigurarIntegracao = podeAcao('configurar-integracao-indicador')
  /** F6.11: sem `"meta via api"` na listagem, a consulta é tratada como disponível (sem aviso). */
  const consultaIntegracaoDisponivel = metaViaApi?.integracao !== false

  const [notificacao, setNotificacao] = useState<string | null>(null)
  const montadoRef = useRef(false)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Sinal de alerta no menu: a aba fica marcada enquanto houver indicador aguardando meta, com
  // componente desativado, com filial sem meta (F6.10) ou, só para o Admin, com a integração da meta
  // pendente (F6.11). Usa useLayoutEffect para o sinal existir no mesmo commit da tabela (sem
  // um frame em que a tabela aparece e o marcador ainda não).
  const temAlerta =
    alertas.aguardandoMeta > 0 ||
    alertas.comComponenteDesativado > 0 ||
    alertas.metaPendentePorFilial > 0 ||
    (podeConfigurarIntegracao && (alertas.integracaoPendente ?? 0) > 0)
  useLayoutEffect(() => {
    definirAlerta('indicadores', temAlerta)
  }, [definirAlerta, temAlerta])

  /** Ativar/desativar e excluir, com um único erro de ação exibido na página. */
  const {
    situacao,
    exclusao,
    erro: erroAcao,
    limparErros: limparErrosDasAcoes,
  } = useAcoesSituacaoExclusao<Indicador>({
    alterarSituacao: (indicador) => alterarSituacao(indicador.id, !indicador.ativo),
    excluir: (indicador) => excluir(indicador.id).catch((falha: unknown) => Promise.reject(comDashboardsDoErro(falha))),
    onNotificar: setNotificacao,
    mensagens: MENSAGENS_ACOES,
  })

  // Cadastro
  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const [errosFiliaisCadastro, setErrosFiliaisCadastro] = useState<ErroDeFilial[]>(SEM_ERROS_FILIAIS)
  const salvandoRef = useRef(false)
  /** Apontamentos e dados externos ativos, carregados ao abrir o cadastro. */
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([])
  const [dadosExternos, setDadosExternos] = useState<DadoExterno[]>([])
  const [carregandoComponentes, setCarregandoComponentes] = useState(false)
  const [erroComponentes, setErroComponentes] = useState<string | null>(null)
  const consultaComponentesRef = useRef(0)

  /** Consulta os componentes ativos; uma resposta antiga não sobrescreve a mais recente. */
  async function carregarComponentes() {
    const consulta = ++consultaComponentesRef.current
    const vigente = () => montadoRef.current && consulta === consultaComponentesRef.current
    setApontamentos([])
    setDadosExternos([])
    setErroComponentes(null)
    setCarregandoComponentes(true)
    try {
      const [listaApontamentos, listaDadosExternos] = await Promise.all([
        listarApontamentos({ situacao: 'ativos' }),
        listarDadosExternos({ situacao: 'ativos' }),
      ])
      if (!vigente()) return
      setApontamentos(listaApontamentos.apontamentos)
      setDadosExternos(listaDadosExternos)
    } catch (falha) {
      if (vigente()) setErroComponentes(mensagemDeErro(falha))
    } finally {
      if (vigente()) setCarregandoComponentes(false)
    }
  }

  function abrirCadastro() {
    setErroCadastro(null)
    setErrosFiliaisCadastro(SEM_ERROS_FILIAIS)
    setCadastroAberto(true)
    void carregarComponentes()
  }

  function fecharCadastro() {
    if (salvandoRef.current) return
    setCadastroAberto(false)
    setErroCadastro(null)
    setErrosFiliaisCadastro(SEM_ERROS_FILIAIS)
  }

  async function salvar(dados: NovoIndicador) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroCadastro(null)
    setErrosFiliaisCadastro(SEM_ERROS_FILIAIS)
    try {
      // Qualquer POST 2xx conta como sucesso: o hook recarrega a lista depois dele.
      const criado = await criar(dados)
      if (!montadoRef.current) return
      setCadastroAberto(false)
      limparErrosDasAcoes()
      // F6.11: a fonte `integracao` cadastrada por quem não configura a integração gera tarefa para a TI.
      const geraTarefa = dados.origemDaMeta === 'terceiro' && (dados.fonteDaMeta ?? 'integracao') === 'integracao' && !podeConfigurarIntegracao
      setNotificacao(geraTarefa ? `${MENSAGEM_CADASTRADO} ${fraseTarefaGravada(criado?.tarefaBitrix)}` : MENSAGEM_CADASTRADO)
    } catch (falha) {
      if (montadoRef.current) {
        setErroCadastro(mensagemDeErro(falha))
        setErrosFiliaisCadastro(errosPorFilial(falha))
      }
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  // Definir meta
  const [indicadorMeta, setIndicadorMeta] = useState<Indicador | null>(null)
  const [definindoMeta, setDefinindoMeta] = useState(false)
  const [erroMeta, setErroMeta] = useState<string | null>(null)
  const [errosFiliaisMeta, setErrosFiliaisMeta] = useState<ErroDeFilial[]>(SEM_ERROS_FILIAIS)
  const definindoMetaRef = useRef(false)
  /** F6.11: dados externos do "Definir meta" (para saber se o dado de origem fornece meta). */
  const [dadosExternosMeta, setDadosExternosMeta] = useState<DadoExterno[]>([])
  const [carregandoDadosExternosMeta, setCarregandoDadosExternosMeta] = useState(false)
  const consultaDadosMetaRef = useRef(0)

  /** Consulta os dados externos; uma resposta antiga não sobrescreve a mais recente. Falha = lista vazia. */
  async function carregarDadosExternosMeta() {
    const consulta = ++consultaDadosMetaRef.current
    const vigente = () => montadoRef.current && consulta === consultaDadosMetaRef.current
    setDadosExternosMeta([])
    setCarregandoDadosExternosMeta(true)
    try {
      const lista = await listarDadosExternos()
      if (vigente()) setDadosExternosMeta(lista)
    } catch {
      // Sem a lista, o dado de origem é tratado como sem `forneceMeta` (fonte `integracao`).
    } finally {
      if (vigente()) setCarregandoDadosExternosMeta(false)
    }
  }

  function abrirDefinirMeta(indicador: Indicador) {
    setErroMeta(null)
    setErrosFiliaisMeta(SEM_ERROS_FILIAIS)
    setIndicadorMeta(indicador)
    void carregarDadosExternosMeta()
  }

  function fecharDefinirMeta() {
    if (definindoMetaRef.current) return
    setIndicadorMeta(null)
    setErroMeta(null)
    setErrosFiliaisMeta(SEM_ERROS_FILIAIS)
  }

  async function confirmarDefinirMeta(dados: DadosMeta) {
    if (definindoMetaRef.current || indicadorMeta === null) return
    definindoMetaRef.current = true
    setDefinindoMeta(true)
    setErroMeta(null)
    setErrosFiliaisMeta(SEM_ERROS_FILIAIS)
    try {
      await definirMeta(indicadorMeta.id, dados)
      if (!montadoRef.current) return
      setIndicadorMeta(null)
      limparErrosDasAcoes()
      setNotificacao(MENSAGEM_META_DEFINIDA)
    } catch (falha) {
      if (montadoRef.current) {
        setErroMeta(mensagemDeErro(falha))
        setErrosFiliaisMeta(errosPorFilial(falha))
      }
    } finally {
      definindoMetaRef.current = false
      if (montadoRef.current) setDefinindoMeta(false)
    }
  }

  // Integração da meta via API (F6.11, só Admin)
  const integracao = useIntegracaoIndicador({
    atualizarIntegracao,
    onSalva: () => {
      limparErrosDasAcoes()
      setNotificacao(MENSAGEM_INTEGRACAO_ATUALIZADA)
    },
  })

  // Integração do dado externo, só leitura (F6.11, fonte `dado_externo`, só Admin)
  const [integracaoLeitura, setIntegracaoLeitura] = useState<AlvoIntegracao | null>(null)

  // Metas das filiais pendentes (F6.12)
  const metasPendentes = useMetasPendentesIndicador({
    definirMetasPendentes,
    onSalvas: () => {
      limparErrosDasAcoes()
      setNotificacao(MENSAGEM_METAS_DEFINIDAS)
    },
  })

  // Histórico de metas: filtrado pela filial do cabeçalho ("todas" quando não há uma escolhida).
  const [historicoDe, setHistoricoDe] = useState<Indicador | null>(null)
  const filialHistorico = filialSelecionada !== null && filialSelecionada !== 'todas' ? filialSelecionada.codigo : 'todas'

  const filtroAtivo = filtros.busca !== FILTROS_PADRAO.busca || filtros.situacao !== FILTROS_PADRAO.situacao
  const textoVazio = filtroAtivo ? 'Nenhum indicador encontrado para os filtros.' : 'Nenhum indicador cadastrado.'

  return (
    <div className="indicadores-page">
      <div className="indicadores-page__cabecalho">
        <h1>Indicadores</h1>
        {podeCadastrar ? <Botao onClick={abrirCadastro}>Novo indicador</Botao> : null}
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando indicadores..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {erroAcao !== null ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      {alertas.aguardandoMeta > 0 ? (
        <Aviso tipo="alerta">
          {textoContagem(alertas.aguardandoMeta, 'indicador aguardando definição de meta.', 'indicadores aguardando definição de meta.')}
        </Aviso>
      ) : null}

      {alertas.comComponenteDesativado > 0 ? (
        <Aviso tipo="alerta">
          {textoContagem(alertas.comComponenteDesativado, 'indicador com componente desativado.', 'indicadores com componente desativado.')}
        </Aviso>
      ) : null}

      <Card semPadding className="indicadores-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Indicador, apontamento ou dado externo"
          situacoes={podeConfigurarIntegracao ? OPCOES_SITUACAO_ADMIN : OPCOES_SITUACAO}
          situacao={filtros.situacao}
          onSituacaoChange={(valor) => {
            if (ehSituacaoFiltro(valor)) setSituacao(valor)
          }}
          rotuloSituacoes="Situação"
          onLimpar={limparFiltros}
        />
        {carregouUmaVez && erro === null ? (
          <TabelaIndicadores
            indicadores={indicadores}
            filialSelecionada={filialSelecionada}
            podeDefinirMeta={podeDefinirMeta}
            podeVerHistorico={podeVerHistorico}
            podeAlterarSituacao={podeAlterarSituacao}
            podeExcluir={podeExcluir}
            onDefinirMeta={abrirDefinirMeta}
            onVerHistorico={setHistoricoDe}
            onAlterarSituacao={situacao.abrir}
            onExcluir={exclusao.abrir}
            podeConfigurarIntegracao={podeConfigurarIntegracao}
            onConfigurarIntegracao={integracao.abrir}
            onVerIntegracaoDadoExterno={(indicador) => setIntegracaoLeitura(alvoLeituraDoDadoExterno(indicador))}
            podeDefinirMetasPendentes={podeDefinirMeta}
            onDefinirMetasPendentes={metasPendentes.abrir}
            textoVazio={textoVazio}
          />
        ) : null}
      </Card>

      <Dialogo aberto={cadastroAberto} titulo="Novo indicador" onFechar={fecharCadastro} className="dialogo--largo">
        <FormularioIndicador
          apontamentos={apontamentos}
          dadosExternos={dadosExternos}
          carregandoComponentes={carregandoComponentes}
          erroComponentes={erroComponentes}
          salvando={salvando}
          erro={erroCadastro}
          errosFiliais={errosFiliaisCadastro}
          filialSelecionada={filialSelecionada}
          filiais={filiaisDoAcesso}
          consultaIntegracaoDisponivel={consultaIntegracaoDisponivel}
          onSalvar={(dados) => void salvar(dados)}
          onCancelar={fecharCadastro}
        />
      </Dialogo>

      <DialogoDefinirMeta
        indicador={indicadorMeta}
        definindo={definindoMeta}
        erro={erroMeta}
        errosFiliais={errosFiliaisMeta}
        filialSelecionada={filialSelecionada}
        filiais={filiaisDoAcesso}
        dadosExternos={dadosExternosMeta}
        carregandoDadosExternos={carregandoDadosExternosMeta}
        consultaIntegracaoDisponivel={consultaIntegracaoDisponivel}
        onConfirmar={(dados) => void confirmarDefinirMeta(dados)}
        onCancelar={fecharDefinirMeta}
      />

      <DialogoDefinirMetasPendentes
        indicador={metasPendentes.alvo}
        definindo={metasPendentes.gravando}
        erro={metasPendentes.erro}
        errosFiliais={metasPendentes.errosFiliais}
        filialSelecionada={filialSelecionada}
        filiais={filiaisDoAcesso}
        onConfirmar={(metas) => void metasPendentes.confirmar(metas)}
        onCancelar={metasPendentes.fechar}
      />

      {podeConfigurarIntegracao ? (
        <DialogoConcluirConstrucao
          modo="configurar"
          tipoAlvo="indicador"
          dado={integracao.alvo}
          identificadores={integracao.identificadores}
          variaveis={integracao.variaveis.variaveis}
          carregandoVariaveis={integracao.variaveis.carregando}
          erroVariaveis={integracao.variaveis.erro}
          concluindo={integracao.gravando}
          erro={integracao.erro}
          errosCampos={integracao.errosCampos}
          validarNoServidor={validarIntegracao}
          onConfirmar={(dados) => void integracao.confirmar(dados)}
          onCancelar={integracao.fechar}
        />
      ) : null}

      {podeConfigurarIntegracao ? (
        <DialogoConcluirConstrucao modo="leitura" dado={integracaoLeitura} onCancelar={() => setIntegracaoLeitura(null)} />
      ) : null}

      <DialogoHistoricoMetas indicador={historicoDe} filial={filialHistorico} onFechar={() => setHistoricoDe(null)} />

      <DialogoSituacaoIndicador
        indicador={situacao.alvo}
        alterando={situacao.executando}
        onConfirmar={() => void situacao.confirmar()}
        onCancelar={situacao.cancelar}
      />

      <DialogoExcluirIndicador
        indicador={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
