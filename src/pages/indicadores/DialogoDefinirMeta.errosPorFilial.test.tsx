import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import type { ErroDeFilial } from '../../services/indicadoresService'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { INDICADOR_DEVOLUCOES_API } from '../../test/indicadoresFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { DialogoDefinirMeta } from './DialogoDefinirMeta'

/**
 * F6.10 — Erros 400 por filial no "Definir meta" (API (26).md: `erros: [{ filial, mensagem }]`).
 * Mesma regra do cadastro: nova prop opcional `errosFiliais?: readonly ErroDeFilial[]` (padrão `[]`);
 * cada erro com `filial` vai para o campo daquela filial (lista "Metas por filial" ou o campo único
 * "Meta da filial {código} - {nome}"), com `aria-invalid` e descrição acessível; `filial: null` fica
 * no alerta geral (`erro`); editar o campo limpa o erro daquela filial.
 */
const AUTOMATICO: Indicador = paraIndicador(INDICADOR_DEVOLUCOES_API)
const REPLICAR = 'Replicar a meta para todas as filiais'

describe('F6.10 — DialogoDefinirMeta: erros da API por filial', () => {
  function elemento(erro: string | null, errosFiliais: readonly ErroDeFilial[] | undefined, filialSelecionada: FilialSelecionada = 'todas') {
    return (
      <DialogoDefinirMeta
        indicador={AUTOMATICO}
        definindo={false}
        erro={erro}
        errosFiliais={errosFiliais}
        filialSelecionada={filialSelecionada}
        filiais={FILIAIS}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />
    )
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Definir meta' })
  const campo = (rotulo: string) => within(dialogo()).getByRole('textbox', { name: `Meta da filial ${rotulo}` })

  async function comListaEErros(erro: string, errosFiliais: readonly ErroDeFilial[]) {
    const user = usuarioRapido()
    const { rerender } = render(elemento(null, []))
    await user.click(within(dialogo()).getByRole('checkbox', { name: REPLICAR }))
    await user.type(campo('100 - MATRIZ'), '10')
    rerender(elemento(erro, errosFiliais))
    return user
  }

  it('lista "Metas por filial": o erro de cada filial vai para o campo dela; a mensagem geral fica no alerta', async () => {
    await comListaEErros('a filial 101 aparece mais de uma vez em "metas por filial"', [
      { filial: '101', mensagem: 'a filial 101 aparece mais de uma vez em "metas por filial"' },
    ])

    // O alerta geral (Aviso) é o primeiro do diálogo; os erros de campo também são role="alert".
    expect(within(dialogo()).getAllByRole('alert')[0]).toHaveTextContent('a filial 101 aparece mais de uma vez')
    expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('a filial 101 aparece mais de uma vez em "metas por filial"')
    expect(campo('100 - MATRIZ')).not.toHaveAttribute('aria-invalid', 'true')
    expect(campo('100 - MATRIZ')).toHaveValue('10')
  })

  it('editar o campo da filial limpa o erro dela', async () => {
    const user = await comListaEErros('x', [
      { filial: '100', mensagem: 'erro da 100' },
      { filial: '102', mensagem: 'erro da 102' },
    ])

    await user.type(campo('100 - MATRIZ'), '0')

    expect(campo('100 - MATRIZ')).not.toHaveAttribute('aria-invalid', 'true')
    expect(within(dialogo()).queryByText('erro da 100')).not.toBeInTheDocument()
    expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
  })

  it('erro com filial null fica só no alerta geral', async () => {
    const mensagem = 'a meta deste indicador ja foi definida e nao pode ser alterada'
    await comListaEErros(mensagem, [{ filial: null, mensagem }])

    expect(within(dialogo()).getByRole('alert')).toHaveTextContent(mensagem)
    const grupo = within(dialogo()).getByRole('group', { name: 'Metas por filial' })
    for (const caixa of within(grupo).getAllByRole('textbox')) expect(caixa).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('visão de uma filial: o erro dela vai para o campo único', () => {
    render(elemento('filial 102 nao encontrada', [{ filial: '102', mensagem: 'filial 102 nao encontrada' }], FILIAIS[2]))

    expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('102 - DOURADOS')).toHaveAccessibleDescription('filial 102 nao encontrada')
  })
})
