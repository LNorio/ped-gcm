import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { identificadoresApi, variaveisIntegracao } from '../../test/dadosExternosFalsos'
import type { ParametrosValidacaoIntegracao, ResultadoValidacaoIntegracao } from '../../types/dominio'
import {
  type AlvoIntegracao,
  ATRASO_VALIDACAO_SERVIDOR_MS,
  DialogoConcluirConstrucao,
  type DialogoIntegracaoLeituraProps,
} from './DialogoConcluirConstrucao'

/**
 * F5.19 — Modal da integração do dado externo em **modo leitura** (contrato final da meta via API de
 * 10/11/2026, `docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`, seções 1, 2.4 e 4.4): na fonte
 * da meta `dado_externo` não se cadastra integração no indicador; o Admin vê a integração do **dado
 * externo**, só para leitura (ação "Ver integração do dado externo" da aba Indicadores).
 *
 * Interface: `DialogoConcluirConstrucao` aceita também `DialogoIntegracaoLeituraProps`:
 * `{ modo: 'leitura'; dado: AlvoIntegracao | null; onCancelar: () => void; tipoAlvo?: TipoAlvoIntegracao }`
 * — as demais props da modal (identificadores, variáveis, concluindo, erro, errosCampos, hoje,
 * validarNoServidor, onConfirmar) são opcionais nesse modo e ignoradas.
 *
 * Comportamento: título "Integração do dado externo"; texto "Integração cadastrada no dado externo
 * {nome} (somente leitura)."; os quatro campos ("Identificador da consulta", "URL", "Parâmetros de saída"
 * e "Parâmetros de entrada") com os valores salvos (parâmetros com `JSON.stringify(valor, null, 2)`, texto
 * como está, `null` → vazio), `readOnly` e sem obrigatoriedade; sem "Inserir modelo", sem variáveis nem
 * operadores, sem validação (local ou no servidor) e sem o "falta: ..."; só botões "Fechar" (o do
 * cabeçalho do Dialogo e, se houver, o do rodapé), que chamam `onCancelar`, assim como o Esc.
 */
const SAIDA_FATURAMENTO = [
  { filial: '101', valor: '1500,00', competencia: '10/2026' },
  { filial: '102', valor: '980,50', competencia: '10/2026' },
]
const ENTRADA_FATURAMENTO = {
  operacao: 'Faturamento',
  parametros: { ECodEmp: '%empresas%', EDatIni: '%dataInicial%', EDatFim: '%dataFinal%' },
}

/** Integração do dado externo "Faturamento líquido", como vem em `integracao do dado externo` (Admin). */
const INTEGRACAO_FATURAMENTO: AlvoIntegracao = {
  id: 1,
  nome: 'Faturamento líquido',
  identificador: 'FATURAMENTO',
  url: 'https://ti.exemplo.com.br/api/faturamento',
  parametrosSaida: SAIDA_FATURAMENTO,
  parametrosEntrada: ENTRADA_FATURAMENTO,
}

const ROTULOS = ['Identificador da consulta', 'URL', 'Parâmetros de saída', 'Parâmetros de entrada'] as const

