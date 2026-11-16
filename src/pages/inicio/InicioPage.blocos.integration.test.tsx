/**
 * F11.6 — Blocos "Indicadores com meta pendente" e "Dashboards em construção" no Início (integração: app
 * completo com a rede simulada). Atividade não planejada, pedida em 13/11/2026.
 *
 * Só para o Admin e o Validador. O Início consulta as rotas que já existem, sem filial:
 * - `GET /api/ped/indicadores-cadastro?situacao=meta` e `?situacao=meta_filial_pendente` (os filtros de meta
 *   pendente da aba Indicadores: sem meta e meta pendente por filial — F6.12); a lista do bloco é a união das
 *   duas, sem repetir indicador, em ordem alfabética;
 * - `GET /api/ped/dashboards?situacao=construcao`.
 *
 * Exibição:
 * - faixa de resumo: lista "Pendências do cadastro" com os cards "Indicadores com meta pendente" e
 *   "Dashboards em construção" e as quantidades (a lista "Indicadores-resumo" da API não muda);
 * - painel (região) "Indicadores com meta pendente": nome, "Tipos: ..." e "Filiais sem meta: ..." e o link
 *   "Ver indicadores" (`/indicadores`);
 * - painel (região) "Dashboards em construção": nome, periodicidade, "Tarefa #N" ou "Aguardando envio ao
 *   Bitrix" e o link "Ver dashboards" (`/dashboards`);
 * - vazios: "Nenhum indicador com meta pendente." e "Nenhum dashboard em construção.";
 * - falha de uma consulta: o painel mostra um aviso curto (sem `role="alert"`), o card fica sem número e o
 *   resto do Início continua.
 * Trocar a filial do cabeçalho não consulta de novo as listagens (elas não usam filial).
 *
 * O Preenchedor não vê os blocos e não dispara as consultas.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { respostaErro, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  NOMES_DASHBOARDS_CONSTRUCAO,
  NOMES_INDICADORES_META_PENDENTE,
  ROTA_DASHBOARDS,
  ROTA_INDICADORES_CADASTRO,
  dashboardsSemConstrucaoApi,
  indicadoresSemPendenciaApi,
  rotaDashboardsConstrucao,
  rotaIndicadoresMetaPendente,
  rotasDoInicioComBlocos,
} from '../../test/inicioBlocosFalsos'
import { rotasDoInicio } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const TITULO_INDICADORES = 'Indicadores com meta pendente'
const TITULO_DASHBOARDS = 'Dashboards em construção'
const FALHA_INDICADORES = 'Não foi possível carregar os indicadores com meta pendente.'
const FALHA_DASHBOARDS = 'Não foi possível carregar os dashboards em construção.'

describe('F11.6 — Indicadores com meta pendente e dashboards em construção no Início (integração)', () => {
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

  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
  const regiaoIndicadores = () => screen.getByRole('region', { name: TITULO_INDICADORES })
  const regiaoDashboards = () => screen.getByRole('region', { name: TITULO_DASHBOARDS })
  const regiaoPeriodos = () => screen.getByRole('region', { name: 'Períodos em aberto' })
  const cards = () => within(screen.getByRole('list', { name: 'Pendências do cadastro' })).getAllByRole('listitem')
  const itensDe = (regiao: HTMLElement) => within(regiao).queryAllByRole('listitem')
  const nomesDe = (regiao: HTMLElement, nomes: readonly string[]) =>
    itensDe(regiao).map((item) => nomes.find((nome) => within(item).queryByText(nome) !== null))

  const getsIndicadores = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_INDICADORES_CADASTRO)
  const getsDashboards = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_DASHBOARDS)
  const getsInicio = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/inicio')

  /** Abre o Início e espera os dois painéis carregados (algum item ou mensagem final em cada um). */
  async function abrirInicio() {
    const resultado = renderizarApp('/')
    await screen.findByRole('link', { name: 'Preencher PED Comercial' })
    await screen.findByRole('region', { name: TITULO_INDICADORES })
    await screen.findByRole('region', { name: TITULO_DASHBOARDS })
    return resultado
  }

  async function esperarPaineisCarregados(indicadores: number, dashboards: number) {
    await waitFor(() => expect(itensDe(regiaoIndicadores())).toHaveLength(indicadores))
    await waitFor(() => expect(itensDe(regiaoDashboards())).toHaveLength(dashboards))
  }

  describe('Admin', () => {
    it('faixa de resumo: cards "Indicadores com meta pendente" (3) e "Dashboards em construção" (4), sem mudar os indicadores-resumo da API', async () => {
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      const [indicadores, dashboards] = cards()
      expect(cards()).toHaveLength(2)
      expect(within(indicadores).getByText(TITULO_INDICADORES)).toBeInTheDocument()
      await waitFor(() => expect(within(cards()[0]).getByText('3')).toBeInTheDocument())
      expect(within(dashboards).getByText(TITULO_DASHBOARDS)).toBeInTheDocument()
      await waitFor(() => expect(within(cards()[1]).getByText('4')).toBeInTheDocument())
      expect(within(screen.getByRole('list', { name: 'Indicadores-resumo' })).getAllByRole('listitem')).toHaveLength(5)
    })

    it('painel "Indicadores com meta pendente": sem meta e com meta pendente por filial, sem repetição, em ordem alfabética, com tipos e filiais sem meta', async () => {
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      expect(nomesDe(regiaoIndicadores(), NOMES_INDICADORES_META_PENDENTE)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
      const [absenteismo, devolucoes, ticket] = itensDe(regiaoIndicadores())
      expect(within(absenteismo).getByText('Tipos: Logística, Financeiro')).toBeInTheDocument()
      expect(within(absenteismo).getByText('Filiais sem meta: 100, 101, 102')).toBeInTheDocument()
      expect(within(devolucoes).getByText('Tipos: Comercial')).toBeInTheDocument()
      expect(within(devolucoes).queryByText(/Filiais sem meta/)).not.toBeInTheDocument()
      expect(within(ticket).getByText('Filiais sem meta: 101, 102')).toBeInTheDocument()
    })

    it('painel "Dashboards em construção": nome, periodicidade e tarefa do Bitrix (número ou aguardando envio), na ordem da API', async () => {
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      expect(nomesDe(regiaoDashboards(), NOMES_DASHBOARDS_CONSTRUCAO)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
      const [supervisores, logistica, novosNegocios, expansao] = itensDe(regiaoDashboards())
      expect(within(supervisores).getByText('Semestral')).toBeInTheDocument()
      expect(within(supervisores).getByText('Tarefa #40')).toBeInTheDocument()
      expect(within(logistica).getByText('Bimestral')).toBeInTheDocument()
      expect(within(logistica).getByText('Tarefa #41')).toBeInTheDocument()
      expect(within(novosNegocios).getByText('Mensal')).toBeInTheDocument()
      expect(within(novosNegocios).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
      expect(within(expansao).getByText('Anual')).toBeInTheDocument()
      expect(within(expansao).queryByText(/Tarefa #|Aguardando envio/)).not.toBeInTheDocument()
    })

    it('consultas: indicadores com situacao=meta e situacao=meta_filial_pendente e dashboards com situacao=construcao, sem filial; o GET do Início continua único', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      expect(getsIndicadores(chamadas).map((c) => c.url.searchParams.get('situacao')).sort()).toEqual(['meta', 'meta_filial_pendente'])
      expect(getsDashboards(chamadas)).toHaveLength(1)
      expect(getsDashboards(chamadas)[0].url.searchParams.get('situacao')).toBe('construcao')
      for (const chamada of [...getsIndicadores(chamadas), ...getsDashboards(chamadas)]) {
        expect(chamada.url.searchParams.has('filial')).toBe(false)
      }
      expect(getsInicio(chamadas)).toHaveLength(1)
    })

    it('"Ver indicadores" leva à aba Indicadores', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      const { roteador } = await abrirInicio()

      await user.click(within(regiaoIndicadores()).getByRole('link', { name: 'Ver indicadores' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Indicadores' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/indicadores')
    })

    it('"Ver dashboards" leva à aba Dashboards', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      const { roteador } = await abrirInicio()

      await user.click(within(regiaoDashboards()).getByRole('link', { name: 'Ver dashboards' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Dashboards' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/dashboards')
    })

    it('trocar a filial do cabeçalho atualiza o Início, mantém os blocos e não consulta de novo as listagens', async () => {
      const user = usuarioRapido()
      const chamadas = simularApi(fetchFalso, rotasDoInicioComBlocos('admin'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      await user.selectOptions(seletorFilial(), '101')

      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
      await waitFor(() => expect(within(regiaoPeriodos()).queryByRole('link', { name: 'Preencher PED Gerentes' })).not.toBeInTheDocument())
      await esperarPaineisCarregados(3, 4)
      expect(getsIndicadores(chamadas)).toHaveLength(2)
      expect(getsDashboards(chamadas)).toHaveLength(1)
    })

    it('listas vazias: "Nenhum indicador com meta pendente.", "Nenhum dashboard em construção." e os cards com 0', async () => {
      simularApi(
        fetchFalso,
        rotasDoInicioComBlocos('admin', {
          [`GET ${ROTA_INDICADORES_CADASTRO}`]: rotaIndicadoresMetaPendente(indicadoresSemPendenciaApi),
          [`GET ${ROTA_DASHBOARDS}`]: rotaDashboardsConstrucao(dashboardsSemConstrucaoApi),
        }),
      )
      await abrirInicio()

      expect(await within(regiaoIndicadores()).findByText('Nenhum indicador com meta pendente.')).toBeInTheDocument()
      expect(await within(regiaoDashboards()).findByText('Nenhum dashboard em construção.')).toBeInTheDocument()
      await waitFor(() => expect(within(cards()[0]).getByText('0')).toBeInTheDocument())
      await waitFor(() => expect(within(cards()[1]).getByText('0')).toBeInTheDocument())
    })
  })

  describe('falhas (não derrubam a tela Início)', () => {
    it('falha dos indicadores (500): aviso curto no painel, card sem número; dashboards e o resto do Início continuam, sem role="alert"', async () => {
      simularApi(
        fetchFalso,
        rotasDoInicioComBlocos('admin', { [`GET ${ROTA_INDICADORES_CADASTRO}`]: () => respostaErro(500, 'Falha ao listar os indicadores.') }),
      )
      await abrirInicio()

      expect(await within(regiaoIndicadores()).findByText(FALHA_INDICADORES)).toBeInTheDocument()
      await waitFor(() => expect(itensDe(regiaoDashboards())).toHaveLength(4))
      expect(itensDe(regiaoIndicadores())).toHaveLength(0)
      expect(cards()[0]).not.toHaveTextContent(/\d/)
      await waitFor(() => expect(within(cards()[1]).getByText('4')).toBeInTheDocument())
      expect(itensDe(regiaoPeriodos())).toHaveLength(3)
      expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    })

    it('falha dos dashboards (500): aviso curto no painel, card sem número; indicadores e o resto do Início continuam, sem role="alert"', async () => {
      simularApi(fetchFalso, rotasDoInicioComBlocos('admin', { [`GET ${ROTA_DASHBOARDS}`]: () => respostaErro(500, 'Falha ao listar os dashboards.') }))
      await abrirInicio()

      expect(await within(regiaoDashboards()).findByText(FALHA_DASHBOARDS)).toBeInTheDocument()
      await waitFor(() => expect(itensDe(regiaoIndicadores())).toHaveLength(3))
      expect(itensDe(regiaoDashboards())).toHaveLength(0)
      expect(cards()[1]).not.toHaveTextContent(/\d/)
      await waitFor(() => expect(within(cards()[0]).getByText('3')).toBeInTheDocument())
      expect(itensDe(regiaoPeriodos())).toHaveLength(3)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('sem as duas rotas (404): os dois painéis com o aviso, os cards sem número e o Início completo, sem role="alert"', async () => {
      simularApi(fetchFalso, rotasDoInicio('admin'))
      await abrirInicio()

      expect(await within(regiaoIndicadores()).findByText(FALHA_INDICADORES)).toBeInTheDocument()
      expect(await within(regiaoDashboards()).findByText(FALHA_DASHBOARDS)).toBeInTheDocument()
      expect(cards()[0]).not.toHaveTextContent(/\d/)
      expect(cards()[1]).not.toHaveTextContent(/\d/)
      expect(itensDe(regiaoPeriodos())).toHaveLength(3)
      expect(within(screen.getByRole('list', { name: 'Indicadores-resumo' })).getAllByRole('listitem')).toHaveLength(5)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Validador', () => {
    it('vê os cards e os dois painéis, com as mesmas consultas', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicioComBlocos('validador'))
      await abrirInicio()
      await esperarPaineisCarregados(3, 4)

      expect(nomesDe(regiaoIndicadores(), NOMES_INDICADORES_META_PENDENTE)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
      expect(nomesDe(regiaoDashboards(), NOMES_DASHBOARDS_CONSTRUCAO)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
      await waitFor(() => expect(within(cards()[0]).getByText('3')).toBeInTheDocument())
      await waitFor(() => expect(within(cards()[1]).getByText('4')).toBeInTheDocument())
      expect(getsIndicadores(chamadas).map((c) => c.url.searchParams.get('situacao')).sort()).toEqual(['meta', 'meta_filial_pendente'])
      expect(getsDashboards(chamadas)).toHaveLength(1)
      expect(within(regiaoIndicadores()).getByRole('link', { name: 'Ver indicadores' })).toHaveAttribute('href', '/indicadores')
      expect(within(regiaoDashboards()).getByRole('link', { name: 'Ver dashboards' })).toHaveAttribute('href', '/dashboards')
    })
  })

  describe('Preenchedor', () => {
    it('não vê os cards nem os painéis e não consulta indicadores nem dashboards', async () => {
      const chamadas = simularApi(fetchFalso, rotasDoInicioComBlocos('preenchedor'))
      renderizarApp('/')
      await screen.findByRole('link', { name: 'Preencher PED Comercial' })
      await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))

      expect(screen.queryByRole('region', { name: TITULO_INDICADORES })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: TITULO_DASHBOARDS })).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Pendências do cadastro' })).not.toBeInTheDocument()
      expect(screen.queryByText(TITULO_INDICADORES)).not.toBeInTheDocument()
      expect(screen.queryByText(TITULO_DASHBOARDS)).not.toBeInTheDocument()
      expect(getsIndicadores(chamadas)).toHaveLength(0)
      expect(getsDashboards(chamadas)).toHaveLength(0)
      // O resto do Início continua como antes.
      expect(within(screen.getByRole('list', { name: 'Indicadores-resumo' })).getAllByRole('listitem')).toHaveLength(4)
    })
  })
})
