import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  IMAGEM_COMERCIAL_100,
  IMAGEM_COMERCIAL_101_SEM_FAIXA,
  IMAGEM_GERENTES_ANA,
  IMAGEM_GERENTES_DIEGO,
  MOTIVO_SEM_FAIXA_DOMINIO,
  copiarImagemDominio,
  imagemDaPrevia,
} from '../../test/imagensTelaFalsos'
import type { ImagemCongelada } from '../../types/dominio'
import { formatarMoeda, formatarNumero, formatarPercentual } from '../../utils/formato'
import { VisualizacaoImagem } from './VisualizacaoImagem'

const COLUNAS_INDICADORES = ['Indicador', 'Meta', 'Realizado', 'Atingimento', 'Pontos base', 'Pontos realizados']
const COLUNAS_FAIXAS = ['De (R$)', 'Até (R$)', 'Alíquota (%)', 'Status']
const AVISO_IMUTAVEL = 'Alterações posteriores em cadastros, faixas ou apontamentos não afetam esta imagem.'

/**
 * Visualização da imagem congelada (RF-83, RNF-02, RN-01 a RN-04, RN-09, RN-10), componente somente
 * leitura compartilhado entre a prévia (F10.4) e a consulta (F10.6). Recebe a imagem já convertida pelo
 * serviço (`ImagemCongelada`, F10.1) e não consulta a API: quem calcula é o back-end (P-10).
 *
 * Estrutura acessível:
 * - região (`<section aria-label>`) "Imagem {codigo}" ou, sem código (prévia), "Imagem (prévia)";
 * - pares rótulo/valor em `<dt>`/`<dd>`: Código (só com código), Tipo, Filial, Colaborador, Cargo (só
 *   com cargo), Período, Dashboard, Vínculo, Resultado Operacional, PED e Pontuação; valor ausente = "—";
 * - região "Cálculo da pontuação" (só com a pontuação calculada), com Fórmula (só se houver), Faixa
 *   atual, Faixa anterior, Opção A, Opção B, Opção selecionada e Base de cálculo;
 * - tabela "Indicadores" (meta, realizado, atingimento, pontos base e pontos realizados, com a observação
 *   na célula do indicador) e a linha "Total";
 * - tabela "Faixas vigentes — {nome} (v{versao})" (ou "Faixas vigentes (v{versao})" sem nome), com a
 *   faixa atingida marcada por `aria-current="true"` e o status "Faixa atingida";
 * - listas "Pendências" e "Avisos" (só quando houver itens);
 * - parágrafo "Gerada em {dd/mm/aaaa hh:mm} por {usuario}. Alterações posteriores ..." (só na imagem
 *   gravada).
 * Números em pt-BR com 2 casas (RN-10): moeda com `formatarMoeda`, percentuais com `formatarPercentual`
 * e os demais com `formatarNumero` (`src/utils/formato.ts`).
 */
