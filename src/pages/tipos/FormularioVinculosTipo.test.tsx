import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AtualizacaoTipo } from '../../services/tiposService'
import { TIPOS_FIXOS_API, TIPO_LOGISTICA_API, colaboradoresDominio, gruposDominio, tipoDominio } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { TipoApontamento } from '../../types/dominio'
import { FormularioVinculosTipo, type FormularioVinculosTipoProps } from './FormularioVinculosTipo'

/** Comercial (fixo): grupos OPERADOR DE CAIXA (4) e GERENTE DE LOJA (7); usuário Fulano (12). */
const COMERCIAL: TipoApontamento = tipoDominio(TIPOS_FIXOS_API[0])
/** Logística (personalizado): grupo SUPERVISÃO LOGÍSTICA (11); usuário Fulano (12). */
const LOGISTICA: TipoApontamento = tipoDominio(TIPO_LOGISTICA_API)

describe('F3.5 — FormularioVinculosTipo: edição dos grupos e usuários de um tipo (RF-14, RF-16)', () => {
  function renderizar(props: Partial<FormularioVinculosTipoProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: AtualizacaoTipo) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <FormularioVinculosTipo
        tipo={props.tipo ?? COMERCIAL}
        grupos={props.grupos ?? gruposDominio()}
        colaboradores={props.colaboradores ?? colaboradoresDominio()}
        carregandoListas={props.carregandoListas ?? false}
        erroListas={props.erroListas ?? null}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onSalvar, onCancelar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome do tipo' })
  const grupoGrupos = () => screen.getByRole('group', { name: 'Grupos vinculados' })
  const grupoUsuarios = () => screen.getByRole('group', { name: 'Usuários vinculados' })
  const botaoGrupo = () => within(grupoGrupos()).getByRole('button', { name: 'Selecionar grupo' })
  const botaoUsuario = () => within(grupoUsuarios()).getByRole('button', { name: 'Selecionar usuário' })
  const listaGrupos = () => within(grupoGrupos()).getByRole('listbox', { name: 'Grupos vinculados' })
  const listaUsuarios = () => within(grupoUsuarios()).getByRole('listbox', { name: 'Usuários vinculados' })
  const gruposEscolhidos = () => within(grupoGrupos()).getByRole('list', { name: 'Grupos escolhidos' })
  const usuariosEscolhidos = () => within(grupoUsuarios()).getByRole('list', { name: 'Usuários escolhidos' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar alterações' })

  const textosDaLista = (lista: HTMLElement) => within(lista).getAllByRole('option').map((opcao) => opcao.textContent)
  const textosEscolhidos = (lista: HTMLElement) => within(lista).getAllByRole('listitem').map((item) => item.textContent)
  const opcao = (lista: HTMLElement, rotulo: string) =>
    within(lista).getByRole('option', { name: (nomeOpcao) => nomeOpcao.startsWith(rotulo) })

  async function escolherGrupo(user: Usuario, rotulo: string) {
    if (within(grupoGrupos()).queryByRole('listbox') === null) await user.click(botaoGrupo())
    await user.click(opcao(listaGrupos(), rotulo))
  }

  async function escolherUsuario(user: Usuario, rotulo: string) {
    if (within(grupoUsuarios()).queryByRole('listbox') === null) await user.click(botaoUsuario())
    await user.click(opcao(listaUsuarios(), rotulo))
  }

  async function removerGrupo(user: Usuario, rotulo: string) {
    await user.click(within(gruposEscolhidos()).getByRole('button', { name: `Remover ${rotulo}` }))
  }

  describe('campos', () => {
    it('mostra o nome do tipo somente leitura (o nome não muda na edição)', () => {
      renderizar()

      expect(nome()).toHaveValue('Comercial')
      expect(nome()).toHaveAttribute('readonly')
    })

    it('começa com os grupos e usuários já vinculados ao tipo, na ordem da API', () => {
      renderizar()

      expect(textosEscolhidos(gruposEscolhidos())).toEqual([
        expect.stringContaining('DEF_OPERADOR DE CAIXA'),
        expect.stringContaining('DEF_GERENTE DE LOJA'),
      ])
      expect(textosEscolhidos(usuariosEscolhidos())).toEqual([expect.stringContaining('Fulano')])
    })

    it('tipo sem vínculos (listas vazias ou null) começa com "Nenhum grupo selecionado." e "Nenhum usuário selecionado."', () => {
      renderizar({ tipo: { ...tipoDominio(TIPOS_FIXOS_API[2]), grupos: null, usuarios: null } })

      expect(within(grupoGrupos()).getByText('Nenhum grupo selecionado.')).toBeInTheDocument()
      expect(within(grupoUsuarios()).getByText('Nenhum usuário selecionado.')).toBeInTheDocument()
    })

    it('as opções não repetem os grupos e usuários já vinculados', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoGrupo())
      expect(textosDaLista(listaGrupos())).toEqual(['DEF_ANALISTA FINANCEIRO1 usuário', 'DEF_SUPERVISÃO LOGÍSTICA5 usuários'])

      await user.click(botaoUsuario())
      expect(textosDaLista(listaUsuarios()).some((texto) => texto?.startsWith('Fulano'))).toBe(false)
    })

    it('grupo vinculado que não está na lista da API continua visível pelo nome do tipo e pode ser removido', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({
        tipo: { ...COMERCIAL, grupos: [{ id: 99, nome: 'DEF_GRUPO ANTIGO' }], usuarios: [] },
      })

      expect(textosEscolhidos(gruposEscolhidos())).toEqual([expect.stringContaining('DEF_GRUPO ANTIGO')])

      await removerGrupo(user, 'DEF_GRUPO ANTIGO')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')
      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ grupos: [4] })
    })
  })

  describe('envio só com as listas alteradas (PUT troca só a lista enviada)', () => {
    it('"Salvar alterações" fica desabilitado enquanto nada mudou', () => {
      renderizar()

      expect(salvar()).toBeDisabled()
    })

    it('alterar só os grupos envia { grupos } com a lista completa resultante (sem usuarios)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await removerGrupo(user, 'DEF_GERENTE DE LOJA')
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')

      expect(salvar()).toBeEnabled()
      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({ grupos: [4, 9] })
      expect(onSalvar.mock.calls[0][0]).not.toHaveProperty('usuarios')
    })

    it('alterar só os usuários envia { usuarios } (sem grupos)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await escolherUsuario(user, 'Maria Souza')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ usuarios: [12, 30] })
      expect(onSalvar.mock.calls[0][0]).not.toHaveProperty('grupos')
    })

    it('alterar as duas listas envia { grupos, usuarios }', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ tipo: LOGISTICA })
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')
      await user.click(within(usuariosEscolhidos()).getByRole('button', { name: 'Remover Fulano' }))

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ grupos: [11, 4], usuarios: [] })
    })

    it('desfazer a alteração (remover e escolher de novo o mesmo grupo) volta a desabilitar "Salvar alterações"', async () => {
      const user = usuarioRapido()
      renderizar()
      await removerGrupo(user, 'DEF_GERENTE DE LOJA')
      expect(salvar()).toBeEnabled()

      await escolherGrupo(user, 'DEF_GERENTE DE LOJA')

      expect(salvar()).toBeDisabled()
    })

    it('vale para tipo fixo e para personalizado', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ tipo: LOGISTICA })
      await removerGrupo(user, 'DEF_SUPERVISÃO LOGÍSTICA')
      await escolherGrupo(user, 'DEF_GERENTE DE LOJA')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ grupos: [7] })
    })

    it('Enter na busca "Buscar grupo" não envia o formulário, mesmo com os vínculos alterados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')
      expect(salvar()).toBeEnabled()

      await user.type(within(grupoGrupos()).getByRole('searchbox', { name: 'Buscar grupo' }), 'super{Enter}')

      expect(onSalvar).not.toHaveBeenCalled()
      expect(within(grupoGrupos()).getByRole('searchbox', { name: 'Buscar grupo' })).toHaveValue('super')
    })

    it('Enter na busca "Buscar usuário" não envia o formulário, mesmo com os vínculos alterados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')
      await user.click(botaoUsuario())

      await user.type(within(grupoUsuarios()).getByRole('searchbox', { name: 'Buscar usuário' }), 'fulano{Enter}')

      expect(onSalvar).not.toHaveBeenCalled()
      expect(salvar()).toBeEnabled()
    })

    it('"Cancelar" chama onCancelar sem chamar onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('estados', () => {
    it('salvando desabilita "Salvar alterações" mesmo com alteração', async () => {
      const user = usuarioRapido()
      const props = {
        tipo: COMERCIAL,
        grupos: gruposDominio(),
        colaboradores: colaboradoresDominio(),
        carregandoListas: false,
        erroListas: null,
        erro: null,
        onSalvar: vi.fn(),
        onCancelar: vi.fn(),
      }
      const { rerender } = render(<FormularioVinculosTipo {...props} salvando={false} />)
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')
      expect(salvar()).toBeEnabled()

      rerender(<FormularioVinculosTipo {...props} salvando />)

      expect(salvar()).toBeDisabled()
      expect(textosEscolhidos(gruposEscolhidos())).toHaveLength(3)
    })

    it('exibe o erro recebido em um alerta dentro do formulário', () => {
      renderizar({ erro: 'Sem permissão.' })

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent('Sem permissão.')
      expect(alerta).toHaveClass('aviso--erro')
    })

    it('enquanto carrega as listas, anuncia "Carregando grupos e usuários..." em região de status', () => {
      renderizar({ carregandoListas: true, grupos: [], colaboradores: [] })

      expect(screen.getByText('Carregando grupos e usuários...').closest('[role="status"]')).not.toBeNull()
    })

    it('erro na carga das listas aparece como alerta, mantendo os vínculos atuais visíveis', () => {
      renderizar({ erroListas: 'Não foi possível conectar ao servidor.', grupos: [], colaboradores: [] })

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
      expect(textosEscolhidos(gruposEscolhidos())).toHaveLength(2)
    })
  })
})
