/**
 * Aba "Fechamentos" (F10.2 — RF-78, RF-79, RN-16, RN-17; A-05).
 *
 * Admin e Validador (aba liberada em `permissoes.ts`), ambos com todas as filiais: a consulta não
 * envia filial. A página tem:
 * - a seção "Encerrar período por dashboard" (card com h2), com os filtros (busca, periodicidade e
 *   situação do período), o estado de carga e a `TabelaFechamentos`;
 * - abaixo e fora dessa seção, a consulta retroativa das imagens (F10.6, `ConsultaImagens`), remontada
 *   (`key`) após cada encerramento para mostrar as imagens novas;
 * - os diálogos da prévia (F10.4) e do encerramento (F10.5), guiados por `fechamentoEmPrevia` e
 *   `fechamentoAEncerrar`. A confirmação aberta pela prévia recebe a prévia já consultada (sem novo
 *   GET) e fica por cima dela; ao encerrar, os dois fecham, a lista e a consulta são recarregadas;
 * - a `Notificacao` da página (`setNotificacao`).
 */
import { useState } from 'react'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Card } from '../../components/Card'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { Select, type OpcaoSelect } from '../../components/Select'
import {
  type Fechamento,
  PERIODICIDADES,
  type PreviaFechamento,
  type ResultadoEncerramento,
  ROTULOS_PERIODICIDADE,
  ROTULOS_SITUACAO_PERIODO,
  SITUACOES_PERIODO,
} from '../../types/dominio'
import { ConsultaImagens } from './ConsultaImagens'
import { DialogoEncerrarFechamento } from './DialogoEncerrarFechamento'
import { DialogoPreviaFechamento } from './DialogoPreviaFechamento'
import { textoImagens } from './previaFechamento'
import { TabelaFechamentos } from './TabelaFechamentos'
import {
  FILTROS_PADRAO,
  type PeriodicidadeFiltroFechamento,
  type SituacaoFiltroFechamento,
  useFechamentos,
} from './useFechamentos'
import './FechamentosPage.css'

const TITULO_SECAO = 'Encerrar período por dashboard'

const OPCOES_PERIODICIDADE: OpcaoSelect[] = [
  { valor: 'todas', rotulo: 'Todas as periodicidades' },
  ...PERIODICIDADES.map((periodicidade) => ({ valor: periodicidade, rotulo: ROTULOS_PERIODICIDADE[periodicidade] })),
]

const OPCOES_SITUACAO: OpcaoSituacao[] = [
  { valor: 'todas', rotulo: 'Todas' },
  ...SITUACOES_PERIODO.map((situacao) => ({ valor: situacao, rotulo: ROTULOS_SITUACAO_PERIODO[situacao] })),
]

/** "Período {código} encerrado." e, quando há lote, " Lote {lote}: {N} imagens geradas." */
function mensagemEncerramento(resultado: ResultadoEncerramento, fechamento: Fechamento): string {
  const periodo = resultado.periodo?.codigo ?? fechamento.periodoAtual
  const base = `Período ${periodo} encerrado.`
  if (!resultado.lote) return base
  const quantidade = resultado.imagensGeradas
  return `${base} Lote ${resultado.lote}: ${textoImagens(quantidade)} ${quantidade === 1 ? 'gerada' : 'geradas'}.`
}

function ehPeriodicidadeFiltro(valor: string): valor is PeriodicidadeFiltroFechamento {
  return valor === 'todas' || (PERIODICIDADES as readonly string[]).includes(valor)
}

function ehSituacaoFiltro(valor: string): valor is SituacaoFiltroFechamento {
  return valor === 'todas' || (SITUACOES_PERIODO as readonly string[]).includes(valor)
}

