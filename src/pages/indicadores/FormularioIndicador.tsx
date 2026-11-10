/**
 * Formulário de cadastro de indicador (F6.4 — RF-34, RF-35, RF-37).
 *
 * Campos: Nome, Meta (pt-BR, maior que zero), Sentido, Descrição e "Meta editável no preenchimento".
 * Meta por filial (F6.10, ver `useMetaPorFilial`): na visão "Todas as filiais", o checkbox "Replicar a
 * meta para todas as filiais" (marcado por padrão) mantém o campo "Meta"; desmarcado, o campo dá lugar
 * ao grupo "Metas por filial", com um campo por filial de `filiais`. Na visão de uma filial, há um
 * único campo "Meta da filial {código} - {nome}". Envia `meta` ou `metasPorFilial`, nunca os dois.
 * Erros 400 por filial (`errosFiliais`) aparecem nos campos das filiais, como em `useMetaPorFilial`.
 * Meta via API (F6.11): o checkbox "Buscar metas via API" (desmarcado por padrão) esconde os campos de
 * meta e "Meta editável no preenchimento"; a meta não é validada e o envio leva `origemDaMeta:
 * 'terceiro'` e `metaEditavel: false`, sem `meta` nem `metasPorFilial`. Desmarcar restaura os campos
 * como estavam. Contrato final (F6.11): marcado, com um dado externo que fornece meta, aparece
 * "Meta vinda do dado externo" (marcado por padrão → `fonteDaMeta: 'dado_externo'`); nos demais casos
 * a fonte é `integracao`. Com `consultaIntegracaoDisponivel` `false`, a fonte `integracao` mostra um
 * aviso, sem bloquear o envio.
 * A composição é exclusiva (RF-35): ou um ou mais apontamentos (com "Cálculo do realizado" obrigatório),
 * ou um dado externo. Apontamentos e dado externo são escolhidos em dropdowns com busca (como no
 * protótipo, bloco indModal); a área de itens mostra só o que foi escolhido, com "Remover". Escolher
 * de um tipo bloqueia o outro até o item ser removido.
 *
 * Valida localmente antes de chamar `onSalvar`. O indicador não é editável depois de cadastrado, por
 * isso não há campo de situação nem ação de editar. O erro devolvido pela API (`erro`) aparece dentro
 * do formulário sem apagar o que o usuário digitou. Os apontamentos e dados externos chegam prontos
 * pela página (somente ativos); a carga e o erro da carga são exibidos aqui.
 */
