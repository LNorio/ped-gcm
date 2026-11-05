/**
 * Seção de vínculo do formulário de dashboard (F7.5 — RF-50, INT-02), como o dashModal do protótipo.
 *
 * - "Vincular dashboard a": dropdown com o tipo (Filiais, Cargos de colaboradores ou Colaboradores
 *   específicos), cada um com o subtexto do protótipo. Trocar o tipo limpa os itens; o mesmo tipo os mantém.
 * - Campo de itens ("Filiais vinculadas", "Cargos vinculados" ou "Colaboradores vinculados"): dropdown
 *   com busca (só cargos e colaboradores, sem acento nem maiúsculas), "Selecionar todas" (filiais) e
 *   "Limpar seleção" (mais de um item). A lista mostra só os escolhidos, na ordem da escolha.
 * - Abaixo, o resumo das imagens geradas no encerramento.
 *
 * As listas chegam prontas pela página e são filtradas localmente.
 */
import { useId, useState } from 'react'
import { Botao } from '../../components/Botao'
import { ErroCampo } from '../../components/ErroCampo'
import type { CargoVinculo, ColaboradorVinculo, FilialVinculo } from '../../services/dashboardsService'
import { TIPOS_VINCULO, type TipoVinculo } from '../../types/dominio'
import { normalizarBusca } from '../../utils/formato'
import { resumoImagens, type ResumoImagens, type VinculoFormulario } from './regrasDashboard'
import { ICONE_REMOVER, ICONE_SETA, SeletorBusca, type OpcaoSeletor } from './SeletorBusca'
import './FormularioDashboard.css'

export interface SecaoVinculoProps {
  valor: VinculoFormulario
  onChange: (valor: VinculoFormulario) => void
  filiais: FilialVinculo[]
  cargos: CargoVinculo[]
  colaboradores: ColaboradorVinculo[]
  erroItens?: string | null
}

/** Tipo usado quando o valor ainda não tem tipo (padrão do protótipo). */
const TIPO_PADRAO: TipoVinculo = 'cargos'

const ROTULO_TIPO = 'Tipo de vínculo do dashboard'

interface TextosTipo {
  rotulo: string
  subtexto: string
  campo: string
  botao: string
  busca: { rotulo: string; placeholder: string } | null
  escolhidos: string
  vazio: string
  todosAdicionados: string
}

/** Textos de cada tipo de vínculo (protótipo dashModal). */
const TEXTOS: Readonly<Record<TipoVinculo, TextosTipo>> = {
  filiais: {
    rotulo: 'Filiais',
    subtexto: 'Gera imagens só para as filiais escolhidas',
    campo: 'Filiais vinculadas',
    botao: 'Selecionar filial',
    busca: null,
    escolhidos: 'Filiais escolhidas',
    vazio: 'Nenhuma filial selecionada.',
    todosAdicionados: 'Todas as filiais já foram adicionadas.',
  },
  cargos: {
    rotulo: 'Cargos de colaboradores',
    subtexto: 'Gera imagens para todas as filiais',
    campo: 'Cargos vinculados',
    botao: 'Selecionar cargo de colaboradores',
    busca: { rotulo: 'Buscar cargo', placeholder: 'Buscar cargo...' },
    escolhidos: 'Cargos escolhidos',
    vazio: 'Nenhum cargo selecionado.',
    todosAdicionados: 'Todos os cargos já foram adicionados.',
  },
  colaboradores: {
    rotulo: 'Colaboradores específicos',
    subtexto: 'Gera imagens para as filiais dos colaboradores escolhidos',
    campo: 'Colaboradores vinculados',
    botao: 'Selecionar colaborador',
    busca: { rotulo: 'Buscar colaborador', placeholder: 'Buscar por nome, cargo ou filial...' },
    escolhidos: 'Colaboradores escolhidos',
    vazio: 'Nenhum colaborador selecionado.',
    todosAdicionados: 'Todos os colaboradores já foram adicionados.',
  },
}

const SEM_COLABORADOR = '“Filial (sem colaborador vinculado)”'

interface ItemVinculo extends OpcaoSeletor {
  /** Textos em que a busca procura. */
  busca: string[]
}

type Painel = 'tipo' | 'itens' | null

function textoColaboradores(quantidade: number): string {
  return quantidade === 1 ? '1 colaborador' : `${quantidade} colaboradores`
}

