/**
 * Tabela somente leitura com as linhas De (R$), Até (R$) e Alíquota (%) de uma versão das faixas
 * (F8.2 "Ver faixas" e F8.5 "Ver faixas da versão").
 */
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import type { Faixa } from '../../types/dominio'
import { formatarMoeda, formatarPercentual } from '../../utils/formato'
import './ListaTabelasFaixas.css'

export interface TabelaValoresFaixasProps {
  faixas: Faixa[]
  /** Legenda que nomeia a tabela (ex.: "Faixas vigentes de PED Comercial · Filial 101"). */
  legenda: string
}

interface LinhaFaixa extends Faixa {
  indice: number
}

const COLUNAS: ColunaTabela<LinhaFaixa>[] = [
  { chave: 'de', titulo: 'De (R$)', alinhar: 'direita', render: (faixa) => formatarMoeda(faixa.de) },
  { chave: 'ate', titulo: 'Até (R$)', alinhar: 'direita', render: (faixa) => formatarMoeda(faixa.ate) },
  { chave: 'aliquota', titulo: 'Alíquota (%)', alinhar: 'direita', render: (faixa) => formatarPercentual(faixa.aliquota) },
]

export function TabelaValoresFaixas({ faixas, legenda }: TabelaValoresFaixasProps) {
  return (
    <div className="tabela-valores-faixas">
      <Tabela
        colunas={COLUNAS}
        dados={faixas.map((faixa, indice): LinhaFaixa => ({ ...faixa, indice }))}
        obterChave={(faixa) => faixa.indice}
        legenda={legenda}
        textoVazio="Nenhuma faixa registrada."
      />
    </div>
  )
}
