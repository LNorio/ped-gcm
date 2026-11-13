/**
 * Aba "Preenchimento" (F9.2 a F9.12 — RF-60 a RF-76).
 *
 * - Título "Preenchimento" sempre visível, na área de ações do topo (`.preenchimento-acoes`), onde
 *   também ficam as metas (`AcoesMetasPreenchimento`, só com a tela carregada) e o período
 *   (`AcoesPeriodoPreenchimento`, sempre: o período é comum a todas as filiais).
 * - Sem filial no cabeçalho, só o pedido de escolha da filial (RF-60).
 * - Com filial: estado de carga, resumo do mês, seletor de mês/ano e os apontamentos por tipo. No mês
 *   editável, o lançamento em lote ("Salvar lançamentos") e a correção com motivo; em qualquer mês, o
 *   histórico do apontamento.
 *
 * O estado do lançamento (rascunhos, erros, diálogos) fica em `TelaDoMes`, que é recriada a cada filial
 * e mês (`key`), para que os valores digitados não passem de um mês para outro.
 *
 * A janela de metas é consultada assim que chega a tela de outra filial ou de outro mês
 * (`onTelaRecebida` → `anteciparMetasPreenchimento`), em paralelo com a renderização da tela, em vez
 * de esperar o efeito de `AcoesMetasPreenchimento` depois da renderização completa.
 */
import { useCallback, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Notificacao } from '../../components/Notificacao'
import { mensagemDeErro } from '../../services/api'
import { errosDoPreenchimento } from '../../services/preenchimentoService'
import type { ResultadoAberturaPeriodo } from '../../services/periodoService'
import { ROTULOS_ABA } from '../../sessao/permissoes'
import type { ApontamentoPreenchimento, ItemPreenchimento, TelaPreenchimento } from '../../types/dominio'
import { formatarCompetencia } from '../../utils/formato'
import { AcoesMetasPreenchimento } from './AcoesMetasPreenchimento'
import { AcoesPeriodoPreenchimento } from './AcoesPeriodoPreenchimento'
import { CabecalhoMesPreenchimento } from './CabecalhoMesPreenchimento'
import { DialogoCorrecaoApontamento, type CorrecaoApontamento } from './DialogoCorrecaoApontamento'
import { DialogoHistoricoApontamento } from './DialogoHistoricoApontamento'
import { ListaApontamentosPreenchimento } from './ListaApontamentosPreenchimento'
import { SeletorMesCompetencia } from './SeletorMesCompetencia'
import { apontamentosSemValor, lerValorDigitado, mensagemSucessoPreenchimento } from './regrasPreenchimento'
import { anteciparMetasPreenchimento, mesDasMetas, type ConsultaMetasAntecipada } from './useMetasPreenchimento'
import { usePreenchimento, type UsePreenchimentoResultado } from './usePreenchimento'
import './PreenchimentoPage.css'

export const MENSAGEM_SELECIONE_FILIAL = 'Selecione uma filial no cabeçalho para preencher os apontamentos.'

interface TelaDoMesProps {
  tela: TelaPreenchimento
  salvar: UsePreenchimentoResultado['salvar']
  onNotificar: (mensagem: string) => void
}

/** Erros por apontamento de um lote recusado (os sem id ficam na mensagem geral). */
function errosPorApontamento(falha: unknown): Record<number, string> {
  const erros: Record<number, string> = {}
  for (const { idApontamento, mensagem } of errosDoPreenchimento(falha)) {
    if (idApontamento !== null && erros[idApontamento] === undefined) erros[idApontamento] = mensagem
  }
  return erros
}

