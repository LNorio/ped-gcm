/**
 * Aba "Dados Externos" (F5.2–F5.9, F5.16–F5.18 — RF-23 a RF-31, RN-12, RNF-01, RNF-07).
 *
 * Lista os dados externos filtrados pela API (busca e situação; a opção "Integração pendente (TI)" só
 * aparece para quem configura a integração — Admin) e reúne as ações conforme a matriz de permissões
 * (`usePermissoes().podeAcao`):
 * - cadastro (todos): o Admin cadastra o dado já ativo, informando o identificador da consulta (com
 *   sugestões dos existentes); Validador/Preenchedor enviam um pedido de construção à TI e veem a
 *   tarefa criada pelo back-end no Bitrix24 (número ou "será criada em instantes");
 * - concluir construção (Admin): a modal registra a integração (identificador, URL e JSONs) e o PUT
 *   .../concluir leva os quatro campos. Avisa o indicador criado (quando a resposta traz o indicador;
 *   sem o dado na resposta, a conclusão ainda conta como sucesso);
 * - configurações da integração (Admin, F5.16): a mesma modal em modo "configurar", preenchida com os
 *   valores salvos, grava com PUT .../integracao → "Integração atualizada." e recarga da lista;
 * - nas duas, identificadores e variáveis são consultados a cada abertura, os JSONs são validados na
 *   tela e no back-end (`validarIntegracao`, F5.18) e o 400 mostra a mensagem geral no alerta da modal e
 *   os erros junto aos campos (`errosDaIntegracao`), sem fechar nem apagar nada; clique duplo grava uma vez;
 * - integração pendente (Admin, F5.17): a página consulta os pendentes ao carregar e depois de concluir
 *   ou salvar; com quantidade > 0 mostra o aviso com "Ver pendentes" (aplica o filtro) e marca a aba no
 *   menu (`definirAlerta('dados-externos', ...)`). Falha da consulta é silenciosa;
 * - ativar/desativar e excluir, sempre com confirmação (`useAcoesSituacaoExclusao`), com um único aviso
 *   de erro de ação na página.
 * Os dados do cadastro não são editáveis (RF-29); só a integração é configurável.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import {
  ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO,
  SITUACOES_FILTRO_DADO_EXTERNO,
  errosDaIntegracao,
  listarIdentificadores,
  listarIntegracoesPendentes,
  type SituacaoFiltroDadoExterno,
  validarIntegracao,
} from '../../services/dadosExternosService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { DadoExterno, ErroIntegracao, IdentificadorColeta, NovoDadoExterno, TarefaConstrucao } from '../../types/dominio'
import { fraseTarefaGravada, numeroTarefaEnviada } from '../../utils/tarefaBitrix'
import { type DadosConclusaoConstrucao, DialogoConcluirConstrucao, type ModoEdicaoIntegracao } from './DialogoConcluirConstrucao'
import { DialogoExcluirDadoExterno } from './DialogoExcluirDadoExterno'
import { DialogoSituacaoDadoExterno } from './DialogoSituacaoDadoExterno'
import { FormularioDadoExterno } from './FormularioDadoExterno'
import { TabelaDadosExternos } from './TabelaDadosExternos'
import { FILTROS_PADRAO, useDadosExternos } from './useDadosExternos'
import { useVariaveisIntegracao } from './useVariaveisIntegracao'
import './DadosExternosPage.css'

const MENSAGEM_CADASTRADO = 'Dado externo cadastrado.'
const MENSAGEM_CONCLUIDA = 'Construção concluída.'
const MENSAGEM_INTEGRACAO_ATUALIZADA = 'Integração atualizada.'
const MENSAGENS_ACOES = { situacao: 'Situação alterada.', exclusao: 'Dado externo excluído.' }

const OPCOES_SITUACAO_ADMIN: OpcaoSituacao[] = SITUACOES_FILTRO_DADO_EXTERNO.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO[situacao],
}))

/** Sem a permissão de configurar a integração, o filtro não oferece "Integração pendente (TI)". */
const OPCOES_SITUACAO_DEMAIS = OPCOES_SITUACAO_ADMIN.filter((opcao) => opcao.valor !== 'integracao_pendente')

