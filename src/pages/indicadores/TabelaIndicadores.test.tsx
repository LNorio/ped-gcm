import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_CAPACITACAO_API,
  INDICADOR_COBERTURA_CARTEIRA_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_FATURAMENTO_API,
  INDICADOR_ROTINAS_API,
  NOMES_INDICADORES,
  indicadoresApi,
} from '../../test/indicadoresFalsos'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores, type TabelaIndicadoresProps } from './TabelaIndicadores'

const INDICADORES: Indicador[] = indicadoresApi().map(paraIndicador)
const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)
const ROTINAS = paraIndicador(INDICADOR_ROTINAS_API)
const FATURAMENTO = paraIndicador(INDICADOR_FATURAMENTO_API)
const DEVOLUCOES = paraIndicador(INDICADOR_DEVOLUCOES_API)
const CAPACITACAO = paraIndicador(INDICADOR_CAPACITACAO_API)
const COBERTURA_CARTEIRA = paraIndicador(INDICADOR_COBERTURA_CARTEIRA_API)

/** Colunas do RF-32, sem enxugar (decisão do usuário). */
const COLUNAS = ['Nome', 'Composição', 'Sentido e cálculo', 'Meta', 'Dashboards', 'Ações']
const COL = { nome: 0, composicao: 1, sentido: 2, meta: 3, dashboards: 4, acoes: 5 }

