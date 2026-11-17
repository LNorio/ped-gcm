/**
 * Apoio aos testes das imagens em PDF e da exportação (F10.10 — RF-80, RF-83, RF-84), contrato proposto
 * em `docs/backend/PROPOSTA-pdf-imagens.md` (rotas ainda inexistentes no back-end; só `fetch` é simulado):
 * - `GET /api/ped/fechamentos/{id}/previa/pdf?chave={chave}` → `application/pdf` (uma imagem da prévia);
 * - `GET /api/ped/fechamentos/{id}/previa/zip` → `application/zip` (um PDF por imagem da prévia);
 * - `GET /api/ped/imagens/{id}/pdf` → `application/pdf` (uma imagem congelada);
 * - `GET /api/ped/imagens/zip?filial=&periodo=&dashboard=&tipo=&id_colaborador=&busca=` → `application/zip`.
 * Sucesso com `Content-Disposition: inline; filename="..."`; erro em JSON `{ mensagem }`.
 *
 * - `respostaArquivo`: resposta binária (texto como conteúdo) com `Content-Type` e, se houver nome,
 *   `Content-Disposition`;
 * - `simularUrlsDeObjeto`: substitui `URL.createObjectURL`/`URL.revokeObjectURL` e registra as URLs
 *   criadas (com o Blob) e as revogadas;
 * - `simularDownloads`: intercepta `HTMLAnchorElement.prototype.click` (download por `<a download>`) e
 *   registra o nome (`download`) e o endereço (`href`) de cada download;
 * - `adicionarRotasPdf(api)`: acrescenta as quatro rotas ao back-end falso de `criarApiFechamentosFalsa`
 *   (ou `criarApiConsultaImagensFalsa`), com os nomes de arquivo `nomePdfPrevia`, `nomeZipPrevia`,
 *   `nomePdfImagem` e `NOME_ZIP_IMAGENS`;
 * - textos da tela: `tituloPdf`, `TEXTO_GERANDO_PDF`, `ROTULO_EXPORTAR`, `ITEM_PDF_DESTA_IMAGEM` e
 *   `ITEM_ZIP_TODAS`;
 * - aviso da quantidade de imagens e da demora (alteração de 17/11/2026, ZIP sem limite de imagens):
 *   `TEXTO_DEMORA_IMAGENS`, `textoQuantidadeImagens`, `textoMontandoZip` e `avisoQuantidadeImagens`.
 */
import { vi } from 'vitest'
import type { ImagemDaConsulta } from '../types/dominio'
import { respostaErro, type RotaFalsa } from './apiFalsa'
import { filtrarImagensApi, type ImagemApiFalsa, type PreviaFechamentoApiFalsa } from './fechamentosFalsos'

/** Linha da consulta (domínio) da imagem 3 — IMG-000003, PED Gerentes, Ana Souza, filial 100. */
export const LINHA_IMAGEM_ANA: ImagemDaConsulta = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  tipo: 'colaborador',
  idColaborador: 11,
  idDashboard: 2,
  dashboard: 'PED Gerentes',
  periodo: '10/2026',
  filial: '100',
  nomeFilial: 'MATRIZ',
  colaborador: 'Ana Souza',
  cargo: 'Gerente de Loja',
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
  pedPercentual: 20,
  pontuacao: 150,
}

/** Linha da consulta (domínio) da imagem 1 — IMG-000001, PED Comercial, imagem de filial 100. */
export const LINHA_IMAGEM_COMERCIAL_100: ImagemDaConsulta = {
  ...LINHA_IMAGEM_ANA,
  id: 1,
  codigo: 'IMG-000001',
  lote: 'ENC-000001',
  tipo: 'filial',
  idColaborador: null,
  idDashboard: 1,
  dashboard: 'PED Comercial',
  periodo: '3º tri/2026',
  colaborador: null,
  cargo: null,
  geradoEm: '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
  pedPercentual: 99.99,
  pontuacao: 8839.12,
}

export const TIPO_PDF = 'application/pdf'
export const TIPO_ZIP = 'application/zip'

/** Texto anunciado enquanto o PDF da imagem é carregado. */
export const TEXTO_GERANDO_PDF = 'Gerando PDF…'

/** Botão que abre o menu de exportação (`role="menu"`). */
export const ROTULO_EXPORTAR = 'Exportar'
/** Item do menu que baixa o PDF da imagem exibida. */
export const ITEM_PDF_DESTA_IMAGEM = 'PDF desta imagem'
/** Item do menu que baixa o ZIP com um PDF por imagem. */
export const ITEM_ZIP_TODAS = 'Todas as imagens (ZIP)'

/**
 * Título acessível do PDF embutido (iframe/object): "PDF da imagem — Filial {código} · {colaborador}";
 * na imagem de filial (sem colaborador), "PDF da imagem — Filial {código}".
 */
export function tituloPdf(filial: string, colaborador?: string | null): string {
  return colaborador ? `PDF da imagem — Filial ${filial} · ${colaborador}` : `PDF da imagem — Filial ${filial}`
}

