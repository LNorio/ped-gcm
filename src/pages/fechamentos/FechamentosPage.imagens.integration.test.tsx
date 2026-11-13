import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mensagemPadraoPorStatus } from '../../services/api'
import { limparToken } from '../../services/sessao'
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
  LEGENDA_TABELA_IMAGENS,
  TEXTO_FILIAL_SEM_COLABORADOR,
  TEXTO_SEM_IMAGENS_FILTRO,
  TITULO_CONSULTA_IMAGENS,
  criarApiConsultaImagensFalsa,
  rotuloVisualizarImagem,
  tituloDialogoImagem,
} from '../../test/consultaImagensFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/imagens'
/** Seção da lista de fechamentos (F10.2). */
const SECAO_LISTA_FECHAMENTOS = 'Encerrar período por dashboard'

/**
 * F10.6 — Consulta retroativa de imagens na aba Fechamentos (integração: /fechamentos com a API simulada;
 * RF-84, RN-18, A-05, A-07). A consulta é a seção "Imagens congeladas — consulta retroativa", abaixo da
 * seção "Encerrar período por dashboard" da F10.2 (como no protótipo); não há rota própria. A filial vem do cabeçalho: "Todas as
 * filiais" consulta todas; uma filial consulta só ela. Filtros por período, tipo e busca vão à API.
 * "Visualizar imagem {código}" abre o diálogo com a imagem completa (`GET /api/ped/imagens/{id}`).
 */
