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
 * Alteração de 11/11/2026 (saída por "chave: tipo"): `AlvoIntegracao` ganha `mapeamentoSaida?:
 * MapeamentoSaida | null` e `DadosConclusaoConstrucao` ganha `mapeamento: MapeamentoSaida` (no indicador,
 * com `campoMeta`).
 */
/**
 * Saída da integração da meta por "chave: tipo" (11/11/2026 — `FRONT-saida-chave-tipo.md`, opção B), com o
 * mapeamento salvo em `mapeamentoSaida` (`campoMeta` no indicador). Constantes locais para não depender do
 * formato de `SAIDA_META_VIA_API` (`indicadoresFalsos.ts`, de outro requisito).
 */
const SAIDA_META_TIPOS = { codemp: 'string', codfil: 'string', metVlr: 'number', datCpt: 'date' }
const MAPEAMENTO_META = { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null }
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
  mapeamentoSaida: MAPEAMENTO_META,
}

const PENDENTE: AlvoIntegracao = {
  id: 10,
  nome: 'Faturamento com meta da TI',
  identificador: null,
  url: null,
  parametrosSaida: null,
  parametrosEntrada: null,
  mapeamentoSaida: null,
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

  it('preencher a integração pendente e salvar chama onConfirmar com os quatro campos, o mapeamento (campoMeta) e as variáveis usadas', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dado: PENDENTE })

    await user.type(campo('Identificador da consulta'), 'meta_faturamento')
    await colar(user, campo('URL'), URL_META_VIA_API)
    await colar(user, campo('Parâmetros de saída'), SAIDA_TEXTO)
    await user.selectOptions(campo('Campo da filial'), 'codfil')
    await user.selectOptions(campo('Campo da meta'), 'metVlr')
    await user.selectOptions(campo('Campo da competência'), 'datCpt')
    await colar(user, campo('Parâmetros de entrada'), ENTRADA_TEXTO)
    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar.mock.calls[0][0]).toEqual({
      identificador: 'META_FATURAMENTO',
      url: URL_META_VIA_API,
      parametrosSaida: SAIDA_TEXTO,
      parametrosEntrada: ENTRADA_TEXTO,
      mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'datCpt' },
      variaveisUsadas: expect.arrayContaining(['empresas', 'competencia']) as unknown as string[],
    })
    expect(onConfirmar.mock.calls[0][0].mapeamento).not.toHaveProperty('campoValor')
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
   * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `FRONT-saida-chave-tipo.md`): na
   * integração do indicador o papel do valor é a **meta**: a lista se chama "Campo da meta" (obrigatória,
   * com asterisco; não há "Campo do valor"), o "falta: ..." diz "campo da meta", a meta precisa ser
   * `number`, os erros do 400 com campo `"campo da meta"` vão para essa lista e "Inserir modelo de saída"
   * usa `MODELO_JSON_SAIDA_META` (`{ "codfil": "string", "metVlr": "number" }`). As listas abrem com o
   * `mapeamentoSaida` salvo. Uma integração salva em lista (formato antigo) abre com o aviso para
   * reescrever e o salvar bloqueado, como no dado externo.
   */
  describe('saída por "chave: tipo" e mapeamento com "Campo da meta"', () => {
    const AVISO_FORMATO_ANTIGO = 'Esta integração está no formato antigo (lista). Reescreva a saída no formato "campo": "tipo" para salvar.'

    it('mostra "Campo da filial", "Campo da meta" e "Campo da competência", sem "Campo do valor"', () => {
      renderizar()

      expect(campo('Campo da filial').tagName).toBe('SELECT')
      expect(campo('Campo da meta').tagName).toBe('SELECT')
      expect((campo('Campo da meta') as HTMLSelectElement).labels?.[0]?.textContent).toBe('Campo da meta *')
      expect(campo('Campo da competência').tagName).toBe('SELECT')
      expect(within(dialogo()).queryByLabelText('Campo do valor')).not.toBeInTheDocument()
    })

    it('a saída salva é válida ("4 campos: ...") e as listas abrem com o mapeamento salvo', () => {
      renderizar()

      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        '4 campos: codemp (string), codfil (string), metVlr (number), datCpt (date)',
      )
      expect(campo('Campo da filial')).toHaveValue('codfil')
      expect(campo('Campo da meta')).toHaveValue('metVlr')
      expect(campo('Campo da competência')).toHaveValue('')
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

    it('sem a meta escolhida: "falta: campo da meta" e salvar bloqueado', () => {
      renderizar({ dado: { ...CONFIGURADO, mapeamentoSaida: { campoFilial: 'codfil', campoCompetencia: null } } })

      expect(campo('Campo da meta')).toHaveValue('')
      expect(within(dialogo()).getByText('falta: campo da meta')).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
    })

    it('meta que não é number → "O campo da meta ("codemp") é do tipo string; precisa ser number"', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campo('Campo da meta'), 'codemp')

      expect(campo('Campo da meta')).toHaveAccessibleDescription(
        expect.stringContaining('O campo da meta ("codemp") é do tipo string; precisa ser number'),
      )
      expect(salvar()).toBeDisabled()
    })

    it('mapeamento salvo sem meta (null): "falta: campo da filial, campo da meta"', () => {
      renderizar({ dado: { ...CONFIGURADO, mapeamentoSaida: null } })

      expect(within(dialogo()).getByText('falta: campo da filial, campo da meta')).toBeInTheDocument()
    })

    it('erro do 400 com campo "campo da meta" aparece junto ao "Campo da meta"', () => {
      const errosCampos: ErroIntegracao[] = [
        { campo: 'campo da meta', mensagem: 'informe o "campo da meta"', linha: null, coluna: null, caminho: null, expressao: null },
      ]
      renderizar({ erro: 'integracao invalida', errosCampos })

      expect(campo('Campo da meta')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('Campo da meta')).toHaveAccessibleDescription(expect.stringContaining('informe o "campo da meta"'))
      expect(within(dialogo()).getByRole('alert')).not.toHaveTextContent('informe o "campo da meta"')
    })

    it('saída salva em lista (formato antigo): aviso para reescrever, "Formato antigo (lista)..." e salvar bloqueado', () => {
      renderizar({ dado: { ...CONFIGURADO, parametrosSaida: [{ filial: '100', meta: '4600000' }], mapeamentoSaida: null } })

      expect(within(dialogo()).getByText(AVISO_FORMATO_ANTIGO)).toBeInTheDocument()
      expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
        'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.',
      )
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