/** Endereço do PDF embutido: `src` (iframe) ou `data` (object). */
export function urlDoPdf(elemento: HTMLElement): string | null {
  return elemento.getAttribute('src') ?? elemento.getAttribute('data')
}

/** Resposta binária (conteúdo em texto) com `Content-Type` e, se houver nome, `Content-Disposition`. */
export function respostaArquivo(
  conteudo: string,
  tipo: string,
  nomeArquivo?: string | null,
  cabecalhoDisposicao?: string,
): Response {
  const headers: Record<string, string> = { 'Content-Type': tipo }
  const disposicao = cabecalhoDisposicao ?? (nomeArquivo ? `inline; filename="${nomeArquivo}"` : undefined)
  if (disposicao) headers['Content-Disposition'] = disposicao
  // Corpo em texto (o `Blob` do jsdom não é reconhecido pelo `Response` do Node); `response.blob()` usa o
  // `Content-Type` como tipo do Blob.
  return new Response(conteudo, { status: 200, headers })
}

export interface UrlCriada {
  url: string
  blob: Blob
}

/** Contador global: as URLs não se repetem entre testes (uma revogação atrasada de outro teste não confunde). */
let ultimaUrl = 0

/**
 * Substitui `URL.createObjectURL` (devolve `blob:teste/1`, `blob:teste/2`..., sem repetir) e `URL.revokeObjectURL`.
 * Restaurado por `vi.restoreAllMocks()`.
 */
export function simularUrlsDeObjeto() {
  const criadas: UrlCriada[] = []
  const revogadas: string[] = []
  const criar = vi.spyOn(URL, 'createObjectURL').mockImplementation((objeto: Blob | MediaSource) => {
    ultimaUrl += 1
    const url = `blob:teste/${ultimaUrl}`
    criadas.push({ url, blob: objeto as Blob })
    return url
  })
  const revogar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    revogadas.push(url)
  })
  return { criadas, revogadas, criar, revogar }
}

export interface DownloadRegistrado {
  /** Atributo `download` do link (nome do arquivo). */
  nome: string
  /** Endereço do link (URL de objeto). */
  href: string
}

/** Intercepta o clique em `<a>` (sem navegar) e registra os downloads (links com `download`). */
export function simularDownloads(): DownloadRegistrado[] {
  const downloads: DownloadRegistrado[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (this.hasAttribute('download')) downloads.push({ nome: this.getAttribute('download') ?? '', href: this.getAttribute('href') ?? '' })
  })
  return downloads
}

// ---------------------------------------------------------------------------
// Nomes de arquivo devolvidos pelo back-end falso (Content-Disposition)
// ---------------------------------------------------------------------------

/** Ex.: `PREVIA_1_filial-101.pdf`. */
export const nomePdfPrevia = (id: number, chave: string) => `PREVIA_${id}_${chave.replace(':', '-')}.pdf`
/** Ex.: `PREVIA_1.zip`. */
export const nomeZipPrevia = (id: number) => `PREVIA_${id}.zip`
/** Ex.: `IMG-000003_PED-Gerentes.pdf`. */
export const nomePdfImagem = (imagem: Pick<ImagemApiFalsa, 'codigo' | 'dashboard'>) =>
  `${imagem.codigo}_${imagem.dashboard.nome.replace(/\s+/g, '-')}.pdf`
export const NOME_ZIP_IMAGENS = 'IMAGENS_2026-11-17.zip'

/** Conteúdo do PDF de uma imagem da prévia (para identificar o arquivo nos testes). */
export const conteudoPdfPrevia = (id: number, chave: string) => `%PDF-1.4 previa ${id} ${chave}`
export const conteudoPdfImagem = (codigo: string) => `%PDF-1.4 ${codigo}`

/**
 * Mensagem do `429` das rotas de PDF e ZIP (limite por usuário: 20 PDFs/min, as duas rotas de PDF dividem o
 * contador; 5 ZIPs/min), `docs/backend/API (29).md`, "PDF do fechamento".
 */
export const MENSAGEM_LIMITE_REQUISICOES = 'muitas requisicoes - aguarde alguns instantes e tente novamente'

/** Espera usada quando o `429` não informa o tempo (mesmo padrão do bloqueio do login): 60 s. */
export const SEGUNDOS_ESPERA_PADRAO = 60

/**
 * Resposta `429` do limite de uso: JSON `{ mensagem, "segundos para tentar novamente": N }` e cabeçalho
 * `Retry-After: N`; sem `segundos`, só a mensagem (sem o campo e sem o cabeçalho).
 */
export function respostaLimite(segundos?: number): Response {
  const corpo: Record<string, unknown> = { mensagem: MENSAGEM_LIMITE_REQUISICOES }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (segundos !== undefined) {
    corpo['segundos para tentar novamente'] = segundos
    headers['Retry-After'] = String(segundos)
  }
  return new Response(JSON.stringify(corpo), { status: 429, headers })
}

/**
 * Aviso da quantidade de imagens (F10.10, alteração de 17/11/2026): o back-end deixou de limitar o número de
 * imagens por ZIP; o front avisa quantas imagens serão geradas e que a exibição e o ZIP podem demorar.
 */
