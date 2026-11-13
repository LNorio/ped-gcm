/**
 * Janela "Editar metas" do Preenchimento (F9.9 — RF-72, RF-73, RN-07).
 *
 * Componente de apresentação: a página carrega a `JanelaMetas` (`listarMetasPreenchimento`) e envia o
 * ajuste (`ajustarMetas`). Mostra a filial, o mês e a situação; um filtro "Tipo" local (só oculta
 * linhas: os valores digitados nas linhas ocultas são mantidos e enviados ao salvar) e a tabela
 * "Metas dos indicadores" com a meta do cadastro (e a origem) e a meta vigente do mês.
 *
 * No mês editável, cada linha tem "Nova meta" e "Motivo"; "Salvar metas" valida tudo no front (lote
 * tudo ou nada) e chama `onConfirmar` com as linhas preenchidas, na ordem da janela. Fora do mês
 * editável, a janela é só de consulta. Indicador ajustado oferece "Histórico de {nome}" nos dois modos.
 *
 * Os erros de campo não usam `role="alert"`: o alerta geral (`erro`) já anuncia a falha da API e, na
 * validação local, o foco vai para o primeiro campo inválido (que tem o erro na descrição acessível).
 */
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import { Etiqueta } from '../../components/Etiqueta'
import { Select, type OpcaoSelect } from '../../components/Select'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import type { ErroDeIndicador } from '../../services/metasService'
import type {
  IndicadorMetaPreenchimento,
  ItemAjusteMeta,
  JanelaMetas,
  OrigemMetaDoCadastro,
  SituacaoMesConsultado,
} from '../../types/dominio'
import { formatarCompetencia, formatarNumero, lerDecimal } from '../../utils/formato'
import '../../components/ErroCampo.css'
import './DialogoEditarMetas.css'

export interface DialogoEditarMetasProps {
  /** Janela de metas do mês; `null` mantém o diálogo fechado. */
  janela: JanelaMetas | null
  /** Código da filial da tela. */
  filial: string
  /** Nome da filial; sem ele, mostra só o código. */
  nomeFilial?: string | null
  /** Mês da tela (`AAAA-MM-DD` ou `AAAA-MM`). */
  mesDeReferencia: string
  /** Enquanto `true`, "Salvar metas" fica desabilitado. */
  salvando: boolean
  /** Mensagem de erro da API; `null` quando não há. */
  erro: string | null
  /** Erros por item do ajuste recusado (`errosDoAjusteMetas`). Padrão `[]`. */
  errosIndicadores?: readonly ErroDeIndicador[]
  onConfirmar: (itens: ItemAjusteMeta[]) => void
  onCancelar: () => void
  onVerHistorico: (indicador: IndicadorMetaPreenchimento) => void
}

const MENSAGEM_META_INVALIDA = 'Informe uma meta maior que zero.'
const MENSAGEM_META_IGUAL_VIGENTE = 'A nova meta deve ser diferente da meta vigente.'
const MENSAGEM_MOTIVO_OBRIGATORIO = 'Informe o motivo do ajuste.'
const MENSAGEM_NENHUM_AJUSTE = 'Informe a nova meta de ao menos um indicador.'
const MENSAGEM_SOMENTE_CONSULTA = 'Somente consulta: o ajuste de meta só é permitido no mês aberto.'

const SEM_VALOR = '—'
const TODOS_OS_TIPOS = ''
const SEM_ERROS_INDICADORES: readonly ErroDeIndicador[] = []

const ROTULOS_SITUACAO: Readonly<Record<SituacaoMesConsultado, string>> = {
  aberto: 'Aberto',
  fechado: 'Fechado',
}

const ROTULOS_ORIGEM: Readonly<Record<OrigemMetaDoCadastro, string>> = {
  filial: 'Meta da filial',
  geral: 'Meta geral',
}

interface ValoresLinha {
  meta: string
  motivo: string
}

interface ErrosLinha {
  meta?: string
  motivo?: string
}

type Campos = keyof ValoresLinha

const LINHA_VAZIA: ValoresLinha = { meta: '', motivo: '' }

/** "{código} - {nome}", ou só o código sem nome. */
function textoFilialMetas(filial: string, nomeFilial?: string | null): string {
  const nome = nomeFilial?.trim()
  return nome ? `${filial} - ${nome}` : filial
}

/** Nomes dos tipos dos indicadores, na ordem em que aparecem, sem repetir. */
function tiposDaJanela(indicadores: readonly IndicadorMetaPreenchimento[]): string[] {
  const tipos: string[] = []
  for (const indicador of indicadores) {
    for (const tipo of indicador.tipos) if (!tipos.includes(tipo)) tipos.push(tipo)
  }
  return tipos
}

