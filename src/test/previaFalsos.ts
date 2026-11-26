/**
 * Auxiliares dos testes da pré-visualização e do encerramento (F10.4, F10.5 e F10.7), complementares a
 * `fechamentosFalsos.ts` (que não deve ser alterado).
 *
 * - `rotuloAcoesFechamento(nome)`: rótulo do gatilho do `MenuAcoes` de cada linha da tabela de
 *   fechamentos (F10.2, "Ações do dashboard {nome}"), com os itens "Pré-visualizar imagens" e "Encerrar
 *   período" nas linhas em aberto;
 * - `previaGerentesComEquipeApi()`: prévia do PED Gerentes (dashboard 2, vínculo por cargos, 11/2026)
 *   com **três** colaboradores na filial 100 MATRIZ — Ana Souza (Gerente de Loja, PED 20, pontuação
 *   150), Bruno Lima (Subgerente, PED 35,5, pontuação 266,25) e Márcia Lopes (Gerente de Loja, PED 12,
 *   pontuação 90) — e Diego Rocha (Gerente de Loja, filial 102 DOURADOS, sem tabela de faixas, PED 16),
 *   nessa ordem (4 imagens a gerar). Serve para a busca de colaborador por nome ou cargo e para a
 *   navegação entre filiais;
 * - `carregarPreviaDominio(fetchFalso, previaApi, id)`: converte uma prévia da API para o domínio pelo
 *   próprio serviço (`obterPreviaFechamento`), para os testes que passam a prévia como prop;
 * - `carregarFechamentoDominio(fechamentoApi)`: idem para a linha do fechamento (`paraFechamento`);
 * - `AVISO_DRG_API`, `progressoPorFilialComercialApi()` e `previaComercialComResumoRealApi()`: formato da
 *   prévia depois do deploy de 24/11/2026 (resposta do back-end de 25/11/2026,
 *   `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seções 2 e 4): `resumo."progresso por
 *   filial"` e o aviso único do DRG em `resumo.avisos`, repetido em `imagens[].avisos`.
 */
import { paraFechamento } from '../services/adaptadores'
import { obterPreviaFechamento } from '../services/fechamentosService'
import type { Fechamento, PreviaFechamento } from '../types/dominio'
import { respostaJson, simularApi, type FetchFalso } from './apiFalsa'
import {
  previaComercialApi,
  previaGerentesApi,
  type FechamentoApiFalso,
  type ImagemPreviaApiFalsa,
  type PreviaFechamentoApiFalsa,
  type ResumoFechamentoApiFalso,
} from './fechamentosFalsos'
import { rotuloAcoesDashboard } from './menuAcoes'

/**
 * Rótulo do gatilho do menu de ações de uma linha da tabela de fechamentos (F10.2: "Ações do dashboard
 * {nome}", o mesmo rótulo do menu da aba Dashboards).
 */
export const rotuloAcoesFechamento = rotuloAcoesDashboard

/** Itens do menu de ações de um fechamento com o período em aberto. */
export const ITEM_PRE_VISUALIZAR = 'Pré-visualizar imagens'
export const ITEM_ENCERRAR = 'Encerrar período'

function colaboradorDaFilial100(
  base: ImagemPreviaApiFalsa,
  id: number,
  nome: string,
  cargo: string,
  ped: number,
  pontuacao: number,
): ImagemPreviaApiFalsa {
  const imagem = structuredClone(base)
  imagem.chave = `colaborador:${id}`
  imagem['id colaborador'] = id
  imagem.unidade.colaborador = { 'id colaborador': id, nome, cargo }
  imagem['ped percentual'] = ped
  if (imagem.pontuacao.calculada) imagem.pontuacao.valor = pontuacao
  return imagem
}

