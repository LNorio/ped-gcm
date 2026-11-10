import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import { APONTAMENTO_ROTEIRO_API } from '../../test/apontamentosFalsos'
import { DADO_COBERTURA_API, DADO_FATURAMENTO_API } from '../../test/dadosExternosFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno, NovoIndicador } from '../../types/dominio'
import { FormularioIndicador, type FormularioIndicadorProps } from './FormularioIndicador'

/**
 * F6.11 — Fonte da meta no cadastro de indicador (contrato final: RESPOSTA-FINAL-meta-via-api.md,
 * seção 2.1, e CONFIRMACAO-FRONT-meta-via-api.md — 10/11/2026).
 *
 * - "Buscar metas via API" aparece sempre (Admin e Validador; o formulário não depende do perfil).
 * - Marcado, com a composição por um dado externo com `forneceMeta: true`, aparece o checkbox
 *   **"Meta vinda do dado externo"**, marcado por padrão → `fonteDaMeta: 'dado_externo'`. Desmarcado,
 *   com apontamentos ou com dado externo sem `forneceMeta` → `fonteDaMeta: 'integracao'` (sem o checkbox).
 * - Prop opcional `consultaIntegracaoDisponivel` (padrão `true`; a página passa
 *   `metaViaApi.integracao !== false`): com `false` e a fonte `integracao`, mostra o aviso
 *   "A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá
 *   ser configurada; a meta chegará quando a consulta for liberada." sem bloquear o envio. Na fonte
 *   `dado_externo` o aviso não aparece.
 * - A meta automática nunca é editável: `metaEditavel: false` nas duas fontes.
 */
const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API].map(paraApontamento)
const FATURAMENTO: DadoExterno = { ...paraDadoExterno(DADO_FATURAMENTO_API), forneceMeta: true }
const COBERTURA: DadoExterno = { ...paraDadoExterno({ ...DADO_COBERTURA_API, situacao: 'ativo' }), forneceMeta: false }
const DADOS_EXTERNOS: DadoExterno[] = [FATURAMENTO, COBERTURA]

const BUSCAR_VIA_API = 'Buscar metas via API'
const META_DO_DADO = 'Meta vinda do dado externo'
const AVISO =
  'A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá ser configurada; a meta chegará quando a consulta for liberada.'

