import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import {
  TITULO_CONSULTA_IMAGENS,
  adiado,
  criarApiConsultaImagensFalsa,
  rotuloVisualizarImagem,
  tituloDialogoImagem,
} from '../../test/consultaImagensFalsos'
import { IMAGEM_GERENTES_ANA_API, MENSAGEM_DASHBOARD_NAO_ATIVO, fechamentosApi } from '../../test/fechamentosFalsos'
import { escolherAcao } from '../../test/menuAcoes'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  MENSAGEM_LIMITE_REQUISICOES,
  MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR,
  NOME_ZIP_IMAGENS,
  ROTULO_EXPORTAR,
  TEXTO_DEMORA_IMAGENS,
  adicionarRotasPdf,
  avisoQuantidadeImagens,
  nomePdfImagem,
  nomePdfPrevia,
  nomeZipPrevia,
  respostaLimite,
  simularDownloads,
  simularUrlsDeObjeto,
  textoMontandoZip,
  textoQuantidadeImagens,
  tituloPdf,
} from '../../test/pdfFalsos'
import { ITEM_PRE_VISUALIZAR, rotuloAcoesFechamento } from '../../test/previaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const TITULO_COMERCIAL = 'Pré-visualização — PED Comercial · 4º tri/2026'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const ROTA_IMAGENS = '/api/ped/imagens'

/**
 * F10.10 — Imagens em PDF e exportação na aba Fechamentos (integração: /fechamentos com a API simulada),
 * contrato proposto em `docs/backend/PROPOSTA-pdf-imagens.md` (rotas ainda inexistentes no back-end).
 * Fluxo completo: página + `DialogoPreviaFechamento` / `ConsultaImagens` + `DialogoImagem` + serviços
 * (`obterPdfPrevia`, `obterZipPrevia`, `obterPdfImagem`, `obterZipImagens`), só a rede simulada
 * (`criarApiConsultaImagensFalsa` + `adicionarRotasPdf`); `URL.createObjectURL` e o clique do link de
 * download são simulados.
 *
 * - Prévia: o painel da imagem é o PDF embutido da imagem atual; navegar pede o PDF da nova imagem;
 *   "Exportar" baixa o PDF da imagem atual ou o ZIP de todas as imagens da prévia. Nada é gravado.
 * - Consulta retroativa: o diálogo da imagem mostra o PDF da imagem congelada; "Exportar" baixa o PDF dela
 *   ou o ZIP das imagens **com os mesmos filtros da consulta** (filial do cabeçalho, período, tipo, busca).
 * - Erros mostram a `mensagem` do back-end; `401` encerra a sessão (volta ao login).
 * - Limite de uso (`429`, resposta do back-end de 17/11/2026: 20 PDFs/min e 5 ZIPs/min, com
 *   `"segundos para tentar novamente"` e `Retry-After`): a mensagem aparece e "Exportar" (ZIP) ou
 *   "Tentar novamente" (PDF embutido) fica desabilitado pelo tempo informado (detalhe do tempo nos testes
 *   unitários `ExportarImagens.limite.test.tsx` e `VisualizadorPdf.limite.test.tsx`).
 * - ZIP sem limite de imagens (alteração de 17/11/2026): junto ao "Exportar", o aviso informa quantas
 *   imagens serão geradas (prévia: total da prévia; consulta: imagens da consulta filtrada) e que a exibição
 *   e o ZIP podem demorar; durante a montagem do ZIP, "Montando o ZIP com {N} imagens…".
 * - Acesso: Admin e Validador (o Preenchedor não chega à aba).
 */