/** Prévia do PED Gerentes com Ana, Bruno e Márcia na filial 100 e Diego na 102 (4 imagens). */
export function previaGerentesComEquipeApi(): PreviaFechamentoApiFalsa {
  const previa = previaGerentesApi()
  const [ana, diego] = previa.imagens
  return {
    ...previa,
    resumo: { ...previa.resumo, 'imagens a gerar': 4 },
    imagens: [
      ana,
      colaboradorDaFilial100(ana, 15, 'Bruno Lima', 'Subgerente', 35.5, 266.25),
      colaboradorDaFilial100(ana, 16, 'Márcia Lopes', 'Gerente de Loja', 12, 90),
      diego,
    ],
  }
}

/** Converte a prévia da API para o domínio pelo serviço (simula só o `GET .../previa`). */
export async function carregarPreviaDominio(
  fetchFalso: FetchFalso,
  previaApi: PreviaFechamentoApiFalsa,
  id: number,
): Promise<PreviaFechamento> {
  simularApi(fetchFalso, { [`GET /api/ped/fechamentos/${id}/previa`]: () => respostaJson(previaApi) })
  const previa = await obterPreviaFechamento(id)
  fetchFalso.mockReset()
  return previa
}

/** Linha do fechamento no formato do domínio. */
export function carregarFechamentoDominio(fechamentoApi: FechamentoApiFalso): Fechamento {
  return paraFechamento(fechamentoApi)
}

/**
 * Aviso geral do DRG, como o back-end o envia (constante única, sem acentos): uma vez em `resumo.avisos`
 * da prévia e também em cada `imagens[].avisos` (o PDF o imprime e as imagens congeladas o guardam).
 */
export const AVISO_DRG_API = 'Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada.'

/** Outro aviso de imagem (não geral), que continua só na imagem. */
export const AVISO_LANCAMENTOS_PENDENTES_IMAGEM_API = '7 lancamento(s) pendente(s) no periodo: congelados sem valor.'

/** Item de `resumo."progresso por filial"` (Swagger de 25/11/2026, `ResumoFechamento`; só na prévia). */
export interface ProgressoDaFilialApiFalso {
  filial: string | number
  'nome filial'?: string | null
  preenchidos: number
  total: number
}

/** Resumo da prévia com os campos de 24/11/2026 (`"progresso por filial"`). */
export type ResumoPreviaApiFalso = ResumoFechamentoApiFalso & { 'progresso por filial'?: unknown }

/** Prévia com o resumo de 24/11/2026. */
export type PreviaComResumoRealApiFalsa = Omit<PreviaFechamentoApiFalsa, 'resumo'> & { resumo: ResumoPreviaApiFalso }

/**
 * Progresso por filial do PED Comercial no 4º tri/2026 (unidades ainda abertas, em ordem de código):
 * 101 CAMPO GRANDE com 3 de 3 e 102 DOURADOS com 2 de 3 (soma 5 de 6, o progresso do fechamento).
 */
export function progressoPorFilialComercialApi(): ProgressoDaFilialApiFalso[] {
  return [
    { filial: '101', 'nome filial': 'CAMPO GRANDE', preenchidos: 3, total: 3 },
    { filial: '102', 'nome filial': 'DOURADOS', preenchidos: 2, total: 3 },
  ]
}

/**
 * Prévia do PED Comercial (dashboard 1) no formato de 24/11/2026: `resumo.avisos` só com o aviso do DRG,
 * `resumo."progresso por filial"` (`progressoPorFilialComercialApi()`, ou o informado) e o aviso do DRG
 * repetido nas duas imagens; a 102 tem também o aviso de pendências da própria imagem.
 */
export function previaComercialComResumoRealApi(progresso: unknown = progressoPorFilialComercialApi()): PreviaComResumoRealApiFalsa {
  const previa = previaComercialApi()
  const [filial101, filial102] = previa.imagens
  return {
    ...previa,
    resumo: { ...previa.resumo, avisos: [AVISO_DRG_API], 'progresso por filial': progresso },
    imagens: [
      { ...filial101, avisos: [...filial101.avisos, AVISO_DRG_API] },
      { ...filial102, avisos: [...filial102.avisos, AVISO_DRG_API, AVISO_LANCAMENTOS_PENDENTES_IMAGEM_API] },
    ],
  }
}
