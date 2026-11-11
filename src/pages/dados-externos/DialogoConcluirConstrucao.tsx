/**
 * Modal da integração de um dado externo pelo Admin, em dois modos:
 * - `concluir` (padrão — F5.7, RF-28): "Concluir construção" de um dado em construção, com os campos
 *   vazios e o botão "Concluir e ativar";
 * - `configurar` (F5.16): "Configurações da integração" de um dado ativo/inativo, com os campos
 *   preenchidos pelos valores salvos (identificador, URL, `JSON.stringify(parametros, null, 2)` — `null`
 *   vira vazio — e o mapeamento salvo nas listas) e o botão "Salvar configurações".
 *
 * - `leitura` (F5.19): "Integração do dado externo", só para consulta (fonte da meta `dado_externo` na
 *   aba Indicadores): os quatro campos com os valores salvos (e o mapeamento salvo, quando há), `readOnly`
 *   e sem obrigatoriedade, sem modelos, variáveis, operadores, sugestões, validação (local ou no servidor)
 *   nem "falta: ...", e só o botão "Fechar" (Fechar e Esc chamam `onCancelar`). As demais props são
 *   opcionais e ignoradas.
 *
 * Também serve à integração da meta do indicador (F6.11, `tipoAlvo: 'indicador'`, modo `configurar`):
 * `dado` é um `AlvoIntegracao` (o `DadoExterno` é compatível). `tipoAlvo` muda o texto da modal, o papel
 * do valor no mapeamento (`valor` no dado externo, `meta` no indicador — "Campo do valor"/"Campo da
 * meta") e o modelo de "Inserir modelo de saída". Sem janela retroativa nem dia da coleta, os valores de
 * exemplo usam só `hoje`.
 *
 * Saída por "chave: tipo" (11/11/2026, opção B — `docs/propostas-backend/FRONT-saida-chave-tipo.md`): a
 * saída descreve um item da resposta como `{ "campo": "tipo" }` (`string`, `number`, `date`, `boolean`) e
 * um texto abaixo dela orienta o formato. Abaixo da saída (e da sua validação) ficam as listas do
 * mapeamento: "Campo da filial" e "Campo do valor" ("Campo da meta" no indicador), obrigatórias, e
 * "Campo da competência", opcional ("Nenhum"). As opções são as chaves da saída em vigor (a do back-end
 * quando vale, senão a local), na ordem do JSON; sem saída válida as listas ficam desabilitadas. A escolha
 * é mantida enquanto a saída muda e só vale se o campo existir na saída válida atual. Os erros de
 * `validarMapeamento` aparecem junto a cada lista e o papel com falta ou erro entra no "falta: ...". A
 * lista (formato antigo) é inválida: uma integração salva em lista abre com um aviso e o salvar
 * bloqueado até a saída ser reescrita no formato novo (decisão do usuário de 11/11/2026).
 *
 * Com `dado` nulo, nada é renderizado. O Admin informa, todos obrigatórios e nesta ordem:
 * - o identificador da consulta (com sugestões dos existentes): ao digitar, colar ou escolher uma
 *   sugestão, o texto passa por `limparIdentificador` (só A–Z, 0–9, "_", "-" e ".", em maiúsculas);
 * - a URL da integração (`http://` ou `https://`, sem espaços);
 * - os parâmetros de saída (JSON) com o mapeamento, e os de entrada (JSON com variáveis `%nome%` e contas).
 *
 * Validação híbrida dos JSONs (F5.14, F5.18): o motor de `src/utils/integracao` mostra o resultado na
 * hora, com os valores de exemplo calculados a partir de `hoje` e do dado (janela retroativa e dia da
 * coleta) — o `exemplo` de cada variável da API prevalece. Com `validarNoServidor`, 400 ms
 * (`ATRASO_VALIDACAO_SERVIDOR_MS`) depois da última mudança nos JSONs (ou no mapeamento) o back-end também
 * valida, e o seu resultado vale para o campo enquanto o texto (e, na saída, o mapeamento) for o enviado
 * (ver `useValidacaoServidor`). O mapeamento vai na validação quando há ao menos uma escolha (ou um
 * mapeamento salvo).
 *
 * Limites do back-end: identificador (limpo) com até 60 caracteres e URL (após `trim`) com até 500
 * (`maxLength` nos campos). Valor acima do limite (ex.: salvo em Configurações) mostra a mensagem no
 * campo ("O identificador aceita até 60 caracteres." / "A URL aceita até 500 caracteres.") e conta como
 * falta ("identificador" / "URL válida").
 *
 * Avisos da entrada (executor, fase 2): com a entrada válida, `%filial%`, `%colaborador%` e `%zona%`
 * geram um aviso (não bloqueia). A validação no servidor leva a `finalidade` do tipo da integração
 * (`valor` no dado externo, `meta` no indicador).
 *
 * As variáveis disponíveis vêm da API (F5.15); clicar numa variável ou num operador insere o texto na
 * entrada. Enquanto o usuário não posicionar o cursor na entrada desde a abertura (foco, clique,
 * seleção, teclado ou digitação), a inserção vai para o fim do texto; depois vale a última posição ou
 * seleção do usuário (guardada nos eventos da caixa, mesmo após ela perder o foco), e cliques seguidos
 * continuam depois do último texto inserido. "Inserir modelo de entrada" volta a inserir no fim.
 * O botão só fica habilitado com tudo válido (pelo resultado em vigor), e o texto ao lado (descrição
 * acessível do botão) diz o que falta.
 *
 * Erros da API ficam dentro da modal, sem apagar o que foi preenchido: `erro` (mensagem geral) no
 * alerta e `errosCampos` (400 `{ mensagem, erros }`) junto a cada campo, formatados por
 * `formatarErroIntegracao`; `campo da filial`, `campo do valor` (dado externo) / `campo da meta`
 * (indicador) e `campo da competencia` vão para a lista correspondente; erro sem campo ou com campo
 * desconhecido entra na lista do alerta geral. O erro de um campo some quando o usuário altera aquele
 * campo (digitação, sugestão, modelo, variável/operador, escolha na lista); os demais e o alerta geral
 * ficam. Uma nova lista `errosCampos` (outra referência, ou seja, um novo 400) volta a mostrar todos.
 */
