/**
 * Formulário de cadastro e edição de dashboard (F7.4 a F7.8 — RF-49 a RF-56, RN-15, INT-04), como o
 * dashModal do protótipo.
 *
 * Dados básicos (nome, periodicidade de lançamento, pontuação base máxima), vínculo (`SecaoVinculo`),
 * indicadores com pontos base (`SecaoIndicadores`) e, abaixo deles (RF-54, decisão de 2026-11-05),
 * indicador base da faixa e fórmula de pontuação. O indicador base só pode ser um dos indicadores
 * vinculados: sem nenhum, o campo fica desabilitado com orientação; removido o indicador que era a
 * base, o campo volta a vazio. Valida localmente antes de enviar.
 *
 * - Cadastro: o bloco "Tarefa de construção que será criada no Bitrix24" fica sempre visível, com a
 *   observação para a TI. O título e a descrição vêm de `onPrevia` (API), consultada 500 ms após a
 *   última alteração e só quando todos os dados são válidos (validação silenciosa); respostas antigas
 *   são ignoradas. "Salvar e criar tarefa no Bitrix" chama `onSalvar` direto, sem esperar a prévia.
 * - Edição (`dashboard` informado): sem prévia; a pontuação base máxima fica só para leitura; a caixa
 *   "Enviar tarefa à TI para realizar as modificações" define `enviarTarefaTi` (desabilitada em
 *   dashboard em construção) e, marcada, mostra o bloco da tarefa de modificação com a observação.
 *   Mostra as tarefas anteriores em uma linha.
 *
 * As listas chegam prontas pela página; o erro da gravação (`erro`) aparece sem apagar o digitado.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import { Select, type OpcaoSelect } from '../../components/Select'
import { mensagemDeErro } from '../../services/api'
import type {
  CargoVinculo,
  ColaboradorVinculo,
  DetalheDashboard,
  FilialVinculo,
  PreviaTarefa,
  TarefaDashboard,
} from '../../services/dashboardsService'
import {
  PERIODICIDADES,
  ROTULOS_PERIODICIDADE,
  ROTULOS_REFERENCIA,
  type DadoExterno,
  type DadosDashboard,
  type Indicador,
  type Periodicidade,
} from '../../types/dominio'
import { formatarDataHora, lerDecimal } from '../../utils/formato'
import { formatarPontos, lerPontos, referenciaRecusadaPorFiliais, somarPontos, type VinculoFormulario } from './regrasDashboard'
import { SecaoIndicadores, type PontosIndicador } from './SecaoIndicadores'
import { SecaoVinculo } from './SecaoVinculo'
import './FormularioDashboard.css'

/** Listas carregadas pela página para montar o formulário. */
export interface ListasFormularioDashboard {
  /** Todos os indicadores cadastrados, inclusive inativos (RF-54). */
  indicadores: Indicador[]
  dadosExternos: DadoExterno[]
  filiais: FilialVinculo[]
  cargos: CargoVinculo[]
  colaboradores: ColaboradorVinculo[]
}

export interface FormularioDashboardProps {
  /** Detalhe do dashboard em edição; ausente ou `null` no cadastro. */
  dashboard?: DetalheDashboard | null
  /** Tarefas anteriores do dashboard (só na edição), na ordem da API. */
  tarefas?: TarefaDashboard[]
  listas: ListasFormularioDashboard
  carregandoListas: boolean
  erroListas: string | null
  /** Gera a prévia da tarefa de construção (só no cadastro). */
  onPrevia: (dados: DadosDashboard) => Promise<PreviaTarefa>
  /** Enquanto `true`, o botão de salvar fica desabilitado. */
  salvando: boolean
  /** Erro devolvido ao salvar; `null` quando não há. */
  erro: string | null
  onSalvar: (dados: DadosDashboard) => void
  onCancelar: () => void
}

type CampoFormulario = 'nome' | 'pontuacao' | 'indicadorBase' | 'formula' | 'itensVinculo' | 'indicadores'

type ErrosFormulario = Partial<Record<CampoFormulario, string>>

/** Resultado da validação: os dados para a API (quando válidos) e os erros de cada campo. */
interface Analise {
  dados: DadosDashboard | null
  erros: ErrosFormulario
  errosPontos: Record<number, string>
}

