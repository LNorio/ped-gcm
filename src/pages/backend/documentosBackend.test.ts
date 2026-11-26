import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCUMENTOS_BACKEND, montarDocumentos, type DocumentoBackend } from './documentosBackend'

/**
 * F2.13 — Página pública /backend com a documentação trocada com o back-end (leitura dos documentos).
 *
 * `montarDocumentos` recebe o resultado de `import.meta.glob` (caminho → texto do Markdown) e devolve a
 * lista exibida pela página; `DOCUMENTOS_BACKEND` é essa lista montada, no build, a partir de todos os
 * `.md` de `docs/propostas-backend/`.
 */
describe('F2.13 — Documentos para o back-end (montarDocumentos)', () => {
  it('usa o nome do arquivo (sem a pasta) em "arquivo" e o nome sem ".md" em "id"', () => {
    const [documento] = montarDocumentos({
      '/docs/propostas-backend/PENDENCIAS-backend-2026-11-25.md': '# O que ainda falta\n\nTexto.\n',
    })

    expect(documento.arquivo).toBe('PENDENCIAS-backend-2026-11-25.md')
    expect(documento.id).toBe('PENDENCIAS-backend-2026-11-25')
  })

  it('mantém o conteúdo do Markdown sem alteração', () => {
    const conteudo = '# Título\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const [documento] = montarDocumentos({ '/docs/propostas-backend/PROPOSTA-x.md': conteudo })

    expect(documento.conteudo).toBe(conteudo)
  })

  describe('título', () => {
    it('é o texto do primeiro cabeçalho "# "', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/PROPOSTA-alertas-menu.md': '# PED — Proposta: alertas do menu\n\n## Contexto\n\n# Outro título\n',
      })

      expect(documento.titulo).toBe('PED — Proposta: alertas do menu')
    })

    it('ignora o texto antes do primeiro "# " e os cabeçalhos "## "', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/RESPOSTA-x.md': 'Texto solto antes.\n\n## Subtítulo\n\n# Título real\n\nCorpo.\n',
      })

      expect(documento.titulo).toBe('Título real')
    })

    it('com quebras de linha do Windows (CRLF), não leva o "\\r" nem espaços nas pontas', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/RESPOSTA-crlf.md': '#   Título com CRLF   \r\n\r\nCorpo.\r\n',
      })

      expect(documento.titulo).toBe('Título com CRLF')
    })

    it('sem cabeçalho "# ", usa o nome do arquivo sem ".md"', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/RESPOSTA-saida-sem-mapeamento (1).md': '## Só subtítulo\n\nCorpo sem título.\n',
      })

      expect(documento.titulo).toBe('RESPOSTA-saida-sem-mapeamento (1)')
    })

    it('documento vazio também usa o nome do arquivo sem ".md"', () => {
      const [documento] = montarDocumentos({ '/docs/propostas-backend/VAZIO.md': '' })

      expect(documento.titulo).toBe('VAZIO')
    })
  })

  describe('data', () => {
    it('é a data AAAA-MM-DD do nome do arquivo', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/VERIFICACAO-swagger-2026-11-24.md': '# Verificação\n',
      })

      expect(documento.data).toBe('2026-11-24')
    })

    it('é null quando o nome do arquivo não tem data', () => {
      const [documento] = montarDocumentos({ '/docs/propostas-backend/PROPOSTA-pdf-imagens.md': '# PDF\n' })

      expect(documento.data).toBeNull()
    })

    it('não é lida do conteúdo do documento', () => {
      const [documento] = montarDocumentos({
        '/docs/propostas-backend/PROPOSTA-sem-data.md': '# Proposta de 2026-11-20\n\nEnviada em 2026-11-20.\n',
      })

      expect(documento.data).toBeNull()
    })
  })

  describe('ordem', () => {
    it('mais recentes primeiro; sem data por último, em ordem alfabética; mesma data em ordem alfabética', () => {
      const documentos = montarDocumentos({
        '/docs/propostas-backend/RESPOSTA-c.md': '# C\n',
        '/docs/propostas-backend/PENDENCIAS-backend-2026-11-24.md': '# 24\n',
        '/docs/propostas-backend/CONTRAPROPOSTA-a.md': '# A\n',
        '/docs/propostas-backend/VERIFICACAO-swagger-2026-11-24.md': '# V24\n',
        '/docs/propostas-backend/PENDENCIAS-backend-2026-11-25.md': '# 25\n',
        '/docs/propostas-backend/PROPOSTA-b.md': '# B\n',
        '/docs/propostas-backend/PENDENCIAS-backend-2025-12-31.md': '# 2025\n',
      })

      expect(documentos.map((documento) => documento.arquivo)).toEqual([
        'PENDENCIAS-backend-2026-11-25.md',
        'PENDENCIAS-backend-2026-11-24.md',
        'VERIFICACAO-swagger-2026-11-24.md',
        'PENDENCIAS-backend-2025-12-31.md',
        'CONTRAPROPOSTA-a.md',
        'PROPOSTA-b.md',
        'RESPOSTA-c.md',
      ])
    })

    it('sem documentos, devolve lista vazia', () => {
      expect(montarDocumentos({})).toEqual([])
    })
  })

  it('devolve exatamente os campos { id, arquivo, titulo, data, conteudo }', () => {
    const documentos: DocumentoBackend[] = montarDocumentos({
      '/docs/propostas-backend/PENDENCIAS-backend-2026-11-25.md': '# O que ainda falta do back-end\n\nCorpo.\n',
    })

    expect(documentos).toEqual([
      {
        id: 'PENDENCIAS-backend-2026-11-25',
        arquivo: 'PENDENCIAS-backend-2026-11-25.md',
        titulo: 'O que ainda falta do back-end',
        data: '2026-11-25',
        conteudo: '# O que ainda falta do back-end\n\nCorpo.\n',
      },
    ])
  })
})

