/**
 * Metas na área de ações do Preenchimento (F9.9, F9.10 — RF-71 a RF-74, RN-07).
 *
 * Consulta a janela de metas da filial e do mês da tela (`useMetasPreenchimento`) e mostra
 * "Editar metas (N)". O diálogo "Editar metas" envia o lote num único `ajustarMetas`: no sucesso,
 * notifica "Metas ajustadas.", fecha e recarrega a janela; na falha, continua aberto com a mensagem
 * da API e os erros por indicador. "Histórico de {nome}" abre o histórico por cima da janela.
 * `versaoPeriodo` muda a cada abertura/reabertura de período e refaz a consulta da janela.
 * `consultaAntecipada` é a consulta da janela que a página já disparou ao receber a tela
 * (`anteciparMetasPreenchimento`); sendo da filial e do mês da tela, é usada no lugar de uma nova.
 */
import { useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { ajustarMetas, errosDoAjusteMetas, type ErroDeIndicador } from '../../services/metasService'
import type { IndicadorMetaPreenchimento, ItemAjusteMeta, TelaPreenchimento } from '../../types/dominio'
import { BotaoEditarMetas } from './BotaoEditarMetas'
import { DialogoEditarMetas } from './DialogoEditarMetas'
import { DialogoHistoricoMetaPreenchimento } from './DialogoHistoricoMetaPreenchimento'
import { mesDasMetas, useMetasPreenchimento, type ConsultaMetasAntecipada } from './useMetasPreenchimento'

export const MENSAGEM_METAS_AJUSTADAS = 'Metas ajustadas.'

const SEM_ERROS: ErroDeIndicador[] = []

interface AcoesMetasPreenchimentoProps {
  tela: TelaPreenchimento
  onNotificar: (mensagem: string) => void
  /** Muda quando um período é aberto ou reaberto: a janela de metas é consultada de novo. */
  versaoPeriodo?: number
  /** Consulta da janela já disparada pela página ao receber a tela. */
  consultaAntecipada?: ConsultaMetasAntecipada | null
}

export function AcoesMetasPreenchimento({ tela, onNotificar, versaoPeriodo = 0, consultaAntecipada = null }: AcoesMetasPreenchimentoProps) {
  const { filial, nomeFilial } = tela
  const mesDeReferencia = mesDasMetas(tela)
  const { janela, recarregar } = useMetasPreenchimento(filial, mesDeReferencia, versaoPeriodo, consultaAntecipada)

  const [aberta, setAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [errosIndicadores, setErrosIndicadores] = useState<ErroDeIndicador[]>(SEM_ERROS)
  const [historico, setHistorico] = useState<IndicadorMetaPreenchimento | null>(null)

  function limparErros() {
    setErro(null)
    setErrosIndicadores(SEM_ERROS)
  }

  function abrir() {
    limparErros()
    setAberta(true)
  }

  function cancelar() {
    setAberta(false)
    limparErros()
  }

  async function confirmar(itens: ItemAjusteMeta[]) {
    limparErros()
    setSalvando(true)
    try {
      await ajustarMetas({ filial, mesDeReferencia, itens })
      setAberta(false)
      onNotificar(MENSAGEM_METAS_AJUSTADAS)
      recarregar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setErrosIndicadores(errosDoAjusteMetas(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <BotaoEditarMetas quantidade={janela?.indicadores.length ?? 0} onAbrir={abrir} />
      <DialogoEditarMetas
        janela={aberta ? janela : null}
        filial={filial}
        nomeFilial={nomeFilial}
        mesDeReferencia={mesDeReferencia}
        salvando={salvando}
        erro={erro}
        errosIndicadores={errosIndicadores}
        onConfirmar={(itens) => void confirmar(itens)}
        onCancelar={cancelar}
        onVerHistorico={setHistorico}
      />
      <DialogoHistoricoMetaPreenchimento
        indicador={historico}
        filial={filial}
        nomeFilial={nomeFilial}
        mesDeReferencia={mesDeReferencia}
        onFechar={() => setHistorico(null)}
      />
    </>
  )
}
