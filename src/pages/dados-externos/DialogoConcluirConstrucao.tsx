/**
 * Modal da integração de um dado externo pelo Admin, em dois modos:
 * - `concluir` (padrão — F5.7, RF-28): "Concluir construção" de um dado em construção, com os campos
 *   vazios e o botão "Concluir e ativar";
 * - `configurar` (F5.16): "Configurações da integração" de um dado ativo/inativo, com os campos
 *   preenchidos pelos valores salvos (identificador, URL e `JSON.stringify(parametros, null, 2)` — `null`
 *   vira vazio) e o botão "Salvar configurações".
 *
 * - `leitura` (F5.19): "Integração do dado externo", só para consulta (fonte da meta `dado_externo` na
 *   aba Indicadores): os quatro campos com os valores salvos, `readOnly` e sem obrigatoriedade, sem
 *   modelos, variáveis, operadores, sugestões, validação (local ou no servidor) nem "falta: ...", e só o
 *   botão "Fechar" (Fechar e Esc chamam `onCancelar`). As demais props são opcionais e ignoradas.
 *
 * Também serve à integração da meta do indicador (F6.11, `tipoAlvo: 'indicador'`, modo `configurar`):
 * `dado` é um `AlvoIntegracao` (o `DadoExterno` é compatível). `tipoAlvo` muda o texto da modal, a
 * `finalidade` da validação no servidor (`valor` no dado externo, `meta` no indicador). "Inserir modelo
 * de saída" usa o mesmo modelo genérico (`MODELO_JSON_SAIDA`) para os dois (contrato final, 11/11/2026 —
 * `docs/backend/FRONT-saida-chave-tipo (1).md`: a saída é só referência e os nomes são livres). Sem janela retroativa nem dia da coleta, os valores de exemplo usam só `hoje`.
 *
 * Saída por "chave: tipo" (11/11/2026, opção B — `docs/propostas-backend/FRONT-saida-chave-tipo.md`): a
 * saída descreve um item da resposta como `{ "campo": "tipo" }` (`string`, `number`, `date`, `boolean`) e
 * um texto abaixo dela orienta o formato. A lista (formato antigo) é inválida: uma integração salva em
 * lista abre com um aviso e o salvar bloqueado até a saída ser reescrita no formato novo.
 *
 * Saída sem mapeamento (11/11/2026 — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`): os
 * parâmetros de saída servem só para mostrar ao back-end a saída esperada do web service. Não há listas de
 * mapeamento (filial, valor/meta, competência) e a saída é validada **só no front** (`validarSaida`).
 *
 * Com `dado` nulo, nada é renderizado. O Admin informa, todos obrigatórios e nesta ordem:
 * - o identificador da consulta (com sugestões dos existentes): ao digitar, colar ou escolher uma
 *   sugestão, o texto passa por `limparIdentificador` (só A–Z, 0–9, "_", "-" e ".", em maiúsculas);
 * - a URL da integração (`http://` ou `https://`, sem espaços);
 * - os parâmetros de saída (JSON) e os de entrada (JSON com variáveis `%nome%` e contas).
 *
 * Validação dos JSONs (F5.14, F5.18): o motor de `src/utils/integracao` mostra o resultado na hora, com os
 * valores de exemplo calculados a partir de `hoje` e do dado (janela retroativa e dia da coleta) — o
 * `exemplo` de cada variável da API prevalece. A saída fica só no motor local. Com `validarNoServidor`,
 * 400 ms (`ATRASO_VALIDACAO_SERVIDOR_MS`) depois da última mudança na entrada o back-end também a valida,
 * e o seu resultado vale enquanto o texto da entrada for o enviado (ver `useValidacaoServidor`).
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
 * `formatarErroIntegracao`; erro sem campo ou com campo desconhecido (inclusive os antigos `campo da ...`
 * do mapeamento) entra na lista do alerta geral. O erro de um campo some quando o usuário altera aquele
 * campo (digitação, sugestão, modelo, variável/operador); os demais e o alerta geral
 * ficam. Uma nova lista `errosCampos` (outra referência, ou seja, um novo 400) volta a mostrar todos.
 */
import { type FormEvent, useId, useMemo, useState } from 'react'
import { AreaTexto } from '../../components/AreaTexto'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import type { ErroIntegracao, IdentificadorColeta, JanelaRetroativa, VariavelIntegracao } from '../../types/dominio'
import { limparIdentificador } from '../../utils/identificador'
import { validarEntrada } from '../../utils/integracao/entrada'
import { formatarErroIntegracao } from '../../utils/integracao/erros'
import { valoresDeExemplo } from '../../utils/integracao/exemplos'
import { type ContextoIntegracao, variaveisDoTexto } from '../../utils/integracao/expressoes'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'
import { type CampoValorSaida, validarSaida } from '../../utils/integracao/saida'
import { TAMANHO_MAXIMO_URL, urlValida } from '../../utils/integracao/url'
import { PainelVariaveis } from './PainelVariaveis'
import { SugestoesIdentificador } from './SugestoesIdentificador'
import { useInsercaoNoCursor } from './useInsercaoNoCursor'
import { useValidacaoServidor, type ValidarNoServidor } from './useValidacaoServidor'
import { ValidacaoEntrada, ValidacaoSaida } from './ValidacaoIntegracao'
import './DialogoConcluirConstrucao.css'

