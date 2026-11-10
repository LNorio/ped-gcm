import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import type { ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { APONTAMENTO_ROTEIRO_API } from '../../test/apontamentosFalsos'
import { DADO_FATURAMENTO_API } from '../../test/dadosExternosFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno } from '../../types/dominio'
import { FormularioIndicador } from './FormularioIndicador'

/**
 * F6.10 — Erros 400 por filial no cadastro (API (26).md: `erros: [{ filial, mensagem }]`).
 *
 * Nova prop opcional `errosFiliais?: readonly ErroDeFilial[]` (padrão `[]`; a página a preenche com
 * `errosPorFilial(falha)`): cada erro com `filial` vai para o campo "Meta da filial {código} - {nome}"
 * daquela filial (lista "Metas por filial" ou o campo único da visão de uma filial), com `aria-invalid`
 * e descrição acessível. Erros com `filial: null`, de filial que não tem campo na tela, ou com
 * "Replicar" marcado ficam só no alerta geral (`erro`, como hoje). Editar o campo da filial limpa o
 * erro dela; os das outras continuam.
 */
const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API].map(paraApontamento)
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API].map(paraDadoExterno)
const REPLICAR = 'Replicar a meta para todas as filiais'

describe('F6.10 — FormularioIndicador: erros da API por filial', () => {
  function elemento(erro: string | null, errosFiliais: readonly ErroDeFilial[] | undefined, filialSelecionada: FilialSelecionada = 'todas') {
    return (
      <FormularioIndicador
        apontamentos={APONTAMENTOS}
        dadosExternos={DADOS_EXTERNOS}
        carregandoComponentes={false}
        erroComponentes={null}
        salvando={false}
        erro={erro}
        errosFiliais={errosFiliais}
        filialSelecionada={filialSelecionada}
        filiais={FILIAIS}
        onSalvar={vi.fn()}
        onCancelar={vi.fn()}
      />
    )
  }

  const campo = (rotulo: string) => screen.getByRole('textbox', { name: `Meta da filial ${rotulo}` })

  /** Visão "Todas": desmarca "Replicar", digita e depois recebe o erro da API (como após o POST). */
  async function comListaEErros(erro: string, errosFiliais: readonly ErroDeFilial[]) {
    const user = usuarioRapido()
    const { rerender } = render(elemento(null, []))
    await user.click(screen.getByRole('checkbox', { name: REPLICAR }))
    await user.type(campo('100 - MATRIZ'), '10')
    await user.type(campo('101 - CAMPO GRANDE'), '0,5')
    rerender(elemento(erro, errosFiliais))
    return user
  }

  it('lista "Metas por filial": cada erro vai para o campo da filial, com aria-invalid e descrição acessível; a mensagem geral fica no alerta', async () => {
    await comListaEErros('filial 101 nao encontrada', [
      { filial: '101', mensagem: 'filial 101 nao encontrada' },
      { filial: '102', mensagem: 'a meta da filial 102 deve ser um numero maior que zero' },
    ])

    // O alerta geral (Aviso) é o primeiro do formulário; os erros de campo também são role="alert".
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('filial 101 nao encontrada')
    expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('filial 101 nao encontrada')
    expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('102 - DOURADOS')).toHaveAccessibleDescription('a meta da filial 102 deve ser um numero maior que zero')
    expect(campo('100 - MATRIZ')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('os valores digitados são mantidos com os erros', async () => {
    await comListaEErros('x', [{ filial: '101', mensagem: 'erro' }])

    expect(campo('100 - MATRIZ')).toHaveValue('10')
    expect(campo('101 - CAMPO GRANDE')).toHaveValue('0,5')
    expect(screen.getByRole('checkbox', { name: REPLICAR })).not.toBeChecked()
  })

  it('editar o campo da filial limpa o erro dela e mantém o das outras', async () => {
    const user = await comListaEErros('x', [
      { filial: '101', mensagem: 'erro da 101' },
      { filial: '102', mensagem: 'erro da 102' },
    ])

    await user.type(campo('101 - CAMPO GRANDE'), '0')

    expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('erro da 101')).not.toBeInTheDocument()
    expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('102 - DOURADOS')).toHaveAccessibleDescription('erro da 102')
  })

  it('erro com filial null, ou de filial sem campo na tela, fica só no alerta geral', async () => {
    await comListaEErros('envie a meta ou as metas por filial, nunca as duas juntas', [
      { filial: null, mensagem: 'envie a meta ou as metas por filial, nunca as duas juntas' },
      { filial: '99999', mensagem: 'filial 99999 nao encontrada' },
    ])

    expect(screen.getByRole('alert')).toHaveTextContent('envie a meta ou as metas por filial, nunca as duas juntas')
    const grupo = screen.getByRole('group', { name: 'Metas por filial' })
    for (const caixa of within(grupo).getAllByRole('textbox')) expect(caixa).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('visão de uma filial: o erro daquela filial vai para o campo único "Meta da filial 101 - CAMPO GRANDE"', () => {
    render(elemento('a meta da filial 101 ("1.500") e ambigua', [{ filial: '101', mensagem: 'a meta da filial 101 ("1.500") e ambigua' }], FILIAIS[1]))

    expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('a meta da filial 101 ("1.500") e ambigua')
  })

  it('com "Replicar" marcado (meta única), erros por filial não marcam o campo "Meta"', () => {
    render(elemento('x', [{ filial: '101', mensagem: 'erro da 101' }]))

    expect(screen.getByRole('textbox', { name: 'Meta' })).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('x')
  })

  it('sem errosFiliais (padrão), o formulário se comporta como antes', () => {
    render(elemento(null, undefined, FILIAIS[1]))

    expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
  })
})
