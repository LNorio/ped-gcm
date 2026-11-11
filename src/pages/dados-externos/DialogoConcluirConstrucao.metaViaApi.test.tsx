import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { URL_META_VIA_API } from '../../test/indicadoresFalsos'
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
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): `AlvoIntegracao`
 * **não** tem `mapeamentoSaida` e `DadosConclusaoConstrucao` **não** tem `mapeamento` (o mapeamento da
 * saída, criado e retirado no mesmo dia, deixou de ser requisito).
 */
/**
 * Saída da integração da meta por "chave: tipo" (11/11/2026 — `FRONT-saida-chave-tipo.md`, opção B).
 * Constantes locais para não depender do formato de `SAIDA_META_VIA_API` (`indicadoresFalsos.ts`, de outro
 * requisito).
 */
const SAIDA_META_TIPOS = { codemp: 'string', codfil: 'string', metVlr: 'number', datCpt: 'date' }
/**
 * Entrada SOAP { operacao, parametros } (exigida desde 11/11/2026 — executor, FRONT-meta-via-api-fase2.md,
 * seção 2.1). Constante local para não depender do formato de ENTRADA_META_VIA_API (indicadoresFalsos.ts).
 */
const ENTRADA_META_VIA_API = { operacao: 'MetasFiliais', parametros: { ECodEmp: '%empresas%', ECompet: '%competencia%' } }
const SAIDA_TEXTO = JSON.stringify(SAIDA_META_TIPOS, null, 2)
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const HOJE = new Date(2026, 10, 10)

const CONFIGURADO: AlvoIntegracao = {
  id: 11,
  nome: 'Margem com meta da TI',
  identificador: 'META_MARGEM',
  url: URL_META_VIA_API,
  parametrosSaida: SAIDA_META_TIPOS,
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

  it('preencher a integração pendente e salvar chama onConfirmar com os quatro campos e as variáveis usadas (sem mapeamento)', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dado: PENDENTE })

    await user.type(campo('Identificador da consulta'), 'meta_faturamento')
    await colar(user, campo('URL'), URL_META_VIA_API)
    await colar(user, campo('Parâmetros de saída'), SAIDA_TEXTO)
    await colar(user, campo('Parâmetros de entrada'), ENTRADA_TEXTO)
    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    const dados = vi.mocked(onConfirmar).mock.calls[0][0]
    expect(dados).toEqual({
      identificador: 'META_FATURAMENTO',
      url: URL_META_VIA_API,
      parametrosSaida: SAIDA_TEXTO,
      parametrosEntrada: ENTRADA_TEXTO,
      variaveisUsadas: expect.arrayContaining(['empresas', 'competencia']) as unknown as string[],
    })
    expect(dados).not.toHaveProperty('mapeamento')
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
   * Saída por "chave: tipo" (11/11/2026, opção B — `FRONT-saida-chave-tipo.md`): "Inserir modelo de saída"
   * usa `MODELO_JSON_SAIDA_META` (`{ "codfil": "string", "metVlr": "number" }`) no indicador. Uma integração
   * salva em lista (formato antigo) abre com o aviso para reescrever e o salvar bloqueado, como no dado externo.
   *
   * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): não há
   * "Campo da filial", "Campo da meta" nem "Campo da competência" (nem "Campo do valor"); o "falta: ..." não
   * cita "campo da meta"; um 400 com campo `"campo da meta"` vai para o alerta geral; qualquer saída válida
   * libera o salvar.
   */
  describe('saída por "chave: tipo" sem mapeamento', () => {
    const AVISO_FORMATO_ANTIGO = 'Esta integração está no formato antigo (lista). Reescreva a saída no formato "campo": "tipo" para salvar.'

    it('não mostra "Campo da filial", "Campo da meta", "Campo da competência" nem "Campo do valor"', () => {
      renderizar()

      for (const rotulo of ['Campo da filial', 'Campo da meta', 'Campo da competência', 'Campo do valor']) {
        expect(within(dialogo()).queryByLabelText(new RegExp(`^${rotulo}`))).not.toBeInTheDocument()
      }
      expect(within(dialogo()).queryAllByRole('combobox')).toHaveLength(0)
    })

    it('a saída salva é válida ("4 campos: ...") e o salvar fica liberado sem nenhuma escolha', () => {
      renderizar()

      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '4 campos: codemp (string), codfil (string), metVlr (number), datCpt (date)',
      )
      expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(salvar()).toBeEnabled()
    })

    it('"Inserir modelo de saída" usa o modelo do indicador (MODELO_JSON_SAIDA_META), válido', async () => {
      const user = usuarioRapido()
      renderizar({ dado: PENDENTE })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))

      expect(campo('Parâmetros de saída')).toHaveValue(MODELO_JSON_SAIDA_META)
      expect(campo('Parâmetros de saída')).not.toHaveValue(MODELO_JSON_SAIDA)
      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '2 campos: codfil (string), metVlr (number)',
      )
    })

    it('saída sem campo de meta (ex.: só texto) também é aceita: não há amarração', () => {
      renderizar({ dado: { ...CONFIGURADO, parametrosSaida: { codfil: 'string', descricao: 'string' } } })

      expect(within(dialogo()).queryByText(/campo da meta/)).not.toBeInTheDocument()
      expect(salvar()).toBeEnabled()
    })

    it('alvo antigo com mapeamentoSaida: nada do mapeamento aparece e o salvar não envia mapeamento', async () => {
      const user = usuarioRapido()
      const antigo = { ...CONFIGURADO, mapeamentoSaida: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null } } as AlvoIntegracao
      const { onConfirmar } = renderizar({ dado: antigo })

      expect(within(dialogo()).queryByLabelText(/^Campo da meta/)).not.toBeInTheDocument()
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(vi.mocked(onConfirmar).mock.calls[0][0]).not.toHaveProperty('mapeamento')
    })

    it('erro do 400 com campo "campo da meta" vai para o alerta geral', () => {
      const errosCampos: ErroIntegracao[] = [
        { campo: 'campo da meta', mensagem: 'informe o "campo da meta"', linha: null, coluna: null, caminho: null, expressao: null },
      ]
      renderizar({ erro: 'integracao invalida', errosCampos })

      const alerta = within(dialogo()).getByRole('alert')
      expect(alerta).toHaveTextContent('integracao invalida')
      expect(alerta).toHaveTextContent('informe o "campo da meta"')
      expect(campo('Parâmetros de saída')).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('saída salva em lista (formato antigo): aviso para reescrever, "Formato antigo (lista)..." e salvar bloqueado', () => {
      renderizar({ dado: { ...CONFIGURADO, parametrosSaida: [{ filial: '100', meta: '4600000' }] } })

      expect(within(dialogo()).getByText(AVISO_FORMATO_ANTIGO)).toBeInTheDocument()
      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.',
      )
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
    })

    it('mostra a mesma orientação do formato novo, sem a lista por filial', () => {
      renderizar()

      expect(
        within(dialogo()).getByText('Descreva um item da resposta como { "campo": "tipo" }, com os tipos string, number, date ou boolean.'),
      ).toBeInTheDocument()
      expect(within(dialogo()).queryByText(/Lista com um item por filial/)).not.toBeInTheDocument()
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
