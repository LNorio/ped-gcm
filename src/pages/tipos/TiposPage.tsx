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
import { Card } from '../../components/Card'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
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

  const [notificacao, setNotificacao] = useState<string | null>(null)

  const exclusao = useAcaoConfirmada((tipo: TipoApontamento) => excluir(tipo.id), {
    onSucesso: () => setNotificacao(MENSAGEM_EXCLUIDO),
  })

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

  return (
    <div className="tipos-page">
      <h1>Tipos</h1>

      <Aviso tipo="info">{MENSAGEM_TIPOS_FIXOS}</Aviso>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando tipos..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />

      {exclusao.erro !== null ? <Aviso tipo="erro">{exclusao.erro}</Aviso> : null}

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
          <TabelaTipos tipos={tiposVisiveis} onExcluir={exclusao.abrir} textoVazio={textoVazio} />
        </Card>
      ) : null}

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
