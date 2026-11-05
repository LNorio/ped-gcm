import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { TABELA_COMERCIAL_101_API, TABELA_GERENTES_100_API } from '../../test/faixasFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import { FormularioAlterarFaixas, type FormularioAlterarFaixasProps } from './FormularioAlterarFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const GERENTES_100 = paraTabelaFaixas(TABELA_GERENTES_100_API)

function renderizar(props: Partial<FormularioAlterarFaixasProps> = {}) {
  const onSalvar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <FormularioAlterarFaixas tabela={COMERCIAL_101} salvando={false} erro={null} onSalvar={onSalvar} onCancelar={onCancelar} {...props} />,
  )
  return { onSalvar, onCancelar }
}

const campo = (nome: 'De' | 'Até' | 'Alíquota', n: number) => screen.getByRole('textbox', { name: `${nome}, faixa ${n}` })
const campoMotivo = () => screen.getByRole('textbox', { name: 'Motivo da alteração' })
const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar nova versão' })

describe('F8.4 — FormularioAlterarFaixas ("Alterar faixas": nova versão v+1 com motivo — RF-44, RF-43, RN-14)', () => {
  it('mostra o nome da tabela e "Alterando faixas — será gerada a versão v{vigente + 1}"', () => {
    renderizar()

    expect(screen.getByText('PED Comercial · Filial 101')).toBeInTheDocument()
    expect(screen.getByText('Alterando faixas — será gerada a versão v3')).toBeInTheDocument()
  })

  it('tabela na v1 gera a v2', () => {
    renderizar({ tabela: GERENTES_100 })

    expect(screen.getByText('Alterando faixas — será gerada a versão v2')).toBeInTheDocument()
  })

  it('as linhas começam com as faixas vigentes no padrão pt-BR', () => {
    renderizar()

    expect([campo('De', 1), campo('Até', 1), campo('Alíquota', 1)].map((c) => (c as HTMLInputElement).value)).toEqual(['0,00', '1.000,00', '0,00'])
    expect([campo('De', 2), campo('Até', 2), campo('Alíquota', 2)].map((c) => (c as HTMLInputElement).value)).toEqual(['1.000,01', '2.000,00', '1,50'])
    expect([campo('De', 3), campo('Até', 3), campo('Alíquota', 3)].map((c) => (c as HTMLInputElement).value)).toEqual(['2.000,01', '5.000,00', '3,00'])
    expect(screen.queryByRole('textbox', { name: 'De, faixa 4' })).not.toBeInTheDocument()
  })

  it('"Motivo da alteração" é obrigatório, começa vazio e orienta que fica registrado no histórico', () => {
    renderizar()

    expect(campoMotivo()).toHaveValue('')
    expect(campoMotivo()).toHaveAttribute('aria-required', 'true')
    expect(campoMotivo()).toHaveAttribute('placeholder', 'Obrigatório — fica registrado no histórico')
  })

  it('sem motivo (ou só espaços): "Informe o motivo da alteração." e não salva', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await user.click(botaoSalvar())
    expect(screen.getByText('Informe o motivo da alteração.')).toBeInTheDocument()

    await colar(user, campoMotivo(), '   ')
    await user.click(botaoSalvar())

    expect(screen.getByText('Informe o motivo da alteração.')).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('linhas inválidas: mensagem do RF-43 e não salva, mesmo com motivo', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await colar(user, campoMotivo(), 'Reajuste')

    await user.clear(campo('De', 2))
    await user.type(campo('De', 2), '900')
    await user.click(botaoSalvar())

    expect(screen.getByRole('alert')).toHaveTextContent('A faixa 2 deve começar acima do limite da faixa 1.')
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('remover todas as linhas não é possível: a última linha não pode ser removida', async () => {
    const user = usuarioRapido()
    renderizar({ tabela: GERENTES_100 })

    expect(screen.getByRole('button', { name: 'Remover faixa 1' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Adicionar faixa/ }))
    expect(screen.getByRole('button', { name: 'Remover faixa 1' })).toBeEnabled()
  })

  it('salvar: chama onSalvar com o motivo sem espaços nas pontas e as faixas numéricas editadas', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await user.clear(campo('Alíquota', 3))
    await user.type(campo('Alíquota', 3), '3,5')
    await user.click(screen.getByRole('button', { name: /Adicionar faixa/ }))
    await user.type(campo('De', 4), '5.000,01')
    await user.type(campo('Até', 4), '10.000')
    await user.type(campo('Alíquota', 4), '4')
    await colar(user, campoMotivo(), '  Reajuste do trimestre  ')
    await user.click(botaoSalvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar).toHaveBeenCalledWith({
      motivo: 'Reajuste do trimestre',
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
        { de: 2000.01, ate: 5000, aliquota: 3.5 },
        { de: 5000.01, ate: 10000, aliquota: 4 },
      ],
    })
  })

  it('remover uma faixa e salvar envia só as restantes', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await user.click(screen.getByRole('button', { name: 'Remover faixa 3' }))
    await colar(user, campoMotivo(), 'Fim da terceira faixa')
    await user.click(botaoSalvar())

    expect(onSalvar).toHaveBeenCalledWith({
      motivo: 'Fim da terceira faixa',
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
      ],
    })
  })

  it('salvando: "Salvar nova versão" fica desabilitado', () => {
    renderizar({ salvando: true })

    expect(botaoSalvar()).toBeDisabled()
  })

  it('erro da API é exibido como alerta', () => {
    renderizar({ erro: 'As faixas são iguais às da versão vigente.' })

    expect(screen.getByRole('alert')).toHaveTextContent('As faixas são iguais às da versão vigente.')
  })

  it('"Cancelar" chama onCancelar sem salvar', async () => {
    const user = usuarioRapido()
    const { onSalvar, onCancelar } = renderizar()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onSalvar).not.toHaveBeenCalled()
  })
})