describe('F10.3 — VisualizacaoImagem (imagem congelada — RF-83, RNF-02)', () => {
  function renderizar(imagem: ImagemCongelada) {
    return render(<VisualizacaoImagem imagem={imagem} />)
  }

  const regiao = (nome = 'Imagem IMG-000001') => screen.getByRole('region', { name: nome })

  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`). */
  function valorDetalhe(container: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(container).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  const semDetalhe = (container: HTMLElement, rotulo: string) =>
    expect(within(container).queryByText(rotulo, { selector: 'dt' })).not.toBeInTheDocument()

  const tabelaIndicadores = (container: HTMLElement) => within(container).getByRole('table', { name: 'Indicadores' })

  /** Linhas de dados da tabela (sem o cabeçalho), como listas de textos das células. */
  const linhasDe = (tabela: HTMLElement) =>
    within(tabela)
      .getAllByRole('row')
      .slice(1)
      .map((linha) => within(linha).getAllByRole('cell').map((celula) => celula.textContent?.trim() ?? ''))

  /** Linha do indicador (pelo nome na primeira célula). */
  function linhaDoIndicador(tabela: HTMLElement, nome: string): HTMLElement[] {
    const linha = within(tabela)
      .getAllByRole('row')
      .find((l) => within(l).queryAllByRole('cell')[0]?.textContent?.includes(nome))
    if (!linha) throw new Error(`Linha do indicador "${nome}" não encontrada`)
    return within(linha).getAllByRole('cell')
  }

  const paragrafoCompleto = (texto: string) => (_: string, elemento: Element | null) =>
    elemento?.tagName === 'P' && elemento.textContent?.replace(/\s+/g, ' ').trim() === texto

  describe('região e somente leitura', () => {
    it('imagem gravada: região "Imagem {codigo}"', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      expect(regiao('Imagem IMG-000001')).toBeInTheDocument()
    })

    it('imagem da prévia (sem código): região "Imagem (prévia)" e sem o par "Código"', () => {
      renderizar(imagemDaPrevia(IMAGEM_COMERCIAL_100, 'filial:100'))

      const r = regiao('Imagem (prévia)')
      semDetalhe(r, 'Código')
      expect(within(r).queryByText('IMG-000001')).not.toBeInTheDocument()
    })

    it('é somente leitura: sem campos, caixas de seleção, listas de opções nem botões', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const r = regiao('Imagem IMG-000003')
      expect(within(r).queryAllByRole('textbox')).toHaveLength(0)
      expect(within(r).queryAllByRole('spinbutton')).toHaveLength(0)
      expect(within(r).queryAllByRole('checkbox')).toHaveLength(0)
      expect(within(r).queryAllByRole('combobox')).toHaveLength(0)
      expect(within(r).queryAllByRole('button')).toHaveLength(0)
    })
  })

  describe('imagem de filial (exemplo do negócio — IMG-000001)', () => {
    it('identificação: código, tipo, filial "{código} - {nome}", "Filial (sem colaborador vinculado)", período, dashboard e vínculo; sem cargo', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const r = regiao()
      expect(valorDetalhe(r, 'Código')).toHaveTextContent('IMG-000001')
      expect(valorDetalhe(r, 'Tipo')).toHaveTextContent(/^Filial$/)
      expect(valorDetalhe(r, 'Filial')).toHaveTextContent(/^100 - MATRIZ$/)
      expect(valorDetalhe(r, 'Colaborador')).toHaveTextContent(/^Filial \(sem colaborador vinculado\)$/)
      semDetalhe(r, 'Cargo')
      expect(valorDetalhe(r, 'Período')).toHaveTextContent('3º tri/2026')
      expect(valorDetalhe(r, 'Dashboard')).toHaveTextContent(/^PED Comercial$/)
      expect(valorDetalhe(r, 'Vínculo')).toHaveTextContent(/^Filiais$/)
    })

    it('Resultado Operacional em moeda, PED em percentual e pontuação calculada em 2 casas', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const r = regiao()
      expect(valorDetalhe(r, 'Resultado Operacional').textContent).toContain(formatarMoeda(451590.62))
      expect(valorDetalhe(r, 'PED').textContent).toContain(formatarPercentual(99.99))
      expect(valorDetalhe(r, 'Pontuação').textContent).toContain(formatarNumero(8839.12))
      expect(valorDetalhe(r, 'Pontuação')).not.toHaveTextContent('Não calculada')
    })

    it('cálculo da pontuação: fórmula do cadastro, faixas atual e anterior, opções A e B, a selecionada e a base', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const calculo = within(regiao()).getByRole('region', { name: 'Cálculo da pontuação' })
      expect(valorDetalhe(calculo, 'Fórmula')).toHaveTextContent('Base de cálculo × PED (%) ÷ 100')

      const atual = valorDetalhe(calculo, 'Faixa atual').textContent ?? ''
      expect(atual).toContain(formatarMoeda(400000))
      expect(atual).toContain(formatarMoeda(600000))
      expect(atual).toContain(formatarPercentual(1.95))

      const anterior = valorDetalhe(calculo, 'Faixa anterior').textContent ?? ''
      expect(anterior).toContain(formatarMoeda(0))
      expect(anterior).toContain(formatarMoeda(399999.99))
      expect(anterior).toContain(formatarPercentual(2.21))

      expect(valorDetalhe(calculo, 'Opção A').textContent).toContain(formatarMoeda(8840))
      expect(valorDetalhe(calculo, 'Opção B').textContent).toContain(formatarMoeda(8806.02))
      expect(valorDetalhe(calculo, 'Opção selecionada')).toHaveTextContent(/^Opção A$/)
      expect(valorDetalhe(calculo, 'Base de cálculo').textContent).toContain(formatarMoeda(8840))
    })

    it('tabela por indicador com as colunas na ordem, valores em 2 casas, observação na célula do indicador e linha Total', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const tabela = tabelaIndicadores(regiao())
      expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(COLUNAS_INDICADORES)

      const faturamento = linhaDoIndicador(tabela, 'Faturamento')
      expect(faturamento[0]).toHaveTextContent('Faturamento')
      expect(faturamento[0]).toHaveTextContent('Pontos limitados aos pontos base')
      expect(faturamento.slice(1).map((c) => c.textContent?.trim())).toEqual([
        formatarNumero(400000),
        formatarNumero(451590.62),
        formatarPercentual(112.9),
        formatarNumero(60),
        formatarNumero(60),
      ])

      const cobertura = linhaDoIndicador(tabela, 'Cobertura de clientes')
      expect(cobertura[0].textContent?.trim()).toBe('Cobertura de clientes')
      expect(cobertura.slice(1).map((c) => c.textContent?.trim())).toEqual([
        formatarNumero(80),
        formatarNumero(79.98),
        formatarPercentual(99.98),
        formatarNumero(40),
        formatarNumero(39.99),
      ])

      const linhas = linhasDe(tabela)
      expect(linhas).toHaveLength(3)
      expect(linhas[2]).toEqual(['Total', '', '', '', formatarNumero(100), formatarNumero(99.99)])
    })

    it('faixas vigentes com nome e versão, colunas na ordem e a faixa atingida destacada', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const tabela = within(regiao()).getByRole('table', { name: 'Faixas vigentes — Resultado operacional (v2)' })
      expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual(COLUNAS_FAIXAS)
      expect(linhasDe(tabela)).toEqual([
        [formatarNumero(0), formatarNumero(399999.99), formatarNumero(2.21), ''],
        [formatarNumero(400000), formatarNumero(600000), formatarNumero(1.95), 'Faixa atingida'],
        [formatarNumero(600000.01), formatarNumero(1000000), formatarNumero(1.5), ''],
      ])

      const linhas = within(tabela).getAllByRole('row').slice(1)
      expect(linhas[1]).toHaveAttribute('aria-current', 'true')
      expect(linhas[0]).not.toHaveAttribute('aria-current', 'true')
      expect(linhas[2]).not.toHaveAttribute('aria-current', 'true')
    })

    it('data e usuário da geração, com o aviso de que alterações posteriores não afetam a imagem (RNF-02)', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      expect(
        within(regiao()).getByText(paragrafoCompleto(`Gerada em 30/09/2026 18:00 por Ana Costa. ${AVISO_IMUTAVEL}`)),
      ).toBeInTheDocument()
    })

    it('sem pendências nem avisos: as listas não aparecem', () => {
      renderizar(IMAGEM_COMERCIAL_100)

      const r = regiao()
      expect(within(r).queryByRole('list', { name: 'Pendências' })).not.toBeInTheDocument()
      expect(within(r).queryByRole('list', { name: 'Avisos' })).not.toBeInTheDocument()
    })
  })

  describe('imagem de filial sem tabela de faixas, sem meta e com lançamento pendente (IMG-000002)', () => {
    it('pontuação não calculada mostra "Não calculada" e o motivo; sem cálculo nem tabela de faixas', () => {
      renderizar(IMAGEM_COMERCIAL_101_SEM_FAIXA)

      const r = regiao('Imagem IMG-000002')
      const pontuacao = valorDetalhe(r, 'Pontuação')
      expect(pontuacao).toHaveTextContent('Não calculada')
      expect(pontuacao).toHaveTextContent(MOTIVO_SEM_FAIXA_DOMINIO)
      expect(within(r).queryByRole('region', { name: 'Cálculo da pontuação' })).not.toBeInTheDocument()
      expect(within(r).queryByRole('table', { name: /^Faixas vigentes/ })).not.toBeInTheDocument()
      expect(valorDetalhe(r, 'PED').textContent).toContain(formatarPercentual(0))
    })

    it('meta null aparece como "Sem meta" (nunca 0%); atingimento e pontos realizados ausentes como "—"', () => {
      renderizar(IMAGEM_COMERCIAL_101_SEM_FAIXA)

      const faturamento = linhaDoIndicador(tabelaIndicadores(regiao('Imagem IMG-000002')), 'Faturamento')
      expect(faturamento.slice(1).map((c) => c.textContent?.trim())).toEqual([
        'Sem meta',
        formatarNumero(320000),
        '—',
        formatarNumero(60),
        '—',
      ])
      expect(faturamento[2]).not.toHaveTextContent('0,00%')
      expect(faturamento[3]).not.toHaveTextContent('0,00%')
    })

    it('realizado null com coleta disponível é "Lançamento pendente" (RN-09), não zero', () => {
      renderizar(IMAGEM_COMERCIAL_101_SEM_FAIXA)

      const cobertura = linhaDoIndicador(tabelaIndicadores(regiao('Imagem IMG-000002')), 'Cobertura de clientes')
      expect(cobertura.slice(1).map((c) => c.textContent?.trim())).toEqual([
        formatarNumero(80),
        'Lançamento pendente',
        '—',
        formatarNumero(40),
        '—',
      ])
      expect(cobertura[0]).toHaveTextContent('Lançamento pendente: entrou sem valor')
    })

    it('total com os pontos base e o PED da imagem', () => {
      renderizar(IMAGEM_COMERCIAL_101_SEM_FAIXA)

      const linhas = linhasDe(tabelaIndicadores(regiao('Imagem IMG-000002')))
      expect(linhas.at(-1)).toEqual(['Total', '', '', '', formatarNumero(100), formatarNumero(0)])
    })

    it('mostra as pendências e os avisos da imagem em listas', () => {
      renderizar(IMAGEM_COMERCIAL_101_SEM_FAIXA)

      const r = regiao('Imagem IMG-000002')
      const pendencias = within(r).getByRole('list', { name: 'Pendências' })
      expect(within(pendencias).getAllByRole('listitem').map((i) => i.textContent?.trim())).toEqual([
        'Visitas a clientes (3º tri/2026): sem lançamento',
      ])
      const avisos = within(r).getByRole('list', { name: 'Avisos' })
      expect(within(avisos).getAllByRole('listitem').map((i) => i.textContent?.trim())).toEqual([
        'Filial 101 sem tabela de faixas: sem pontuação',
      ])
    })
  })

  describe('imagem de colaborador (IMG-000003 — Ana Souza)', () => {
    it('identificação: tipo Colaborador, colaborador e cargo, filial, período, dashboard e vínculo', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const r = regiao('Imagem IMG-000003')
      expect(valorDetalhe(r, 'Código')).toHaveTextContent('IMG-000003')
      expect(valorDetalhe(r, 'Tipo')).toHaveTextContent(/^Colaborador$/)
      expect(valorDetalhe(r, 'Colaborador')).toHaveTextContent(/^Ana Souza$/)
      expect(valorDetalhe(r, 'Cargo')).toHaveTextContent(/^Gerente de Loja$/)
      expect(valorDetalhe(r, 'Filial')).toHaveTextContent(/^100 - MATRIZ$/)
      expect(valorDetalhe(r, 'Período')).toHaveTextContent('10/2026')
      expect(valorDetalhe(r, 'Dashboard')).toHaveTextContent(/^PED Gerentes$/)
      expect(valorDetalhe(r, 'Vínculo')).toHaveTextContent(/^Cargos$/)
    })

    it('PED e pontuação; cálculo sem faixa anterior, com a opção B selecionada e sem fórmula no cadastro', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const r = regiao('Imagem IMG-000003')
      expect(valorDetalhe(r, 'Resultado Operacional').textContent).toContain(formatarMoeda(150000))
      expect(valorDetalhe(r, 'PED').textContent).toContain(formatarPercentual(20))
      expect(valorDetalhe(r, 'Pontuação').textContent).toContain(formatarNumero(150))

      const calculo = within(r).getByRole('region', { name: 'Cálculo da pontuação' })
      semDetalhe(calculo, 'Fórmula')
      expect(valorDetalhe(calculo, 'Faixa anterior')).toHaveTextContent('Nenhuma')
      expect(valorDetalhe(calculo, 'Opção A').textContent).toContain(formatarMoeda(0))
      expect(valorDetalhe(calculo, 'Opção B').textContent).toContain(formatarMoeda(750))
      expect(valorDetalhe(calculo, 'Opção selecionada')).toHaveTextContent(/^Opção B$/)
      expect(valorDetalhe(calculo, 'Base de cálculo').textContent).toContain(formatarMoeda(750))
    })

    it('dado externo sem coleta (coletaDisponivel false) aparece como "Sem coleta ainda", não como pendente nem zero', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const tabela = tabelaIndicadores(regiao('Imagem IMG-000003'))
      const vendas = linhaDoIndicador(tabela, 'Vendas por colaborador')
      expect(vendas.slice(1).map((c) => c.textContent?.trim())).toEqual([
        formatarNumero(50000),
        'Sem coleta ainda',
        '—',
        formatarNumero(30),
        '—',
      ])
      expect(vendas[2]).not.toHaveTextContent('Lançamento pendente')

      const frete = linhaDoIndicador(tabela, 'Custo de frete por entrega')
      expect(frete[0]).toHaveTextContent('Menor é melhor')
      expect(frete.slice(1).map((c) => c.textContent?.trim())).toEqual([
        formatarNumero(12),
        formatarNumero(10),
        formatarPercentual(120),
        formatarNumero(20),
        formatarNumero(20),
      ])
      expect(linhasDe(tabela).at(-1)).toEqual(['Total', '', '', '', formatarNumero(50), formatarNumero(20)])
    })

    it('faixas sem nome: tabela "Faixas vigentes (v1)" com a única faixa atingida', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const tabela = within(regiao('Imagem IMG-000003')).getByRole('table', { name: 'Faixas vigentes (v1)' })
      expect(linhasDe(tabela)).toEqual([[formatarNumero(0), formatarNumero(3000), formatarNumero(0.5), 'Faixa atingida']])
      expect(within(tabela).getAllByRole('row')[1]).toHaveAttribute('aria-current', 'true')
    })

    it('aviso da imagem e data/usuário da geração', () => {
      renderizar(IMAGEM_GERENTES_ANA)

      const r = regiao('Imagem IMG-000003')
      const avisos = within(r).getByRole('list', { name: 'Avisos' })
      expect(within(avisos).getAllByRole('listitem').map((i) => i.textContent?.trim())).toEqual([
        'Vendas por colaborador: sem coleta ainda',
      ])
      expect(within(r).queryByRole('list', { name: 'Pendências' })).not.toBeInTheDocument()
      expect(within(r).getByText(paragrafoCompleto(`Gerada em 01/11/2026 09:00 por admin. ${AVISO_IMUTAVEL}`))).toBeInTheDocument()
    })
  })

  describe('imagem de colaborador sem tabela de faixas (IMG-000004 — Diego Rocha)', () => {
    it('colaborador e cargo, filial 102, pontuação não calculada com o motivo e sem faixas', () => {
      renderizar(IMAGEM_GERENTES_DIEGO)

      const r = regiao('Imagem IMG-000004')
      expect(valorDetalhe(r, 'Colaborador')).toHaveTextContent(/^Diego Rocha$/)
      expect(valorDetalhe(r, 'Cargo')).toHaveTextContent(/^Gerente de Loja$/)
      expect(valorDetalhe(r, 'Filial')).toHaveTextContent(/^102 - DOURADOS$/)
      expect(valorDetalhe(r, 'PED').textContent).toContain(formatarPercentual(16))
      expect(valorDetalhe(r, 'Pontuação')).toHaveTextContent('Não calculada')
      expect(valorDetalhe(r, 'Pontuação')).toHaveTextContent(MOTIVO_SEM_FAIXA_DOMINIO)
      expect(within(r).queryByRole('region', { name: 'Cálculo da pontuação' })).not.toBeInTheDocument()
      expect(within(r).queryByRole('table', { name: /^Faixas vigentes/ })).not.toBeInTheDocument()
    })
  })

  describe('prévia (imagem ainda não gravada)', () => {
    it('mostra o mesmo conteúdo, sem código nem a data e o usuário da geração', () => {
      renderizar(imagemDaPrevia(IMAGEM_GERENTES_ANA, 'colaborador:11'))

      const r = regiao('Imagem (prévia)')
      expect(valorDetalhe(r, 'Colaborador')).toHaveTextContent(/^Ana Souza$/)
      expect(valorDetalhe(r, 'Pontuação').textContent).toContain(formatarNumero(150))
      expect(tabelaIndicadores(r)).toBeInTheDocument()
      expect(within(r).getByRole('table', { name: 'Faixas vigentes (v1)' })).toBeInTheDocument()
      expect(within(r).queryByText(/Gerada em/)).not.toBeInTheDocument()
    })
  })

  describe('casos-limite', () => {
    it('pontuação não calculada sem motivo: só "Não calculada"', () => {
      const imagem = copiarImagemDominio(IMAGEM_GERENTES_DIEGO)
      imagem.pontuacao = { ...imagem.pontuacao, motivo: null }
      renderizar(imagem)

      expect(valorDetalhe(regiao('Imagem IMG-000004'), 'Pontuação')).toHaveTextContent(/^Não calculada$/)
    })

    it('faixas presentes e pontuação não calculada (ex.: resultado abaixo da primeira faixa): nenhuma faixa destacada', () => {
      const imagem = copiarImagemDominio(IMAGEM_COMERCIAL_100)
      imagem.pontuacao = {
        calculada: false,
        motivo: 'resultado abaixo da primeira faixa',
        faixaAtual: null,
        faixaAnterior: null,
        aliquotaAnterior: null,
        aliquotaAtual: null,
        pisoDaFaixa: null,
        opcaoA: null,
        opcaoB: null,
        opcaoSelecionada: null,
        baseDeCalculo: null,
        valor: null,
      }
      renderizar(imagem)

      const r = regiao()
      expect(valorDetalhe(r, 'Pontuação')).toHaveTextContent('resultado abaixo da primeira faixa')
      const tabela = within(r).getByRole('table', { name: 'Faixas vigentes — Resultado operacional (v2)' })
      expect(within(tabela).queryByText('Faixa atingida')).not.toBeInTheDocument()
      for (const linha of within(tabela).getAllByRole('row').slice(1)) {
        expect(linha).not.toHaveAttribute('aria-current', 'true')
      }
    })

    it('campos ausentes aparecem como "—": dashboard, período, resultado operacional, PED e nome da filial', () => {
      const imagem = copiarImagemDominio(IMAGEM_COMERCIAL_101_SEM_FAIXA)
      imagem.dashboard = null
      imagem.periodo = null
      imagem.resultadoOperacional = null
      imagem.pedPercentual = null
      imagem.pontosBaseTotal = null
      imagem.unidade = { ...imagem.unidade, nomeFilial: null }
      renderizar(imagem)

      const r = regiao('Imagem IMG-000002')
      expect(valorDetalhe(r, 'Filial')).toHaveTextContent(/^101$/)
      expect(valorDetalhe(r, 'Dashboard')).toHaveTextContent(/^—$/)
      expect(valorDetalhe(r, 'Vínculo')).toHaveTextContent(/^—$/)
      expect(valorDetalhe(r, 'Período')).toHaveTextContent(/^—$/)
      expect(valorDetalhe(r, 'Resultado Operacional')).toHaveTextContent(/^—$/)
      expect(valorDetalhe(r, 'PED')).toHaveTextContent(/^—$/)
      expect(linhasDe(tabelaIndicadores(r)).at(-1)).toEqual(['Total', '', '', '', '—', '—'])
    })

    it('meta zero continua 0,00 (só null é "Sem meta")', () => {
      const imagem = copiarImagemDominio(IMAGEM_GERENTES_ANA)
      imagem.indicadores[0] = { ...imagem.indicadores[0], meta: 0 }
      renderizar(imagem)

      const frete = linhaDoIndicador(tabelaIndicadores(regiao('Imagem IMG-000003')), 'Custo de frete por entrega')
      expect(frete[1].textContent?.trim()).toBe(formatarNumero(0))
    })

    it('valores com mais casas são exibidos com 2 casas decimais (RN-10)', () => {
      const imagem = copiarImagemDominio(IMAGEM_COMERCIAL_100)
      imagem.indicadores[1] = { ...imagem.indicadores[1], realizado: 79.98456, atingimento: 99.98071 }
      renderizar(imagem)

      const cobertura = linhaDoIndicador(tabelaIndicadores(regiao()), 'Cobertura de clientes')
      expect(cobertura[2].textContent?.trim()).toBe('79,98')
      expect(cobertura[3].textContent?.trim()).toBe('99,98%')
    })
  })
})