export function FechamentosPage() {
  const {
    fechamentos,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setPeriodicidade,
    setSituacao,
    limparFiltros,
    recarregar,
  } = useFechamentos()

  /** Fechamento com a prévia aberta (diálogo da F10.4). */
  const [fechamentoEmPrevia, setFechamentoEmPrevia] = useState<Fechamento | null>(null)
  /** Fechamento com a confirmação de encerramento aberta (diálogo da F10.5). */
  const [fechamentoAEncerrar, setFechamentoAEncerrar] = useState<Fechamento | null>(null)
  /** Prévia já consultada, repassada à confirmação aberta a partir da prévia (sem novo GET). */
  const [previaAEncerrar, setPreviaAEncerrar] = useState<PreviaFechamento | null>(null)
  const [notificacao, setNotificacao] = useState<string | null>(null)
  /** Incrementada após um encerramento para remontar a consulta das imagens com as imagens novas. */
  const [versaoConsulta, setVersaoConsulta] = useState(0)

  function abrirEncerramento(fechamento: Fechamento) {
    setPreviaAEncerrar(null)
    setFechamentoAEncerrar(fechamento)
  }

  function encerrarPelaPrevia(fechamento: Fechamento, previa: PreviaFechamento) {
    setPreviaAEncerrar(previa)
    setFechamentoAEncerrar(fechamento)
  }

  function cancelarEncerramento() {
    setFechamentoAEncerrar(null)
    setPreviaAEncerrar(null)
  }

  function concluirEncerramento(fechamento: Fechamento, resultado: ResultadoEncerramento) {
    setFechamentoAEncerrar(null)
    setPreviaAEncerrar(null)
    setFechamentoEmPrevia(null)
    setNotificacao(mensagemEncerramento(resultado, fechamento))
    setVersaoConsulta((versao) => versao + 1)
    void recarregar()
  }

  const periodicidadeAlterada = filtros.periodicidade !== FILTROS_PADRAO.periodicidade
  const filtroAtivo =
    filtros.busca !== FILTROS_PADRAO.busca || periodicidadeAlterada || filtros.situacao !== FILTROS_PADRAO.situacao
  const textoVazio = filtroAtivo ? 'Nenhum dashboard encontrado para os filtros.' : 'Nenhum dashboard ativo.'
  const mostrarLista = carregouUmaVez && erro === null

  return (
    <div className="fechamentos-page">
      <h1>Fechamentos</h1>

      <Card titulo={TITULO_SECAO} semPadding className="fechamentos-page__card">
        <BarraFiltros
          busca={filtros.busca}
          onBuscaChange={(valor) => setBusca(valor)}
          rotuloBusca="Buscar"
          placeholderBusca="Dashboard, grupo vinculado ou período"
          situacoes={OPCOES_SITUACAO}
          situacao={filtros.situacao}
          onSituacaoChange={(valor) => {
            if (ehSituacaoFiltro(valor)) setSituacao(valor)
          }}
          rotuloSituacoes="Situação do período"
          filtrosAdicionaisAtivos={periodicidadeAlterada}
          onLimpar={limparFiltros}
        >
          <Select
            rotulo="Periodicidade"
            opcoes={OPCOES_PERIODICIDADE}
            value={filtros.periodicidade}
            onChange={(evento) => {
              if (ehPeriodicidadeFiltro(evento.target.value)) setPeriodicidade(evento.target.value)
            }}
          />
        </BarraFiltros>

        <div className="fechamentos-page__estado">
          <EstadoCarga
            carregando={carregando}
            mensagemCarregando="Carregando fechamentos..."
            erro={erro}
            onTentarNovamente={() => void recarregar()}
          />
        </div>

        {mostrarLista ? (
          <TabelaFechamentos
            fechamentos={fechamentos}
            onPrevisualizar={setFechamentoEmPrevia}
            onEncerrar={abrirEncerramento}
            textoVazio={textoVazio}
          />
        ) : null}
      </Card>

      <ConsultaImagens key={versaoConsulta} />

      {fechamentoEmPrevia ? (
        <DialogoPreviaFechamento
          fechamento={fechamentoEmPrevia}
          onFechar={() => setFechamentoEmPrevia(null)}
          onEncerrar={(previa) => encerrarPelaPrevia(fechamentoEmPrevia, previa)}
        />
      ) : null}

      {fechamentoAEncerrar ? (
        <DialogoEncerrarFechamento
          fechamento={fechamentoAEncerrar}
          previa={previaAEncerrar}
          onCancelar={cancelarEncerramento}
          onEncerrado={(resultado) => concluirEncerramento(fechamentoAEncerrar, resultado)}
        />
      ) : null}

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
