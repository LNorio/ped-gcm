import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  ERRO_ULTIMA_CONSULTA_META,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_CONSULTA_API,
  comoValidadorRecebe,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

/**
 * F6.11 — Listagem com o executor das integrações (fase 2: `docs/backend/FRONT-meta-via-api-fase2.md` e
 * `docs/backend/API (27).md`, seção "Executor das integrações" — 11/11/2026).
 *
 * Detalhes do indicador ("Ver detalhes"), só com `podeConfigurarIntegracao` (Admin — só ele recebe os
 * dados) e só na fonte `integracao` (`usaIntegracaoDoIndicador`), depois de "Filiais sem meta" e antes
 * de "Cadastro":
 * - par "Última consulta": `integracao.ultimaConsultaEm` como "dd/mm/aaaa hh:mm" (`formatarDataHora`) ou
 *   "Nenhuma consulta ainda" quando `null`;
 * - par "Erro da última consulta": o texto de `integracao.erroUltimaConsulta`, só quando não é `null`.
 * Sem a permissão (Validador), na fonte `dado_externo` e na meta manual, nenhum dos dois aparece.
 *
 * Etiquetas: a fonte `integracao` com `filiaisSemMeta` não vazia (depois da primeira consulta) mostra
 * "Meta pendente em N filiais" como as demais (situação `ok` sem etiqueta própria). "Definir metas
 * pendentes" continua fora do menu dos indicadores `terceiro` (F6.12).
 */
const API: IndicadorApiFalso[] = [
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_ERRO_CONSULTA_API,
]
const INDICADORES: Indicador[] = API.map(paraIndicador)

const COL = { nome: 0 }
const ULTIMA = 'Última consulta'
const ERRO = 'Erro da última consulta'

