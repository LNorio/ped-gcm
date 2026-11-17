import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../test/usuario'
import { Dialogo } from './Dialogo'
import { SelectPesquisavel, type OpcaoSelectPesquisavel, type SelectPesquisavelProps } from './SelectPesquisavel'

/**
 * F1.20 — SelectPesquisavel: lista de seleção com busca dentro do dropdown, reutilizável. Componente
 * controlado. Alteração de 17/11/2026: o gatilho deixa de ser um campo editável e passa a ser um
 * "select-only combobox" (WAI-ARIA); a pesquisa fica numa barra dentro da lista aberta.
 *
 * Interface (`src/components/SelectPesquisavel.tsx`):
 * - `export interface OpcaoSelectPesquisavel { valor: string; rotulo: string; descricao?: string; desabilitado?: boolean }`
 * - `export interface SelectPesquisavelProps { rotulo: string; opcoes: OpcaoSelectPesquisavel[]; valor: string | null;
 *   onSelecionar: (valor: string) => void; placeholder?: string; textoVazio?: string; rotuloBusca?: string;
 *   id?: string; className?: string }`
 * - `export function SelectPesquisavel(props: SelectPesquisavelProps)`
 *
 * Gatilho (fechado):
 * - `<button type="button">` com `role="combobox"`, nome acessível = rótulo visível (aria-labelledby),
 *   `aria-haspopup="listbox"`, `aria-expanded` e `aria-controls`; o `id` informado é o id do botão;
 * - mostra o rótulo da opção selecionada (ou o `placeholder`, sem seleção) e acompanha mudanças de `valor`;
 * - não aceita digitação: não há textbox nem searchbox com a lista fechada;
 * - abre com clique, Enter, Espaço, ↓ ou ↑; receber o foco (Tab) não abre.
 * Lista aberta:
 * - no topo, barra de pesquisa `<input type="search">` (role searchbox) com nome e placeholder = `rotuloBusca`
 *   (padrão "Pesquisar"), que recebe o foco ao abrir e começa vazia a cada abertura; tem `aria-controls` = id
 *   do listbox e `aria-activedescendant` = id da opção destacada;
 * - abaixo, o `role="listbox"` (nomeado pelo rótulo) com `role="option"` (rótulo + descrição, `aria-selected`,
 *   `aria-disabled`);
 * - digitar filtra pelo rótulo e pela descrição, sem acentos e maiúsculas, na ordem original; sem resultado,
 *   `textoVazio` (padrão "Nenhuma opção encontrada.");
 * - destaque: ao abrir, a selecionada (ou a primeira habilitada); ao digitar, a primeira habilitada do filtro;
 *   ↓/↑ pulam as desabilitadas;
 * - Enter seleciona a destacada, fecha e devolve o foco ao gatilho; clique numa opção idem; opção desabilitada
 *   não faz nada;
 * - Esc fecha sem selecionar, devolve o foco ao gatilho e não fecha o `Dialogo` em volta; Tab e clique fora
 *   fecham sem alterar.
 */

const OPCOES: OpcaoSelectPesquisavel[] = [
  { valor: '11', rotulo: 'Ana Souza', descricao: 'Gerente de Loja · 20,00% · 150,00' },
  { valor: '15', rotulo: 'Bruno Lima', descricao: 'Subgerente · 35,50% · 266,25' },
  { valor: '16', rotulo: 'Márcia Lopes', descricao: 'Gerente de Loja · 12,00% · 90,00' },
  { valor: '20', rotulo: 'José Prado', descricao: 'Vendedor', desabilitado: true },
  { valor: '21', rotulo: 'Carla Dias', descricao: 'Vendedora' },
]

type PropsTeste = Partial<SelectPesquisavelProps>