describe('F10.10 — Imagens em PDF e exportação (integração: aba Fechamentos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let urls: ReturnType<typeof simularUrlsDeObjeto>
  let downloads: ReturnType<typeof simularDownloads>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    urls = simularUrlsDeObjeto()
    downloads = simularDownloads()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': perfil !== 'preenchedor', filiais: FILIAIS_API })
    const api = adicionarRotasPdf(criarApiConsultaImagensFalsa())
    Object.assign(api.rotas, rotasExtras)
    return simularApi(fetchFalso, { 'GET /api/ped/acesso': () => respostaJson(acesso), ...api.rotas })
  }

  const arquivos = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => /\/(pdf|zip)$/.test(c.caminho))

  async function exportar(user: Usuario, dialogo: HTMLElement, item: string) {
    await user.click(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
  }

  describe('pré-visualização (F10.4)', () => {
    async function abrirPrevia(user: Usuario) {
      renderizarApp('/fechamentos')
      await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })
      await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)
      const dialogo = await screen.findByRole('dialog', { name: TITULO_COMERCIAL })
      await within(dialogo).findByRole('combobox', { name: 'Filial' })
      return dialogo
    }

    it.each(['admin', 'validador'] as const)(
      'o %s vê o PDF da imagem atual, navega para a próxima e exporta o PDF dela e o ZIP da prévia, sem gravar nada',
      async (perfil) => {
        const user = usuarioRapido()
        const chamadas = simularSessao(perfil)
        const dialogo = await abrirPrevia(user)

        expect(await within(dialogo).findByTitle(tituloPdf('101'))).toBeInTheDocument()

        await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))
        expect(await within(dialogo).findByTitle(tituloPdf('102'))).toBeInTheDocument()
        expect(within(dialogo).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()

        await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)
        await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomePdfPrevia(1, 'filial:102')]))
        await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())

        await exportar(user, dialogo, ITEM_ZIP_TODAS)
        await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomePdfPrevia(1, 'filial:102'), nomeZipPrevia(1)]))

        const pdfs = chamadas.filter((c) => c.caminho === '/api/ped/fechamentos/1/previa/pdf')
        expect(pdfs.map((c) => c.url.searchParams.get('chave'))).toEqual(expect.arrayContaining(['filial:101', 'filial:102']))
        expect(chamadas.filter((c) => c.caminho === '/api/ped/fechamentos/1/previa/zip')).toHaveLength(1)
        for (const chamada of arquivos(chamadas)) {
          expect(chamada.metodo).toBe('GET')
          expect(cabecalhoDaChamada(chamada, 'Authorization')).toBe('Bearer token-salvo')
        }
        expect(chamadas.filter((c) => c.metodo !== 'GET')).toHaveLength(0)
      },
    )

    it('erro ao gerar o PDF: a mensagem aparece no diálogo e "Tentar novamente" mostra o PDF', async () => {
      const user = usuarioRapido()
      let falhar = true
      const api = adicionarRotasPdf(criarApiConsultaImagensFalsa())
      simularSessao('admin', {
        'GET /api/ped/fechamentos/1/previa/pdf': (init, url) =>
          falhar ? respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO) : api.rotas['GET /api/ped/fechamentos/1/previa/pdf'](init, url),
      })
      const dialogo = await abrirPrevia(user)

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)

      falhar = false
      await user.click(within(dialogo).getByRole('button', { name: 'Tentar novamente' }))

      expect(await within(dialogo).findByTitle(tituloPdf('101'))).toBeInTheDocument()
    })

    it('429 no ZIP da prévia (5 ZIPs/min): a mensagem aparece, sem download, e "Exportar" fica desabilitado', async () => {
      const user = usuarioRapido()
      simularSessao('admin', { 'GET /api/ped/fechamentos/1/previa/zip': () => respostaLimite(45) })
      const dialogo = await abrirPrevia(user)
      await within(dialogo).findByTitle(tituloPdf('101'))

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
      await new Promise((r) => setTimeout(r, 20))
      expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeDisabled()
      expect(downloads).toHaveLength(0)
    })

    it('aviso da quantidade (ZIP sem limite): "Serão geradas 2 imagens em PDF." e a demora; o ZIP mostra "Montando o ZIP com 2 imagens…"', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      const api = adicionarRotasPdf(criarApiConsultaImagensFalsa())
      simularSessao('admin', {
        'GET /api/ped/fechamentos/1/previa/zip': (init, url) =>
          lento.promessa.then(() => api.rotas['GET /api/ped/fechamentos/1/previa/zip'](init, url)),
      })
      const dialogo = await abrirPrevia(user)
      await within(dialogo).findByTitle(tituloPdf('101'))

      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(2))
      expect(aviso).toHaveTextContent(TEXTO_DEMORA_IMAGENS)

      await exportar(user, dialogo, ITEM_ZIP_TODAS)
      const status = await within(dialogo).findByText(textoMontandoZip(2))
      expect(status.closest('[role="status"]')).not.toBeNull()

      lento.resolver()

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomeZipPrevia(1)]))
      await waitFor(() => expect(within(dialogo).queryByText(/Montando o ZIP/)).not.toBeInTheDocument())
    })

    it('aviso da quantidade desde a abertura: enquanto calcula, a estimativa da linha (10 - 3 = 7); com a prévia, o total dela (2)', async () => {
      const user = usuarioRapido()
      const lenta = adiado<void>()
      const fechamentos = fechamentosApi().map((f) =>
        f.id === 1 ? { ...f, 'unidades de imagem': 10, 'unidades encerradas': 3 } : f,
      )
      const api = adicionarRotasPdf(criarApiConsultaImagensFalsa({ fechamentos }))
      const previaOriginal = api.rotas['GET /api/ped/fechamentos/1/previa']
      const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acesso),
        ...api.rotas,
        'GET /api/ped/fechamentos/1/previa': (init, url) => lenta.promessa.then(() => previaOriginal(init, url)),
      })
      renderizarApp('/fechamentos')
      await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })
      await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)
      const dialogo = await screen.findByRole('dialog', { name: TITULO_COMERCIAL })

      expect(within(dialogo).getByText('Calculando as imagens...')).toBeInTheDocument()
      const avisoCalculando = avisoQuantidadeImagens(dialogo)
      expect(avisoCalculando).toHaveTextContent(textoQuantidadeImagens(7))
      expect(avisoCalculando).toHaveTextContent(TEXTO_DEMORA_IMAGENS)

      lenta.resolver()
      await within(dialogo).findByTitle(tituloPdf('101'))

      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(2))
      expect(aviso).not.toHaveTextContent(textoQuantidadeImagens(7))
    })

    it('fechar a prévia libera as URLs de objeto dos PDFs', async () => {
      const user = usuarioRapido()
      simularSessao()
      const dialogo = await abrirPrevia(user)
      await within(dialogo).findByTitle(tituloPdf('101'))

      await user.click(within(dialogo).getByRole('button', { name: 'Fechar pré-visualização' }))

      await waitFor(() => expect(screen.queryByRole('dialog', { name: TITULO_COMERCIAL })).not.toBeInTheDocument())
      await waitFor(() => {
        for (const { url } of urls.criadas) expect(urls.revogadas).toContain(url)
      })
    })

    it('401 ao pedir o PDF encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
      const user = usuarioRapido()
      simularSessao('admin', { 'GET /api/ped/fechamentos/1/previa/pdf': () => respostaErro(401) })
      renderizarApp('/fechamentos')
      await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })

      await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
      expect(obterToken()).toBeNull()
    })
  })

  describe('imagens congeladas — consulta retroativa (F10.6)', () => {
    const regiao = () => screen.getByRole('region', { name: TITULO_CONSULTA_IMAGENS })
    const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
    const getsConsulta = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_IMAGENS)
    const getsZip = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `${ROTA_IMAGENS}/zip`)
    const parametros = (chamada: ChamadaRegistrada) => Object.fromEntries(chamada.url.searchParams.entries())
    const codigosNaConsulta = () =>
      within(regiao())
        .queryAllByRole('button', { name: /^Visualizar imagem / })
        .map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').replace('Visualizar imagem ', ''))

    async function abrirConsulta() {
      renderizarApp('/fechamentos')
      await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })
      await waitFor(() => expect(codigosNaConsulta().length).toBeGreaterThan(0))
    }

    async function abrirImagem(user: Usuario, codigo: string) {
      await user.click(within(regiao()).getByRole('button', { name: rotuloVisualizarImagem(codigo) }))
      return screen.findByRole('dialog', { name: tituloDialogoImagem(codigo) })
    }

    it.each(['admin', 'validador'] as const)('o %s vê a imagem congelada em PDF e baixa o PDF dela', async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil)
      await abrirConsulta()

      const dialogo = await abrirImagem(user, 'IMG-000003')

      expect(await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))).toBeInTheDocument()
      expect(chamadas.filter((c) => c.caminho === `${ROTA_IMAGENS}/3/pdf`).length).toBeGreaterThan(0)

      await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomePdfImagem(IMAGEM_GERENTES_ANA_API)]))
      for (const chamada of arquivos(chamadas)) expect(cabecalhoDaChamada(chamada, 'Authorization')).toBe('Bearer token-salvo')
    })

    it('"Todas as imagens (ZIP)" exporta as imagens filtradas com os mesmos filtros da consulta', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin')
      await abrirConsulta()
      await user.selectOptions(seletorFilial(), '100')
      await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003', 'IMG-000001']))
      await user.selectOptions(within(regiao()).getByRole('combobox', { name: 'Período das imagens' }), '10/2026')
      await user.selectOptions(within(regiao()).getByRole('combobox', { name: 'Tipo de imagem' }), 'Colaborador')
      await user.type(within(regiao()).getByRole('searchbox', { name: 'Buscar imagens' }), 'ana')
      await waitFor(() =>
        expect(parametros(getsConsulta(chamadas).at(-1)!)).toEqual({ filial: '100', periodo: '10/2026', tipo: 'colaborador', busca: 'ana' }),
      )
      await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003']))

      const dialogo = await abrirImagem(user, 'IMG-000003')
      await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))
      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
      expect(getsZip(chamadas)).toHaveLength(1)
      expect(parametros(getsZip(chamadas)[0])).toEqual(parametros(getsConsulta(chamadas).at(-1)!))
    })

    it('sem filtros e com "Todas as filiais", o ZIP vai sem filtros (todas as imagens da consulta)', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin')
      await abrirConsulta()

      const dialogo = await abrirImagem(user, 'IMG-000001')
      await within(dialogo).findByTitle(tituloPdf('100'))
      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
      expect(parametros(getsZip(chamadas)[0])).toEqual({})
    })

    it('aviso da quantidade (ZIP sem limite): o diálogo informa as imagens da consulta filtrada (4 → 1)', async () => {
      const user = usuarioRapido()
      simularSessao('admin')
      await abrirConsulta()
      expect(codigosNaConsulta()).toHaveLength(4)

      let dialogo = await abrirImagem(user, 'IMG-000003')
      await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(4))
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })).not.toBeInTheDocument())

      await user.type(within(regiao()).getByRole('searchbox', { name: 'Buscar imagens' }), 'souza')
      await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003']))

      dialogo = await abrirImagem(user, 'IMG-000003')
      await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(1))
    })

    it('enquanto o ZIP da consulta é montado, mostra "Montando o ZIP com {N} imagens…" e some ao baixar', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      const api = adicionarRotasPdf(criarApiConsultaImagensFalsa())
      simularSessao('admin', {
        [`GET ${ROTA_IMAGENS}/zip`]: (init, url) => lento.promessa.then(() => api.rotas[`GET ${ROTA_IMAGENS}/zip`](init, url)),
      })
      await abrirConsulta()
      const dialogo = await abrirImagem(user, 'IMG-000001')
      await within(dialogo).findByTitle(tituloPdf('100'))

      await exportar(user, dialogo, ITEM_ZIP_TODAS)
      const status = await within(dialogo).findByText(textoMontandoZip(4))
      expect(status.closest('[role="status"]')).not.toBeNull()

      lento.resolver()

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
      await waitFor(() => expect(within(dialogo).queryByText(/Montando o ZIP/)).not.toBeInTheDocument())
    })

    it('erro na exportação do ZIP: a mensagem do back-end aparece no diálogo, sem download', async () => {
      const user = usuarioRapido()
      simularSessao('admin', { [`GET ${ROTA_IMAGENS}/zip`]: () => respostaErro(400, MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR) })
      await abrirConsulta()
      const dialogo = await abrirImagem(user, 'IMG-000003')
      await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR)
      expect(downloads).toHaveLength(0)
    })

    it('429 no PDF da imagem congelada (20 PDFs/min): a mensagem aparece e "Tentar novamente" fica desabilitado', async () => {
      const user = usuarioRapido()
      simularSessao('admin', { [`GET ${ROTA_IMAGENS}/3/pdf`]: () => respostaLimite(30) })
      await abrirConsulta()

      const dialogo = await abrirImagem(user, 'IMG-000003')

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
      await new Promise((r) => setTimeout(r, 20))
      expect(within(dialogo).getByRole('button', { name: 'Tentar novamente' })).toBeDisabled()
      expect(within(dialogo).queryByTitle(tituloPdf('100', 'Ana Souza'))).not.toBeInTheDocument()
    })

    it('a consulta, o PDF e a exportação só fazem GET (RN-18)', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin')
      await abrirConsulta()
      const dialogo = await abrirImagem(user, 'IMG-000003')
      await within(dialogo).findByTitle(tituloPdf('100', 'Ana Souza'))
      await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)
      await waitFor(() => expect(downloads).toHaveLength(1))
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())
      await exportar(user, dialogo, ITEM_ZIP_TODAS)
      await waitFor(() => expect(downloads).toHaveLength(2))

      expect(chamadas.filter((c) => c.caminho.startsWith(ROTA_IMAGENS)).every((c) => c.metodo === 'GET')).toBe(true)
    })
  })

  it('Preenchedor não chega à aba: nenhum PDF ou ZIP é pedido', async () => {
    const chamadas = simularSessao('preenchedor')

    renderizarApp('/fechamentos')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(arquivos(chamadas)).toHaveLength(0)
  })
})
