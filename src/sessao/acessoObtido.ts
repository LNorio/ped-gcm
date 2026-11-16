/**
 * Aviso de "acesso obtido" (desempenho da primeira abertura).
 *
 * O `SessaoProvider` avisa aqui, **antes** de aplicar o novo estado, que o acesso do usuário chegou.
 * Assim, quem precisa dos dados da tela que vai abrir (ex.: o Início) pode disparar as consultas no
 * mesmo instante, em paralelo com a renderização do layout, em vez de esperar a página montar e rodar
 * os efeitos. A sessão não conhece as telas: só avisa quem estiver ouvindo.
 *
 * Um ouvinte com falha nunca derruba a sessão (o erro é ignorado; a tela consulta normalmente ao montar).
 */
import type { Acesso } from '../types/dominio'
import type { FilialSelecionada } from './SessaoProvider'

export interface AcessoObtido {
  acesso: Acesso
  /** Filial que a sessão vai selecionar com esse acesso. */
  filialSelecionada: FilialSelecionada
}

export type OuvinteAcessoObtido = (obtido: AcessoObtido) => void

const ouvintes = new Set<OuvinteAcessoObtido>()

/** Passa a ouvir o aviso; devolve a função que para de ouvir. */
export function ouvirAcessoObtido(ouvinte: OuvinteAcessoObtido): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Avisa os ouvintes atuais (usado pelo `SessaoProvider`). */
export function avisarAcessoObtido(obtido: AcessoObtido): void {
  for (const ouvinte of [...ouvintes]) {
    try {
      ouvinte(obtido)
    } catch {
      // A pré-consulta é só uma antecipação: a tela consulta de novo ao montar.
    }
  }
}
