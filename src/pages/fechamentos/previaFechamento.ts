/**
 * Funções puras compartilhadas pela pré-visualização (F10.4) e pela confirmação do encerramento
 * (F10.5): textos dos avisos, plural de "imagem" e agrupamento das imagens da prévia por filial.
 */
import type { ImagemCongelada, PreviaFechamento, ResumoFechamento } from '../../types/dominio'

/** "1 imagem" / "N imagens". */
export function textoImagens(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'imagem' : 'imagens'}`
}

/** Rótulo do botão que encerra o período. */
export function rotuloEncerrar(quantidade: number): string {
  return `Encerrar e gerar ${textoImagens(quantidade)}`
}

export const TEXTO_CALCULANDO = 'Calculando as imagens...'

export const TEXTO_SEM_IMAGENS_A_GERAR =
  'Nenhuma imagem a gerar: todas as unidades deste dashboard já foram encerradas no período atual.'

export const TEXTO_OUTROS_DASHBOARDS = 'Os outros dashboards não são afetados: cada dashboard é encerrado individualmente.'

export const TEXTO_TODAS_ENCERRADAS = 'Todas as unidades deste dashboard já foram encerradas no período atual.'

export function avisoPendencias(filiais: string[]): string {
  return `Filiais com lançamentos pendentes: ${filiais.join(', ')}. Se o período for encerrado agora, eles serão congelados sem valor.`
}

export function avisoSemFaixas(filiais: string[]): string {
  return `Filiais sem tabela de faixas: ${filiais.join(', ')}. As imagens dessas filiais ficarão sem pontuação.`
}

/** Comparação de códigos de filial (numérica quando possível: "99" antes de "100"). */
export function compararCodigos(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true })
}

const ordenarCodigos = (codigos: string[]) => [...codigos].sort(compararCodigos)

/** Filiais com pendências e sem tabela de faixas do resumo, em ordem de código. */
export function filiaisDosAvisos(resumo: ResumoFechamento) {
  return {
    pendencias: ordenarCodigos(resumo.unidadesComPendencias.unidades),
    semFaixas: ordenarCodigos(resumo.unidadesSemTabelaDeFaixas.unidades),
  }
}

/** Código da filial da imagem (texto vazio quando a API não informa). */
export function filialDaImagem(imagem: ImagemCongelada): string {
  return imagem.unidade.filial ?? ''
}

export interface GrupoFilial {
  codigo: string
  nome: string | null
  imagens: ImagemCongelada[]
}

/**
 * Agrupa as imagens por filial, em ordem de código; dentro da filial, mantém a ordem da API.
 */
export function agruparPorFilial(imagens: ImagemCongelada[]): GrupoFilial[] {
  const grupos = new Map<string, GrupoFilial>()
  for (const imagem of imagens) {
    const codigo = filialDaImagem(imagem)
    const grupo = grupos.get(codigo)
    if (grupo) {
      grupo.imagens.push(imagem)
      if (!grupo.nome && imagem.unidade.nomeFilial) grupo.nome = imagem.unidade.nomeFilial
    } else {
      grupos.set(codigo, { codigo, nome: imagem.unidade.nomeFilial, imagens: [imagem] })
    }
  }
  return [...grupos.values()].sort((a, b) => compararCodigos(a.codigo, b.codigo))
}

/** "Filial {código} - {nome}" (sem o nome quando a API não o informa). */
export function rotuloFilial(codigo: string, nome: string | null): string {
  return nome ? `Filial ${codigo} - ${nome}` : `Filial ${codigo}`
}

/** A prévia gera imagens de colaborador (vínculo por cargos ou colaboradores)? */
export function previaPorColaborador(previa: PreviaFechamento, tipoVinculoFiliais: boolean): boolean {
  if (previa.imagens.length > 0) return previa.imagens.some((imagem) => imagem.tipo === 'colaborador')
  return !tipoVinculoFiliais
}