const SEM_ERROS_CAMPOS: ErroIntegracao[] = []

/** "{n} dados externos com integração pendente (TI)." (singular com 1). */
function textoPendentes(quantidade: number): string {
  return quantidade === 1
    ? '1 dado externo com integração pendente (TI).'
    : `${quantidade} dados externos com integração pendente (TI).`
}

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroDadoExterno {
  return (SITUACOES_FILTRO_DADO_EXTERNO as readonly string[]).includes(valor)
}

/** Resumo do pedido de construção enviado à TI (Validador/Preenchedor). */
interface PedidoEnviado {
  titulo: string
  descricao: string | null
  /** Frase sobre a tarefa criada pelo back-end no Bitrix24 (com número ou "em instantes"). */
  fraseTarefa: string
}

/**
 * Frase do pedido enviado (FRONT-tarefas-bitrix.md, seção 2): "Tarefa #{id} criada no Bitrix para a
 * equipe de TI." quando já enviada; senão "Salvo. A tarefa para a TI será criada no Bitrix em instantes.".
 */
function textoPedidoEnviado(tarefa: TarefaConstrucao | null): string {
  const frase = fraseTarefaGravada(tarefa)
  return numeroTarefaEnviada(tarefa) === null ? `Salvo. ${frase}` : frase
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
    atualizarIntegracao,
    alterarSituacao,
    excluir,
  } = useDadosExternos()
  const { acesso } = useSessao()
  const { podeAcao } = usePermissoes()
  const podeCadastrarAtivo = podeAcao('cadastrar-dado-externo-ativo')
  const podeConcluir = podeAcao('concluir-dado-externo')
  const podeAlterarSituacao = podeAcao('alterar-situacao-dado-externo')
  const podeExcluir = podeAcao('excluir-dado-externo')
  const podeConfigurarIntegracao = podeAcao('configurar-integracao-dado-externo')
  const { definirAlerta } = useAlertasMenu()
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

  /** Modal da integração: concluir construção (F5.7) ou configurações (F5.16). */
  const [integracaoDado, setIntegracaoDado] = useState<DadoExterno | null>(null)
  const [modoIntegracao, setModoIntegracao] = useState<ModoEdicaoIntegracao>('concluir')
  const [gravandoIntegracao, setGravandoIntegracao] = useState(false)
  const [erroIntegracao, setErroIntegracao] = useState<string | null>(null)
  const [errosCamposIntegracao, setErrosCamposIntegracao] = useState<ErroIntegracao[]>(SEM_ERROS_CAMPOS)
  const gravandoIntegracaoRef = useRef(false)
  const variaveisIntegracao = useVariaveisIntegracao()

  /** Quantidade de dados com integração pendente (F5.17); `0` sem permissão ou depois de uma falha. */
  const [pendentes, setPendentes] = useState(0)
  const consultaPendentesRef = useRef(0)

  /** Consulta os pendentes (só Admin); a falha é silenciosa (sem aviso e sem marcador na aba). */
  const carregarPendentes = useCallback(() => {
    if (!podeConfigurarIntegracao) return
    const consulta = ++consultaPendentesRef.current
    const atual = () => montadoRef.current && consulta === consultaPendentesRef.current
    listarIntegracoesPendentes().then(
      ({ quantidade }) => {
        if (atual()) setPendentes(quantidade)
      },
      () => {
        if (atual()) setPendentes(0)
      },
    )
  }, [podeConfigurarIntegracao])

  useEffect(() => {
    carregarPendentes()
  }, [carregarPendentes])

  // Sinal na aba do menu, no mesmo commit do aviso. Não é limpo ao sair da aba: o alerta continua
  // valendo enquanto o Admin navega pelas demais telas.
  const temPendentes = podeConfigurarIntegracao && pendentes > 0
  useLayoutEffect(() => {
    definirAlerta('dados-externos', temPendentes)
  }, [definirAlerta, temPendentes])

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
          fraseTarefa: textoPedidoEnviado(tarefa),
        })
      }
    } catch (falha) {
      if (montadoRef.current) setErroCadastro(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  function limparErrosIntegracao() {
    setErroIntegracao(null)
    setErrosCamposIntegracao(SEM_ERROS_CAMPOS)
  }

  /** Abre a modal da integração; identificadores e variáveis são consultados a cada abertura. */
  function abrirIntegracao(dado: DadoExterno, modo: ModoEdicaoIntegracao) {
    limparErrosIntegracao()
    setModoIntegracao(modo)
    setIntegracaoDado(dado)
    carregarIdentificadores()
    variaveisIntegracao.carregar()
  }

  function fecharIntegracao() {
    if (gravandoIntegracaoRef.current) return
    setIntegracaoDado(null)
    limparErrosIntegracao()
    variaveisIntegracao.descartar()
  }

  /**
   * Concluir (PUT .../concluir) ou salvar as configurações (PUT .../integracao): os quatro campos vão à
   * API (contrato de 09/11/2026); `variaveisUsadas` fica na tela. Depois do sucesso, os pendentes são
   * consultados de novo. No erro, a mensagem geral e os erros por campo ficam na modal aberta.
   */
  async function confirmarIntegracao({ identificador, url, parametrosSaida, parametrosEntrada }: DadosConclusaoConstrucao) {
    if (gravandoIntegracaoRef.current || integracaoDado === null) return
    gravandoIntegracaoRef.current = true
    setGravandoIntegracao(true)
    limparErrosIntegracao()
    const integracao = { identificador, url, parametrosSaida, parametrosEntrada }
    try {
      if (modoIntegracao === 'concluir') {
        const resultado = await concluir(integracaoDado.id, integracao)
        if (!montadoRef.current) return
        setIndicadorCriado(resultado?.indicadorCriado?.nome ?? null)
        setNotificacao(MENSAGEM_CONCLUIDA)
      } else {
        await atualizarIntegracao(integracaoDado.id, integracao)
        if (!montadoRef.current) return
        setNotificacao(MENSAGEM_INTEGRACAO_ATUALIZADA)
      }
      setIntegracaoDado(null)
      variaveisIntegracao.descartar()
      limparErrosDasAcoes()
      carregarPendentes()
    } catch (falha) {
      if (montadoRef.current) {
        setErroIntegracao(mensagemDeErro(falha))
        setErrosCamposIntegracao(errosDaIntegracao(falha))
      }
    } finally {
      gravandoIntegracaoRef.current = false
      if (montadoRef.current) setGravandoIntegracao(false)
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

      {temPendentes ? (
        <Aviso tipo="alerta">
          <div className="dados-externos-page__pendentes">
            <span>{textoPendentes(pendentes)}</span>
            <Botao variante="contorno" tamanho="pequeno" onClick={() => setSituacao('integracao_pendente')}>
              Ver pendentes
            </Botao>
          </div>
        </Aviso>
      ) : null}

      <Card semPadding className="dados-externos-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Nome, origem, identificador, campo, tipo ou referência"
          situacoes={podeConfigurarIntegracao ? OPCOES_SITUACAO_ADMIN : OPCOES_SITUACAO_DEMAIS}
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
            podeConfigurarIntegracao={podeConfigurarIntegracao}
            onConcluir={(dado) => abrirIntegracao(dado, 'concluir')}
            onConfigurarIntegracao={(dado) => abrirIntegracao(dado, 'configurar')}
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
            <p>{pedidoEnviado.fraseTarefa}</p>
            <p className="dados-externos-page__pedido-titulo">{pedidoEnviado.titulo}</p>
            {pedidoEnviado.descricao ? <p>{pedidoEnviado.descricao}</p> : null}
          </div>
        ) : null}
      </Dialogo>

      <DialogoConcluirConstrucao
        modo={modoIntegracao}
        dado={integracaoDado}
        identificadores={identificadores}
        variaveis={variaveisIntegracao.variaveis}
        carregandoVariaveis={variaveisIntegracao.carregando}
        erroVariaveis={variaveisIntegracao.erro}
        concluindo={gravandoIntegracao}
        erro={erroIntegracao}
        errosCampos={errosCamposIntegracao}
        validarNoServidor={validarIntegracao}
        onConfirmar={(dados) => void confirmarIntegracao(dados)}
        onCancelar={fecharIntegracao}
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
