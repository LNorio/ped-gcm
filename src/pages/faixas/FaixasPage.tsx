/**
 * Aba "Faixas" (F8.2–F8.6 — RF-41 a RF-46, RNF-01, RNF-03, RNF-07).
 *
 * Lista as tabelas de faixas da filial do cabeçalho e reúne as ações conforme a matriz de permissões
 * (`usePermissoes().podeAcao`):
 * - "Nova tabela de faixas" abre o diálogo largo com o `FormularioTabelaFaixas`; ao abrir, carrega os
 *   dashboards (`listarDashboards`);
 * - "Alterar faixas" abre o diálogo largo com o `FormularioAlterarFaixas` (gera a versão seguinte);
 * - "Histórico de versões" abre o `DialogoHistoricoFaixas`, que consulta sozinho;
 * - "Excluir tabela" confirma pelo `DialogoExcluirTabelaFaixas` (`useAcaoConfirmada`); tabela de
 *   dashboard existente mostra o bloqueio, sem chamar a API.
 * Gravações com qualquer 2xx fecham o diálogo, notificam e recarregam a lista.
 */
import { useEffect, useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
import { mensagemDeErro } from '../../services/api'
import { listarDashboards } from '../../services/dashboardsService'
import type { AlteracaoFaixas } from '../../services/faixasService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { Dashboard, NovaTabelaFaixas, TabelaFaixas } from '../../types/dominio'
import { DialogoExcluirTabelaFaixas } from './DialogoExcluirTabelaFaixas'
import { DialogoHistoricoFaixas } from './DialogoHistoricoFaixas'
import { FormularioAlterarFaixas } from './FormularioAlterarFaixas'
import { FormularioTabelaFaixas } from './FormularioTabelaFaixas'
import { ListaTabelasFaixas } from './ListaTabelasFaixas'
import { useFaixas } from './useFaixas'
import './FaixasPage.css'

const MENSAGEM_CADASTRO = 'Tabela de faixas cadastrada.'
const MENSAGEM_ALTERACAO = 'Nova versão das faixas salva. A versão anterior permanece no histórico.'
const MENSAGEM_EXCLUSAO = 'Tabela de faixas excluída.'

/** Diálogo de gravação aberto: nova tabela ou alteração das faixas de uma tabela da lista. */
type ModoFormulario = { modo: 'cadastro' } | { modo: 'alteracao'; tabela: TabelaFaixas }

export function FaixasPage() {
  const { tabelas, codigoFilial, carregando, carregouUmaVez, erro, recarregar, criar, alterar, excluir } = useFaixas()
  const { acesso, filialSelecionada } = useSessao()
  const { podeAcao } = usePermissoes()

  const podeCadastrar = podeAcao('cadastrar-faixas')
  const podeAlterar = podeAcao('alterar-faixas')
  const podeVerHistorico = podeAcao('ver-historico-faixas')
  const podeExcluir = podeAcao('excluir-faixas')

  const [notificacao, setNotificacao] = useState<string | null>(null)
  const montadoRef = useRef(false)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const exclusao = useAcaoConfirmada<TabelaFaixas>((tabela) => excluir(tabela.id), {
    onSucesso: () => setNotificacao(MENSAGEM_EXCLUSAO),
  })

  // Diálogo de cadastro e alteração
  const [formulario, setFormulario] = useState<ModoFormulario | null>(null)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [carregandoDashboards, setCarregandoDashboards] = useState(false)
  const [erroDashboards, setErroDashboards] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  /** Identifica a consulta de dashboards vigente: uma resposta antiga (de outra abertura) é descartada. */
  const consultaDashboardsRef = useRef(0)

  async function carregarDashboards() {
    const consulta = ++consultaDashboardsRef.current
    const vigente = () => montadoRef.current && consulta === consultaDashboardsRef.current
    setDashboards([])
    setErroDashboards(null)
    setCarregandoDashboards(true)
    try {
      const lista = await listarDashboards()
      if (vigente()) setDashboards(lista)
    } catch (falha) {
      if (vigente()) setErroDashboards(mensagemDeErro(falha))
    } finally {
      if (vigente()) setCarregandoDashboards(false)
    }
  }

  function abrirCadastro() {
    setErroSalvar(null)
    setFormulario({ modo: 'cadastro' })
    void carregarDashboards()
  }

  function abrirAlteracao(tabela: TabelaFaixas) {
    consultaDashboardsRef.current++
    setErroSalvar(null)
    setFormulario({ modo: 'alteracao', tabela })
  }

  function fecharFormulario() {
    if (salvandoRef.current) return
    consultaDashboardsRef.current++
    setFormulario(null)
    setErroSalvar(null)
  }

  /** Grava (cadastro ou alteração); qualquer 2xx fecha, notifica e o hook recarrega a lista. */
  async function gravar(acao: () => Promise<void>, mensagem: string) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroSalvar(null)
    try {
      await acao()
      if (!montadoRef.current) return
      setFormulario(null)
      exclusao.limparErro()
      setNotificacao(mensagem)
    } catch (falha) {
      if (montadoRef.current) setErroSalvar(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  const [historicoDe, setHistoricoDe] = useState<TabelaFaixas | null>(null)

  const textoVazio =
    codigoFilial === null ? 'Nenhuma tabela de faixas cadastrada.' : `Nenhuma tabela de faixas para a filial ${codigoFilial}.`
  const mostrarLista = carregouUmaVez && erro === null
  const filialFixa = filialSelecionada !== null && filialSelecionada !== 'todas' ? filialSelecionada : null

  const conteudoFormulario = (() => {
    if (formulario === null) return null
    if (formulario.modo === 'alteracao') {
      const { tabela } = formulario
      return (
        <FormularioAlterarFaixas
          key={`alteracao-${tabela.id}`}
          tabela={tabela}
          salvando={salvando}
          erro={erroSalvar}
          onSalvar={(dados: AlteracaoFaixas) => void gravar(() => alterar(tabela.id, dados), MENSAGEM_ALTERACAO)}
          onCancelar={fecharFormulario}
        />
      )
    }
    return (
      <>
        <EstadoCarga
          carregando={carregandoDashboards}
          mensagemCarregando="Carregando dashboards..."
          erro={erroDashboards}
          onTentarNovamente={() => void carregarDashboards()}
        />
        <FormularioTabelaFaixas
          key="cadastro"
          dashboards={dashboards}
          tabelas={tabelas}
          filialFixa={filialFixa}
          filiais={acesso?.filiais ?? []}
          salvando={salvando}
          erro={erroSalvar}
          onSalvar={(dados: NovaTabelaFaixas) => void gravar(() => criar(dados), MENSAGEM_CADASTRO)}
          onCancelar={fecharFormulario}
        />
      </>
    )
  })()

  return (
    <div className="faixas-page">
      <div className="faixas-page__cabecalho">
        <h1>Faixas</h1>
        {podeCadastrar ? <Botao onClick={abrirCadastro}>Nova tabela de faixas</Botao> : null}
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando tabelas de faixas..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {exclusao.erro !== null ? <Aviso tipo="erro">{exclusao.erro}</Aviso> : null}

      {mostrarLista ? (
        <Card semPadding className="faixas-page__card">
          <ListaTabelasFaixas
            tabelas={tabelas}
            podeAlterar={podeAlterar}
            podeVerHistorico={podeVerHistorico}
            podeExcluir={podeExcluir}
            onAlterar={abrirAlteracao}
            onVerHistorico={setHistoricoDe}
            onExcluir={exclusao.abrir}
            textoVazio={textoVazio}
          />
        </Card>
      ) : null}

      <Dialogo
        aberto={formulario !== null}
        titulo={formulario?.modo === 'alteracao' ? 'Alterar faixas' : 'Nova tabela de faixas'}
        onFechar={fecharFormulario}
        className="dialogo--largo"
      >
        {conteudoFormulario}
      </Dialogo>

      <DialogoHistoricoFaixas tabela={historicoDe} onFechar={() => setHistoricoDe(null)} />

      <DialogoExcluirTabelaFaixas
        tabela={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