describe('F5.19 — DialogoConcluirConstrucao em modo "leitura" (integração do dado externo só para consulta)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderizar(props: Partial<DialogoIntegracaoLeituraProps> = {}) {
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoConcluirConstrucao
        {...props}
        modo="leitura"
        dado={props.dado === undefined ? INTEGRACAO_FATURAMENTO : props.dado}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onCancelar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Integração do dado externo' })
  const campo = (rotulo: (typeof ROTULOS)[number]) => within(dialogo()).getByLabelText(rotulo) as HTMLInputElement | HTMLTextAreaElement

  it('com dado null não renderiza nada', () => {
    renderizar({ dado: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('título "Integração do dado externo" e o texto citando o dado, sem os títulos dos outros modos', () => {
    renderizar()

    expect(dialogo()).toBeInTheDocument()
    expect(within(dialogo()).getByText('Integração cadastrada no dado externo Faturamento líquido (somente leitura).')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Concluir construção' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Configurações da integração' })).not.toBeInTheDocument()
  })

  it('mostra os quatro campos, nesta ordem, com os valores salvos (parâmetros com 2 espaços)', () => {
    renderizar()

    expect(campo('Identificador da consulta')).toHaveValue('FATURAMENTO')
    expect(campo('URL')).toHaveValue('https://ti.exemplo.com.br/api/faturamento')
    expect(campo('Parâmetros de saída')).toHaveValue(JSON.stringify(SAIDA_FATURAMENTO, null, 2))
    expect(campo('Parâmetros de entrada')).toHaveValue(JSON.stringify(ENTRADA_FATURAMENTO, null, 2))
    const campos = ROTULOS.map(campo)
    campos.forEach((atual, i) => {
      if (i > 0) expect(campos[i - 1].compareDocumentPosition(atual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('os quatro campos são só leitura (readOnly) e não obrigatórios (sem aria-required nem " *" no rótulo)', () => {
    renderizar()

    for (const rotulo of ROTULOS) {
      const elemento = campo(rotulo)
      expect(elemento).toHaveAttribute('readonly')
      expect(elemento).not.toBeRequired()
      expect(elemento).not.toHaveAttribute('aria-required', 'true')
      expect(elemento.labels?.[0]?.textContent).toBe(rotulo)
    }
  })

  it('digitar ou colar nos campos não altera os valores', async () => {
    const user = userEvent.setup()
    renderizar()

    await user.type(campo('Identificador da consulta'), 'X')
    await user.type(campo('URL'), '/v2')
    await user.click(campo('Parâmetros de saída'))
    await user.paste('lixo')
    await user.type(campo('Parâmetros de entrada'), ' ')

    expect(campo('Identificador da consulta')).toHaveValue('FATURAMENTO')
    expect(campo('URL')).toHaveValue('https://ti.exemplo.com.br/api/faturamento')
    expect(campo('Parâmetros de saída')).toHaveValue(JSON.stringify(SAIDA_FATURAMENTO, null, 2))
    expect(campo('Parâmetros de entrada')).toHaveValue(JSON.stringify(ENTRADA_FATURAMENTO, null, 2))
  })

  it('valores null aparecem vazios; parâmetros já em texto aparecem como estão', () => {
    renderizar({
      dado: {
        id: 2,
        nome: 'Cobertura de clientes',
        identificador: null,
        url: null,
        parametrosSaida: '[{"filial": "101", "valor": "0"}]',
        parametrosEntrada: null,
      },
    })

    expect(campo('Identificador da consulta')).toHaveValue('')
    expect(campo('URL')).toHaveValue('')
    expect(campo('Parâmetros de saída')).toHaveValue('[{"filial": "101", "valor": "0"}]')
    expect(campo('Parâmetros de entrada')).toHaveValue('')
  })

  it('sem "Inserir modelo", sem variáveis disponíveis nem operadores, mesmo recebendo as variáveis da API', () => {
    renderizar({ variaveis: variaveisIntegracao(), identificadores: identificadoresApi() })

    expect(within(dialogo()).queryByRole('button', { name: 'Inserir modelo de saída' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: 'Inserir modelo de entrada' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('group', { name: 'Variáveis disponíveis' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('group', { name: 'Operadores' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('group', { name: 'Identificadores existentes' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: /%filial%/ })).not.toBeInTheDocument()
  })

  it('sem validação: nenhuma região de validação, nem "falta: ..." nem "Todos os campos obrigatórios preenchidos" — nem com a saída fora do formato', () => {
    renderizar({ dado: { ...INTEGRACAO_FATURAMENTO, parametrosSaida: { valor: '0' } } })

    expect(within(dialogo()).queryByRole('status', { name: 'Validação dos parâmetros de saída' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('status', { name: 'Validação dos parâmetros de entrada' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByText(/^falta:/)).not.toBeInTheDocument()
    expect(within(dialogo()).queryByText('Todos os campos obrigatórios preenchidos')).not.toBeInTheDocument()
    expect(within(dialogo()).queryByText(/JSON válido|inválido/)).not.toBeInTheDocument()
  })

  it('não chama a validação no servidor, mesmo recebendo validarNoServidor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const validar = vi.fn<(parametros: ParametrosValidacaoIntegracao) => Promise<ResultadoValidacaoIntegracao>>(() =>
      Promise.resolve({ entrada: null }),
    )
    renderizar({ validarNoServidor: validar })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ATRASO_VALIDACAO_SERVIDOR_MS * 3)
    })

    expect(validar).not.toHaveBeenCalled()
  })

  it('só há botões "Fechar": sem salvar, concluir ou cancelar', () => {
    renderizar({ onConfirmar: vi.fn() })

    const botoes = within(dialogo()).getAllByRole('button')
    expect(botoes.length).toBeGreaterThanOrEqual(1)
    for (const botao of botoes) expect(botao).toHaveAccessibleName('Fechar')
    expect(within(dialogo()).queryByRole('button', { name: 'Salvar configurações' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: 'Concluir e ativar' })).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('"Fechar" e Esc chamam onCancelar; onConfirmar nunca é chamado', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn()
    const { onCancelar } = renderizar({ onConfirmar })

    const botoes = within(dialogo()).getAllByRole('button', { name: 'Fechar' })
    await user.click(botoes[botoes.length - 1])
    await user.keyboard('{Escape}')

    expect(onCancelar).toHaveBeenCalledTimes(2)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('tipoAlvo não muda o modo leitura: continua "Integração do dado externo"', () => {
    renderizar({ tipoAlvo: 'indicador' })

    expect(dialogo()).toBeInTheDocument()
    expect(within(dialogo()).getByText('Integração cadastrada no dado externo Faturamento líquido (somente leitura).')).toBeInTheDocument()
  })

  /**
   * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): não há mais
   * mapeamento da saída; o modo leitura **não** mostra "Campo da filial", "Campo do valor", "Campo da meta"
   * nem "Campo da competência", mesmo que um alvo antigo ainda traga `mapeamentoSaida`. Nenhum aviso de
   * formato antigo no modo leitura (não há validação).
   */
  describe('sem mapeamento da saída', () => {
    const ROTULOS_MAPEAMENTO = ['Campo da filial', 'Campo do valor', 'Campo da meta', 'Campo da competência']

    it.each<[string, AlvoIntegracao]>([
      ['saída "chave: tipo"', { ...INTEGRACAO_FATURAMENTO, parametrosSaida: { codfil: 'string', vlrLiq: 'number', datCpt: 'date' } }],
      [
        'alvo antigo com mapeamentoSaida',
        {
          ...INTEGRACAO_FATURAMENTO,
          parametrosSaida: { codfil: 'string', vlrLiq: 'number', datCpt: 'date' },
          mapeamentoSaida: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: 'datCpt' },
        } as AlvoIntegracao,
      ],
      ['saída em lista', INTEGRACAO_FATURAMENTO],
    ])('%s: os campos do mapeamento não aparecem; só os quatro campos', (_nome, dado) => {
      renderizar({ dado })

      for (const rotulo of ROTULOS_MAPEAMENTO) expect(within(dialogo()).queryByLabelText(rotulo)).not.toBeInTheDocument()
      expect(within(dialogo()).getAllByRole('textbox')).toHaveLength(4)
      expect(within(dialogo()).queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('saída salva em lista não mostra aviso de formato antigo no modo leitura', () => {
      renderizar()

      expect(within(dialogo()).queryByText(/formato antigo/)).not.toBeInTheDocument()
    })
  })
})
