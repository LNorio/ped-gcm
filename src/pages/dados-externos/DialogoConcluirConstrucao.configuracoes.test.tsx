import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import {
  DADO_COBERTURA_API,
  DADO_FATURAMENTO_API,
  ENTRADA_FATURAMENTO_API,
  SAIDA_FATURAMENTO_API,
  SAIDA_VOLUME_API,
  URL_FATURAMENTO,
  identificadoresApi,
  variaveisIntegracaoSemExemplo,
} from '../../test/dadosExternosFalsos'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { DadoExterno, ErroIntegracao } from '../../types/dominio'
import { MODELO_JSON_SAIDA } from '../../utils/integracao/modelos'
import {
  type DadosConclusaoConstrucao,
  DialogoConcluirConstrucao,
  type DialogoConcluirConstrucaoProps,
} from './DialogoConcluirConstrucao'

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

/** Ativo com integração gravada (parâmetros como objetos, como vêm na listagem do Admin). */
const FATURAMENTO = comIntegracao(paraDadoExterno(DADO_FATURAMENTO_API), {
  url: URL_FATURAMENTO,
  parametrosSaida: SAIDA_FATURAMENTO_API,
  parametrosEntrada: ENTRADA_FATURAMENTO_API,
  variaveisUsadas: ['dataFinal', 'dataInicial', 'filial'],
})
/** Inativo com a integração pendente: sem URL nem parâmetros. */
const COBERTURA_PENDENTE = comIntegracao(paraDadoExterno(DADO_COBERTURA_API), { integracaoPendente: true })

const SAIDA_TEXTO = JSON.stringify(SAIDA_FATURAMENTO_API, null, 2)
const ENTRADA_TEXTO = JSON.stringify(ENTRADA_FATURAMENTO_API, null, 2)
const HOJE = new Date(2026, 9, 15)

/**
 * Mesma modal em modo configuração (F5.16, botão "Configurações"/"Preencher integração"):
 * `modo="configurar"` → título "Configurações da integração", campos preenchidos com identificador, url
 * e `JSON.stringify(obj, null, 2)` dos parâmetros (null → vazio) e botão "Salvar configurações".
 * `modo` é opcional; o padrão é `"concluir"` (título "Concluir construção", botão "Concluir e ativar").
 */
