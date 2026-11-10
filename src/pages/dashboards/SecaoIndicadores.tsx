/**
 * Seção "Indicadores vinculados" do formulário de dashboard (F7.6 — RF-51, RF-52, RF-53, RN-15), como o
 * dashModal do protótipo.
 *
 * Indicadores escolhidos em um dropdown com busca: indicadores inativos não aparecem; primeiro os
 * disponíveis (com a meta e onde já são usados) e depois os com problema, desabilitados com o motivo
 * (RF-52), inclusive o dado externo por Zona de venda ou Colaborador em dashboard por filiais (RF-53).
 * A lista mostra só os escolhidos, cada um com os pontos base neste dashboard; acima, o total e quanto
 * falta ou excede (RN-15). Na edição, um indicador já vinculado (`idsJaVinculados`) que ficou com
 * problema continua escolhido, com a etiqueta "⚠ {motivo}".
 */
import { useId, useState } from 'react'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import type { DadoExterno, Indicador, TipoVinculo } from '../../types/dominio'
import { formatarNumero, normalizarBusca } from '../../utils/formato'
import { formatarPontos, motivoIndisponibilidade, somarPontos, textoTotalPontos } from './regrasDashboard'
import { ICONE_REMOVER, SeletorBusca, type OpcaoSeletor } from './SeletorBusca'
import './FormularioDashboard.css'

/** Indicador escolhido e os pontos base digitados (texto em pt-BR). */
export interface PontosIndicador {
  idIndicador: number
  pontos: string
}

export interface SecaoIndicadoresProps {
  /** Todos os indicadores cadastrados (os inativos não aparecem no dropdown). */
  indicadores: Indicador[]
  /** Dados externos, para saber a referência dos indicadores por dado externo (RF-53). */
  dadosExternos: DadoExterno[]
  tipoVinculo: TipoVinculo | ''
  /** Pontuação base máxima digitada; `null` quando vazia ou inválida. */
  pontuacaoMaxima: number | null
  valor: PontosIndicador[]
  onChange: (valor: PontosIndicador[]) => void
  /**
   * Na edição: ids já vinculados ao dashboard. Continuam escolhidos mesmo com problema (só mostram a
   * etiqueta); a validação do formulário só barra os novos.
   */
  idsJaVinculados?: number[]
  erro?: string | null
  /** Erro dos pontos base de cada indicador, pelo id. */
  errosPontos?: Record<number, string>
}

/** "Meta via API" (F7.6, origem `terceiro`), "Meta {valor com 2 casas}" ou "Meta a definir". */
function textoMeta(indicador: Indicador): string {
  if (indicador.origemDaMeta === 'terceiro') return 'Meta via API'
  return indicador.meta === null ? 'Meta a definir' : `Meta ${formatarNumero(indicador.meta, 2)}`
}

/** Subtexto da opção disponível: meta e onde o indicador já é usado. */
function subtextoOpcao(indicador: Indicador): string {
  const usos = indicador.dashboards.map((dashboard) => `${formatarPontos(dashboard.pontosBase)} pts em ${dashboard.nome}`)
  return [textoMeta(indicador), ...(usos.length > 0 ? usos : ['ainda não usado'])].join(' · ')
}

/** Subtexto do indicador escolhido: meta e composição. */
function subtextoEscolhido(indicador: Indicador): string {
  if (indicador.composicao.tipo === 'dado_externo') return `${textoMeta(indicador)} · dado externo`
  const quantidade = indicador.composicao.itens.length
  return `${textoMeta(indicador)} · ${quantidade} ${quantidade === 1 ? 'apontamento' : 'apontamentos'}`
}

