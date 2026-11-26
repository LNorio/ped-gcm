/**
 * Documentos da página pública `/resumo` (F2.14): o diário de implementação e a documentação do
 * projeto, lidos no build (`?raw`) sem alteração. Módulo puro (sem React).
 */
import diario from '../../../docs/diario-implementacao.md?raw'
import documentacao from '../../../docs/documentacao.md?raw'

export const DOCUMENTOS_RESUMO: { readonly diario: string; readonly documentacao: string } = {
  diario,
  documentacao,
}