function linhaPreenchida(valores: ValoresLinha): boolean {
  return valores.meta.trim() !== '' || valores.motivo.trim() !== ''
}

interface ResultadoValidacao {
  itens: ItemAjusteMeta[]
  erros: Record<number, ErrosLinha>
  nenhum: boolean
}

/** Valida todas as linhas (lote tudo ou nada); linhas em branco ficam de fora. */
function validarAjustes(
  indicadores: readonly IndicadorMetaPreenchimento[],
  valores: Readonly<Record<number, ValoresLinha>>,
): ResultadoValidacao {
  const itens: ItemAjusteMeta[] = []
  const erros: Record<number, ErrosLinha> = {}

  for (const indicador of indicadores) {
    const linha = valores[indicador.id] ?? LINHA_VAZIA
    if (!linhaPreenchida(linha)) continue

    const erro: ErrosLinha = {}
    const meta = lerDecimal(linha.meta)
    if (meta === null || meta <= 0) erro.meta = MENSAGEM_META_INVALIDA
    else if (indicador.metaVigente !== null && meta === indicador.metaVigente) erro.meta = MENSAGEM_META_IGUAL_VIGENTE

    const motivo = linha.motivo.trim()
    if (motivo === '') erro.motivo = MENSAGEM_MOTIVO_OBRIGATORIO

    if (erro.meta || erro.motivo) erros[indicador.id] = erro
    else if (meta !== null) itens.push({ idIndicador: indicador.id, meta, motivo })
  }

  return { itens, erros, nenhum: itens.length === 0 && Object.keys(erros).length === 0 }
}

/** Erros da API por indicador da janela (vários do mesmo indicador são juntados). */
function errosDaApiPorIndicador(
  erros: readonly ErroDeIndicador[],
  indicadores: readonly IndicadorMetaPreenchimento[],
): Map<number, string> {
  const ids = new Set(indicadores.map((indicador) => indicador.id))
  const porIndicador = new Map<number, string>()
  for (const erro of erros) {
    if (erro.idIndicador === null || !ids.has(erro.idIndicador)) continue
    const anterior = porIndicador.get(erro.idIndicador)
    porIndicador.set(erro.idIndicador, anterior ? `${anterior} ${erro.mensagem}` : erro.mensagem)
  }
  return porIndicador
}

function textoMeta(valor: number | null): string {
  return valor === null ? SEM_VALOR : formatarNumero(valor)
}

function textoComposicao(indicador: IndicadorMetaPreenchimento): string {
  const nomes = indicador.composicao?.itens.map((item) => item.nome) ?? []
  return nomes.length > 0 ? nomes.join(', ') : SEM_VALOR
}

interface CampoDaLinhaProps {
  id: string
  rotulo: string
  valor: string
  erro: string | undefined
  desabilitado: boolean
  decimal?: boolean
  onAlterar: (valor: string) => void
}