export function SecaoIndicadores({
  indicadores,
  dadosExternos,
  tipoVinculo,
  pontuacaoMaxima,
  valor,
  onChange,
  erro,
  errosPontos = {},
}: SecaoIndicadoresProps) {
  const idTitulo = useId()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const idsEscolhidos = valor.map((item) => item.idIndicador)
  const livres = indicadores.filter((indicador) => indicador.ativo && !idsEscolhidos.includes(indicador.id))
  const termo = normalizarBusca(busca).trim()
  const filtrados = livres.filter((indicador) => termo === '' || normalizarBusca(indicador.nome).includes(termo))

  const disponiveis: OpcaoSeletor[] = []
  const indisponiveis: OpcaoSeletor[] = []
  for (const indicador of filtrados) {
    const motivo = motivoIndisponibilidade(indicador, tipoVinculo, dadosExternos)
    if (motivo === null) disponiveis.push({ id: String(indicador.id), nome: indicador.nome, subtexto: subtextoOpcao(indicador) })
    else indisponiveis.push({ id: String(indicador.id), nome: indicador.nome, subtexto: `Indisponível: ${motivo}`, desabilitada: true })
  }
  const opcoes = [...disponiveis, ...indisponiveis]

  let mensagemVazia: string | null = null
  if (livres.length === 0) mensagemVazia = 'Todos os indicadores já foram adicionados.'
  else if (opcoes.length === 0) mensagemVazia = 'Nenhum indicador encontrado para a busca.'

  const escolhidos = valor.flatMap((item) => {
    const indicador = indicadores.find((opcao) => opcao.id === item.idIndicador)
    return indicador ? [{ indicador, pontos: item.pontos }] : []
  })

  const soma = somarPontos(valor.map((item) => item.pontos))
  const quantidade = valor.length
  const maximoValido = pontuacaoMaxima !== null && pontuacaoMaxima > 0
  const textoMaximo = maximoValido ? formatarPontos(pontuacaoMaxima) : '—'
  const textoTotal = textoTotalPontos(soma, pontuacaoMaxima)
  let tomTotal: TomEtiqueta = 'dourado'
  if (maximoValido && soma === pontuacaoMaxima) tomTotal = 'sucesso'
  else if (maximoValido && soma > pontuacaoMaxima) tomTotal = 'perigo'

  function escolher(id: string) {
    const idIndicador = Number(id)
    const indicador = indicadores.find((item) => item.id === idIndicador)
    if (!indicador || motivoIndisponibilidade(indicador, tipoVinculo, dadosExternos) !== null) return
    onChange([...valor, { idIndicador, pontos: '' }])
  }

  function alterarPontos(idIndicador: number, pontos: string) {
    onChange(valor.map((item) => (item.idIndicador === idIndicador ? { ...item, pontos } : item)))
  }

  function remover(idIndicador: number) {
    onChange(valor.filter((item) => item.idIndicador !== idIndicador))
  }

  return (
    <div className="formulario-dashboard__campo" role="group" aria-labelledby={idTitulo}>
      <div className="formulario-dashboard__campo-cabecalho">
        <span id={idTitulo} className="formulario-dashboard__rotulo">
          Indicadores vinculados
        </span>
        <span className="formulario-dashboard__totais">
          <Etiqueta tom="info">
            {`${quantidade} ${quantidade === 1 ? 'indicador' : 'indicadores'} · ${formatarPontos(soma)} de ${textoMaximo} pts`}
          </Etiqueta>
          <Etiqueta tom={tomTotal}>{textoTotal}</Etiqueta>
        </span>
      </div>
      <SeletorBusca
        textoBotao="Selecionar indicador"
        aberto={aberto}
        onAlternar={() => {
          setAberto((atual) => !atual)
          setBusca('')
        }}
        rotuloBusca="Buscar indicador"
        placeholderBusca="Buscar indicador..."
        busca={busca}
        onBusca={setBusca}
        rotuloLista="Indicadores"
        opcoes={opcoes}
        mensagemVazia={mensagemVazia}
        onEscolher={escolher}
      />
      <div className="formulario-dashboard__selecionados">
        {escolhidos.length === 0 ? (
          <p className="formulario-dashboard__vazio">Nenhum indicador selecionado.</p>
        ) : (
          <>
            <div className="formulario-dashboard__cabecalho-lista">
              <span>Indicador</span>
              <span className="formulario-dashboard__cabecalho-pontos">Pts base neste dashboard</span>
            </div>
            <ul className="formulario-dashboard__lista" aria-label="Indicadores escolhidos">
              {escolhidos.map(({ indicador, pontos }) => {
                const motivo = motivoIndisponibilidade(indicador, tipoVinculo, dadosExternos)
                const erroPontos = errosPontos[indicador.id]
                const idErro = `${idTitulo}-pontos-${indicador.id}`
                return (
                  <li key={indicador.id} className="formulario-dashboard__escolhido formulario-dashboard__escolhido--indicador">
                    <div className="formulario-dashboard__escolhido-linha">
                      <span className="formulario-dashboard__escolhido-texto">
                        <span>{indicador.nome}</span>
                        <small>{subtextoEscolhido(indicador)}</small>
                        {motivo ? (
                          <span>
                            <Etiqueta tom="perigo" className="formulario-dashboard__problema">{`⚠ ${motivo}`}</Etiqueta>
                          </span>
                        ) : null}
                      </span>
                      <div className="formulario-dashboard__pontos">
                        {/* O erro fica abaixo da linha inteira (o campo é estreito); a ligação é feita aqui. */}
                        <Campo
                          rotulo={`Pontos base de ${indicador.nome} neste dashboard`}
                          rotuloOculto
                          obrigatorio
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={pontos}
                          aria-invalid={erroPontos ? true : undefined}
                          aria-describedby={erroPontos ? idErro : undefined}
                          onChange={(evento) => alterarPontos(indicador.id, evento.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="formulario-dashboard__remover foco-anel"
                        aria-label={`Remover ${indicador.nome}`}
                        onClick={() => remover(indicador.id)}
                      >
                        {ICONE_REMOVER}
                      </button>
                    </div>
                    <ErroCampo id={idErro} mensagem={erroPontos} />
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      <ErroCampo mensagem={erro} />
    </div>
  )
}
