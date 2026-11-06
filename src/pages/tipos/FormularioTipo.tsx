/**
 * Formulário de cadastro de tipo personalizado (F3.4 — RF-13, RF-14, RF-16; A-02).
 *
 * Campos: "Nome do tipo" (obrigatório, único na lista sem diferenciar maiúsculas) e os vínculos
 * "Grupos vinculados" / "Usuários vinculados" (ao menos um grupo ou usuário). As mensagens de
 * validação aparecem depois da primeira tentativa de envio e se atualizam enquanto o usuário corrige.
 * `onSalvar` recebe o nome aparado e os ids na ordem da escolha.
 *
 * As listas (grupos e colaboradores) e o envio ficam com a página; o formulário só valida e avisa.
 */
import { useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import type { ColaboradorVinculo } from '../../services/dashboardsService'
import type { GrupoErp, NovoTipo } from '../../services/tiposService'
import type { ReferenciaNomeada, TipoApontamento } from '../../types/dominio'
import { SecaoVinculosTipo } from './SecaoVinculosTipo'
import './FormularioTipo.css'

export interface FormularioTipoProps {
  /** Tipos já cadastrados, para a verificação de nome repetido. */
  tiposExistentes: TipoApontamento[]
  grupos: GrupoErp[]
  colaboradores: ColaboradorVinculo[]
  carregandoListas: boolean
  erroListas: string | null
  /** Enquanto `true`, "Salvar tipo" fica desabilitado. */
  salvando: boolean
  /** Erro do envio (ex.: recusa da API), exibido em alerta dentro do formulário. */
  erro: string | null
  onSalvar: (dados: NovoTipo) => void
  onCancelar: () => void
}

const MENSAGEM_NOME_OBRIGATORIO = 'Informe o nome do tipo.'
const MENSAGEM_NOME_REPETIDO = 'Já existe um tipo com esse nome.'
const MENSAGEM_VINCULO_OBRIGATORIO = 'Vincule ao menos um grupo ou usuário.'
const MENSAGEM_CARREGANDO_LISTAS = 'Carregando grupos e usuários...'

function chaveNome(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR')
}

function erroDoNome(nome: string, tiposExistentes: TipoApontamento[]): string | null {
  const chave = chaveNome(nome)
  if (chave === '') return MENSAGEM_NOME_OBRIGATORIO
  if (tiposExistentes.some((tipo) => chaveNome(tipo.nome) === chave)) return MENSAGEM_NOME_REPETIDO
  return null
}

export function FormularioTipo({
  tiposExistentes,
  grupos,
  colaboradores,
  carregandoListas,
  erroListas,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: FormularioTipoProps) {
  const [nome, setNome] = useState('')
  const [gruposEscolhidos, setGruposEscolhidos] = useState<ReferenciaNomeada[]>([])
  const [usuariosEscolhidos, setUsuariosEscolhidos] = useState<ReferenciaNomeada[]>([])
  const [tentouEnviar, setTentouEnviar] = useState(false)

  const erroNome = erroDoNome(nome, tiposExistentes)
  const erroVinculo = gruposEscolhidos.length === 0 && usuariosEscolhidos.length === 0 ? MENSAGEM_VINCULO_OBRIGATORIO : null

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return
    setTentouEnviar(true)
    if (erroNome !== null || erroVinculo !== null) return
    onSalvar({
      nome: nome.trim(),
      grupos: gruposEscolhidos.map((grupo) => grupo.id),
      usuarios: usuariosEscolhidos.map((usuario) => usuario.id),
    })
  }

  return (
    <form className="formulario-dashboard formulario-tipo" onSubmit={enviar} noValidate>
      <RegiaoStatus mensagem={carregandoListas ? MENSAGEM_CARREGANDO_LISTAS : null} />
      {erroListas ? <Aviso tipo="erro">{erroListas}</Aviso> : null}

      <Campo
        rotulo="Nome do tipo"
        obrigatorio
        placeholder="Ex.: Logística"
        autoComplete="off"
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        erro={tentouEnviar ? erroNome : null}
      />

      <SecaoVinculosTipo
        grupos={grupos}
        colaboradores={colaboradores}
        gruposEscolhidos={gruposEscolhidos}
        usuariosEscolhidos={usuariosEscolhidos}
        onGruposChange={setGruposEscolhidos}
        onUsuariosChange={setUsuariosEscolhidos}
        erro={tentouEnviar ? erroVinculo : null}
      />

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <div className="formulario-dashboard__acoes">
        <Botao type="button" variante="contorno" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          Salvar tipo
        </Botao>
      </div>
    </form>
  )
}