/** Apontamentos do mês com o lançamento em lote, a correção e o histórico. */
function TelaDoMes({ tela, salvar, onNotificar }: TelaDoMesProps) {
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({})
  const [erros, setErros] = useState<Record<number, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvandoLote, setSalvandoLote] = useState(false)
  /** Pedido de foco no primeiro campo inválido (objeto novo a cada validação com erro). */
  const [pedidoFoco, setPedidoFoco] = useState<{ id: number } | null>(null)

  const [corrigindo, setCorrigindo] = useState<ApontamentoPreenchimento | null>(null)
  const [salvandoCorrecao, setSalvandoCorrecao] = useState(false)
  const [erroCorrecao, setErroCorrecao] = useState<string | null>(null)
  const [historico, setHistorico] = useState<ApontamentoPreenchimento | null>(null)

  const informados = tela.editavel
    ? apontamentosSemValor(tela.tipos).filter((apontamento) => (rascunhos[apontamento.id] ?? '').trim() !== '')
    : []

  function alterarRascunho(id: number, texto: string) {
    setRascunhos((atuais) => ({ ...atuais, [id]: texto }))
    setErros((atuais) => {
      if (atuais[id] === undefined) return atuais
      const restantes = { ...atuais }
      delete restantes[id]
      return restantes
    })
  }

  async function salvarLancamentos() {
    const novosErros: Record<number, string> = {}
    const itens: ItemPreenchimento[] = []
    for (const apontamento of informados) {
      const { valor, erro } = lerValorDigitado(apontamento.tipoValor, rascunhos[apontamento.id] ?? '')
      if (erro) novosErros[apontamento.id] = erro
      else if (valor !== null) itens.push({ idApontamento: apontamento.id, valor })
    }
    setErroGeral(null)
    setErros(novosErros)
    // Validação com erro: foco no primeiro campo inválido, na ordem da tela (a de `informados`).
    const primeiroInvalido = informados.find((apontamento) => novosErros[apontamento.id] !== undefined)
    if (primeiroInvalido) setPedidoFoco({ id: primeiroInvalido.id })
    if (Object.keys(novosErros).length > 0 || itens.length === 0) return

    setSalvandoLote(true)
    try {
      const resultado = await salvar(itens)
      setRascunhos({})
      onNotificar(mensagemSucessoPreenchimento(resultado))
    } catch (falha) {
      setErros(errosPorApontamento(falha))
      setErroGeral(mensagemDeErro(falha))
    } finally {
      setSalvandoLote(false)
    }
  }

  function abrirCorrecao(apontamento: ApontamentoPreenchimento) {
    setErroCorrecao(null)
    setCorrigindo(apontamento)
  }

  async function confirmarCorrecao({ valor, motivo }: CorrecaoApontamento) {
    if (corrigindo === null) return
    const id = corrigindo.id
    setErroCorrecao(null)
    setSalvandoCorrecao(true)
    try {
      const resultado = await salvar([{ idApontamento: id, valor, motivo }])
      setCorrigindo(null)
      onNotificar(mensagemSucessoPreenchimento(resultado))
    } catch (falha) {
      const doItem = errosDoPreenchimento(falha).find((erro) => erro.idApontamento === id)
      setErroCorrecao(doItem?.mensagem ?? mensagemDeErro(falha))
    } finally {
      setSalvandoCorrecao(false)
    }
  }

  return (
    <>
      <ListaApontamentosPreenchimento
        tipos={tela.tipos}
        editavel={tela.editavel}
        rascunhos={rascunhos}
        onAlterarRascunho={alterarRascunho}
        erros={erros}
        onCorrigir={abrirCorrecao}
        onVerHistorico={setHistorico}
        pedidoFoco={pedidoFoco}
      />
      {tela.editavel ? (
        <div className="preenchimento-page__salvar">
          {erroGeral ? <Aviso tipo="erro">{erroGeral}</Aviso> : null}
          <Botao onClick={() => void salvarLancamentos()} disabled={informados.length === 0 || salvandoLote}>
            Salvar lançamentos
          </Botao>
        </div>
      ) : null}
      <DialogoCorrecaoApontamento
        apontamento={corrigindo}
        salvando={salvandoCorrecao}
        erro={erroCorrecao}
        onConfirmar={(correcao) => void confirmarCorrecao(correcao)}
        onFechar={() => setCorrigindo(null)}
      />
      <DialogoHistoricoApontamento
        apontamento={historico}
        filial={tela.filial}
        mesDeReferencia={tela.mesDeReferencia}
        onFechar={() => setHistorico(null)}
      />
    </>
  )
}

/**
 * Conteúdo da aba com uma filial escolhida: carga, resumo, seletor de mês e apontamentos. O seletor
 * continua disponível quando a tela ou os meses falham (para escolher outro mês ou outro ano); o erro
 * dos meses tem "Tentar novamente", que consulta de novo os meses do ano exibido.
 */
