import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import { indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/indicadores-cadastro'

/**
 * Alteração de 19/11/2026: os dropdowns da composição do formulário de indicador ("Selecionar
 * apontamento" e "Selecionar dado externo") fecham ao clicar fora e com Esc, como os demais
 * dropdowns do sistema. O formulário abre num Dialogo: clicar fora do dropdown ou pressionar Esc
 * fecha só a lista.
 */
describe('F6.4 — Dropdowns da composição do indicador fecham ao clicar fora (integração: /indicadores, alteração de 19/11/2026)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao() {
    const acesso = acessoApi({ perfil: 'admin', tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(indicadoresApi),
      'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
      'GET /api/ped/dados-externos-cadastro': rotaListarDadosExternos(dadosExternosApi),
    })
  }

  const grupo = (dialogo: HTMLElement, nome: 'Apontamentos' | 'Dado externo') => within(dialogo).getByRole('group', { name: nome })
  const opcao = (lista: HTMLElement, rotulo: string) => within(lista).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })
  const titulo = (dialogo: HTMLElement) => within(dialogo).getByRole('heading', { name: 'Novo indicador' })

  /** Abre "Novo indicador" e espera a carga dos componentes ativos (dropdown de apontamentos com a opção). */
  async function abrirCadastro(user: Usuario) {
    renderizarApp('/indicadores')
    await screen.findByRole('table', { name: 'Indicadores' })
    await user.click(screen.getByRole('button', { name: 'Novo indicador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo indicador' })
    const botao = await within(dialogo).findByRole('button', { name: 'Selecionar apontamento' })
    await user.click(botao)
    await within(dialogo).findByRole('option', { name: (nome) => nome.startsWith('Roteiro de visitas elaborado') })
    await user.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    return dialogo
  }

  it('apontamentos: com "Selecionar apontamento" aberto, clicar no título do diálogo fecha a lista e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const apontamentos = grupo(dialogo, 'Apontamentos')
    const botao = within(apontamentos).getByRole('button', { name: 'Selecionar apontamento' })
    await user.click(botao)
    expect(within(apontamentos).getByRole('listbox', { name: 'Apontamentos' })).toBeInTheDocument()

    await user.click(titulo(dialogo))

    expect(within(apontamentos).queryByRole('listbox', { name: 'Apontamentos' })).not.toBeInTheDocument()
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
  })

  it('apontamentos: escolher um apontamento mantém a lista aberta; clicar no campo Nome (fora) a fecha e o escolhido continua', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const apontamentos = grupo(dialogo, 'Apontamentos')
    await user.click(within(apontamentos).getByRole('button', { name: 'Selecionar apontamento' }))

    await user.click(opcao(within(apontamentos).getByRole('listbox', { name: 'Apontamentos' }), 'Roteiro de visitas elaborado'))
    expect(within(apontamentos).getByRole('listbox', { name: 'Apontamentos' })).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('textbox', { name: 'Nome' }))

    expect(within(apontamentos).queryByRole('listbox', { name: 'Apontamentos' })).not.toBeInTheDocument()
    expect(within(apontamentos).getByRole('list', { name: 'Apontamentos escolhidos' })).toHaveTextContent('Roteiro de visitas elaborado')
  })

  it('apontamentos: Esc na busca fecha só a lista (o diálogo continua aberto) e devolve o foco ao botão', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const apontamentos = grupo(dialogo, 'Apontamentos')
    const botao = within(apontamentos).getByRole('button', { name: 'Selecionar apontamento' })
    await user.click(botao)
    await user.click(within(apontamentos).getByRole('searchbox', { name: 'Buscar apontamento' }))

    await user.keyboard('{Escape}')

    expect(within(apontamentos).queryByRole('listbox', { name: 'Apontamentos' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
    expect(botao).toHaveFocus()
  })

  it('dado externo: com "Selecionar dado externo" aberto e uma busca digitada, clicar no título fecha a lista; ao reabrir, a busca está vazia', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const dadoExterno = grupo(dialogo, 'Dado externo')
    const botao = within(dadoExterno).getByRole('button', { name: 'Selecionar dado externo' })
    await user.click(botao)
    await user.type(within(dadoExterno).getByRole('searchbox', { name: 'Buscar dado externo' }), 'fatur')

    await user.click(titulo(dialogo))

    expect(within(dadoExterno).queryByRole('listbox', { name: 'Dados externos' })).not.toBeInTheDocument()
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()

    await user.click(botao)
    expect(within(dadoExterno).getByRole('searchbox', { name: 'Buscar dado externo' })).toHaveValue('')
  })

  it('dado externo: Esc fecha só a lista e o diálogo continua aberto; um segundo Esc fecha o diálogo', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const dadoExterno = grupo(dialogo, 'Dado externo')
    const botao = within(dadoExterno).getByRole('button', { name: 'Selecionar dado externo' })
    await user.click(botao)
    await user.click(within(dadoExterno).getByRole('searchbox', { name: 'Buscar dado externo' }))

    await user.keyboard('{Escape}')

    expect(within(dadoExterno).queryByRole('listbox', { name: 'Dados externos' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
    expect(botao).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Novo indicador' })).not.toBeInTheDocument()
  })

  it('dado externo: escolher um dado externo continua fechando o painel (comportamento atual) e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const dadoExterno = grupo(dialogo, 'Dado externo')
    await user.click(within(dadoExterno).getByRole('button', { name: 'Selecionar dado externo' }))

    await user.click(opcao(within(dadoExterno).getByRole('listbox', { name: 'Dados externos' }), 'Faturamento líquido'))

    expect(within(dadoExterno).queryByRole('listbox')).not.toBeInTheDocument()
    expect(within(dadoExterno).getByRole('list', { name: 'Dado externo escolhido' })).toHaveTextContent('Faturamento líquido')
    expect(screen.getByRole('dialog', { name: 'Novo indicador' })).toBeInTheDocument()
  })
})
