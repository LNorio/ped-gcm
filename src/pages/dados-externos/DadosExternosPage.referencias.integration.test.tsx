import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_RESPOSTA_INVALIDA } from '../../services/api'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  dadosExternosApi,
  identificadoresApi,
  respostaCriacaoApi,
  rotaListarDadosExternos,
  tarefaBitrixCriadaApi,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dados-externos-cadastro'

type Perfil = 'admin' | 'validador' | 'preenchedor'
type Referencia = 'colaborador' | 'zona'

const ROTULO_REFERENCIA: Record<Referencia, string> = { colaborador: 'Colaborador', zona: 'Zona de venda' }

/**
 * F5.10 — Referências Colaborador e Zona de venda de ponta a ponta (integração: /dados-externos; RF-25,
 * INT-03; A-11 resolvida em parte em 06/11/2026, item 7 de docs/backend/FRONT-PED-mudancas (1).md e
 * seção "Referência" do API (31).md). O POST aceita `referencia` `colaborador` e `zona`; o dado é
 * cadastrado, mas ainda sem coleta (`"coleta disponivel": false`), o que é "sem coleta ainda" e não erro:
 * o cadastro termina normalmente e a listagem mostra o dado com a referência certa, sem aviso de erro.
 *
 * Fora do escopo: o vínculo colaborador ↔ zona de venda em GET /api/ped/vinculos (o back-end ainda não
 * tratou e não há decisão do negócio).
 */
