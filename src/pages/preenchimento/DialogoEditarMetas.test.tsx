import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ErroDeIndicador } from '../../services/metasService'
import {
  INDICADOR_META_COBERTURA,
  INDICADOR_META_FATURAMENTO,
  INDICADOR_META_INADIMPLENCIA,
  janelaMetas,
} from '../../test/metasPreenchimentoFalsos'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'
import type { IndicadorMetaPreenchimento, ItemAjusteMeta } from '../../types/dominio'
import { DialogoEditarMetas, type DialogoEditarMetasProps } from './DialogoEditarMetas'

/**
 * Janela "Editar metas" do Preenchimento (`src/pages/preenchimento/DialogoEditarMetas.tsx` — RF-72,
 * RF-73, RN-07). Componente de apresentação: a página carrega a `JanelaMetas` e envia o ajuste.
 *
 * - `janela: JanelaMetas | null` (`null` = fechado). Diálogo "Editar metas" com pares `<dt>`/`<dd>`
 *   "Filial" ("{código} - {nome}", ou só o código sem nome), "Mês" (MM/AAAA) e "Situação"
 *   ("Aberto"/"Fechado").
 * - Filtro "Tipo" (combobox, local): "Todos os tipos" e os nomes dos tipos dos indicadores, na ordem em
 *   que aparecem, sem repetir.
 * - Tabela "Metas dos indicadores": "Indicador" (nome + Etiqueta "Ajustada" quando `ajustada`), "Tipos"
 *   (nomes separados por ", "), "Composição" (nomes dos itens), "Meta do cadastro" (número pt-BR com 2
 *   casas e a origem "Meta da filial"/"Meta geral"), "Meta vigente" (pt-BR, 2 casas) e, só no mês
 *   editável, "Nova meta" e "Motivo". Meta nula → "—". Indicador ajustado oferece o botão
 *   "Histórico de {nome}" → `onVerHistorico(indicador)` (também em consulta).
 * - Mês editável: campos "Nova meta de {nome}" e "Motivo do ajuste de {nome}"; linhas em branco ficam de
 *   fora; "Salvar metas" (submit) → `onConfirmar(itens: ItemAjusteMeta[])` na ordem da janela, meta com
 *   vírgula decimal (`lerDecimal`) e motivo aparado. Validações locais (sem confirmar):
 *   nenhuma linha → "Informe a nova meta de ao menos um indicador."; meta inválida, <= 0 ou em branco
 *   com motivo → "Informe uma meta maior que zero."; meta igual à vigente →
 *   "A nova meta deve ser diferente da meta vigente."; motivo vazio → "Informe o motivo do ajuste.".
 *   Erros no próprio campo (`aria-invalid` + descrição acessível); editar o campo limpa o erro dele.
 * - Mês não editável: somente consulta — sem campos nem "Salvar metas", com o aviso
 *   "Somente consulta: o ajuste de meta só é permitido no mês aberto.".
 * - `erro` (mensagem da API, ex.: 403/400) no alerta do diálogo; `errosIndicadores` (`errosDoAjusteMetas`)
 *   no campo "Nova meta de {nome}" do indicador; `idIndicador` nulo ou fora da lista fica só no alerta.
 * - `salvando` desabilita "Salvar metas". "Cancelar", "Fechar" e Esc chamam `onCancelar`.
 */
const MENSAGEM_META = 'Informe uma meta maior que zero.'
const MENSAGEM_IGUAL = 'A nova meta deve ser diferente da meta vigente.'
const MENSAGEM_MOTIVO = 'Informe o motivo do ajuste.'
const MENSAGEM_NENHUM = 'Informe a nova meta de ao menos um indicador.'
const MENSAGEM_CONSULTA = 'Somente consulta: o ajuste de meta só é permitido no mês aberto.'

