/**
 * Modal "Definir metas pendentes" de um indicador com meta por filial (F6.12 — `API (26).md`,
 * "Definir as filiais pendentes", e `docs/backend/FRONT-meta-por-filial.md`).
 *
 * Mesmo padrão visual do "Definir meta" (`DialogoDefinirMeta`): título, nome do indicador no corpo,
 * alerta geral (`erro`) no topo e os botões "Cancelar" e "Salvar metas" no rodapé. O estado e a
 * validação dos campos vêm de `useMetaPorFilial` (mesmas regras e mensagens da F6.10):
 * - visão "Todas as filiais" (`filialSelecionada` ausente, `null` ou `'todas'`): grupo "Filiais sem
 *   meta" com um campo (não obrigatório) por filial de `indicador.filiaisSemMeta`, na ordem dela. O nome
 *   da filial vem de `indicador.metasPorFilial`, senão de `filiais` (acesso); sem nenhum, o rótulo é só
 *   "Meta da filial {código}". Nenhuma preenchida → "Informe a meta de ao menos uma filial.";
 * - visão de uma filial: um único campo obrigatório para a filial do cabeçalho.
 *
 * "Salvar metas" chama `onConfirmar` só com as filiais preenchidas e fica desabilitado enquanto
 * `definindo`. Os erros 400 por filial (`errosFiliais`, de `errosPorFilial`) aparecem no campo de cada
 * filial e somem ao editá-lo; os valores digitados são mantidos.
 */
import { useMemo, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import type { ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import type { Filial, Indicador, MetaDaFilial } from '../../types/dominio'
import { CampoMeta, ListaMetasPorFilial } from './CamposMetaPorFilial'
import { useMetaPorFilial } from './useMetaPorFilial'
import './FormularioIndicador.css'

export interface DialogoDefinirMetasPendentesProps {
  /** Indicador com filiais sem meta; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Enquanto `true`, o botão "Salvar metas" fica desabilitado. */
  definindo: boolean
  /** Mensagem de erro devolvida pela API; `null` quando não há. */
  erro: string | null
  /** Erros 400 por filial (`errosPorFilial`). Padrão `[]`. */
  errosFiliais?: readonly ErroDeFilial[]
  /** Filial do cabeçalho. Ausente, `null` ou `'todas'` = visão "Todas as filiais". */
  filialSelecionada?: FilialSelecionada
  /** Filiais do acesso, usadas para o nome da filial quando o indicador não o traz. Padrão `[]`. */
  filiais?: Filial[]
  onConfirmar: (metas: MetaDaFilial[]) => void
  onCancelar: () => void
}

const SEM_FILIAIS: Filial[] = []
const SEM_ERROS_FILIAIS: readonly ErroDeFilial[] = []

/** Id do formulário; o botão "Salvar metas" fica no rodapé do diálogo e envia por `form`. */
function idDoFormulario(indicador: Indicador): string {
  return `formulario-metas-pendentes-${indicador.id}`
}

/** Filiais sem meta do indicador, na ordem dele, com o nome conhecido (vazio quando não há). */
function filiaisPendentes(indicador: Indicador, filiaisDoAcesso: Filial[]): Filial[] {
  return indicador.filiaisSemMeta.map((codigo) => {
    const nomeNoIndicador = indicador.metasPorFilial.find((item) => item.filial === codigo)?.nomeFilial
    const doAcesso = filiaisDoAcesso.find((filial) => filial.codigo === codigo)
    return { codigo, nome: nomeNoIndicador || doAcesso?.nome || '', empresa: doAcesso?.empresa ?? null }
  })
}

interface ConteudoMetasPendentesProps {
  indicador: Indicador
  definindo: boolean
  erro: string | null
  errosFiliais: readonly ErroDeFilial[]
  filialSelecionada: FilialSelecionada | undefined
  filiais: Filial[]
  onConfirmar: (metas: MetaDaFilial[]) => void
}

/** Formulário do diálogo; montado a cada indicador aberto, então parte sempre limpo. */
function ConteudoMetasPendentes({
  indicador,
  definindo,
  erro,
  errosFiliais,
  filialSelecionada,
  filiais,
  onConfirmar,
}: ConteudoMetasPendentesProps) {
  const pendentes = useMemo(() => filiaisPendentes(indicador, filiais), [indicador, filiais])
  const meta = useMetaPorFilial(filialSelecionada, pendentes, { errosFiliais, replicarInicial: false })

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (definindo) return
    const validada = meta.validar()
    // Sem "Replicar", a validação sempre devolve as metas por filial.
    if (validada === null || !('metasPorFilial' in validada)) return
    onConfirmar(validada.metasPorFilial)
  }

  return (
    <form id={idDoFormulario(indicador)} className="formulario-indicador" onSubmit={enviar} noValidate>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {meta.filialFixa !== null ? (
        <CampoMeta estado={meta} />
      ) : (
        <ListaMetasPorFilial
          estado={meta}
          titulo="Filiais sem meta"
          nota="Informe a meta das filiais pendentes. As filiais em branco continuam sem meta."
        />
      )}
    </form>
  )
}

export function DialogoDefinirMetasPendentes({
  indicador,
  definindo,
  erro,
  errosFiliais = SEM_ERROS_FILIAIS,
  filialSelecionada,
  filiais = SEM_FILIAIS,
  onConfirmar,
  onCancelar,
}: DialogoDefinirMetasPendentesProps) {
  return (
    <Dialogo
      aberto={indicador !== null}
      titulo="Definir metas pendentes"
      descricao={indicador?.nome}
      className="dialogo--definir-meta"
      onFechar={onCancelar}
      acoes={
        indicador ? (
          <>
            <Botao variante="contorno" onClick={onCancelar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idDoFormulario(indicador)} disabled={definindo}>
              Salvar metas
            </Botao>
          </>
        ) : null
      }
    >
      {indicador ? (
        <ConteudoMetasPendentes
          key={indicador.id}
          indicador={indicador}
          definindo={definindo}
          erro={erro}
          errosFiliais={errosFiliais}
          filialSelecionada={filialSelecionada}
          filiais={filiais}
          onConfirmar={onConfirmar}
        />
      ) : null}
    </Dialogo>
  )
}