describe('F10.6 — Consulta retroativa de imagens (integração: aba Fechamentos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  /** Admin e Validador acessam Fechamentos com todas as filiais (A-05). */
  function simularSessao(perfil: 'admin' | 'validador', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiConsultaImagensFalsa()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
  }

  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
  const regiao = () => screen.getByRole('region', { name: TITULO_CONSULTA_IMAGENS })
  const busca = () => within(regiao()).getByRole('searchbox', { name: 'Buscar imagens' })
  const filtroPeriodo = () => within(regiao()).getByRole('combobox', { name: 'Período das imagens' })
  const filtroTipo = () => within(regiao()).getByRole('combobox', { name: 'Tipo de imagem' })
  const getsImagens = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const codigosNaConsulta = () =>
    within(regiao())
      .queryAllByRole('button', { name: /^Visualizar imagem / })
      .map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').replace('Visualizar imagem ', ''))

  async function abrirTela() {
    renderizarApp('/fechamentos')
    await screen.findByRole('heading', { level: 1, name: 'Fechamentos' })
    const secao = await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })
    await waitFor(() => expect(codigosNaConsulta().length).toBeGreaterThan(0))
    return secao
  }

  it('Admin com "Todas as filiais": seção da consulta na aba Fechamentos, GET /api/ped/imagens sem filial, com o Bearer, e todas as imagens', async () => {
    const chamadas = simularSessao('admin')

    const secao = await abrirTela()

    expect(within(secao).getByRole('heading', { level: 2, name: TITULO_CONSULTA_IMAGENS })).toBeInTheDocument()
    expect(within(secao).getByRole('table', { name: LEGENDA_TABELA_IMAGENS })).toBeInTheDocument()
    expect(codigosNaConsulta()).toEqual(['IMG-000004', 'IMG-000003', 'IMG-000002', 'IMG-000001'])
    expect(getsImagens(chamadas).length).toBeGreaterThan(0)
    for (const chamada of getsImagens(chamadas)) {
      expect(chamada.url.searchParams.has('filial')).toBe(false)
      expect(cabecalhoDaChamada(chamada, 'Authorization')).toBe('Bearer token-salvo')
    }
    // A seção fica abaixo da lista de dashboards da F10.2 ("Encerrar período por dashboard") e fora dela.
    const lista = screen.getByRole('region', { name: SECAO_LISTA_FECHAMENTOS })
    expect(lista.compareDocumentPosition(secao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(lista.contains(secao)).toBe(false)
    expect(within(secao).queryByRole('table', { name: 'Fechamentos por dashboard' })).not.toBeInTheDocument()
  })

  it('a linha mostra dashboard, colaborador e cargo, tipo, período, filial, data, usuário e PED; imagem de filial sem colaborador', async () => {
    simularSessao('admin')

    await abrirTela()

    const ana = within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000003') }).closest('tr')!
    for (const texto of ['PED Gerentes', 'Ana Souza', 'Gerente de Loja', 'Colaborador', '10/2026', '100 - MATRIZ', 'admin']) {
      expect(within(ana).getByText(texto)).toBeInTheDocument()
    }
    const comercial = within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000001') }).closest('tr')!
    for (const texto of ['PED Comercial', TEXTO_FILIAL_SEM_COLABORADOR, 'Filial', '3º tri/2026', '100 - MATRIZ', 'Ana Costa']) {
      expect(within(comercial).getByText(texto)).toBeInTheDocument()
    }
  })

  it('Validador também vê as imagens de todas as filiais (A-05)', async () => {
    const chamadas = simularSessao('validador')

    await abrirTela()

    expect(codigosNaConsulta()).toHaveLength(4)
    for (const chamada of getsImagens(chamadas)) expect(chamada.url.searchParams.has('filial')).toBe(false)
  })

  it('escolher uma filial no cabeçalho consulta ?filial={código} e mostra só as imagens dela; voltar a "Todas" mostra todas', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await user.selectOptions(seletorFilial(), '100')

    await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003', 'IMG-000001']))
    expect(getsImagens(chamadas).at(-1)!.url.searchParams.get('filial')).toBe('100')
    expect(await within(regiao()).findByText('2 de 2 imagens')).toBeInTheDocument()

    await user.selectOptions(seletorFilial(), 'todas')

    await waitFor(() => expect(codigosNaConsulta()).toHaveLength(4))
    expect(getsImagens(chamadas).at(-1)!.url.searchParams.has('filial')).toBe(false)
  })

  it('filtros por período, tipo e busca vão à API juntos com a filial e "Limpar filtros" volta a todas', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()
    await user.selectOptions(seletorFilial(), '100')
    await waitFor(() => expect(codigosNaConsulta()).toHaveLength(2))

    await user.selectOptions(filtroPeriodo(), '10/2026')
    await user.selectOptions(filtroTipo(), 'Colaborador')
    await user.type(busca(), 'ana')

    await waitFor(() => {
      const parametros = getsImagens(chamadas).at(-1)!.url.searchParams
      expect(Object.fromEntries(parametros.entries())).toEqual({ filial: '100', periodo: '10/2026', tipo: 'colaborador', busca: 'ana' })
    })
    await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003']))

    await user.click(within(regiao()).getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(codigosNaConsulta()).toEqual(['IMG-000003', 'IMG-000001']))
    expect(Object.fromEntries(getsImagens(chamadas).at(-1)!.url.searchParams.entries())).toEqual({ filial: '100' })
  })

  it('busca sem resultado mostra "Nenhuma imagem encontrada com os filtros selecionados."', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    await user.type(busca(), 'nada')

    expect(await within(regiao()).findByText(TEXTO_SEM_IMAGENS_FILTRO)).toBeInTheDocument()
    expect(codigosNaConsulta()).toEqual([])
  })

  it('"Visualizar imagem" abre o diálogo com a imagem completa (GET /api/ped/imagens/{id}) e "Fechar" volta à consulta', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await user.click(within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000003') }))

    const dialogo = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
    const detalhe = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `${ROTA}/3`)
    expect(detalhe).toHaveLength(1)
    expect(cabecalhoDaChamada(detalhe[0], 'Authorization')).toBe('Bearer token-salvo')

    await user.click(within(dialogo).getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(codigosNaConsulta()).toHaveLength(4)
  })

  it('imagem de filial também pode ser visualizada', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    await user.click(within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000002') }))

    const dialogo = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000002') })
    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000002' })).toBeInTheDocument()
  })

  it('erro ao abrir a imagem: alerta no diálogo e "Tentar novamente" mostra a imagem', async () => {
    const user = usuarioRapido()
    let falhar = true
    const api = criarApiConsultaImagensFalsa()
    simularSessao('admin', {
      [`GET ${ROTA}/3`]: (init, url) => (falhar ? respostaErro(500) : api.rotas[`GET ${ROTA}/3`](init, url)),
    })
    await abrirTela()
    await user.click(within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000003') }))
    const dialogo = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))

    falhar = false
    await user.click(within(dialogo).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
  })

  it('erro na consulta: alerta na seção e "Tentar novamente" carrega as imagens', async () => {
    const user = usuarioRapido()
    let falhar = true
    const api = criarApiConsultaImagensFalsa()
    simularSessao('admin', {
      [`GET ${ROTA}`]: (init, url) => (falhar ? respostaErro(500) : api.rotas[`GET ${ROTA}`](init, url)),
    })
    renderizarApp('/fechamentos')
    const secao = await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })

    expect(await within(secao).findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))

    falhar = false
    await user.click(within(secao).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(codigosNaConsulta()).toHaveLength(4))
  })

  it('falha na lista de fechamentos não impede a consulta de imagens', async () => {
    simularSessao('admin', { 'GET /api/ped/fechamentos': () => respostaErro(500) })

    renderizarApp('/fechamentos')

    await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })
    await waitFor(() => expect(codigosNaConsulta()).toHaveLength(4))
  })

  it('somente leitura (RN-18): a consulta e a visualização só fazem GET', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()
    await user.selectOptions(filtroTipo(), 'Filial')
    await waitFor(() => expect(codigosNaConsulta()).toHaveLength(2))
    await user.click(within(regiao()).getByRole('button', { name: rotuloVisualizarImagem('IMG-000001') }))
    await within(await screen.findByRole('dialog')).findByRole('region', { name: 'Imagem IMG-000001' })

    const imagens = chamadas.filter((c) => c.caminho.startsWith(ROTA))
    expect(imagens.length).toBeGreaterThan(0)
    expect(imagens.every((c) => c.metodo === 'GET')).toBe(true)
  })
})
