/**
 * Período na área de ações do Preenchimento (F9.11, F9.12 — RF-75, RF-76).
 *
 * - "Histórico de aberturas" para todos os perfis; "Abrir outro mês" só com a ação `abrir-periodo`.
 * - Aparecem mesmo sem filial selecionada: o período aberto é comum a todas as filiais.
 * - O mês aberto do diálogo vem de `obterPeriodo()` (consultado ao montar e atualizado pelo resultado
 *   de cada abertura) ou, enquanto ele não chega, do período aberto da tela (`periodoDaTela`). O
 *   "periodo aberto" do `/acesso` não é usado, porque fica desatualizado depois de uma abertura.
 * - Confirmar chama `abrirPeriodo(mes)`: no sucesso, fecha o diálogo e avisa a página (`onAberto`);
 *   na falha, o diálogo continua aberto com a mensagem da API.
 */
import { useEffect, useState } from 'react'
import { Botao } from '../../components/Botao'
import { mensagemDeErro } from '../../services/api'
import { abrirPeriodo, obterPeriodo, type ResultadoAberturaPeriodo } from '../../services/periodoService'
import { usePermissoes } from '../../sessao/usePermissoes'
import { DialogoAbrirPeriodo } from './DialogoAbrirPeriodo'
import { DialogoHistoricoPeriodos } from './DialogoHistoricoPeriodos'
import { mesDeCompetencia } from './regrasPreenchimento'

interface AcoesPeriodoPreenchimentoProps {
  /** Período aberto informado pela tela (`AAAA-MM-01`), quando houver. */
  periodoDaTela: string | null
  onAberto: (resultado: ResultadoAberturaPeriodo) => void
}

export function AcoesPeriodoPreenchimento({ periodoDaTela, onAberto }: AcoesPeriodoPreenchimentoProps) {
  const { podeAcao } = usePermissoes()
  const podeAbrir = podeAcao('abrir-periodo')

  const [periodoConsultado, setPeriodoConsultado] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [historicoAberto, setHistoricoAberto] = useState(false)

  useEffect(() => {
    let ativo = true
    obterPeriodo().then(
      (periodo) => {
        if (ativo) setPeriodoConsultado(mesDeCompetencia(periodo.mesDeReferencia))
      },
      () => {
        // Sem o período consultado, vale o da tela.
      },
    )
    return () => {
      ativo = false
    }
  }, [])

  const mesAberto = periodoConsultado ?? periodoDaTela

  function abrirDialogo() {
    setErro(null)
    setAbrindo(true)
  }

  function cancelar() {
    setAbrindo(false)
    setErro(null)
  }

  async function confirmar(mes: string) {
    setErro(null)
    setSalvando(true)
    try {
      const resultado = await abrirPeriodo(mes)
      setPeriodoConsultado(mesDeCompetencia(resultado.mesDeReferencia) ?? resultado.mesDeReferencia)
      setAbrindo(false)
      onAberto(resultado)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Botao type="button" variante="contorno" onClick={() => setHistoricoAberto(true)}>
        Histórico de aberturas
      </Botao>
      {podeAbrir ? (
        <Botao type="button" onClick={abrirDialogo} disabled={mesAberto === null}>
          Abrir outro mês
        </Botao>
      ) : null}
      {mesAberto !== null ? (
        <DialogoAbrirPeriodo
          aberto={abrindo && podeAbrir}
          mesAberto={mesAberto}
          salvando={salvando}
          erro={erro}
          onConfirmar={(mes) => void confirmar(mes)}
          onCancelar={cancelar}
        />
      ) : null}
      <DialogoHistoricoPeriodos aberto={historicoAberto} onFechar={() => setHistoricoAberto(false)} />
    </>
  )
}
