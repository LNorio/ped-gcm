/**
 * Diálogo "Histórico de versões" de uma tabela de faixas (F8.5 — RF-45, RNF-01).
 *
 * Consulta sozinho o histórico (`listarHistoricoFaixas`) ao abrir, como o `DialogoHistoricoMetas`
 * (F6.8). Cada versão pode mostrar as suas faixas ("Ver faixas da versão vN"), consultadas por
 * `obterFaixasDaVersao` uma só vez por versão; várias podem ficar abertas. Falha ao consultar uma
 * versão vira um alerta na linha, sem fechar o histórico. Somente leitura.
 */
import { useEffect, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import { Etiqueta } from '../../components/Etiqueta'
import { EstadoCarga } from '../../components/EstadoCarga'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoFaixas, obterFaixasDaVersao, type VersaoFaixas } from '../../services/faixasService'
import type { Faixa, TabelaFaixas } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { TabelaValoresFaixas } from './TabelaValoresFaixas'
import { nomeTabelaFaixas } from './regrasFaixas'
import '../indicadores/DialogoHistoricoMetas.css'

export interface DialogoHistoricoFaixasProps {
  /** Tabela cujo histórico é mostrado; `null` mantém o diálogo fechado (sem consultar). */
  tabela: TabelaFaixas | null
  onFechar: () => void
}

interface EstadoConsulta {
  /** Tentativa que produziu este estado; diferente da atual, o estado é descartado. */
  tentativa: number
  versoes: VersaoFaixas[]
  erro: string | null
}

/** Faixas de uma versão: carregando, carregadas ou com erro. */
type FaixasDaVersao = { estado: 'carregando' } | { estado: 'pronto'; faixas: Faixa[] } | { estado: 'erro'; erro: string }

const SEM_VALOR = '—'

function textoFaixas(quantidade: number | null): string {
  if (quantidade === null) return SEM_VALOR
  return `${quantidade} ${quantidade === 1 ? 'faixa' : 'faixas'}`
}

function ConteudoHistorico({ tabela }: { tabela: TabelaFaixas }) {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)
  const [abertas, setAbertas] = useState<ReadonlySet<number>>(() => new Set())
  const [faixasPorVersao, setFaixasPorVersao] = useState<ReadonlyMap<number, FaixasDaVersao>>(() => new Map())

  useEffect(() => {
    let descartada = false
    listarHistoricoFaixas(tabela.id).then(
      (versoes) => {
        if (!descartada) setEstado({ tentativa, versoes, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ tentativa, versoes: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [tabela.id, tentativa])

  function definirFaixas(versao: number, valor: FaixasDaVersao) {
    setFaixasPorVersao((atual) => new Map(atual).set(versao, valor))
  }

  function carregarVersao(versao: number) {
    definirFaixas(versao, { estado: 'carregando' })
    obterFaixasDaVersao(tabela.id, versao).then(
      (faixas) => definirFaixas(versao, { estado: 'pronto', faixas }),
      (erro: unknown) => definirFaixas(versao, { estado: 'erro', erro: mensagemDeErro(erro) }),
    )
  }

  function alternarVersao(versao: number) {
    const aberta = abertas.has(versao)
    setAbertas((atuais) => {
      const novas = new Set(atuais)
      if (aberta) novas.delete(versao)
      else novas.add(versao)
      return novas
    })
    if (aberta) return
    const atual = faixasPorVersao.get(versao)
    // Consulta uma só vez por versão; depois de um erro, abrir de novo tenta outra vez.
    if (atual === undefined || atual.estado === 'erro') carregarVersao(versao)
  }

  function detalhesDaVersao(versao: VersaoFaixas) {
    const faixas = faixasPorVersao.get(versao.versao)
    if (faixas === undefined || faixas.estado === 'carregando') {
      return <RegiaoStatus mensagem={`Carregando faixas da versão v${versao.versao}...`} />
    }
    if (faixas.estado === 'erro') return <Aviso tipo="erro">{faixas.erro}</Aviso>
    return <TabelaValoresFaixas faixas={faixas.faixas} legenda={`Faixas da versão v${versao.versao}`} />
  }

  const colunas: ColunaTabela<VersaoFaixas>[] = [
    {
      chave: 'versao',
      titulo: 'Versão',
      render: (versao) => (
        <span className="dialogo-historico-faixas__versao">
          <span>{`v${versao.versao}`}</span>
          {versao.vigente ? <Etiqueta tom="sucesso">Vigente</Etiqueta> : null}
        </span>
      ),
    },
    { chave: 'motivo', titulo: 'Motivo', render: (versao) => versao.motivo },
    { chave: 'data', titulo: 'Data', render: (versao) => formatarDataHora(versao.data) },
    { chave: 'usuario', titulo: 'Autor', render: (versao) => versao.usuario },
    { chave: 'faixas', titulo: 'Faixas', render: (versao) => textoFaixas(versao.quantidadeDeFaixas) },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (versao) => {
        const aberta = abertas.has(versao.versao)
        return (
          <Botao variante="link" tamanho="pequeno" aria-expanded={aberta} onClick={() => alternarVersao(versao.versao)}>
            {`${aberta ? 'Ocultar' : 'Ver'} faixas da versão v${versao.versao}`}
          </Botao>
        )
      },
    },
  ]

  const consultaAtual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const versoes = consultaAtual?.versoes ?? []

  return (
    <div className="dialogo-historico">
      <p className="dialogo-historico__indicador">{nomeTabelaFaixas(tabela)}</p>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && versoes.length === 0 ? (
        <p className="dialogo-historico__vazio">Nenhuma versão registrada.</p>
      ) : null}
      {!carregando && !erro && versoes.length > 0 ? (
        <Tabela
          colunas={colunas}
          dados={versoes}
          obterChave={(versao) => versao.versao}
          legenda="Versões"
          expandir={detalhesDaVersao}
          expandidas={abertas}
        />
      ) : null}
    </div>
  )
}

export function DialogoHistoricoFaixas({ tabela, onFechar }: DialogoHistoricoFaixasProps) {
  return (
    <Dialogo aberto={tabela !== null} titulo="Histórico de versões" onFechar={onFechar} className="dialogo--largo">
      {tabela ? <ConteudoHistorico key={tabela.id} tabela={tabela} /> : null}
    </Dialogo>
  )
}
