/**
 * Auxiliares dos testes para o menu de ações por linha (`MenuAcoes` — F1.16).
 *
 * O gatilho é um botão com o `rotulo` do menu como nome acessível (ex.: "Ações do dado externo
 * Faturamento líquido"); o clique abre um `role="menu"` com os `role="menuitem"`.
 */
import { screen, within } from '@testing-library/react'
import type { Usuario } from './usuario'

/** Rótulo do gatilho do menu de ações de um dado externo (F5.2). */
export const rotuloAcoesDadoExterno = (nome: string) => `Ações do dado externo ${nome}`

/** Rótulo do gatilho do menu de ações de um apontamento (F4.2). */
export const rotuloAcoesApontamento = (nome: string) => `Ações do apontamento ${nome}`

/** Rótulo do gatilho do menu de ações de um indicador (F6.2). */
export const rotuloAcoesIndicador = (nome: string) => `Ações do indicador ${nome}`

/** Rótulo do gatilho do menu de ações de um dashboard (F7.3). */
export const rotuloAcoesDashboard = (nome: string) => `Ações do dashboard ${nome}`

/** Abre o menu pelo gatilho com o nome informado e devolve o elemento `role="menu"`. */
export async function abrirMenuAcoes(user: Usuario, rotulo: string, escopo: HTMLElement = document.body) {
  await user.click(within(escopo).getByRole('button', { name: rotulo }))
  return screen.getByRole('menu')
}

/** Abre o menu e devolve os nomes dos itens, na ordem exibida. Fecha o menu com Esc ao final. */
export async function itensDoMenuAcoes(user: Usuario, rotulo: string, escopo: HTMLElement = document.body) {
  const menu = await abrirMenuAcoes(user, rotulo, escopo)
  const nomes = within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent?.trim() ?? '')
  await user.keyboard('{Escape}')
  return nomes
}

/**
 * Para cada rótulo, abre o menu (se o gatilho existir na tela) e devolve os nomes dos itens; um
 * gatilho ausente (menu sem itens não é renderizado) resulta em lista vazia. Fecha cada menu ao final.
 */
export async function itensPorMenuAcoes(user: Usuario, rotulos: string[], escopo: HTMLElement = document.body) {
  const resultado: string[][] = []
  for (const rotulo of rotulos) {
    const gatilho = within(escopo).queryByRole('button', { name: rotulo })
    resultado.push(gatilho ? await itensDoMenuAcoes(user, rotulo, escopo) : [])
  }
  return resultado
}

/** Abre o menu e clica no item com o nome informado. */
export async function escolherAcao(user: Usuario, rotulo: string, item: string, escopo: HTMLElement = document.body) {
  const menu = await abrirMenuAcoes(user, rotulo, escopo)
  await user.click(within(menu).getByRole('menuitem', { name: item }))
}

/**
 * Rótulo do gatilho do menu de ações de uma tabela de faixas (F8.2); `nome` é o nome da tabela,
 * "{dashboard} · Filial {filial}" (ex.: "PED Comercial · Filial 101").
 */
export const rotuloAcoesTabelaFaixas = (nome: string) => `Ações da tabela de faixas ${nome}`