describe('F6.2 — TabelaIndicadores (listagem de indicadores — RF-32)', () => {
  function renderizar(props: Partial<TabelaIndicadoresProps> = {}) {
    const onDefinirMeta = props.onDefinirMeta ?? vi.fn<(indicador: Indicador) => void>()
    const onVerHistorico = props.onVerHistorico ?? vi.fn<(indicador: Indicador) => void>()
    const onAlterarSituacao = props.onAlterarSituacao ?? vi.fn<(indicador: Indicador) => void>()
    const onExcluir = props.onExcluir ?? vi.fn<(indicador: Indicador) => void>()
    render(
      <TabelaIndicadores
        indicadores={props.indicadores ?? INDICADORES}
        podeDefinirMeta={props.podeDefinirMeta ?? true}
        podeVerHistorico={props.podeVerHistorico ?? true}
        podeAlterarSituacao={props.podeAlterarSituacao ?? true}
        podeExcluir={props.podeExcluir ?? true}
        onDefinirMeta={onDefinirMeta}
        onVerHistorico={onVerHistorico}
        onAlterarSituacao={onAlterarSituacao}
        onExcluir={onExcluir}
        textoVazio={props.textoVazio}
      />,
    )
    return { onDefinirMeta, onVerHistorico, onAlterarSituacao, onExcluir }
  }

  const tabela = () => screen.getByRole('table', { name: 'Indicadores' })

  function linhasDeDados() {
    return within(tabela())
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
  }

  function linha(nome: string): HTMLElement {
    const encontrada = linhasDeDados().find((l) => within(within(l).getAllByRole('cell')[COL.nome]).queryByText(nome) !== null)
    if (!encontrada) throw new Error(`Linha "${nome}" não encontrada`)
    return encontrada
  }

  const celula = (nome: string, coluna: number) => within(linha(nome)).getAllByRole('cell')[coluna]

  /** Textos das etiquetas (`.etiqueta`) de uma célula, na ordem exibida. */
  const etiquetas = (elemento: HTMLElement) => [...elemento.querySelectorAll('.etiqueta')].map((e) => e.textContent?.trim())

  function detalhesDe(nome: string): HTMLElement | null {
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    return proxima && proxima.classList.contains('tabela__detalhes') ? proxima : null
  }

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesIndicador(nome), 'Ver detalhes')
    const detalhes = detalhesDe(nome)
    if (!detalhes) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return detalhes
  }

  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  describe('estrutura', () => {
    it('tabela com legenda "Indicadores" e as colunas Nome, Composição, Sentido e cálculo, Meta, Dashboards e Ações, nesta ordem', () => {
      renderizar()

      expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
      expect(within(linha('Cobertura de visitas')).getAllByRole('cell')).toHaveLength(COLUNAS.length)
    })

    it('lista os indicadores na ordem recebida, com os detalhes recolhidos', () => {
      renderizar()

      expect(linhasDeDados()).toHaveLength(NOMES_INDICADORES.length)
      for (const [indice, nome] of NOMES_INDICADORES.entries()) {
        expect(within(within(linhasDeDados()[indice]).getAllByRole('cell')[COL.nome]).getByText(nome)).toBeInTheDocument()
        expect(detalhesDe(nome)).toBeNull()
      }
    })

    it('não há botão de expandir da tabela (a expansão fica no menu de ações)', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) detalhes$/ })).not.toBeInTheDocument()
    })

    it('lista vazia exibe o textoVazio e nenhum botão', () => {
      renderizar({ indicadores: [], textoVazio: 'Nenhum indicador cadastrado.' })

      expect(within(tabela()).getByText('Nenhum indicador cadastrado.')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('não há ação de editar em nenhuma linha (RF-37)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
      for (const nome of NOMES_INDICADORES) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))
        expect(itens.some((item) => /editar/i.test(item))).toBe(false)
      }
    })
  })

  describe('coluna Nome e etiquetas', () => {
    it('indicador sem marcações não tem etiqueta', () => {
      renderizar({ indicadores: [{ ...COBERTURA_VISITAS, vinculadoADashboard: false, dashboards: [] }] })

      expect(etiquetas(celula('Cobertura de visitas', COL.nome))).toEqual([])
    })

    it('criado automaticamente sem meta: "Criado automaticamente" (info) e "Meta a definir" (alerta), nesta ordem', () => {
      renderizar()

      const nome = celula('Devoluções de venda', COL.nome)
      expect(etiquetas(nome)).toEqual(['Criado automaticamente', 'Meta a definir'])
      expect(within(nome).getByText('Criado automaticamente')).toHaveClass('etiqueta', 'etiqueta--info')
      expect(within(nome).getByText('Meta a definir')).toHaveClass('etiqueta', 'etiqueta--alerta')
    })

    it('componente desativado: "Componentes desativados" (perigo)', () => {
      renderizar()

      for (const nome of ['Rotinas financeiras em dia', 'Custo de frete por entrega', 'Cobertura da carteira']) {
        expect(within(celula(nome, COL.nome)).getByText('Componentes desativados')).toHaveClass('etiqueta', 'etiqueta--perigo')
      }
      expect(within(celula('Cobertura de visitas', COL.nome)).queryByText('Componentes desativados')).not.toBeInTheDocument()
    })

    it('inativo: "Inativo" (neutro); ativos não têm essa etiqueta', () => {
      renderizar()

      expect(within(celula('Capacitação', COL.nome)).getByText('Inativo')).toHaveClass('etiqueta', 'etiqueta--neutro')
      for (const nome of NOMES_INDICADORES.filter((n) => n !== 'Capacitação')) {
        expect(within(celula(nome, COL.nome)).queryByText('Inativo')).not.toBeInTheDocument()
      }
    })

    it('meta editável no preenchimento: "Meta editável" (dourado)', () => {
      renderizar()

      expect(within(celula('Rotinas financeiras em dia', COL.nome)).getByText('Meta editável')).toHaveClass('etiqueta', 'etiqueta--dourado')
      expect(within(celula('Faturamento líquido mensal', COL.nome)).getByText('Meta editável')).toBeInTheDocument()
      expect(within(celula('Cobertura de visitas', COL.nome)).queryByText('Meta editável')).not.toBeInTheDocument()
    })

    it('vinculado a dashboard: "Vinculado a dashboard" (sucesso)', () => {
      renderizar()

      for (const nome of ['Cobertura de visitas', 'Faturamento líquido mensal', 'Custo de frete por entrega']) {
        expect(within(celula(nome, COL.nome)).getByText('Vinculado a dashboard')).toHaveClass('etiqueta', 'etiqueta--sucesso')
      }
      expect(within(celula('Rotinas financeiras em dia', COL.nome)).queryByText('Vinculado a dashboard')).not.toBeInTheDocument()
    })

    it('as etiquetas seguem a ordem do RF-32: automático, meta a definir, componentes desativados, inativo, meta editável, vinculado', () => {
      renderizar({
        indicadores: [
          {
            ...FATURAMENTO,
            id: 90,
            nome: 'Completo',
            ativo: false,
            criadoAutomaticamente: true,
            metaADefinir: true,
            componentesDesativados: true,
          },
        ],
      })

      expect(etiquetas(celula('Completo', COL.nome))).toEqual([
        'Criado automaticamente',
        'Meta a definir',
        'Componentes desativados',
        'Inativo',
        'Meta editável',
        'Vinculado a dashboard',
      ])
    })
  })

  describe('coluna Composição', () => {
    it('apontamentos aparecem em azul (etiqueta info), um por item, na ordem da composição', () => {
      renderizar()

      const composicao = celula('Cobertura de visitas', COL.composicao)
      expect(etiquetas(composicao)).toEqual(['Roteiro de visitas elaborado', 'Positivação de clientes'])
      expect(within(composicao).getByText('Roteiro de visitas elaborado')).toHaveClass('etiqueta', 'etiqueta--info')
    })

    it('dado externo aparece em dourado (etiqueta dourado)', () => {
      renderizar()

      const composicao = celula('Faturamento líquido mensal', COL.composicao)
      expect(etiquetas(composicao)).toEqual(['Faturamento líquido'])
      expect(within(composicao).getByText('Faturamento líquido')).toHaveClass('etiqueta', 'etiqueta--dourado')
    })

    it('componente desativado é marcado com "(desativado)" e a classe tabela-indicadores__componente--desativado', () => {
      renderizar()

      const rotinas = celula('Rotinas financeiras em dia', COL.composicao)
      expect(within(rotinas).getByText('Conciliação bancária concluída (desativado)')).toHaveClass(
        'tabela-indicadores__componente--desativado',
      )
      expect(within(rotinas).getByText('Fechamento contábil entregue')).not.toHaveClass('tabela-indicadores__componente--desativado')

      const carteira = celula('Cobertura da carteira', COL.composicao)
      expect(within(carteira).getByText('Cobertura de clientes (desativado)')).toHaveClass(
        'etiqueta--dourado',
        'tabela-indicadores__componente--desativado',
      )

      const frete = celula('Custo de frete por entrega', COL.composicao)
      expect(etiquetas(frete)).toEqual(['Frete pago (desativado)', 'Entregas realizadas (desativado)'])
    })
  })

  describe('coluna Sentido e cálculo', () => {
    it('mostra "Maior é melhor" ou "Menor é melhor (custo)"', () => {
      renderizar()

      expect(within(celula('Cobertura de visitas', COL.sentido)).getByText('Maior é melhor')).toBeInTheDocument()
      expect(within(celula('Custo de frete por entrega', COL.sentido)).getByText('Menor é melhor (custo)')).toBeInTheDocument()
    })

    it('com mais de um apontamento mostra também o cálculo (Média ou Soma)', () => {
      renderizar()

      expect(within(celula('Cobertura de visitas', COL.sentido)).getByText('Média')).toBeInTheDocument()
      expect(within(celula('Rotinas financeiras em dia', COL.sentido)).getByText('Soma')).toBeInTheDocument()
      expect(within(celula('Custo de frete por entrega', COL.sentido)).getByText('Média')).toBeInTheDocument()
    })

    it('com um único apontamento ou com dado externo não mostra o cálculo', () => {
      renderizar()

      expect(celula('Capacitação', COL.sentido)).toHaveTextContent('Maior é melhor')
      expect(within(celula('Capacitação', COL.sentido)).queryByText(/^(Soma|Média)$/)).not.toBeInTheDocument()
      expect(within(celula('Faturamento líquido mensal', COL.sentido)).queryByText(/^(Soma|Média)$/)).not.toBeInTheDocument()
    })

    it('indicador automático sem sentido mostra "—"', () => {
      renderizar()

      expect(celula('Devoluções de venda', COL.sentido)).toHaveTextContent(/^—$/)
    })
  })

  describe('coluna Meta', () => {
    it('mostra a meta em pt-BR com 2 casas (vírgula decimal e ponto de milhar)', () => {
      renderizar()

      expect(celula('Cobertura de visitas', COL.meta)).toHaveTextContent('85,00')
      expect(celula('Faturamento líquido mensal', COL.meta)).toHaveTextContent('1.500.000,50')
      expect(celula('Custo de frete por entrega', COL.meta)).toHaveTextContent('12,50')
    })

    it('meta a definir mostra "—"', () => {
      renderizar()

      expect(celula('Devoluções de venda', COL.meta)).toHaveTextContent(/^—$/)
    })
  })

  describe('coluna Dashboards', () => {
    it('lista cada dashboard com os pontos base: "{nome} ({pontos} pontos base)"', () => {
      renderizar()

      expect(within(celula('Cobertura de visitas', COL.dashboards)).getByText('PED Comercial (40 pontos base)')).toBeInTheDocument()
      const faturamento = celula('Faturamento líquido mensal', COL.dashboards)
      expect(within(faturamento).getByText('PED Comercial (60 pontos base)')).toBeInTheDocument()
      expect(within(faturamento).getByText('PED Gerentes (30 pontos base)')).toBeInTheDocument()
      expect(within(celula('Custo de frete por entrega', COL.dashboards)).getByText('PED Gerentes (20 pontos base)')).toBeInTheDocument()
    })

    it('sem dashboards mostra "—"', () => {
      renderizar()

      for (const nome of ['Rotinas financeiras em dia', 'Devoluções de venda', 'Capacitação', 'Cobertura da carteira']) {
        expect(celula(nome, COL.dashboards)).toHaveTextContent(/^—$/)
      }
    })

    it('a coluna Ações tem o menu "Ações do indicador {nome}" em todas as linhas', () => {
      renderizar()

      for (const nome of NOMES_INDICADORES) {
        const gatilho = within(celula(nome, COL.acoes)).getByRole('button', { name: rotuloAcoesIndicador(nome) })
        expect(gatilho).toHaveAttribute('aria-haspopup', 'menu')
      }
    })
  })

  describe('detalhes da linha ("Ver detalhes" no menu de ações)', () => {
    it('"Ver detalhes" abre os detalhes só daquela linha; o item vira "Ocultar detalhes" e recolhe ao ser escolhido de novo', async () => {
      const user = usuarioRapido()
      renderizar()

      await verDetalhes(user, 'Cobertura de visitas')
      for (const nome of NOMES_INDICADORES.filter((n) => n !== 'Cobertura de visitas')) expect(detalhesDe(nome)).toBeNull()

      const menu = await abrirMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))
      expect(within(menu).queryByRole('menuitem', { name: 'Ver detalhes' })).not.toBeInTheDocument()
      await user.click(within(menu).getByRole('menuitem', { name: 'Ocultar detalhes' }))

      expect(detalhesDe('Cobertura de visitas')).toBeNull()
      expect((await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas')))[0]).toBe('Ver detalhes')
    })

    it('duas linhas podem ficar abertas; recolher uma não afeta a outra', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Cobertura de visitas')
      await verDetalhes(user, 'Capacitação')

      await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Ocultar detalhes')

      expect(detalhesDe('Cobertura de visitas')).toBeNull()
      expect(detalhesDe('Capacitação')).not.toBeNull()
    })

    it('mostra Descrição, Tipos e Cadastro como pares rótulo e valor', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Cobertura de visitas')

      expect(valorDetalhe(detalhes, 'Descrição')).toHaveTextContent('Percentual de vendedores com roteiro e positivação em dia.')
      expect(valorDetalhe(detalhes, 'Tipos')).toHaveTextContent('Comercial')
      expect(valorDetalhe(detalhes, 'Cadastro')).toHaveTextContent('02/10/2026 09:30 por Maria Souza')
    })

    it('Descrição vazia mostra "—"; vários tipos são separados por vírgula', async () => {
      const user = usuarioRapido()
      renderizar({ indicadores: [ROTINAS, { ...COBERTURA_VISITAS, id: 91, nome: 'Dois tipos', tipos: ['Comercial', 'Financeiro'] }] })

      expect(valorDetalhe(await verDetalhes(user, 'Rotinas financeiras em dia'), 'Descrição')).toHaveTextContent(/^—$/)
      expect(valorDetalhe(await verDetalhes(user, 'Dois tipos'), 'Tipos')).toHaveTextContent('Comercial, Financeiro')
    })

    it('indicador com situação alterada mostra "Situação alterada em {data hora} por {nome}" (RNF-01)', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Capacitação')

      expect(within(detalhes).getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()
    })

    it('sem situação alterada e sem problema, os detalhes não mostram esse texto nem aviso', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Cobertura de visitas')

      expect(within(detalhes).queryByText(/^Situação alterada em/)).not.toBeInTheDocument()
      expect(within(detalhes).queryByRole('note')).not.toBeInTheDocument()
    })

    it('"Ver detalhes" não chama nenhum callback', async () => {
      const user = usuarioRapido()
      const { onDefinirMeta, onVerHistorico, onAlterarSituacao, onExcluir } = renderizar()

      await verDetalhes(user, 'Devoluções de venda')

      expect(onDefinirMeta).not.toHaveBeenCalled()
      expect(onVerHistorico).not.toHaveBeenCalled()
      expect(onAlterarSituacao).not.toHaveBeenCalled()
      expect(onExcluir).not.toHaveBeenCalled()
    })
  })

  describe('menu de ações por linha (todas as permissões)', () => {
    it('vinculado a dashboard, sem meta editável: Ver detalhes e Inativar (sem Excluir — RN-11)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))).toEqual(['Ver detalhes', 'Inativar'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Custo de frete por entrega'))).toEqual(['Ver detalhes', 'Inativar'])
    })

    it('meta editável e sem dashboard: Ver detalhes, Histórico de metas, Inativar e Excluir, nesta ordem', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))).toEqual([
        'Ver detalhes',
        'Histórico de metas',
        'Inativar',
        'Excluir',
      ])
    })

    it('meta editável e vinculado: Ver detalhes, Histórico de metas e Inativar', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Faturamento líquido mensal'))).toEqual([
        'Ver detalhes',
        'Histórico de metas',
        'Inativar',
      ])
    })

    it('automático sem meta: Ver detalhes, Definir meta, Inativar e Excluir', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Definir meta',
        'Inativar',
        'Excluir',
      ])
    })

    it('automático que já teve a meta definida não oferece mais "Definir meta" (só uma vez — RF-36)', async () => {
      const user = usuarioRapido()
      renderizar({ indicadores: [{ ...DEVOLUCOES, sentido: 'maior_melhor', meta: 2500, metaADefinir: false, origemDaMeta: 'manual' }] })

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual(['Ver detalhes', 'Inativar', 'Excluir'])
    })

    it('inativo: Ver detalhes, Reativar e Excluir', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Reativar', 'Excluir'])
    })

    it('"Excluir" é o item de perigo; os demais não', async () => {
      const user = usuarioRapido()
      renderizar()

      const menu = await abrirMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))

      expect(within(menu).getByRole('menuitem', { name: 'Excluir' })).toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Inativar' })).not.toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Histórico de metas' })).not.toHaveClass('menu-acoes__item--perigo')
    })

    it('"Definir meta" chama onDefinirMeta com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onDefinirMeta, onAlterarSituacao, onExcluir, onVerHistorico } = renderizar()

      await escolherAcao(user, rotuloAcoesIndicador('Devoluções de venda'), 'Definir meta')

      expect(onDefinirMeta).toHaveBeenCalledTimes(1)
      expect(onDefinirMeta).toHaveBeenCalledWith(DEVOLUCOES)
      expect(onVerHistorico).not.toHaveBeenCalled()
      expect(onAlterarSituacao).not.toHaveBeenCalled()
      expect(onExcluir).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('"Histórico de metas" chama onVerHistorico com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onVerHistorico } = renderizar()

      await escolherAcao(user, rotuloAcoesIndicador('Faturamento líquido mensal'), 'Histórico de metas')

      expect(onVerHistorico).toHaveBeenCalledTimes(1)
      expect(onVerHistorico).toHaveBeenCalledWith(FATURAMENTO)
    })

    it('Inativar/Reativar chama onAlterarSituacao com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao } = renderizar()

      await escolherAcao(user, rotuloAcoesIndicador('Capacitação'), 'Reativar')
      expect(onAlterarSituacao).toHaveBeenLastCalledWith(CAPACITACAO)

      await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Inativar')
      expect(onAlterarSituacao).toHaveBeenCalledTimes(2)
      expect(onAlterarSituacao).toHaveBeenLastCalledWith(COBERTURA_VISITAS)
    })

    it('"Excluir" chama onExcluir com o indicador da linha', async () => {
      const user = usuarioRapido()
      const { onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesIndicador('Cobertura da carteira'), 'Excluir')

      expect(onExcluir).toHaveBeenCalledTimes(1)
      expect(onExcluir).toHaveBeenCalledWith(COBERTURA_CARTEIRA)
    })
  })

  describe('menu de ações por linha (permissões negadas)', () => {
    it('sem podeDefinirMeta não há "Definir meta"', async () => {
      const user = usuarioRapido()
      renderizar({ podeDefinirMeta: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Devoluções de venda'))).toEqual(['Ver detalhes', 'Inativar', 'Excluir'])
    })

    it('sem podeVerHistorico não há "Histórico de metas"', async () => {
      const user = usuarioRapido()
      renderizar({ podeVerHistorico: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Rotinas financeiras em dia'))).toEqual(['Ver detalhes', 'Inativar', 'Excluir'])
    })

    it('sem podeAlterarSituacao não há Inativar/Reativar', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterarSituacao: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Cobertura de visitas'))).toEqual(['Ver detalhes'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador('Capacitação'))).toEqual(['Ver detalhes', 'Excluir'])
    })

    it('sem podeExcluir não há "Excluir" em nenhuma linha', async () => {
      const user = usuarioRapido()
      renderizar({ podeExcluir: false })

      for (const nome of NOMES_INDICADORES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))).not.toContain('Excluir')
      }
    })

    it('sem nenhuma permissão, o menu de cada linha tem só "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar({ podeDefinirMeta: false, podeVerHistorico: false, podeAlterarSituacao: false, podeExcluir: false })

      for (const nome of NOMES_INDICADORES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesIndicador(nome))).toEqual(['Ver detalhes'])
      }
    })
  })
})
