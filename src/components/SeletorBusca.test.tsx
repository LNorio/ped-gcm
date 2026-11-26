import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialogo } from './Dialogo'
import { usuarioRapido } from '../test/usuario'
import { SeletorBusca, type AcaoSeletor, type OpcaoSeletor, type SeletorBuscaProps } from './SeletorBusca'

const OPCOES: OpcaoSeletor[] = [
  { id: '1', nome: 'Cobertura de visitas', subtexto: '100% · ainda não usado' },
  { id: '2', nome: 'Faturamento líquido mensal', subtexto: 'R$ 1.000,00' },
  { id: '3', nome: 'Vendas por zona', subtexto: 'Indisponível: dado externo por zona', desabilitada: true },
]

/**
 * F7.5 (alteração de 18/11/2026) — o SeletorBusca, dropdown com busca do formulário de dashboard
 * (indicadores e itens do vínculo) e dos vínculos de tipo, fecha como qualquer lista suspensa:
 * clique fora do componente (botão + painel) e Esc fecham o painel. Interface: nova prop opcional
 * `onFechar?: () => void`; sem ela, o componente usa `onAlternar` (só quando está aberto).
 */
describe('F7.5 — SeletorBusca: fechar ao clicar fora e com Esc (alteração de 18/11/2026)', () => {
  interface Opcoes {
    /** Sem `onFechar`: o componente deve usar `onAlternar` para fechar. */
    semOnFechar?: boolean
    abertoInicial?: boolean
    acaoInicial?: AcaoSeletor | null
    mensagemVazia?: string | null
    extras?: Partial<SeletorBuscaProps>
  }

  function criarEspioes() {
    return {
      onAlternar: vi.fn<() => void>(),
      onFechar: vi.fn<() => void>(),
      onEscolher: vi.fn<(id: string) => void>(),
    }
  }

  type Espioes = ReturnType<typeof criarEspioes>

  /** Controla `aberto` como as seções do formulário fazem e registra cada chamada. */
  function Controlado({ espioes, semOnFechar = false, abertoInicial = false, acaoInicial = null, mensagemVazia = null, extras = {} }: Opcoes & { espioes: Espioes }) {
    const [aberto, setAberto] = useState(abertoInicial)
    const [busca, setBusca] = useState('')
    return (
      <div>
        <p>Texto fora do dropdown</p>
        <button type="button">Outro botão</button>
        <SeletorBusca
          textoBotao="Selecionar indicador"
          aberto={aberto}
          onAlternar={() => {
            espioes.onAlternar()
            setAberto((atual) => !atual)
          }}
          onFechar={
            semOnFechar
              ? undefined
              : () => {
                  espioes.onFechar()
                  setAberto(false)
                }
          }
          rotuloBusca="Buscar indicador"
          busca={busca}
          onBusca={setBusca}
          rotuloLista="Indicadores"
          opcoes={OPCOES}
          acaoInicial={acaoInicial}
          mensagemVazia={mensagemVazia}
          onEscolher={espioes.onEscolher}
          {...extras}
        />
      </div>
    )
  }

  function renderizar(opcoes: Opcoes = {}) {
    const espioes = criarEspioes()
    render(<Controlado {...opcoes} espioes={espioes} />)
    return espioes
  }

  const botao = () => screen.getByRole('button', { name: 'Selecionar indicador' })
  const lista = () => screen.getByRole('listbox', { name: 'Indicadores' })
  const listaAusente = () => expect(screen.queryByRole('listbox', { name: 'Indicadores' })).not.toBeInTheDocument()
  const opcao = (nome: string) => within(lista()).getByRole('option', { name: (texto) => texto.startsWith(nome) })
  const busca = () => screen.getByRole('searchbox', { name: 'Buscar indicador' })

  describe('clique fora', () => {
    it('com o painel aberto, clicar fora do componente fecha o painel chamando onFechar (e não onAlternar)', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())
      expect(lista()).toBeInTheDocument()
      espioes.onAlternar.mockClear()

      await user.click(screen.getByText('Texto fora do dropdown'))

      listaAusente()
      expect(botao()).toHaveAttribute('aria-expanded', 'false')
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
      expect(espioes.onAlternar).not.toHaveBeenCalled()
    })

    it('clicar em outro controle fora do componente também fecha o painel', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(screen.getByRole('button', { name: 'Outro botão' }))

      listaAusente()
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
    })

    it('com o painel fechado, clicar fora não chama onFechar nem onAlternar', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()

      await user.click(screen.getByText('Texto fora do dropdown'))

      expect(espioes.onFechar).not.toHaveBeenCalled()
      expect(espioes.onAlternar).not.toHaveBeenCalled()
    })

    it('sem onFechar, clicar fora com o painel aberto fecha chamando onAlternar uma vez', async () => {
      const user = usuarioRapido()
      const espioes = renderizar({ semOnFechar: true })
      await user.click(botao())
      expect(espioes.onAlternar).toHaveBeenCalledTimes(1)

      await user.click(screen.getByText('Texto fora do dropdown'))

      listaAusente()
      expect(espioes.onAlternar).toHaveBeenCalledTimes(2)
    })

    it('sem onFechar e com o painel fechado, clicar fora não chama onAlternar (não reabre)', async () => {
      const user = usuarioRapido()
      const espioes = renderizar({ semOnFechar: true })

      await user.click(screen.getByText('Texto fora do dropdown'))

      expect(espioes.onAlternar).not.toHaveBeenCalled()
      listaAusente()
    })

    it('clicar no próprio botão com o painel aberto fecha só pelo onAlternar (sem onFechar antes)', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(botao())

      listaAusente()
      expect(espioes.onAlternar).toHaveBeenCalledTimes(2)
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })
  })

  describe('cliques dentro do painel não fecham', () => {
    it('clicar e digitar na busca mantém o painel aberto', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(busca())
      await user.type(busca(), 'fat')

      expect(lista()).toBeInTheDocument()
      expect(busca()).toHaveValue('fat')
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })

    it('clicar na área da lista (fora das opções, ex.: rolagem) mantém o painel aberto', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(lista())

      expect(lista()).toBeInTheDocument()
      expect(espioes.onFechar).not.toHaveBeenCalled()
      expect(espioes.onAlternar).toHaveBeenCalledTimes(1)
    })

    it('clicar na mensagem do painel mantém o painel aberto', async () => {
      const user = usuarioRapido()
      const espioes = renderizar({ mensagemVazia: 'Todos os indicadores já foram adicionados.' })
      await user.click(botao())

      await user.click(screen.getByText('Todos os indicadores já foram adicionados.'))

      expect(lista()).toBeInTheDocument()
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })

    it('escolher uma opção chama onEscolher e mantém o painel aberto (comportamento atual, para escolher outros itens)', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(opcao('Faturamento líquido mensal'))

      expect(espioes.onEscolher).toHaveBeenCalledWith('2')
      expect(lista()).toBeInTheDocument()
      expect(espioes.onFechar).not.toHaveBeenCalled()
      expect(espioes.onAlternar).toHaveBeenCalledTimes(1)
    })

    it('clicar numa opção desabilitada não escolhe nem fecha', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())

      await user.click(opcao('Vendas por zona'))

      expect(espioes.onEscolher).not.toHaveBeenCalled()
      expect(lista()).toBeInTheDocument()
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })

    it('a opção de ação chama a própria ação, sem onFechar do clique fora', async () => {
      const user = usuarioRapido()
      const acao = vi.fn<() => void>()
      const espioes = renderizar({ acaoInicial: { nome: 'Selecionar todas as filiais (4)', onEscolher: acao } })
      await user.click(botao())

      await user.click(opcao('Selecionar todas as filiais (4)'))

      expect(acao).toHaveBeenCalledTimes(1)
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })
  })

  describe('Esc', () => {
    it('Esc na busca fecha o painel pelo onFechar e devolve o foco ao botão', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())
      await user.click(busca())

      await user.keyboard('{Escape}')

      listaAusente()
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
      expect(botao()).toHaveFocus()
    })

    it('Esc com o foco no botão e o painel aberto fecha o painel', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())
      expect(botao()).toHaveFocus()

      await user.keyboard('{Escape}')

      listaAusente()
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
      expect(botao()).toHaveFocus()
    })

    it('Esc com o foco numa opção fecha o painel e devolve o foco ao botão', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())
      opcao('Cobertura de visitas').focus()

      await user.keyboard('{Escape}')

      listaAusente()
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
      expect(botao()).toHaveFocus()
    })

    it('sem onFechar, Esc com o painel aberto fecha chamando onAlternar', async () => {
      const user = usuarioRapido()
      const espioes = renderizar({ semOnFechar: true })
      await user.click(botao())
      await user.click(busca())

      await user.keyboard('{Escape}')

      listaAusente()
      expect(espioes.onAlternar).toHaveBeenCalledTimes(2)
      expect(botao()).toHaveFocus()
    })

    it('Esc com o painel fechado não chama onFechar nem onAlternar', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      botao().focus()

      await user.keyboard('{Escape}')

      expect(espioes.onFechar).not.toHaveBeenCalled()
      expect(espioes.onAlternar).not.toHaveBeenCalled()
    })

    it('dentro de um Dialogo, o Esc com o painel aberto fecha só o painel; com ele fechado, o Esc fecha o diálogo', async () => {
      const user = usuarioRapido()
      const espioes = criarEspioes()
      const fecharDialogo = vi.fn<() => void>()
      render(
        <Dialogo aberto titulo="Novo dashboard" onFechar={fecharDialogo}>
          <Controlado espioes={espioes} />
        </Dialogo>,
      )
      await user.click(botao())
      await user.click(busca())

      await user.keyboard('{Escape}')

      listaAusente()
      expect(fecharDialogo).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()

      await user.keyboard('{Escape}')

      expect(fecharDialogo).toHaveBeenCalledTimes(1)
    })

    it('dentro de um Dialogo, clicar fora do componente (no título do diálogo) fecha o painel sem fechar o diálogo', async () => {
      const user = usuarioRapido()
      const espioes = criarEspioes()
      const fecharDialogo = vi.fn<() => void>()
      render(
        <Dialogo aberto titulo="Novo dashboard" onFechar={fecharDialogo}>
          <Controlado espioes={espioes} />
        </Dialogo>,
      )
      await user.click(botao())

      await user.click(screen.getByRole('heading', { name: 'Novo dashboard' }))

      listaAusente()
      expect(espioes.onFechar).toHaveBeenCalledTimes(1)
      expect(fecharDialogo).not.toHaveBeenCalled()
    })
  })

  describe('sem mudanças no restante', () => {
    it('o botão alterna o painel por onAlternar, com aria-expanded', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()

      expect(botao()).toHaveAttribute('aria-expanded', 'false')
      await user.click(botao())
      expect(botao()).toHaveAttribute('aria-expanded', 'true')
      expect(espioes.onAlternar).toHaveBeenCalledTimes(1)
    })

    it('Enter numa opção focada a escolhe e o painel continua aberto', async () => {
      const user = usuarioRapido()
      const espioes = renderizar()
      await user.click(botao())
      opcao('Cobertura de visitas').focus()

      await user.keyboard('{Enter}')

      expect(espioes.onEscolher).toHaveBeenCalledWith('1')
      expect(lista()).toBeInTheDocument()
      expect(espioes.onFechar).not.toHaveBeenCalled()
    })
  })
})

