import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ENTRADA_META_VIA_API, URL_META_VIA_API } from '../../test/indicadoresFalsos'
import { identificadoresApi, variaveisIntegracaoSemExemplo } from '../../test/dadosExternosFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import type { ErroIntegracao } from '../../types/dominio'
import { MODELO_JSON_SAIDA, MODELO_JSON_SAIDA_META } from '../../utils/integracao/modelos'
import {
  type AlvoIntegracao,
  type DadosConclusaoConstrucao,
  DialogoConcluirConstrucao,
  type DialogoConcluirConstrucaoProps,
} from './DialogoConcluirConstrucao'

/**
 * F6.11 — A modal da integração do dado externo reaproveitada para a meta do indicador (pedido do
 * usuário de 10/11/2026: "uma modal igual à da aba de dados externos").
 *
 * Interface generalizada (sem mudar os testes da F5.7/F5.16/F5.18):
 * - `dado` passa a ser do tipo `AlvoIntegracao | null` (exportado deste módulo):
 *   `{ id, nome, identificador: string | null, url: string | null, parametrosSaida: unknown,
 *   parametrosEntrada: unknown, janelaRetroativa?: JanelaRetroativa | null, diaDaColeta?: number | null }`
 *   — `DadoExterno` continua aceito (é compatível);
 * - nova prop opcional `tipoAlvo?: 'dado-externo' | 'indicador'` (padrão `'dado-externo'`), que só muda
 *   o texto da modal: "Revise a integração do indicador {nome} e salve as configurações.".
 * Sem `janelaRetroativa`/`diaDaColeta`, os exemplos locais usam só `hoje` (sem erro).
 */
/**
 * Saída da integração da meta em lista, um item por filial (`filial` e `meta`; `competencia` opcional) —
 * contrato final de 10/11/2026 (seção 2.3 de `RESPOSTA-FINAL-meta-via-api.md`). Constante local para
 * não depender do formato de `SAIDA_META_VIA_API` (`indicadoresFalsos.ts`).
 */
const SAIDA_META_LISTA = [
  { filial: '100', meta: '4600000' },
  { filial: '101', meta: '3200000' },
]
const SAIDA_TEXTO = JSON.stringify(SAIDA_META_LISTA, null, 2)
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const HOJE = new Date(2026, 10, 10)

const CONFIGURADO: AlvoIntegracao = {
  id: 11,
  nome: 'Margem com meta da TI',
  identificador: 'META_MARGEM',
  url: URL_META_VIA_API,
  parametrosSaida: SAIDA_META_LISTA,
  parametrosEntrada: ENTRADA_META_VIA_API,
}

const PENDENTE: AlvoIntegracao = {
  id: 10,
  nome: 'Faturamento com meta da TI',
  identificador: null,
  url: null,
  parametrosSaida: null,
  parametrosEntrada: null,
}

