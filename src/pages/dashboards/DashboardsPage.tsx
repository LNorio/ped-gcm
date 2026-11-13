/**
 * Aba "Dashboards" (F7.2, F7.3, F7.7–F7.10 — RF-47 a RF-59, RNF-01, RNF-07).
 *
 * Lista os dashboards filtrados pela API (busca e situação) e reúne as ações conforme a matriz de
 * permissões (`usePermissoes().podeAcao`):
 * - cadastro ("Novo dashboard") e edição ("Editar") no mesmo diálogo largo com o `FormularioDashboard`.
 *   Ao abrir, carrega em paralelo as cinco listas do formulário (indicadores, dados externos, filiais,
 *   cargos e colaboradores); na edição, carrega também o detalhe e as tarefas do dashboard;
 * - pesos dos indicadores (na própria tabela) e histórico de modificações (`DialogoHistoricoDashboard`);
 * - "Preencher apontamentos" abre `/preenchimento?dashboard={id}`;
 * - desativar/ativar e excluir (`useAcoesSituacaoExclusao`) e concluir construção/modificação
 *   (`useAcaoConfirmada`), sempre com confirmação e um único aviso de erro de ação na página.
 * Com dashboard ativo com indicador problemático na lista, mostra o alerta geral (RF-47); com dashboard
 * ativo com alerta de faixas, mostra um aviso próprio, separado (F7.14).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
import { useAcoesSituacaoExclusao } from '../../hooks/useAcoesSituacaoExclusao'
import { mensagemDeErro } from '../../services/api'
import { listarDadosExternos } from '../../services/dadosExternosService'
import {
  type DetalheDashboard,
  ROTULOS_SITUACAO_FILTRO_DASHBOARD,
  type ResultadoGravacaoDashboard,
  SITUACOES_FILTRO_DASHBOARD,
  type SituacaoFiltroDashboard,
  type TarefaDashboard,
  listarCargosVinculo,
  listarColaboradoresVinculo,
  listarFiliaisVinculo,
  listarTarefasDashboard,
  obterDashboard,
  obterPreviaTarefa,
} from '../../services/dashboardsService'
import { listarIndicadores } from '../../services/indicadoresService'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { DadosDashboard, Dashboard } from '../../types/dominio'
import { fraseTarefaGravada } from '../../utils/tarefaBitrix'
import { DialogoConcluirDashboard } from './DialogoConcluirDashboard'
import { DialogoExcluirDashboard } from './DialogoExcluirDashboard'
import { DialogoHistoricoDashboard } from './DialogoHistoricoDashboard'
import { DialogoSituacaoDashboard } from './DialogoSituacaoDashboard'
import { FormularioDashboard, type ListasFormularioDashboard } from './FormularioDashboard'
import { TabelaDashboards } from './TabelaDashboards'
import { FILTROS_PADRAO, useDashboards } from './useDashboards'
import './DashboardsPage.css'

const MENSAGENS_ACOES = { situacao: 'Situação do dashboard alterada.', exclusao: 'Dashboard excluído.' }
const MENSAGEM_CONCLUSAO = 'Conclusão registrada.'
const COMPLEMENTO_ALERTA = 'Corrija na aba Indicadores antes do encerramento.'
const COMPLEMENTO_ALERTA_FAIXAS = 'Corrija na aba Faixas antes do encerramento.'

const LISTAS_VAZIAS: ListasFormularioDashboard = {
  indicadores: [],
  dadosExternos: [],
  filiais: [],
  cargos: [],
  colaboradores: [],
}

const OPCOES_SITUACAO: OpcaoSituacao[] = SITUACOES_FILTRO_DASHBOARD.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_DASHBOARD[situacao],
}))

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroDashboard {
  return (SITUACOES_FILTRO_DASHBOARD as readonly string[]).includes(valor)
}

/** Frase da tarefa criada pelo back-end no Bitrix24 (com número ou "em instantes" — ver `fraseTarefaGravada`). */
function fraseTarefa(resultado: ResultadoGravacaoDashboard): string {
  return fraseTarefaGravada(resultado.tarefa)
}

function textoAlertaGeral(quantidade: number): string {
  return quantidade === 1
    ? `1 dashboard com indicador com problema. ${COMPLEMENTO_ALERTA}`
    : `${quantidade} dashboards com indicadores com problema. ${COMPLEMENTO_ALERTA}`
}

function textoAlertaFaixas(quantidade: number): string {
  return quantidade === 1
    ? `1 dashboard com alerta de faixas. ${COMPLEMENTO_ALERTA_FAIXAS}`
    : `${quantidade} dashboards com alertas de faixas. ${COMPLEMENTO_ALERTA_FAIXAS}`
}

/** Diálogo do formulário: cadastro ou edição de um dashboard da lista. */
type ModoFormulario = { modo: 'cadastro' } | { modo: 'edicao'; dashboard: Dashboard }