/** Estado da prévia da tarefa de construção, sempre ligado aos dados (`chave`) que a geraram. */
interface EstadoPrevia {
  chave: string
  carregando: boolean
  tarefa: PreviaTarefa | null
  erro: string | null
}

const ATRASO_PREVIA_MS = 500

const OPCOES_PERIODICIDADE: OpcaoSelect[] = PERIODICIDADES.map((periodicidade) => ({
  valor: periodicidade,
  rotulo: ROTULOS_PERIODICIDADE[periodicidade],
}))

const PERIODICIDADE_PADRAO: Periodicidade = 'mensal'

const DICA_PONTUACAO_CADASTRO =
  'Não pode ser alterada depois do cadastro. A soma dos pontos base dos indicadores precisa ser igual a este valor.'
const DICA_PONTUACAO_EDICAO = 'Definida no cadastro e não pode ser alterada. A soma dos pontos base precisa ser igual a este valor.'

const ERRO_ITENS = {
  filiais: 'Selecione ao menos uma filial.',
  cargos: 'Selecione ao menos um cargo de colaboradores.',
  colaboradores: 'Selecione ao menos um colaborador.',
} as const

const ORIENTACAO_INDICADOR_BASE = 'Vincule indicadores para escolher o indicador base.'
const ROTULO_OBSERVACAO = 'Observação para a TI (opcional)'
const ORIENTACAO_PREVIA = 'Preencha os dados do dashboard para ver o título e a descrição da tarefa.'
const APOIO_ENVIAR_TAREFA =
  'Opcional. Marque quando a alteração exigir ajuste na construção do dashboard pela equipe de TI. Enquanto a TI não concluir, o dashboard fica inativo.'

const ROTULOS_TIPO_TAREFA: Readonly<Record<string, string>> = {
  construcao: 'Construção',
  modificacao: 'Modificação',
}