describe('F6.11 — FormularioIndicador: fonte da meta ("Meta vinda do dado externo") e aviso da consulta', () => {
  function renderizar(props: Partial<FormularioIndicadorProps> = {}) {
    const onSalvar = vi.fn<(dados: NovoIndicador) => void>()
    render(
      <FormularioIndicador
        apontamentos={APONTAMENTOS}
        dadosExternos={DADOS_EXTERNOS}
        carregandoComponentes={false}
        erroComponentes={null}
        salvando={false}
        erro={null}
        filialSelecionada="todas"
        filiais={FILIAIS}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
        {...props}
      />,
    )
    return { onSalvar }
  }

  const buscarViaApi = () => screen.getByRole('checkbox', { name: BUSCAR_VIA_API })
  const metaDoDado = () => screen.queryByRole('checkbox', { name: META_DO_DADO })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })
  const aviso = () => screen.queryByText(AVISO)

  async function preencherBase(user: Usuario) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Atingimento de faturamento')
    const sentido = screen.getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
  }

  async function escolherDado(user: Usuario, nome: string) {
    const grupo = screen.getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupo).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupo).getByRole('listbox', { name: 'Dados externos' })
    await user.click(within(lista).getByRole('option', { name: (rotulo) => rotulo.startsWith(nome) }))
  }

  async function escolherApontamento(user: Usuario) {
    const grupo = screen.getByRole('group', { name: 'Apontamentos' })
    await user.click(within(grupo).getByRole('button', { name: 'Selecionar apontamento' }))
    const lista = within(grupo).getByRole('listbox', { name: 'Apontamentos' })
    await user.click(within(lista).getByRole('option', { name: (rotulo) => rotulo.startsWith('Roteiro de visitas elaborado') }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cálculo do realizado' }), 'Soma')
  }

  describe('"Meta vinda do dado externo"', () => {
    it('com dado externo que fornece meta e "Buscar metas via API" marcado, aparece marcado por padrão', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherDado(user, 'Faturamento líquido')

      await user.click(buscarViaApi())

      expect(metaDoDado()).toBeChecked()
    })

    it('não aparece com "Buscar metas via API" desmarcado', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherDado(user, 'Faturamento líquido')

      expect(metaDoDado()).not.toBeInTheDocument()
    })

    it('não aparece com dado externo que não fornece meta, com apontamentos nem sem composição', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(buscarViaApi())
      expect(metaDoDado()).not.toBeInTheDocument()

      await escolherDado(user, 'Cobertura de clientes')
      expect(metaDoDado()).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Remover Cobertura de clientes' }))
      await escolherApontamento(user)
      expect(metaDoDado()).not.toBeInTheDocument()
    })

    it('marcado (padrão): onSalvar com fonteDaMeta "dado_externo", metaEditavel false e sem meta', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherDado(user, 'Faturamento líquido')
      await user.click(buscarViaApi())

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar.mock.calls[0][0]).toEqual({
        nome: 'Atingimento de faturamento',
        descricao: null,
        origemDaMeta: 'terceiro',
        fonteDaMeta: 'dado_externo',
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
    })

    it('desmarcado: onSalvar com fonteDaMeta "integracao"', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherDado(user, 'Faturamento líquido')
      await user.click(buscarViaApi())

      await user.click(metaDoDado()!)
      await user.click(salvar())

      expect(onSalvar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', fonteDaMeta: 'integracao', metaEditavel: false, dadoExterno: 1 })
    })

    it('dado externo sem forneceMeta: onSalvar com fonteDaMeta "integracao"', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherDado(user, 'Cobertura de clientes')
      await user.click(buscarViaApi())

      await user.click(salvar())

      expect(onSalvar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', fonteDaMeta: 'integracao', dadoExterno: 2 })
    })

    it('apontamentos: onSalvar com fonteDaMeta "integracao"', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherApontamento(user)
      await user.click(buscarViaApi())

      await user.click(salvar())

      expect(onSalvar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', fonteDaMeta: 'integracao', apontamentos: [1], calculo: 'soma' })
    })

    it('"Meta editável no preenchimento" marcada antes: as duas fontes enviam metaEditavel false', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherDado(user, 'Faturamento líquido')
      await user.click(screen.getByRole('checkbox', { name: 'Meta editável no preenchimento' }))
      await user.click(buscarViaApi())

      await user.click(salvar())
      await user.click(metaDoDado()!)
      await user.click(salvar())

      expect(onSalvar.mock.calls.map(([dados]) => [dados.fonteDaMeta, dados.metaEditavel])).toEqual([
        ['dado_externo', false],
        ['integracao', false],
      ])
    })

    it('sem "Buscar metas via API": onSalvar sem fonteDaMeta (meta manual)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherBase(user)
      await escolherDado(user, 'Faturamento líquido')
      await user.type(screen.getByRole('textbox', { name: 'Meta' }), '10')

      await user.click(salvar())

      expect(onSalvar.mock.calls[0][0]).not.toHaveProperty('fonteDaMeta')
      expect(onSalvar.mock.calls[0][0]).toMatchObject({ meta: 10 })
    })
  })

  describe('aviso da consulta indisponível (consultaIntegracaoDisponivel)', () => {
    it('false + fonte integracao (apontamentos): mostra o aviso e o envio continua liberado', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ consultaIntegracaoDisponivel: false })
      await preencherBase(user)
      await escolherApontamento(user)

      await user.click(buscarViaApi())

      expect(aviso()).toBeInTheDocument()
      expect(salvar()).toBeEnabled()
      await user.click(salvar())
      expect(onSalvar).toHaveBeenCalledTimes(1)
    })

    it('false + fonte dado_externo: sem aviso; desmarcar "Meta vinda do dado externo" mostra o aviso', async () => {
      const user = usuarioRapido()
      renderizar({ consultaIntegracaoDisponivel: false })
      await escolherDado(user, 'Faturamento líquido')
      await user.click(buscarViaApi())

      expect(aviso()).not.toBeInTheDocument()

      await user.click(metaDoDado()!)

      expect(aviso()).toBeInTheDocument()
    })

    it('false com "Buscar metas via API" desmarcado: sem aviso', async () => {
      const user = usuarioRapido()
      renderizar({ consultaIntegracaoDisponivel: false })

      await escolherApontamento(user)

      expect(aviso()).not.toBeInTheDocument()
    })

    it.each([
      ['true', true],
      ['ausente (padrão true)', undefined],
    ] as const)('%s + fonte integracao: sem aviso', async (_nome, disponivel) => {
      const user = usuarioRapido()
      renderizar({ consultaIntegracaoDisponivel: disponivel })
      await escolherApontamento(user)

      await user.click(buscarViaApi())

      expect(aviso()).not.toBeInTheDocument()
    })
  })
})
