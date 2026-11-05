/**
 * Aba "Dados Externos" (F5.2–F5.9 — RF-23 a RF-31, RN-12, RNF-01, RNF-07).
 *
 * Lista os dados externos filtrados pela API (busca e situação) e reúne as ações conforme a matriz
 * de permissões (`usePermissoes().podeAcao`):
 * - cadastro (todos): o Admin cadastra o dado já ativo, informando o identificador da consulta (com
 *   sugestões dos existentes); Validador/Preenchedor enviam um pedido de construção à TI e veem a
 *   tarefa gerada;
 * - concluir construção (Admin): erro exibido dentro do diálogo; avisa o indicador criado (quando a
 *   resposta traz o indicador; sem o dado na resposta, a conclusão ainda conta como sucesso);
 * - ativar/desativar e excluir, sempre com confirmação (`useAcoesSituacaoExclusao`), com um único aviso
 *   de erro de ação na página.
 * Dados externos não são editáveis (RF-29).
 */
import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcoesSituacaoExclusao } from '../../hooks/useAcoesSituacaoExclusao'
import { mensagemDeErro } from '../../services/api'
import {
  ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO,
  SITUACOES_FILTRO_DADO_EXTERNO,
  listarIdentificadores,
  type SituacaoFiltroDadoExterno,
} from '../../services/dadosExternosService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { DadoExterno, IdentificadorColeta, NovoDadoExterno } from '../../types/dominio'
import { DialogoConcluirConstrucao } from './DialogoConcluirConstrucao'
import { DialogoExcluirDadoExterno } from './DialogoExcluirDadoExterno'
import { DialogoSituacaoDadoExterno } from './DialogoSituacaoDadoExterno'
import { FormularioDadoExterno } from './FormularioDadoExterno'
import { TabelaDadosExternos } from './TabelaDadosExternos'
import { FILTROS_PADRAO, useDadosExternos } from './useDadosExternos'
import './DadosExternosPage.css'

const MENSAGEM_CADASTRADO = 'Dado externo cadastrado.'
const MENSAGEM_CONCLUIDA = 'Construção concluída.'
const MENSAGENS_ACOES = { situacao: 'Situação alterada.', exclusao: 'Dado externo excluído.' }

const OPCOES_SITUACAO: OpcaoSituacao[] = SITUACOES_FILTRO_DADO_EXTERNO.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO[situacao],
}))

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroDadoExterno {
  return (SITUACOES_FILTRO_DADO_EXTERNO as readonly string[]).includes(valor)
}

/** Resumo do pedido de construção enviado à TI (Validador/Preenchedor). */
interface PedidoEnviado {
  titulo: string
  descricao: string | null
  idTarefa: number | null
}