// Cadeado da pontuação travada na edição (protótipo).
const ICONE_CADEADO = (
  <svg
    className="campo__sufixo formulario-dashboard__cadeado"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

function textoOuNulo(texto: string): string | null {
  const limpo = texto.trim()
  return limpo === '' ? null : limpo
}

/** "Construção nº 21 · 01/08/2026 10:00" (sem número ou data quando ausentes). */
function textoTarefa(tarefa: TarefaDashboard): string {
  let texto = (tarefa.tipo && ROTULOS_TIPO_TAREFA[tarefa.tipo]) || 'Tarefa'
  if (tarefa.id !== null) texto += ` nº ${tarefa.id}`
  const data = formatarDataHora(tarefa.criadaEm)
  if (data) texto += ` · ${data}`
  return texto
}

/** Tarefas da mais recente à mais antiga pela data de criação (sem data por último). */
function tarefasRecentesPrimeiro(tarefas: TarefaDashboard[]): TarefaDashboard[] {
  return [...tarefas].sort((a, b) => {
    if (a.criadaEm === b.criadaEm) return 0
    if (a.criadaEm === null) return 1
    if (b.criadaEm === null) return -1
    return a.criadaEm < b.criadaEm ? 1 : -1
  })
}

export function FormularioDashboard({
  dashboard = null,
  tarefas = [],
  listas,
  carregandoListas,
  erroListas,
  onPrevia,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: FormularioDashboardProps) {
  const edicao = dashboard !== null
  const idDescricaoEnviar = useId()

  const [nome, setNome] = useState(dashboard?.nome ?? '')
  const [periodicidade, setPeriodicidade] = useState<string>(dashboard?.periodicidade ?? PERIODICIDADE_PADRAO)
  const [pontuacao, setPontuacao] = useState('')
  // Na edição, a base gravada só vale se estiver entre os indicadores vinculados (dado antigo abre vazio).
  const [indicadorBase, setIndicadorBase] = useState(() => {
    const base = dashboard?.indicadorBaseDaFaixa
    if (base === null || base === undefined) return ''
    return dashboard?.indicadores.some((item) => item.id === base) ? String(base) : ''
  })
  const [formula, setFormula] = useState(dashboard?.formulaDePontuacao ?? '')
  // Observação do bloco da tarefa: no cadastro, a da construção; na edição, a da modificação (começa vazia).
  const [observacao, setObservacao] = useState('')
  const [vinculo, setVinculo] = useState<VinculoFormulario>(
    dashboard ? { tipo: dashboard.tipoVinculo, itens: [...dashboard.codigosVinculados] } : { tipo: 'cargos', itens: [] },
  )
  const [indicadores, setIndicadores] = useState<PontosIndicador[]>(
    dashboard?.indicadores.map((item) => ({ idIndicador: item.id, pontos: formatarPontos(item.pontosBase) })) ?? [],
  )
  const [enviarTarefa, setEnviarTarefa] = useState(false)
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [errosPontos, setErrosPontos] = useState<Record<number, string>>({})
  const [previa, setPrevia] = useState<EstadoPrevia | null>(null)

  const idsJaVinculados = dashboard?.indicadores.map((item) => item.id) ?? []
  const emConstrucao = dashboard?.situacao === 'em_construcao'
  const pontuacaoMaxima = edicao ? dashboard.pontuacaoBaseMaxima : lerDecimal(pontuacao)

  // Opções do indicador base: só os indicadores vinculados, na ordem da lista.
  const opcoesIndicadorBase: OpcaoSelect[] = indicadores.map((item) => ({
    valor: String(item.idIndicador),
    rotulo: nomeDoIndicador(item.idIndicador),
  }))
  const semIndicadores = indicadores.length === 0
  // Valor exibido: vazio quando a base escolhida não está mais entre os vinculados.
  const indicadorBaseAtual = opcoesIndicadorBase.some((opcao) => opcao.valor === indicadorBase) ? indicadorBase : ''

  function nomeDoIndicador(idIndicador: number): string {
    return (
      listas.indicadores.find((opcao) => opcao.id === idIndicador)?.nome ??
      dashboard?.indicadores.find((item) => item.id === idIndicador)?.nome ??
      `#${idIndicador}`
    )
  }

  function limparErro(campo: CampoFormulario) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function alterarVinculo(novo: VinculoFormulario) {
    if (novo.tipo !== vinculo.tipo || novo.itens.length > 0) limparErro('itensVinculo')
    setVinculo(novo)
  }

  function alterarIndicadores(novo: PontosIndicador[]) {
    limparErro('indicadores')
    setErrosPontos((atual) => {
      const proximo = { ...atual }
      for (const item of novo) {
        const anterior = indicadores.find((existente) => existente.idIndicador === item.idIndicador)
        if (anterior && anterior.pontos !== item.pontos) delete proximo[item.idIndicador]
      }
      return proximo
    })
    // Removido o indicador que era a base, o campo volta a vazio; removido outro, a base continua.
    if (indicadorBase !== '' && !novo.some((item) => String(item.idIndicador) === indicadorBase)) setIndicadorBase('')
    setIndicadores(novo)
  }

  /** Erro geral dos indicadores: nenhum escolhido, referência recusada (RF-53) ou soma diferente (RN-15). */
  function validarIndicadores(pontosValidos: boolean): string | undefined {
    if (indicadores.length === 0) return 'Vincule ao menos um indicador.'

    const recusados = indicadores.flatMap((item) => {
      if (idsJaVinculados.includes(item.idIndicador)) return []
      const indicador = listas.indicadores.find((opcao) => opcao.id === item.idIndicador)
      if (!indicador) return []
      const referencia = referenciaRecusadaPorFiliais(indicador, vinculo.tipo, listas.dadosExternos)
      if (!referencia) return []
      return [
        `O indicador “${indicador.nome}” usa dado externo por ${ROTULOS_REFERENCIA[referencia]} e não pode entrar em dashboard por filiais.`,
      ]
    })
    if (recusados.length > 0) return recusados.join(' ')

    if (pontosValidos && pontuacaoMaxima !== null && pontuacaoMaxima > 0) {
      const soma = somarPontos(indicadores.map((item) => item.pontos))
      if (soma !== pontuacaoMaxima) {
        return `A soma dos pontos base dos indicadores deve ser exatamente igual à pontuação base máxima (${formatarPontos(pontuacaoMaxima)} pts). Total atual: ${formatarPontos(soma)} pts.`
      }
    }
    return undefined
  }

  /** Valida tudo sem mexer na tela: devolve os dados para a API (ou `null`) e os erros encontrados. */
  function analisar(): Analise {
    const nomeLimpo = nome.trim()
    const periodicidadeEscolhida = PERIODICIDADES.find((item) => item === periodicidade)
    const indicadorBaseEscolhido = indicadores.find((item) => String(item.idIndicador) === indicadorBaseAtual)
    const formulaLimpa = formula.trim()
    const tipoVinculo = vinculo.tipo

    const novosErros: ErrosFormulario = {}
    if (nomeLimpo === '') novosErros.nome = 'Informe o nome do dashboard.'
    if (pontuacaoMaxima === null || pontuacaoMaxima <= 0) {
      novosErros.pontuacao = 'Informe a pontuação base máxima do dashboard (número maior que zero).'
    }
    if (!indicadorBaseEscolhido) novosErros.indicadorBase = 'Selecione o indicador base da faixa.'
    if (formulaLimpa === '') novosErros.formula = 'Informe a fórmula de pontuação.'
    if (tipoVinculo !== '' && vinculo.itens.length === 0) novosErros.itensVinculo = ERRO_ITENS[tipoVinculo]

    const novosErrosPontos: Record<number, string> = {}
    for (const item of indicadores) {
      if (lerPontos(item.pontos) !== null) continue
      const indicador = listas.indicadores.find((opcao) => opcao.id === item.idIndicador)
      const nomeIndicador = indicador?.nome ?? `#${item.idIndicador}`
      novosErrosPontos[item.idIndicador] = `Informe os pontos base do indicador “${nomeIndicador}” neste dashboard.`
    }
    const erroIndicadores = validarIndicadores(Object.keys(novosErrosPontos).length === 0)
    if (erroIndicadores) novosErros.indicadores = erroIndicadores

    const invalido =
      Object.keys(novosErros).length > 0 ||
      Object.keys(novosErrosPontos).length > 0 ||
      !periodicidadeEscolhida ||
      !indicadorBaseEscolhido ||
      pontuacaoMaxima === null ||
      tipoVinculo === ''
    if (invalido) return { dados: null, erros: novosErros, errosPontos: novosErrosPontos }

    const observacaoParaTi = edicao && !enviarTarefa ? dashboard.observacaoParaTi : textoOuNulo(observacao)
    return {
      dados: {
        nome: nomeLimpo,
        periodicidade: periodicidadeEscolhida,
        pontuacaoBaseMaxima: pontuacaoMaxima,
        tipoVinculo,
        itensVinculados: tipoVinculo === 'colaboradores' ? vinculo.itens.map(Number) : [...vinculo.itens],
        indicadores: indicadores.map((item) => ({ idIndicador: item.idIndicador, pontosBase: lerPontos(item.pontos) ?? 0 })),
        indicadorBaseDaFaixa: indicadorBaseEscolhido.idIndicador,
        formulaDePontuacao: formulaLimpa,
        observacaoParaTi,
      },
      erros: novosErros,
      errosPontos: novosErrosPontos,
    }
  }

  // Prévia da tarefa de construção (só no cadastro): a chave identifica os dados válidos atuais.
  const chavePrevia = edicao ? null : chaveDosDados(analisar().dados)
  const chaveAtualRef = useRef<string | null>(null)
  const onPreviaRef = useRef(onPrevia)

  useEffect(() => {
    onPreviaRef.current = onPrevia
  }, [onPrevia])

  useEffect(() => {
    chaveAtualRef.current = chavePrevia
    if (chavePrevia === null) return undefined

    const timer = setTimeout(() => {
      const dados = JSON.parse(chavePrevia) as DadosDashboard
      setPrevia((atual) => ({ chave: chavePrevia, carregando: true, tarefa: atual?.tarefa ?? null, erro: null }))
      onPreviaRef.current(dados).then(
        (tarefa) => {
          if (chaveAtualRef.current === chavePrevia) setPrevia({ chave: chavePrevia, carregando: false, tarefa, erro: null })
        },
        (falha: unknown) => {
          if (chaveAtualRef.current === chavePrevia) {
            setPrevia({ chave: chavePrevia, carregando: false, tarefa: null, erro: mensagemDeErro(falha) })
          }
        },
      )
    }, ATRASO_PREVIA_MS)
    return () => clearTimeout(timer)
  }, [chavePrevia])

  // Ao desmontar, respostas pendentes deixam de ser aplicadas.
  useEffect(
    () => () => {
      chaveAtualRef.current = null
    },
    [],
  )

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return

    const { dados, erros: novosErros, errosPontos: novosErrosPontos } = analisar()
    setErros(novosErros)
    setErrosPontos(novosErrosPontos)
    if (!dados) return

    onSalvar(edicao ? { ...dados, enviarTarefaTi: enviarTarefa } : dados)
  }

  let textoBotaoPrincipal = 'Salvar e criar tarefa no Bitrix'
  if (edicao) textoBotaoPrincipal = enviarTarefa ? 'Salvar e enviar tarefa à TI' : 'Salvar alterações'

  const campoObservacao = (
    <AreaTexto
      rotulo={ROTULO_OBSERVACAO}
      rows={3}
      className="formulario-dashboard__observacao"
      value={observacao}
      onChange={(evento) => setObservacao(evento.target.value)}
    />
  )

  return (
    <form className="formulario-dashboard" onSubmit={enviar} noValidate>
      <RegiaoStatus mensagem={carregandoListas ? 'Carregando dados do formulário...' : null} />
      {erroListas ? <Aviso tipo="erro">{erroListas}</Aviso> : null}

      <div className="formulario-dashboard__grade">
        <Campo
          rotulo="Nome do dashboard"
          obrigatorio
          autoComplete="off"
          placeholder="Ex.: PED Supervisor Comercial"
          value={nome}
          erro={erros.nome}
          onChange={(evento) => {
            setNome(evento.target.value)
            if (evento.target.value.trim() !== '') limparErro('nome')
          }}
        />
        <Select
          rotulo="Periodicidade de lançamento"
          opcoes={OPCOES_PERIODICIDADE}
          value={periodicidade}
          onChange={(evento) => setPeriodicidade(evento.target.value)}
        />
        {edicao ? (
          <Campo
            rotulo="Pontuação base máxima"
            obrigatorio
            readOnly
            className="formulario-dashboard__travado"
            value={`${formatarPontos(dashboard.pontuacaoBaseMaxima)} pts`}
            dica={DICA_PONTUACAO_EDICAO}
            sufixo={ICONE_CADEADO}
          />
        ) : (
          <Campo
            rotulo="Pontuação base máxima"
            obrigatorio
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 120"
            value={pontuacao}
            erro={erros.pontuacao}
            dica={DICA_PONTUACAO_CADASTRO}
            onChange={(evento) => {
              setPontuacao(evento.target.value)
              limparErro('pontuacao')
            }}
          />
        )}
      </div>

      <SecaoVinculo
        valor={vinculo}
        onChange={alterarVinculo}
        filiais={listas.filiais}
        cargos={listas.cargos}
        colaboradores={listas.colaboradores}
        erroItens={erros.itensVinculo}
      />

      <SecaoIndicadores
        indicadores={listas.indicadores}
        dadosExternos={listas.dadosExternos}
        tipoVinculo={vinculo.tipo}
        pontuacaoMaxima={pontuacaoMaxima}
        valor={indicadores}
        onChange={alterarIndicadores}
        idsJaVinculados={idsJaVinculados}
        erro={erros.indicadores}
        errosPontos={errosPontos}
      />

      <div className="formulario-dashboard__grade">
        <div className="formulario-dashboard__linha-inteira">
          <Select
            rotulo="Indicador base da faixa"
            obrigatorio
            placeholder="Selecione"
            opcoes={opcoesIndicadorBase}
            value={indicadorBaseAtual}
            disabled={semIndicadores}
            descricao={semIndicadores ? ORIENTACAO_INDICADOR_BASE : undefined}
            erro={erros.indicadorBase}
            onChange={(evento) => {
              setIndicadorBase(evento.target.value)
              limparErro('indicadorBase')
            }}
          />
        </div>
        <div className="formulario-dashboard__linha-inteira">
          <AreaTexto
            rotulo="Fórmula de pontuação"
            obrigatorio
            rows={3}
            value={formula}
            erro={erros.formula}
            onChange={(evento) => {
              setFormula(evento.target.value)
              if (evento.target.value.trim() !== '') limparErro('formula')
            }}
          />
        </div>
      </div>

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {edicao ? (
        <>
          <label className="formulario-dashboard__caixa">
            <input
              type="checkbox"
              checked={enviarTarefa}
              disabled={emConstrucao}
              aria-describedby={emConstrucao ? idDescricaoEnviar : undefined}
              onChange={(evento) => setEnviarTarefa(evento.target.checked)}
            />
            <span className="formulario-dashboard__caixa-texto">
              <span className="formulario-dashboard__caixa-titulo">Enviar tarefa à TI para realizar as modificações</span>
              <span className="formulario-dashboard__caixa-apoio">{APOIO_ENVIAR_TAREFA}</span>
              {emConstrucao ? (
                <span id={idDescricaoEnviar} className="formulario-dashboard__caixa-apoio">
                  Indisponível enquanto o dashboard está em construção.
                </span>
              ) : null}
            </span>
          </label>
          {tarefas.length > 0 ? (
            <p className="formulario-dashboard__tarefas">
              Tarefas anteriores: {tarefasRecentesPrimeiro(tarefas).map(textoTarefa).join(' | ')}
            </p>
          ) : null}
        </>
      ) : null}

      {!edicao ? (
        <BlocoTarefa
          titulo="Tarefa de construção que será criada no Bitrix24"
          aviso="O dashboard nasce inativo (em construção) e só fica ativo quando a TI concluir a tarefa."
        >
          <RegiaoStatus mensagem={chavePrevia !== null && previa?.carregando && previa.chave === chavePrevia ? 'Gerando a prévia da tarefa...' : null} />
          {chavePrevia === null ? (
            <p className="formulario-dashboard__bx-orientacao">{ORIENTACAO_PREVIA}</p>
          ) : (
            <>
              {previa?.erro && previa.chave === chavePrevia ? <Aviso tipo="erro">{previa.erro}</Aviso> : null}
              {previa?.tarefa ? (
                <>
                  <ValorTarefa rotulo="Título" destaque>
                    {previa.tarefa.titulo}
                  </ValorTarefa>
                  <ValorTarefa rotulo="Descrição">{previa.tarefa.descricao}</ValorTarefa>
                </>
              ) : null}
            </>
          )}
          {campoObservacao}
        </BlocoTarefa>
      ) : null}

      {edicao && enviarTarefa ? (
        <BlocoTarefa
          titulo="Tarefa de modificação que será enviada ao Bitrix24"
          aviso="Ao enviar, o dashboard fica inativo (em modificação) até a TI concluir a tarefa."
        >
          <ValorTarefa rotulo="Título" destaque>{`[PED] Modificar dashboard: ${nome.trim()}`}</ValorTarefa>
          {campoObservacao}
        </BlocoTarefa>
      ) : null}

      <div className="formulario-dashboard__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          {textoBotaoPrincipal}
        </Botao>
      </div>
    </form>
  )
}

/** Chave estável dos dados válidos (dispara a prévia quando muda); `null` sem dados válidos. */
function chaveDosDados(dados: DadosDashboard | null): string | null {
  return dados === null ? null : JSON.stringify(dados)
}

/** Bloco da tarefa do Bitrix24 (cabeçalho escuro, responsável e aviso), como o "bx" do protótipo. */
function BlocoTarefa({ titulo, aviso, children }: { titulo: string; aviso: string; children: ReactNode }) {
  const idTitulo = useId()
  return (
    <section className="formulario-dashboard__bx" aria-labelledby={idTitulo}>
      <div className="formulario-dashboard__bx-cabecalho">
        <span id={idTitulo} className="formulario-dashboard__bx-titulo">
          {titulo}
        </span>
        <span>Responsável: Equipe de TI</span>
      </div>
      <div className="formulario-dashboard__bx-corpo">
        <p className="formulario-dashboard__bx-aviso">{aviso}</p>
        {children}
      </div>
    </section>
  )
}

/** Par rótulo/valor do bloco da tarefa ("kv" do protótipo); o valor preserva as quebras de linha. */
function ValorTarefa({ rotulo, destaque = false, children }: { rotulo: string; destaque?: boolean; children: ReactNode }) {
  return (
    <div className="formulario-dashboard__kv">
      <span className="formulario-dashboard__kv-rotulo">{rotulo}</span>
      <span className={destaque ? 'formulario-dashboard__kv-valor formulario-dashboard__kv-valor--destaque' : 'formulario-dashboard__kv-valor'}>
        {children}
      </span>
    </div>
  )
}
