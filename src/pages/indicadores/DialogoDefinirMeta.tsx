/**
 * Diálogo "Definir meta" de um indicador criado automaticamente (F6.5 — RF-36).
 *
 * Um indicador criado a partir de dado externo nasce sem meta nem sentido ("meta a definir"). Este
 * diálogo pede a meta (maior que zero, em pt-BR), o sentido e se a meta é editável no preenchimento.
 * Valida localmente antes de chamar `onConfirmar`; o erro devolvido pela API (`erro`) aparece dentro
 * do diálogo sem apagar os valores digitados. Enquanto `definindo`, o botão de envio fica desabilitado.
 *
 * Meta por filial (F6.10, ver `useMetaPorFilial`): como no cadastro, na visão "Todas as filiais" o
 * checkbox "Replicar a meta para todas as filiais" (marcado por padrão) mantém o campo "Meta" ao lado
 * do Sentido; desmarcado, o grupo "Metas por filial" lista as filiais de `filiais`. Na visão de uma
 * filial, há um único campo "Meta da filial {código} - {nome}". Envia `meta` ou `metasPorFilial`.
 * Erros 400 por filial (`errosFiliais`) aparecem nos campos das filiais, como em `useMetaPorFilial`.
 *
 * Meta via API (F6.11): o checkbox "Buscar metas via API" (desmarcado por padrão) esconde os campos de
 * meta e "Meta editável no preenchimento"; o Sentido continua obrigatório e a confirmação envia
 * `{ origemDaMeta: 'terceiro', fonteDaMeta, sentido, metaEditavel: false }`. Desmarcar restaura os
 * campos como estavam.
 * Fonte da meta (F6.11, contrato final): o dado externo de origem é procurado em `dadosExternos` pelo id
 * de `indicador.composicao.itens[0]`; com `forneceMeta: true` aparece "Meta vinda do dado externo"
 * (marcado por padrão → `fonteDaMeta: 'dado_externo'`); desmarcado, dado sem `forneceMeta` ou fora da
 * lista → `integracao`. Com `consultaIntegracaoDisponivel` `false`, a fonte `integracao` mostra o aviso
 * do cadastro, sem bloquear. Enquanto `carregandoDadosExternos` e com "Buscar metas via API" marcado, o
 * botão "Definir meta" fica desabilitado, para não enviar `integracao` antes de saber se o dado fornece
 * meta.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import { Select, type OpcaoSelect } from '../../components/Select'
import type { DadosMeta, ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { ROTULOS_SENTIDO, SENTIDOS, type DadoExterno, type Filial, type Indicador, type Sentido } from '../../types/dominio'
import { CaixaMetaViaApi, CampoMeta, OpcoesFonteDaMeta, OpcoesMetaPorFilial } from './CamposMetaPorFilial'
import { fonteDaMetaEscolhida } from '../../utils/metaViaApi'
import { useMetaPorFilial } from './useMetaPorFilial'
import './FormularioIndicador.css'

export interface DialogoDefinirMetaProps {
  /** Indicador a receber a meta; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Enquanto `true`, o botão "Definir meta" fica desabilitado. */
  definindo: boolean
  /** Mensagem de erro devolvida pela API; `null` quando não há. */
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
   * F6.11: dados externos conhecidos (padrão `[]`), para saber se o dado de origem do indicador fornece
   * meta. A página carrega a lista ao abrir o diálogo.
   */
  dadosExternos?: DadoExterno[]
  /**
   * F6.11: `true` enquanto a lista `dadosExternos` carrega (padrão `false`); com "Buscar metas via API"
   * marcado, o botão "Definir meta" fica desabilitado.
   */
  carregandoDadosExternos?: boolean
  /** F6.11: a consulta da fonte `integracao` já roda no back-end (padrão `true`); `false` mostra o aviso. */
  consultaIntegracaoDisponivel?: boolean
  onConfirmar: (dados: DadosMeta) => void
  onCancelar: () => void
}

/** A meta é validada à parte, por `useMetaPorFilial`. */
interface ErrosMeta {
  sentido?: string
}

const SEM_FILIAIS: Filial[] = []
const SEM_ERROS_FILIAIS: readonly ErroDeFilial[] = []
const SEM_DADOS_EXTERNOS: DadoExterno[] = []
const SEM_META_VIA_API = { id: -1, marcada: false }

const OPCOES_SENTIDO: OpcaoSelect[] = SENTIDOS.map((sentido) => ({ valor: sentido, rotulo: ROTULOS_SENTIDO[sentido] }))

/** Id do formulário; o botão "Definir meta" fica no rodapé do diálogo e envia por `form`. */
function idDoFormulario(indicador: Indicador): string {
  return `formulario-definir-meta-${indicador.id}`
}

function ehSentido(valor: string): valor is Sentido {
  return (SENTIDOS as readonly string[]).includes(valor)
}

interface ConteudoDefinirMetaProps {
  indicador: Indicador
  definindo: boolean
  erro: string | null
  filialSelecionada: FilialSelecionada | undefined
  filiais: Filial[]
  errosFiliais: readonly ErroDeFilial[]
  dadosExternos: DadoExterno[]
  bloquearEnvio: boolean
  consultaIntegracaoDisponivel: boolean
  metaViaApi: boolean
  onAlterarMetaViaApi: (marcada: boolean) => void
  onConfirmar: (dados: DadosMeta) => void
}

