import type { ReactNode } from 'react'
import { Etiqueta } from '../../components/Etiqueta'
import '../../components/Tabela.css'
import {
  ROTULOS_TIPO_IMAGEM,
  ROTULOS_TIPO_VINCULO,
  type Faixa,
  type ImagemCongelada,
  type IndicadorDaImagem,
} from '../../types/dominio'
import { formatarDataHora, formatarMoeda, formatarNumero, formatarPercentual } from '../../utils/formato'
import './VisualizacaoImagem.css'

export interface VisualizacaoImagemProps {
  imagem: ImagemCongelada
}

const AUSENTE = '—'
const AVISO_IMUTAVEL = 'Alterações posteriores em cadastros, faixas ou apontamentos não afetam esta imagem.'

/** Texto formatado ou "—" quando o valor não existe. */
function ouAusente(texto: string | null | undefined): string {
  return texto ? texto : AUSENTE
}

function textoFaixa(faixa: Faixa | null): string {
  if (!faixa) return 'Nenhuma'
  return `${formatarMoeda(faixa.de)} a ${formatarMoeda(faixa.ate)} (${formatarPercentual(faixa.aliquota)})`
}

function mesmaFaixa(a: Faixa, b: Faixa | null): boolean {
  return b !== null && a.de === b.de && a.ate === b.ate && a.aliquota === b.aliquota
}

function textoRealizado(indicador: IndicadorDaImagem): string {
  if (indicador.realizado !== null) return formatarNumero(indicador.realizado)
  return indicador.coletaDisponivel ? 'Lançamento pendente' : 'Sem coleta ainda'
}

