/**
 * Aba "Tipos" (F3.2 — RF-12, RF-15; F3.3 — RF-16, RN-13, RNF-07; F3.4 — RF-13, RF-14; F3.5 — RF-15; A-02).
 *
 * Lista os tipos de apontamento com busca por nome e filtro por origem e, conforme a matriz de
 * ações (`usePermissoes().podeAcao`):
 * - "Novo tipo" (`cadastrar-tipo`) abre o diálogo "Novo tipo de apontamento";
 * - "Editar grupos" (`editar-tipo`), em todos os tipos, abre "Editar grupos do tipo {nome}";
 * - "Excluir" (`excluir-tipo`), só nos personalizados, pede confirmação (bloqueada com apontamentos).
 * Os grupos do ERP e os colaboradores são carregados a cada abertura de um dos diálogos de formulário
 * (nunca antes). Erro no envio mantém o diálogo aberto com a mensagem; sucesso fecha e notifica.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
import { mensagemDeErro } from '../../services/api'
import { type ColaboradorVinculo, listarColaboradoresVinculo } from '../../services/dashboardsService'
import {
  type AtualizacaoTipo,
  type GrupoErp,
  type NovoTipo,
  ORIGEM_FIXO,
  ORIGEM_PERSONALIZADO,
  TIPOS_FIXOS,
  listarGrupos,
} from '../../services/tiposService'
import { usePermissoes } from '../../sessao/usePermissoes'
import type { TipoApontamento } from '../../types/dominio'
import { contarPor, filtrarPorBusca } from '../../utils/filtros'
import { DialogoExcluirTipo } from './DialogoExcluirTipo'
import { FormularioTipo } from './FormularioTipo'
import { FormularioVinculosTipo } from './FormularioVinculosTipo'
import { TabelaTipos } from './TabelaTipos'
import { useTipos } from './useTipos'
import './TiposPage.css'

const ORIGEM_TODOS = 'todos'

/** Enumera em pt-BR: "A, B e C". */
function enumerar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

const MENSAGEM_TIPOS_FIXOS = `Os sete tipos fixos da plataforma (${enumerar(TIPOS_FIXOS)}) não podem ser excluídos.`
const MENSAGEM_EXCLUIDO = 'Tipo excluído.'
const MENSAGEM_CADASTRADO = 'Tipo cadastrado.'
const MENSAGEM_ATUALIZADO = 'Tipo atualizado.'

/** Diálogo de formulário aberto: cadastro ou edição dos vínculos de um tipo. */
type ModoFormulario = { modo: 'cadastro' } | { modo: 'edicao'; tipo: TipoApontamento }

interface ListasFormulario {
  grupos: GrupoErp[]
  colaboradores: ColaboradorVinculo[]
}

const LISTAS_VAZIAS: ListasFormulario = { grupos: [], colaboradores: [] }

