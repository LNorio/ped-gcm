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
 *
 * Foco (F12.1, A4): escolher leva o foco à busca (pelo `SeletorBusca`); remover leva ao "Remover" do
 * próximo, ou do anterior quando não há próximo, ou ao botão "Selecionar indicador" sem itens.
 *
 * Dashboard não mensal (F7.15, `mostrarCalculoNoPeriodo`): cada indicador ganha o select obrigatório
 * "Cálculo no período" (somar, fazer a média ou usar só o último valor dos resultados mensais), com a
 * coluna no cabeçalho e um aviso explicando o cálculo.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import { Aviso } from '../../components/Aviso'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import { Select, type OpcaoSelect } from '../../components/Select'
import {
  ROTULOS_SENTIDO_CALCULO,
  SENTIDOS_CALCULO,
  type DadoExterno,
  type Indicador,
  type SentidoCalculo,
  type TipoVinculo,
} from '../../types/dominio'
import { formatarNumero, normalizarBusca } from '../../utils/formato'
import { formatarPontos, motivoIndisponibilidade, somarPontos, textoTotalPontos } from './regrasDashboard'
import { ICONE_REMOVER, SeletorBusca, type OpcaoSeletor } from '../../components/SeletorBusca'
import './FormularioDashboard.css'

/** Indicador escolhido e os pontos base digitados (texto em pt-BR). */
export interface PontosIndicador {
  idIndicador: number
  pontos: string
  /** Cálculo no período (F7.15, dashboard não mensal); ausente ou `''` enquanto não escolhido. */
  calculoNoPeriodo?: SentidoCalculo | ''
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
  /** Mostra o "Cálculo no período" de cada indicador e o aviso (F7.15, dashboard não mensal). Padrão `false`. */
  mostrarCalculoNoPeriodo?: boolean
  /** Erro do cálculo no período de cada indicador, pelo id (só com `mostrarCalculoNoPeriodo`). */
  errosCalculo?: Record<number, string>
}

const AVISO_CALCULO_NO_PERIODO =
  'Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador.'

const OPCOES_CALCULO: OpcaoSelect[] = SENTIDOS_CALCULO.map((sentido) => ({ valor: sentido, rotulo: ROTULOS_SENTIDO_CALCULO[sentido] }))

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
  mostrarCalculoNoPeriodo = false,
  errosCalculo = {},
}: SecaoIndicadoresProps) {
  const idTitulo = useId()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const botaoSeletorRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  // Posição (na lista já sem o item removido) do "Remover" que recebe o foco; -1 = botão do seletor.
  const focoAposRemoverRef = useRef<number | null>(null)

  useEffect(() => {
    const indice = focoAposRemoverRef.current
    if (indice === null) return
    focoAposRemoverRef.current = null
    const botoes = listaRef.current?.querySelectorAll<HTMLButtonElement>('.formulario-dashboard__remover')
    const alvo = (indice >= 0 ? botoes?.[indice] : undefined) ?? botaoSeletorRef.current
    alvo?.focus()
  })

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
    return indicador ? [{ indicador, pontos: item.pontos, calculo: item.calculoNoPeriodo ?? '' }] : []
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

  function alterarCalculo(idIndicador: number, valorEscolhido: string) {
    const calculoNoPeriodo = SENTIDOS_CALCULO.find((sentido) => sentido === valorEscolhido)
    if (!calculoNoPeriodo) return
    onChange(valor.map((item) => (item.idIndicador === idIndicador ? { ...item, calculoNoPeriodo } : item)))
  }

  function remover(idIndicador: number) {
    const posicao = escolhidos.findIndex((item) => item.indicador.id === idIndicador)
    const restantes = escolhidos.length - 1
    focoAposRemoverRef.current = restantes === 0 ? -1 : Math.min(posicao, restantes - 1)
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
      {mostrarCalculoNoPeriodo ? <Aviso tipo="info">{AVISO_CALCULO_NO_PERIODO}</Aviso> : null}
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
        refBotao={botaoSeletorRef}
      />
      <div className="formulario-dashboard__selecionados">
        {escolhidos.length === 0 ? (
          <p className="formulario-dashboard__vazio">Nenhum indicador selecionado.</p>
        ) : (
          <>
            <div className={`formulario-dashboard__cabecalho-lista${mostrarCalculoNoPeriodo ? ' formulario-dashboard__cabecalho-lista--calculo' : ''}`}>
              <span className="formulario-dashboard__cabecalho-indicador">Indicador</span>
              <span className="formulario-dashboard__cabecalho-pontos">Pts base neste dashboard</span>
              {mostrarCalculoNoPeriodo ? <span className="formulario-dashboard__cabecalho-calculo">Cálculo no período</span> : null}
            </div>
            <ul ref={listaRef} className="formulario-dashboard__lista" aria-label="Indicadores escolhidos">
              {escolhidos.map(({ indicador, pontos, calculo }) => {
                const motivo = motivoIndisponibilidade(indicador, tipoVinculo, dadosExternos)
                const erroPontos = errosPontos[indicador.id]
                const idErro = `${idTitulo}-pontos-${indicador.id}`
                const erroCalculo = mostrarCalculoNoPeriodo ? errosCalculo[indicador.id] : undefined
                const idErroCalculo = `${idTitulo}-calculo-${indicador.id}`
                const classeLinha = mostrarCalculoNoPeriodo
                  ? 'formulario-dashboard__escolhido-linha formulario-dashboard__escolhido-linha--calculo'
                  : 'formulario-dashboard__escolhido-linha'
                return (
                  <li key={indicador.id} className="formulario-dashboard__escolhido formulario-dashboard__escolhido--indicador">
                    <div className={classeLinha}>
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
                      {mostrarCalculoNoPeriodo ? (
                        <div className="formulario-dashboard__calculo">
                          {/* Como nos pontos, o erro fica abaixo da linha inteira e a ligação é feita aqui. */}
                          <Select
                            rotulo={`Cálculo no período de ${indicador.nome}`}
                            rotuloOculto
                            obrigatorio
                            placeholder="Selecione"
                            opcoes={OPCOES_CALCULO}
                            value={calculo}
                            aria-invalid={erroCalculo ? true : undefined}
                            aria-describedby={erroCalculo ? idErroCalculo : undefined}
                            onChange={(evento) => alterarCalculo(indicador.id, evento.target.value)}
                          />
                        </div>
                      ) : null}
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
                    {mostrarCalculoNoPeriodo ? <ErroCampo id={idErroCalculo} mensagem={erroCalculo} /> : null}
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
