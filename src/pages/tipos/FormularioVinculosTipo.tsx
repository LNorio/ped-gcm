/**
 * Formulário de edição dos vínculos de um tipo, fixo ou personalizado (F3.5 — RF-14, RF-15, RF-16; A-02).
 *
 * O nome aparece somente leitura (não muda na edição). Começa com os grupos e usuários já vinculados,
 * na ordem da API. "Salvar alterações" só fica habilitado quando algum conjunto de ids mudou (desfazer a
 * alteração volta a desabilitá-lo) e `onSalvar` recebe só as listas alteradas, completas — o PUT troca
 * apenas as listas enviadas.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import type { ColaboradorVinculo } from '../../services/dashboardsService'
import type { AtualizacaoTipo, GrupoErp } from '../../services/tiposService'
import type { ReferenciaNomeada, TipoApontamento } from '../../types/dominio'
import { SecaoVinculosTipo } from './SecaoVinculosTipo'
import './FormularioTipo.css'

export interface FormularioVinculosTipoProps {
  tipo: TipoApontamento
  grupos: GrupoErp[]
  colaboradores: ColaboradorVinculo[]
  carregandoListas: boolean
  erroListas: string | null
  /** Enquanto `true`, "Salvar alterações" fica desabilitado. */
  salvando: boolean
  /** Erro do envio (ex.: recusa da API), exibido em alerta dentro do formulário. */
  erro: string | null
  onSalvar: (dados: AtualizacaoTipo) => void
  onCancelar: () => void
}

const MENSAGEM_CARREGANDO_LISTAS = 'Carregando grupos e usuários...'

/** Compara as listas como conjuntos de ids (a ordem não conta). */
function mesmoConjunto(a: readonly ReferenciaNomeada[], b: readonly ReferenciaNomeada[]): boolean {
  const idsA = new Set(a.map((item) => item.id))
  const idsB = new Set(b.map((item) => item.id))
  return idsA.size === idsB.size && [...idsA].every((id) => idsB.has(id))
}

export function FormularioVinculosTipo({
  tipo,
  grupos,
  colaboradores,
  carregandoListas,
  erroListas,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: FormularioVinculosTipoProps) {
  const [gruposIniciais] = useState<ReferenciaNomeada[]>(() => tipo.grupos ?? [])
  const [usuariosIniciais] = useState<ReferenciaNomeada[]>(() => tipo.usuarios ?? [])
  const [gruposEscolhidos, setGruposEscolhidos] = useState<ReferenciaNomeada[]>(gruposIniciais)
  const [usuariosEscolhidos, setUsuariosEscolhidos] = useState<ReferenciaNomeada[]>(usuariosIniciais)

  const gruposAlterados = !mesmoConjunto(gruposEscolhidos, gruposIniciais)
  const usuariosAlterados = !mesmoConjunto(usuariosEscolhidos, usuariosIniciais)
  const alterado = gruposAlterados || usuariosAlterados

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || !alterado) return
    const dados: AtualizacaoTipo = {}
    if (gruposAlterados) dados.grupos = gruposEscolhidos.map((grupo) => grupo.id)
    if (usuariosAlterados) dados.usuarios = usuariosEscolhidos.map((usuario) => usuario.id)
    onSalvar(dados)
  }

  return (
    <form className="formulario-dashboard formulario-tipo" onSubmit={enviar} noValidate>
      <RegiaoStatus mensagem={carregandoListas ? MENSAGEM_CARREGANDO_LISTAS : null} />
      {erroListas ? <Aviso tipo="erro">{erroListas}</Aviso> : null}

      <Campo rotulo="Nome do tipo" value={tipo.nome} readOnly className="formulario-tipo__somente-leitura" />

      <SecaoVinculosTipo
        grupos={grupos}
        colaboradores={colaboradores}
        gruposEscolhidos={gruposEscolhidos}
        usuariosEscolhidos={usuariosEscolhidos}
        onGruposChange={setGruposEscolhidos}
        onUsuariosChange={setUsuariosEscolhidos}
      />

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <div className="formulario-dashboard__acoes">
        <Botao type="button" variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando || !alterado}>
          Salvar alterações
        </Botao>
      </div>
    </form>
  )
}
