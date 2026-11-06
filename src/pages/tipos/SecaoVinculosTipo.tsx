/**
 * Seletores de vínculo de um tipo de apontamento (F3.4 e F3.5 — RF-14, RF-15; A-02): "Grupos
 * vinculados" (principal, grupos do ERP) e "Usuários vinculados" (secundário, colaboradores).
 *
 * Mesmo padrão visual do formulário de dashboard (dropdown com busca do protótipo dashModal, via
 * `SeletorBusca`): a busca ignora acentos e maiúsculas, escolher acrescenta o item à lista de
 * escolhidos (na ordem da escolha) e mantém o painel aberto, e cada escolhido tem "Remover {nome}".
 * Só um painel fica aberto por vez. Itens escolhidos que não estão nas listas carregadas (ex.: grupo
 * antigo) aparecem pelo nome recebido e podem ser removidos.
 *
 * Componente controlado: os escolhidos ficam no formulário que o usa.
 */
import { type KeyboardEvent, useId, useState } from 'react'
import { ErroCampo } from '../../components/ErroCampo'
import type { ColaboradorVinculo } from '../../services/dashboardsService'
import type { GrupoErp } from '../../services/tiposService'
import type { ReferenciaNomeada } from '../../types/dominio'
import { normalizarBusca } from '../../utils/formato'
import { ICONE_REMOVER, SeletorBusca, type OpcaoSeletor } from '../dashboards/SeletorBusca'
import './FormularioTipo.css'

export interface SecaoVinculosTipoProps {
  grupos: GrupoErp[]
  colaboradores: ColaboradorVinculo[]
  gruposEscolhidos: ReferenciaNomeada[]
  usuariosEscolhidos: ReferenciaNomeada[]
  onGruposChange: (grupos: ReferenciaNomeada[]) => void
  onUsuariosChange: (usuarios: ReferenciaNomeada[]) => void
  /** Mensagem de validação do vínculo (exibida abaixo dos dois seletores). */
  erro?: string | null
}

type Painel = 'grupos' | 'usuarios'

interface TextosSeletor {
  campo: string
  botao: string
  busca: string
  placeholder: string
  escolhidos: string
  vazio: string
  todosAdicionados: string
  semOpcoes: string
}

const TEXTOS: Readonly<Record<Painel, TextosSeletor>> = {
  grupos: {
    campo: 'Grupos vinculados',
    botao: 'Selecionar grupo',
    busca: 'Buscar grupo',
    placeholder: 'Buscar grupo...',
    escolhidos: 'Grupos escolhidos',
    vazio: 'Nenhum grupo selecionado.',
    todosAdicionados: 'Todos os grupos já foram adicionados.',
    semOpcoes: 'Nenhum grupo disponível.',
  },
  usuarios: {
    campo: 'Usuários vinculados',
    botao: 'Selecionar usuário',
    busca: 'Buscar usuário',
    placeholder: 'Buscar por nome, cargo ou filial...',
    escolhidos: 'Usuários escolhidos',
    vazio: 'Nenhum usuário selecionado.',
    todosAdicionados: 'Todos os usuários já foram adicionados.',
    semOpcoes: 'Nenhum usuário disponível.',
  },
}

interface ItemSeletor extends OpcaoSeletor {
  /** Textos em que a busca procura. */
  busca: string[]
}

function textoUsuarios(quantidade: number): string {
  return quantidade === 1 ? '1 usuário' : `${quantidade} usuários`
}

function itensDeGrupos(grupos: GrupoErp[]): ItemSeletor[] {
  return grupos.map((grupo) => ({
    id: String(grupo.id),
    nome: grupo.nome,
    subtexto: textoUsuarios(grupo.quantidadeUsuarios),
    busca: [grupo.nome],
  }))
}

function itensDeColaboradores(colaboradores: ColaboradorVinculo[]): ItemSeletor[] {
  return colaboradores.map((colaborador) => {
    const partes: string[] = []
    if (colaborador.cargo) partes.push(colaborador.cargo)
    if (colaborador.filial) partes.push(`Filial ${colaborador.filial}`)
    return {
      id: String(colaborador.id),
      nome: colaborador.nome,
      subtexto: partes.join(' · '),
      busca: [colaborador.nome, colaborador.cargo ?? '', colaborador.filial ?? ''],
    }
  })
}

function casaBusca(item: ItemSeletor, busca: string): boolean {
  const termo = normalizarBusca(busca).trim()
  return termo === '' || item.busca.some((texto) => normalizarBusca(texto).includes(termo))
}

