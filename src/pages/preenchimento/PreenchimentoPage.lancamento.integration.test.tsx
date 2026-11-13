import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson } from '../../test/apiFalsa'
import {
  ROTA_PREENCHIMENTO,
  getsDe,
  putsPreenchimento,
  simularSessaoPreenchimento,
  telaComPedidosApi,
  type OpcoesSessaoPreenchimento,
  type PerfilPreenchimento,
} from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

/**
 * Lançamento em lote na aba Preenchimento (F9.6 — RF-66, RF-67, RNF-03). Fluxo completo com a rede
 * simulada (tela com dois pendentes: "Vitrine montada" Booleano e "Pedidos digitados" Numeral):
 * - o usuário informa os valores (Sim/Não; número com vírgula decimal, não negativo) e "Salvar
 *   lançamentos" (desabilitado enquanto nenhum valor foi informado) envia num único `PUT` os itens dos
 *   apontamentos ainda sem valor, com os valores já convertidos, na ordem da tela;
 * - valores inválidos ou negativos aparecem na linha do apontamento e nada é enviado;
 * - no sucesso, a notificação informa os lançados e a tela recarrega (os lançados passam a "Preenchido");
 * - na recusa (tudo ou nada), os erros por item aparecem na linha de cada apontamento, a mensagem geral
 *   aparece junto do botão, os valores digitados continuam e a tela não recarrega.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.6 — Lançamento em lote (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const linha = (nome: string) => screen.getByRole('article', { name: nome })
  const salvar = () => screen.getByRole('button', { name: 'Salvar lançamentos' })
  const campoPedidos = () => within(linha('Pedidos digitados')).getByRole('textbox', { name: 'Valor de Pedidos digitados' })

  async function abrirTela(perfil: PerfilPreenchimento = 'preenchedor', opcoes: OpcoesSessaoPreenchimento = {}) {
    const sessao = simularSessaoPreenchimento(fetchFalso, perfil, { tela: telaComPedidosApi(), ...opcoes })
    renderizarApp('/preenchimento')
    await screen.findByRole('article', { name: 'Pedidos digitados' })
    return sessao
  }

  it('"Salvar lançamentos" começa desabilitado e habilita ao informar um valor', async () => {
    const user = usuarioRapido()
    await abrirTela()

    expect(salvar()).toBeDisabled()

    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))

    expect(salvar()).toBeEnabled()
  })

  it('lote: um único PUT com os itens informados, valores convertidos (true e 1234,5), na ordem da tela', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.type(campoPedidos(), '1.234,5')
    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))
    await user.click(salvar())

    await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual({
      filial: '101',
      'mes de referencia': '2026-10-01',
      itens: [
        { 'id apontamento': 7, valor: true },
        { 'id apontamento': 11, valor: 1234.5 },
      ],
    })
  })

  it('sucesso: notificação "2 lançamentos salvos.", a tela recarrega e os lançados viram "Preenchido" sem campo', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()
    const telasAntes = getsDe(chamadas, ROTA_PREENCHIMENTO).length

    await user.type(campoPedidos(), '42')
    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Não' }))
    await user.click(salvar())

    expect(await screen.findByText('2 lançamentos salvos.')).toBeInTheDocument()
    await waitFor(() => expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(telasAntes + 1))
    await waitFor(() => expect(within(linha('Pedidos digitados')).getByText('Preenchido')).toBeInTheDocument())
    expect(within(linha('Pedidos digitados')).getByText('42,00')).toBeInTheDocument()
    expect(within(linha('Pedidos digitados')).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(linha('Vitrine montada')).getByText('Preenchido')).toBeInTheDocument()
    expect(within(linha('Vitrine montada')).getByText('Não')).toBeInTheDocument()
    expect(within(linha('Vitrine montada')).getByRole('button', { name: 'Corrigir' })).toBeInTheDocument()
  })

  it('só os apontamentos com valor informado entram no lote ("1 lançamento salvo.")', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.type(campoPedidos(), '0')
    await user.click(salvar())

    await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual(
      expect.objectContaining({ itens: [{ 'id apontamento': 11, valor: 0 }] }),
    )
    expect(await screen.findByText('1 lançamento salvo.')).toBeInTheDocument()
  })

  it('valor negativo: o erro aparece na linha do apontamento e nada é enviado', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.type(campoPedidos(), '-5')
    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))
    await user.click(salvar())

    expect(await within(linha('Pedidos digitados')).findByRole('alert')).toHaveTextContent('O valor não pode ser negativo.')
    expect(putsPreenchimento(chamadas)).toHaveLength(0)
  })

  it('valor fora do padrão pt-BR (ponto decimal): erro de número inválido na linha e nada é enviado', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.type(campoPedidos(), '12.5')
    await user.click(salvar())

    expect(await within(linha('Pedidos digitados')).findByRole('alert')).toHaveTextContent(
      'Informe um número válido, com vírgula decimal (ex.: 1.234,56).',
    )
    expect(putsPreenchimento(chamadas)).toHaveLength(0)
  })

  it('recusa da API com erros por item: erro na linha do apontamento, mensagem geral, valores mantidos e sem recarga', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela('preenchedor', {
      respostaPut: () =>
        respostaJson(
          { mensagem: 'Lote recusado: nenhum item foi gravado.', erros: [{ 'id apontamento': 11, mensagem: 'Apontamento desativado.' }] },
          400,
        ),
    })
    const telasAntes = getsDe(chamadas, ROTA_PREENCHIMENTO).length

    await user.type(campoPedidos(), '10')
    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))
    await user.click(salvar())

    expect(await within(linha('Pedidos digitados')).findByText('Apontamento desativado.')).toBeInTheDocument()
    expect(screen.getByText('Lote recusado: nenhum item foi gravado.')).toBeInTheDocument()
    expect(within(linha('Vitrine montada')).queryByRole('alert')).not.toBeInTheDocument()
    expect(campoPedidos()).toHaveValue('10')
    expect(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true')
    expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(telasAntes)
    expect(screen.queryByText(/lançamentos? salvos?\./)).not.toBeInTheDocument()
  })

  it('recusa sem erros por item (403): mostra a mensagem da API e mantém os valores', async () => {
    const user = usuarioRapido()
    await abrirTela('preenchedor', { respostaPut: () => respostaErro(403, 'Você não tem acesso a este tipo de apontamento.') })

    await user.type(campoPedidos(), '10')
    await user.click(salvar())

    expect(await screen.findByText('Você não tem acesso a este tipo de apontamento.')).toBeInTheDocument()
    expect(campoPedidos()).toHaveValue('10')
  })

  it('falha de rede: "Não foi possível conectar ao servidor." e os valores continuam', async () => {
    const user = usuarioRapido()
    await abrirTela('preenchedor', {
      respostaPut: () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await user.type(campoPedidos(), '10')
    await user.click(salvar())

    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument()
    expect(campoPedidos()).toHaveValue('10')
  })

  // Revisão da F9 em 13/11/2026: erro local num apontamento escondido pela busca.
  describe('erro de validação num apontamento oculto pela busca', () => {
    const busca = () => screen.getByRole('searchbox', { name: 'Buscar apontamento ou indicador' })

    it('limpa a busca, mostra todos os tipos e apontamentos, exibe o erro na linha e leva o foco ao campo inválido', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()

      await user.type(campoPedidos(), '-5')
      await user.type(busca(), 'Vitrine')
      expect(screen.queryByRole('article', { name: 'Pedidos digitados' })).not.toBeInTheDocument()

      await user.click(salvar())

      expect(await within(linha('Pedidos digitados')).findByRole('alert')).toHaveTextContent('O valor não pode ser negativo.')
      expect(busca()).toHaveValue('')
      expect(screen.getByRole('region', { name: 'Comercial' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Financeiro' })).toBeInTheDocument()
      expect(linha('Visitas a clientes')).toBeInTheDocument()
      expect(linha('Inadimplência')).toBeInTheDocument()
      await waitFor(() => expect(campoPedidos()).toHaveFocus())
      expect(campoPedidos()).toHaveValue('-5')
      expect(putsPreenchimento(chamadas)).toHaveLength(0)
    })

    it('o rascunho válido escondido pela busca continua no lote', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()

      await user.type(campoPedidos(), '7')
      await user.type(busca(), 'Vitrine')
      await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))
      await user.click(salvar())

      await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
      expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual(
        expect.objectContaining({
          itens: [
            { 'id apontamento': 7, valor: true },
            { 'id apontamento': 11, valor: 7 },
          ],
        }),
      )
    })
  })

  // Revisão da F9 em 13/11/2026: clicar de novo na opção marcada desmarca o booleano.
  describe('desmarcar o valor booleano', () => {
    it('clicar de novo em "Sim" desmarca: "Sim" deixa de estar pressionado e "Salvar lançamentos" volta a ficar desabilitado', async () => {
      const user = usuarioRapido()
      await abrirTela()
      const sim = () => within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' })

      await user.click(sim())
      expect(sim()).toHaveAttribute('aria-pressed', 'true')
      await user.click(sim())

      expect(sim()).toHaveAttribute('aria-pressed', 'false')
      expect(within(linha('Vitrine montada')).getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'false')
      expect(salvar()).toBeDisabled()
    })

    it('o booleano desmarcado sai do lote: só o outro apontamento é enviado', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()
      const nao = () => within(linha('Vitrine montada')).getByRole('button', { name: 'Não' })

      await user.type(campoPedidos(), '42')
      await user.click(nao())
      await user.click(nao())
      await user.click(salvar())

      await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
      expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual(
        expect.objectContaining({ itens: [{ 'id apontamento': 11, valor: 42 }] }),
      )
      expect(await screen.findByText('1 lançamento salvo.')).toBeInTheDocument()
    })
  })

  it('Admin: o lote vai com a filial escolhida no cabeçalho (102)', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessaoPreenchimento(fetchFalso, 'admin', { tela: telaComPedidosApi() })
    renderizarApp('/preenchimento')
    await user.selectOptions(await within(await screen.findByRole('banner')).findByRole('combobox', { name: 'Filial' }), '102')
    await screen.findByRole('article', { name: 'Pedidos digitados' })

    await user.type(campoPedidos(), '3')
    await user.click(salvar())

    await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual(expect.objectContaining({ filial: '102', 'mes de referencia': '2026-10-01' }))
  })
})