export const TEXTO_DEMORA_IMAGENS =
  'Dependendo da quantidade de imagens, a exibição dos PDFs em tela e a montagem do ZIP com todas elas podem levar algum tempo.'

/** "Serão geradas {N} imagens em PDF." (N em pt-BR, com ponto de milhar); singular "Será gerada 1 imagem em PDF.". */
export function textoQuantidadeImagens(quantidade: number): string {
  return quantidade === 1
    ? 'Será gerada 1 imagem em PDF.'
    : `Serão geradas ${quantidade.toLocaleString('pt-BR')} imagens em PDF.`
}

/** Status enquanto o ZIP é montado: "Montando o ZIP com {N} imagens…" (singular "1 imagem"; sem N, "Montando o ZIP…"). */
export function textoMontandoZip(quantidade?: number): string {
  if (quantidade === undefined) return 'Montando o ZIP…'
  return quantidade === 1 ? 'Montando o ZIP com 1 imagem…' : `Montando o ZIP com ${quantidade.toLocaleString('pt-BR')} imagens…`
}

/** Nota (`role="note"`, `Aviso tipo="info"`) com o texto da demora dentro do container, ou `null`. */
export function avisoQuantidadeImagens(container: HTMLElement): HTMLElement | null {
  const notas = Array.from(container.querySelectorAll<HTMLElement>('[role="note"]'))
  return notas.find((nota) => (nota.textContent ?? '').includes(TEXTO_DEMORA_IMAGENS)) ?? null
}

export const MENSAGEM_CHAVE_FORA_DA_PREVIA = 'a chave informada nao esta na previa'
export const MENSAGEM_PREVIA_SEM_IMAGENS = 'a previa nao tem imagens a gerar'
export const MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR = 'nenhuma imagem encontrada para exportar'

interface ApiFalsaComImagens {
  rotas: Record<string, RotaFalsa>
  imagens: () => ImagemApiFalsa[]
}

/**
 * Acrescenta às rotas do back-end falso (mesmo objeto) as rotas de PDF e ZIP:
 * - `.../previa/pdf?chave=`: `400` sem chave ou com chave fora da prévia; senão o PDF da imagem;
 * - `.../previa/zip`: `400` sem imagens a gerar; senão o ZIP;
 * - `/imagens/{id}/pdf`: o PDF da imagem gravada (`404` se não existir);
 * - `/imagens/zip`: as imagens de `filtrarImagensApi` (mesmos filtros da consulta); `400` se nenhuma.
 */
export function adicionarRotasPdf<T extends ApiFalsaComImagens>(api: T): T {
  const rotasPrevia = Object.keys(api.rotas).filter((rota) => /^GET \/api\/ped\/fechamentos\/\d+\/previa$/.test(rota))
  for (const rotaPrevia of rotasPrevia) {
    const id = Number(rotaPrevia.split('/')[4])
    // A prévia é lida na hora pela rota atual (`api.rotas[rotaPrevia]`), inclusive se o teste a substituir.
    const lerPrevia = async (init: RequestInit | undefined, url: URL): Promise<PreviaFechamentoApiFalsa | Response> => {
      const resposta = await api.rotas[rotaPrevia](init, url)
      return resposta.ok ? ((await resposta.json()) as PreviaFechamentoApiFalsa) : resposta
    }
    api.rotas[`${rotaPrevia}/pdf`] = async (init, url) => {
      const chave = url.searchParams.get('chave')
      const previa = await lerPrevia(init, url)
      if (previa instanceof Response) return previa
      if (!chave || !previa.imagens.some((imagem) => imagem.chave === chave)) {
        return respostaErro(400, MENSAGEM_CHAVE_FORA_DA_PREVIA)
      }
      return respostaArquivo(conteudoPdfPrevia(id, chave), TIPO_PDF, nomePdfPrevia(id, chave))
    }
    api.rotas[`${rotaPrevia}/zip`] = async (init, url) => {
      const previa = await lerPrevia(init, url)
      if (previa instanceof Response) return previa
      if (previa.imagens.length === 0) return respostaErro(400, MENSAGEM_PREVIA_SEM_IMAGENS)
      return respostaArquivo(`PK zip previa ${id}`, TIPO_ZIP, nomeZipPrevia(id))
    }
  }

  for (const imagem of api.imagens()) {
    api.rotas[`GET /api/ped/imagens/${imagem.id}/pdf`] = () => {
      const atual = api.imagens().find((item) => item.id === imagem.id)
      return atual
        ? respostaArquivo(conteudoPdfImagem(atual.codigo), TIPO_PDF, nomePdfImagem(atual))
        : respostaErro(404, 'recurso nao encontrado')
    }
  }
  api.rotas['GET /api/ped/imagens/zip'] = (_init, url) => {
    const lista = filtrarImagensApi(api.imagens(), url)
    if (lista.length === 0) return respostaErro(400, MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR)
    return respostaArquivo(`PK zip ${lista.map((imagem) => imagem.codigo).join(',')}`, TIPO_ZIP, NOME_ZIP_IMAGENS)
  }
  return api
}
