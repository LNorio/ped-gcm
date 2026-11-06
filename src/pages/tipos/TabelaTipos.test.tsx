import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes } from '../../test/menuAcoes'
import {
  NOMES_TIPOS_FIXOS,
  TIPOS_FIXOS_API,
  TIPO_LOGISTICA_API,
  TIPO_MARKETING_API,
  rotuloAcoesTipo,
  tipoDominio,
  tiposDominio,
} from '../../test/tiposFalsos'
import type { TipoApontamento } from '../../types/dominio'
import { TabelaTipos, type TabelaTiposProps } from './TabelaTipos'

const TIPOS: TipoApontamento[] = tiposDominio()
const LOGISTICA = tipoDominio(TIPO_LOGISTICA_API)
const MARKETING = tipoDominio(TIPO_MARKETING_API)

/** Índices das colunas: Nome, Origem, Grupos vinculados, Apontamentos, Ações. */
const COL = { nome: 0, origem: 1, grupos: 2, apontamentos: 3, acoes: 4 } as const

describe('F3.2 — TabelaTipos (tabela da listagem de tipos)', () => {
  function renderizar(props: Partial<TabelaTiposProps> = {}) {
    const onEditar = props.onEditar ?? vi.fn<(tipo: TipoApontamento) => void>()
    const onExcluir = props.onExcluir ?? vi.fn<(tipo: TipoApontamento) => void>()
    render(
      <TabelaTipos
        tipos={props.tipos ?? TIPOS}
        podeEditar={props.podeEditar ?? true}
        podeExcluir={props.podeExcluir ?? true}
        onEditar={onEditar}
        onExcluir={onExcluir}
        textoVazio={props.textoVazio}
      />,
    )
    return { onEditar, onExcluir }
  }

  function tabela() {
    return screen.getByRole('table', { name: 'Tipos de apontamento' })
  }

  function linhasDeDados() {
    return within(tabela()).getAllByRole('row').slice(1)
  }

  function linhaDoTipo(nome: string): HTMLElement {
    const linha = screen.getByRole('cell', { name: nome }).closest('tr')
    if (!linha) throw new Error(`Linha do tipo "${nome}" não encontrada`)
    return linha
  }

  function celula(nome: string, coluna: number): HTMLElement {
    return within(linhaDoTipo(nome)).getAllByRole('cell')[coluna]
  }

  it('renderiza a tabela "Tipos de apontamento" com as colunas Nome, Origem, Grupos vinculados, Apontamentos e Ações', () => {
    renderizar()

    expect(within(tabela()).getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual([
      'Nome',
      'Origem',
      'Grupos vinculados',
      'Apontamentos',
      'Ações',
    ])
  })

  it('lista os tipos recebidos na ordem informada', () => {
    renderizar()

    expect(linhasDeDados()).toHaveLength(9)
    expect(linhasDeDados().map((linha) => within(linha).getAllByRole('cell')[COL.nome].textContent)).toEqual([
      ...NOMES_TIPOS_FIXOS,
      'Logística',
      'Marketing',
    ])
  })

  it('mostra a origem como etiqueta: Fixo em tom neutro e Personalizado em tom de informação', () => {
    renderizar()

    expect(within(linhaDoTipo('Comercial')).getByText('Fixo')).toHaveClass('etiqueta', 'etiqueta--neutro')
    expect(within(linhaDoTipo('Logística')).getByText('Personalizado')).toHaveClass('etiqueta', 'etiqueta--info')
  })

  it('mostra a quantidade de apontamentos de cada tipo, inclusive zero', () => {
    renderizar()

    expect(celula('Comercial', COL.apontamentos)).toHaveTextContent(/^7$/)
    expect(celula('Recursos Humanos', COL.apontamentos)).toHaveTextContent(/^0$/)
    expect(celula('Marketing', COL.apontamentos)).toHaveTextContent(/^3$/)
  })

  describe('coluna "Grupos vinculados" (RF-12)', () => {
    it('mostra cada grupo vinculado em uma etiqueta, na ordem da API', () => {
      renderizar()

      const grupos = within(celula('Comercial', COL.grupos)).getAllByText(/^DEF_/)
      expect(grupos.map((grupo) => grupo.textContent)).toEqual(['DEF_OPERADOR DE CAIXA', 'DEF_GERENTE DE LOJA'])
      for (const grupo of grupos) expect(grupo).toHaveClass('etiqueta')
      expect(within(celula('Logística', COL.grupos)).getByText('DEF_SUPERVISÃO LOGÍSTICA')).toHaveClass('etiqueta')
    })

    it('com usuários vinculados diretamente, mostra a quantidade: "1 usuário vinculado" ou "{n} usuários vinculados"', () => {
      renderizar()

      expect(celula('Comercial', COL.grupos)).toHaveTextContent('1 usuário vinculado')
      expect(celula('Tecnologia da Informação', COL.grupos)).toHaveTextContent('2 usuários vinculados')
      expect(celula('Financeiro', COL.grupos)).not.toHaveTextContent(/usuário/)
    })

    it('tipo só com usuários (sem grupos) mostra a quantidade de usuários e não "Nenhum grupo"', () => {
      renderizar()

      expect(celula('Tecnologia da Informação', COL.grupos)).toHaveTextContent(/^2 usuários vinculados$/)
    })

    it('sem grupos nem usuários mostra "Nenhum grupo"', () => {
      renderizar()

      expect(celula('Recursos Humanos', COL.grupos)).toHaveTextContent(/^Nenhum grupo$/)
      expect(celula('Processos', COL.grupos)).toHaveTextContent(/^Nenhum grupo$/)
    })

    it('grupos e usuários null (visão sem vínculos) também mostram "Nenhum grupo"', () => {
      renderizar({ tipos: [{ ...tipoDominio(TIPOS_FIXOS_API[0]), grupos: null, usuarios: null }] })

      expect(celula('Comercial', COL.grupos)).toHaveTextContent(/^Nenhum grupo$/)
    })
  })

  describe('menu de ações "Ações do tipo {nome}"', () => {
    it('personalizados: "Editar grupos" e "Excluir", nessa ordem', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Logística'))).toEqual(['Editar grupos', 'Excluir'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Marketing'))).toEqual(['Editar grupos', 'Excluir'])
    })

    it('fixos: só "Editar grupos" (os sete fixos nunca podem ser excluídos)', async () => {
      const user = usuarioRapido()
      renderizar()

      for (const nome of NOMES_TIPOS_FIXOS) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesTipo(nome))).toEqual(['Editar grupos'])
      }
    })

    it('"Excluir" é o item de perigo; "Editar grupos" não', async () => {
      const user = usuarioRapido()
      renderizar()

      const menu = await abrirMenuAcoes(user, rotuloAcoesTipo('Logística'))
      expect(within(menu).getByRole('menuitem', { name: 'Excluir' })).toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Editar grupos' })).not.toHaveClass('menu-acoes__item--perigo')
    })

    it('há um menu por linha, dentro da célula Ações', () => {
      renderizar()

      for (const tipo of TIPOS) {
        expect(within(celula(tipo.nome, COL.acoes)).getByRole('button', { name: rotuloAcoesTipo(tipo.nome) })).toBeInTheDocument()
      }
    })

    it('"Editar grupos" chama onEditar com o tipo da linha (fixo ou personalizado)', async () => {
      const user = usuarioRapido()
      const { onEditar, onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesTipo('Comercial'), 'Editar grupos')
      expect(onEditar).toHaveBeenCalledTimes(1)
      expect(onEditar).toHaveBeenLastCalledWith(TIPOS[0])

      await escolherAcao(user, rotuloAcoesTipo('Marketing'), 'Editar grupos')
      expect(onEditar).toHaveBeenCalledTimes(2)
      expect(onEditar).toHaveBeenLastCalledWith(MARKETING)
      expect(onExcluir).not.toHaveBeenCalled()
    })

    it('"Excluir" chama onExcluir com o tipo da linha clicada (não o primeiro personalizado)', async () => {
      const user = usuarioRapido()
      const { onEditar, onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesTipo('Logística'), 'Excluir')
      expect(onExcluir).toHaveBeenCalledTimes(1)
      expect(onExcluir).toHaveBeenLastCalledWith(LOGISTICA)

      await escolherAcao(user, rotuloAcoesTipo('Marketing'), 'Excluir')
      expect(onExcluir).toHaveBeenCalledTimes(2)
      expect(onExcluir.mock.calls[1][0]).toBe(TIPOS[8])
      expect(onEditar).not.toHaveBeenCalled()
    })

    it('sem permissão de editar: fixos ficam sem menu e personalizados só com "Excluir"', async () => {
      const user = usuarioRapido()
      renderizar({ podeEditar: false })

      for (const nome of NOMES_TIPOS_FIXOS) {
        expect(screen.queryByRole('button', { name: rotuloAcoesTipo(nome) })).not.toBeInTheDocument()
      }
      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Logística'))).toEqual(['Excluir'])
    })

    it('sem permissão de excluir: personalizados só com "Editar grupos"', async () => {
      const user = usuarioRapido()
      renderizar({ podeExcluir: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesTipo('Logística'))).toEqual(['Editar grupos'])
    })

    it('sem nenhuma permissão: nenhum menu; a célula Ações mostra "—" escondido de leitores de tela e "Sem ações" só para eles', () => {
      renderizar({ podeEditar: false, podeExcluir: false })

      expect(screen.queryByRole('button', { name: /^Ações do tipo / })).not.toBeInTheDocument()
      for (const tipo of TIPOS) {
        const acoes = celula(tipo.nome, COL.acoes)
        expect(within(acoes).getByText('—')).toHaveAttribute('aria-hidden', 'true')
        const semAcoes = within(acoes).getByText('Sem ações')
        expect(semAcoes).toHaveClass('visualmente-oculto')
        expect(semAcoes).not.toHaveAttribute('aria-hidden')
      }
    })

    it('linhas com menu não têm o texto "Sem ações" nem o travessão', () => {
      renderizar()

      for (const tipo of TIPOS) {
        expect(within(celula(tipo.nome, COL.acoes)).queryByText('Sem ações')).not.toBeInTheDocument()
        expect(within(celula(tipo.nome, COL.acoes)).queryByText('—')).not.toBeInTheDocument()
      }
    })
  })

  it('lista vazia exibe o textoVazio informado e nenhum menu', () => {
    renderizar({ tipos: [], textoVazio: 'Nenhum tipo cadastrado.' })

    expect(within(tabela()).getByText('Nenhum tipo cadastrado.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('textoVazio é usado só quando a lista está vazia', () => {
    renderizar({ tipos: [LOGISTICA], textoVazio: 'Nenhum tipo encontrado para os filtros.' })

    expect(screen.queryByText('Nenhum tipo encontrado para os filtros.')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
  })

  it('aceita só os personalizados (lista filtrada) e mantém um menu por linha', () => {
    renderizar({ tipos: [LOGISTICA, MARKETING] })

    expect(linhasDeDados()).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Ações do tipo / })).toHaveLength(2)
    expect(screen.queryByText('Sem ações')).not.toBeInTheDocument()
  })
})
