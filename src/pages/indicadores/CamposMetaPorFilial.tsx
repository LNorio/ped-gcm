/**
 * Campos da meta do indicador (F6.10), compartilhados pelo cadastro (`FormularioIndicador`) e pela
 * modal "Definir meta" (`DialogoDefinirMeta`). O estado e a validação ficam em `useMetaPorFilial`.
 *
 * - `CampoMeta`: o campo único, no lugar do antigo campo "Meta" (ao lado do Sentido). Na visão
 *   "Todas as filiais" com "Replicar" marcado é o campo "Meta"; na visão de uma filial é
 *   "Meta da filial {código} - {nome}". Com a lista de filiais, não renderiza nada.
 * - `OpcoesMetaPorFilial`: só na visão "Todas as filiais": o checkbox "Replicar a meta para todas as
 *   filiais" e, desmarcado, o grupo "Metas por filial" com um campo por filial (rolagem própria
 *   quando há muitas filiais).
 * - `ListaMetasPorFilial`: o grupo com um campo por filial, também usado pela modal "Definir metas
 *   pendentes" (F6.12, grupo "Filiais sem meta").
 * - `CaixaMetaViaApi` (F6.11): o checkbox "Buscar metas via API". Marcado, quem o usa deixa de
 *   renderizar `CampoMeta`, `OpcoesMetaPorFilial` e "Meta editável no preenchimento" (o estado da meta
 *   é mantido, para voltar como estava ao desmarcar).
 * - `OpcoesFonteDaMeta` (F6.11, contrato final): com "Buscar metas via API" marcado, o checkbox
 *   "Meta vinda do dado externo" (só quando o dado externo da composição fornece meta) e o aviso de
 *   consulta indisponível da fonte `integracao` (`fonteDaMetaEscolhida`, em `utils/metaViaApi`, resolve
 *   a fonte enviada).
 */
import { Aviso } from '../../components/Aviso'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import { AVISO_CONSULTA_INTEGRACAO_INDISPONIVEL, fonteDaMetaEscolhida } from '../../utils/metaViaApi'
import { rotuloFilial, type UseMetaPorFilialResultado } from './useMetaPorFilial'

export interface CamposMetaPorFilialProps {
  /** Resultado de `useMetaPorFilial`. */
  estado: UseMetaPorFilialResultado
}

export function CampoMeta({ estado }: CamposMetaPorFilialProps) {
  const { filialFixa, replicar, metaUnica, alterarMetaUnica, erros } = estado
  if (filialFixa === null && !replicar) return null
  return (
    <Campo
      rotulo={filialFixa === null ? 'Meta' : `Meta da filial ${rotuloFilial(filialFixa)}`}
      obrigatorio
      inputMode="decimal"
      autoComplete="off"
      value={metaUnica}
      erro={erros.meta}
      onChange={(evento) => alterarMetaUnica(evento.target.value)}
    />
  )
}

/** Renderiza elementos irmãos (sem invólucro) para herdar o espaçamento do formulário. */
export function OpcoesMetaPorFilial({ estado }: CamposMetaPorFilialProps) {
  const { filialFixa, replicar, alternarReplicar } = estado
  if (filialFixa !== null) return null
  return (
    <>
      <label className="formulario-indicador__caixa">
        <input type="checkbox" checked={replicar} onChange={(evento) => alternarReplicar(evento.target.checked)} />
        Replicar a meta para todas as filiais
      </label>
      {replicar ? null : (
        <ListaMetasPorFilial
          estado={estado}
          titulo="Metas por filial"
          nota="Informe a meta de cada filial. As filiais em branco ficam com a meta pendente."
        />
      )}
    </>
  )
}

export interface ListaMetasPorFilialProps extends CamposMetaPorFilialProps {
  /** Legenda do grupo (nome acessível do `fieldset`). */
  titulo: string
  nota: string
}

/**
 * Grupo com um campo (não obrigatório) por filial de `estado.filiais`, com o erro de cada campo e o
 * erro do grupo. Usado em "Metas por filial" (F6.10) e em "Filiais sem meta" (F6.12).
 */
export function ListaMetasPorFilial({ estado, titulo, nota }: ListaMetasPorFilialProps) {
  const { filiais, metasFiliais, alterarMetaFilial, erros } = estado
  return (
    <fieldset className="formulario-indicador__filiais">
      <legend className="formulario-indicador__filiais-titulo">{titulo}</legend>
      <p className="formulario-indicador__filiais-nota">{nota}</p>
      {filiais.length === 0 ? (
        <p className="formulario-indicador__vazio">Nenhuma filial disponível.</p>
      ) : (
        <ul className="formulario-indicador__filiais-lista">
          {filiais.map((filial) => (
            <li key={filial.codigo} className="formulario-indicador__filial">
              <span className="formulario-indicador__filial-nome" aria-hidden="true">
                {rotuloFilial(filial)}
              </span>
              <Campo
                rotulo={`Meta da filial ${rotuloFilial(filial)}`}
                rotuloOculto
                inputMode="decimal"
                autoComplete="off"
                placeholder="Sem meta"
                value={metasFiliais[filial.codigo] ?? ''}
                erro={erros.filiais[filial.codigo]}
                onChange={(evento) => alterarMetaFilial(filial.codigo, evento.target.value)}
              />
            </li>
          ))}
        </ul>
      )}
      <ErroCampo mensagem={erros.grupo} />
    </fieldset>
  )
}

export interface CaixaMetaViaApiProps {
  marcada: boolean
  onAlterar: (marcada: boolean) => void
}

/** Checkbox "Buscar metas via API" (F6.11), do cadastro e do "Definir meta". */
export function CaixaMetaViaApi({ marcada, onAlterar }: CaixaMetaViaApiProps) {
  return (
    <label className="formulario-indicador__caixa">
      <input type="checkbox" checked={marcada} onChange={(evento) => onAlterar(evento.target.checked)} />
      Buscar metas via API
    </label>
  )
}

export interface OpcoesFonteDaMetaProps {
  /** "Buscar metas via API" marcado; desmarcado, nada é renderizado. */
  viaApi: boolean
  /** O dado externo da composição tem `forneceMeta: true`. */
  dadoForneceMeta: boolean
  /** Estado de "Meta vinda do dado externo" (marcado por padrão). */
  metaDoDado: boolean
  onAlterarMetaDoDado: (marcada: boolean) => void
  /** `false` mostra o aviso na fonte `integracao` (sem bloquear o envio). */
  consultaIntegracaoDisponivel: boolean
}

/** Checkbox "Meta vinda do dado externo" e aviso da consulta indisponível (F6.11, contrato final). */
export function OpcoesFonteDaMeta({
  viaApi,
  dadoForneceMeta,
  metaDoDado,
  onAlterarMetaDoDado,
  consultaIntegracaoDisponivel,
}: OpcoesFonteDaMetaProps) {
  if (!viaApi) return null
  const fonte = fonteDaMetaEscolhida(dadoForneceMeta, metaDoDado)
  return (
    <>
      {dadoForneceMeta ? (
        <label className="formulario-indicador__caixa">
          <input type="checkbox" checked={metaDoDado} onChange={(evento) => onAlterarMetaDoDado(evento.target.checked)} />
          Meta vinda do dado externo
        </label>
      ) : null}
      {fonte === 'integracao' && !consultaIntegracaoDisponivel ? (
        <Aviso tipo="alerta">{AVISO_CONSULTA_INTEGRACAO_INDISPONIVEL}</Aviso>
      ) : null}
    </>
  )
}
