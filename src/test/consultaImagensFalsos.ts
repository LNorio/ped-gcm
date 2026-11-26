/**
 * Apoio aos testes da consulta retroativa de imagens (F10.6 — RF-84, RN-18).
 *
 * Usa as imagens gravadas de `fechamentosFalsos.ts` (que não deve ser alterado):
 * - (1) IMG-000001 · PED Comercial · 3º tri/2026 · filial 100 MATRIZ (`tipo: filial`) · Ana Costa · PED 99,99;
 * - (2) IMG-000002 · PED Comercial · 3º tri/2026 · filial 101 CAMPO GRANDE (`tipo: filial`) · Ana Costa · PED 0;
 * - (3) IMG-000003 · PED Gerentes · 10/2026 · Ana Souza (Gerente de Loja), filial 100 (`tipo: colaborador`) · admin · PED 20;
 * - (4) IMG-000004 · PED Gerentes · 10/2026 · Diego Rocha (Gerente de Loja), filial 102 (`tipo: colaborador`) · admin · PED 16.
 * A API devolve as mais recentes primeiro: 4, 3, 2, 1 (períodos na ordem em que aparecem: 10/2026, 3º tri/2026).
 *
 * A linha mínima do contrato (`imagemDaListaApi`) não traz "nome filial" nem cargo. RF-84 pede
 * colaborador **e cargo**; o serviço (F10.1) também aceita a filial como `{ filial, "nome filial" }` e o
 * colaborador como `{ "id colaborador", nome, cargo }`. `imagemDaListaCompletaApi` monta a linha nesse
 * formato, para os testes que conferem cargo e nome da filial; a linha mínima continua testada à parte.
 */
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'
import {
  criarApiFechamentosFalsa,
  filtrarImagensApi,
  imagemDaListaApi,
  type ImagemApiFalsa,
  type OpcoesApiFechamentosFalsa,
} from './fechamentosFalsos'

/** Título da seção da consulta, dentro da aba Fechamentos (como no protótipo). */
export const TITULO_CONSULTA_IMAGENS = 'Imagens congeladas — consulta retroativa'

/** Nome acessível da tabela da consulta. */
export const LEGENDA_TABELA_IMAGENS = 'Imagens congeladas'

/** Cabeçalhos da tabela da consulta, na ordem. */
export const COLUNAS_CONSULTA_IMAGENS = ['Dashboard', 'Colaborador', 'Tipo', 'Período', 'Filial', 'Gerada em', 'Por', 'PED', 'Ação']

/** Texto exibido no lugar do colaborador nas imagens de filial (RF-83). */
export const TEXTO_FILIAL_SEM_COLABORADOR = 'Filial (sem colaborador vinculado)'

export const TEXTO_SEM_IMAGENS = 'Nenhuma imagem congelada encontrada.'
export const TEXTO_SEM_IMAGENS_FILTRO = 'Nenhuma imagem encontrada com os filtros selecionados.'

/** Rótulo do botão de visualização de uma imagem. */
export const rotuloVisualizarImagem = (codigo: string) => `Visualizar imagem ${codigo}`

/** Título do diálogo que mostra uma imagem. */
export const tituloDialogoImagem = (codigo: string) => `Imagem congelada ${codigo}`

/** Linha de `GET /api/ped/imagens` com filial `{ filial, "nome filial" }` e colaborador `{ "id colaborador", nome, cargo }`. */
export function imagemDaListaCompletaApi(imagem: ImagemApiFalsa): Record<string, unknown> {
  return {
    ...imagemDaListaApi(imagem),
    filial: { ...imagem.unidade.filial },
    colaborador: imagem.unidade.colaborador ? { ...imagem.unidade.colaborador } : null,
  }
}

/**
 * Linha de `GET /api/ped/imagens` no formato do Swagger de 25/11/2026 (l. 5119–5148; resposta do back-end
 * de 25/11/2026, `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seção 5, item 7):
 * `filial` na raiz é o **código** (texto) e `colaborador` na raiz é o **nome** (texto); o detalhado vem em
 * `unidade { tipo, filial { codigo, nome }, colaborador { id, nome, cargo } | null }`.
 */
export function imagemDaListaComUnidadeApi(imagem: ImagemApiFalsa): Record<string, unknown> {
  const colaborador = imagem.unidade.colaborador
  return {
    ...imagemDaListaApi(imagem),
    unidade: {
      tipo: imagem.unidade.tipo,
      filial: { codigo: imagem.unidade.filial.filial, nome: imagem.unidade.filial['nome filial'] },
      colaborador: colaborador ? { id: colaborador['id colaborador'], nome: colaborador.nome, cargo: colaborador.cargo } : null,
    },
  }
}

/**
 * Linha de uma imagem **antiga** (congelada antes do bloco `unidade`): o back-end devolve `unidade` com o
 * `tipo` e o código da filial da própria imagem, `filial.nome` nulo e `colaborador` nulo (mesmo em imagem
 * de colaborador). Na raiz, `filial` (código) e `colaborador` (nome) continuam.
 */
export function imagemDaListaAntigaApi(imagem: ImagemApiFalsa): Record<string, unknown> {
  return {
    ...imagemDaListaApi(imagem),
    unidade: { tipo: imagem.unidade.tipo, filial: { codigo: imagem.unidade.filial.filial, nome: null }, colaborador: null },
  }
}

export interface OpcoesApiConsultaImagensFalsa extends OpcoesApiFechamentosFalsa {
  /** `true` (padrão): linhas completas (`imagemDaListaCompletaApi`); `false`: linha mínima do contrato. */
  linhasCompletas?: boolean
  /**
   * Formato do Swagger de 25/11/2026 (prevalece sobre `linhasCompletas`): `'unidade'` =
   * `imagemDaListaComUnidadeApi`; `'antiga'` = `imagemDaListaAntigaApi`.
   */
  formatoUnidade?: 'unidade' | 'antiga'
}

/**
 * Back-end falso da aba Fechamentos (`criarApiFechamentosFalsa`) com a consulta de imagens
 * (`GET /api/ped/imagens`, filtros de `filtrarImagensApi`, mais recentes primeiro) devolvendo as linhas
 * completas. O detalhe (`GET /api/ped/imagens/{id}`) e as demais rotas são os de `criarApiFechamentosFalsa`.
 */
export function criarApiConsultaImagensFalsa(opcoes: OpcoesApiConsultaImagensFalsa = {}) {
  const { linhasCompletas = true, formatoUnidade, ...demais } = opcoes
  const api = criarApiFechamentosFalsa(demais)
  const linha =
    formatoUnidade === 'unidade'
      ? imagemDaListaComUnidadeApi
      : formatoUnidade === 'antiga'
        ? imagemDaListaAntigaApi
        : linhasCompletas
          ? imagemDaListaCompletaApi
          : imagemDaListaApi
  // Altera o próprio objeto de rotas: as imagens geradas por um encerramento continuam com o detalhe.
  const rota: RotaFalsa = (_init, url) => respostaJson(filtrarImagensApi([...api.imagens()].reverse(), url).map(linha))
  api.rotas['GET /api/ped/imagens'] = rota
  return api
}

/** Promessa controlada pelo teste (para simular respostas lentas). */
export function adiado<T>() {
  let resolver!: (valor: T) => void
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}
