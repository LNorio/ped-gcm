import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  COLUNAS_CONSULTA_IMAGENS,
  LEGENDA_TABELA_IMAGENS,
  TEXTO_FILIAL_SEM_COLABORADOR,
  TEXTO_SEM_IMAGENS,
  TEXTO_SEM_IMAGENS_FILTRO,
  TITULO_CONSULTA_IMAGENS,
  adiado,
  criarApiConsultaImagensFalsa,
  rotuloVisualizarImagem,
  tituloDialogoImagem,
} from '../../test/consultaImagensFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { ImagemCongelada } from '../../types/dominio'
import { formatarDataHora, formatarPercentual } from '../../utils/formato'
import { ConsultaImagens } from './ConsultaImagens'

// A visualização da imagem é da F10.3 e tem testes próprios: aqui só importa que ela recebe a imagem.
vi.mock('./VisualizacaoImagem', () => ({
  VisualizacaoImagem: ({ imagem }: { imagem: ImagemCongelada }) => <section aria-label={`Imagem ${imagem.codigo ?? ''}`} />,
}))

const ROTA = '/api/ped/imagens'

/**
 * F10.6 — Seção da consulta retroativa de imagens (`src/pages/fechamentos/ConsultaImagens.tsx`, sem props;
 * RF-84, RN-18). Fica na aba Fechamentos, abaixo da lista de dashboards (como no protótipo):
 * - região com título (h2) "Imagens congeladas — consulta retroativa" e o texto "{n} de {total} imagens";
 * - filtros: busca "Buscar imagens" (placeholder "Buscar dashboard, colaborador, cargo, filial, código ou
 *   usuário..."), "Período das imagens" ("Todos os períodos" + períodos com imagens), "Tipo de imagem"
 *   ("Todos os tipos", "Filial", "Colaborador") e "Limpar filtros" (só com filtro ativo);
 * - tabela "Imagens congeladas" com Dashboard, Colaborador (nome e cargo; "Filial (sem colaborador
 *   vinculado)" nas imagens de filial), Tipo, Período, Filial ("código - nome" ou só o código), Gerada em,
 *   Por, PED e Ação (botão "Visualizar imagem {código}", que abre o `DialogoImagem`);
 * - vazio: "Nenhuma imagem congelada encontrada." (sem filtros) ou "Nenhuma imagem encontrada com os
 *   filtros selecionados."; carga "Carregando imagens..."; erro com "Tentar novamente".
 */
