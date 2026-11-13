/**
 * Diálogo "Histórico do apontamento" (F9.7 — RF-69, RNF-01, RNF-03). Consulta sozinho, ao abrir,
 * `listarHistoricoApontamento(apontamento.id, { filial, mesDeReferencia })` e mostra a tabela
 * "Lançamentos e correções" na ordem da API (mais recente primeiro). Somente leitura.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoApontamento } from '../../services/preenchimentoService'
import { ROTULOS_ACAO_LANCAMENTO, type ApontamentoPreenchimento, type HistoricoLancamento } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { SEM_VALOR, formatarValorLancamento } from './regrasPreenchimento'
import '../indicadores/DialogoHistoricoMetas.css'

export interface DialogoHistoricoApontamentoProps {
  /** Apontamento cujo histórico é mostrado; `null` mantém o diálogo fechado (sem consultar). */
  apontamento: ApontamentoPreenchimento | null
  filial: string
  /** Mês consultado (`AAAA-MM-01`). */
  mesDeReferencia: string
  onFechar: () => void
}

interface EstadoConsulta {
  tentativa: number
  linhas: HistoricoLancamento[]
  erro: string | null
}

interface LinhaHistorico {
  chave: number
  item: HistoricoLancamento
}

function ConteudoHistorico({ apontamento, filial, mesDeReferencia }: Omit<DialogoHistoricoApontamentoProps, 'onFechar' | 'apontamento'> & { apontamento: ApontamentoPreenchimento }) {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoApontamento(apontamento.id, { filial, mesDeReferencia }).then(
      (linhas) => {
        if (!descartada) setEstado({ tentativa, linhas, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ tentativa, linhas: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [apontamento.id, filial, mesDeReferencia, tentativa])

  const consultaAtual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const linhas: LinhaHistorico[] = (consultaAtual?.linhas ?? []).map((item, chave) => ({ chave, item }))
  const valor = (v: HistoricoLancamento['valorNovo']) => formatarValorLancamento(apontamento.tipoValor, v)

  const colunas: ColunaTabela<LinhaHistorico>[] = [
    { chave: 'data', titulo: 'Data', render: ({ item }) => formatarDataHora(item.data) || SEM_VALOR },
    { chave: 'acao', titulo: 'Ação', render: ({ item }) => ROTULOS_ACAO_LANCAMENTO[item.acao] },
    { chave: 'anterior', titulo: 'Valor anterior', render: ({ item }) => valor(item.valorAnterior) },
    { chave: 'novo', titulo: 'Valor novo', render: ({ item }) => valor(item.valorNovo) },
    { chave: 'usuario', titulo: 'Usuário', render: ({ item }) => item.usuario?.trim() || SEM_VALOR },
    { chave: 'motivo', titulo: 'Motivo', render: ({ item }) => item.motivo?.trim() || SEM_VALOR },
  ]

  return (
    <div className="dialogo-historico">
      <p className="dialogo-historico__indicador">{apontamento.nome}</p>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && linhas.length === 0 ? <p className="dialogo-historico__vazio">Nenhum lançamento registrado.</p> : null}
      {!carregando && !erro && linhas.length > 0 ? (
        <Tabela colunas={colunas} dados={linhas} obterChave={(linha) => linha.chave} legenda="Lançamentos e correções" />
      ) : null}
    </div>
  )
}

export function DialogoHistoricoApontamento({ apontamento, filial, mesDeReferencia, onFechar }: DialogoHistoricoApontamentoProps) {
  return (
    <Dialogo aberto={apontamento !== null} titulo="Histórico do apontamento" onFechar={onFechar} className="dialogo--largo">
      {apontamento ? (
        <ConteudoHistorico key={apontamento.id} apontamento={apontamento} filial={filial} mesDeReferencia={mesDeReferencia} />
      ) : null}
    </Dialogo>
  )
}