describe('F6.11 — DialogoConcluirConstrucao para a integração da meta do indicador (tipoAlvo "indicador")', () => {
  function renderizar(props: Partial<DialogoConcluirConstrucaoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosConclusaoConstrucao) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    render(
      <DialogoConcluirConstrucao
        modo="configurar"
        tipoAlvo={props.tipoAlvo === undefined ? 'indicador' : props.tipoAlvo}
        dado={props.dado === undefined ? CONFIGURADO : props.dado}
        identificadores={identificadoresApi()}
        variaveis={variaveisIntegracaoSemExemplo()}
        carregandoVariaveis={false}
        erroVariaveis={null}
        concluindo={props.concluindo ?? false}
        erro={props.erro ?? null}
        errosCampos={props.errosCampos ?? []}
        hoje={HOJE}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { onConfirmar, onCancelar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Configurações da integração' })
  const campo = (rotulo: string) => within(dialogo()).getByLabelText(rotulo)
  const salvar = () => within(dialogo()).getByRole('button', { name: 'Salvar configurações' })

  it('título "Configurações da integração", texto do indicador e botão "Salvar configurações"', () => {
    renderizar()

    expect(dialogo()).toBeInTheDocument()
    expect(within(dialogo()).getByText('Revise a integração do indicador Margem com meta da TI e salve as configurações.')).toBeInTheDocument()
    expect(within(dialogo()).queryByText(/dado externo/)).not.toBeInTheDocument()
    expect(salvar()).toBeInTheDocument()
  })

  it('abre com os valores salvos do indicador (identificador, URL e parâmetros com JSON.stringify(obj, null, 2))', () => {
    renderizar()

    expect(campo('Identificador da consulta')).toHaveValue('META_MARGEM')
    expect(campo('URL')).toHaveValue(URL_META_VIA_API)
    expect(campo('Parâmetros de saída')).toHaveValue(SAIDA_TEXTO)
    expect(campo('Parâmetros de entrada')).toHaveValue(ENTRADA_TEXTO)
    expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
    expect(salvar()).toBeEnabled()
  })

  it('integração pendente (tudo null): campos vazios e "Salvar configurações" bloqueado', () => {
    renderizar({ dado: PENDENTE })

    expect(campo('Identificador da consulta')).toHaveValue('')
    expect(campo('URL')).toHaveValue('')
    expect(campo('Parâmetros de saída')).toHaveValue('')
    expect(campo('Parâmetros de entrada')).toHaveValue('')
    expect(salvar()).toBeDisabled()
  })

  it('sem janela retroativa nem dia da coleta, mostra as variáveis disponíveis da API', () => {
    renderizar()

    const variaveis = within(dialogo()).getByRole('group', { name: 'Variáveis disponíveis' })
    expect(within(variaveis).getByRole('button', { name: /%filial%/ })).toBeInTheDocument()
    expect(within(variaveis).getByRole('button', { name: /%competencia%/ })).toBeInTheDocument()
  })

  it('preencher a integração pendente e salvar chama onConfirmar com os quatro campos e as variáveis usadas', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dado: PENDENTE })

    await user.type(campo('Identificador da consulta'), 'meta_faturamento')
    await colar(user, campo('URL'), URL_META_VIA_API)
    await colar(user, campo('Parâmetros de saída'), SAIDA_TEXTO)
    await colar(user, campo('Parâmetros de entrada'), ENTRADA_TEXTO)
    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar.mock.calls[0][0]).toEqual({
      identificador: 'META_FATURAMENTO',
      url: URL_META_VIA_API,
      parametrosSaida: SAIDA_TEXTO,
      parametrosEntrada: ENTRADA_TEXTO,
      variaveisUsadas: expect.arrayContaining(['filial', 'competencia']) as unknown as string[],
    })
  })

  it('erros do 400 aparecem junto aos campos e a mensagem geral no alerta', () => {
    const errosCampos: ErroIntegracao[] = [
      { campo: 'url', mensagem: 'url invalida', linha: null, coluna: null, caminho: null, expressao: null },
    ]
    renderizar({ erro: 'integracao invalida', errosCampos })

    expect(within(dialogo()).getByText('integracao invalida').closest('[role="alert"]')).not.toBeNull()
    expect(campo('URL')).toHaveAccessibleDescription(expect.stringContaining('url invalida'))
  })

  /**
   * Alteração de 10/11/2026: na integração do indicador o campo de valor de cada item é `meta`
   * (`validarSaida(texto, 'meta')`), "Inserir modelo de saída" usa `MODELO_JSON_SAIDA_META` e a orientação
   * do formato fala em meta.
   */
  describe('saída em lista com filial e meta', () => {
    it('mostra a orientação "Lista com um item por filial: filial e meta (competencia opcional)."', () => {
      renderizar()

      expect(within(dialogo()).getByText('Lista com um item por filial: filial e meta (competencia opcional).')).toBeInTheDocument()
      expect(within(dialogo()).queryByText(/filial e valor/)).not.toBeInTheDocument()
    })

    it('a saída salva (lista com filial e meta) é válida: "2 campos: filial (texto), meta (texto)"', () => {
      renderizar()

      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '2 campos: filial (texto), meta (texto)',
      )
    })

    it('"Inserir modelo de saída" usa o modelo do indicador (MODELO_JSON_SAIDA_META), válido', async () => {
      const user = usuarioRapido()
      renderizar({ dado: PENDENTE })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))

      expect(campo('Parâmetros de saída')).toHaveValue(MODELO_JSON_SAIDA_META)
      expect(campo('Parâmetros de saída')).not.toHaveValue(MODELO_JSON_SAIDA)
      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '3 campos: filial (texto), meta (texto), competencia (texto)',
      )
    })

    it('lista com valor no lugar de meta é inválida ("Item 1: falta o campo meta") e bloqueia o salvar', () => {
      renderizar({ dado: { ...CONFIGURADO, parametrosSaida: [{ filial: '100', valor: '4600000' }] } })

      const validacao = within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })
      expect(validacao).toHaveTextContent('JSON de saída inválido')
      expect(validacao).toHaveTextContent('Item 1: falta o campo meta')
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
    })

    it('saída salva como objeto solto (formato anterior) é inválida: "A saída deve ser uma lista com um item por filial"', () => {
      renderizar({ dado: { ...CONFIGURADO, parametrosSaida: { filial: '100', meta: '4600000' } } })

      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        'A saída deve ser uma lista com um item por filial',
      )
      expect(salvar()).toBeDisabled()
    })
  })

  it('sem tipoAlvo (padrão "dado-externo") o texto continua o do dado externo', () => {
    render(
      <DialogoConcluirConstrucao
        modo="configurar"
        dado={CONFIGURADO}
        identificadores={[]}
        variaveis={variaveisIntegracaoSemExemplo()}
        carregandoVariaveis={false}
        erroVariaveis={null}
        concluindo={false}
        erro={null}
        hoje={HOJE}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )

    expect(within(dialogo()).getByText('Revise a integração do dado externo Margem com meta da TI e salve as configurações.')).toBeInTheDocument()
  })
})
