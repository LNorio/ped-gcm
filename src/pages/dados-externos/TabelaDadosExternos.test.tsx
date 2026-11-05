import { render, screen, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import {
  DADO_CHAMADOS_API,
  DADO_COBERTURA_API,
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  DADO_PRAZO_API,
  DADO_TAREFA_SEM_NUMERO_API,
  DADO_VOLUME_API,
  NOMES_DADOS_EXTERNOS,
  dadosExternosApi,
} from '../../test/dadosExternosFalsos'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import type { DadoExterno } from '../../types/dominio'
import { TabelaDadosExternos, type TabelaDadosExternosProps } from './TabelaDadosExternos'

const DADOS: DadoExterno[] = dadosExternosApi().map(paraDadoExterno)
const FATURAMENTO = paraDadoExterno(DADO_FATURAMENTO_API)
const COBERTURA = paraDadoExterno(DADO_COBERTURA_API)
const DEVOLUCOES = paraDadoExterno(DADO_DEVOLUCOES_API)
const PRAZO = paraDadoExterno(DADO_PRAZO_API)
const CHAMADOS = paraDadoExterno(DADO_CHAMADOS_API)
const VOLUME = paraDadoExterno(DADO_VOLUME_API)

/** Colunas visíveis (2026-11-04): os demais campos ficam nos detalhes da linha. */
const COLUNAS = ['Nome', 'Situação', 'Origem', 'Identificador', 'Cadastro', 'Ações']
const COL = {
  nome: 0,
  situacao: 1,
  origem: 2,
  identificador: 3,
  cadastro: 4,
  acoes: 5,
}

describe('F5.2 — TabelaDadosExternos (listagem de dados externos — RF-23)', () => {
  function renderizar(props: Partial<TabelaDadosExternosProps> = {}) {
    const onConcluir = props.onConcluir ?? vi.fn<(dado: DadoExterno) => void>()
    const onAlterarSituacao = props.onAlterarSituacao ?? vi.fn<(dado: DadoExterno) => void>()
    const onExcluir = props.onExcluir ?? vi.fn<(dado: DadoExterno) => void>()
    render(
      <TabelaDadosExternos
        dados={props.dados ?? DADOS}
        podeConcluir={props.podeConcluir ?? true}
        podeAlterarSituacao={props.podeAlterarSituacao ?? true}
        podeExcluir={props.podeExcluir ?? true}
        onConcluir={onConcluir}
        onAlterarSituacao={onAlterarSituacao}
        onExcluir={onExcluir}
        textoVazio={props.textoVazio}
      />,
    )
    return { onConcluir, onAlterarSituacao, onExcluir }
  }

  const tabela = () => screen.getByRole('table', { name: 'Dados externos' })

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

  /** Linha de detalhes logo abaixo da linha do dado, ou `null` se estiver recolhida. */
  function detalhesDe(nome: string): HTMLElement | null {
    const proxima = linha(nome).nextElementSibling as HTMLElement | null
    return proxima && proxima.classList.contains('tabela__detalhes') ? proxima : null
  }

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesDadoExterno(nome), 'Ver detalhes')
    const detalhes = detalhesDe(nome)
    if (!detalhes) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return detalhes
  }

  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`) dos detalhes. */
  function valorDetalhe(detalhes: HTMLElement, rotulo: string): HTMLElement {
    const termo = within(detalhes).getByText(rotulo, { selector: 'dt' })
    const valor = termo.nextElementSibling as HTMLElement | null
    expect(valor?.tagName).toBe('DD')
    return valor as HTMLElement
  }

  describe('estrutura', () => {
    it('tabela com legenda "Dados externos" e só as colunas Nome, Situação, Origem, Identificador, Cadastro e Ações, nesta ordem', () => {
      renderizar()

      const cabecalhos = within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)
      expect(cabecalhos).toEqual(COLUNAS)
    })

    it('Campo/cálculo, Referência, Coleta, Janela retroativa e Tipo de valor não são colunas da tabela', () => {
      renderizar()

      for (const titulo of ['Campo/cálculo', 'Referência', 'Coleta', 'Janela retroativa', 'Tipo de valor']) {
        expect(within(tabela()).queryByRole('columnheader', { name: titulo })).not.toBeInTheDocument()
      }
      expect(within(linha('Faturamento líquido')).getAllByRole('cell')).toHaveLength(COLUNAS.length)
    })

    it('lista os dados na ordem recebida, com os detalhes recolhidos', () => {
      renderizar()

      expect(linhasDeDados()).toHaveLength(NOMES_DADOS_EXTERNOS.length)
      for (const [indice, nome] of NOMES_DADOS_EXTERNOS.entries()) {
        expect(within(within(linhasDeDados()[indice]).getAllByRole('cell')[COL.nome]).getByText(nome)).toBeInTheDocument()
        expect(detalhesDe(nome)).toBeNull()
      }
    })

    it('não há botão de expandir da tabela (a expansão fica no menu de ações)', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) detalhes$/ })).not.toBeInTheDocument()
    })

    it('lista vazia exibe o textoVazio e nenhum botão', () => {
      renderizar({ dados: [], textoVazio: 'Nenhum dado externo cadastrado.' })

      expect(within(tabela()).getByText('Nenhum dado externo cadastrado.')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('não há ação de editar em nenhuma linha (RF-29)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
      for (const nome of NOMES_DADOS_EXTERNOS) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))
        expect(itens.some((item) => /editar/i.test(item))).toBe(false)
      }
    })
  })

  describe('colunas', () => {
    it('Nome mostra o nome e, abaixo, o tipo de apontamento', () => {
      renderizar()

      expect(within(celula('Faturamento líquido', COL.nome)).getByText('Comercial')).toBeInTheDocument()
      expect(within(celula('Prazo médio de recebimento', COL.nome)).getByText('Financeiro')).toBeInTheDocument()
    })

    it('Situação: Ativo (sucesso), Inativo (neutro) e "Em construção (TI)" (info)', () => {
      renderizar()

      expect(within(celula('Faturamento líquido', COL.situacao)).getByText('Ativo')).toHaveClass('etiqueta', 'etiqueta--sucesso')
      expect(within(celula('Cobertura de clientes', COL.situacao)).getByText('Inativo')).toHaveClass('etiqueta', 'etiqueta--neutro')
      expect(within(celula('Devoluções de venda', COL.situacao)).getByText('Em construção (TI)')).toHaveClass(
        'etiqueta',
        'etiqueta--info',
      )
    })

    it('Situação mostra "Tarefa nº {id}" quando a API devolve a tarefa e nada quando não há tarefa', () => {
      renderizar()

      expect(within(celula('Devoluções de venda', COL.situacao)).getByText('Tarefa nº 1044')).toBeInTheDocument()
      expect(within(celula('Prazo médio de recebimento', COL.situacao)).getByText('Em construção (TI)')).toBeInTheDocument()
      expect(within(celula('Prazo médio de recebimento', COL.situacao)).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
      expect(within(celula('Faturamento líquido', COL.situacao)).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
    })

    it('tarefa sem número (id null): Situação mostra "Em construção (TI)" sem "Tarefa nº"; o restante da linha aparece', () => {
      renderizar({ dados: [...DADOS, paraDadoExterno(DADO_TAREFA_SEM_NUMERO_API)] })

      const situacao = celula('Bonificações pagas', COL.situacao)
      expect(within(situacao).getByText('Em construção (TI)')).toBeInTheDocument()
      expect(within(situacao).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
      expect(within(situacao).queryByText(/null/)).not.toBeInTheDocument()
      expect(celula('Bonificações pagas', COL.origem)).toHaveTextContent('Senior HCM')
      expect(celula('Bonificações pagas', COL.identificador)).toHaveTextContent('a definir pela TI')
    })

    it('Origem mostra o rótulo do sistema de origem', () => {
      renderizar()

      expect(celula('Faturamento líquido', COL.origem)).toHaveTextContent('Senior ERP (Sapiens)')
      expect(celula('Chamados atendidos no prazo', COL.origem)).toHaveTextContent('Outro sistema')
    })

    it('Origem usa os rótulos de Senior HCM e Bitrix24', () => {
      renderizar({
        dados: [
          { ...FATURAMENTO, id: 90, nome: 'Dado HCM', sistemaOrigem: 'senior_hcm' },
          { ...FATURAMENTO, id: 91, nome: 'Dado Bitrix', sistemaOrigem: 'bitrix24' },
        ],
      })

      expect(celula('Dado HCM', COL.origem)).toHaveTextContent('Senior HCM')
      expect(celula('Dado Bitrix', COL.origem)).toHaveTextContent('Bitrix24')
    })

    it('Identificador mostra o identificador ou "a definir pela TI" quando é null', () => {
      renderizar()

      expect(celula('Faturamento líquido', COL.identificador)).toHaveTextContent('FATURAMENTO')
      expect(celula('Devoluções de venda', COL.identificador)).toHaveTextContent('a definir pela TI')
      expect(celula('Prazo médio de recebimento', COL.identificador)).toHaveTextContent('a definir pela TI')
    })

    it('Cadastro mostra a data/hora formatada e "por {autor}"', () => {
      renderizar()

      const cadastro = celula('Faturamento líquido', COL.cadastro)
      expect(within(cadastro).getByText('05/10/2026 09:00')).toBeInTheDocument()
      expect(within(cadastro).getByText('por Maria Souza')).toBeInTheDocument()
    })

    it('a coluna Ações tem o menu "Ações do dado externo {nome}" em todas as linhas', () => {
      renderizar()

      for (const nome of NOMES_DADOS_EXTERNOS) {
        const gatilho = within(celula(nome, COL.acoes)).getByRole('button', { name: rotuloAcoesDadoExterno(nome) })
        expect(gatilho).toHaveAttribute('aria-haspopup', 'menu')
      }
    })
  })

  describe('detalhes da linha ("Ver detalhes" no menu de ações)', () => {
    it('"Ver detalhes" abre os detalhes só daquela linha', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Devoluções de venda')

      expect(detalhes).toBeInTheDocument()
      for (const nome of NOMES_DADOS_EXTERNOS.filter((n) => n !== 'Devoluções de venda')) {
        expect(detalhesDe(nome)).toBeNull()
      }
    })

    it('aberto, o item vira "Ocultar detalhes"; escolhê-lo recolhe a linha e o item volta a "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Faturamento líquido')

      const menu = await abrirMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))
      expect(within(menu).queryByRole('menuitem', { name: 'Ver detalhes' })).not.toBeInTheDocument()
      await user.click(within(menu).getByRole('menuitem', { name: 'Ocultar detalhes' }))

      expect(detalhesDe('Faturamento líquido')).toBeNull()
      const itens = await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))
      expect(itens[0]).toBe('Ver detalhes')
    })

    it('o rótulo "Ocultar detalhes" vale só para a linha aberta', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Faturamento líquido')

      expect((await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes')))[0]).toBe('Ver detalhes')
      expect((await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido')))[0]).toBe('Ocultar detalhes')
    })

    it('duas linhas podem ficar abertas; recolher uma não afeta a outra', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Faturamento líquido')
      await verDetalhes(user, 'Cobertura de clientes')

      expect(detalhesDe('Faturamento líquido')).not.toBeNull()
      expect(detalhesDe('Cobertura de clientes')).not.toBeNull()

      await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Ocultar detalhes')

      expect(detalhesDe('Faturamento líquido')).toBeNull()
      expect(detalhesDe('Cobertura de clientes')).not.toBeNull()
    })

    it('toda linha tem detalhes, inclusive sem comentários e sem situação alterada', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(valorDetalhe(detalhes, 'Tipo de valor')).toHaveTextContent('Numeral')
      expect(within(detalhes).queryByText(/^Comentários:/)).not.toBeInTheDocument()
      expect(within(detalhes).queryByText(/^Situação alterada em/)).not.toBeInTheDocument()
    })

    it('mostra Campo/cálculo, Referência, Coleta, Janela retroativa e Tipo de valor como pares rótulo e valor', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Devoluções de venda')

      expect(valorDetalhe(detalhes, 'Campo/cálculo')).toHaveTextContent(
        'Soma do valor líquido das notas de devolução de venda, por filial, no período.',
      )
      expect(valorDetalhe(detalhes, 'Referência')).toHaveTextContent('Filial')
      expect(valorDetalhe(detalhes, 'Coleta')).toHaveTextContent('Diária')
      expect(valorDetalhe(detalhes, 'Janela retroativa')).toHaveTextContent('Somente o mês')
      expect(valorDetalhe(detalhes, 'Tipo de valor')).toHaveTextContent('Numeral')
    })

    it('Campo/cálculo mostra "—" quando vazio', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Faturamento líquido')

      expect(valorDetalhe(detalhes, 'Campo/cálculo')).toHaveTextContent(/^—$/)
    })

    it('Referência mostra Filial, Colaborador ou Zona de venda', async () => {
      const user = usuarioRapido()
      renderizar({
        dados: [
          FATURAMENTO,
          { ...FATURAMENTO, id: 92, nome: 'Por colaborador', referencia: 'colaborador' },
          { ...FATURAMENTO, id: 93, nome: 'Por zona', referencia: 'zona' },
        ],
      })

      expect(valorDetalhe(await verDetalhes(user, 'Faturamento líquido'), 'Referência')).toHaveTextContent('Filial')
      expect(valorDetalhe(await verDetalhes(user, 'Por colaborador'), 'Referência')).toHaveTextContent('Colaborador')
      expect(valorDetalhe(await verDetalhes(user, 'Por zona'), 'Referência')).toHaveTextContent('Zona de venda')
    })

    it('Coleta mostra a descrição da API ou, sem ela, o rótulo da coleta', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(valorDetalhe(await verDetalhes(user, 'Faturamento líquido'), 'Coleta')).toHaveTextContent('Todo dia 15 do mês')
      expect(valorDetalhe(await verDetalhes(user, 'Cobertura de clientes'), 'Coleta')).toHaveTextContent('Diária')
      expect(valorDetalhe(await verDetalhes(user, 'Prazo médio de recebimento'), 'Coleta')).toHaveTextContent(
        'Data específica do mês',
      )
    })

    it('Janela retroativa: "Somente o mês" (1), "{n} meses" (2 a 24) e "—" quando null (sentido "último valor")', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(valorDetalhe(await verDetalhes(user, 'Cobertura de clientes'), 'Janela retroativa')).toHaveTextContent('Somente o mês')
      expect(valorDetalhe(await verDetalhes(user, 'Faturamento líquido'), 'Janela retroativa')).toHaveTextContent('3 meses')
      expect(valorDetalhe(await verDetalhes(user, 'Prazo médio de recebimento'), 'Janela retroativa')).toHaveTextContent('6 meses')
      expect(valorDetalhe(await verDetalhes(user, 'Volume de vendas'), 'Janela retroativa')).toHaveTextContent('12 meses')
      expect(valorDetalhe(await verDetalhes(user, 'Chamados atendidos no prazo'), 'Janela retroativa')).toHaveTextContent(/^—$/)
    })

    it('Tipo de valor mostra o rótulo (Numeral, Porcentagem)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(valorDetalhe(await verDetalhes(user, 'Faturamento líquido'), 'Tipo de valor')).toHaveTextContent('Numeral')
      expect(valorDetalhe(await verDetalhes(user, 'Cobertura de clientes'), 'Tipo de valor')).toHaveTextContent('Porcentagem')
    })

    it('dado com comentários: os detalhes mostram também "Comentários: {texto}" (RNF-01)', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Chamados atendidos no prazo')

      expect(within(detalhes).getByText('Comentários: Sistema GLPI, relatório de SLA mensal.')).toBeInTheDocument()
      expect(valorDetalhe(detalhes, 'Tipo de valor')).toHaveTextContent('Porcentagem')
    })

    it('dado com situação alterada: os detalhes mostram também "Situação alterada em {data hora} por {nome}" (RNF-01)', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Cobertura de clientes')

      expect(within(detalhes).getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()
      expect(valorDetalhe(detalhes, 'Referência')).toHaveTextContent('Filial')
    })
  })

  describe('menu de ações por linha', () => {
    it('dado em construção (todas as permissões): Ver detalhes, Concluir construção e Excluir, nesta ordem', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual([
        'Ver detalhes',
        'Concluir construção',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Prazo médio de recebimento'))).toEqual([
        'Ver detalhes',
        'Concluir construção',
        'Excluir',
      ])
    })

    it('dado ativo: Ver detalhes, Desativar e Excluir; inativo: Ver detalhes, Ativar e Excluir (sem Concluir construção)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual([
        'Ver detalhes',
        'Desativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toEqual([
        'Ver detalhes',
        'Ativar',
        'Excluir',
      ])
    })

    it('"Excluir" é o item de perigo; os demais não', async () => {
      const user = usuarioRapido()
      renderizar()

      const menu = await abrirMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))

      expect(within(menu).getByRole('menuitem', { name: 'Excluir' })).toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Desativar' })).not.toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Ver detalhes' })).not.toHaveClass('menu-acoes__item--perigo')
    })

    it('sem podeConcluir não há "Concluir construção"', async () => {
      const user = usuarioRapido()
      renderizar({ podeConcluir: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual(['Ver detalhes', 'Excluir'])
    })

    it('"Concluir construção" chama onConcluir com o dado da linha', async () => {
      const user = usuarioRapido()
      const { onConcluir, onAlterarSituacao, onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Concluir construção')

      expect(onConcluir).toHaveBeenCalledTimes(1)
      expect(onConcluir).toHaveBeenCalledWith(DEVOLUCOES)
      expect(onAlterarSituacao).not.toHaveBeenCalled()
      expect(onExcluir).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('dados em construção não têm Ativar/Desativar (RF-30)', async () => {
      const user = usuarioRapido()
      renderizar({ podeConcluir: false, podeExcluir: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual(['Ver detalhes'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Prazo médio de recebimento'))).toEqual(['Ver detalhes'])
    })

    it('sem podeAlterarSituacao não há Ativar/Desativar', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterarSituacao: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual(['Ver detalhes', 'Excluir'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toEqual(['Ver detalhes', 'Excluir'])
    })

    it('Ativar/Desativar chama onAlterarSituacao com o dado da linha', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao } = renderizar()

      await escolherAcao(user, rotuloAcoesDadoExterno('Cobertura de clientes'), 'Ativar')
      expect(onAlterarSituacao).toHaveBeenCalledTimes(1)
      expect(onAlterarSituacao).toHaveBeenLastCalledWith(COBERTURA)

      await escolherAcao(user, rotuloAcoesDadoExterno('Faturamento líquido'), 'Desativar')
      expect(onAlterarSituacao).toHaveBeenCalledTimes(2)
      expect(onAlterarSituacao).toHaveBeenLastCalledWith(FATURAMENTO)
    })

    it('"Excluir" aparece em todas as linhas (inclusive em construção) com podeExcluir e chama onExcluir', async () => {
      const user = usuarioRapido()
      const { onExcluir } = renderizar()

      for (const nome of NOMES_DADOS_EXTERNOS) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))).toContain('Excluir')
      }
      await escolherAcao(user, rotuloAcoesDadoExterno('Volume de vendas'), 'Excluir')
      expect(onExcluir).toHaveBeenCalledTimes(1)
      expect(onExcluir).toHaveBeenCalledWith(VOLUME)
    })

    it('sem podeExcluir não há "Excluir"', async () => {
      const user = usuarioRapido()
      renderizar({ podeExcluir: false })

      for (const nome of NOMES_DADOS_EXTERNOS) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome))).not.toContain('Excluir')
      }
    })

    it('sem nenhuma permissão, o menu de cada linha tem só "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar({ dados: [FATURAMENTO, PRAZO, CHAMADOS], podeConcluir: false, podeAlterarSituacao: false, podeExcluir: false })

      for (const nome of ['Faturamento líquido', 'Prazo médio de recebimento', 'Chamados atendidos no prazo']) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno(nome), celula(nome, COL.acoes))).toEqual(['Ver detalhes'])
      }
    })

    it('"Ver detalhes" não chama nenhum callback', async () => {
      const user = usuarioRapido()
      const { onConcluir, onAlterarSituacao, onExcluir } = renderizar()

      await verDetalhes(user, 'Devoluções de venda')

      expect(onConcluir).not.toHaveBeenCalled()
      expect(onAlterarSituacao).not.toHaveBeenCalled()
      expect(onExcluir).not.toHaveBeenCalled()
    })
  })
})