describe('F2.13 — Documentos para o back-end (DOCUMENTOS_BACKEND, arquivos reais de docs/propostas-backend)', () => {
  const pasta = resolve(process.cwd(), 'docs/propostas-backend')
  const arquivosDaPasta = readdirSync(pasta).filter((nome) => nome.toLowerCase().endsWith('.md'))

  it('contém todos os .md da pasta, sem precisar listar os arquivos no código', () => {
    expect(arquivosDaPasta.length).toBeGreaterThan(0)
    expect(DOCUMENTOS_BACKEND.map((documento) => documento.arquivo).sort()).toEqual([...arquivosDaPasta].sort())
  })

  it('inclui as pendências de 24/11 e 25/11/2026, com a data do nome', () => {
    const porArquivo = new Map(DOCUMENTOS_BACKEND.map((documento) => [documento.arquivo, documento]))

    expect(porArquivo.get('PENDENCIAS-backend-2026-11-25.md')?.data).toBe('2026-11-25')
    expect(porArquivo.get('PENDENCIAS-backend-2026-11-24.md')?.data).toBe('2026-11-24')
  })

  it('cada documento tem id, título e conteúdo não vazios', () => {
    for (const documento of DOCUMENTOS_BACKEND) {
      expect(documento.id).not.toBe('')
      expect(documento.titulo.trim()).not.toBe('')
      expect(documento.conteudo.trim()).not.toBe('')
    }
  })

  it('está na ordem de montarDocumentos (mais recentes primeiro)', () => {
    const datas = DOCUMENTOS_BACKEND.map((documento) => documento.data)
    const comData = datas.filter((data): data is string => data !== null)

    expect(comData).toEqual([...comData].sort().reverse())
    // Os sem data vêm depois de todos os com data.
    const primeiroSemData = datas.indexOf(null)
    if (primeiroSemData >= 0) expect(datas.slice(primeiroSemData).every((data) => data === null)).toBe(true)
  })

  it('os ids são únicos (servem de parâmetro ?doc da URL)', () => {
    const ids = DOCUMENTOS_BACKEND.map((documento) => documento.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
