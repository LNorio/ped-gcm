import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_COBERTURA_API, DADO_FATURAMENTO_API, DADO_VOLUME_API, URL_FATURAMENTO } from '../../test/dadosExternosFalsos'
import { escolherAcao, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { DadoExterno } from '../../types/dominio'
import { TabelaDadosExternos } from './TabelaDadosExternos'

/** Dado no domínio com a integração e o estado da última consulta (como o Admin recebe). */
function comConsulta(dado: DadoExterno, consulta: Partial<DadoExterno>): DadoExterno {
  return {
    ...dado,
    url: URL_FATURAMENTO,
    parametrosSaida: null,
    parametrosEntrada: null,
    variaveisUsadas: [],
    integracaoPendente: false,
    integracaoAlteradaEm: null,
    integracaoAlteradaPor: null,
    ultimaConsultaEm: null,
    erroUltimaConsulta: null,
    ...consulta,
  }
}

/** Consultado com sucesso, sem erro. */
const FATURAMENTO = comConsulta(paraDadoExterno(DADO_FATURAMENTO_API), { ultimaConsultaEm: '2026-11-11 02:30:00' })
/** Última consulta falhou (o último sucesso foi no dia anterior). */
const VOLUME = comConsulta(paraDadoExterno(DADO_VOLUME_API), {
  ultimaConsultaEm: '2026-11-10 02:30:00',
  erroUltimaConsulta: 'valor ambiguo: 1.500 na filial 101',
})
/** Nunca consultado com sucesso e com erro (ex.: %filial% numa chamada de todas as filiais). */
const COBERTURA = comConsulta(paraDadoExterno(DADO_COBERTURA_API), { erroUltimaConsulta: 'use %empresas%' })
/** Integração salva, ainda sem nenhuma consulta. */
const AGUARDANDO = comConsulta(paraDadoExterno(DADO_FATURAMENTO_API), {})
/** Sem integração salva (url null), sem consulta: nada sobre a consulta. */
const SEM_INTEGRACAO = comConsulta(paraDadoExterno(DADO_FATURAMENTO_API), { url: null, integracaoPendente: true })

const COL_SITUACAO = 1
const ETIQUETA_ERRO = 'Erro na última consulta'

/**
 * F5.22 — Última consulta do dado externo na tabela (executor, 11/11/2026 — `FRONT-meta-via-api-fase2.md`,
 * seção 1: "Vale mostrar 'Última consulta' e o erro, como nos indicadores"):
 * - coluna Situação: etiqueta "Erro na última consulta" quando `erroUltimaConsulta` não é null;
 * - detalhes da linha, como pares rótulo/valor (`<dt>`/`<dd>`, igual à aba Indicadores — F6.13):
 *   "Última consulta" → `dd/mm/aaaa hh:mm` (último sucesso) ou "Nenhuma consulta ainda" (integração
 *   salva — `url` não nula — e sem sucesso); "Erro da última consulta" → o texto como veio, só quando
 *   `erroUltimaConsulta` não é null;
 * - sem integração salva e sem data (Validador/Preenchedor, que não recebem os campos, ou integração
 *   pendente), nada sobre a consulta.
 * Sem props novas: a tabela usa os campos do `DadoExterno`.
 */
describe('F5.22 — TabelaDadosExternos: última consulta e erro da consulta', () => {
  function renderizar(dados: DadoExterno[]) {
    render(
      <TabelaDadosExternos
        dados={dados}
        podeConcluir
        podeAlterarSituacao
        podeExcluir
        onConcluir={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
      />,
    )
  }

  const tabela = () => screen.getByRole('table', { name: 'Dados externos' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!
  const situacao = (nome: string) => within(linha(nome)).getAllByRole('cell')[COL_SITUACAO]

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesDadoExterno(nome), 'Ver detalhes')
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    if (!proxima || !proxima.classList.contains('tabela__detalhes')) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return proxima
  }

  describe('etiqueta na coluna Situação', () => {
    it('com erro na última consulta: etiqueta "Erro na última consulta", junto da situação', () => {
      renderizar([FATURAMENTO, VOLUME, COBERTURA])

      expect(within(situacao('Volume de vendas')).getByText('Ativo')).toBeInTheDocument()
      expect(within(situacao('Volume de vendas')).getByText(ETIQUETA_ERRO)).toBeInTheDocument()
      expect(within(situacao('Cobertura de clientes')).getByText(ETIQUETA_ERRO)).toBeInTheDocument()
    })

    it('consulta sem erro não mostra a etiqueta', () => {
      renderizar([FATURAMENTO, VOLUME])

      expect(within(situacao('Faturamento líquido')).queryByText(ETIQUETA_ERRO)).not.toBeInTheDocument()
      expect(screen.getAllByText(ETIQUETA_ERRO)).toHaveLength(1)
    })

    it('o texto do erro não aparece na linha (só nos detalhes)', () => {
      renderizar([VOLUME])

      expect(within(linha('Volume de vendas')).queryByText(/valor ambiguo/)).not.toBeInTheDocument()
    })
  })

  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`) dos detalhes. */
  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  describe('detalhes da linha', () => {
    it('consultado com sucesso: "Última consulta" 11/11/2026 02:30, sem "Erro da última consulta"', async () => {
      const user = usuarioRapido()
      renderizar([FATURAMENTO])

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^11\/11\/2026 02:30$/)
      expect(within(detalhes).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
    })

    it('com erro: a data do último sucesso e "Erro da última consulta" com o texto do back-end', async () => {
      const user = usuarioRapido()
      renderizar([VOLUME])

      const detalhes = await verDetalhes(user, 'Volume de vendas')

      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^10\/11\/2026 02:30$/)
      expect(valorDetalhe(detalhes, 'Erro da última consulta')).toHaveTextContent(/^valor ambiguo: 1\.500 na filial 101$/)
    })

    it('nunca consultado com sucesso e com erro: "Nenhuma consulta ainda" e o erro', async () => {
      const user = usuarioRapido()
      renderizar([COBERTURA])

      const detalhes = await verDetalhes(user, 'Cobertura de clientes')

      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^Nenhuma consulta ainda$/)
      expect(valorDetalhe(detalhes, 'Erro da última consulta')).toHaveTextContent(/^use %empresas%$/)
    })

    it('integração salva e ainda sem consulta: "Nenhuma consulta ainda", sem erro', async () => {
      const user = usuarioRapido()
      renderizar([AGUARDANDO])

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(valorDetalhe(detalhes, 'Última consulta')).toHaveTextContent(/^Nenhuma consulta ainda$/)
      expect(within(detalhes).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
    })

    it('sem integração salva (pendente) e sem consulta: nada sobre a consulta', async () => {
      const user = usuarioRapido()
      renderizar([SEM_INTEGRACAO])

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(within(detalhes).queryByText('Última consulta', { selector: 'dt' })).not.toBeInTheDocument()
      expect(within(detalhes).queryByText('Erro da última consulta', { selector: 'dt' })).not.toBeInTheDocument()
    })

    it('sem os campos do Admin (Validador/Preenchedor): nada sobre a consulta', async () => {
      const user = usuarioRapido()
      renderizar([paraDadoExterno(DADO_FATURAMENTO_API)])

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(within(detalhes).queryByText(/última consulta/i)).not.toBeInTheDocument()
      expect(within(tabela()).queryByText(ETIQUETA_ERRO)).not.toBeInTheDocument()
    })
  })
})