export function SecaoVinculosTipo({
  grupos,
  colaboradores,
  gruposEscolhidos,
  usuariosEscolhidos,
  onGruposChange,
  onUsuariosChange,
  erro,
}: SecaoVinculosTipoProps) {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [busca, setBusca] = useState('')

  function alternar(qual: Painel) {
    setPainel((atual) => (atual === qual ? null : qual))
    setBusca('')
  }

  return (
    <div className="formulario-tipo__vinculos">
      <SeletorVinculo
        textos={TEXTOS.grupos}
        itens={itensDeGrupos(grupos)}
        escolhidos={gruposEscolhidos}
        onChange={onGruposChange}
        aberto={painel === 'grupos'}
        onAlternar={() => alternar('grupos')}
        busca={painel === 'grupos' ? busca : ''}
        onBusca={setBusca}
      />
      <SeletorVinculo
        textos={TEXTOS.usuarios}
        itens={itensDeColaboradores(colaboradores)}
        escolhidos={usuariosEscolhidos}
        onChange={onUsuariosChange}
        aberto={painel === 'usuarios'}
        onAlternar={() => alternar('usuarios')}
        busca={painel === 'usuarios' ? busca : ''}
        onBusca={setBusca}
      />
      <ErroCampo mensagem={erro} />
    </div>
  )
}

interface SeletorVinculoProps {
  textos: TextosSeletor
  itens: ItemSeletor[]
  escolhidos: ReferenciaNomeada[]
  onChange: (escolhidos: ReferenciaNomeada[]) => void
  aberto: boolean
  onAlternar: () => void
  busca: string
  onBusca: (texto: string) => void
}

function SeletorVinculo({ textos, itens, escolhidos, onChange, aberto, onAlternar, busca, onBusca }: SeletorVinculoProps) {
  const idRotulo = useId()
  const idsEscolhidos = new Set(escolhidos.map((item) => String(item.id)))
  const naoEscolhidos = itens.filter((item) => !idsEscolhidos.has(item.id))
  const opcoes = naoEscolhidos.filter((item) => casaBusca(item, busca))

  let mensagemVazia: string | null = null
  if (itens.length === 0) mensagemVazia = textos.semOpcoes
  else if (naoEscolhidos.length === 0) mensagemVazia = textos.todosAdicionados
  else if (opcoes.length === 0) mensagemVazia = 'Nenhum resultado para a busca.'

  // Escolher mantém o dropdown aberto, para escolher outros itens.
  function escolher(id: string) {
    const item = itens.find((opcao) => opcao.id === id)
    if (!item) return
    onChange([...escolhidos, { id: Number(id), nome: item.nome }])
  }

  function remover(id: number) {
    onChange(escolhidos.filter((item) => item.id !== id))
  }

  // Enter na busca do dropdown não envia o formulário (o envio implícito gravaria o tipo sem querer).
  function impedirEnvioPelaBusca(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Enter' && evento.target instanceof HTMLInputElement) evento.preventDefault()
  }

  return (
    <div
      className="formulario-dashboard__campo"
      role="group"
      aria-labelledby={idRotulo}
      onKeyDown={impedirEnvioPelaBusca}
    >
      <span id={idRotulo} className="formulario-dashboard__rotulo">
        {textos.campo}
      </span>
      <SeletorBusca
        textoBotao={textos.botao}
        aberto={aberto}
        onAlternar={onAlternar}
        rotuloBusca={textos.busca}
        placeholderBusca={textos.placeholder}
        busca={busca}
        onBusca={onBusca}
        rotuloLista={textos.campo}
        opcoes={opcoes}
        mensagemVazia={mensagemVazia}
        onEscolher={escolher}
      />
      <div className="formulario-dashboard__selecionados">
        {escolhidos.length === 0 ? (
          <p className="formulario-dashboard__vazio">{textos.vazio}</p>
        ) : (
          <ul className="formulario-dashboard__lista" aria-label={textos.escolhidos}>
            {escolhidos.map((escolhido) => {
              const conhecido = itens.find((item) => item.id === String(escolhido.id))
              return (
                <li key={escolhido.id} className="formulario-dashboard__escolhido">
                  <span className="formulario-dashboard__escolhido-texto">
                    <span>{escolhido.nome}</span>
                    {conhecido?.subtexto ? <small>{conhecido.subtexto}</small> : null}
                  </span>
                  <button
                    type="button"
                    className="formulario-dashboard__remover foco-anel"
                    aria-label={`Remover ${escolhido.nome}`}
                    onClick={() => remover(escolhido.id)}
                  >
                    {ICONE_REMOVER}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