import { type ChangeEvent, type FormEvent, useId, useMemo, useState } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import { type OpcaoSelect, Select } from '../../components/Select'
import type { ErroIntegracao, IdentificadorColeta, JanelaRetroativa, MapeamentoSaida, VariavelIntegracao } from '../../types/dominio'
import { limparIdentificador } from '../../utils/identificador'
import { validarEntrada } from '../../utils/integracao/entrada'
import { formatarErroIntegracao } from '../../utils/integracao/erros'
import { valoresDeExemplo } from '../../utils/integracao/exemplos'
import { type ContextoIntegracao, variaveisDoTexto } from '../../utils/integracao/expressoes'
import { type PapelMapeamento, ROTULO_PAPEL, validarMapeamento } from '../../utils/integracao/mapeamento'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA, MODELO_JSON_SAIDA_META } from '../../utils/integracao/modelos'
import { type CampoValorSaida, validarSaida } from '../../utils/integracao/saida'
import { TAMANHO_MAXIMO_URL, urlValida } from '../../utils/integracao/url'
import { PainelVariaveis } from './PainelVariaveis'
import { SugestoesIdentificador } from './SugestoesIdentificador'
import { useInsercaoNoCursor } from './useInsercaoNoCursor'
import { type CampoSaidaExibido, useValidacaoServidor, type ValidarNoServidor } from './useValidacaoServidor'
import { ValidacaoEntrada, ValidacaoSaida } from './ValidacaoIntegracao'
import './DialogoConcluirConstrucao.css'

/** Espera entre a última mudança nos JSONs (ou no mapeamento) e a validação no back-end (F5.18). */
export const ATRASO_VALIDACAO_SERVIDOR_MS = 400

/** Tamanho máximo do identificador (limpo) aceito pelo back-end. */
export const TAMANHO_MAXIMO_IDENTIFICADOR = 60

const MENSAGEM_LIMITE_IDENTIFICADOR = `O identificador aceita até ${TAMANHO_MAXIMO_IDENTIFICADOR} caracteres.`
const MENSAGEM_LIMITE_URL = `A URL aceita até ${TAMANHO_MAXIMO_URL} caracteres.`
const ORIENTACAO_SAIDA = 'Descreva um item da resposta como { "campo": "tipo" }, com os tipos string, number, date ou boolean.'
const AVISO_FORMATO_ANTIGO =
  'Esta integração está no formato antigo (lista). Reescreva a saída no formato "campo": "tipo" para salvar.'