async function carregarListasFormulario(): Promise<ListasFormularioDashboard> {
  const [indicadores, dadosExternos, filiais, cargos, colaboradores] = await Promise.all([
    listarIndicadores(),
    listarDadosExternos(),
    listarFiliaisVinculo(),
    listarCargosVinculo(),
    listarColaboradoresVinculo(),
  ])
  return { indicadores: indicadores.indicadores, dadosExternos, filiais, cargos, colaboradores }
}

export function DashboardsPage() {
  const {
    dashboards,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    editar,
    alterarSituacao,
    concluir,
    excluir,
  } = useDashboards()
  const { podeAcao } = usePermissoes()
  const navigate = useNavigate()

  const podeCadastrar = podeAcao('cadastrar-dashboard')
  const podeEditar = podeAcao('editar-dashboard')
  const podeAlterarSituacao = podeAcao('alterar-situacao-dashboard')
  const podeConcluir = podeAcao('concluir-dashboard')
  const podeExcluir = podeAcao('excluir-dashboard')

  const [notificacao, setNotificacao] = useState<string | null>(null)
  const montadoRef = useRef(false)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Ações com confirmação. Um único erro de ação por vez: executar uma limpa o erro da outra.
  const limparErroConclusaoRef = useRef<() => void>(() => {})
  const {
    situacao,
    exclusao,
    erro: erroSituacaoExclusao,
    limparErros: limparErrosSituacaoExclusao,
  } = useAcoesSituacaoExclusao<Dashboard>({
    alterarSituacao: (dashboard) => {
      limparErroConclusaoRef.current()
      return alterarSituacao(dashboard.id, dashboard.situacao !== 'ativo')
    },
    excluir: (dashboard) => {
      limparErroConclusaoRef.current()
      return excluir(dashboard.id)
    },
    onNotificar: setNotificacao,
    mensagens: MENSAGENS_ACOES,
  })

  const conclusao = useAcaoConfirmada<Dashboard>(
    async (dashboard) => {
      limparErrosSituacaoExclusao()
      await concluir(dashboard.id)
    },
    { onSucesso: () => setNotificacao(MENSAGEM_CONCLUSAO) },
  )
  const { limparErro: limparErroConclusao } = conclusao
  useEffect(() => {
    limparErroConclusaoRef.current = limparErroConclusao
  }, [limparErroConclusao])

  const erroAcao = erroSituacaoExclusao ?? conclusao.erro
  const limparErrosDasAcoes = useCallback(() => {
    limparErrosSituacaoExclusao()
    limparErroConclusao()
  }, [limparErrosSituacaoExclusao, limparErroConclusao])

  // Formulário de cadastro e edição
  const [formulario, setFormulario] = useState<ModoFormulario | null>(null)
  const [listas, setListas] = useState<ListasFormularioDashboard>(LISTAS_VAZIAS)
  const [carregandoListas, setCarregandoListas] = useState(false)
  const [erroListas, setErroListas] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheDashboard | null>(null)
  const [tarefas, setTarefas] = useState<TarefaDashboard[]>([])
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  /** Identificam a consulta vigente: uma resposta antiga (de outra abertura) é descartada. */
  const consultaListasRef = useRef(0)
  const consultaDetalheRef = useRef(0)

  async function carregarListas() {
    const consulta = ++consultaListasRef.current
    const vigente = () => montadoRef.current && consulta === consultaListasRef.current
    setListas(LISTAS_VAZIAS)
    setErroListas(null)
    setCarregandoListas(true)
    try {
      const resultado = await carregarListasFormulario()
      if (vigente()) setListas(resultado)
    } catch (falha) {
      if (vigente()) setErroListas(mensagemDeErro(falha))
    } finally {
      if (vigente()) setCarregandoListas(false)
    }
  }

  async function carregarDetalhe(id: number) {
    const consulta = ++consultaDetalheRef.current
    const vigente = () => montadoRef.current && consulta === consultaDetalheRef.current
    setDetalhe(null)
    setTarefas([])
    setErroDetalhe(null)
    setCarregandoDetalhe(true)
    try {
      const [dashboard, listaTarefas] = await Promise.all([obterDashboard(id), listarTarefasDashboard(id)])
      if (!vigente()) return
      setDetalhe(dashboard)
      setTarefas(listaTarefas)
    } catch (falha) {
      if (vigente()) setErroDetalhe(mensagemDeErro(falha))
    } finally {
      if (vigente()) setCarregandoDetalhe(false)
    }
  }

  function abrirCadastro() {
    consultaDetalheRef.current++
    setDetalhe(null)
    setTarefas([])
    setErroDetalhe(null)
    setCarregandoDetalhe(false)
    setErroSalvar(null)
    setFormulario({ modo: 'cadastro' })
    void carregarListas()
  }

  function abrirEdicao(dashboard: Dashboard) {
    setErroSalvar(null)
    setFormulario({ modo: 'edicao', dashboard })
    void carregarListas()
    void carregarDetalhe(dashboard.id)
  }

  function fecharFormulario() {
    if (salvandoRef.current) return
    consultaListasRef.current++
    consultaDetalheRef.current++
    setFormulario(null)
    setErroSalvar(null)
  }

  async function salvar(dados: DadosDashboard) {
    if (salvandoRef.current || formulario === null) return
    salvandoRef.current = true
    setSalvando(true)
    setErroSalvar(null)
    try {
      // Qualquer 2xx conta como gravado: o hook recarrega a lista depois dele.
      let mensagem: string
      if (formulario.modo === 'cadastro') {
        const resultado = await criar(dados)
        mensagem = `Dashboard cadastrado. ${fraseTarefa(resultado)}`
      } else {
        const resultado = await editar(formulario.dashboard.id, dados)
        mensagem = dados.enviarTarefaTi
          ? `Dashboard atualizado. ${fraseTarefa(resultado)}`
          : 'Dashboard atualizado.'
      }
      if (!montadoRef.current) return
      setFormulario(null)
      limparErrosDasAcoes()
      setNotificacao(mensagem)
    } catch (falha) {
      if (montadoRef.current) setErroSalvar(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  const [historicoDe, setHistoricoDe] = useState<Dashboard | null>(null)

  const filtroAtivo = filtros.busca !== FILTROS_PADRAO.busca || filtros.situacao !== FILTROS_PADRAO.situacao
  const textoVazio = filtroAtivo ? 'Nenhum dashboard encontrado para os filtros.' : 'Nenhum dashboard cadastrado.'
  const comProblema = dashboards.filter((d) => d.situacao === 'ativo' && d.alertas.length > 0).length
  const comAlertaDeFaixas = dashboards.filter((d) => d.situacao === 'ativo' && d.alertasDeFaixas.length > 0).length
  const mostrarLista = carregouUmaVez && erro === null

  const edicao = formulario?.modo === 'edicao'
  const conteudoFormulario = (() => {
    if (formulario === null) return null
    const comum = {
      listas,
      carregandoListas,
      erroListas,
      onPrevia: obterPreviaTarefa,
      salvando,
      erro: erroSalvar,
      onSalvar: (dados: DadosDashboard) => void salvar(dados),
      onCancelar: fecharFormulario,
    }
    if (formulario.modo === 'cadastro') return <FormularioDashboard key="cadastro" {...comum} />
    if (detalhe === null) {
      return (
        <EstadoCarga
          carregando={carregandoDetalhe}
          mensagemCarregando="Carregando dashboard..."
          erro={erroDetalhe}
          onTentarNovamente={() => void carregarDetalhe(formulario.dashboard.id)}
        />
      )
    }
    return <FormularioDashboard key={`edicao-${detalhe.id}`} dashboard={detalhe} tarefas={tarefas} {...comum} />
  })()

  return (
    <div className="dashboards-page">
      <div className="dashboards-page__cabecalho">
        <h1>Dashboards</h1>
        {podeCadastrar ? <Botao onClick={abrirCadastro}>Novo dashboard</Botao> : null}
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando dashboards..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {erroAcao !== null ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      {mostrarLista && comProblema > 0 ? <Aviso tipo="alerta">{textoAlertaGeral(comProblema)}</Aviso> : null}

      {mostrarLista && comAlertaDeFaixas > 0 ? <Aviso tipo="alerta">{textoAlertaFaixas(comAlertaDeFaixas)}</Aviso> : null}

      <Card semPadding className="dashboards-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Dashboard, item vinculado ou indicador"
          situacoes={OPCOES_SITUACAO}
          situacao={filtros.situacao}
          onSituacaoChange={(valor) => {
            if (ehSituacaoFiltro(valor)) setSituacao(valor)
          }}
          rotuloSituacoes="Situação"
          onLimpar={limparFiltros}
        />
        {mostrarLista ? (
          <TabelaDashboards
            dashboards={dashboards}
            podeEditar={podeEditar}
            podeAlterarSituacao={podeAlterarSituacao}
            podeConcluir={podeConcluir}
            podeExcluir={podeExcluir}
            onEditar={abrirEdicao}
            onVerHistorico={setHistoricoDe}
            onPreencher={(dashboard) => void navigate(`/preenchimento?dashboard=${dashboard.id}`)}
            onAlterarSituacao={situacao.abrir}
            onConcluir={conclusao.abrir}
            onExcluir={exclusao.abrir}
            textoVazio={textoVazio}
          />
        ) : null}
      </Card>

      <Dialogo
        aberto={formulario !== null}
        titulo={edicao ? 'Editar dashboard' : 'Novo dashboard'}
        onFechar={fecharFormulario}
        className="dialogo--largo"
      >
        {conteudoFormulario}
      </Dialogo>

      <DialogoHistoricoDashboard dashboard={historicoDe} onFechar={() => setHistoricoDe(null)} />

      <DialogoSituacaoDashboard
        dashboard={situacao.alvo}
        alterando={situacao.executando}
        onConfirmar={() => void situacao.confirmar()}
        onCancelar={situacao.cancelar}
      />

      <DialogoConcluirDashboard
        dashboard={conclusao.alvo}
        concluindo={conclusao.executando}
        onConfirmar={() => void conclusao.confirmar()}
        onCancelar={conclusao.cancelar}
      />

      <DialogoExcluirDashboard
        dashboard={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