import { useState, type FormEvent } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import { Etiqueta } from '../../components/Etiqueta'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import { Select, type OpcaoSelect } from '../../components/Select'
import type { ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import {
  CALCULOS,
  ROTULOS_CALCULO,
  ROTULOS_COLETA,
  ROTULOS_REFERENCIA,
  ROTULOS_SENTIDO,
  ROTULOS_SISTEMA_ORIGEM,
  ROTULOS_TIPO_VALOR,
  SENTIDOS,
  type Apontamento,
  type DadoExterno,
  type Filial,
  type NovoIndicador,
} from '../../types/dominio'
import { normalizarBusca } from '../../utils/formato'
import { CaixaMetaViaApi, CampoMeta, OpcoesFonteDaMeta, OpcoesMetaPorFilial } from './CamposMetaPorFilial'
import { fonteDaMetaEscolhida } from '../../utils/metaViaApi'
import { useMetaPorFilial } from './useMetaPorFilial'
import './FormularioIndicador.css'

export interface FormularioIndicadorProps {
  /** Apontamentos ativos, na ordem de exibição. */
  apontamentos: Apontamento[]
  /** Dados externos ativos, na ordem de exibição. */
  dadosExternos: DadoExterno[]
  /** Enquanto `true`, a lista de componentes mostra o status de carregamento. */
  carregandoComponentes: boolean
  /** Erro ao carregar apontamentos e dados externos; `null` quando não há. */
  erroComponentes: string | null
  /** Enquanto `true`, o botão Salvar fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro devolvida ao salvar; `null` quando não há. */
  erro: string | null
  /**
   * Filial do cabeçalho (F6.10). Ausente, `null` ou `'todas'` = visão "Todas as filiais" (checkbox
   * "Replicar a meta para todas as filiais"); uma filial = meta só para ela.
   */
  filialSelecionada?: FilialSelecionada
  /** Filiais do acesso, listadas quando a meta não é replicada (F6.10). Padrão `[]`. */
  filiais?: Filial[]
  /**
   * Erros 400 por filial devolvidos pela API (F6.10, `errosPorFilial`). Padrão `[]`. Cada erro com
   * `filial` aparece no campo "Meta da filial {código} - {nome}" daquela filial (aria-invalid e
   * descrição acessível) e some ao editar o campo; `filial: null`, filial sem campo na tela ou
   * "Replicar" marcado ficam só no alerta geral (`erro`).
   */
  errosFiliais?: readonly ErroDeFilial[]
  /**
   * F6.11: a consulta da fonte `integracao` já roda no back-end (padrão `true`). Com `false`, a fonte
   * `integracao` mostra o aviso de consulta indisponível, sem bloquear o envio.
   */
  consultaIntegracaoDisponivel?: boolean
  onSalvar: (dados: NovoIndicador) => void
  onCancelar: () => void
}

/** A meta é validada à parte, por `useMetaPorFilial`. */
type CampoFormularioIndicador = 'nome' | 'sentido' | 'calculo' | 'composicao'

type ErrosFormulario = Partial<Record<CampoFormularioIndicador, string>>

/** Qual dropdown da composição está aberto; só um por vez, como no protótipo. */
type PainelComposicao = 'apontamentos' | 'dadoExterno'

/** Item exibido em um dropdown ou na lista de escolhidos: nome e subtexto. */
interface OpcaoComponente {
  id: number
  nome: string
  subtexto: string
}

const OPCOES_SENTIDO: OpcaoSelect[] = SENTIDOS.map((sentido) => ({ valor: sentido, rotulo: ROTULOS_SENTIDO[sentido] }))
const OPCOES_CALCULO: OpcaoSelect[] = CALCULOS.map((calculo) => ({ valor: calculo, rotulo: ROTULOS_CALCULO[calculo] }))

const BLOQUEIO_APONTAMENTOS = 'Bloqueado: este indicador já usa um dado externo. Remova o dado externo para vincular apontamentos.'
const BLOQUEIO_DADO_EXTERNO = 'Bloqueado: este indicador já usa apontamentos. Remova os apontamentos para vincular um dado externo.'

// Ícone do botão "Remover" (o nome acessível vem do aria-label, como antes).
const ICONE_REMOVER = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

// Seta do botão que abre o dropdown.
const ICONE_SETA = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const SEM_FILIAIS: Filial[] = []
const SEM_ERROS_FILIAIS: readonly ErroDeFilial[] = []

function encontrar<T extends string>(valores: readonly T[], texto: string): T | undefined {
  return valores.find((valor) => valor === texto)
}

function textoOuNulo(texto: string): string | null {
  const limpo = texto.trim()
  return limpo === '' ? null : limpo
}

/** Filtra por nome, ignorando acentos e maiúsculas (RNF-09). */
function contemTexto(nomeItem: string, busca: string): boolean {
  return normalizarBusca(nomeItem).includes(normalizarBusca(busca))
}

function paraOpcaoApontamento(apontamento: Apontamento): OpcaoComponente {
  return {
    id: apontamento.id,
    nome: apontamento.nome,
    subtexto: `${apontamento.tipo} · ${ROTULOS_TIPO_VALOR[apontamento.tipoValor]}`,
  }
}

function paraOpcaoDadoExterno(dado: DadoExterno): OpcaoComponente {
  const coleta = dado.coletaDescricao ?? ROTULOS_COLETA[dado.coleta]
  return {
    id: dado.id,
    nome: dado.nome,
    subtexto: `${ROTULOS_SISTEMA_ORIGEM[dado.sistemaOrigem]} · ${ROTULOS_REFERENCIA[dado.referencia]} · ${coleta}`,
  }
}

/** Mensagem do painel quando não há opções: sem ativos cadastrados ou sem resultado para a busca. */
function mensagemPainelVazio(
  carregadoSemErro: boolean,
  totalAtivos: number,
  opcoesFiltradas: number,
  semAtivos: string,
  semResultado: string,
): string | null {
  if (!carregadoSemErro) return null
  if (totalAtivos === 0) return semAtivos
  return opcoesFiltradas === 0 ? semResultado : null
}

interface SeletorComponentesProps {
  textoBotao: string
  aberto: boolean
  onAlternar: () => void
  rotuloBusca: string
  busca: string
  onBusca: (texto: string) => void
  rotuloLista: string
  opcoes: OpcaoComponente[]
  mensagemVazia: string | null
  onEscolher: (id: number) => void
}

/** Botão que abre o painel com busca e a lista de opções (dropdown do protótipo, bloco indModal). */
function SeletorComponentes({
  textoBotao,
  aberto,
  onAlternar,
  rotuloBusca,
  busca,
  onBusca,
  rotuloLista,
  opcoes,
  mensagemVazia,
  onEscolher,
}: SeletorComponentesProps) {
  return (
    <div className="formulario-indicador__dd">
      <button type="button" className="formulario-indicador__dd-botao foco-anel" aria-expanded={aberto} onClick={onAlternar}>
        <span>{textoBotao}</span>
        {ICONE_SETA}
      </button>
      {aberto ? (
        <div className="formulario-indicador__dd-painel">
          <div className="formulario-indicador__dd-busca">
            <Campo
              rotulo={rotuloBusca}
              rotuloOculto
              type="search"
              autoComplete="off"
              placeholder={`${rotuloBusca}...`}
              value={busca}
              onChange={(evento) => onBusca(evento.target.value)}
            />
          </div>
          <div role="listbox" aria-label={rotuloLista} className="formulario-indicador__dd-opcoes">
            {opcoes.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                role="option"
                aria-selected={false}
                className="formulario-indicador__dd-opcao foco-anel"
                onClick={() => onEscolher(opcao.id)}
              >
                <span>{opcao.nome}</span>
                <small>{opcao.subtexto}</small>
              </button>
            ))}
          </div>
          {mensagemVazia ? <p className="formulario-indicador__dd-vazio">{mensagemVazia}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

interface ItensEscolhidosProps {
  rotuloLista: string
  textoVazio: string
  itens: OpcaoComponente[]
  onRemover: (id: number) => void
}

/** Área de itens: só os escolhidos, cada um com "Remover {nome}"; vazia mostra o texto de vazio. */
function ItensEscolhidos({ rotuloLista, textoVazio, itens, onRemover }: ItensEscolhidosProps) {
  return (
    <div className="formulario-indicador__selecionados">
      {itens.length === 0 ? (
        <p className="formulario-indicador__vazio">{textoVazio}</p>
      ) : (
        <ul className="formulario-indicador__lista" aria-label={rotuloLista}>
          {itens.map((item) => (
            <li key={item.id} className="formulario-indicador__escolhido">
              <span className="formulario-indicador__escolhido-texto">
                <span>{item.nome}</span>
                <small>{item.subtexto}</small>
              </span>
              <Botao
                variante="perigo"
                className="formulario-indicador__remover"
                aria-label={`Remover ${item.nome}`}
                onClick={() => onRemover(item.id)}
              >
                {ICONE_REMOVER}
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function FormularioIndicador({
  apontamentos,
  dadosExternos,
  carregandoComponentes,
  erroComponentes,
  salvando,
  erro,
  filialSelecionada,
  filiais = SEM_FILIAIS,
  errosFiliais = SEM_ERROS_FILIAIS,
  consultaIntegracaoDisponivel = true,
  onSalvar,
  onCancelar,
}: FormularioIndicadorProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const meta = useMetaPorFilial(filialSelecionada, filiais, { errosFiliais })
  const [sentido, setSentido] = useState('')
  const [metaEditavel, setMetaEditavel] = useState(false)
  const [metaViaApi, setMetaViaApi] = useState(false)
  const [metaDoDado, setMetaDoDado] = useState(true)
  const [calculo, setCalculo] = useState('')
  const [idsApontamentos, setIdsApontamentos] = useState<number[]>([])
  const [idDadoExterno, setIdDadoExterno] = useState<number | null>(null)
  const [painelAberto, setPainelAberto] = useState<PainelComposicao | null>(null)
  const [buscaApontamento, setBuscaApontamento] = useState('')
  const [buscaDadoExterno, setBuscaDadoExterno] = useState('')
  const [erros, setErros] = useState<ErrosFormulario>({})

  // Componentes escolhidos, na ordem em que foram escolhidos (ids que sumirem da lista são ignorados).
  const escolhidosApontamento = idsApontamentos.flatMap((id) => {
    const apontamento = apontamentos.find((item) => item.id === id)
    return apontamento ? [apontamento] : []
  })
  const dadoEscolhido = dadosExternos.find((item) => item.id === idDadoExterno)
  const temApontamentos = escolhidosApontamento.length > 0
  const temDadoExterno = dadoEscolhido !== undefined
  const dadoForneceMeta = dadoEscolhido?.forneceMeta === true
  const carregadoSemErro = !carregandoComponentes && erroComponentes === null

  // Opções: ativos ainda não escolhidos, filtrados pela busca (só pelo nome).
  const opcoesApontamento = apontamentos
    .filter((item) => !idsApontamentos.includes(item.id) && contemTexto(item.nome, buscaApontamento))
    .map(paraOpcaoApontamento)
  const opcoesDadoExterno = dadosExternos
    .filter((item) => item.id !== idDadoExterno && contemTexto(item.nome, buscaDadoExterno))
    .map(paraOpcaoDadoExterno)

  function limparErro(campo: CampoFormularioIndicador) {
    setErros((atual) => (atual[campo] ? { ...atual, [campo]: undefined } : atual))
  }

  function atualizarApontamentos(proximos: number[]) {
    setIdsApontamentos(proximos)
    // Sem apontamentos, o cálculo não se aplica: limpa a escolha para não ficar oculta e esquecida.
    if (proximos.length === 0) setCalculo('')
    limparErro('composicao')
  }

  function alternarPainel(painel: PainelComposicao) {
    setPainelAberto((atual) => (atual === painel ? null : painel))
    setBuscaApontamento('')
    setBuscaDadoExterno('')
  }

  // Escolher um apontamento mantém o painel aberto, para escolher outros.
  function adicionarApontamento(id: number) {
    atualizarApontamentos([...idsApontamentos, id])
  }

  function removerApontamento(id: number) {
    atualizarApontamentos(idsApontamentos.filter((item) => item !== id))
  }

  // Escolher o dado externo define o componente e fecha o painel.
  function escolherDadoExterno(id: number) {
    setIdDadoExterno(id)
    // F6.11: "Meta vinda do dado externo" volta ao padrão (marcado) a cada dado escolhido.
    setMetaDoDado(true)
    setPainelAberto(null)
    setBuscaDadoExterno('')
    limparErro('composicao')
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return

    const nomeLimpo = nome.trim()
    // Com a meta via API (F6.11), a meta digitada é ignorada e não é validada.
    const metaValidada = metaViaApi ? {} : meta.validar()
    const sentidoEscolhido = encontrar(SENTIDOS, sentido)
    const calculoEscolhido = encontrar(CALCULOS, calculo)
    const apontamentosEnviados = escolhidosApontamento.map((item) => item.id)
    const dadoEnviado = dadoEscolhido?.id

    const novosErros: ErrosFormulario = {}
    if (nomeLimpo === '') novosErros.nome = 'Informe o nome.'
    if (!sentidoEscolhido) novosErros.sentido = 'Selecione o sentido.'
    if (apontamentosEnviados.length === 0 && dadoEnviado === undefined) {
      novosErros.composicao = 'Escolha ao menos um apontamento ou um dado externo.'
    } else if (apontamentosEnviados.length > 0 && !calculoEscolhido) {
      novosErros.calculo = 'Selecione o cálculo do realizado.'
    }
    setErros(novosErros)

    if (Object.keys(novosErros).length > 0 || metaValidada === null || !sentidoEscolhido) return

    const base: NovoIndicador = metaViaApi
      ? {
          nome: nomeLimpo,
          descricao: textoOuNulo(descricao),
          origemDaMeta: 'terceiro',
          fonteDaMeta: fonteDaMetaEscolhida(dadoForneceMeta, metaDoDado),
          sentido: sentidoEscolhido,
          metaEditavel: false,
        }
      : { nome: nomeLimpo, descricao: textoOuNulo(descricao), ...metaValidada, sentido: sentidoEscolhido, metaEditavel }
    if (dadoEnviado !== undefined) {
      onSalvar({ ...base, dadoExterno: dadoEnviado })
      return
    }
    if (calculoEscolhido) {
      onSalvar({ ...base, calculo: calculoEscolhido, apontamentos: apontamentosEnviados })
    }
  }

  return (
    <form className="formulario-indicador" onSubmit={enviar} noValidate>
      <RegiaoStatus mensagem={carregandoComponentes ? 'Carregando apontamentos e dados externos...' : null} />
      {erroComponentes ? <Aviso tipo="erro">{erroComponentes}</Aviso> : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <div className="formulario-indicador__grade">
        <Campo
          rotulo="Nome"
          obrigatorio
          value={nome}
          erro={erros.nome}
          onChange={(evento) => {
            setNome(evento.target.value)
            if (evento.target.value.trim() !== '') limparErro('nome')
          }}
        />
        {metaViaApi ? null : <CampoMeta estado={meta} />}
        <Select
          rotulo="Sentido"
          obrigatorio
          placeholder="Selecione"
          opcoes={OPCOES_SENTIDO}
          value={sentido}
          erro={erros.sentido}
          onChange={(evento) => {
            setSentido(evento.target.value)
            limparErro('sentido')
          }}
        />
        <AreaTexto rotulo="Descrição" rows={3} value={descricao} onChange={(evento) => setDescricao(evento.target.value)} />
      </div>
      <CaixaMetaViaApi marcada={metaViaApi} onAlterar={setMetaViaApi} />
      <OpcoesFonteDaMeta
        viaApi={metaViaApi}
        dadoForneceMeta={dadoForneceMeta}
        metaDoDado={metaDoDado}
        onAlterarMetaDoDado={setMetaDoDado}
        consultaIntegracaoDisponivel={consultaIntegracaoDisponivel}
      />
      {metaViaApi ? null : (
        <>
          <OpcoesMetaPorFilial estado={meta} />
          <label className="formulario-indicador__caixa">
            <input type="checkbox" checked={metaEditavel} onChange={(evento) => setMetaEditavel(evento.target.checked)} />
            Meta editável no preenchimento
          </label>
        </>
      )}
      <p className="formulario-indicador__nota">
        Um indicador é composto por <strong>um ou vários apontamentos</strong> ou por <strong>apenas um dado externo</strong>.
        Escolhendo um tipo, o outro fica bloqueado.
      </p>

      <fieldset className="formulario-indicador__composicao">
        <legend>Composição</legend>

        <fieldset className="formulario-indicador__grupo">
          <legend className="formulario-indicador__grupo-titulo">Apontamentos</legend>
          <Etiqueta tom="info" className="formulario-indicador__contagem">
            {escolhidosApontamento.length} selecionados
          </Etiqueta>
          {temDadoExterno ? (
            <p className="formulario-indicador__aviso">{BLOQUEIO_APONTAMENTOS}</p>
          ) : (
            <SeletorComponentes
              textoBotao="Selecionar apontamento"
              aberto={painelAberto === 'apontamentos'}
              onAlternar={() => alternarPainel('apontamentos')}
              rotuloBusca="Buscar apontamento"
              busca={buscaApontamento}
              onBusca={setBuscaApontamento}
              rotuloLista="Apontamentos"
              opcoes={opcoesApontamento}
              mensagemVazia={mensagemPainelVazio(
                carregadoSemErro,
                apontamentos.length,
                opcoesApontamento.length,
                'Nenhum apontamento ativo disponível.',
                'Nenhum apontamento encontrado.',
              )}
              onEscolher={adicionarApontamento}
            />
          )}
          <ItensEscolhidos
            rotuloLista="Apontamentos escolhidos"
            textoVazio="Nenhum apontamento selecionado."
            itens={escolhidosApontamento.map(paraOpcaoApontamento)}
            onRemover={removerApontamento}
          />
          {temApontamentos ? (
            <Select
              rotulo="Cálculo do realizado"
              obrigatorio
              placeholder="Selecione"
              opcoes={OPCOES_CALCULO}
              value={calculo}
              erro={erros.calculo}
              onChange={(evento) => {
                setCalculo(evento.target.value)
                limparErro('calculo')
              }}
            />
          ) : null}
        </fieldset>

        <fieldset className="formulario-indicador__grupo">
          <legend className="formulario-indicador__grupo-titulo">Dado externo</legend>
          <Etiqueta tom="dourado" className="formulario-indicador__contagem">
            {temDadoExterno ? 1 : 0} de 1
          </Etiqueta>
          {temApontamentos ? (
            <p className="formulario-indicador__aviso">{BLOQUEIO_DADO_EXTERNO}</p>
          ) : temDadoExterno ? null : (
            <SeletorComponentes
              textoBotao="Selecionar dado externo"
              aberto={painelAberto === 'dadoExterno'}
              onAlternar={() => alternarPainel('dadoExterno')}
              rotuloBusca="Buscar dado externo"
              busca={buscaDadoExterno}
              onBusca={setBuscaDadoExterno}
              rotuloLista="Dados externos"
              opcoes={opcoesDadoExterno}
              mensagemVazia={mensagemPainelVazio(
                carregadoSemErro,
                dadosExternos.length,
                opcoesDadoExterno.length,
                'Nenhum dado externo ativo disponível.',
                'Nenhum dado externo encontrado.',
              )}
              onEscolher={escolherDadoExterno}
            />
          )}
          <ItensEscolhidos
            rotuloLista="Dado externo escolhido"
            textoVazio="Nenhum dado externo selecionado."
            itens={dadoEscolhido ? [paraOpcaoDadoExterno(dadoEscolhido)] : []}
            onRemover={() => setIdDadoExterno(null)}
          />
        </fieldset>

        <ErroCampo mensagem={erros.composicao} />
      </fieldset>

      <div className="formulario-indicador__acoes">
        <Botao variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          Salvar
        </Botao>
      </div>
    </form>
  )
}