/**
 * F1.18 (refatoração sugerida pela revisão de qualidade de 06/11/2026) — o SeletorBusca passa a ficar
 * em src/components/ e corrige o defeito do Enter: dentro de um <form>, Enter na busca do dropdown
 * disparava o envio implícito do formulário (gravando sem querer). A correção já existia só em Tipos
 * (SecaoVinculosTipo); agora vale para todo uso do componente, inclusive os dashboards.
 */
describe('F7.5 — SeletorBusca: Enter na busca não envia o formulário (F1.18)', () => {
  function criarEspioes() {
    return {
      onEnviar: vi.fn<() => void>(),
      onEscolher: vi.fn<(id: string) => void>(),
    }
  }

  type Espioes = ReturnType<typeof criarEspioes>

  /** Formulário com um campo de texto comum, o seletor (com busca) e o botão de envio. */
  function FormularioComSeletor({ espioes }: { espioes: Espioes }) {
    const [aberto, setAberto] = useState(false)
    const [busca, setBusca] = useState('')
    return (
      <form
        aria-label="Formulário de teste"
        onSubmit={(evento) => {
          evento.preventDefault()
          espioes.onEnviar()
        }}
      >
        <label>
          Nome
          <input type="text" name="nome" />
        </label>
        <SeletorBusca
          textoBotao="Selecionar indicador"
          aberto={aberto}
          onAlternar={() => setAberto((atual) => !atual)}
          onFechar={() => setAberto(false)}
          rotuloBusca="Buscar indicador"
          busca={busca}
          onBusca={setBusca}
          rotuloLista="Indicadores"
          opcoes={OPCOES}
          mensagemVazia={null}
          onEscolher={espioes.onEscolher}
        />
        <button type="submit">Salvar</button>
      </form>
    )
  }

  function renderizar() {
    const espioes = criarEspioes()
    render(<FormularioComSeletor espioes={espioes} />)
    return espioes
  }

  const botao = () => screen.getByRole('button', { name: 'Selecionar indicador' })
  const busca = () => screen.getByRole('searchbox', { name: 'Buscar indicador' })
  const lista = () => screen.getByRole('listbox', { name: 'Indicadores' })
  const opcao = (nome: string) => within(lista()).getByRole('option', { name: (texto) => texto.startsWith(nome) })

  it('Enter na busca (com texto) não envia o formulário em volta', async () => {
    const user = usuarioRapido()
    const espioes = renderizar()
    await user.click(botao())

    await user.type(busca(), 'fat{Enter}')

    expect(espioes.onEnviar).not.toHaveBeenCalled()
    expect(busca()).toHaveValue('fat')
  })

  it('Enter na busca vazia também não envia o formulário', async () => {
    const user = usuarioRapido()
    const espioes = renderizar()
    await user.click(botao())
    await user.click(busca())

    await user.keyboard('{Enter}')

    expect(espioes.onEnviar).not.toHaveBeenCalled()
  })

  it('Enter numa opção focada escolhe a opção sem enviar o formulário', async () => {
    const user = usuarioRapido()
    const espioes = renderizar()
    await user.click(botao())
    opcao('Cobertura de visitas').focus()

    await user.keyboard('{Enter}')

    expect(espioes.onEscolher).toHaveBeenCalledWith('1')
    expect(espioes.onEnviar).not.toHaveBeenCalled()
  })

  it('Enter num campo de texto do formulário, fora do seletor, continua enviando', async () => {
    const user = usuarioRapido()
    const espioes = renderizar()

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'PED{Enter}')

    expect(espioes.onEnviar).toHaveBeenCalledTimes(1)
  })

  it('depois do Enter na busca, o botão de envio continua enviando normalmente', async () => {
    const user = usuarioRapido()
    const espioes = renderizar()
    await user.click(botao())
    await user.type(busca(), 'fat{Enter}')
    expect(espioes.onEnviar).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(espioes.onEnviar).toHaveBeenCalledTimes(1)
  })
})