function itensDoTipo(
  tipo: TipoVinculo,
  filiais: FilialVinculo[],
  cargos: CargoVinculo[],
  colaboradores: ColaboradorVinculo[],
): ItemVinculo[] {
  if (tipo === 'filiais') {
    return filiais.map((filial) => {
      const quantidade = colaboradores.filter((colaborador) => colaborador.filial === filial.codigo).length
      return {
        id: filial.codigo,
        nome: `${filial.codigo} - ${filial.nome}`,
        subtexto: quantidade === 0 ? 'Sem colaborador vinculado' : textoColaboradores(quantidade),
        busca: [filial.codigo, filial.nome],
      }
    })
  }
  if (tipo === 'cargos') {
    return cargos.map((cargo) => ({
      id: cargo.cargo,
      nome: cargo.cargo,
      subtexto: textoColaboradores(cargo.colaboradores),
      busca: [cargo.cargo],
    }))
  }
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

function casaBusca(item: ItemVinculo, busca: string): boolean {
  const termo = normalizarBusca(busca).trim()
  return termo === '' || item.busca.some((texto) => normalizarBusca(texto).includes(termo))
}

/** Frases do resumo de imagens (RF-50). */
function frasesResumo(resumo: ResumoImagens): string[] {
  if (resumo.quantidade === 0) return ['Nenhuma imagem será gerada: não há colaboradores nos itens escolhidos.']

  const lista = resumo.filiais.join(', ')
  const local = resumo.filiais.length === 1 ? `na filial ${lista}` : `nas filiais ${lista}`
  const frases = [
    resumo.quantidade === 1
      ? `No encerramento será gerada 1 imagem (uma por colaborador) ${local}.`
      : `No encerramento serão geradas ${resumo.quantidade} imagens (uma por colaborador) ${local}.`,
  ]

  const sem = resumo.filiaisSemColaborador
  if (sem.length === 1) {
    frases.push(`A filial ${sem[0]} não tem colaborador vinculado e gera uma única imagem, identificada como ${SEM_COLABORADOR}.`)
  } else if (sem.length > 1) {
    frases.push(
      `As filiais ${sem.join(', ')} não têm colaborador vinculado e cada uma gera uma única imagem, identificada como ${SEM_COLABORADOR}.`,
    )
  }
  return frases
}

export function SecaoVinculo({ valor, onChange, filiais, cargos, colaboradores, erroItens }: SecaoVinculoProps) {
  const [painel, setPainel] = useState<Painel>(null)
  const [busca, setBusca] = useState('')

  const tipo = valor.tipo === '' ? TIPO_PADRAO : valor.tipo

  function alternar(qual: Exclude<Painel, null>) {
    setPainel((atual) => (atual === qual ? null : qual))
    setBusca('')
  }

  // Outro tipo limpa os itens; o mesmo tipo os mantém. Escolher fecha o painel.
  function escolherTipo(novo: TipoVinculo) {
    setPainel(null)
    setBusca('')
    if (novo !== valor.tipo) onChange({ tipo: novo, itens: [] })
  }

  return (
    <div className="formulario-dashboard__secao">
      <div className="formulario-dashboard__campo">
        <span className="formulario-dashboard__rotulo">Vincular dashboard a</span>
        <div className="formulario-dashboard__dd">
          <button
            type="button"
            className="formulario-dashboard__dd-botao foco-anel"
            aria-label={ROTULO_TIPO}
            aria-haspopup="listbox"
            aria-expanded={painel === 'tipo'}
            onClick={() => alternar('tipo')}
          >
            <span className="formulario-dashboard__dd-valor">{TEXTOS[tipo].rotulo}</span>
            {ICONE_SETA}
          </button>
          {painel === 'tipo' ? (
            <div className="formulario-dashboard__dd-painel">
              <div role="listbox" aria-label={ROTULO_TIPO} className="formulario-dashboard__dd-opcoes">
                {TIPOS_VINCULO.map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    role="option"
                    aria-selected={opcao === tipo}
                    className={
                      opcao === tipo
                        ? 'formulario-dashboard__dd-opcao formulario-dashboard__dd-opcao--atual foco-anel'
                        : 'formulario-dashboard__dd-opcao foco-anel'
                    }
                    onClick={() => escolherTipo(opcao)}
                  >
                    <span>{TEXTOS[opcao].rotulo}</span>
                    <small>{TEXTOS[opcao].subtexto}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <GrupoItens
        tipo={tipo}
        valor={valor}
        onChange={onChange}
        itens={itensDoTipo(tipo, filiais, cargos, colaboradores)}
        colaboradores={colaboradores}
        aberto={painel === 'itens'}
        onAlternar={() => alternar('itens')}
        onFechar={() => setPainel(null)}
        busca={busca}
        onBusca={setBusca}
        erroItens={erroItens}
      />
    </div>
  )
}

interface GrupoItensProps {
  tipo: TipoVinculo
  valor: VinculoFormulario
  onChange: (valor: VinculoFormulario) => void
  itens: ItemVinculo[]
  colaboradores: ColaboradorVinculo[]
  aberto: boolean
  onAlternar: () => void
  onFechar: () => void
  busca: string
  onBusca: (texto: string) => void
  erroItens?: string | null
}

function GrupoItens({
  tipo,
  valor,
  onChange,
  itens,
  colaboradores,
  aberto,
  onAlternar,
  onFechar,
  busca,
  onBusca,
  erroItens,
}: GrupoItensProps) {
  const idRotulo = useId()
  const textos = TEXTOS[tipo]
  const itensDoValor = valor.tipo === tipo ? valor.itens : []
  // Item escolhido fora da lista carregada aparece pelo próprio código (sem subtexto), para poder ser removido.
  const escolhidos = itensDoValor.map(
    (id): ItemVinculo => itens.find((opcao) => opcao.id === id) ?? { id, nome: id, subtexto: '', busca: [id] },
  )
  const conhecidos = escolhidos.filter((item) => itens.some((opcao) => opcao.id === item.id))
  const naoEscolhidos = itens.filter((item) => !itensDoValor.includes(item.id))
  const opcoes = textos.busca ? naoEscolhidos.filter((item) => casaBusca(item, busca)) : naoEscolhidos
  const temTodas = tipo === 'filiais' && naoEscolhidos.length > 0

  let mensagemVazia: string | null = null
  if (naoEscolhidos.length === 0) mensagemVazia = textos.todosAdicionados
  else if (opcoes.length === 0) mensagemVazia = 'Nenhum resultado para a busca.'

  // Só os itens conhecidos entram no resumo (itens fora das listas são ignorados).
  const resumo =
    conhecidos.length > 0 ? frasesResumo(resumoImagens({ tipo, itens: conhecidos.map((item) => item.id) }, colaboradores)) : []

  // Escolher mantém o dropdown aberto, para escolher outros itens.
  function escolher(id: string) {
    onChange({ tipo, itens: [...itensDoValor, id] })
  }

  function selecionarTodas() {
    onChange({ tipo, itens: itens.map((item) => item.id) })
  }

  function remover(id: string) {
    onChange({ tipo, itens: itensDoValor.filter((item) => item !== id) })
  }


  return (
    <div className="formulario-dashboard__campo" role="group" aria-labelledby={idRotulo}>
      <div className="formulario-dashboard__campo-cabecalho">
        <span id={idRotulo} className="formulario-dashboard__rotulo">
          {textos.campo}
        </span>
        <span className="formulario-dashboard__acoes-campo">
          {temTodas ? (
            <Botao variante="link" tamanho="pequeno" className="formulario-dashboard__link" onClick={selecionarTodas}>
              Selecionar todas
            </Botao>
          ) : null}
          {itensDoValor.length > 1 ? (
            <Botao variante="link" tamanho="pequeno" className="formulario-dashboard__link" onClick={() => onChange({ tipo, itens: [] })}>
              Limpar seleção
            </Botao>
          ) : null}
        </span>
      </div>
      <SeletorBusca
        textoBotao={textos.botao}
        aberto={aberto}
        onAlternar={onAlternar}
        rotuloBusca={textos.busca?.rotulo}
        placeholderBusca={textos.busca?.placeholder}
        busca={busca}
        onBusca={onBusca}
        rotuloLista={textos.campo}
        acaoInicial={
          temTodas
            ? {
                nome: `Selecionar todas as filiais (${itens.length})`,
                subtexto: 'Adiciona todas as filiais de uma vez',
                onEscolher: () => {
                  selecionarTodas()
                  onFechar()
                },
              }
            : null
        }
        opcoes={opcoes}
        mensagemVazia={mensagemVazia}
        onEscolher={escolher}
      />
      <div className="formulario-dashboard__selecionados">
        {escolhidos.length === 0 ? (
          <p className="formulario-dashboard__vazio">{textos.vazio}</p>
        ) : (
          <ul className="formulario-dashboard__lista" aria-label={textos.escolhidos}>
            {escolhidos.map((item) => (
              <li key={item.id} className="formulario-dashboard__escolhido">
                <span className="formulario-dashboard__escolhido-texto">
                  <span>{item.nome}</span>
                  {item.subtexto ? <small>{item.subtexto}</small> : null}
                </span>
                <button
                  type="button"
                  className="formulario-dashboard__remover foco-anel"
                  aria-label={`Remover ${item.nome}`}
                  onClick={() => remover(item.id)}
                >
                  {ICONE_REMOVER}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ErroCampo mensagem={erroItens} />
      {resumo.map((frase) => (
        <p key={frase} className="formulario-dashboard__resumo">
          {frase}
        </p>
      ))}
    </div>
  )
}
