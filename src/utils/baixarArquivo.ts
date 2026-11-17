/**
 * Download no navegador de um arquivo vindo da API (F10.10 — PDF e ZIP das imagens), sem dependência nova:
 * cria a URL de objeto do Blob, clica num `<a href download>` fora do documento e libera a URL em seguida.
 */

import type { ArquivoBaixado } from '../services/api'

export function baixarArquivo(arquivo: ArquivoBaixado): void {
  const url = URL.createObjectURL(arquivo.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo.nomeArquivo
  link.rel = 'noopener'
  try {
    link.click()
  } finally {
    // Libera depois do clique, fora do fluxo atual, para o navegador iniciar o download.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
