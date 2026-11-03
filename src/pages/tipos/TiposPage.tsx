/**
 * Aba "Tipos" (F3.2 — RF-12, RF-15; F3.3 — RF-16, RN-13, RNF-07).
 *
 * Lista os tipos de apontamento com busca por nome e filtro por origem, e permite excluir os
 * tipos personalizados sem apontamentos, com confirmação. Os sete tipos fixos não têm ação.
 * A tela não conhece permissões: quem decide se o perfil pode excluir é a API.
 */
import { useMemo, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { BarraFiltros, type OpcaoSituacao } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { Notificacao } from '../../components/Notificacao'
import { RegiaoStatus } from '../../components/RegiaoStatus'
import { mensagemDeErro } from '../../services/api'
import { ORIGEM_FIXO, ORIGEM_PERSONALIZADO, TIPOS_FIXOS } from '../../services/tiposService'
import type { TipoApontamento } from '../../types/dominio'
import { contarPor, filtrarPorBusca } from '../../utils/filtros'
import { DialogoExcluirTipo } from './DialogoExcluirTipo'
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

export function TiposPage() {
  const { tipos, carregando, erro, recarregar, excluir } = useTipos()

  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState(ORIGEM_TODOS)

  const [tipoParaExcluir, setTipoParaExcluir] = useState<TipoApontamento | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [notificacao, setNotificacao] = useState<string | null>(null)

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

  function fecharDialogo() {
    if (excluindo) return
    setTipoParaExcluir(null)
  }

  async function confirmarExclusao() {
    if (!tipoParaExcluir || excluindo) return
    setExcluindo(true)
    try {
      await excluir(tipoParaExcluir.id)
      setErroExclusao(null)
      setNotificacao(MENSAGEM_EXCLUIDO)
    } catch (falha) {
      setErroExclusao(mensagemDeErro(falha))
    } finally {
      setExcluindo(false)
      setTipoParaExcluir(null)
    }
  }

  return (
    <div className="tipos-page">
      <h1>Tipos</h1>

      <Aviso tipo="info">{MENSAGEM_TIPOS_FIXOS}</Aviso>

      <RegiaoStatus mensagem={carregando ? 'Carregando tipos...' : null} />

      {erro !== null ? (
        <div className="tipos-page__erro">
          <Aviso tipo="erro">{erro}</Aviso>
          <Botao variante="contorno" onClick={() => void recarregar()} disabled={carregando}>
            Tentar novamente
          </Botao>
        </div>
      ) : null}

      {erroExclusao !== null ? <Aviso tipo="erro">{erroExclusao}</Aviso> : null}

      {!carregando && erro === null ? (
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
          <TabelaTipos tipos={tiposVisiveis} onExcluir={setTipoParaExcluir} textoVazio={textoVazio} />
        </Card>
      ) : null}

      <DialogoExcluirTipo
        tipo={tipoParaExcluir}
        excluindo={excluindo}
        onConfirmar={() => void confirmarExclusao()}
        onCancelar={fecharDialogo}
      />

      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
