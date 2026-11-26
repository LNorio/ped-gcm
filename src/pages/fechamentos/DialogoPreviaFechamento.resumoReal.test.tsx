import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { FECHAMENTO_COMERCIAL_API } from '../../test/fechamentosFalsos'
import { TIPO_PDF, conteudoPdfPrevia, nomePdfPrevia, respostaArquivo, simularUrlsDeObjeto, tituloPdf } from '../../test/pdfFalsos'
import { AVISO_DRG_API, carregarFechamentoDominio, previaComercialComResumoRealApi } from '../../test/previaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoPreviaFechamento } from './DialogoPreviaFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const TITULO = 'Pré-visualização — PED Comercial · 4º tri/2026'

/**
 * F10.4 — Pré-visualização com o resumo de 24/11/2026 (resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seções 2 e 4). É o RF-80.
 *
 * Progresso por filial (`PreviaFechamento.progressoPorFilial`, de `resumo."progresso por filial"`):
 * - a prévia mostra, para a filial escolhida no combobox "Filial", o texto
 *   "Progresso da filial {código}: {preenchidos} de {total}" (inteiros com `formatarInteiro`), além do
 *   "Progresso de lançamentos: {p} de {t}" do dashboard, que continua;
 * - trocar a filial troca o texto; sem o campo (lista vazia), ou sem a filial escolhida nele, nada aparece.
 *
 * Aviso geral (`resumo.avisos`, hoje só o do DRG):
 * - cada item de `resumo.avisos` aparece **uma vez**, no topo da prévia (junto dos avisos de pendências e
 *   de falta de faixas), com o texto como veio do back-end;
 * - o mesmo texto também vem em `imagens[].avisos`, mas não se repete na prévia (nem ao navegar entre as
 *   imagens): o texto idêntico a um item de `resumo.avisos` é ocultado dos avisos da imagem.
 */
describe('F10.4 — DialogoPreviaFechamento: progresso por filial e aviso geral do DRG uma vez só', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar(previa: unknown = previaComercialComResumoRealApi()) {
    const rotas: Record<string, RotaFalsa> = {
      'GET /api/ped/fechamentos/1/previa': () => respostaJson(previa),
      'GET /api/ped/fechamentos/1/previa/pdf': (_init, url) => {
        const chave = url.searchParams.get('chave') ?? ''
        return respostaArquivo(conteudoPdfPrevia(1, chave), TIPO_PDF, nomePdfPrevia(1, chave))
      },
    }
    simularApi(fetchFalso, rotas)
    render(<DialogoPreviaFechamento fechamento={COMERCIAL} onFechar={vi.fn()} onEncerrar={vi.fn()} />)
  }

  const dialogo = () => screen.getByRole('dialog', { name: TITULO })
  const filial = () => within(dialogo()).getByRole('combobox', { name: 'Filial' })

  async function esperarPrevia() {
    const elemento = await screen.findByRole('dialog', { name: TITULO })
    await within(elemento).findByRole('combobox', { name: 'Filial' })
    return elemento
  }

  describe('progresso por filial', () => {
    it('mostra o progresso da filial escolhida (101: 3 de 3), além do progresso do dashboard', async () => {
      renderizar()
      await esperarPrevia()

      expect(filial()).toHaveValue('101')
      expect(within(dialogo()).getByText('Progresso da filial 101: 3 de 3')).toBeInTheDocument()
      expect(within(dialogo()).getByText('Progresso de lançamentos: 5 de 6')).toBeInTheDocument()
    })

    it('ao trocar a filial, mostra o progresso da nova filial (102: 2 de 3)', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()

      await user.selectOptions(filial(), '102')

      expect(await within(dialogo()).findByText('Progresso da filial 102: 2 de 3')).toBeInTheDocument()
      expect(within(dialogo()).queryByText('Progresso da filial 101: 3 de 3')).not.toBeInTheDocument()
    })

    it('ao navegar para a imagem de outra filial ("Próxima imagem"), o progresso acompanha a filial', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()

      await user.click(within(dialogo()).getByRole('button', { name: 'Próxima imagem' }))

      expect(await within(dialogo()).findByTitle(tituloPdf('102'))).toBeInTheDocument()
      expect(within(dialogo()).getByText('Progresso da filial 102: 2 de 3')).toBeInTheDocument()
    })

    it('contagens com milhar em pt-BR (formatarInteiro)', async () => {
      renderizar(previaComercialComResumoRealApi([{ filial: '101', 'nome filial': 'CAMPO GRANDE', preenchidos: 1234, total: 2000 }]))
      await esperarPrevia()

      expect(within(dialogo()).getByText('Progresso da filial 101: 1.234 de 2.000')).toBeInTheDocument()
    })

    it('sem a filial escolhida no campo, não mostra o progresso da filial; a outra filial mostra', async () => {
      const user = usuarioRapido()
      renderizar(previaComercialComResumoRealApi([{ filial: '102', 'nome filial': 'DOURADOS', preenchidos: 2, total: 3 }]))
      await esperarPrevia()

      expect(within(dialogo()).queryByText(/^Progresso da filial/)).not.toBeInTheDocument()

      await user.selectOptions(filial(), '102')

      expect(await within(dialogo()).findByText('Progresso da filial 102: 2 de 3')).toBeInTheDocument()
    })

    it.each([
      ['lista vazia', []],
      ['ausente', undefined],
    ])('sem o campo (%s), nenhum progresso de filial aparece; o do dashboard continua', async (_caso, progresso) => {
      const api = previaComercialComResumoRealApi()
      if (progresso === undefined) delete api.resumo['progresso por filial']
      else api.resumo['progresso por filial'] = progresso
      renderizar(api)
      await esperarPrevia()

      expect(within(dialogo()).queryByText(/^Progresso da filial/)).not.toBeInTheDocument()
      expect(within(dialogo()).getByText('Progresso de lançamentos: 5 de 6')).toBeInTheDocument()
    })
  })

  describe('aviso geral do DRG', () => {
    it('mostra o aviso de resumo.avisos uma vez só, embora ele venha também nos avisos das duas imagens', async () => {
      renderizar()
      await esperarPrevia()

      expect(within(dialogo()).getAllByText(AVISO_DRG_API)).toHaveLength(1)
    })

    it('ao navegar para a outra imagem, o aviso do DRG continua aparecendo uma vez só', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()

      await user.click(within(dialogo()).getByRole('button', { name: 'Próxima imagem' }))
      await within(dialogo()).findByTitle(tituloPdf('102'))

      expect(within(dialogo()).getAllByText(AVISO_DRG_API)).toHaveLength(1)
    })

    it('o aviso geral fica com os avisos de pendências e de falta de faixas, no topo, antes da escolha da filial', async () => {
      renderizar()
      await esperarPrevia()

      const aviso = within(dialogo()).getByText(AVISO_DRG_API)
      const pendencias = within(dialogo()).getByText(/^Filiais com lançamentos pendentes: 102\./)
      expect(aviso.compareDocumentPosition(filial()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(pendencias.compareDocumentPosition(filial()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })
})
