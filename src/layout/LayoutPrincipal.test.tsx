import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Sessao } from '../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { LayoutPrincipal } from './LayoutPrincipal'

const TODAS_AS_ABAS = [
  ['Início', '/'],
  ['Tipos', '/tipos'],
  ['Apontamentos', '/apontamentos'],
  ['Dados Externos', '/dados-externos'],
  ['Indicadores', '/indicadores'],
  ['Faixas', '/faixas'],
  ['Dashboards', '/dashboards'],
  ['Preenchimento', '/preenchimento'],
  ['Fechamentos', '/fechamentos'],
] as const

function renderizar(sessao: Partial<Sessao>, caminho = '/') {
  return render(
    <ProvedorSessaoFalso sessao={sessao}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route element={<LayoutPrincipal />}>
            <Route path="/" element={<p>Conteúdo do Início</p>} />
            <Route path="/tipos" element={<p>Conteúdo de Tipos</p>} />
            <Route path="/apontamentos" element={<p>Conteúdo de Apontamentos</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

const admin = (parcial = {}) => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS, ...parcial })

describe('F2.3 — Rotas e layout principal (LayoutPrincipal)', () => {
  describe('cabeçalho', () => {
    it('mostra a marca "Comercial Mariano" e o nome do sistema "PED"', () => {
      renderizar({ acesso: admin() })

      const cabecalho = screen.getByRole('banner')
      expect(within(cabecalho).getByRole('img', { name: 'Comercial Mariano' })).toBeInTheDocument()
      expect(within(cabecalho).getByText('PED')).toBeInTheDocument()
    })

    it('mostra "Olá, {nome}" e a etiqueta do perfil', () => {
      renderizar({ acesso: admin({ nome: 'Maria Souza' }) })

      const cabecalho = screen.getByRole('banner')
      expect(within(cabecalho).getByText('Olá, Maria Souza')).toBeInTheDocument()
      expect(within(cabecalho).getByText('Admin')).toBeInTheDocument()
    })

    it.each([
      ['admin', 'Admin'],
      ['validador', 'Validador'],
      ['preenchedor', 'Preenchedor'],
    ] as const)('perfil %s aparece com o rótulo "%s"', (perfil, rotulo) => {
      renderizar({ acesso: acessoFalso({ perfil, todasAsFiliais: perfil !== 'preenchedor', filiais: FILIAIS }) })

      expect(within(screen.getByRole('banner')).getByText(rotulo)).toBeInTheDocument()
    })

    it('o botão "Sair" chama sair() da sessão', async () => {
      const user = userEvent.setup()
      const sair = vi.fn()
      renderizar({ acesso: admin(), sair })

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))

      expect(sair).toHaveBeenCalledTimes(1)
    })

    it('mostra o seletor de filial ligado à sessão (todas as filiais)', async () => {
      const user = userEvent.setup()
      const selecionarFilial = vi.fn()
      renderizar({ acesso: admin(), filialSelecionada: 'todas', selecionarFilial })

      const seletor = within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })
      expect(seletor).toHaveValue('todas')
      expect(within(seletor).getByRole('option', { name: 'Todas as filiais' })).toBeInTheDocument()

      await user.selectOptions(seletor, '101')

      expect(selecionarFilial).toHaveBeenCalledWith('101')
    })

    it('usuário com uma única filial vê a filial fixa, sem seletor', () => {
      renderizar({
        acesso: acessoFalso({ perfil: 'preenchedor', todasAsFiliais: false, filiais: [FILIAIS[1]] }),
        filialSelecionada: FILIAIS[1],
      })

      const cabecalho = screen.getByRole('banner')
      expect(within(cabecalho).queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument()
      expect(within(cabecalho).getByText('101 - CAMPO GRANDE')).toBeInTheDocument()
    })
  })

  describe('abas', () => {
    it('tem uma navegação "Abas" com um link por aba visível, na ordem do protótipo (Admin vê todas)', () => {
      renderizar({ acesso: admin() })

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      const links = within(abas).getAllByRole('link')
      expect(links.map((link) => link.textContent)).toEqual(TODAS_AS_ABAS.map(([rotulo]) => rotulo))
      expect(links.map((link) => link.getAttribute('href'))).toEqual(TODAS_AS_ABAS.map(([, caminho]) => caminho))
    })

    it('marca a aba ativa pela URL com aria-current="page"', () => {
      renderizar({ acesso: admin() }, '/tipos')

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')
      expect(within(abas).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
      expect(within(abas).getByRole('link', { name: 'Apontamentos' })).not.toHaveAttribute('aria-current')
    })

    it('na raiz, somente "Início" fica ativa', () => {
      renderizar({ acesso: admin() }, '/')

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
      expect(within(abas).getByRole('link', { name: 'Tipos' })).not.toHaveAttribute('aria-current')
    })

    it('clicar em uma aba troca o conteúdo e a aba ativa', async () => {
      const user = userEvent.setup()
      renderizar({ acesso: admin() }, '/')

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      await user.click(within(abas).getByRole('link', { name: 'Tipos' }))

      expect(screen.getByText('Conteúdo de Tipos')).toBeInTheDocument()
      expect(screen.queryByText('Conteúdo do Início')).not.toBeInTheDocument()
      expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')
    })

    it('Preenchedor vê somente Início, Apontamentos, Dados Externos e Preenchimento', () => {
      renderizar({ acesso: acessoFalso({ perfil: 'preenchedor' }) })

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Início',
        'Apontamentos',
        'Dados Externos',
        'Preenchimento',
      ])
    })
  })

  it('renderiza o conteúdo da rota filha (Outlet) e o rodapé institucional', () => {
    renderizar({ acesso: admin() })

    expect(screen.getByText('Conteúdo do Início')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
    )
  })

  describe('sem acesso carregado (acesso === null)', () => {
    it('renderiza o cabeçalho sem seletor de filial, sem saudação e sem etiqueta de perfil, mantendo marca, "PED" e o botão Sair', () => {
      renderizar({ estado: 'carregando', acesso: null, filialSelecionada: null })

      const cabecalho = screen.getByRole('banner')
      expect(within(cabecalho).getByRole('img', { name: 'Comercial Mariano' })).toBeInTheDocument()
      expect(within(cabecalho).getByText('PED')).toBeInTheDocument()
      expect(within(cabecalho).queryByRole('combobox')).not.toBeInTheDocument()
      expect(within(cabecalho).queryByText('Todas as filiais')).not.toBeInTheDocument()
      expect(within(cabecalho).queryByText(/^Olá,/)).not.toBeInTheDocument()
      expect(within(cabecalho).queryByText('Admin')).not.toBeInTheDocument()
      expect(within(cabecalho).queryByText('Validador')).not.toBeInTheDocument()
      expect(within(cabecalho).queryByText('Preenchedor')).not.toBeInTheDocument()
      expect(within(cabecalho).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    })

    it('a navegação "Abas" existe, mas sem nenhum link', () => {
      renderizar({ estado: 'carregando', acesso: null, filialSelecionada: null })

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).queryAllByRole('link')).toHaveLength(0)
    })

    it('o botão Sair continua chamando sair() mesmo sem acesso', async () => {
      const user = userEvent.setup()
      const sair = vi.fn()
      renderizar({ estado: 'carregando', acesso: null, filialSelecionada: null, sair })

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))

      expect(sair).toHaveBeenCalledTimes(1)
    })

    it('ainda renderiza o conteúdo da rota filha e o rodapé', () => {
      renderizar({ estado: 'carregando', acesso: null, filialSelecionada: null })

      expect(screen.getByText('Conteúdo do Início')).toBeInTheDocument()
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })
  })
})