/** Uso controlado, como nas telas: guarda o valor escolhido e repassa a `onSelecionar`. */
function Controlado({ valorInicial = '11', onSelecionar, ...props }: PropsTeste & { valorInicial?: string | null }) {
  const [valor, setValor] = useState<string | null>(valorInicial)
  return (
    <>
      <SelectPesquisavel
        rotulo="Imagem"
        opcoes={OPCOES}
        {...props}
        valor={valor}
        onSelecionar={(novo) => {
          onSelecionar?.(novo)
          setValor(novo)
        }}
      />
      <button type="button">Fora</button>
    </>
  )
}

function renderizar(props: PropsTeste & { valorInicial?: string | null } = {}) {
  const user = usuarioRapido()
  const onSelecionar = vi.fn()
  render(<Controlado onSelecionar={onSelecionar} {...props} />)
  return { user, onSelecionar }
}

type Usuario = ReturnType<typeof usuarioRapido>

const gatilho = () => screen.getByRole('combobox', { name: 'Imagem' })
const busca = (nome = 'Pesquisar') => screen.getByRole('searchbox', { name: nome })
const lista = () => screen.getByRole('listbox')
const opcoes = () => within(lista()).getAllByRole('option')
const rotulos = () => opcoes().map((opcao) => opcao.textContent ?? '')
const opcao = (rotulo: string) => opcoes().find((item) => (item.textContent ?? '').includes(rotulo))!
const destacada = () => {
  const id = busca().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id) : null
}
const fechado = () => {
  expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
}

/** Abre pelo clique no gatilho e digita na barra de pesquisa. */
async function pesquisar(user: Usuario, texto: string) {
  await user.click(gatilho())
  await user.type(busca(), texto)
}