export function TiposPage() {
  const { tipos, carregando, carregouUmaVez, erro, recarregar, excluir, criar, atualizar } = useTipos()
  const { podeAcao } = usePermissoes()
  const podeCadastrar = podeAcao('cadastrar-tipo')
  const podeEditar = podeAcao('editar-tipo')
  const podeExcluir = podeAcao('excluir-tipo')

  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState(ORIGEM_TODOS)

  const [notificacao, setNotificacao] = useState<string | null>(null)

  const montadoRef = useRef(false)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const exclusao = useAcaoConfirmada((tipo: TipoApontamento) => excluir(tipo.id), {
    onSucesso: () => setNotificacao(MENSAGEM_EXCLUIDO),
  })

  // Formulário de cadastro e edição
  const [formulario, setFormulario] = useState<ModoFormulario | null>(null)
  const [listas, setListas] = useState<ListasFormulario>(LISTAS_VAZIAS)
  const [carregandoListas, setCarregandoListas] = useState(false)
  const [erroListas, setErroListas] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  /** Identifica a consulta vigente: uma resposta de outra abertura é descartada. */
  const consultaListasRef = useRef(0)

  async function carregarListas() {
    const consulta = ++consultaListasRef.current
    const vigente = () => montadoRef.current && consulta === consultaListasRef.current
    setListas(LISTAS_VAZIAS)
    setErroListas(null)
    setCarregandoListas(true)
    try {
      const [grupos, colaboradores] = await Promise.all([listarGrupos(), listarColaboradoresVinculo()])
      if (vigente()) setListas({ grupos, colaboradores })
    } catch (falha) {
      if (vigente()) setErroListas(mensagemDeErro(falha))
    } finally {
      if (vigente()) setCarregandoListas(false)
    }
  }

  function abrirFormulario(modo: ModoFormulario) {
    setErroSalvar(null)
    setFormulario(modo)
    void carregarListas()
  }

  function fecharFormulario() {
    if (salvandoRef.current) return
    consultaListasRef.current++
    setFormulario(null)
    setErroSalvar(null)
  }

  /** Executa o envio; sucesso fecha o diálogo e notifica, falha mostra a mensagem no diálogo. */
  async function salvar(enviar: () => Promise<void>, mensagem: string) {
    if (salvandoRef.current) return
    salvandoRef.current = true
    setSalvando(true)
    setErroSalvar(null)
    try {
      await enviar()
      if (!montadoRef.current) return
      consultaListasRef.current++
      setFormulario(null)
      exclusao.limparErro()
      setNotificacao(mensagem)
    } catch (falha) {
      if (montadoRef.current) setErroSalvar(mensagemDeErro(falha))
    } finally {
      salvandoRef.current = false
      if (montadoRef.current) setSalvando(false)
    }
  }

  const tiposVisiveis = useMemo(() => {
    const porOrigem = origem === ORIGEM_TODOS ? tipos : tipos.filter((tipo) => tipo.origem === origem)
    return filtrarPorBusca(porOrigem, busca, (tipo) => tipo.nome)
  }, [tipos, busca, origem])

  // As contagens refletem a lista completa, independentemente da busca.
  const contagemPorOrigem = useMemo(() => contarPor(tipos, (tipo) => tipo.origem), [tipos])
  const origens: OpcaoSituacao[] = [
    { valor: ORIGEM_TODOS, rotulo: 'Todos', contagem: tipos.length },
    { valor: ORIGEM_FIXO, rotulo: ORIGEM_FIXO, contagem: contagemPorOrigem[ORIGEM_FIXO] ?? 0 },
    { valor: ORIGEM_PERSONALIZADO, rotulo: ORIGEM_PERSONALIZADO, contagem: contagemPorOrigem[ORIGEM_PERSONALIZADO] ?? 0 },
  ]

  const textoVazio = tipos.length === 0 ? 'Nenhum tipo cadastrado.' : 'Nenhum tipo encontrado para os filtros.'

  function limparFiltros() {
    setBusca('')
    setOrigem(ORIGEM_TODOS)
  }

  // Depois da primeira carga a tabela continua visível nas recargas (ex.: após cadastrar ou editar):
  // não pisca e mantém montado o gatilho que recebe o foco de volta quando o diálogo fecha.
  const mostrarLista = carregouUmaVez && erro === null

  const tituloFormulario =
    formulario?.modo === 'edicao' ? `Editar grupos do tipo ${formulario.tipo.nome}` : 'Novo tipo de apontamento'

  return (
    <div className="tipos-page">
      <div className="tipos-page__cabecalho">
        <h1>Tipos</h1>
        {podeCadastrar ? <Botao onClick={() => abrirFormulario({ modo: 'cadastro' })}>Novo tipo</Botao> : null}
      </div>

      <Aviso tipo="info">{MENSAGEM_TIPOS_FIXOS}</Aviso>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando tipos..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {exclusao.erro !== null ? <Aviso tipo="erro">{exclusao.erro}</Aviso> : null}

      {mostrarLista ? (
        <Card semPadding className="tipos-page__card">
          <BarraFiltros
            busca={busca}
            onBuscaChange={(valor) => setBusca(valor)}
            rotuloBusca="Buscar"
            placeholderBusca="Nome do tipo"
            situacoes={origens}
            situacao={origem}
            onSituacaoChange={setOrigem}
            rotuloSituacoes="Origem"
            onLimpar={limparFiltros}
          />
          <TabelaTipos
            tipos={tiposVisiveis}
            podeEditar={podeEditar}
            podeExcluir={podeExcluir}
            onEditar={(tipo) => abrirFormulario({ modo: 'edicao', tipo })}
            onExcluir={exclusao.abrir}
            textoVazio={textoVazio}
          />
        </Card>
      ) : null}

      <Dialogo aberto={formulario !== null} titulo={tituloFormulario} onFechar={fecharFormulario} className="dialogo--largo">
        {formulario?.modo === 'cadastro' ? (
          <FormularioTipo
            tiposExistentes={tipos}
            grupos={listas.grupos}
            colaboradores={listas.colaboradores}
            carregandoListas={carregandoListas}
            erroListas={erroListas}
            salvando={salvando}
            erro={erroSalvar}
            onSalvar={(dados: NovoTipo) => void salvar(() => criar(dados), MENSAGEM_CADASTRADO)}
            onCancelar={fecharFormulario}
          />
        ) : null}
        {formulario?.modo === 'edicao' ? (
          <FormularioVinculosTipo
            key={formulario.tipo.id}
            tipo={formulario.tipo}
            grupos={listas.grupos}
            colaboradores={listas.colaboradores}
            carregandoListas={carregandoListas}
            erroListas={erroListas}
            salvando={salvando}
            erro={erroSalvar}
            onSalvar={(dados: AtualizacaoTipo) => void salvar(() => atualizar(formulario.tipo.id, dados), MENSAGEM_ATUALIZADO)}
            onCancelar={fecharFormulario}
          />
        ) : null}
      </Dialogo>

      <DialogoExcluirTipo
        tipo={exclusao.alvo}
        excluindo={exclusao.executando}
        onConfirmar={() => void exclusao.confirmar()}
        onCancelar={exclusao.cancelar}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