describe('F5.16 — DialogoConcluirConstrucao em modo "configurar" (Configurações da integração)', () => {
  function renderizar(props: Partial<DialogoConcluirConstrucaoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosConclusaoConstrucao) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const montar = (extra: Partial<DialogoConcluirConstrucaoProps> = {}) => (
      <DialogoConcluirConstrucao
        modo="configurar"
        dado={props.dado === undefined ? FATURAMENTO : props.dado}
        identificadores={identificadoresApi()}
        variaveis={props.variaveis ?? variaveisIntegracaoSemExemplo()}
        carregandoVariaveis={false}
        erroVariaveis={null}
        concluindo={props.concluindo ?? false}
        erro={props.erro ?? null}
        errosCampos={props.errosCampos ?? []}
        hoje={HOJE}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
        {...extra}
      />
    )
    const utils = render(montar())
    return { ...utils, onConfirmar, onCancelar, rerenderizar: (extra: Partial<DialogoConcluirConstrucaoProps>) => utils.rerender(montar(extra)) }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Configurações da integração' })
  const identificador = () => within(dialogo()).getByLabelText('Identificador da consulta') as HTMLInputElement
  const url = () => within(dialogo()).getByLabelText('URL') as HTMLInputElement
  const saida = () => within(dialogo()).getByLabelText('Parâmetros de saída') as HTMLTextAreaElement
  const entrada = () => within(dialogo()).getByLabelText('Parâmetros de entrada') as HTMLTextAreaElement
  const salvar = () => within(dialogo()).getByRole('button', { name: 'Salvar configurações' })
  const botaoVariavel = (nome: string) =>
    within(within(dialogo()).getByRole('group', { name: 'Variáveis disponíveis' })).getByRole('button', { name: new RegExp(`%${nome}%`) })
  const operador = (simbolo: string) => within(within(dialogo()).getByRole('group', { name: 'Operadores' })).getByRole('button', { name: simbolo })

  /** Clique do usuário no ponto `posicao` da caixa (foco + cursor). */
  async function posicionarCursor(user: Usuario, campo: HTMLElement, posicao: number) {
    await user.pointer({ target: campo, offset: posicao, keys: '[MouseLeft]' })
  }

  it('título "Configurações da integração" e botão "Salvar configurações" (sem "Concluir e ativar")', () => {
    renderizar()

    expect(dialogo()).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Concluir construção' })).not.toBeInTheDocument()
    expect(salvar()).toBeInTheDocument()
    expect(within(dialogo()).queryByRole('button', { name: 'Concluir e ativar' })).not.toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('abre com os valores salvos: identificador, URL e os parâmetros formatados com JSON.stringify(obj, null, 2)', () => {
    renderizar()

    expect(identificador()).toHaveValue('FATURAMENTO')
    expect(url()).toHaveValue(URL_FATURAMENTO)
    expect(saida()).toHaveValue(SAIDA_TEXTO)
    expect(entrada()).toHaveValue(ENTRADA_TEXTO)
  })

  it('parâmetros de saída em lista também são formatados com 2 espaços', () => {
    renderizar({ dado: { ...FATURAMENTO, parametrosSaida: SAIDA_VOLUME_API } })

    expect(saida()).toHaveValue(JSON.stringify(SAIDA_VOLUME_API, null, 2))
  })

  it('os valores salvos já aparecem validados ("JSON válido") e o botão fica habilitado com "Todos os campos obrigatórios preenchidos"', () => {
    renderizar()

    expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })).toHaveTextContent(
      '2 campos: filial (texto), valor (texto)',
    )
    expect(within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de entrada' })).toHaveTextContent('JSON válido')
    expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
    expect(salvar()).toBeEnabled()
  })

  it('Salvar configurações chama onConfirmar com o identificador, a URL e os textos das caixas', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        identificador: 'FATURAMENTO',
        url: URL_FATURAMENTO,
        parametrosSaida: SAIDA_TEXTO,
        parametrosEntrada: ENTRADA_TEXTO,
      }),
    )
  })

  it('alterar a URL e salvar envia a URL nova', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.clear(url())
    await colar(user, url(), 'https://ti.exemplo.com.br/api/faturamento-v2')
    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://ti.exemplo.com.br/api/faturamento-v2' }))
  })

  /**
   * Alteração de 10/11/2026 (seção 2.3 de `RESPOSTA-FINAL-meta-via-api.md`): a saída é uma lista com um
   * item por filial (`filial` e `valor`). Uma integração gravada antes, com a saída como objeto solto,
   * abre com a saída inválida e o salvar bloqueado até a saída ser corrigida.
   */
  describe('saída em lista', () => {
    const OBJETO_ANTIGO = { valor: '0', referencia: 'x' }

    it('saída salva como objeto solto (formato antigo): "JSON de saída inválido", "falta: JSON de saída válido" e salvar bloqueado', () => {
      renderizar({ dado: { ...FATURAMENTO, parametrosSaida: OBJETO_ANTIGO } })

      expect(saida()).toHaveValue(JSON.stringify(OBJETO_ANTIGO, null, 2))
      const validacao = within(dialogo()).getByRole('status', { name: 'Validação dos parâmetros de saída' })
      expect(validacao).toHaveTextContent('JSON de saída inválido')
      expect(validacao).toHaveTextContent('A saída deve ser uma lista com um item por filial')
      expect(within(dialogo()).getByText('falta: JSON de saída válido')).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
    })

    it('corrigir a saída antiga com "Inserir modelo de saída" libera o salvar e envia a lista', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ dado: { ...FATURAMENTO, parametrosSaida: OBJETO_ANTIGO } })

      await user.click(within(dialogo()).getByRole('button', { name: 'Inserir modelo de saída' }))
      expect(salvar()).toBeEnabled()
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ parametrosSaida: MODELO_JSON_SAIDA }))
    })

    it('mostra a orientação do formato do dado externo', () => {
      renderizar()

      expect(within(dialogo()).getByText('Lista com um item por filial: filial e valor (competencia opcional).')).toBeInTheDocument()
    })
  })

  it('dado com integração pendente (sem URL nem parâmetros): só o identificador vem preenchido e o botão fica bloqueado', () => {
    renderizar({ dado: COBERTURA_PENDENTE })

    expect(identificador()).toHaveValue('COBERTURA')
    expect(url()).toHaveValue('')
    expect(saida()).toHaveValue('')
    expect(entrada()).toHaveValue('')
    expect(within(dialogo()).getByText('falta: URL válida, JSON de saída válido, JSON de entrada válido')).toBeInTheDocument()
    expect(salvar()).toBeDisabled()
  })

  it('dado sem identificador gravado começa com o identificador vazio', () => {
    renderizar({ dado: { ...COBERTURA_PENDENTE, identificador: null } })

    expect(identificador()).toHaveValue('')
    expect(within(dialogo()).getByText('falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido')).toBeInTheDocument()
  })

  it('URL inválida bloqueia o salvar ("falta: URL válida")', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.clear(url())
    await colar(user, url(), 'ti.exemplo.com.br')

    expect(within(dialogo()).getByText('falta: URL válida')).toBeInTheDocument()
    expect(salvar()).toBeDisabled()
    await user.click(salvar())
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('com concluindo (salvando), "Salvar configurações" fica desabilitado', () => {
    renderizar({ concluindo: true })

    expect(salvar()).toBeDisabled()
  })

  it('erro da API: mensagem geral em alerta e erros junto aos campos, sem apagar os valores', () => {
    const erros: ErroIntegracao[] = [
      { campo: 'url', mensagem: 'URL invalida', linha: null, coluna: null, caminho: null, expressao: null },
    ]
    const { rerenderizar } = renderizar()

    rerenderizar({ erro: 'integracao invalida: URL ...', errosCampos: erros })

    expect(within(dialogo()).getByText('integracao invalida: URL ...').closest('[role="alert"]')).not.toBeNull()
    expect(url()).toHaveAttribute('aria-invalid', 'true')
    expect(url()).toHaveAccessibleDescription(expect.stringContaining('URL invalida'))
    expect(url()).toHaveValue(URL_FATURAMENTO)
    expect(saida()).toHaveValue(SAIDA_TEXTO)
  })

  it('mostra as variáveis disponíveis e os operadores, como na conclusão', () => {
    renderizar()

    expect(within(within(dialogo()).getByRole('group', { name: 'Variáveis disponíveis' })).getAllByRole('button')).toHaveLength(13)
    expect(within(dialogo()).getByRole('group', { name: 'Operadores' })).toBeInTheDocument()
  })

  describe('inserir variável ou operador com a entrada já preenchida (decisão de 10/11/2026)', () => {
    it('sem clicar antes na caixa de entrada, a variável vai para o fim do texto (não para a posição 0, antes do "{")', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoVariavel('mes'))

      expect(entrada()).toHaveValue(`${ENTRADA_TEXTO}%mes%`)
      expect(entrada().value.startsWith('{')).toBe(true)
    })

    it('sem clicar na caixa, cliques seguidos vão para o fim, um depois do outro', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoVariavel('mes'))
      await user.click(operador('+'))
      await user.click(botaoVariavel('ano'))

      expect(entrada()).toHaveValue(`${ENTRADA_TEXTO}%mes%+%ano%`)
    })

    it('com o cursor posicionado pelo usuário no meio do texto, a variável entra nesse ponto', async () => {
      const user = usuarioRapido()
      renderizar()
      const posicao = ENTRADA_TEXTO.indexOf('%dataFinal%') + '%dataFinal%'.length

      await posicionarCursor(user, entrada(), posicao)
      await user.click(botaoVariavel('mes'))

      expect(entrada()).toHaveValue(`${ENTRADA_TEXTO.slice(0, posicao)}%mes%${ENTRADA_TEXTO.slice(posicao)}`)
    })

    it('com o cursor no meio, dois cliques seguidos inserem em sequência a partir desse ponto', async () => {
      const user = usuarioRapido()
      renderizar()
      const posicao = ENTRADA_TEXTO.indexOf('%dataFinal%') + '%dataFinal%'.length

      await posicionarCursor(user, entrada(), posicao)
      await user.click(operador('+'))
      await user.click(botaoVariavel('diaColeta'))

      expect(entrada()).toHaveValue(`${ENTRADA_TEXTO.slice(0, posicao)}+%diaColeta%${ENTRADA_TEXTO.slice(posicao)}`)
    })
  })

  describe('limites do back-end: identificador até 60 caracteres e URL até 500 (decisão de 10/11/2026)', () => {
    const ERRO_IDENTIFICADOR = 'O identificador aceita até 60 caracteres.'
    const ERRO_URL = 'A URL aceita até 500 caracteres.'
    /** URL válida com exatamente `tamanho` caracteres. */
    const urlCom = (tamanho: number) => 'https://' + 'a'.repeat(tamanho - 'https://'.length)

    it('identificador salvo com 61 caracteres: conta como faltando "identificador", mostra o limite no campo e bloqueia o salvar', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ dado: { ...FATURAMENTO, identificador: 'A'.repeat(61) } })

      expect(within(dialogo()).getByText('falta: identificador')).toBeInTheDocument()
      expect(identificador()).toHaveAttribute('aria-invalid', 'true')
      expect(identificador()).toHaveAccessibleDescription(expect.stringContaining(ERRO_IDENTIFICADOR))
      expect(within(dialogo()).getByText(ERRO_IDENTIFICADOR)).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
      await user.click(salvar())
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('identificador com exatamente 60 caracteres é aceito, sem a mensagem de limite', () => {
      renderizar({ dado: { ...FATURAMENTO, identificador: 'A'.repeat(60) } })

      expect(within(dialogo()).queryByText(ERRO_IDENTIFICADOR)).not.toBeInTheDocument()
      expect(identificador()).not.toHaveAttribute('aria-invalid', 'true')
      expect(within(dialogo()).getByText('Todos os campos obrigatórios preenchidos')).toBeInTheDocument()
      expect(salvar()).toBeEnabled()
    })

    it('apagar o excesso do identificador (61 → 60) tira a mensagem e libera o salvar', async () => {
      const user = usuarioRapido()
      renderizar({ dado: { ...FATURAMENTO, identificador: 'A'.repeat(61) } })

      await user.type(identificador(), '{End}{Backspace}')

      expect(identificador()).toHaveValue('A'.repeat(60))
      expect(within(dialogo()).queryByText(ERRO_IDENTIFICADOR)).not.toBeInTheDocument()
      expect(salvar()).toBeEnabled()
    })

    it('URL salva com 501 caracteres: conta como faltando "URL válida", mostra o limite no campo e bloqueia o salvar', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ dado: { ...FATURAMENTO, url: urlCom(501) } })

      expect(within(dialogo()).getByText('falta: URL válida')).toBeInTheDocument()
      expect(url()).toHaveAttribute('aria-invalid', 'true')
      expect(url()).toHaveAccessibleDescription(expect.stringContaining(ERRO_URL))
      expect(within(dialogo()).getByText(ERRO_URL)).toBeInTheDocument()
      expect(salvar()).toBeDisabled()
      await user.click(salvar())
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('URL com exatamente 500 caracteres é aceita, sem a mensagem de limite', () => {
      renderizar({ dado: { ...FATURAMENTO, url: urlCom(500) } })

      expect(within(dialogo()).queryByText(ERRO_URL)).not.toBeInTheDocument()
      expect(url()).not.toHaveAttribute('aria-invalid', 'true')
      expect(salvar()).toBeEnabled()
    })

    it('os dois acima do limite: "falta: identificador, URL válida" e as duas mensagens', () => {
      renderizar({ dado: { ...FATURAMENTO, identificador: 'A'.repeat(61), url: urlCom(501) } })

      expect(within(dialogo()).getByText('falta: identificador, URL válida')).toBeInTheDocument()
      expect(within(dialogo()).getByText(ERRO_IDENTIFICADOR)).toBeInTheDocument()
      expect(within(dialogo()).getByText(ERRO_URL)).toBeInTheDocument()
    })

    it('os campos têm maxLength 60 (identificador) e 500 (URL) também no modo configurar', () => {
      renderizar()

      expect(identificador()).toHaveAttribute('maxLength', '60')
      expect(url()).toHaveAttribute('maxLength', '500')
    })
  })

  it('Cancelar chama onCancelar', async () => {
    const user = usuarioRapido()
    const { onCancelar, onConfirmar } = renderizar()

    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('sem modo (padrão "concluir"), o mesmo dado abre "Concluir construção" com os campos vazios', () => {
    render(
      <DialogoConcluirConstrucao
        dado={FATURAMENTO}
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

    const concluir = screen.getByRole('dialog', { name: 'Concluir construção' })
    expect(within(concluir).getByRole('button', { name: 'Concluir e ativar' })).toBeInTheDocument()
    expect(within(concluir).getByLabelText('URL')).toHaveValue('')
  })
})