describe('F1.20 — SelectPesquisavel (select com barra de pesquisa dentro do dropdown)', () => {
  describe('gatilho fechado e acessibilidade', () => {
    it('é um botão combobox nomeado pelo rótulo visível, fechado, mostrando a opção selecionada', () => {
      renderizar()

      expect(screen.getByText('Imagem')).toBeVisible()
      expect(gatilho().tagName).toBe('BUTTON')
      expect(gatilho()).toHaveAttribute('type', 'button')
      expect(screen.getByLabelText('Imagem')).toBe(gatilho())
      expect(gatilho()).toHaveAttribute('aria-haspopup', 'listbox')
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('não é editável: não há campo de texto nem barra de pesquisa com a lista fechada', () => {
      renderizar()

      expect(document.querySelector('input')).toBeNull()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('digitar com o foco no gatilho não altera o texto exibido nem a seleção', async () => {
      const { user, onSelecionar } = renderizar()

      await user.tab()
      expect(gatilho()).toHaveFocus()
      await user.keyboard('zzz')

      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(gatilho()).not.toHaveTextContent('zzz')
      expect(onSelecionar).not.toHaveBeenCalled()
    })

    it('sem valor selecionado, mostra o placeholder', () => {
      renderizar({ valorInicial: null, placeholder: 'Escolha uma imagem' })

      expect(gatilho()).toHaveTextContent('Escolha uma imagem')
      for (const item of OPCOES) expect(gatilho()).not.toHaveTextContent(item.rotulo)
    })

    it('usa o id informado no botão', () => {
      renderizar({ id: 'imagem-previa' })

      expect(gatilho()).toHaveAttribute('id', 'imagem-previa')
    })

    it('mudar o valor por fora atualiza o texto exibido', () => {
      const onSelecionar = vi.fn()
      const { rerender } = render(
        <SelectPesquisavel rotulo="Imagem" opcoes={OPCOES} valor="11" onSelecionar={onSelecionar} placeholder="Escolha" />,
      )
      expect(gatilho()).toHaveTextContent('Ana Souza')

      rerender(<SelectPesquisavel rotulo="Imagem" opcoes={OPCOES} valor="16" onSelecionar={onSelecionar} placeholder="Escolha" />)
      expect(gatilho()).toHaveTextContent('Márcia Lopes')
      expect(gatilho()).not.toHaveTextContent('Ana Souza')

      rerender(<SelectPesquisavel rotulo="Imagem" opcoes={OPCOES} valor={null} onSelecionar={onSelecionar} placeholder="Escolha" />)
      expect(gatilho()).toHaveTextContent('Escolha')
      expect(gatilho()).not.toHaveTextContent('Márcia Lopes')
      expect(onSelecionar).not.toHaveBeenCalled()
    })
  })

  describe('abrir a lista', () => {
    it('ao clicar, abre a barra de pesquisa e a lista, com todas as opções na ordem e a descrição', async () => {
      const { user } = renderizar()

      await user.click(gatilho())

      expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
      expect(lista().id).not.toBe('')
      // aria-controls do gatilho aponta para a lista ou para o painel que a contém.
      const controlado = document.getElementById(gatilho().getAttribute('aria-controls') ?? '')
      expect(controlado).not.toBeNull()
      expect(controlado === lista() || controlado!.contains(lista())).toBe(true)
      // O listbox também é nomeado pelo rótulo.
      expect(screen.getByRole('listbox', { name: 'Imagem' })).toBe(lista())
      expect(opcoes()).toHaveLength(5)
      expect(rotulos().map((texto) => OPCOES.find((o) => texto.includes(o.rotulo))?.valor)).toEqual(['11', '15', '16', '20', '21'])
      expect(opcao('Bruno Lima')).toHaveTextContent('Subgerente · 35,50% · 266,25')
    })

    it.each([
      ['Enter', '{Enter}'],
      ['Espaço', ' '],
      ['↓', '{ArrowDown}'],
      ['↑', '{ArrowUp}'],
    ])('com o foco no gatilho, %s abre a lista', async (_nome, tecla) => {
      const { user, onSelecionar } = renderizar()

      await user.tab()
      await user.keyboard(tecla)

      expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
      expect(lista()).toBeInTheDocument()
      expect(busca()).toHaveFocus()
      expect(onSelecionar).not.toHaveBeenCalled()
    })

    it('receber o foco pelo Tab não abre a lista', async () => {
      const { user } = renderizar()

      await user.tab()

      expect(gatilho()).toHaveFocus()
      fechado()
    })

    it('a barra de pesquisa fica no topo da lista aberta, recebe o foco e usa "Pesquisar" como nome e placeholder', async () => {
      const { user } = renderizar()

      await user.click(gatilho())

      expect(busca()).toHaveFocus()
      expect(busca()).toHaveAttribute('type', 'search')
      expect(busca()).toHaveAttribute('placeholder', 'Pesquisar')
      expect(busca()).toHaveValue('')
      expect(busca()).toHaveAttribute('aria-controls', lista().id)
      // A barra vem antes da lista no documento.
      expect(busca().compareDocumentPosition(lista()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('rotuloBusca define o nome e o placeholder da barra de pesquisa', async () => {
      const { user } = renderizar({ rotuloBusca: 'Buscar colaborador ou cargo' })

      await user.click(gatilho())

      expect(busca('Buscar colaborador ou cargo')).toHaveFocus()
      expect(busca('Buscar colaborador ou cargo')).toHaveAttribute('placeholder', 'Buscar colaborador ou cargo')
      expect(screen.queryByRole('searchbox', { name: 'Pesquisar' })).not.toBeInTheDocument()
    })

    it('a barra de pesquisa começa vazia toda vez que a lista abre', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'bru')
      await user.keyboard('{Escape}')
      await user.click(gatilho())

      expect(busca()).toHaveValue('')
      expect(opcoes()).toHaveLength(5)
    })

    it('marca a opção selecionada com aria-selected e as desabilitadas com aria-disabled', async () => {
      const { user } = renderizar({ valorInicial: '15' })

      await user.click(gatilho())

      expect(opcao('Bruno Lima')).toHaveAttribute('aria-selected', 'true')
      for (const rotulo of ['Ana Souza', 'Márcia Lopes', 'Carla Dias']) {
        expect(opcao(rotulo)).not.toHaveAttribute('aria-selected', 'true')
      }
      expect(opcao('José Prado')).toHaveAttribute('aria-disabled', 'true')
    })

    it('ao abrir, destaca a opção selecionada (aria-activedescendant da barra de pesquisa)', async () => {
      const { user } = renderizar({ valorInicial: '16' })

      await user.click(gatilho())

      expect(destacada()).toBe(opcao('Márcia Lopes'))
    })

    it('sem seleção, destaca a primeira opção habilitada', async () => {
      const { user } = renderizar({ valorInicial: null })

      await user.click(gatilho())

      expect(destacada()).toBe(opcao('Ana Souza'))
    })
  })

  describe('pesquisa na barra do dropdown', () => {
    it('digitar filtra pelo rótulo, sem diferenciar acentos e maiúsculas', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'MARCIA')

      expect(rotulos()).toHaveLength(1)
      expect(opcao('Márcia Lopes')).toBeInTheDocument()
    })

    it('digitar filtra pela descrição', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'subgerente')

      expect(rotulos()).toHaveLength(1)
      expect(opcao('Bruno Lima')).toBeInTheDocument()
    })

    it('a busca pela descrição traz todas as opções que combinam, na ordem original', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'gerente de loja')

      expect(rotulos()).toHaveLength(2)
      expect(rotulos()[0]).toContain('Ana Souza')
      expect(rotulos()[1]).toContain('Márcia Lopes')
    })

    it('ao digitar, destaca a primeira opção habilitada do filtro', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'vend')

      // "José Prado" (desabilitado) vem antes de "Carla Dias" no filtro.
      expect(rotulos()).toHaveLength(2)
      expect(destacada()).toBe(opcao('Carla Dias'))
    })

    it('digitar na barra não altera o texto do gatilho nem a seleção', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'bru')

      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(onSelecionar).not.toHaveBeenCalled()
    })

    it('sem resultado, mostra o texto padrão "Nenhuma opção encontrada."', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'zzz')

      expect(screen.queryAllByRole('option')).toHaveLength(0)
      expect(screen.getByText('Nenhuma opção encontrada.')).toBeInTheDocument()
      // A barra continua disponível para corrigir a busca.
      expect(busca()).toHaveValue('zzz')
    })

    it('sem resultado, mostra o textoVazio informado', async () => {
      const { user } = renderizar({ textoVazio: 'Nenhum colaborador encontrado.' })

      await pesquisar(user, 'zzz')

      expect(screen.getByText('Nenhum colaborador encontrado.')).toBeInTheDocument()
      expect(screen.queryByText('Nenhuma opção encontrada.')).not.toBeInTheDocument()
    })

    it('apagar a busca devolve todas as opções', async () => {
      const { user } = renderizar()

      await pesquisar(user, 'zzz')
      await user.clear(busca())

      expect(opcoes()).toHaveLength(5)
    })
  })

  describe('teclado na barra de pesquisa', () => {
    it('↓ e ↑ movem o destaque, pulando as opções desabilitadas', async () => {
      const { user } = renderizar({ valorInicial: '16' })

      await user.click(gatilho())
      expect(destacada()).toBe(opcao('Márcia Lopes'))

      await user.keyboard('{ArrowDown}')
      expect(destacada()).toBe(opcao('Carla Dias'))

      await user.keyboard('{ArrowUp}')
      expect(destacada()).toBe(opcao('Márcia Lopes'))

      await user.keyboard('{ArrowUp}')
      expect(destacada()).toBe(opcao('Bruno Lima'))
      expect(busca()).toHaveFocus()
    })

    it('Enter seleciona a destacada, chama onSelecionar com o valor, fecha e devolve o foco ao gatilho', async () => {
      const { user, onSelecionar } = renderizar()

      await user.click(gatilho())
      await user.keyboard('{ArrowDown}{Enter}')

      expect(onSelecionar).toHaveBeenCalledTimes(1)
      expect(onSelecionar).toHaveBeenCalledWith('15')
      fechado()
      expect(gatilho()).toHaveTextContent('Bruno Lima')
      expect(gatilho()).toHaveFocus()
    })

    it('Enter depois de filtrar seleciona a primeira opção encontrada', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'marcia{Enter}')

      expect(onSelecionar).toHaveBeenCalledTimes(1)
      expect(onSelecionar).toHaveBeenCalledWith('16')
      expect(gatilho()).toHaveTextContent('Márcia Lopes')
    })

    it('Esc fecha a lista sem alterar a seleção e devolve o foco ao gatilho', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'bru')
      await user.keyboard('{Escape}')

      fechado()
      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(gatilho()).toHaveFocus()
      expect(onSelecionar).not.toHaveBeenCalled()
    })

    it('Esc com a lista aberta dentro de um Dialogo fecha só a lista, não o diálogo', async () => {
      const user = usuarioRapido()
      const onFechar = vi.fn()
      render(
        <Dialogo aberto titulo="Pré-visualização" onFechar={onFechar}>
          <SelectPesquisavel rotulo="Imagem" opcoes={OPCOES} valor="11" onSelecionar={vi.fn()} />
        </Dialogo>,
      )
      const dialogo = screen.getByRole('dialog', { name: 'Pré-visualização' })
      const gatilhoNoDialogo = within(dialogo).getByRole('combobox', { name: 'Imagem' })

      await user.click(gatilhoNoDialogo)
      expect(within(dialogo).getByRole('listbox')).toBeInTheDocument()
      expect(within(dialogo).getByRole('searchbox', { name: 'Pesquisar' })).toHaveFocus()
      await user.keyboard('{Escape}')

      expect(within(dialogo).queryByRole('listbox')).not.toBeInTheDocument()
      expect(onFechar).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Pré-visualização' })).toBeInTheDocument()
      expect(gatilhoNoDialogo).toHaveFocus()
    })

    it('Tab fecha a lista sem alterar a seleção', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'car')
      await user.tab()

      fechado()
      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(onSelecionar).not.toHaveBeenCalled()
    })
  })

  describe('mouse', () => {
    it('clicar numa opção seleciona, chama onSelecionar, fecha e devolve o foco ao gatilho', async () => {
      const { user, onSelecionar } = renderizar()

      await user.click(gatilho())
      await user.click(opcao('Carla Dias'))

      expect(onSelecionar).toHaveBeenCalledTimes(1)
      expect(onSelecionar).toHaveBeenCalledWith('21')
      fechado()
      expect(gatilho()).toHaveTextContent('Carla Dias')
      expect(gatilho()).toHaveFocus()
    })

    it('clicar numa opção filtrada pela pesquisa seleciona aquela opção', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'lima')
      await user.click(opcao('Bruno Lima'))

      expect(onSelecionar).toHaveBeenCalledWith('15')
      expect(gatilho()).toHaveTextContent('Bruno Lima')
    })

    it('clicar numa opção desabilitada não faz nada (a lista continua aberta)', async () => {
      const { user, onSelecionar } = renderizar()

      await user.click(gatilho())
      await user.click(opcao('José Prado'))

      expect(onSelecionar).not.toHaveBeenCalled()
      expect(lista()).toBeInTheDocument()
      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(gatilho()).not.toHaveTextContent('José Prado')
    })

    it('clicar fora fecha a lista sem alterar a seleção', async () => {
      const { user, onSelecionar } = renderizar()

      await pesquisar(user, 'zzz')
      await user.click(screen.getByRole('button', { name: 'Fora' }))

      fechado()
      expect(gatilho()).toHaveTextContent('Ana Souza')
      expect(onSelecionar).not.toHaveBeenCalled()
    })
  })
})
