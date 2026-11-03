/**
 * Serviço de autenticação (RF-03, RF-04, INT-01).
 *
 * - `entrar`: valida usuário e senha em `POST /valida-usuario` e guarda o token na sessão.
 * - `obterAcesso`: lê o acesso do usuário logado em `GET /ped/acesso` (perfil, tipos, filiais).
 *
 * A senha é usada apenas no corpo da requisição de login; nunca é armazenada nem registrada em log.
 */

import { type AcessoApi, paraAcesso } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'
import { definirToken } from './sessao'
import type { Acesso } from '../types/dominio'

interface RespostaLogin {
  token?: unknown
}

/**
 * Autentica o usuário e guarda o token devolvido na sessão (memória e `sessionStorage`).
 * Rejeita com `ApiError` em credenciais inválidas (401), falha de rede (status 0) ou resposta sem
 * o campo `token`; nesses casos nenhum token é guardado.
 */
export async function entrar(usuario: string, senha: string): Promise<string> {
  const resposta = await apiFetch<RespostaLogin | undefined>('/valida-usuario', {
    method: 'POST',
    body: { usuario, senha },
  })

  const token = resposta?.token
  if (typeof token !== 'string' || token === '') {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA, resposta)
  }

  definirToken(token)
  return token
}

/**
 * Obtém o acesso do usuário da sessão atual, já convertido para o tipo do domínio.
 * Usuário sem acesso ao PED volta com `perfil === null` (não é erro). Token recusado rejeita com
 * `ApiError` 401 e o cliente HTTP dispara `EVENTO_SESSAO_EXPIRADA`.
 */
export async function obterAcesso(): Promise<Acesso> {
  const resposta = await apiFetch<AcessoApi | undefined>('/ped/acesso')
  if (!resposta || typeof resposta !== 'object') {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA, resposta)
  }
  return paraAcesso(resposta)
}