describe('F9.9 — DialogoEditarMetas (janela "Editar metas" — RF-72, RF-73, RN-07)', () => {
  function renderizar(props: Partial<DialogoEditarMetasProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(itens: ItemAjusteMeta[]) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const onVerHistorico = props.onVerHistorico ?? vi.fn<(indicador: IndicadorMetaPreenchimento) => void>()
    const utils = render(
      <DialogoEditarMetas
        janela={props.janela === undefined ? janelaMetas() : props.janela}
        filial={props.filial ?? '101'}
        nomeFilial={props.nomeFilial === undefined ? 'CAMPO GRANDE' : props.nomeFilial}
        mesDeReferencia={props.mesDeReferencia ?? '2026-10-01'}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        errosIndicadores={props.errosIndicadores}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
        onVerHistorico={onVerHistorico}
      />,
    )
    return { ...utils, onConfirmar, onCancelar, onVerHistorico }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Editar metas' })
  const tabela = () => within(dialogo()).getByRole('table', { name: 'Metas dos indicadores' })
  const titulos = () => within(tabela()).getAllByRole('columnheader').map((c) => c.textContent ?? '')
  const linhas = () => within(tabela()).getAllByRole('row').slice(1)
  /** Linha cuja primeira célula começa pelo nome do indicador. */
  function linha(nome: string): HTMLElement {
    const encontrada = linhas().find((l) => within(l).getAllByRole('cell')[0]?.textContent?.startsWith(nome))
    if (!encontrada) throw new Error(`Linha não encontrada: ${nome}`)
    return encontrada
  }
  function celula(nome: string, coluna: string): HTMLElement {
    const indice = titulos().indexOf(coluna)
    if (indice < 0) throw new Error(`Coluna não encontrada: ${coluna}`)
    return within(linha(nome)).getAllByRole('cell')[indice]
  }
  const nomesNaTabela = () => linhas().map((l) => within(l).getAllByRole('cell')[0]?.textContent ?? '')
  const novaMeta = (nome: string) => within(dialogo()).getByRole('textbox', { name: `Nova meta de ${nome}` })
  const motivo = (nome: string) => within(dialogo()).getByRole('textbox', { name: `Motivo do ajuste de ${nome}` })
  const salvar = () => within(dialogo()).getByRole('button', { name: 'Salvar metas' })
  const filtroTipo = () => within(dialogo()).getByRole('combobox', { name: 'Tipo' })
  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`) do cabeçalho; `null` se o rótulo não existe. */
  function valor(rotulo: string): string | null {
    const termo = within(dialogo()).queryByText(rotulo, { selector: 'dt' })
    if (termo === null) return null
    return termo.nextElementSibling?.textContent ?? null
  }

  async function ajustar(user: Usuario, nome: string, meta: string, textoMotivo: string) {
    if (meta) await user.type(novaMeta(nome), meta)
    if (textoMotivo) await colar(user, motivo(nome), textoMotivo)
  }

  it('com janela null não renderiza nada', () => {
    renderizar({ janela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('cabeçalho e filtro por tipo (RF-72)', () => {
    it('abre "Editar metas" com a filial, o mês (MM/AAAA) e a situação', () => {
      renderizar()

      expect(valor('Filial')).toBe('101 - CAMPO GRANDE')
      expect(valor('Mês')).toBe('10/2026')
      expect(valor('Situação')).toBe('Aberto')
    })

    it('sem o nome da filial, mostra só o código; mês fechado mostra "Fechado"', () => {
      renderizar({ nomeFilial: null, mesDeReferencia: '2026-09-01', janela: janelaMetas({ situacaoDoMes: 'fechado', editavel: false }) })

      expect(valor('Filial')).toBe('101')
      expect(valor('Mês')).toBe('09/2026')
      expect(valor('Situação')).toBe('Fechado')
    })

    it('filtro "Tipo" começa em "Todos os tipos" e oferece os tipos dos indicadores, na ordem, sem repetir', () => {
      renderizar()

      expect(within(filtroTipo()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos os tipos', 'Comercial', 'Financeiro'])
      expect(within(filtroTipo()).getByRole('option', { name: 'Todos os tipos', selected: true })).toBeInTheDocument()
      expect(nomesNaTabela()).toHaveLength(3)
    })

    it('escolher um tipo mostra só os indicadores dele; "Todos os tipos" volta a mostrar todos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(filtroTipo(), within(filtroTipo()).getByRole('option', { name: 'Financeiro' }))
      expect(linhas()).toHaveLength(1)
      expect(nomesNaTabela()[0]).toMatch(/^Inadimplência/)

      await user.selectOptions(filtroTipo(), within(filtroTipo()).getByRole('option', { name: 'Comercial' }))
      expect(linhas()).toHaveLength(2)

      await user.selectOptions(filtroTipo(), within(filtroTipo()).getByRole('option', { name: 'Todos os tipos' }))
      expect(linhas()).toHaveLength(3)
    })

    it('indicador com mais de um tipo aparece no filtro de cada um deles', async () => {
      const user = usuarioRapido()
      const misto: IndicadorMetaPreenchimento = { ...INDICADOR_META_FATURAMENTO, tipos: ['Comercial', 'Financeiro'] }
      renderizar({ janela: janelaMetas({ indicadores: [INDICADOR_META_COBERTURA, misto, INDICADOR_META_INADIMPLENCIA] }) })

      expect(celula('Faturamento', 'Tipos')).toHaveTextContent('Comercial, Financeiro')
      await user.selectOptions(filtroTipo(), within(filtroTipo()).getByRole('option', { name: 'Financeiro' }))

      expect(linhas()).toHaveLength(2)
      expect(nomesNaTabela().map((n) => n.startsWith('Faturamento') || n.startsWith('Inadimplência'))).toEqual([true, true])
    })
  })

  describe('indicadores (RF-72, RN-07)', () => {
    it('tabela "Metas dos indicadores" com as colunas do requisito, uma linha por indicador, na ordem da janela', () => {
      renderizar()

      for (const coluna of ['Indicador', 'Tipos', 'Composição', 'Meta do cadastro', 'Meta vigente', 'Nova meta', 'Motivo']) {
        expect(titulos()).toContain(coluna)
      }
      expect(titulos().indexOf('Meta do cadastro')).toBeLessThan(titulos().indexOf('Meta vigente'))
      const nomes = ['Cobertura de clientes', 'Faturamento', 'Inadimplência']
      expect(nomesNaTabela().map((texto) => nomes.find((nome) => texto.startsWith(nome)))).toEqual(nomes)
    })

    it('mostra tipos, composição, meta do cadastro com a origem e meta vigente em pt-BR (2 casas)', () => {
      renderizar()

      expect(celula('Cobertura de clientes', 'Tipos')).toHaveTextContent('Comercial')
      expect(celula('Cobertura de clientes', 'Composição')).toHaveTextContent('Visitas a clientes')
      expect(celula('Cobertura de clientes', 'Meta do cadastro')).toHaveTextContent('1.500,00')
      expect(celula('Cobertura de clientes', 'Meta do cadastro')).toHaveTextContent('Meta geral')
      expect(celula('Cobertura de clientes', 'Meta vigente')).toHaveTextContent('2.000,25')

      expect(celula('Faturamento', 'Composição')).toHaveTextContent('Faturamento (ERP)')
      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('500.000,00')
      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('Meta da filial')
      expect(celula('Faturamento', 'Meta do cadastro')).not.toHaveTextContent('Meta geral')
      expect(celula('Faturamento', 'Meta vigente')).toHaveTextContent('500.000,00')
    })

    it('etiqueta "Ajustada" só no indicador com ajuste no mês', () => {
      renderizar()

      expect(within(celula('Cobertura de clientes', 'Indicador')).getByText('Ajustada')).toBeInTheDocument()
      expect(within(celula('Faturamento', 'Indicador')).queryByText('Ajustada')).not.toBeInTheDocument()
      expect(within(celula('Inadimplência', 'Indicador')).queryByText('Ajustada')).not.toBeInTheDocument()
    })

    it('meta do cadastro e meta vigente nulas aparecem como "—"; composição nula também', () => {
      const semMeta: IndicadorMetaPreenchimento = {
        ...INDICADOR_META_FATURAMENTO,
        composicao: null,
        metaDoCadastro: null,
        metaDoCadastroOrigem: null,
        metaVigente: null,
      }
      renderizar({ janela: janelaMetas({ indicadores: [semMeta] }) })

      expect(celula('Faturamento', 'Meta do cadastro')).toHaveTextContent('—')
      expect(celula('Faturamento', 'Meta vigente')).toHaveTextContent('—')
      expect(celula('Faturamento', 'Composição')).toHaveTextContent('—')
    })
  })

  describe('histórico (RF-74)', () => {
    it('só o indicador ajustado oferece "Histórico de {nome}", que chama onVerHistorico com o indicador', async () => {
      const user = usuarioRapido()
      const { onVerHistorico } = renderizar()

      expect(within(dialogo()).queryByRole('button', { name: 'Histórico de Faturamento' })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Histórico de Inadimplência' })).not.toBeInTheDocument()
      await user.click(within(linha('Cobertura de clientes')).getByRole('button', { name: 'Histórico de Cobertura de clientes' }))

      expect(onVerHistorico).toHaveBeenCalledTimes(1)
      expect(onVerHistorico).toHaveBeenCalledWith(INDICADOR_META_COBERTURA)
    })

    it('em mês de consulta, o histórico continua disponível', () => {
      renderizar({ janela: janelaMetas({ situacaoDoMes: 'fechado', editavel: false }) })

      expect(within(dialogo()).getByRole('button', { name: 'Histórico de Cobertura de clientes' })).toBeInTheDocument()
    })
  })

  describe('ajuste no mês aberto (RF-73)', () => {
    it('cada indicador tem "Nova meta de {nome}" e "Motivo do ajuste de {nome}", vazios; "Salvar metas" é submit', () => {
      renderizar()

      for (const nome of ['Cobertura de clientes', 'Faturamento', 'Inadimplência']) {
        expect(novaMeta(nome)).toHaveValue('')
        expect(motivo(nome)).toHaveValue('')
      }
      expect(salvar()).toHaveAttribute('type', 'submit')
      expect(within(dialogo()).queryByText(MENSAGEM_CONSULTA)).not.toBeInTheDocument()
    })

    it('envia só as linhas preenchidas, com vírgula decimal e motivo aparado', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Faturamento', '520.000,50', '  reforma da loja  ')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith([{ idIndicador: 13, meta: 520000.5, motivo: 'reforma da loja' }])
    })

    it('várias linhas vão num único onConfirmar, na ordem da janela', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Inadimplência', '4,5', 'meta mais exigente')
      await ajustar(user, 'Cobertura de clientes', '1800', 'sazonalidade')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith([
        { idIndicador: 12, meta: 1800, motivo: 'sazonalidade' },
        { idIndicador: 14, meta: 4.5, motivo: 'meta mais exigente' },
      ])
    })

    it('nenhuma linha preenchida: "Informe a nova meta de ao menos um indicador." e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.click(salvar())

      expect(within(dialogo()).getByText(MENSAGEM_NENHUM)).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it.each(['0', '-3', 'abc', '0,00'])('nova meta "%s" mostra "Informe uma meta maior que zero." no campo e não confirma', async (meta) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Faturamento', meta, 'motivo qualquer')
      await user.click(salvar())

      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Faturamento')).toHaveAccessibleDescription(MENSAGEM_META)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('motivo preenchido sem nova meta: "Informe uma meta maior que zero." na meta e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Faturamento', '', 'só o motivo')
      await user.click(salvar())

      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Faturamento')).toHaveAccessibleDescription(MENSAGEM_META)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it.each([
      ['Cobertura de clientes', '2.000,25'],
      ['Faturamento', '500000'],
    ])('nova meta igual à vigente (%s, "%s"): "A nova meta deve ser diferente da meta vigente." e não confirma', async (nome, meta) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, nome, meta, 'sem mudança')
      await user.click(salvar())

      expect(novaMeta(nome)).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta(nome)).toHaveAccessibleDescription(MENSAGEM_IGUAL)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('nova meta igual à do cadastro mas diferente da vigente é aceita', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Cobertura de clientes', '1.500', 'voltar à meta do cadastro')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledWith([{ idIndicador: 12, meta: 1500, motivo: 'voltar à meta do cadastro' }])
    })

    it.each(['', '   '])('motivo vazio ("%s") com nova meta: "Informe o motivo do ajuste." no motivo e não confirma', async (textoMotivo) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(novaMeta('Faturamento'), '600000')
      if (textoMotivo) await user.type(motivo('Faturamento'), textoMotivo)
      await user.click(salvar())

      expect(motivo('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(motivo('Faturamento')).toHaveAccessibleDescription(MENSAGEM_MOTIVO)
      expect(novaMeta('Faturamento')).not.toHaveAttribute('aria-invalid', 'true')
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('uma linha inválida impede o envio das válidas (lote tudo ou nada)', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await ajustar(user, 'Cobertura de clientes', '1800', 'sazonalidade')
      await ajustar(user, 'Faturamento', '0', 'erro')
      await user.click(salvar())

      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Cobertura de clientes')).not.toHaveAttribute('aria-invalid', 'true')
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('editar o campo limpa o erro dele', async () => {
      const user = usuarioRapido()
      renderizar()
      await ajustar(user, 'Faturamento', '0', '')
      await user.click(salvar())
      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(motivo('Faturamento')).toHaveAttribute('aria-invalid', 'true')

      await user.type(novaMeta('Faturamento'), '5')
      await user.type(motivo('Faturamento'), 'x')

      expect(novaMeta('Faturamento')).not.toHaveAttribute('aria-invalid', 'true')
      expect(motivo('Faturamento')).not.toHaveAttribute('aria-invalid', 'true')
      expect(within(dialogo()).queryByText(MENSAGEM_META)).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText(MENSAGEM_MOTIVO)).not.toBeInTheDocument()
    })

    it('a mensagem "ao menos um indicador" some ao preencher uma linha', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(salvar())

      await user.type(novaMeta('Faturamento'), '6')

      expect(within(dialogo()).queryByText(MENSAGEM_NENHUM)).not.toBeInTheDocument()
    })

    it('com salvando, "Salvar metas" fica desabilitado', () => {
      renderizar({ salvando: true })

      expect(salvar()).toBeDisabled()
    })

    it('"Cancelar", "Fechar" e Esc chamam onCancelar sem confirmar', async () => {
      const user = usuarioRapido()
      const { onCancelar, onConfirmar } = renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
      await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))
      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(3)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('mês de consulta (não editável — RF-73)', () => {
    it('sem campos de ajuste nem "Salvar metas", com o aviso de somente consulta', () => {
      renderizar({ mesDeReferencia: '2026-09-01', janela: janelaMetas({ situacaoDoMes: 'fechado', editavel: false }) })

      expect(within(dialogo()).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Salvar metas' })).not.toBeInTheDocument()
      expect(titulos()).not.toContain('Nova meta')
      expect(titulos()).not.toContain('Motivo')
      expect(within(dialogo()).getByText(MENSAGEM_CONSULTA)).toBeInTheDocument()
      expect(celula('Cobertura de clientes', 'Meta vigente')).toHaveTextContent('2.000,25')
    })

    it('"editavel" falso manda mesmo com a situação "aberto"', () => {
      renderizar({ janela: janelaMetas({ situacaoDoMes: 'aberto', editavel: false }) })

      expect(within(dialogo()).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(dialogo()).getByText(MENSAGEM_CONSULTA)).toBeInTheDocument()
    })

    it('"Fechar" chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onCancelar } = renderizar({ janela: janelaMetas({ situacaoDoMes: 'fechado', editavel: false }) })

      await user.click(within(dialogo()).getByRole('button', { name: 'Fechar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
    })
  })

  describe('erros da API', () => {
    it('a mensagem geral (ex.: 403 da meta pela integração) aparece no alerta do diálogo', () => {
      renderizar({ erro: 'o indicador 15 tem a meta definida pela integracao e nao pode ser ajustado' })

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('o indicador 15 tem a meta definida pela integracao e nao pode ser ajustado')
    })

    it('cada erro com indicador vai para o campo "Nova meta" dele (aria-invalid e descrição acessível)', () => {
      const errosIndicadores: ErroDeIndicador[] = [
        { idIndicador: 13, mensagem: 'o indicador 13 nao tem meta cadastrada para a filial' },
        { idIndicador: 12, mensagem: 'a nova meta deve ser diferente da vigente' },
      ]
      renderizar({ erro: 'nao foi possivel ajustar as metas', errosIndicadores })

      expect(novaMeta('Faturamento')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Faturamento')).toHaveAccessibleDescription('o indicador 13 nao tem meta cadastrada para a filial')
      expect(novaMeta('Cobertura de clientes')).toHaveAttribute('aria-invalid', 'true')
      expect(novaMeta('Cobertura de clientes')).toHaveAccessibleDescription('a nova meta deve ser diferente da vigente')
      expect(novaMeta('Inadimplência')).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('erro com indicador nulo ou fora da lista fica só no alerta geral (nenhum campo inválido)', () => {
      renderizar({
        erro: 'nao foi possivel ajustar as metas',
        errosIndicadores: [
          { idIndicador: null, mensagem: 'mes fechado' },
          { idIndicador: 99, mensagem: 'indicador 99 inexistente' },
        ],
      })

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('nao foi possivel ajustar as metas')
      for (const nome of ['Cobertura de clientes', 'Faturamento', 'Inadimplência']) {
        expect(novaMeta(nome)).not.toHaveAttribute('aria-invalid', 'true')
      }
    })

    it('editar o campo com erro da API limpa o erro daquele indicador', async () => {
      const user = usuarioRapido()
      renderizar({ errosIndicadores: [{ idIndicador: 13, mensagem: 'o indicador 13 nao tem meta cadastrada para a filial' }] })

      await user.type(novaMeta('Faturamento'), '1')

      expect(novaMeta('Faturamento')).not.toHaveAttribute('aria-invalid', 'true')
      expect(within(dialogo()).queryByText('o indicador 13 nao tem meta cadastrada para a filial')).not.toBeInTheDocument()
    })
  })
})