describe('F5.10 — Dados externos com referência Colaborador e Zona de venda (integração: /dados-externos)', () => {
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

  /**
   * Sessão com a API falsa. O POST grava na lista o dado com a referência enviada e
   * `"coleta disponivel": false` (como a API faz para colaborador e zona); Admin cadastra ativo, sem tarefa;
   * Validador e Preenchedor recebem a tarefa de construção.
   */
  function simularSessao(perfil: Perfil, listaInicial: DadoExternoApiFalso[] = dadosExternosApi()) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, nome: 'Fulano', tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, nome: 'Beltrano', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = listaInicial
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`POST ${ROTA}`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as {
          nome: string
          referencia: DadoExternoApiFalso['referencia']
          identificador: string | null
          'campo calculo': string | null
        }
        const base = perfil === 'admin' ? DADO_FATURAMENTO_API : DADO_DEVOLUCOES_API
        const criado: DadoExternoApiFalso = {
          ...base,
          id: 40,
          nome: corpo.nome,
          referencia: corpo.referencia,
          identificador: corpo.identificador,
          'campo calculo': corpo['campo calculo'],
          'coleta disponivel': false,
          'cadastrado em': '2026-11-24 10:00:00',
          'cadastrado por': acesso.nome,
        }
        lista = [...lista, criado]
        const tarefa = perfil === 'admin' ? null : tarefaBitrixCriadaApi(`[PED] Construir dado externo: ${corpo.nome}`, '1051')
        return respostaJson(respostaCriacaoApi(criado, tarefa), 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsLista = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await user.click(screen.getByRole('button', { name: 'Novo dado externo' }))
    return screen.getByRole('dialog', { name: 'Novo dado externo' })
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, campo: string, rotulo: string) {
    const select = within(dialogo).getByRole('combobox', { name: campo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  async function preencher(user: Usuario, dialogo: HTMLElement, perfil: Perfil, nome: string, referencia: Referencia) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), nome)
    await escolher(user, dialogo, 'Tipo', 'Comercial')
    await escolher(user, dialogo, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, dialogo, 'Tipo de valor', 'Numeral')
    await escolher(user, dialogo, 'Referência', ROTULO_REFERENCIA[referencia])
    await escolher(user, dialogo, 'Coleta', 'Diária')
    await escolher(user, dialogo, 'Sentido do cálculo', 'Usar só o último valor')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' }), 'Soma por vendedor no mês.')
    if (perfil === 'admin') await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'positivacao')
  }

  /** Abre "Ver detalhes" do dado e devolve o valor (`<dd>`) de "Referência". */
  async function referenciaNosDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    const tabela = screen.getByRole('table', { name: 'Dados externos' })
    await escolherAcao(user, rotuloAcoesDadoExterno(nome), 'Ver detalhes')
    const detalhes = within(tabela).getByText(nome).closest('tr')!.nextElementSibling as HTMLElement
    const termo = within(detalhes).getByText('Referência', { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement
    expect(valor.tagName).toBe('DD')
    return valor
  }

  describe('cadastro pelo Admin', () => {
    it.each<Referencia>(['colaborador', 'zona'])(
      'referência "%s": o POST leva "referencia": "%s"; com "coleta disponivel": false na resposta, o cadastro termina sem erro ("Dado externo cadastrado.") e a lista mostra o novo dado com a referência',
      async (referencia) => {
        const user = usuarioRapido()
        const chamadas = simularSessao('admin')
        const dialogo = await abrirCadastro(user)
        await preencher(user, dialogo, 'admin', 'Positivação por vendedor', referencia)

        await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

        expect(await screen.findByText('Dado externo cadastrado.')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(posts(chamadas)).toHaveLength(1)
        expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ referencia, identificador: 'POSITIVACAO' })
        await waitFor(() => expect(getsLista(chamadas)).toHaveLength(2))
        const linha = (await screen.findByText('Positivação por vendedor')).closest('tr')!
        expect(within(linha).getByText('Ativo')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(await referenciaNosDetalhes(user, 'Positivação por vendedor')).toHaveTextContent(ROTULO_REFERENCIA[referencia])
      },
    )
  })

  describe('pedido de construção (Validador e Preenchedor)', () => {
    it.each<[Perfil, Referencia]>([
      ['validador', 'zona'],
      ['validador', 'colaborador'],
      ['preenchedor', 'zona'],
      ['preenchedor', 'colaborador'],
    ])('%s com referência "%s": o POST leva a referência, o pedido é enviado à TI sem erro e a lista mostra o dado com a referência', async (perfil, referencia) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil)
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, perfil, 'Vendas por zona de venda', referencia)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      const resultado = await screen.findByRole('dialog', { name: 'Pedido enviado à TI' })
      expect(within(resultado).getByText('Tarefa #1051 criada no Bitrix para a equipe de TI.')).toBeInTheDocument()
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ referencia, identificador: null })
      await user.click(within(resultado).getByRole('button', { name: 'Entendi' }))
      const linha = (await screen.findByText('Vendas por zona de venda')).closest('tr')!
      expect(within(linha).getByText('Em construção (TI)')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(await referenciaNosDetalhes(user, 'Vendas por zona de venda')).toHaveTextContent(ROTULO_REFERENCIA[referencia])
    })
  })

  describe('listagem', () => {
    it.each<Perfil>(['admin', 'validador', 'preenchedor'])(
      '%s: dados de referência Colaborador e Zona de venda ainda sem coleta ("coleta disponivel": false) aparecem normalmente, sem "Resposta inválida do servidor." nem aviso de erro',
      async (perfil) => {
        const user = usuarioRapido()
        simularSessao(perfil, [
          DADO_FATURAMENTO_API,
          { ...DADO_FATURAMENTO_API, id: 41, nome: 'Positivação por vendedor', referencia: 'colaborador', identificador: 'POSITIVACAO', 'coleta disponivel': false },
          { ...DADO_FATURAMENTO_API, id: 42, nome: 'Vendas por zona de venda', referencia: 'zona', identificador: 'VENDAS_ZONA', 'coleta disponivel': false },
        ])
        renderizarApp('/dados-externos')

        const tabela = await screen.findByRole('table', { name: 'Dados externos' })

        expect(within(tabela).getByText('Positivação por vendedor')).toBeInTheDocument()
        expect(within(tabela).getByText('Vendas por zona de venda')).toBeInTheDocument()
        expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(await referenciaNosDetalhes(user, 'Faturamento líquido')).toHaveTextContent('Filial')
        expect(await referenciaNosDetalhes(user, 'Positivação por vendedor')).toHaveTextContent('Colaborador')
        expect(await referenciaNosDetalhes(user, 'Vendas por zona de venda')).toHaveTextContent('Zona de venda')
      },
    )
  })
})