export function DadosExternosPage() {
  const {
    dadosExternos,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    concluir,
    alterarSituacao,
    excluir,
  } = useDadosExternos()
  const { acesso } = useSessao()
  const { podeAcao } = usePermissoes()
  const podeCadastrarAtivo = podeAcao('cadastrar-dado-externo-ativo')
  const podeConcluir = podeAcao('concluir-dado-externo')
  const podeAlterarSituacao = podeAcao('alterar-situacao-dado-externo')
  const podeExcluir = podeAcao('excluir-dado-externo')
  const tiposDoUsuario = acesso?.tipos ?? []

  const [notificacao, setNotificacao] = useState<string | null>(null)
  /** Nome do indicador criado automaticamente na última conclusão. */
  const [indicadorCriado, setIndicadorCriado] = useState<string | null>(null)

  /** Identificadores existentes, sugeridos ao Admin no cadastro e na conclusão. */
  const [identificadores, setIdentificadores] = useState<IdentificadorColeta[]>([])
  const consultaIdentificadoresRef = useRef(0)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  const [pedidoEnviado, setPedidoEnviado] = useState<PedidoEnviado | null>(null)

  const [concluindoDado, setConcluindoDado] = useState<DadoExterno | null>(null)
  const [concluindo, setConcluindo] = useState(false)
  const [erroConclusao, setErroConclusao] = useState<string | null>(null)
  const concluindoRef = useRef(false)

  /** Ativar/desativar e excluir, com um único erro de ação exibido na página. */
  const {
    situacao,
    exclusao,
    erro: erroAcao,
    limparErros: limparErrosDasAcoes,
  } = useAcoesSituacaoExclusao<DadoExterno>({
    alterarSituacao: (dado) => alterarSituacao(dado.id, dado.situacao !== 'ativo'),
    excluir: (dado) => excluir(dado.id),
    onNotificar: setNotificacao,
    mensagens: MENSAGENS_ACOES,
  })

  const filtroAtivo = filtros.busca !== FILTROS_PADRAO.busca || filtros.situacao !== FILTROS_PADRAO.situacao
  const textoVazio = filtroAtivo ? 'Nenhum dado externo encontrado para os filtros.' : 'Nenhum dado externo cadastrado.'

  /** Consulta os identificadores existentes; em caso de falha, segue sem sugestões. */
  function carregarIdentificadores() {
    const consulta = ++consultaIdentificadoresRef.current
    setIdentificadores([])
    listarIdentificadores().then(
      (lista) => {
        if (montadoRef.current && consulta === consultaIdentificadoresRef.current) setIdentificadores(lista)
      },
      () => {
        if (montadoRef.current && consulta === consultaIdentificadoresRef.current) setIdentificadores([])
      },
    )
  }

  function abrirCadastro() {
    setErroCadastro(null)
    setCadastroAberto(true)
    if (podeCadastrarAtivo) carregarIdentificadores()
  }

  function fecharCadastro() {
    if (salvandoRef.current) return
    setCadastroAberto(false)
    setErroCadastro(null)
  }

  async function salvar(dados: NovoDadoExterno) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroCadastro(null)
    try {
      // Qualquer POST 2xx conta como sucesso, mesmo sem um dado reconhecível na resposta
      // (`dadoExterno` null): o hook já recarregou a lista, então o fluxo não depende dele.
      const { tarefa } = await criar(dados)
      if (!montadoRef.current) return
      setCadastroAberto(false)
      limparErrosDasAcoes()
      if (podeCadastrarAtivo) {
        setNotificacao(MENSAGEM_CADASTRADO)
      } else {
        // Sem tarefa na resposta, o título padrão usa o nome informado no formulário.
        setPedidoEnviado({
          titulo: tarefa?.titulo ?? `[PED] Construir dado externo: ${dados.nome}`,
          descricao: tarefa?.descricao ?? null,
          idTarefa: tarefa?.id ?? null,
        })
      }
    } catch (falha) {
      if (montadoRef.current) setErroCadastro(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  function abrirConclusao(dado: DadoExterno) {
    setErroConclusao(null)
    setConcluindoDado(dado)
    carregarIdentificadores()
  }

  function fecharConclusao() {
    if (concluindoRef.current) return
    setConcluindoDado(null)
    setErroConclusao(null)
  }

  async function confirmarConclusao(identificador: string) {
    if (concluindoRef.current || concluindoDado === null) return
    concluindoRef.current = true
    setConcluindo(true)
    setErroConclusao(null)
    try {
      const resultado = await concluir(concluindoDado.id, identificador)
      if (!montadoRef.current) return
      setConcluindoDado(null)
      limparErrosDasAcoes()
      setIndicadorCriado(resultado?.indicadorCriado?.nome ?? null)
      setNotificacao(MENSAGEM_CONCLUIDA)
    } catch (falha) {
      if (montadoRef.current) setErroConclusao(mensagemDeErro(falha))
    } finally {
      concluindoRef.current = false
      if (montadoRef.current) setConcluindo(false)
    }
  }

  return (
    <div className="dados-externos-page">
      <div className="dados-externos-page__cabecalho">
        <h1>Dados Externos</h1>
        <Botao onClick={abrirCadastro}>Novo dado externo</Botao>
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando dados externos..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {erroAcao !== null ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      {indicadorCriado !== null ? (
        <Aviso tipo="info">
          {`Indicador ${indicadorCriado} criado automaticamente. Defina a meta na aba Indicadores.`}
        </Aviso>
      ) : null}

      <Card semPadding className="dados-externos-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Nome, origem, identificador, campo, tipo ou referência"
          situacoes={OPCOES_SITUACAO}
          situacao={filtros.situacao}
          onSituacaoChange={(valor) => {
            if (ehSituacaoFiltro(valor)) setSituacao(valor)
          }}
          rotuloSituacoes="Situação"
          onLimpar={limparFiltros}
        />
        {carregouUmaVez && erro === null ? (
          <TabelaDadosExternos
            dados={dadosExternos}
            podeConcluir={podeConcluir}
            podeAlterarSituacao={podeAlterarSituacao}
            podeExcluir={podeExcluir}
            onConcluir={abrirConclusao}
            onAlterarSituacao={situacao.abrir}
            onExcluir={exclusao.abrir}
            textoVazio={textoVazio}
          />
        ) : null}
      </Card>

      <Dialogo
        aberto={cadastroAberto}
        titulo="Novo dado externo"
        onFechar={fecharCadastro}
        className="dialogo--largo"
      >
        <FormularioDadoExterno
          tipos={tiposDoUsuario}
          variante={podeCadastrarAtivo ? 'admin' : 'solicitacao'}
          identificadores={identificadores}
          salvando={salvando}
          erro={erroCadastro}
          onSalvar={(dados) => void salvar(dados)}
          onCancelar={fecharCadastro}
        />
      </Dialogo>

      <Dialogo
        aberto={pedidoEnviado !== null}
        titulo="Pedido enviado à TI"
        onFechar={() => setPedidoEnviado(null)}
        acoes={<Botao onClick={() => setPedidoEnviado(null)}>Entendi</Botao>}
      >
        {pedidoEnviado !== null ? (
          <div className="dados-externos-page__pedido">
            <p>Pedido de construção enviado à TI.</p>
            <p className="dados-externos-page__pedido-titulo">{pedidoEnviado.titulo}</p>
            {pedidoEnviado.descricao ? <p>{pedidoEnviado.descricao}</p> : null}
            {pedidoEnviado.idTarefa !== null ? <p>{`Tarefa nº ${pedidoEnviado.idTarefa}`}</p> : null}
          </div>
        ) : null}
      </Dialogo>

      <DialogoConcluirConstrucao
        dado={concluindoDado}
        identificadores={identificadores}
        concluindo={concluindo}
        erro={erroConclusao}
        onConfirmar={(identificador) => void confirmarConclusao(identificador)}
        onCancelar={fecharConclusao}
      />

      <DialogoSituacaoDadoExterno
        dado={situacao.alvo}
        alterando={situacao.executando}
        onConfirmar={() => void situacao.confirmar()}
        onCancelar={situacao.cancelar}
      />

      <DialogoExcluirDadoExterno
        dado={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
