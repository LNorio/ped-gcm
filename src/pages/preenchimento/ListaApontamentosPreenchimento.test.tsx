import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  APONTAMENTO_INADIMPLENCIA,
  APONTAMENTO_VISITAS,
  APONTAMENTO_VITRINE,
  telaMesFechado,
  tiposPreenchimento,
} from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { TipoPreenchimento } from '../../types/dominio'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

/**
 * Lista dos apontamentos do mês (F9.5 — RF-64, RF-65, RNF-09).
 * - Uma região por tipo (nome acessível = nome do tipo), na ordem recebida, com a contagem
 *   "N apontamento(s)"; tipo sem apontamentos mostra "Nenhum apontamento ativo do tipo {tipo}.";
 *   sem tipos, "Nenhum apontamento ativo nos seus tipos.".
 * - Cada apontamento é um `article` com o nome como nome acessível, mostrando o tipo de valor
 *   (Numeral, Porcentagem, Booleano), a situação (Pendente, Não lançado, Preenchido, Corrigido),
 *   "Indicadores: ..." (ou "Indicadores: não vinculado") e "Dashboards: {nome} ({periodicidade})"
 *   (ou "Dashboards: nenhum").
 * - Busca local "Buscar apontamento ou indicador" em todos os tipos: pelo nome do apontamento ou de um
 *   indicador, sem diferenciar acentos nem maiúsculas; tipos sem resultado somem e a contagem passa a
 *   ser a dos encontrados; sem resultado, "Nenhum apontamento encontrado para “{busca}”.".
 */
describe('F9.5 — ListaApontamentosPreenchimento (apontamentos por tipo, com contagem e busca)', () => {
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

  const regiao = (tipo: string) => screen.getByRole('region', { name: tipo })
  const linha = (nome: string) => screen.getByRole('article', { name: nome })
  const campoBusca = () => screen.getByLabelText('Buscar apontamento ou indicador')

  describe('agrupamento por tipo (RF-64)', () => {
    it('uma região por tipo, na ordem recebida, com os apontamentos de cada um', () => {
      renderizar()

      expect(within(regiao('Comercial')).getAllByRole('article')).toHaveLength(2)
      expect(within(regiao('Comercial')).getByRole('article', { name: 'Visitas a clientes' })).toBeInTheDocument()
      expect(within(regiao('Comercial')).getByRole('article', { name: 'Vitrine montada' })).toBeInTheDocument()
      expect(within(regiao('Financeiro')).getAllByRole('article')).toHaveLength(1)
      expect(within(regiao('Financeiro')).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
      // Comercial vem antes de Financeiro no documento.
      expect(regiao('Comercial').compareDocumentPosition(regiao('Financeiro')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getAllByRole('article')).toHaveLength(3)
    })

    it('cada tipo mostra a contagem: "2 apontamentos" e "1 apontamento"', () => {
      renderizar()

      expect(within(regiao('Comercial')).getByText('2 apontamentos')).toBeInTheDocument()
      expect(within(regiao('Financeiro')).getByText('1 apontamento')).toBeInTheDocument()
    })

    it('a contagem vem de quantidade (informada pela API)', () => {
      const tipos: TipoPreenchimento[] = [{ id: 1, nome: 'Comercial', quantidade: 5, apontamentos: [APONTAMENTO_VISITAS] }]
      renderizar({ tipos })

      expect(within(regiao('Comercial')).getByText('5 apontamentos')).toBeInTheDocument()
    })

    it('tipo sem apontamentos: "Nenhum apontamento ativo do tipo {tipo}."', () => {
      renderizar({ tipos: [...tiposPreenchimento(), { id: 3, nome: 'Fiscal', quantidade: 0, apontamentos: [] }] })

      expect(within(regiao('Fiscal')).getByText('0 apontamentos')).toBeInTheDocument()
      expect(within(regiao('Fiscal')).getByText('Nenhum apontamento ativo do tipo Fiscal.')).toBeInTheDocument()
    })

    it('sem tipos: "Nenhum apontamento ativo nos seus tipos."', () => {
      renderizar({ tipos: [] })

      expect(screen.getByText('Nenhum apontamento ativo nos seus tipos.')).toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
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

    it('Porcentagem corrigida: "Corrigido" e o dashboard trimestral', () => {
      renderizar()

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
    it('busca pelo nome do apontamento, sem diferenciar maiúsculas: só os encontrados, com a contagem do tipo', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'VITRINE')

      expect(screen.getAllByRole('article')).toHaveLength(1)
      expect(within(regiao('Comercial')).getByRole('article', { name: 'Vitrine montada' })).toBeInTheDocument()
      expect(within(regiao('Comercial')).getByText('1 apontamento')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Financeiro' })).not.toBeInTheDocument()
    })

    it('busca pelo nome de um indicador, sem diferenciar acentos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'inadimplencia')

      expect(screen.getAllByRole('article')).toHaveLength(1)
      expect(within(regiao('Financeiro')).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Comercial' })).not.toBeInTheDocument()
    })

    it('busca por indicador encontra o apontamento que o compõe ("cobertura" → Visitas a clientes)', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'cobertura')

      expect(screen.getAllByRole('article')).toHaveLength(1)
      expect(linha('Visitas a clientes')).toBeInTheDocument()
    })

    it('procura em todos os tipos ao mesmo tempo', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'i')

      expect(screen.getByRole('region', { name: 'Comercial' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Financeiro' })).toBeInTheDocument()
    })

    it('sem resultado: "Nenhum apontamento encontrado para “{busca}”." e nenhuma linha', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'xyz')

      expect(screen.getByText('Nenhum apontamento encontrado para “xyz”.')).toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('limpar a busca volta a mostrar todos os tipos e apontamentos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(campoBusca(), 'vitrine')
      await user.clear(campoBusca())

      expect(screen.getAllByRole('article')).toHaveLength(3)
      expect(within(regiao('Comercial')).getByText('2 apontamentos')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Financeiro' })).toBeInTheDocument()
    })
  })
})