function ConteudoPreenchimento({ preenchimento, onNotificar }: { preenchimento: UsePreenchimentoResultado; onNotificar: (mensagem: string) => void }) {
  const { tela, carregando, erro, recarregar, ano, meses, carregandoMeses, erroMeses, mesSelecionado, periodoAberto, mudarAno } =
    preenchimento

  return (
    <>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando preenchimento..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />
      {tela ? <CabecalhoMesPreenchimento tela={tela} /> : null}
      {erroMeses ? (
        <EstadoCarga
          carregando={carregandoMeses}
          mensagemCarregando="Carregando meses..."
          erro={erroMeses}
          onTentarNovamente={() => {
            if (ano !== null) mudarAno(ano)
          }}
        />
      ) : null}
      {ano !== null && (meses.length > 0 || erroMeses !== null) ? (
        <SeletorMesCompetencia
          ano={ano}
          meses={meses}
          mesSelecionado={mesSelecionado}
          periodoAberto={periodoAberto}
          onSelecionarMes={preenchimento.selecionarMes}
          onMudarAno={mudarAno}
          onIrParaPeriodoAberto={preenchimento.irParaPeriodoAberto}
        />
      ) : null}
      {tela ? (
        <TelaDoMes
          key={`${tela.filial}|${tela.mesDeReferencia}`}
          tela={tela}
          salvar={preenchimento.salvar}
          onNotificar={onNotificar}
        />
      ) : null}
    </>
  )
}

/** "Período aberto: MM/AAAA." ou, na reabertura de um mês passado, "Período reaberto: MM/AAAA.". */
function mensagemAberturaPeriodo({ reaberto, mesDeReferencia }: ResultadoAberturaPeriodo): string {
  return `${reaberto ? 'Período reaberto' : 'Período aberto'}: ${formatarCompetencia(mesDeReferencia)}.`
}

export function PreenchimentoPage() {
  /** Consulta da janela de metas disparada ao chegar a tela de outra filial/mês. */
  const [metasAntecipadas, setMetasAntecipadas] = useState<ConsultaMetasAntecipada | null>(null)
  const telaRecebida = useCallback((tela: TelaPreenchimento, anterior: TelaPreenchimento | null) => {
    // Recarga do mesmo filial/mês (ex.: depois de salvar) não consulta as metas de novo.
    if (anterior !== null && anterior.filial === tela.filial && mesDasMetas(anterior) === mesDasMetas(tela)) return
    const consulta = anteciparMetasPreenchimento(tela.filial, mesDasMetas(tela))
    setMetasAntecipadas(consulta)
    // A resposta fica guardada aqui: a janela aparece sem esperar o efeito de `AcoesMetasPreenchimento`.
    void consulta.promessa.then((janela) =>
      setMetasAntecipadas((atual) => (atual?.promessa === consulta.promessa ? { ...consulta, resposta: { janela } } : atual)),
    )
  }, [])
  const preenchimento = usePreenchimento({ onTelaRecebida: telaRecebida })
  const [notificacao, setNotificacao] = useState<string | null>(null)
  /** Muda a cada abertura/reabertura de período: a janela de metas é consultada de novo. */
  const [versaoPeriodo, setVersaoPeriodo] = useState(0)
  const { tela, irParaPeriodoAberto } = preenchimento

  function periodoAberto(resultado: ResultadoAberturaPeriodo) {
    setNotificacao(mensagemAberturaPeriodo(resultado))
    setVersaoPeriodo((atual) => atual + 1)
    irParaPeriodoAberto()
  }

  return (
    <div className="preenchimento-page">
      {/* Área de ações do topo: título, metas (com filial e tela) e período (sempre). */}
      <div className="preenchimento-acoes">
        <h1>{ROTULOS_ABA['preenchimento']}</h1>
        <div className="preenchimento-acoes__botoes">
          {tela ? (
            <AcoesMetasPreenchimento
              key={tela.filial}
              tela={tela}
              onNotificar={setNotificacao}
              versaoPeriodo={versaoPeriodo}
              consultaAntecipada={metasAntecipadas}
            />
          ) : null}
          <AcoesPeriodoPreenchimento periodoDaTela={preenchimento.periodoAberto} onAberto={periodoAberto} />
        </div>
      </div>
      {preenchimento.codigoFilial === null ? (
        <p className="preenchimento-page__sem-filial">{MENSAGEM_SELECIONE_FILIAL}</p>
      ) : (
        <ConteudoPreenchimento preenchimento={preenchimento} onNotificar={setNotificacao} />
      )}
      <Notificacao tipo="sucesso" mensagem={notificacao} onFechar={() => setNotificacao(null)} />
    </div>
  )
}