function Detalhe({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="visualizacao-imagem__detalhe">
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Imagem congelada (RF-83, RNF-02), somente leitura: mostra o conteúdo recebido, sem consultar a API.
 * Compartilhada entre a prévia do encerramento (sem código) e a consulta de imagens gravadas.
 */
export function VisualizacaoImagem({ imagem }: VisualizacaoImagemProps) {
  const { unidade, dashboard, pontuacao, faixas } = imagem

  const filial = unidade.filial
    ? unidade.nomeFilial
      ? `${unidade.filial} - ${unidade.nomeFilial}`
      : unidade.filial
    : AUSENTE
  const colaborador = imagem.tipo === 'filial' ? 'Filial (sem colaborador vinculado)' : ouAusente(unidade.colaborador)
  const vinculo = dashboard?.tipoVinculo ? ROTULOS_TIPO_VINCULO[dashboard.tipoVinculo] : AUSENTE

  const tituloFaixas = faixas
    ? faixas.nome
      ? `Faixas vigentes — ${faixas.nome} (v${faixas.versao ?? ''})`
      : `Faixas vigentes (v${faixas.versao ?? ''})`
    : ''

  return (
    <section className="visualizacao-imagem" aria-label={imagem.codigo ? `Imagem ${imagem.codigo}` : 'Imagem (prévia)'}>
      <dl className="visualizacao-imagem__detalhes">
        {imagem.codigo ? <Detalhe rotulo="Código">{imagem.codigo}</Detalhe> : null}
        <Detalhe rotulo="Tipo">{ROTULOS_TIPO_IMAGEM[imagem.tipo]}</Detalhe>
        <Detalhe rotulo="Filial">{filial}</Detalhe>
        <Detalhe rotulo="Colaborador">{colaborador}</Detalhe>
        {unidade.cargo ? <Detalhe rotulo="Cargo">{unidade.cargo}</Detalhe> : null}
        <Detalhe rotulo="Período">{ouAusente(imagem.periodo?.codigo)}</Detalhe>
        <Detalhe rotulo="Dashboard">{ouAusente(dashboard?.nome)}</Detalhe>
        <Detalhe rotulo="Vínculo">{vinculo}</Detalhe>
        <Detalhe rotulo="Resultado Operacional">{ouAusente(formatarMoeda(imagem.resultadoOperacional?.valor))}</Detalhe>
        <Detalhe rotulo="PED">{ouAusente(formatarPercentual(imagem.pedPercentual))}</Detalhe>
        <Detalhe rotulo="Pontuação">
          {pontuacao.calculada ? (
            ouAusente(formatarNumero(pontuacao.valor))
          ) : (
            <>
              <Etiqueta tom="alerta">Não calculada</Etiqueta>
              {pontuacao.motivo ? <span className="visualizacao-imagem__motivo"> {pontuacao.motivo}</span> : null}
            </>
          )}
        </Detalhe>
      </dl>

      {pontuacao.calculada ? (
        <section className="visualizacao-imagem__bloco" aria-label="Cálculo da pontuação">
          <h3 className="visualizacao-imagem__titulo">Cálculo da pontuação</h3>
          <dl className="visualizacao-imagem__detalhes">
            {dashboard?.formulaDePontuacao ? <Detalhe rotulo="Fórmula">{dashboard.formulaDePontuacao}</Detalhe> : null}
            <Detalhe rotulo="Faixa atual">{textoFaixa(pontuacao.faixaAtual)}</Detalhe>
            <Detalhe rotulo="Faixa anterior">{textoFaixa(pontuacao.faixaAnterior)}</Detalhe>
            <Detalhe rotulo="Opção A">{ouAusente(formatarMoeda(pontuacao.opcaoA))}</Detalhe>
            <Detalhe rotulo="Opção B">{ouAusente(formatarMoeda(pontuacao.opcaoB))}</Detalhe>
            <Detalhe rotulo="Opção selecionada">
              {pontuacao.opcaoSelecionada ? `Opção ${pontuacao.opcaoSelecionada}` : AUSENTE}
            </Detalhe>
            <Detalhe rotulo="Base de cálculo">{ouAusente(formatarMoeda(pontuacao.baseDeCalculo))}</Detalhe>
          </dl>
        </section>
      ) : null}

      <div className="tabela-rolagem visualizacao-imagem__tabela">
        <table className="tabela">
          <caption className="tabela__legenda">Indicadores</caption>
          <thead>
            <tr>
              <th scope="col" className="rotulo-secao">Indicador</th>
              <th scope="col" className="rotulo-secao tabela__alinhar-direita">Meta</th>
              <th scope="col" className="rotulo-secao tabela__alinhar-direita">Realizado</th>
              <th scope="col" className="rotulo-secao tabela__alinhar-direita">Atingimento</th>
              <th scope="col" className="rotulo-secao tabela__alinhar-direita">Pontos base</th>
              <th scope="col" className="rotulo-secao tabela__alinhar-direita">Pontos realizados</th>
            </tr>
          </thead>
          <tbody>
            {imagem.indicadores.map((indicador, indice) => (
              <tr key={`${indicador.indicador}-${indice}`}>
                <td>
                  <span className="visualizacao-imagem__indicador">{indicador.indicador}</span>
                  {indicador.observacao ? (
                    <span className="visualizacao-imagem__observacao">{indicador.observacao}</span>
                  ) : null}
                </td>
                <td className="tabela__alinhar-direita">
                  {indicador.meta === null ? 'Sem meta' : formatarNumero(indicador.meta)}
                </td>
                <td className="tabela__alinhar-direita">{textoRealizado(indicador)}</td>
                <td className="tabela__alinhar-direita">{ouAusente(formatarPercentual(indicador.atingimento))}</td>
                <td className="tabela__alinhar-direita">{ouAusente(formatarNumero(indicador.pontosBase))}</td>
                <td className="tabela__alinhar-direita">{ouAusente(formatarNumero(indicador.pontosRealizados))}</td>
              </tr>
            ))}
            <tr className="visualizacao-imagem__total">
              <td>Total</td>
              <td />
              <td />
              <td />
              <td className="tabela__alinhar-direita">{ouAusente(formatarNumero(imagem.pontosBaseTotal))}</td>
              <td className="tabela__alinhar-direita">{ouAusente(formatarNumero(imagem.pedPercentual))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {faixas ? (
        <div className="tabela-rolagem visualizacao-imagem__tabela">
          <table className="tabela">
            <caption className="tabela__legenda">{tituloFaixas}</caption>
            <thead>
              <tr>
                <th scope="col" className="rotulo-secao tabela__alinhar-direita">De (R$)</th>
                <th scope="col" className="rotulo-secao tabela__alinhar-direita">Até (R$)</th>
                <th scope="col" className="rotulo-secao tabela__alinhar-direita">Alíquota (%)</th>
                <th scope="col" className="rotulo-secao">Status</th>
              </tr>
            </thead>
            <tbody>
              {faixas.linhas.map((faixa, indice) => {
                const atingida = pontuacao.calculada && mesmaFaixa(faixa, pontuacao.faixaAtual)
                return (
                  <tr
                    key={`${faixa.de}-${faixa.ate}-${indice}`}
                    className={atingida ? 'visualizacao-imagem__faixa-atingida' : undefined}
                    aria-current={atingida ? 'true' : undefined}
                  >
                    <td className="tabela__alinhar-direita">{formatarNumero(faixa.de)}</td>
                    <td className="tabela__alinhar-direita">{formatarNumero(faixa.ate)}</td>
                    <td className="tabela__alinhar-direita">{formatarNumero(faixa.aliquota)}</td>
                    <td>{atingida ? <Etiqueta tom="sucesso">Faixa atingida</Etiqueta> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {imagem.pendencias.length > 0 ? (
        <div className="visualizacao-imagem__bloco">
          <h3 className="visualizacao-imagem__titulo">Pendências</h3>
          <ul className="visualizacao-imagem__lista" aria-label="Pendências">
            {imagem.pendencias.map((item, indice) => (
              <li key={indice}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {imagem.avisos.length > 0 ? (
        <div className="visualizacao-imagem__bloco">
          <h3 className="visualizacao-imagem__titulo">Avisos</h3>
          <ul className="visualizacao-imagem__lista" aria-label="Avisos">
            {imagem.avisos.map((item, indice) => (
              <li key={indice}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {imagem.codigo && imagem.geradoEm ? (
        <p className="visualizacao-imagem__rodape">
          Gerada em {formatarDataHora(imagem.geradoEm)} por {ouAusente(imagem.usuario)}. {AVISO_IMUTAVEL}
        </p>
      ) : null}
    </section>
  )
}
