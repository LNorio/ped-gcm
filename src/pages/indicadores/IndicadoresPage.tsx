/**
 * Aba "Indicadores" (F6.2–F6.9 — RF-32 a RF-40, RNF-01, RNF-07, RNF-09).
 *
 * Lista os indicadores filtrados pela API (busca e situação) e reúne as ações conforme a matriz de
 * permissões (`usePermissoes().podeAcao`), que hoje libera a aba inteira a Admin e Validador:
 * - cadastro ("Novo indicador"): carrega os apontamentos e dados externos ativos ao abrir o diálogo;
 * - definir meta do automático sem meta, com o dado externo de origem (`DialogoDefinirMeta`);
 * - histórico de metas, filtrado pela filial do cabeçalho (`DialogoHistoricoMetas`);
 * - inativar/reativar e excluir, sempre com confirmação (`useAcoesSituacaoExclusao`), com um único
 *   aviso de erro de ação na página.
 * Indicadores não são editáveis (RF-37). Os alertas da aba (aguardando meta e com componente
 * desativado) aparecem no topo e marcam a aba no menu (`useAlertasMenu`).
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
import { mensagemDeErro } from '../../services/api'
import { listarApontamentos } from '../../services/apontamentosService'
import { listarDadosExternos } from '../../services/dadosExternosService'
import {
  type DadosMeta,
  ROTULOS_SITUACAO_FILTRO_INDICADOR,
  SITUACOES_FILTRO_INDICADOR,
  type SituacaoFiltroIndicador,
} from '../../services/indicadoresService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { Apontamento, DadoExterno, Indicador, NovoIndicador } from '../../types/dominio'
import { DialogoDefinirMeta } from './DialogoDefinirMeta'
import { DialogoExcluirIndicador } from './DialogoExcluirIndicador'
import { DialogoHistoricoMetas } from './DialogoHistoricoMetas'
import { DialogoSituacaoIndicador } from './DialogoSituacaoIndicador'
import { FormularioIndicador } from './FormularioIndicador'
import { TabelaIndicadores } from './TabelaIndicadores'
import { FILTROS_PADRAO, useIndicadores } from './useIndicadores'
import './IndicadoresPage.css'

const MENSAGEM_CADASTRADO = 'Indicador cadastrado.'
const MENSAGEM_META_DEFINIDA = 'Meta definida.'
const MENSAGENS_ACOES = { situacao: 'Situação alterada.', exclusao: 'Indicador excluído.' }

const OPCOES_SITUACAO: OpcaoSituacao[] = SITUACOES_FILTRO_INDICADOR.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_INDICADOR[situacao],
}))

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroIndicador {
  return (SITUACOES_FILTRO_INDICADOR as readonly string[]).includes(valor)
}

/** "1 indicador ..." ou "2 indicadores ...", conforme a contagem. */
function textoContagem(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

export function IndicadoresPage() {
  const {
    indicadores,
    alertas,
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
  } = useIndicadores()
  const { filialSelecionada } = useSessao()
  const { podeAcao } = usePermissoes()
  const { definirAlerta } = useAlertasMenu()

  const podeCadastrar = podeAcao('cadastrar-indicador')
  const podeDefinirMeta = podeAcao('definir-meta-indicador')
  const podeVerHistorico = podeAcao('ver-historico-metas-indicador')
  const podeAlterarSituacao = podeAcao('alterar-situacao-indicador')
  const podeExcluir = podeAcao('excluir-indicador')

  const [notificacao, setNotificacao] = useState<string | null>(null)
  const montadoRef = useRef(false)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Sinal de alerta no menu: a aba fica marcada enquanto houver indicador aguardando meta ou com
  // componente desativado. Usa useLayoutEffect para o sinal existir no mesmo commit da tabela (sem
  // um frame em que a tabela aparece e o marcador ainda não).
  const temAlerta = alertas.aguardandoMeta > 0 || alertas.comComponenteDesativado > 0
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
    excluir: (indicador) => excluir(indicador.id),
    onNotificar: setNotificacao,
    mensagens: MENSAGENS_ACOES,
  })

  // Cadastro
  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
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
    setCadastroAberto(true)
    void carregarComponentes()
  }

  function fecharCadastro() {
    if (salvandoRef.current) return
    setCadastroAberto(false)
    setErroCadastro(null)
  }

  async function salvar(dados: NovoIndicador) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroCadastro(null)
    try {
      // Qualquer POST 2xx conta como sucesso: o hook recarrega a lista depois dele.
      await criar(dados)
      if (!montadoRef.current) return
      setCadastroAberto(false)
      limparErrosDasAcoes()
      setNotificacao(MENSAGEM_CADASTRADO)
    } catch (falha) {
      if (montadoRef.current) setErroCadastro(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  // Definir meta
  const [indicadorMeta, setIndicadorMeta] = useState<Indicador | null>(null)
  const [definindoMeta, setDefinindoMeta] = useState(false)
  const [erroMeta, setErroMeta] = useState<string | null>(null)
  const definindoMetaRef = useRef(false)

  function abrirDefinirMeta(indicador: Indicador) {
    setErroMeta(null)
    setIndicadorMeta(indicador)
  }

  function fecharDefinirMeta() {
    if (definindoMetaRef.current) return
    setIndicadorMeta(null)
    setErroMeta(null)
  }

  async function confirmarDefinirMeta(dados: DadosMeta) {
    if (definindoMetaRef.current || indicadorMeta === null) return
    definindoMetaRef.current = true
    setDefinindoMeta(true)
    setErroMeta(null)
    try {
      await definirMeta(indicadorMeta.id, dados)
      if (!montadoRef.current) return
      setIndicadorMeta(null)
      limparErrosDasAcoes()
      setNotificacao(MENSAGEM_META_DEFINIDA)
    } catch (falha) {
      if (montadoRef.current) setErroMeta(mensagemDeErro(falha))
    } finally {
      definindoMetaRef.current = false
      if (montadoRef.current) setDefinindoMeta(false)
    }
  }

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
          situacoes={OPCOES_SITUACAO}
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
            podeDefinirMeta={podeDefinirMeta}
            podeVerHistorico={podeVerHistorico}
            podeAlterarSituacao={podeAlterarSituacao}
            podeExcluir={podeExcluir}
            onDefinirMeta={abrirDefinirMeta}
            onVerHistorico={setHistoricoDe}
            onAlterarSituacao={situacao.abrir}
            onExcluir={exclusao.abrir}
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
          onSalvar={(dados) => void salvar(dados)}
          onCancelar={fecharCadastro}
        />
      </Dialogo>

      <DialogoDefinirMeta
        indicador={indicadorMeta}
        definindo={definindoMeta}
        erro={erroMeta}
        onConfirmar={(dados) => void confirmarDefinirMeta(dados)}
        onCancelar={fecharDefinirMeta}
      />

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
