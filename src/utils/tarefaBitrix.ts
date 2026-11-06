/**
 * Regra comum de exibição da tarefa do Bitrix24 (FRONT-tarefas-bitrix.md).
 *
 * A tarefa é criada pelo back-end; o front só mostra o resultado. Uma tarefa existente está
 * "aguardando envio" quando ainda não tem número (`id === null`) ou quando o status é
 * `aguardando_envio`; nesse caso aparece o rótulo `ROTULO_AGUARDANDO_ENVIO` no lugar do número.
 * Sem tarefa, nada é exibido. Não há link para o Bitrix24.
 */

/** Rótulo exibido no lugar do número enquanto a tarefa não foi enviada ao Bitrix24. */
export const ROTULO_AGUARDANDO_ENVIO = 'Aguardando envio ao Bitrix'

/** Status da tarefa registrada mas ainda na fila de envio ao Bitrix24. */
export const STATUS_AGUARDANDO_ENVIO = 'aguardando_envio'

/** Formato mínimo de tarefa usado pela regra (listagem, gravação, tarefas do dashboard). */
export interface TarefaExibivel {
  id: number | null
  status?: string | null
}

/** `true` quando a tarefa existe e ainda não foi enviada (`id` nulo ou status `aguardando_envio`). */
export function tarefaAguardandoEnvio(tarefa: TarefaExibivel): boolean {
  return tarefa.id === null || tarefa.status === STATUS_AGUARDANDO_ENVIO
}

/** Número da tarefa já enviada ao Bitrix24; `null` sem tarefa ou quando ela aguarda envio. */
export function numeroTarefaEnviada(tarefa: TarefaExibivel | null | undefined): number | null {
  if (!tarefa || tarefaAguardandoEnvio(tarefa)) return null
  return tarefa.id
}

/**
 * Texto da tarefa: `null` sem tarefa; o rótulo de aguardando envio quando ela ainda não foi enviada;
 * senão o número com o prefixo informado (ex.: `#31` com `'#'`, `Tarefa #31` com `'Tarefa #'`).
 */
export function textoTarefaBitrix(tarefa: TarefaExibivel | null | undefined, prefixo = '#'): string | null {
  if (!tarefa) return null
  const numero = numeroTarefaEnviada(tarefa)
  return numero === null ? ROTULO_AGUARDANDO_ENVIO : `${prefixo}${numero}`
}

/**
 * Frase de confirmação da tarefa criada pelo back-end ao gravar (FRONT-tarefas-bitrix.md, seção 2):
 * com número e status diferente de `aguardando_envio`, "Tarefa #{id} criada no Bitrix para a equipe de
 * TI."; nos demais casos (sem número, na fila ou sem tarefa na resposta), "A tarefa para a TI será
 * criada no Bitrix em instantes.". Quem chama acrescenta o prefixo do contexto (ex.: "Dashboard
 * cadastrado.").
 */
export function fraseTarefaGravada(tarefa: TarefaExibivel | null | undefined): string {
  const numero = numeroTarefaEnviada(tarefa)
  return numero === null
    ? 'A tarefa para a TI será criada no Bitrix em instantes.'
    : `Tarefa #${numero} criada no Bitrix para a equipe de TI.`
}