describe('F6.11 — TabelaIndicadores: última consulta e erro da consulta da meta (executor)', () => {
  function renderizar(props: Partial<TabelaIndicadoresProps> = {}) {
    render(
      <TabelaIndicadores
        indicadores={INDICADORES}
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        podeConfigurarIntegracao
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
        onConfigurarIntegracao={vi.fn()}
        onVerIntegracaoDadoExterno={vi.fn()}
        podeDefinirMetasPendentes
        onDefinirMetasPendentes={vi.fn()}
        {...props}
      />,
    )
  }

  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })

  function linha(nome: string): HTMLElement {
    const encontrada = within(tabela())
      .getAllByRole('row')
      .slice(1)
      .filter((l) => !l.classList.contains('tabela__detalhes'))
      .find((l) => within(within(l).getAllByRole('cell')[COL.nome]).queryByText(nome) !== null)
    if (!encontrada) throw new Error(`Linha "${nome}" não encontrada`)
    return encontrada
  }

  const celula = (nome: string, coluna: number) => within(linha(nome)).getAllByRole('cell')[coluna]
  const etiquetas = (nome: string) => [...celula(nome, COL.nome).querySelectorAll('.etiqueta')].map((e) => e.textContent?.trim())

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesIndicador(nome), 'Ver detalhes')
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    if (!proxima || !proxima.classList.contains('tabela__detalhes')) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return proxima
  }

  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  const rotulosDosDetalhes = (detalhes: HTMLElement) => [...detalhes.querySelectorAll('dt')].map((dt) => dt.textContent?.trim())

  describe('detalhes (Admin)', () => {
    it('fonte integracao consultada: "Última consulta" dd/mm/aaaa hh:mm, sem "Erro da última consulta"', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Ticket com meta da TI')

      expect(valorDetalhe(detalhes, ULTIMA)).toHaveTextContent(/^11\/11\/2026 02:30$/)
      expect(within(detalhes).queryByText(ERRO, { selector: 'dt' })).not.toBeInTheDocument()
    })

    it('fonte integracao com erro: "Última consulta" do último sucesso e "Erro da última consulta" com o texto do back-end', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Positivação com meta da TI')

      expect(valorDetalhe(detalhes, ULTIMA)).toHaveTextContent(/^10\/11\/2026 02:30$/)
      expect(valorDetalhe(detalhes, ERRO)).toHaveTextContent(ERRO_ULTIMA_CONSULTA_META)
    })

    it.each([['Novos clientes com meta da TI'], ['Faturamento com meta da TI']])(
      'fonte integracao sem consulta (%s): "Última consulta" com "Nenhuma consulta ainda"',
      async (nome) => {
        const user = usuarioRapido()
        renderizar()

        const detalhes = await verDetalhes(user, nome)

        expect(valorDetalhe(detalhes, ULTIMA)).toHaveTextContent(/^Nenhuma consulta ainda$/)
        expect(within(detalhes).queryByText(ERRO, { selector: 'dt' })).not.toBeInTheDocument()
      },
    )

    it('ordem: depois de "Filiais sem meta" e antes de "Cadastro"', async () => {
      const user = usuarioRapido()
      const comErroEFiliais = paraIndicador({ ...INDICADOR_META_ERRO_CONSULTA_API, 'filiais sem meta': ['101'] })
      renderizar({ indicadores: [comErroEFiliais] })

      const detalhes = await verDetalhes(user, 'Positivação com meta da TI')

      expect(rotulosDosDetalhes(detalhes)).toEqual(['Descrição', 'Tipos', 'Filiais sem meta', ULTIMA, ERRO, 'Cadastro'])
    })

    it('fonte dado_externo e meta manual não mostram "Última consulta" nem "Erro da última consulta"', async () => {
      const user = usuarioRapido()
      renderizar()

      for (const nome of ['Faturamento com meta do ERP', 'Cobertura de visitas']) {
        const detalhes = await verDetalhes(user, nome)
        expect(within(detalhes).queryByText(ULTIMA, { selector: 'dt' })).not.toBeInTheDocument()
        expect(within(detalhes).queryByText(ERRO, { selector: 'dt' })).not.toBeInTheDocument()
      }
    })
  })

  it('sem podeConfigurarIntegracao (Validador): os detalhes não mostram "Última consulta" nem "Erro da última consulta"', async () => {
    const user = usuarioRapido()
    renderizar({
      podeConfigurarIntegracao: false,
      indicadores: [INDICADOR_META_CONSULTADO_API, INDICADOR_META_ERRO_CONSULTA_API].map(comoValidadorRecebe).map(paraIndicador),
    })

    for (const nome of ['Ticket com meta da TI', 'Positivação com meta da TI']) {
      const detalhes = await verDetalhes(user, nome)
      expect(within(detalhes).queryByText(ULTIMA, { selector: 'dt' })).not.toBeInTheDocument()
      expect(within(detalhes).queryByText(ERRO, { selector: 'dt' })).not.toBeInTheDocument()
      expect(within(detalhes).queryByText('Nenhuma consulta ainda')).not.toBeInTheDocument()
    }
  })

  describe('etiquetas e menu da fonte integracao depois da primeira consulta', () => {
    it('situação ok com filiais sem meta: só "Meta pendente em 2 filiais"; com erro: "Erro na consulta da meta"', () => {
      renderizar()

      expect(etiquetas('Ticket com meta da TI')).toEqual(['Meta pendente em 2 filiais'])
      expect(etiquetas('Positivação com meta da TI')).toEqual(['Erro na consulta da meta'])
    })

    it('a etiqueta de pendência aparece também para o Validador (filiais sem meta chegam a todos os perfis)', () => {
      renderizar({ podeConfigurarIntegracao: false, indicadores: [paraIndicador(comoValidadorRecebe(INDICADOR_META_CONSULTADO_API))] })

      expect(etiquetas('Ticket com meta da TI')).toEqual(['Meta pendente em 2 filiais'])
    })

    it('"Definir metas pendentes" não aparece para indicador terceiro com filiais sem meta', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Ticket com meta da TI'))).toEqual([
        'Ver detalhes',
        'Configurações',
        'Inativar',
        'Excluir',
      ])
    })
  })
})