/** Espera entre a última mudança na entrada e a validação no back-end (F5.18). */
export const ATRASO_VALIDACAO_SERVIDOR_MS = 400

/** Tamanho máximo do identificador (limpo) aceito pelo back-end. */
export const TAMANHO_MAXIMO_IDENTIFICADOR = 60

const MENSAGEM_LIMITE_IDENTIFICADOR = `O identificador aceita até ${TAMANHO_MAXIMO_IDENTIFICADOR} caracteres.`
const MENSAGEM_LIMITE_URL = `A URL aceita até ${TAMANHO_MAXIMO_URL} caracteres.`
const ORIENTACAO_SAIDA =
  'Descreva um item da resposta do web service com o tipo de cada campo. É só referência para a equipe de desenvolvimento; os nomes são livres.'
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

/** De quem é a integração (F6.11): muda o texto da modal e a `finalidade`. */
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
}

export interface DialogoConcluirConstrucaoProps {
  /** Padrão `concluir`. */
  modo?: ModoEdicaoIntegracao
  /** Dono da integração (dado externo ou indicador — F6.11); `null` mantém a modal fechada. */
  dado: AlvoIntegracao | null
  /** De quem é a integração; muda o texto e a `finalidade`. Padrão `dado-externo`. */
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

/** Campo de valor da integração (`finalidade`), conforme o dono da integração. */
const CAMPO_VALOR_POR_ALVO: Readonly<Record<TipoAlvoIntegracao, CampoValorSaida>> = {
  'dado-externo': 'valor',
  indicador: 'meta',
}

type CampoModal = 'identificador' | 'url' | 'saida' | 'entrada'

/** Nome do campo nos erros da API → campo da modal. */
const CAMPOS_DA_API: ReadonlyMap<string, CampoModal> = new Map<string, CampoModal>([
  ['identificador', 'identificador'],
  ['url', 'url'],
  ['parametros de saida', 'saida'],
  ['parametros de entrada', 'entrada'],
])

const SEM_ERROS: ErroIntegracao[] = []

/** Erros da API agrupados pelo campo da modal; os sem campo conhecido vão para `gerais`. */
function agruparErros(erros: ErroIntegracao[]) {
  const porCampo: Partial<Record<CampoModal, string>> = {}
  const gerais: string[] = []
  for (const erro of erros) {
    const texto = formatarErroIntegracao(erro)
    const campo = erro.campo === null ? undefined : CAMPOS_DA_API.get(erro.campo)
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

export function DialogoConcluirConstrucao(props: DialogoConcluirConstrucaoProps | DialogoIntegracaoLeituraProps) {
  if (props.dado === null) return null
  if (props.modo === 'leitura') return <ConteudoLeitura dado={props.dado} onCancelar={props.onCancelar} />
  const modo = props.modo ?? 'concluir'
  // `key` reinicia os campos ao abrir a modal para outro dado ou em outro modo.
  return <ConteudoDialogo key={`${modo}-${props.dado.id}`} {...props} modo={modo} dado={props.dado} />
}

/** Modo leitura (F5.19): os valores salvos da integração do dado externo, sem edição nem validação. */
function ConteudoLeitura({ dado, onCancelar }: { dado: AlvoIntegracao; onCancelar: () => void }) {
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
  const entradaServidor = useValidacaoServidor({
    entrada,
    finalidade: campoValor,
    validar: validarNoServidor,
    atrasoMs: ATRASO_VALIDACAO_SERVIDOR_MS,
  })
  // A saída é validada só no front; a entrada usa o resultado do back-end para o texto atual, senão o local.
  const resultadoSaida = saidaLocal
  const resultadoEntrada = entradaServidor ?? entradaLocal
  const saidaValida = resultadoSaida.estado === 'valido'

  const identificadorLimpo = limparIdentificador(identificador)
  const identificadorLongo = identificadorLimpo.length > TAMANHO_MAXIMO_IDENTIFICADOR
  const urlLonga = url.trim().length > TAMANHO_MAXIMO_URL
  const falta: string[] = []
  if (identificadorLimpo === '' || identificadorLongo) falta.push('identificador')
  if (!urlValida(url)) falta.push('URL válida')
  if (!saidaValida) falta.push('JSON de saída válido')
  if (resultadoEntrada.estado !== 'valido') falta.push('JSON de entrada válido')
  const completo = falta.length === 0
  const textoFalta = completo ? 'Todos os campos obrigatórios preenchidos' : `falta: ${falta.join(', ')}`
  // Destaque das variáveis presentes na entrada, mesmo com o JSON ainda inválido.
  const variaveisNaEntrada = useMemo(() => new Set(variaveisDoTexto(entrada)), [entrada])
  const { porCampo: errosDaApi, gerais: errosGerais } = useMemo(() => agruparErros(errosCampos), [errosCampos])
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

  // Inserção no cursor da entrada (variáveis e operadores).
  const {
    ref: entradaRef,
    guardarSelecao: guardarSelecaoEntrada,
    inserir: inserirNaEntrada,
    reiniciar: reiniciarCursorEntrada,
  } = useInsercaoNoCursor(entrada, alterarEntrada)

  function inserirModeloSaida() {
    alterarSaida(MODELO_JSON_SAIDA)
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
      variaveisUsadas: resultadoEntrada.variaveisUsadas,
    })
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