/** Dados informados ao concluir a construção ou salvar as configurações. */
export interface DadosConclusaoConstrucao {
  /** Identificador limpo: só A–Z, 0–9, "_", "-" e ".", em maiúsculas. */
  identificador: string
  /** URL sem espaços nas pontas. */
  url: string
  /** JSON de saída, como digitado. */
  parametrosSaida: string
  /** JSON de entrada, como digitado. */
  parametrosEntrada: string
  /**
   * Mapeamento da saída: `{ campoFilial, campoValor, campoCompetencia }` no dado externo e
   * `{ campoFilial, campoMeta, campoCompetencia }` no indicador (`campoCompetencia` `null` sem competência).
   */
  mapeamento: MapeamentoSaida
  /** Variáveis usadas na entrada (nomes sem `%`), pelo resultado em vigor (back-end ou local). */
  variaveisUsadas: string[]
}

/**
 * `concluir`: dado em construção (campos vazios); `configurar`: integração de um dado ativo/inativo;
 * `leitura` (F5.19): integração do dado externo só para consulta.
 */
export type ModoDialogoIntegracao = 'concluir' | 'configurar' | 'leitura'

/** Modos em que a integração é editada. */
export type ModoEdicaoIntegracao = Exclude<ModoDialogoIntegracao, 'leitura'>

/** De quem é a integração (F6.11): muda o texto da modal e o papel do valor no mapeamento. */
export type TipoAlvoIntegracao = 'dado-externo' | 'indicador'

/**
 * Dono da integração editada na modal (F6.11): um dado externo (`DadoExterno` é compatível) ou um
 * indicador com meta via API. Os parâmetros salvos são objeto/lista (ou `null`).
 */
export interface AlvoIntegracao {
  id: number
  nome: string
  identificador: string | null
  url: string | null
  parametrosSaida: unknown
  parametrosEntrada: unknown
  /** Usada nos valores de exemplo; ausente/`null` = sem janela. */
  janelaRetroativa?: JanelaRetroativa | null
  /** Usado nos valores de exemplo; ausente/`null` = sem dia da coleta. */
  diaDaColeta?: number | null
  /** Mapeamento salvo da saída (11/11/2026); ausente/`null` = listas vazias (ou formato antigo). */
  mapeamentoSaida?: MapeamentoSaida | null
}

