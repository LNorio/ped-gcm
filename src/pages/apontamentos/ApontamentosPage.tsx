/**
 * Aba "Apontamentos" (F4.2–F4.6 — RF-19, RF-20, RF-21, RN-11, RN-12, RNF-01, RNF-07, RNF-09).
 *
 * Lista os apontamentos filtrados pela API (busca, situação e tipo), permite cadastrar novos
 * (todos os perfis), ativar/desativar e excluir conforme a matriz de ações (`usePermissoes().podeAcao`),
 * sempre com confirmação (`useAcoesSituacaoExclusao`, sobre `useAcaoConfirmada`). Apontamentos não são editáveis.
 */
import { useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type BotaoFiltro, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcoesSituacaoExclusao } from '../../hooks/useAcoesSituacaoExclusao'
import { mensagemDeErro } from '../../services/api'
import { ROTULOS_SITUACAO_FILTRO, SITUACOES_FILTRO, type SituacaoFiltro } from '../../services/apontamentosService'
import { useSessao } from '../../sessao/SessaoProvider'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { Apontamento, NovoApontamento } from '../../types/dominio'
import { DialogoExcluirApontamento } from './DialogoExcluirApontamento'
import { DialogoSituacaoApontamento } from './DialogoSituacaoApontamento'
import { FormularioApontamento } from './FormularioApontamento'
import { TabelaApontamentos } from './TabelaApontamentos'
import { FILTROS_PADRAO, useApontamentos } from './useApontamentos'
import './ApontamentosPage.css'

const MENSAGEM_CADASTRADO = 'Apontamento cadastrado.'
const MENSAGEM_SITUACAO_ALTERADA = 'Situação alterada.'
const MENSAGEM_EXCLUIDO = 'Apontamento excluído.'

const OPCOES_SITUACAO: OpcaoSituacao[] = SITUACOES_FILTRO.map((situacao) => ({
  valor: situacao,
  rotulo: ROTULOS_SITUACAO_FILTRO[situacao],
}))

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltro {
  return (SITUACOES_FILTRO as readonly string[]).includes(valor)
}

export function ApontamentosPage() {
  const {
    apontamentos,
    contagemPorTipo,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    setTipo,
    limparFiltros,
    recarregar,
    criar,
    alterarSituacao,
    excluir,
  } = useApontamentos()
  const { acesso } = useSessao()
  const { podeAcao } = usePermissoes()
  const podeAlterarSituacao = podeAcao('alterar-situacao-apontamento')
  const podeExcluir = podeAcao('excluir-apontamento')
  const tiposDoUsuario = acesso?.tipos ?? []

  const [notificacao, setNotificacao] = useState<string | null>(null)

  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)
  const salvandoRef = useRef(false)

  const {
    situacao,
    exclusao,
    erro: erroAcao,
    limparErros,
  } = useAcoesSituacaoExclusao<Apontamento>({
    alterarSituacao: (apontamento) => alterarSituacao(apontamento.id, !apontamento.ativo),
    excluir: (apontamento) => excluir(apontamento.id),
    onNotificar: setNotificacao,
    mensagens: { situacao: MENSAGEM_SITUACAO_ALTERADA, exclusao: MENSAGEM_EXCLUIDO },
  })

  const filtroAtivo =
    filtros.busca !== FILTROS_PADRAO.busca ||
    filtros.situacao !== FILTROS_PADRAO.situacao ||
    filtros.tipo !== FILTROS_PADRAO.tipo
  const textoVazio = filtroAtivo ? 'Nenhum apontamento encontrado para os filtros.' : 'Nenhum apontamento cadastrado.'

  const botoesTipo: BotaoFiltro[] = contagemPorTipo.map((item) => ({
    valor: String(item.id),
    rotulo: item.nome,
    contagem: item.quantidade,
  }))

  function abrirCadastro() {
    setErroCadastro(null)
    setCadastroAberto(true)
  }

  function fecharCadastro() {
    if (salvandoRef.current) return
    setCadastroAberto(false)
    setErroCadastro(null)
  }

  async function salvar(dados: NovoApontamento) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroCadastro(null)
    try {
      await criar(dados)
      setCadastroAberto(false)
      limparErros()
      setNotificacao(MENSAGEM_CADASTRADO)
    } catch (falha) {
      setErroCadastro(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  return (
    <div className="apontamentos-page">
      <div className="apontamentos-page__cabecalho">
        <h1>Apontamentos</h1>
        <Botao onClick={abrirCadastro}>Novo apontamento</Botao>
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando apontamentos..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {erroAcao !== null ? <Aviso tipo="erro">{erroAcao}</Aviso> : null}

      <Card semPadding className="apontamentos-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Nome, tipo, descrição ou tipo de valor"
          situacoes={OPCOES_SITUACAO}
          situacao={filtros.situacao}
          onSituacaoChange={(valor) => {
            if (ehSituacaoFiltro(valor)) setSituacao(valor)
          }}
          rotuloSituacoes="Situação"
          botoes={botoesTipo}
          botaoAtivo={filtros.tipo === null ? null : String(filtros.tipo)}
          onBotaoChange={(valor) => setTipo(valor === null ? null : Number(valor))}
          rotuloBotoes="Tipo"
          onLimpar={limparFiltros}
        />
        {carregouUmaVez && erro === null ? (
          <TabelaApontamentos
            apontamentos={apontamentos}
            podeAlterarSituacao={podeAlterarSituacao}
            podeExcluir={podeExcluir}
            onAlterarSituacao={situacao.abrir}
            onExcluir={exclusao.abrir}
            textoVazio={textoVazio}
          />
        ) : null}
      </Card>

      <Dialogo
        aberto={cadastroAberto}
        titulo="Novo apontamento"
        onFechar={fecharCadastro}
        className="dialogo--largo"
      >
        <FormularioApontamento
          tipos={tiposDoUsuario}
          salvando={salvando}
          erro={erroCadastro}
          onSalvar={(dados) => void salvar(dados)}
          onCancelar={fecharCadastro}
        />
      </Dialogo>

      <DialogoSituacaoApontamento
        apontamento={situacao.alvo}
        alterando={situacao.executando}
        onConfirmar={() => void situacao.confirmar()}
        onCancelar={situacao.cancelar}
      />

      <DialogoExcluirApontamento
        apontamento={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