/** Campo de uma linha da tabela, com o erro na descrição acessível (sem `role="alert"`). */
function CampoDaLinha({ id, rotulo, valor, erro, desabilitado, decimal = false, onAlterar }: CampoDaLinhaProps) {
  const idErro = `${id}-erro`
  return (
    <div className="metas-preenchimento__campo">
      <Campo
        id={id}
        rotulo={rotulo}
        rotuloOculto
        value={valor}
        inputMode={decimal ? 'decimal' : undefined}
        autoComplete="off"
        disabled={desabilitado}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        onChange={(evento) => onAlterar(evento.target.value)}
      />
      {erro ? (
        <p id={idErro} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

interface ConteudoEditarMetasProps {
  janela: JanelaMetas
  idFormulario: string
  filial: string
  nomeFilial: string | null | undefined
  mesDeReferencia: string
  salvando: boolean
  erro: string | null
  errosIndicadores: readonly ErroDeIndicador[]
  onConfirmar: (itens: ItemAjusteMeta[]) => void
  onVerHistorico: (indicador: IndicadorMetaPreenchimento) => void
}

interface ErrosApiDescartados {
  /** Lista de erros da API a que os descartes se referem; outra lista recomeça sem descartes. */
  fonte: readonly ErroDeIndicador[]
  ids: ReadonlySet<number>
}

/** Conteúdo da janela; montado a cada abertura, então os campos começam vazios. */
function ConteudoEditarMetas({
  janela,
  idFormulario,
  filial,
  nomeFilial,
  mesDeReferencia,
  salvando,
  erro,
  errosIndicadores,
  onConfirmar,
  onVerHistorico,
}: ConteudoEditarMetasProps) {
  const idBase = useId()
  const [tipo, setTipo] = useState(TODOS_OS_TIPOS)
  const [valores, setValores] = useState<Record<number, ValoresLinha>>({})
  const [erros, setErros] = useState<Record<number, ErrosLinha>>({})
  const [nenhum, setNenhum] = useState(false)
  const [descartados, setDescartados] = useState<ErrosApiDescartados>({ fonte: errosIndicadores, ids: new Set() })
  const [focar, setFocar] = useState<{ id: string } | null>(null)

  const indicadores = janela.indicadores
  const tipos = useMemo(() => tiposDaJanela(indicadores), [indicadores])
  const errosApi = useMemo(() => errosDaApiPorIndicador(errosIndicadores, indicadores), [errosIndicadores, indicadores])
  const idsDescartados = descartados.fonte === errosIndicadores ? descartados.ids : null

  const tipoValido = tipo === TODOS_OS_TIPOS || tipos.includes(tipo) ? tipo : TODOS_OS_TIPOS
  const visiveis = tipoValido === TODOS_OS_TIPOS ? indicadores : indicadores.filter((indicador) => indicador.tipos.includes(tipoValido))
  const opcoesTipo: OpcaoSelect[] = [
    { valor: TODOS_OS_TIPOS, rotulo: 'Todos os tipos' },
    ...tipos.map((nome) => ({ valor: nome, rotulo: nome })),
  ]

  const idCampo = (indicador: IndicadorMetaPreenchimento, campo: Campos) => `${idBase}-${campo}-${indicador.id}`

  // Validação local: leva o foco ao primeiro campo inválido (o erro está na descrição acessível).
  useEffect(() => {
    if (focar === null) return
    document.getElementById(focar.id)?.focus()
  }, [focar])

  function erroDaMeta(indicador: IndicadorMetaPreenchimento): string | undefined {
    const local = erros[indicador.id]?.meta
    if (local) return local
    if (idsDescartados?.has(indicador.id)) return undefined
    return errosApi.get(indicador.id)
  }

  function alterar(indicador: IndicadorMetaPreenchimento, campo: Campos, valor: string) {
    setValores((atual) => ({ ...atual, [indicador.id]: { ...(atual[indicador.id] ?? LINHA_VAZIA), [campo]: valor } }))
    setErros((atual) => {
      if (!atual[indicador.id]?.[campo]) return atual
      return { ...atual, [indicador.id]: { ...atual[indicador.id], [campo]: undefined } }
    })
    setNenhum(false)
    if (campo === 'meta' && errosApi.has(indicador.id)) {
      setDescartados((atual) => {
        const ids = new Set(atual.fonte === errosIndicadores ? atual.ids : [])
        ids.add(indicador.id)
        return { fonte: errosIndicadores, ids }
      })
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || !janela.editavel) return

    const resultado = validarAjustes(indicadores, valores)
    setErros(resultado.erros)
    setNenhum(resultado.nenhum)
    if (resultado.nenhum) return

    const primeiroInvalido = indicadores.find((indicador) => resultado.erros[indicador.id])
    if (primeiroInvalido) {
      // Erro numa linha oculta pelo filtro: volta a mostrar todos os tipos para o erro ficar visível.
      if (!visiveis.includes(primeiroInvalido)) setTipo(TODOS_OS_TIPOS)
      const campo: Campos = resultado.erros[primeiroInvalido.id]?.meta ? 'meta' : 'motivo'
      setFocar({ id: idCampo(primeiroInvalido, campo) })
      return
    }

    onConfirmar(resultado.itens)
  }

  const colunas: ColunaTabela<IndicadorMetaPreenchimento>[] = [
    {
      chave: 'indicador',
      titulo: 'Indicador',
      render: (indicador) => (
        <div className="metas-preenchimento__indicador">
          <span className="metas-preenchimento__nome">{indicador.nome}</span>
          {indicador.ajustada ? <Etiqueta tom="info">Ajustada</Etiqueta> : null}
          {indicador.ajustada ? (
            <Botao
              variante="link"
              tamanho="pequeno"
              aria-label={`Histórico de ${indicador.nome}`}
              onClick={() => onVerHistorico(indicador)}
            >
              Histórico
            </Botao>
          ) : null}
        </div>
      ),
    },
    { chave: 'tipos', titulo: 'Tipos', render: (indicador) => indicador.tipos.join(', ') },
    { chave: 'composicao', titulo: 'Composição', render: (indicador) => textoComposicao(indicador) },
    {
      chave: 'metaDoCadastro',
      titulo: 'Meta do cadastro',
      alinhar: 'direita',
      render: (indicador) => (
        <>
          <span>{textoMeta(indicador.metaDoCadastro)}</span>
          {indicador.metaDoCadastro !== null && indicador.metaDoCadastroOrigem ? (
            <span className="metas-preenchimento__origem">{ROTULOS_ORIGEM[indicador.metaDoCadastroOrigem]}</span>
          ) : null}
        </>
      ),
    },
    { chave: 'metaVigente', titulo: 'Meta vigente', alinhar: 'direita', render: (indicador) => textoMeta(indicador.metaVigente) },
  ]

  if (janela.editavel) {
    colunas.push(
      {
        chave: 'novaMeta',
        titulo: 'Nova meta',
        render: (indicador) => (
          <CampoDaLinha
            id={idCampo(indicador, 'meta')}
            rotulo={`Nova meta de ${indicador.nome}`}
            valor={valores[indicador.id]?.meta ?? ''}
            erro={erroDaMeta(indicador)}
            desabilitado={salvando}
            decimal
            onAlterar={(valor) => alterar(indicador, 'meta', valor)}
          />
        ),
      },
      {
        chave: 'motivo',
        titulo: 'Motivo',
        render: (indicador) => (
          <CampoDaLinha
            id={idCampo(indicador, 'motivo')}
            rotulo={`Motivo do ajuste de ${indicador.nome}`}
            valor={valores[indicador.id]?.motivo ?? ''}
            erro={erros[indicador.id]?.motivo}
            desabilitado={salvando}
            onAlterar={(valor) => alterar(indicador, 'motivo', valor)}
          />
        ),
      },
    )
  }

  const conteudo = (
    <>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {nenhum ? <Aviso tipo="erro">{MENSAGEM_NENHUM_AJUSTE}</Aviso> : null}
      <dl className="metas-preenchimento__cabecalho">
        <div className="metas-preenchimento__par">
          <dt className="metas-preenchimento__rotulo">Filial</dt>
          <dd className="metas-preenchimento__valor">{textoFilialMetas(filial, nomeFilial)}</dd>
        </div>
        <div className="metas-preenchimento__par">
          <dt className="metas-preenchimento__rotulo">Mês</dt>
          <dd className="metas-preenchimento__valor">{formatarCompetencia(mesDeReferencia)}</dd>
        </div>
        <div className="metas-preenchimento__par">
          <dt className="metas-preenchimento__rotulo">Situação</dt>
          <dd className="metas-preenchimento__valor">{ROTULOS_SITUACAO[janela.situacaoDoMes]}</dd>
        </div>
      </dl>
      {janela.editavel ? null : <Aviso tipo="info">{MENSAGEM_SOMENTE_CONSULTA}</Aviso>}
      <div className="metas-preenchimento__filtro">
        <Select rotulo="Tipo" opcoes={opcoesTipo} value={tipoValido} onChange={(evento) => setTipo(evento.target.value)} />
      </div>
      <Tabela
        colunas={colunas}
        dados={visiveis}
        obterChave={(indicador) => indicador.id}
        legenda="Metas dos indicadores"
        textoVazio="Nenhum indicador com meta neste mês."
      />
    </>
  )

  if (!janela.editavel) return <div className="metas-preenchimento">{conteudo}</div>

  return (
    <form id={idFormulario} className="metas-preenchimento" onSubmit={enviar} noValidate>
      {conteudo}
    </form>
  )
}

export function DialogoEditarMetas({
  janela,
  filial,
  nomeFilial,
  mesDeReferencia,
  salvando,
  erro,
  errosIndicadores = SEM_ERROS_INDICADORES,
  onConfirmar,
  onCancelar,
  onVerHistorico,
}: DialogoEditarMetasProps) {
  const idFormulario = useId()

  return (
    <Dialogo
      aberto={janela !== null}
      titulo="Editar metas"
      onFechar={onCancelar}
      className="dialogo--largo"
      acoes={
        janela?.editavel ? (
          <>
            <Botao variante="contorno" onClick={onCancelar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idFormulario} disabled={salvando}>
              Salvar metas
            </Botao>
          </>
        ) : null
      }
    >
      {janela ? (
        <ConteudoEditarMetas
          janela={janela}
          idFormulario={idFormulario}
          filial={filial}
          nomeFilial={nomeFilial}
          mesDeReferencia={mesDeReferencia}
          salvando={salvando}
          erro={erro}
          errosIndicadores={errosIndicadores}
          onConfirmar={onConfirmar}
          onVerHistorico={onVerHistorico}
        />
      ) : null}
    </Dialogo>
  )
}
