import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  APONTAMENTO_INADIMPLENCIA,
  APONTAMENTO_VISITAS,
  APONTAMENTO_VITRINE,
  telaMesFechado,
  tiposPreenchimento,
} from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import type { TipoPreenchimento } from '../../types/dominio'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

/**
 * Lista dos apontamentos do mês (F9.5 — RF-64, RF-65, RNF-09), em subabas por tipo, como no protótipo.
 * - Subabas no padrão de abas do WAI-ARIA: `tablist` "Tipos de apontamento", um `tab` por tipo, na
 *   ordem recebida, com o nome do tipo seguido da contagem (de `quantidade`; ex.: "Comercial 2"), e um
 *   `tabpanel` (nome acessível = a aba) com os apontamentos do tipo selecionado; os dos outros tipos
 *   ficam fora da árvore de acessibilidade.
 * - Seleção inicial: a primeira aba com apontamentos (ou a primeira, se nenhuma tiver). Clique ou setas
 *   (→/←, circulares) selecionam a aba e levam o foco a ela; só a aba selecionada fica na ordem do Tab
 *   (tabindex 0; as demais, -1).
 * - Tipo sem apontamentos: o painel mostra "Nenhum apontamento ativo do tipo {tipo}."; sem tipos,
 *   "Nenhum apontamento ativo nos seus tipos." (sem abas).
 * - Cada apontamento é um `article` com o nome como nome acessível, mostrando o tipo de valor
 *   (Numeral, Porcentagem, Booleano), a situação (Pendente, Não lançado, Preenchido, Corrigido),
 *   "Indicadores: ..." (ou "Indicadores: não vinculado") e "Dashboards: {nome} ({periodicidade})"
 *   (ou "Dashboards: nenhum").
 * - Busca local "Buscar apontamento ou indicador" em todos os tipos (protótipo): com texto, as abas
 *   somem, aparece "Buscando em todos os seus tipos de apontamento." e a lista mostra os encontrados de
 *   todos os tipos, na ordem da tela, cada um com o nome do seu tipo; sem diferenciar acentos nem
 *   maiúsculas; sem resultado, "Nenhum apontamento encontrado para “{busca}”.". Limpar a busca volta às
 *   abas, com a mesma aba selecionada de antes.
 */