describe('F10.6 — ConsultaImagens (consulta retroativa de imagens congeladas)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: admin(), filialSelecionada: 'todas' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function simular(rotas: Record<string, RotaFalsa> = {}, linhasCompletas = true) {
    const api = criarApiConsultaImagensFalsa({ linhasCompletas })
    return simularApi(fetchFalso, { ...api.rotas, ...rotas })
  }

  function renderizar() {
    return render(
      <ProvedorSessaoFalso sessao={sessao}>
        <ConsultaImagens />
      </ProvedorSessaoFalso>,
    )
  }

  const regiao = () => screen.getByRole('region', { name: TITULO_CONSULTA_IMAGENS })
  const tabela = () => within(regiao()).getByRole('table', { name: LEGENDA_TABELA_IMAGENS })
  const busca = () => within(regiao()).getByRole('searchbox', { name: 'Buscar imagens' })
  const filtroPeriodo = () => within(regiao()).getByRole('combobox', { name: 'Período das imagens' })
  const filtroTipo = () => within(regiao()).getByRole('combobox', { name: 'Tipo de imagem' })
  const linhaDa = (codigo: string) => screen.getByRole('button', { name: rotuloVisualizarImagem(codigo) }).closest('tr')!
  const textosDaLinha = (codigo: string) => within(linhaDa(codigo)).getAllByRole('cell').map((c) => c.textContent)
  const codigosNaTabela = () =>
    within(regiao())
      .queryAllByRole('button', { name: /^Visualizar imagem / })
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
      .map((rotulo) => rotulo?.replace('Visualizar imagem ', ''))
  const getsImagens = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  async function abrir() {
    renderizar()
    await waitFor(() => expect(codigosNaTabela().length).toBeGreaterThan(0))
  }

  describe('lista (RF-84)', () => {
    it('região com o título (h2), a tabela "Imagens congeladas" e as colunas na ordem', async () => {
      simular()

      await abrir()

      expect(within(regiao()).getByRole('heading', { level: 2, name: TITULO_CONSULTA_IMAGENS })).toBeInTheDocument()
      expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS_CONSULTA_IMAGENS)
    })

    it('mostra todas as imagens na ordem da API e o texto "4 de 4 imagens"', async () => {
      simular()

      await abrir()

      expect(codigosNaTabela()).toEqual(['IMG-000004', 'IMG-000003', 'IMG-000002', 'IMG-000001'])
      expect(await within(regiao()).findByText('4 de 4 imagens')).toBeInTheDocument()
    })

    it('imagem de colaborador: dashboard, colaborador e cargo, tipo, período, filial, data, usuário e PED', async () => {
      simular()

      await abrir()

      const linha = linhaDa('IMG-000003')
      expect(within(linha).getByText('Ana Souza')).toBeInTheDocument()
      expect(within(linha).getByText('Gerente de Loja')).toBeInTheDocument()
      const celulas = textosDaLinha('IMG-000003')
      expect(celulas[0]).toBe('PED Gerentes')
      expect(celulas[1]).toContain('Ana Souza')
      expect(celulas[1]).toContain('Gerente de Loja')
      expect(celulas.slice(2, 8)).toEqual([
        'Colaborador',
        '10/2026',
        '100 - MATRIZ',
        formatarDataHora('2026-11-01 09:00:00-04:00'),
        'admin',
        formatarPercentual(20),
      ])
    })

    it('imagem de filial: "Filial (sem colaborador vinculado)" no lugar do colaborador e tipo "Filial"', async () => {
      simular()

      await abrir()

      expect(textosDaLinha('IMG-000001').slice(0, 8)).toEqual([
        'PED Comercial',
        TEXTO_FILIAL_SEM_COLABORADOR,
        'Filial',
        '3º tri/2026',
        '100 - MATRIZ',
        formatarDataHora('2026-09-30 18:00:00-04:00'),
        'Ana Costa',
        formatarPercentual(99.99),
      ])
      expect(textosDaLinha('IMG-000002')[7]).toBe(formatarPercentual(0))
    })

    it('linha mínima do contrato (sem "nome filial" e sem cargo): filial só pelo código e colaborador só pelo nome', async () => {
      simular({}, false)

      await abrir()

      const celulas = textosDaLinha('IMG-000003')
      expect(celulas[1]).toBe('Ana Souza')
      expect(celulas[4]).toBe('100')
    })

    it('cada linha tem o botão "Visualizar imagem {código}" e nenhuma ação de alterar ou excluir (RN-18)', async () => {
      simular()

      await abrir()

      for (const codigo of ['IMG-000004', 'IMG-000003', 'IMG-000002', 'IMG-000001']) {
        expect(within(linhaDa(codigo)).getByRole('button', { name: rotuloVisualizarImagem(codigo) })).toBeInTheDocument()
      }
      expect(within(regiao()).queryByRole('button', { name: /alterar|editar|excluir/i })).not.toBeInTheDocument()
    })

    it('sem nenhuma imagem: "Nenhuma imagem congelada encontrada." e "0 de 0 imagens"', async () => {
      simular({ [`GET ${ROTA}`]: () => respostaJson([]) })

      renderizar()

      expect(await within(await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })).findByText(TEXTO_SEM_IMAGENS)).toBeInTheDocument()
      expect(await within(regiao()).findByText('0 de 0 imagens')).toBeInTheDocument()
      expect(within(regiao()).queryByText(TEXTO_SEM_IMAGENS_FILTRO)).not.toBeInTheDocument()
    })

    it('com uma filial no cabeçalho: consulta ?filial={código} e mostra só as imagens dela', async () => {
      sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
      const chamadas = simular()

      await abrir()

      expect(codigosNaTabela()).toEqual(['IMG-000002'])
      expect(await within(regiao()).findByText('1 de 1 imagens')).toBeInTheDocument()
      for (const chamada of getsImagens(chamadas)) expect(chamada.url.searchParams.get('filial')).toBe('101')
    })
  })

  describe('filtros (RF-84)', () => {
    it('busca, período e tipo com os rótulos, o placeholder e as opções; sem "Limpar filtros" no padrão', async () => {
      simular()

      await abrir()

      expect(busca()).toHaveAttribute('placeholder', 'Buscar dashboard, colaborador, cargo, filial, código ou usuário...')
      expect(busca()).toHaveValue('')
      expect(within(filtroPeriodo()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos os períodos', '10/2026', '3º tri/2026'])
      expect(filtroPeriodo()).toHaveDisplayValue('Todos os períodos')
      expect(within(filtroTipo()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos os tipos', 'Filial', 'Colaborador'])
      expect(filtroTipo()).toHaveDisplayValue('Todos os tipos')
      expect(within(regiao()).queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('período: mostra só as imagens dele, "2 de 4 imagens" e "Limpar filtros"', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrir()

      await user.selectOptions(filtroPeriodo(), '3º tri/2026')

      await waitFor(() => expect(codigosNaTabela()).toEqual(['IMG-000002', 'IMG-000001']))
      expect(getsImagens(chamadas).at(-1)!.url.searchParams.get('periodo')).toBe('3º tri/2026')
      expect(await within(regiao()).findByText('2 de 4 imagens')).toBeInTheDocument()
      expect(within(regiao()).getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
      // As opções de período continuam todas disponíveis.
      expect(within(filtroPeriodo()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos os períodos', '10/2026', '3º tri/2026'])
    })

    it('tipo "Colaborador": só as imagens de colaborador, com ?tipo=colaborador', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrir()

      await user.selectOptions(filtroTipo(), 'Colaborador')

      await waitFor(() => expect(codigosNaTabela()).toEqual(['IMG-000004', 'IMG-000003']))
      expect(getsImagens(chamadas).at(-1)!.url.searchParams.get('tipo')).toBe('colaborador')
    })

    it('tipo "Filial": só as imagens de filial, com ?tipo=filial', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrir()

      await user.selectOptions(filtroTipo(), 'Filial')

      await waitFor(() => expect(codigosNaTabela()).toEqual(['IMG-000002', 'IMG-000001']))
      expect(getsImagens(chamadas).at(-1)!.url.searchParams.get('tipo')).toBe('filial')
    })

    it('busca: depois da espera, consulta com ?busca= e mostra só as imagens encontradas', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrir()

      await user.type(busca(), 'ana souza')

      expect(busca()).toHaveValue('ana souza')
      await waitFor(() => expect(codigosNaTabela()).toEqual(['IMG-000003']))
      expect(getsImagens(chamadas).at(-1)!.url.searchParams.get('busca')).toBe('ana souza')
      expect(await within(regiao()).findByText('1 de 4 imagens')).toBeInTheDocument()
    })

    it('filtro sem resultado: "Nenhuma imagem encontrada com os filtros selecionados." e "0 de 4 imagens"', async () => {
      const user = usuarioRapido()
      simular()
      await abrir()

      await user.type(busca(), 'inexistente')

      expect(await within(regiao()).findByText(TEXTO_SEM_IMAGENS_FILTRO)).toBeInTheDocument()
      expect(codigosNaTabela()).toEqual([])
      expect(await within(regiao()).findByText('0 de 4 imagens')).toBeInTheDocument()
      expect(within(regiao()).queryByText(TEXTO_SEM_IMAGENS)).not.toBeInTheDocument()
    })

    it('"Limpar filtros" volta busca, período e tipo ao padrão, mostra todas as imagens e some', async () => {
      const user = usuarioRapido()
      simular()
      await abrir()
      await user.selectOptions(filtroPeriodo(), '10/2026')
      await user.selectOptions(filtroTipo(), 'Colaborador')
      await user.type(busca(), 'diego')
      await waitFor(() => expect(codigosNaTabela()).toEqual(['IMG-000004']))

      await user.click(within(regiao()).getByRole('button', { name: 'Limpar filtros' }))

      expect(busca()).toHaveValue('')
      expect(filtroPeriodo()).toHaveDisplayValue('Todos os períodos')
      expect(filtroTipo()).toHaveDisplayValue('Todos os tipos')
      await waitFor(() => expect(codigosNaTabela()).toHaveLength(4))
      expect(within(regiao()).queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })
  })

  describe('carga e erro', () => {
    it('enquanto consulta, anuncia "Carregando imagens..."', async () => {
      const lenta = adiado<void>()
      const api = criarApiConsultaImagensFalsa()
      simularApi(fetchFalso, {
        ...api.rotas,
        [`GET ${ROTA}`]: (init, url) => lenta.promessa.then(() => api.rotas[`GET ${ROTA}`](init, url)),
      })

      renderizar()

      expect(await screen.findByText('Carregando imagens...')).toBeInTheDocument()
      lenta.resolver()
      await waitFor(() => expect(codigosNaTabela()).toHaveLength(4))
      expect(screen.queryByText('Carregando imagens...')).not.toBeInTheDocument()
    })

    it('erro na consulta: alerta com a mensagem e "Tentar novamente", que consulta de novo', async () => {
      const user = usuarioRapido()
      let falhar = true
      const api = criarApiConsultaImagensFalsa()
      simularApi(fetchFalso, {
        ...api.rotas,
        [`GET ${ROTA}`]: (init, url) => (falhar ? respostaErro(500) : api.rotas[`GET ${ROTA}`](init, url)),
      })
      renderizar()

      const alerta = await within(await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })).findByRole('alert')
      expect(alerta).toHaveTextContent(mensagemPadraoPorStatus(500))

      falhar = false
      await user.click(within(regiao()).getByRole('button', { name: 'Tentar novamente' }))

      await waitFor(() => expect(codigosNaTabela()).toHaveLength(4))
      expect(within(regiao()).queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('visualizar (RF-84)', () => {
    it('"Visualizar imagem {código}" abre o diálogo da imagem, que consulta o detalhe e mostra a visualização', async () => {
      const user = usuarioRapido()
      const chamadas = simular()
      await abrir()

      await user.click(screen.getByRole('button', { name: rotuloVisualizarImagem('IMG-000003') }))

      const dialogo = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
      expect(await within(dialogo).findByRole('region', { name: 'Imagem IMG-000003' })).toBeInTheDocument()
      expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `${ROTA}/3`)).toHaveLength(1)
    })

    it('"Fechar" fecha o diálogo; outra imagem abre o diálogo dela', async () => {
      const user = usuarioRapido()
      simular()
      await abrir()
      await user.click(screen.getByRole('button', { name: rotuloVisualizarImagem('IMG-000003') }))
      const dialogo = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })

      await user.click(within(dialogo).getByRole('button', { name: 'Fechar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: rotuloVisualizarImagem('IMG-000001') }))

      const outro = await screen.findByRole('dialog', { name: tituloDialogoImagem('IMG-000001') })
      expect(await within(outro).findByRole('region', { name: 'Imagem IMG-000001' })).toBeInTheDocument()
    })
  })
})
