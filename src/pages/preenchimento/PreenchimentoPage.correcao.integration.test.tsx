import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson } from '../../test/apiFalsa'
import {
  ROTA_PREENCHIMENTO,
  getsDe,
  putsPreenchimento,
  simularSessaoPreenchimento,
  type OpcoesSessaoPreenchimento,
} from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido } from '../../test/usuario'

const ROTA_HISTORICO_9 = '/api/ped/apontamentos/9/historico'

/**
 * Correção e histórico do apontamento na aba Preenchimento (F9.7 — RF-68, RF-69, RNF-01). Fluxo
 * completo com a rede simulada:
 * - "Corrigir" (apontamento já lançado, mês aberto) abre "Corrigir lançamento"; com novo valor diferente
 *   do atual e motivo, envia `PUT /api/ped/preenchimento` com um item e o `motivo`; no sucesso fecha,
 *   notifica "1 correção salva." e recarrega; na recusa, a mensagem fica no diálogo, que continua aberto;
 * - "Histórico" abre "Histórico do apontamento" com o lançamento e as correções da filial e do mês.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.7 — Correção e histórico do apontamento (integração: /preenchimento)', () => {
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
  const dialogoCorrecao = () => screen.getByRole('dialog', { name: 'Corrigir lançamento' })
  const dialogoHistorico = () => screen.getByRole('dialog', { name: 'Histórico do apontamento' })

  async function abrirTela(opcoes: OpcoesSessaoPreenchimento = {}) {
    const sessao = simularSessaoPreenchimento(fetchFalso, 'preenchedor', opcoes)
    renderizarApp('/preenchimento')
    await screen.findByRole('article', { name: 'Inadimplência' })
    return sessao
  }

  async function corrigirInadimplencia(valor: string, motivo: string) {
    const user = usuarioRapido()
    await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))
    const dialogo = dialogoCorrecao()
    await user.type(within(dialogo).getByRole('textbox', { name: 'Novo valor' }), valor)
    if (motivo) await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da correção' }), motivo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar correção' }))
    return user
  }

  describe('correção (RF-68)', () => {
    it('"Corrigir" abre o diálogo com o apontamento e o valor atual', async () => {
      const user = usuarioRapido()
      await abrirTela()

      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))

      expect(dialogoCorrecao()).toHaveTextContent('Inadimplência')
      expect(within(dialogoCorrecao()).getByText('Valor atual: 80,00%')).toBeInTheDocument()
    })

    it('valor diferente e motivo: PUT com um item e o motivo; fecha, notifica "1 correção salva." e recarrega com o novo valor', async () => {
      const { chamadas } = await abrirTela()
      const telasAntes = getsDe(chamadas, ROTA_PREENCHIMENTO).length

      await corrigirInadimplencia('85,5', 'digitação errada')

      await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
      expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual({
        filial: '101',
        'mes de referencia': '2026-10-01',
        itens: [{ 'id apontamento': 9, valor: 85.5, motivo: 'digitação errada' }],
      })
      expect(await screen.findByText('1 correção salva.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Corrigir lançamento' })).not.toBeInTheDocument())
      await waitFor(() => expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(telasAntes + 1))
      await waitFor(() => expect(within(linha('Inadimplência')).getByText('85,50%')).toBeInTheDocument())
    })

    it('valor igual ao atual: mensagem no diálogo e nada é enviado', async () => {
      const { chamadas } = await abrirTela()

      await corrigirInadimplencia('80', 'sem mudança')

      expect(within(dialogoCorrecao()).getByText('O novo valor deve ser diferente do atual.')).toBeInTheDocument()
      expect(putsPreenchimento(chamadas)).toHaveLength(0)
    })

    it('sem motivo: "Informe o motivo da correção." e nada é enviado', async () => {
      const { chamadas } = await abrirTela()

      await corrigirInadimplencia('90', '')

      expect(within(dialogoCorrecao()).getByText('Informe o motivo da correção.')).toBeInTheDocument()
      expect(putsPreenchimento(chamadas)).toHaveLength(0)
    })

    it('recusa da API (400): a mensagem aparece no diálogo, que continua aberto, e a tela não recarrega', async () => {
      const { chamadas } = await abrirTela({ respostaPut: () => respostaErro(400, 'O mês informado não está aberto para lançamentos.') })
      const telasAntes = getsDe(chamadas, ROTA_PREENCHIMENTO).length

      await corrigirInadimplencia('85', 'ajuste')

      expect(await within(dialogoCorrecao()).findByText('O mês informado não está aberto para lançamentos.')).toBeInTheDocument()
      expect(dialogoCorrecao()).toBeInTheDocument()
      expect(getsDe(chamadas, ROTA_PREENCHIMENTO)).toHaveLength(telasAntes)
      expect(screen.queryByText('1 correção salva.')).not.toBeInTheDocument()
    })

    it('recusa com erro do item corrigido: a mensagem do item aparece no diálogo', async () => {
      await abrirTela({
        respostaPut: () =>
          respostaJson({ mensagem: 'Lote recusado.', erros: [{ 'id apontamento': 9, mensagem: 'O motivo deve ter ao menos 10 caracteres.' }] }, 400),
      })

      await corrigirInadimplencia('85', 'curto')

      expect(await within(dialogoCorrecao()).findByText('O motivo deve ter ao menos 10 caracteres.')).toBeInTheDocument()
    })

    it('"Cancelar" fecha o diálogo sem enviar', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()
      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))

      await user.click(within(dialogoCorrecao()).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog', { name: 'Corrigir lançamento' })).not.toBeInTheDocument()
      expect(putsPreenchimento(chamadas)).toHaveLength(0)
    })

    it('valores digitados no lote continuam depois de uma correção cancelada', async () => {
      const user = usuarioRapido()
      await abrirTela()
      await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))

      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))
      await user.click(within(dialogoCorrecao()).getByRole('button', { name: 'Cancelar' }))

      expect(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('histórico (RF-69, RNF-01)', () => {
    it('"Histórico" mostra lançamento e correções da filial e do mês, do mais recente para o mais antigo', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()

      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Histórico' }))

      const tabela = await within(dialogoHistorico()).findByRole('table', { name: 'Lançamentos e correções' })
      expect(
        within(tabela)
          .getAllByRole('row')
          .slice(1)
          .map((l) => within(l).getAllByRole('cell').map((c) => c.textContent)),
      ).toEqual([
        ['20/10/2026 10:00', 'Correção', '75,00%', '80,00%', 'Ana Costa', 'digitação errada'],
        ['05/10/2026 09:00', 'Lançamento', '—', '75,00%', 'Fulano', '—'],
      ])
      const consulta = getsDe(chamadas, ROTA_HISTORICO_9)
      expect(consulta).toHaveLength(1)
      expect(consulta[0].url.searchParams.get('filial')).toBe('101')
      expect(consulta[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10')
    })

    it('na consulta de um mês fechado, o histórico é o daquele mês', async () => {
      const user = usuarioRapido()
      const { chamadas } = await abrirTela()
      const meses = await screen.findByRole('group', { name: 'Mês de competência' })
      await user.click(await within(meses).findByRole('button', { name: /^Setembro/ }))
      await waitFor(() =>
        expect(within(screen.getByRole('region', { name: 'Resumo do mês' })).getByText('Competência: 09/2026')).toBeInTheDocument(),
      )

      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Histórico' }))

      await waitFor(() => expect(getsDe(chamadas, ROTA_HISTORICO_9)).toHaveLength(1))
      expect(getsDe(chamadas, ROTA_HISTORICO_9)[0].url.searchParams.get('mes_de_referencia')).toBe('2026-09')
    })

    it('"Fechar" fecha o histórico', async () => {
      const user = usuarioRapido()
      await abrirTela()
      await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Histórico' }))
      await within(dialogoHistorico()).findByRole('table', { name: 'Lançamentos e correções' })

      await user.click(within(dialogoHistorico()).getByRole('button', { name: 'Fechar' }))

      expect(screen.queryByRole('dialog', { name: 'Histórico do apontamento' })).not.toBeInTheDocument()
    })
  })
})