describe('F9.5 — ListaApontamentosPreenchimento (subabas por tipo, com contagem e busca)', () => {
  function renderizar(props: Partial<ListaApontamentosPreenchimentoProps> = {}) {
    const completas: ListaApontamentosPreenchimentoProps = {
      tipos: tiposPreenchimento(),
      editavel: true,
      rascunhos: {},
      onAlterarRascunho: vi.fn(),
      erros: {},
      onCorrigir: vi.fn(),
      onVerHistorico: vi.fn(),
      ...props,
    }
    render(<ListaApontamentosPreenchimento {...completas} />)
    return completas
  }

  const comecaCom = (inicio: string) => (nome: string) => nome.startsWith(inicio)
  const abas = () => screen.getByRole('tablist', { name: 'Tipos de apontamento' })
  const aba = (tipo: string) => within(abas()).getByRole('tab', { name: comecaCom(tipo) })
  const painel = () => screen.getByRole('tabpanel')
  const linha = (nome: string) => screen.getByRole('article', { name: nome })
  const campoBusca = () => screen.getByLabelText('Buscar apontamento ou indicador')
  const nomesDasLinhas = () => screen.getAllByRole('article').map((artigo) => within(artigo).getByRole('heading').textContent)

  async function selecionarAba(user: Usuario, tipo: string) {
    await user.click(aba(tipo))
  }

  describe('subabas por tipo (RF-64)', () => {
    it('um tablist "Tipos de apontamento" com uma aba por tipo, na ordem recebida, com o nome e a contagem', () => {
      renderizar()

      const todas = within(abas()).getAllByRole('tab')
      expect(todas).toHaveLength(2)
      expect(todas[0]).toHaveTextContent(/^Comercial\s*2$/)
      expect(todas[1]).toHaveTextContent(/^Financeiro\s*1$/)
    })

    it('a contagem da aba vem de quantidade (informada pela API)', () => {
      const tipos: TipoPreenchimento[] = [{ id: 1, nome: 'Comercial', quantidade: 5, apontamentos: [APONTAMENTO_VISITAS] }]
      renderizar({ tipos })

      expect(aba('Comercial')).toHaveTextContent(/^Comercial\s*5$/)
    })

    it('a primeira aba começa selecionada e o painel mostra só os apontamentos dela', () => {
      renderizar()

      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'false')
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
      expect(within(painel()).getAllByRole('article')).toHaveLength(2)
      expect(within(painel()).getByRole('article', { name: 'Visitas a clientes' })).toBeInTheDocument()
      expect(within(painel()).getByRole('article', { name: 'Vitrine montada' })).toBeInTheDocument()
      expect(screen.queryByRole('article', { name: 'Inadimplência' })).not.toBeInTheDocument()
    })

    it('o painel tem como nome acessível a aba selecionada', () => {
      renderizar()

      expect(screen.getByRole('tabpanel', { name: comecaCom('Comercial') })).toBeInTheDocument()
    })

    it('clicar em outra aba a seleciona e mostra só os apontamentos daquele tipo', async () => {
      const user = usuarioRapido()
      renderizar()

      await selecionarAba(user, 'Financeiro')

      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tabpanel', { name: comecaCom('Financeiro') })).toBeInTheDocument()
      expect(within(painel()).getAllByRole('article')).toHaveLength(1)
      expect(within(painel()).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
      expect(screen.queryByRole('article', { name: 'Visitas a clientes' })).not.toBeInTheDocument()
    })

    it('fora da busca, a linha não repete o nome do tipo (a aba já informa)', () => {
      renderizar()

      expect(within(linha('Visitas a clientes')).queryByText('Comercial')).not.toBeInTheDocument()
    })

    it('a seleção inicial é a primeira aba com apontamentos (protótipo)', () => {
      renderizar({ tipos: [{ id: 3, nome: 'Fiscal', quantidade: 0, apontamentos: [] }, ...tiposPreenchimento()] })

      expect(aba('Fiscal')).toHaveAttribute('aria-selected', 'false')
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
      expect(within(painel()).getAllByRole('article')).toHaveLength(2)
    })

    it('tipo sem apontamentos: aba com 0 e o painel mostra "Nenhum apontamento ativo do tipo {tipo}."', async () => {
      const user = usuarioRapido()
      renderizar({ tipos: [...tiposPreenchimento(), { id: 3, nome: 'Fiscal', quantidade: 0, apontamentos: [] }] })

      expect(aba('Fiscal')).toHaveTextContent(/^Fiscal\s*0$/)
      await selecionarAba(user, 'Fiscal')

      expect(within(painel()).getByText('Nenhum apontamento ativo do tipo Fiscal.')).toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('nenhum tipo com apontamentos: a primeira aba fica selecionada, com a mensagem do tipo', () => {
      renderizar({
        tipos: [
          { id: 3, nome: 'Fiscal', quantidade: 0, apontamentos: [] },
          { id: 4, nome: 'RH', quantidade: 0, apontamentos: [] },
        ],
      })

      expect(aba('Fiscal')).toHaveAttribute('aria-selected', 'true')
      expect(within(painel()).getByText('Nenhum apontamento ativo do tipo Fiscal.')).toBeInTheDocument()
    })

    it('sem tipos: "Nenhum apontamento ativo nos seus tipos.", sem abas', () => {
      renderizar({ tipos: [] })

      expect(screen.getByText('Nenhum apontamento ativo nos seus tipos.')).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })
  })

  describe('teclado (padrão de abas do WAI-ARIA)', () => {
    const tresTipos = (): TipoPreenchimento[] => [
      ...tiposPreenchimento(),
      { id: 3, nome: 'Fiscal', quantidade: 0, apontamentos: [] },
    ]

    it('só a aba selecionada fica na ordem do Tab (tabindex 0; as demais, -1)', async () => {
      const user = usuarioRapido()
      renderizar({ tipos: tresTipos() })

      expect(aba('Comercial')).toHaveAttribute('tabindex', '0')
      expect(aba('Financeiro')).toHaveAttribute('tabindex', '-1')
      expect(aba('Fiscal')).toHaveAttribute('tabindex', '-1')

      await selecionarAba(user, 'Financeiro')

      expect(aba('Financeiro')).toHaveAttribute('tabindex', '0')
      expect(aba('Comercial')).toHaveAttribute('tabindex', '-1')
    })

    it('seta para a direita seleciona a próxima aba e leva o foco a ela', async () => {
      const user = usuarioRapido()
      renderizar({ tipos: tresTipos() })
      await selecionarAba(user, 'Comercial')

      await user.keyboard('{ArrowRight}')

      expect(aba('Financeiro')).toHaveFocus()
      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(within(painel()).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
    })

    it('seta para a direita na última aba volta à primeira', async () => {
      const user = usuarioRapido()
      renderizar({ tipos: tresTipos() })
      await selecionarAba(user, 'Fiscal')

      await user.keyboard('{ArrowRight}')

      expect(aba('Comercial')).toHaveFocus()
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
    })

    it('seta para a esquerda na primeira aba vai à última; de novo, à anterior', async () => {
      const user = usuarioRapido()
      renderizar({ tipos: tresTipos() })
      await selecionarAba(user, 'Comercial')

      await user.keyboard('{ArrowLeft}')
      expect(aba('Fiscal')).toHaveFocus()
      expect(aba('Fiscal')).toHaveAttribute('aria-selected', 'true')

      await user.keyboard('{ArrowLeft}')
      expect(aba('Financeiro')).toHaveFocus()
      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('dados de cada apontamento (RF-65)', () => {
    it('Numeral preenchido: nome, tipo de valor, situação, indicadores e dashboards com a periodicidade', () => {
      renderizar()

      const visitas = linha('Visitas a clientes')
      expect(within(visitas).getByText('Visitas a clientes')).toBeInTheDocument()
      expect(within(visitas).getByText('Numeral')).toBeInTheDocument()
      expect(within(visitas).getByText('Preenchido')).toBeInTheDocument()
      expect(within(visitas).getByText('Indicadores: Cobertura de clientes')).toBeInTheDocument()
      expect(within(visitas).getByText('Dashboards: PED Comercial (mensal)')).toBeInTheDocument()
    })

    it('Booleano pendente sem indicadores nem dashboards: "não vinculado" e "nenhum"', () => {
      renderizar()

      const vitrine = linha('Vitrine montada')
      expect(within(vitrine).getByText('Booleano')).toBeInTheDocument()
      expect(within(vitrine).getByText('Pendente')).toBeInTheDocument()
      expect(within(vitrine).getByText('Indicadores: não vinculado')).toBeInTheDocument()
      expect(within(vitrine).getByText('Dashboards: nenhum')).toBeInTheDocument()
    })

    it('Porcentagem corrigida (aba Financeiro): "Corrigido" e o dashboard trimestral', async () => {
      const user = usuarioRapido()
      renderizar()
      await selecionarAba(user, 'Financeiro')

      const inadimplencia = linha('Inadimplência')
      expect(within(inadimplencia).getByText('Porcentagem')).toBeInTheDocument()
      expect(within(inadimplencia).getByText('Corrigido')).toBeInTheDocument()
      expect(within(inadimplencia).getByText('Indicadores: Inadimplência')).toBeInTheDocument()
      expect(within(inadimplencia).getByText('Dashboards: PED Gerentes (trimestral)')).toBeInTheDocument()
    })

    it('mês fechado: o apontamento sem valor aparece como "Não lançado"', () => {
      renderizar({ tipos: telaMesFechado().tipos, editavel: false })

      expect(within(linha('Vitrine montada')).getByText('Não lançado')).toBeInTheDocument()
    })

    it('vários indicadores e dashboards, separados por vírgula; dashboard sem periodicidade só com o nome', () => {
      const tipos: TipoPreenchimento[] = [
        {
          id: 1,
          nome: 'Comercial',
          quantidade: 1,
          apontamentos: [
            {
              ...APONTAMENTO_VISITAS,
              indicadores: [
                { id: 1, nome: 'Cobertura de clientes' },
                { id: 2, nome: 'Positivação' },
              ],
              dashboards: [
                { id: 1, nome: 'PED Comercial', periodicidade: 'mensal' },
                { id: 3, nome: 'PED Supervisores', periodicidade: null },
              ],
            },
          ],
        },
      ]
      renderizar({ tipos })

      const visitas = linha('Visitas a clientes')
      expect(within(visitas).getByText('Indicadores: Cobertura de clientes, Positivação')).toBeInTheDocument()
      expect(within(visitas).getByText('Dashboards: PED Comercial (mensal), PED Supervisores')).toBeInTheDocument()
    })

    it('apontamentos com valor mostram o valor lançado no padrão pt-BR (Numeral, Porcentagem com "%", Booleano Sim/Não)', () => {
      const tipos: TipoPreenchimento[] = [
        {
          id: 1,
          nome: 'Comercial',
          quantidade: 3,
          apontamentos: [APONTAMENTO_VISITAS, { ...APONTAMENTO_VITRINE, situacao: 'preenchido', valor: true }, APONTAMENTO_INADIMPLENCIA],
        },
      ]
      renderizar({ tipos })

      expect(within(linha('Visitas a clientes')).getByText('1.234,56')).toBeInTheDocument()
      expect(within(linha('Vitrine montada')).getByText('Sim')).toBeInTheDocument()
      expect(within(linha('Inadimplência')).getByText('80,00%')).toBeInTheDocument()
    })
  })

  describe('busca em todos os tipos (RF-64, RNF-09)', () => {
    it('com texto na busca, as abas somem e aparece "Buscando em todos os seus tipos de apontamento."', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'vitrine')

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getByText('Buscando em todos os seus tipos de apontamento.')).toBeInTheDocument()
    })

    it('sem busca, o aviso "Buscando em todos..." não aparece', () => {
      renderizar()

      expect(screen.queryByText('Buscando em todos os seus tipos de apontamento.')).not.toBeInTheDocument()
    })

    it('busca pelo nome do apontamento, sem diferenciar maiúsculas: só os encontrados', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'VITRINE')

      expect(nomesDasLinhas()).toEqual(['Vitrine montada'])
    })

    it('encontra apontamento de outro tipo que não o da aba selecionada, sem diferenciar acentos', async () => {
      const user = usuarioRapido()
      renderizar()
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')

      await user.type(campoBusca(), 'inadimplencia')

      expect(nomesDasLinhas()).toEqual(['Inadimplência'])
    })

    it('busca por indicador encontra o apontamento que o compõe ("cobertura" → Visitas a clientes)', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'cobertura')

      expect(nomesDasLinhas()).toEqual(['Visitas a clientes'])
    })

    it('procura em todos os tipos ao mesmo tempo, na ordem da tela, e cada linha mostra o nome do seu tipo', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'i')

      expect(nomesDasLinhas()).toEqual(['Visitas a clientes', 'Vitrine montada', 'Inadimplência'])
      expect(within(linha('Visitas a clientes')).getByText('Comercial')).toBeInTheDocument()
      expect(within(linha('Vitrine montada')).getByText('Comercial')).toBeInTheDocument()
      expect(within(linha('Inadimplência')).getByText('Financeiro')).toBeInTheDocument()
    })

    it('sem resultado: "Nenhum apontamento encontrado para “{busca}”." e nenhuma linha', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'xyz')

      expect(screen.getByText('Nenhum apontamento encontrado para “xyz”.')).toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('limpar a busca volta às abas, com a mesma aba selecionada de antes', async () => {
      const user = usuarioRapido()
      renderizar()
      await selecionarAba(user, 'Financeiro')

      await user.type(campoBusca(), 'vitrine')
      await user.clear(campoBusca())

      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(aba('Financeiro')).toHaveTextContent(/^Financeiro\s*1$/)
      expect(aba('Comercial')).toHaveTextContent(/^Comercial\s*2$/)
      expect(nomesDasLinhas()).toEqual(['Inadimplência'])
      expect(screen.queryByText('Buscando em todos os seus tipos de apontamento.')).not.toBeInTheDocument()
    })
  })
})
