import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import {
  DADO_CHAMADOS_API,
  DADO_COBERTURA_API,
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  ENTRADA_FATURAMENTO_API,
  SAIDA_FATURAMENTO_API,
  URL_FATURAMENTO,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { DadoExterno } from '../../types/dominio'
import { TabelaDadosExternos, type TabelaDadosExternosProps } from './TabelaDadosExternos'

/** Dado no domínio com os campos da integração (como o Admin recebe). */
function comIntegracao(dado: DadoExterno, integracao: Partial<DadoExterno> = {}): DadoExterno {
  return {
    ...dado,
    url: null,
    parametrosSaida: null,
    parametrosEntrada: null,
    variaveisUsadas: [],
    integracaoPendente: false,
    integracaoAlteradaEm: null,
    integracaoAlteradaPor: null,
    ...integracao,
  }
}

/** Ativo com integração gravada. */
const FATURAMENTO = comIntegracao(paraDadoExterno(DADO_FATURAMENTO_API), {
  url: URL_FATURAMENTO,
  parametrosSaida: SAIDA_FATURAMENTO_API,
  parametrosEntrada: ENTRADA_FATURAMENTO_API,
  variaveisUsadas: ['dataFinal', 'dataInicial', 'filial'],
})
/** Inativo com integração pendente. */
const COBERTURA = comIntegracao(paraDadoExterno(DADO_COBERTURA_API), { integracaoPendente: true })
/** Ativo com integração pendente. */
const CHAMADOS = comIntegracao(paraDadoExterno(DADO_CHAMADOS_API), { integracaoPendente: true })
/** Em construção: continua com "Concluir construção". */
const DEVOLUCOES = comIntegracao(paraDadoExterno(DADO_DEVOLUCOES_API))

const DADOS = [FATURAMENTO, COBERTURA, DEVOLUCOES, CHAMADOS]
const COL_IDENTIFICADOR = 3

/**
 * Configurações da integração na tabela (F5.16, mudança de 09/11/2026):
 * - menu: dado ativo/inativo → "Configurações" ("Preencher integração" quando a integração está
 *   pendente), só com `podeConfigurarIntegracao`; dado em construção continua com "Concluir construção";
 * - a URL aparece abaixo do identificador.
 * Props novas (opcionais): `podeConfigurarIntegracao?: boolean` (padrão false) e
 * `onConfigurarIntegracao?: (dado) => void`.
 */
describe('F5.16 — TabelaDadosExternos: Configurações da integração e URL abaixo do identificador', () => {
  function renderizar(props: Partial<TabelaDadosExternosProps> = {}) {
    const onConfigurarIntegracao = props.onConfigurarIntegracao ?? vi.fn<(dado: DadoExterno) => void>()
    const onConcluir = props.onConcluir ?? vi.fn<(dado: DadoExterno) => void>()
    render(
      <TabelaDadosExternos
        dados={props.dados ?? DADOS}
        podeConcluir={props.podeConcluir ?? true}
        podeAlterarSituacao={props.podeAlterarSituacao ?? true}
        podeExcluir={props.podeExcluir ?? true}
        podeConfigurarIntegracao={props.podeConfigurarIntegracao ?? true}
        onConcluir={onConcluir}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
        onConfigurarIntegracao={onConfigurarIntegracao}
      />,
    )
    return { onConfigurarIntegracao, onConcluir }
  }

  const tabela = () => screen.getByRole('table', { name: 'Dados externos' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!
  const celulaIdentificador = (nome: string) => within(linha(nome)).getAllByRole('cell')[COL_IDENTIFICADOR]

  describe('menu de ações', () => {
    it('dado ativo com integração: "Configurações" logo após "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual([
        'Ver detalhes',
        'Configurações',
        'Desativar',
        'Excluir',
      ])
    })

    it('dado com integração pendente (ativo ou inativo): o item se chama "Preencher integração"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Ativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Chamados atendidos no prazo'))).toEqual([
        'Ver detalhes',
        'Preencher integração',
        'Desativar',
        'Excluir',
      ])
    })

    it('dado em construção continua com "Concluir construção" e não mostra "Configurações"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Concluir construção',
        'Excluir',
      ])
    })

    it('"Configurações" chama onConfigurarIntegracao com o dado da linha', async () => {
      const user = usuarioRapido()
      const { onConfigurarIntegracao, onConcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Configurações')

      expect(onConfigurarIntegracao).toHaveBeenCalledTimes(1)
      expect(onConfigurarIntegracao).toHaveBeenCalledWith(FATURAMENTO)
      expect(onConcluir).not.toHaveBeenCalled()
    })

    it('"Preencher integração" também chama onConfigurarIntegracao com o dado da linha', async () => {
      const user = usuarioRapido()
      const { onConfigurarIntegracao } = renderizar()

      await escolherAcao(user, rotuloAcoesDadoExterno('Cobertura de clientes'), 'Preencher integração')

      expect(onConfigurarIntegracao).toHaveBeenCalledWith(COBERTURA)
    })

    it('sem podeConfigurarIntegracao (Validador/Preenchedor) não aparece "Configurações" nem "Preencher integração"', async () => {
      const user = usuarioRapido()
      renderizar({ podeConfigurarIntegracao: false, podeConcluir: false, podeExcluir: false })

      for (const nome of ['Faturamento líquido', 'Cobertura de clientes', 'Chamados atendidos no prazo']) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))
        expect(itens).not.toContain('Configurações')
        expect(itens).not.toContain('Preencher integração')
      }
    })

    it('podeConfigurarIntegracao é opcional: omitido, não aparece "Configurações"', async () => {
      const user = usuarioRapido()
      render(
        <TabelaDadosExternos
          dados={DADOS}
          podeConcluir
          podeAlterarSituacao
          podeExcluir
          onConcluir={vi.fn()}
          onAlterarSituacao={vi.fn()}
          onExcluir={vi.fn()}
        />,
      )

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual(['Ver detalhes', 'Desativar', 'Excluir'])
    })
  })

  describe('URL abaixo do identificador', () => {
    it('a célula do identificador mostra o identificador e, abaixo, a URL', () => {
      renderizar()

      const celula = celulaIdentificador('Faturamento líquido')
      const identificador = within(celula).getByText('FATURAMENTO')
      const url = within(celula).getByText(URL_FATURAMENTO)
      expect(identificador.compareDocumentPosition(url) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('sem URL, a célula mostra só o identificador (ou "a definir pela TI")', () => {
      renderizar()

      expect(celulaIdentificador('Cobertura de clientes')).toHaveTextContent(/^COBERTURA$/)
      expect(celulaIdentificador('Devoluções de venda')).toHaveTextContent(/^a definir pela TI$/)
    })

    it('a URL aparece mesmo sem permissão de configurar (é informação da linha)', () => {
      renderizar({ podeConfigurarIntegracao: false })

      expect(within(celulaIdentificador('Faturamento líquido')).getByText(URL_FATURAMENTO)).toBeInTheDocument()
    })

    it('a URL fica inteira no DOM e no title (dica com a URL completa quando cortada na tela — F1.19)', () => {
      renderizar()

      const url = within(celulaIdentificador('Faturamento líquido')).getByText(URL_FATURAMENTO)
      expect(url).toHaveTextContent(URL_FATURAMENTO)
      expect(url).toHaveAttribute('title', URL_FATURAMENTO)
    })
  })
})