export interface DialogoConcluirConstrucaoProps {
  /** Padrão `concluir`. */
  modo?: ModoEdicaoIntegracao
  /** Dono da integração (dado externo ou indicador — F6.11); `null` mantém a modal fechada. */
  dado: AlvoIntegracao | null
  /** De quem é a integração; muda o texto e o papel do valor no mapeamento. Padrão `dado-externo`. */
  tipoAlvo?: TipoAlvoIntegracao
  /** Identificadores existentes, oferecidos como sugestão. */
  identificadores: IdentificadorColeta[]
  /** Variáveis da integração recebidas da API. */
  variaveis: VariavelIntegracao[]
  /** Enquanto `true`, mostra "Carregando variáveis...". */
  carregandoVariaveis: boolean
  /** Erro ao carregar as variáveis; com erro, nenhuma variável é considerada conhecida. */
  erroVariaveis: string | null
  /** Enquanto `true` (gravando), o botão de confirmar fica desabilitado. */
  concluindo: boolean
  /** Mensagem geral de erro devolvida pela API; `null` quando não há. */
  erro: string | null
  /**
   * Erros por campo do 400 da integração (padrão `[]`). O erro de um campo some quando o usuário o
   * altera; uma nova lista (outra referência) volta a mostrar todos.
   */
  errosCampos?: ErroIntegracao[]
  /** Data usada nos valores de exemplo (padrão: a data atual). */
  hoje?: Date
  /** Validação no back-end (F5.18); sem ela, vale só o motor local. */
  validarNoServidor?: ValidarNoServidor
  /** Chamado com os dados válidos. */
  onConfirmar: (dados: DadosConclusaoConstrucao) => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

/**
 * Props do modo leitura (F5.19): só `dado` e `onCancelar` são necessários; as demais props da modal são
 * aceitas e ignoradas (`tipoAlvo` não muda o modo leitura).
 */
export type DialogoIntegracaoLeituraProps = {
  modo: 'leitura'
  dado: AlvoIntegracao | null
  /** Chamado ao clicar em "Fechar" ou pressionar Esc. */
  onCancelar: () => void
  tipoAlvo?: TipoAlvoIntegracao
} & Partial<Omit<DialogoConcluirConstrucaoProps, 'modo' | 'dado' | 'onCancelar' | 'tipoAlvo'>>

const TEXTOS_MODO: Readonly<Record<ModoEdicaoIntegracao, { titulo: string; botao: string }>> = {
  concluir: { titulo: 'Concluir construção', botao: 'Concluir e ativar' },
  configurar: { titulo: 'Configurações da integração', botao: 'Salvar configurações' },
}

/** Papel do valor no mapeamento, conforme o dono da integração. */
const CAMPO_VALOR_POR_ALVO: Readonly<Record<TipoAlvoIntegracao, CampoValorSaida>> = {
  'dado-externo': 'valor',
  indicador: 'meta',
}

/** Modelo de "Inserir modelo de saída" para cada papel do valor. */
const MODELO_SAIDA_POR_CAMPO: Readonly<Record<CampoValorSaida, string>> = {
  valor: MODELO_JSON_SAIDA,
  meta: MODELO_JSON_SAIDA_META,
}

/** Lista do mapeamento na modal: `valor` é a do valor (dado externo) ou a da meta (indicador). */
type ListaMapeamento = 'filial' | 'valor' | 'competencia'

const LISTAS_MAPEAMENTO: readonly ListaMapeamento[] = ['filial', 'valor', 'competencia']

type CampoModal = 'identificador' | 'url' | 'saida' | 'entrada' | ListaMapeamento

/** Nome do campo nos erros da API → campo da modal; o papel do valor depende do dono da integração. */
function camposDaApi(campoValor: CampoValorSaida): ReadonlyMap<string, CampoModal> {
  return new Map<string, CampoModal>([
    ['identificador', 'identificador'],
    ['url', 'url'],
    ['parametros de saida', 'saida'],
    ['parametros de entrada', 'entrada'],
    ['campo da filial', 'filial'],
    [campoValor === 'meta' ? 'campo da meta' : 'campo do valor', 'valor'],
    ['campo da competencia', 'competencia'],
  ])
}

const SEM_ERROS: ErroIntegracao[] = []

/** Erros da API agrupados pelo campo da modal; os sem campo conhecido vão para `gerais`. */
function agruparErros(erros: ErroIntegracao[], campoValor: CampoValorSaida) {
  const mapa = camposDaApi(campoValor)
  const porCampo: Partial<Record<CampoModal, string>> = {}
  const gerais: string[] = []
  for (const erro of erros) {
    const texto = formatarErroIntegracao(erro)
    const campo = erro.campo === null ? undefined : mapa.get(erro.campo)
    if (campo === undefined) gerais.push(texto)
    else porCampo[campo] = porCampo[campo] === undefined ? texto : `${porCampo[campo]}; ${texto}`
  }
  return { porCampo, gerais }
}

/** Junta as mensagens de um campo (limite local e erro da API); sem nenhuma, `undefined`. */
function juntarErros(...mensagens: (string | undefined)[]): string | undefined {
  const presentes = mensagens.filter((mensagem): mensagem is string => mensagem !== undefined && mensagem !== '')
  return presentes.length > 0 ? presentes.join('; ') : undefined
}

/** Parâmetros salvos (objeto ou lista) como texto com 2 espaços; `null`/ausente vira vazio. */
function textoDosParametros(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor
  return JSON.stringify(valor, null, 2) ?? ''
}

/** A saída salva está no formato antigo (lista, já decodificada ou em texto). */
function saidaSalvaEmLista(valor: unknown): boolean {
  if (Array.isArray(valor)) return true
  if (typeof valor !== 'string') return false
  try {
    return Array.isArray(JSON.parse(valor))
  } catch {
    return false
  }
}

/** Escolha das listas do mapeamento (`''` = nada escolhido / "Nenhum"). */
type EscolhaMapeamento = Record<ListaMapeamento, string>

function escolhaInicial(mapeamento: MapeamentoSaida | null | undefined, campoValor: CampoValorSaida): EscolhaMapeamento {
  return {
    filial: mapeamento?.campoFilial ?? '',
    valor: (campoValor === 'meta' ? mapeamento?.campoMeta : mapeamento?.campoValor) ?? '',
    competencia: mapeamento?.campoCompetencia ?? '',
  }
}

/** Mapeamento no formato do domínio, com a chave do valor conforme o dono da integração. */
function montarMapeamento(escolha: EscolhaMapeamento, campoValor: CampoValorSaida): MapeamentoSaida {
  const campoCompetencia = escolha.competencia === '' ? null : escolha.competencia
  return campoValor === 'meta'
    ? { campoFilial: escolha.filial, campoMeta: escolha.valor, campoCompetencia }
    : { campoFilial: escolha.filial, campoValor: escolha.valor, campoCompetencia }
}

/** Papel do mapeamento de cada lista. */
function papelDaLista(lista: ListaMapeamento, campoValor: CampoValorSaida): PapelMapeamento {
  return lista === 'valor' ? campoValor : lista
}

/** Opções das listas: as chaves da saída, na ordem, sem nomes vazios nem repetidos. */
function opcoesDosCampos(campos: readonly CampoSaidaExibido[]): OpcaoSelect[] {
  const nomes = [...new Set(campos.map((campo) => campo.nome))].filter((nome) => nome !== '')
  return nomes.map((nome) => ({ valor: nome, rotulo: nome }))
}

export function DialogoConcluirConstrucao(props: DialogoConcluirConstrucaoProps | DialogoIntegracaoLeituraProps) {
  if (props.dado === null) return null
  if (props.modo === 'leitura') return <ConteudoLeitura dado={props.dado} onCancelar={props.onCancelar} />
  const modo = props.modo ?? 'concluir'
  // `key` reinicia os campos ao abrir a modal para outro dado ou em outro modo.
  return <ConteudoDialogo key={`${modo}-${props.dado.id}`} {...props} modo={modo} dado={props.dado} />
}

/** Modo leitura (F5.19): os valores salvos da integração do dado externo, sem edição nem validação. */
function ConteudoLeitura({ dado, onCancelar }: { dado: AlvoIntegracao; onCancelar: () => void }) {
  const mapeamento = dado.mapeamentoSaida ?? null
  return (
    <Dialogo
      aberto
      titulo="Integração do dado externo"
      onFechar={onCancelar}
      className="dialogo--largo dialogo-concluir-construcao"
      acoes={
        <Botao variante="contorno" onClick={onCancelar}>
          Fechar
        </Botao>
      }
    >
      <div className="dialogo-concluir">
        <p className="dialogo-concluir__texto">{`Integração cadastrada no dado externo ${dado.nome} (somente leitura).`}</p>
        <div className="dialogo-concluir__grade">
          <Campo rotulo="Identificador da consulta" readOnly value={dado.identificador ?? ''} autoComplete="off" />
          <Campo rotulo="URL" readOnly value={dado.url ?? ''} autoComplete="off" />
        </div>
        <div className="dialogo-concluir__grade">
          <section className="dialogo-concluir__bloco">
            <AreaTexto
              rotulo="Parâmetros de saída"
              readOnly
              className="dialogo-concluir__json"
              rows={9}
              spellCheck={false}
              value={textoDosParametros(dado.parametrosSaida)}
            />
            {mapeamento !== null ? (
              <div className="dialogo-concluir__mapeamento">
                <Campo rotulo="Campo da filial" readOnly value={mapeamento.campoFilial} autoComplete="off" />
                <Campo rotulo="Campo do valor" readOnly value={mapeamento.campoValor ?? mapeamento.campoMeta ?? ''} autoComplete="off" />
                <Campo rotulo="Campo da competência" readOnly value={mapeamento.campoCompetencia ?? ''} autoComplete="off" />
              </div>
            ) : null}
          </section>
          <section className="dialogo-concluir__bloco">
            <AreaTexto
              rotulo="Parâmetros de entrada"
              readOnly
              className="dialogo-concluir__json"
              rows={9}
              spellCheck={false}
              value={textoDosParametros(dado.parametrosEntrada)}
            />
          </section>
        </div>
      </div>
    </Dialogo>
  )
}

function ConteudoDialogo({
  modo,
  tipoAlvo = 'dado-externo',
  dado,
  identificadores,
  variaveis,
  carregandoVariaveis,
  erroVariaveis,
  concluindo,
  erro,
  errosCampos = SEM_ERROS,
  hoje,
  validarNoServidor,
  onConfirmar,
  onCancelar,
}: DialogoConcluirConstrucaoProps & { modo: ModoEdicaoIntegracao; dado: AlvoIntegracao }) {
  const idFormulario = useId()
  const idFalta = useId()
  const configurar = modo === 'configurar'
  const campoValor = CAMPO_VALOR_POR_ALVO[tipoAlvo]
  const [identificador, setIdentificador] = useState(() => (configurar ? limparIdentificador(dado.identificador ?? '') : ''))
  const [url, setUrl] = useState(() => (configurar ? (dado.url ?? '') : ''))
  const [saida, setSaida] = useState(() => (configurar ? textoDosParametros(dado.parametrosSaida) : ''))
  const [entrada, setEntrada] = useState(() => (configurar ? textoDosParametros(dado.parametrosEntrada) : ''))
  const [escolha, setEscolha] = useState<EscolhaMapeamento>(() => escolhaInicial(configurar ? dado.mapeamentoSaida : null, campoValor))
  // O mapeamento vai na validação do back-end depois da primeira escolha (ou desde a abertura, se salvo).
  const [mapeamentoInformado, setMapeamentoInformado] = useState(() => configurar && dado.mapeamentoSaida != null)
  // Integração salva em lista (formato antigo): aviso até a saída ser reescrita no formato novo.
  const [saidaSalvaAntiga] = useState(() => configurar && saidaSalvaEmLista(dado.parametrosSaida))
  // Data fixada na abertura quando não informada, para a prévia não mudar a cada renderização.
  const [hojePadrao] = useState(() => new Date())
  const dataBase = hoje ?? hojePadrao

  // Erros do 400 por campo: os campos alterados desde a última lista recebida deixam de mostrar o erro.
  const [alteracoes, setAlteracoes] = useState<{ lista: ErroIntegracao[]; campos: ReadonlySet<CampoModal> }>(() => ({
    lista: errosCampos,
    campos: new Set(),
  }))
  let camposAlterados = alteracoes.campos
  if (alteracoes.lista !== errosCampos) {
    // Nova lista (novo 400): volta a mostrar todos os erros.
    camposAlterados = new Set()
    setAlteracoes({ lista: errosCampos, campos: camposAlterados })
  }

  function marcarAlterado(campo: CampoModal) {
    setAlteracoes((atual) => (atual.campos.has(campo) ? atual : { lista: atual.lista, campos: new Set([...atual.campos, campo]) }))
  }

  const variaveisConhecidas = useMemo(() => (erroVariaveis !== null ? [] : variaveis), [erroVariaveis, variaveis])
  const contexto = useMemo<ContextoIntegracao>(
    () => ({
      variaveis: variaveisConhecidas,
      valores: valoresDeExemplo({
        hoje: dataBase,
        mesesRetro: dado.janelaRetroativa ?? null,
        diaColeta: dado.diaDaColeta ?? null,
        variaveis: variaveisConhecidas,
      }),
    }),
    [variaveisConhecidas, dataBase, dado.janelaRetroativa, dado.diaDaColeta],
  )

  const saidaLocal = useMemo(() => validarSaida(saida, campoValor), [saida, campoValor])
  const entradaLocal = useMemo(() => validarEntrada(entrada, contexto), [entrada, contexto])
  const mapeamento = montarMapeamento(escolha, campoValor)
  const servidor = useValidacaoServidor({
    saida,
    entrada,
    finalidade: campoValor,
    mapeamento: mapeamentoInformado ? mapeamento : undefined,
    validar: validarNoServidor,
    atrasoMs: ATRASO_VALIDACAO_SERVIDOR_MS,
  })
  // Resultado em vigor: o do back-end para o texto atual (e o mapeamento enviado); senão o local.
  const resultadoSaida = servidor.saida ?? saidaLocal
  const resultadoEntrada = servidor.entrada ?? entradaLocal
  const saidaValida = resultadoSaida.estado === 'valido'
  const opcoesMapeamento = opcoesDosCampos(resultadoSaida.estado === 'valido' ? resultadoSaida.campos : [])
  // Sem saída válida o mapeamento não é conferido: as listas ficam desabilitadas e os obrigatórios faltam.
  const resultadoMapeamento =
    resultadoSaida.estado === 'valido' ? validarMapeamento(resultadoSaida.campos, mapeamento, campoValor) : null

  const identificadorLimpo = limparIdentificador(identificador)
  const identificadorLongo = identificadorLimpo.length > TAMANHO_MAXIMO_IDENTIFICADOR
  const urlLonga = url.trim().length > TAMANHO_MAXIMO_URL
  const falta: string[] = []
  if (identificadorLimpo === '' || identificadorLongo) falta.push('identificador')
  if (!urlValida(url)) falta.push('URL válida')
  if (!saidaValida) falta.push('JSON de saída válido')
  for (const lista of LISTAS_MAPEAMENTO) {
    const papel = papelDaLista(lista, campoValor)
    const comProblema =
      resultadoMapeamento === null
        ? lista !== 'competencia'
        : resultadoMapeamento.faltando.includes(papel) || resultadoMapeamento.erros[papel] !== undefined
    if (comProblema) falta.push(`campo ${ROTULO_PAPEL[papel]}`)
  }
  if (resultadoEntrada.estado !== 'valido') falta.push('JSON de entrada válido')
  const completo = falta.length === 0
  const textoFalta = completo ? 'Todos os campos obrigatórios preenchidos' : `falta: ${falta.join(', ')}`
  // Destaque das variáveis presentes na entrada, mesmo com o JSON ainda inválido.
  const variaveisNaEntrada = useMemo(() => new Set(variaveisDoTexto(entrada)), [entrada])
  const { porCampo: errosDaApi, gerais: errosGerais } = useMemo(() => agruparErros(errosCampos, campoValor), [errosCampos, campoValor])
  const erroDaApi = (campo: CampoModal) => (camposAlterados.has(campo) ? undefined : errosDaApi[campo])
  const textos = TEXTOS_MODO[modo]

  function alterarIdentificador(valor: string) {
    setIdentificador(limparIdentificador(valor))
    marcarAlterado('identificador')
  }

  function alterarUrl(valor: string) {
    setUrl(valor)
    marcarAlterado('url')
  }

  function alterarSaida(valor: string) {
    setSaida(valor)
    marcarAlterado('saida')
  }

  function alterarEntrada(valor: string) {
    setEntrada(valor)
    marcarAlterado('entrada')
  }

  function escolherCampo(lista: ListaMapeamento, valor: string) {
    setEscolha((atual) => ({ ...atual, [lista]: valor }))
    setMapeamentoInformado(true)
    marcarAlterado(lista)
  }

  // Inserção no cursor da entrada (variáveis e operadores).
  const {
    ref: entradaRef,
    guardarSelecao: guardarSelecaoEntrada,
    inserir: inserirNaEntrada,
    reiniciar: reiniciarCursorEntrada,
  } = useInsercaoNoCursor(entrada, alterarEntrada)

  function inserirModeloSaida() {
    alterarSaida(MODELO_SAIDA_POR_CAMPO[campoValor])
  }

  function inserirModeloEntrada() {
    // Reinicia o cursor: a próxima inserção vai para o fim do modelo.
    reiniciarCursorEntrada()
    alterarEntrada(MODELO_JSON_ENTRADA)
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (concluindo || resultadoEntrada.estado !== 'valido' || !completo) return
    onConfirmar({
      identificador: identificadorLimpo,
      url: url.trim(),
      parametrosSaida: saida,
      parametrosEntrada: entrada,
      mapeamento,
      variaveisUsadas: resultadoEntrada.variaveisUsadas,
    })
  }

  /** Lista do mapeamento: mostra a escolha só se o campo existe na saída válida atual. */
  function listaMapeamento(lista: ListaMapeamento) {
    const papel = papelDaLista(lista, campoValor)
    const escolhido = escolha[lista]
    const erroDaLista = juntarErros(resultadoMapeamento?.erros[papel], erroDaApi(lista))
    // O erro vai na descrição da lista (não como `role="alert"` do `ErroCampo`): o alerta da modal continua
    // sendo só o geral, e a lista fica marcada como inválida (`aria-invalid`) com a mensagem na descrição.
    const comum = {
      rotulo: `Campo ${ROTULO_PAPEL[papel]}`,
      value: opcoesMapeamento.some((opcao) => opcao.valor === escolhido) ? escolhido : '',
      disabled: !saidaValida,
      'aria-invalid': erroDaLista !== undefined ? true : undefined,
      descricao: erroDaLista !== undefined ? <span className="dialogo-concluir__erro-mapeamento">{erroDaLista}</span> : undefined,
      onChange: (evento: ChangeEvent<HTMLSelectElement>) => escolherCampo(lista, evento.target.value),
    }
    if (lista === 'competencia') {
      // "Nenhum" é uma escolha válida (sem competência): opção comum, habilitada.
      return <Select {...comum} opcoes={[{ valor: '', rotulo: 'Nenhum' }, ...opcoesMapeamento]} />
    }
    return <Select {...comum} obrigatorio placeholder="Selecione o campo" opcoes={opcoesMapeamento} />
  }

  return (
    <Dialogo
      aberto
      titulo={textos.titulo}
      onFechar={onCancelar}
      className="dialogo--largo dialogo-concluir-construcao"
      acoes={
        <div className="dialogo-concluir__rodape">
          <p id={idFalta} className={completo ? 'dialogo-concluir__falta dialogo-concluir__falta--ok' : 'dialogo-concluir__falta'}>
            {textoFalta}
          </p>
          <div className="dialogo-concluir__botoes">
            <Botao variante="contorno" onClick={onCancelar}>
              Cancelar
            </Botao>
            <Botao type="submit" form={idFormulario} disabled={!completo || concluindo} aria-describedby={idFalta}>
              {textos.botao}
            </Botao>
          </div>
        </div>
      }
    >
      <form id={idFormulario} className="dialogo-concluir" onSubmit={enviar} noValidate>
        <p className="dialogo-concluir__texto">
          {configurar
            ? `Revise a integração ${tipoAlvo === 'indicador' ? 'do indicador' : 'do dado externo'} ${dado.nome} e salve as configurações.`
            : `Registre a integração criada pela TI para o dado externo ${dado.nome} e conclua a construção.`}
        </p>
        {erro || errosGerais.length > 0 ? (
          <Aviso tipo="erro">
            {erro ? <p className="dialogo-concluir__erro-geral">{erro}</p> : null}
            {errosGerais.length > 0 ? (
              <ul className="dialogo-concluir__erros">
                {errosGerais.map((texto, indice) => (
                  <li key={indice}>{texto}</li>
                ))}
              </ul>
            ) : null}
          </Aviso>
        ) : null}
        {saidaSalvaAntiga && !saidaValida ? (
          <Aviso tipo="alerta">
            <p>{AVISO_FORMATO_ANTIGO}</p>
          </Aviso>
        ) : null}

        <div className="dialogo-concluir__grade">
          <div className="dialogo-concluir__identificador">
            <Campo
              rotulo="Identificador da consulta"
              obrigatorio
              value={identificador}
              maxLength={TAMANHO_MAXIMO_IDENTIFICADOR}
              autoComplete="off"
              erro={juntarErros(identificadorLongo ? MENSAGEM_LIMITE_IDENTIFICADOR : undefined, erroDaApi('identificador'))}
              onChange={(evento) => alterarIdentificador(evento.target.value)}
            />
            <SugestoesIdentificador
              identificadores={identificadores}
              filtro={identificador}
              onEscolher={alterarIdentificador}
            />
          </div>
          <Campo
            rotulo="URL"
            obrigatorio
            type="url"
            inputMode="url"
            value={url}
            maxLength={TAMANHO_MAXIMO_URL}
            autoComplete="off"
            placeholder="https://"
            erro={juntarErros(urlLonga ? MENSAGEM_LIMITE_URL : undefined, erroDaApi('url'))}
            onChange={(evento) => alterarUrl(evento.target.value)}
          />
        </div>

        <div className="dialogo-concluir__grade">
          <section className="dialogo-concluir__bloco">
            <AreaTexto
              rotulo="Parâmetros de saída"
              obrigatorio
              className="dialogo-concluir__json"
              rows={9}
              spellCheck={false}
              value={saida}
              erro={erroDaApi('saida')}
              onChange={(evento) => alterarSaida(evento.target.value)}
            />
            <p className="dialogo-concluir__orientacao">{ORIENTACAO_SAIDA}</p>
            <Botao variante="contorno" tamanho="pequeno" className="dialogo-concluir__modelo" onClick={inserirModeloSaida}>
              Inserir modelo de saída
            </Botao>
            <ValidacaoSaida resultado={resultadoSaida} />
            <div className="dialogo-concluir__mapeamento">
              {listaMapeamento('filial')}
              {listaMapeamento('valor')}
              {listaMapeamento('competencia')}
            </div>
          </section>

          <section className="dialogo-concluir__bloco">
            <AreaTexto
              ref={entradaRef}
              rotulo="Parâmetros de entrada"
              obrigatorio
              className="dialogo-concluir__json"
              rows={9}
              spellCheck={false}
              value={entrada}
              erro={erroDaApi('entrada')}
              onChange={(evento) => {
                guardarSelecaoEntrada(evento)
                alterarEntrada(evento.target.value)
              }}
              onFocus={guardarSelecaoEntrada}
              onSelect={guardarSelecaoEntrada}
              onKeyUp={guardarSelecaoEntrada}
              onMouseUp={guardarSelecaoEntrada}
            />
            <Botao variante="contorno" tamanho="pequeno" className="dialogo-concluir__modelo" onClick={inserirModeloEntrada}>
              Inserir modelo de entrada
            </Botao>
            <ValidacaoEntrada resultado={resultadoEntrada} />
            <PainelVariaveis
              variaveis={variaveisConhecidas}
              carregando={carregandoVariaveis}
              erro={erroVariaveis}
              usadas={variaveisNaEntrada}
              onInserir={inserirNaEntrada}
            />
          </section>
        </div>
      </form>
    </Dialogo>
  )
}