/** Formulário do diálogo; montado a cada indicador aberto, então parte sempre limpo. */
function ConteudoDefinirMeta({
  indicador,
  definindo,
  erro,
  filialSelecionada,
  filiais,
  errosFiliais,
  dadosExternos,
  bloquearEnvio,
  consultaIntegracaoDisponivel,
  metaViaApi,
  onAlterarMetaViaApi,
  onConfirmar,
}: ConteudoDefinirMetaProps) {
  const meta = useMetaPorFilial(filialSelecionada, filiais, { errosFiliais })
  const [sentido, setSentido] = useState('')
  const [metaEditavel, setMetaEditavel] = useState(false)
  const [metaDoDado, setMetaDoDado] = useState(true)
  const [erros, setErros] = useState<ErrosMeta>({})

  const componente = indicador.composicao.tipo === 'dado_externo' ? indicador.composicao.itens[0] : undefined
  const origem = componente?.nome
  const dadoForneceMeta = componente !== undefined && dadosExternos.some((dado) => dado.id === componente.id && dado.forneceMeta)

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (definindo || bloquearEnvio) return

    // Com a meta via API (F6.11), a meta digitada é ignorada e não é validada.
    const metaValidada = metaViaApi ? {} : meta.validar()
    const sentidoEscolhido = ehSentido(sentido) ? sentido : undefined

    const novosErros: ErrosMeta = {}
    if (sentidoEscolhido === undefined) novosErros.sentido = 'Selecione o sentido.'
    setErros(novosErros)

    if (metaValidada === null || sentidoEscolhido === undefined) return
    if (metaViaApi) {
      onConfirmar({
        origemDaMeta: 'terceiro',
        fonteDaMeta: fonteDaMetaEscolhida(dadoForneceMeta, metaDoDado),
        sentido: sentidoEscolhido,
        metaEditavel: false,
      })
      return
    }
    onConfirmar({ ...metaValidada, sentido: sentidoEscolhido, metaEditavel })
  }

  return (
    <form id={idDoFormulario(indicador)} className="formulario-indicador" onSubmit={enviar} noValidate>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {origem ? (
        <div className="formulario-indicador__origem">
          <span className="formulario-indicador__origem-rotulo">Composição</span>
          <p className="formulario-indicador__origem-valor">Dado externo de origem: {origem}</p>
        </div>
      ) : null}
      <div className="formulario-indicador__linha">
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
            setErros((atual) => ({ ...atual, sentido: undefined }))
          }}
        />
      </div>
      <CaixaMetaViaApi marcada={metaViaApi} onAlterar={onAlterarMetaViaApi} />
      <RegiaoStatus mensagem={bloquearEnvio ? 'Carregando dados externos...' : null} />
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
    </form>
  )
}

export function DialogoDefinirMeta({
  indicador,
  definindo,
  erro,
  filialSelecionada,
  filiais = SEM_FILIAIS,
  errosFiliais = SEM_ERROS_FILIAIS,
  dadosExternos = SEM_DADOS_EXTERNOS,
  carregandoDadosExternos = false,
  consultaIntegracaoDisponivel = true,
  onConfirmar,
  onCancelar,
}: DialogoDefinirMetaProps) {
  // "Buscar metas via API" fica aqui (e não no conteúdo) porque o botão de envio, no rodapé, depende dele.
  // Volta a desmarcado a cada abertura (outro indicador ou o mesmo, depois de fechar).
  const [viaApi, setViaApi] = useState<{ id: number; marcada: boolean }>(SEM_META_VIA_API)
  if (indicador === null && viaApi !== SEM_META_VIA_API) setViaApi(SEM_META_VIA_API)
  const metaViaApi = indicador !== null && viaApi.id === indicador.id && viaApi.marcada
  const bloquearEnvio = metaViaApi && carregandoDadosExternos
  return (
    <Dialogo
      aberto={indicador !== null}
      titulo="Definir meta"
      descricao={indicador?.nome}
      className="dialogo--definir-meta"
      onFechar={onCancelar}
      acoes={
        indicador ? (
          <>
            <Botao variante="contorno" onClick={onCancelar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idDoFormulario(indicador)} disabled={definindo || bloquearEnvio}>
              Definir meta
            </Botao>
          </>
        ) : null
      }
    >
      {indicador ? (
        <ConteudoDefinirMeta
          key={indicador.id}
          indicador={indicador}
          definindo={definindo}
          erro={erro}
          filialSelecionada={filialSelecionada}
          filiais={filiais}
          errosFiliais={errosFiliais}
          dadosExternos={dadosExternos}
          bloquearEnvio={bloquearEnvio}
          consultaIntegracaoDisponivel={consultaIntegracaoDisponivel}
          metaViaApi={metaViaApi}
          onAlterarMetaViaApi={(marcada) => setViaApi({ id: indicador.id, marcada })}
          onConfirmar={onConfirmar}
        />
      ) : null}
    </Dialogo>
  )
}
