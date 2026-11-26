/**
 * E2E — fluxos-chave de cada aba com a API simulada, conferindo a chamada enviada ao back-end.
 */
import type { Page } from '@playwright/test'
import { instalarApi, TOKEN, type ApiSimulada, type Perfil } from './apoio/apiSimulada'
import { MENSAGEM_RESPOSTA_INVALIDA, expect, test } from './apoio/teste'

async function abrir(page: Page, perfil: Perfil, caminho: string, titulo: string): Promise<ApiSimulada> {
  const api = await instalarApi(page, perfil)
  await page.goto(caminho)
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
  return api
}

test('Tipos: cadastrar um tipo envia o POST com nome e grupo e a lista recarrega com o novo tipo', async ({ page, console }) => {
  const api = await abrir(page, 'admin', '/tipos', 'Tipos')
  await expect(page.getByRole('table', { name: 'Tipos de apontamento' }).getByRole('cell', { name: 'Logística', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Novo tipo' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Novo tipo de apontamento' })
  await expect(dialogo.getByRole('button', { name: 'Selecionar grupo' })).toBeVisible()
  await expect(dialogo.getByText('Carregando grupos e usuários...')).toHaveCount(0)

  await dialogo.getByRole('textbox', { name: 'Nome do tipo' }).fill('Compras')
  const grupos = dialogo.getByRole('group', { name: 'Grupos vinculados' })
  await grupos.getByRole('button', { name: 'Selecionar grupo' }).click()
  await grupos.getByRole('option', { name: /^DEF_OPERADOR DE CAIXA/ }).click()
  await dialogo.getByRole('button', { name: 'Salvar tipo' }).click()

  await expect(page.getByText('Tipo cadastrado.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const posts = api.de('POST', '/api/ped/tipos-apontamento')
  expect(posts).toHaveLength(1)
  expect(posts[0].corpo).toEqual({ nome: 'Compras', grupos: [4], usuarios: [] })
  expect(posts[0].cabecalhos['authorization']).toBe(`Bearer ${TOKEN}`)
  await expect(page.getByRole('cell', { name: 'Compras', exact: true })).toBeVisible()
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})

test('Apontamentos: a busca filtra pela API (GET com busca) e a tabela mostra só o resultado', async ({ page, console }) => {
  const api = await abrir(page, 'admin', '/apontamentos', 'Apontamentos')
  const tabela = page.getByRole('table', { name: 'Apontamentos' })
  await expect(tabela.getByText('Roteiro de visitas elaborado')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Buscar' }).fill('treinamento')

  await expect.poll(() => api.de('GET', '/api/ped/apontamentos').at(-1)?.url.searchParams.get('busca')).toBe('treinamento')
  await expect(tabela.getByText('Horas de treinamento realizadas')).toBeVisible()
  await expect(tabela.getByText('Roteiro de visitas elaborado')).toHaveCount(0)
  // Uma única consulta pela busca (espera de digitação), não uma por tecla.
  expect(api.de('GET', '/api/ped/apontamentos').filter((c) => c.url.searchParams.get('busca'))).toHaveLength(1)
  expect(console.erros).toEqual([])
})

test('Dados Externos: "Novo dado externo" abre o formulário; Cancelar fecha sem gravar', async ({ page, console }) => {
  const api = await abrir(page, 'admin', '/dados-externos', 'Dados Externos')
  await expect(page.getByRole('table', { name: 'Dados externos' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo dado externo' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Novo dado externo' })
  await expect(dialogo.getByRole('textbox', { name: 'Nome' })).toBeVisible()
  await expect(dialogo.getByRole('combobox', { name: 'Tipo', exact: true })).toBeVisible()

  await dialogo.getByRole('button', { name: 'Salvar' }).click()
  await expect(dialogo.getByText('Informe o nome.')).toBeVisible()

  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(api.chamadas.filter((c) => c.metodo !== 'GET')).toEqual([])
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})

test('Indicadores: no cadastro, escolher um apontamento no dropdown e clicar fora fecha a lista mantendo a escolha', async ({
  page,
  console,
}) => {
  const api = await abrir(page, 'admin', '/indicadores', 'Indicadores')
  await expect(page.getByRole('table', { name: 'Indicadores' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo indicador' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Novo indicador' })
  const apontamentos = dialogo.getByRole('group', { name: 'Apontamentos' })
  const botao = apontamentos.getByRole('button', { name: 'Selecionar apontamento' })
  await botao.click()
  const lista = apontamentos.getByRole('listbox', { name: 'Apontamentos' })
  await lista.getByRole('option', { name: /^Roteiro de visitas elaborado/ }).click()
  await expect(lista).toBeVisible()

  await dialogo.getByRole('textbox', { name: 'Nome' }).click()

  await expect(lista).toHaveCount(0)
  await expect(botao).toHaveAttribute('aria-expanded', 'false')
  await expect(apontamentos.getByRole('list', { name: 'Apontamentos escolhidos' })).toContainText('Roteiro de visitas elaborado')
  await expect(dialogo).toBeVisible()
  expect(api.chamadas.filter((c) => c.metodo !== 'GET')).toEqual([])
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})

test('Dashboards: com o formulário válido, Enter na busca "Buscar indicador" não grava; "Salvar" grava uma vez', async ({
  page,
  console,
}) => {
  const api = await abrir(page, 'admin', '/dashboards', 'Dashboards')
  await expect(page.getByRole('table', { name: 'Dashboards' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo dashboard' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Novo dashboard' })
  await expect(dialogo.getByText('Carregando dados do formulário...')).toHaveCount(0)

  async function escolher(escopo: ReturnType<Page['locator']>, botao: string, lista: string, item: string) {
    const gatilho = escopo.getByRole('button', { name: botao })
    if ((await gatilho.getAttribute('aria-expanded')) !== 'true') await gatilho.click()
    await escopo.getByRole('listbox', { name: lista }).getByRole('option', { name: new RegExp(`^${item}`) }).click()
  }

  await dialogo.getByRole('textbox', { name: 'Nome do dashboard' }).fill('PED Supervisores')
  await dialogo.getByRole('combobox', { name: 'Periodicidade de lançamento' }).selectOption('Semestral')
  await dialogo.getByRole('textbox', { name: 'Pontuação base máxima' }).fill('120')
  await dialogo.getByRole('button', { name: 'Tipo de vínculo do dashboard' }).click()
  await dialogo
    .getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })
    .getByRole('option', { name: /^Colaboradores específicos/ })
    .click()
  await escolher(dialogo, 'Selecionar colaborador', 'Colaboradores vinculados', 'Fábio Nunes')
  await escolher(dialogo, 'Selecionar colaborador', 'Colaboradores vinculados', 'Ana Souza')
  // A lista aberta cobre os campos de baixo: fecha clicando fora (no título do diálogo), como o usuário faria.
  const fecharListas = () => dialogo.getByRole('heading', { name: 'Novo dashboard' }).click()
  await fecharListas()
  const indicadores = dialogo.getByRole('group', { name: 'Indicadores vinculados' })
  await escolher(indicadores, 'Selecionar indicador', 'Indicadores', 'Cobertura de visitas')
  await escolher(indicadores, 'Selecionar indicador', 'Indicadores', 'Faturamento líquido mensal')
  await fecharListas()
  await dialogo.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }).fill('70')
  await dialogo.getByRole('textbox', { name: 'Pontos base de Faturamento líquido mensal neste dashboard' }).fill('50')
  await dialogo.getByRole('combobox', { name: 'Indicador base da faixa' }).selectOption('Cobertura de visitas')
  await dialogo.getByRole('textbox', { name: 'Fórmula de pontuação' }).fill('Pontos base × atingimento, sem limite.')

  const gatilho = indicadores.getByRole('button', { name: 'Selecionar indicador' })
  if ((await gatilho.getAttribute('aria-expanded')) !== 'true') await gatilho.click()
  const busca = indicadores.getByRole('searchbox', { name: 'Buscar indicador' })
  await busca.fill('fat')
  await busca.press('Enter')

  // Espera um instante para um eventual envio indevido chegar à rede.
  await page.waitForTimeout(500)
  expect(api.de('POST', '/api/ped/dashboards')).toHaveLength(0)
  await expect(dialogo).toBeVisible()
  await expect(page.getByText(/^Dashboard cadastrado\./)).toHaveCount(0)

  await dialogo.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }).click()
  await expect(page.getByText(/^Dashboard cadastrado\./)).toBeVisible()
  expect(api.de('POST', '/api/ped/dashboards')).toHaveLength(1)
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})

test('Preenchimento (Preenchedor): lançar valores envia um único PUT com os valores convertidos', async ({ page, console }) => {
  const api = await abrir(page, 'preenchedor', '/preenchimento', 'Preenchimento')
  const linha = (nome: string) => page.getByRole('article', { name: nome })
  await expect(linha('Pedidos digitados')).toBeVisible()
  const salvar = page.getByRole('button', { name: 'Salvar lançamentos' })
  await expect(salvar).toBeDisabled()

  await linha('Pedidos digitados').getByRole('textbox', { name: 'Valor de Pedidos digitados' }).fill('1.234,5')
  await linha('Vitrine montada').getByRole('button', { name: 'Sim' }).click()
  await expect(salvar).toBeEnabled()
  await salvar.click()

  await expect(page.getByText('2 lançamentos salvos.')).toBeVisible()
  const puts = api.de('PUT', '/api/ped/preenchimento')
  expect(puts).toHaveLength(1)
  expect(puts[0].corpo).toEqual({
    filial: '101',
    'mes de referencia': '2026-10-01',
    itens: [
      { 'id apontamento': 7, valor: true },
      { 'id apontamento': 11, valor: 1234.5 },
    ],
  })
  await expect(linha('Pedidos digitados').getByText('Preenchido')).toBeVisible()
  await expect(linha('Pedidos digitados').getByRole('textbox')).toHaveCount(0)
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})

test('Fechamentos: a prévia do PED com o previa.json real agrupa em "Filial 101 - …" e "Filial 403 - …"', async ({
  page,
  console,
}) => {
  const api = await abrir(page, 'admin', '/fechamentos', 'Fechamentos')
  const tabela = page.getByRole('table', { name: 'Fechamentos por dashboard' })
  await expect(tabela.getByText('0 de 420 lançamentos')).toBeVisible()
  await expect(page.getByText(MENSAGEM_RESPOSTA_INVALIDA)).toHaveCount(0)

  await page.getByRole('button', { name: 'Ações do dashboard PED' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Pré-visualizar imagens' }).click()

  const dialogo = page.getByRole('dialog', { name: /^Pré-visualização — PED · / })
  const filial = dialogo.getByRole('combobox', { name: 'Filial' })
  await expect(filial).toBeVisible()
  const opcoes = (await filial.getByRole('option').allTextContents()).map((texto) => texto.trim())
  expect(opcoes.filter((texto) => texto.startsWith('Filial 101 - Filial 101'))).toHaveLength(1)
  expect(opcoes.filter((texto) => texto.startsWith('Filial 403 - Filial 403'))).toHaveLength(1)
  expect(opcoes.findIndex((t) => t.startsWith('Filial 101'))).toBeLessThan(opcoes.findIndex((t) => t.startsWith('Filial 403')))
  await expect(filial).toHaveValue('101')
  await expect(dialogo.getByText('Imagem 1 de 2 · Filial 101')).toBeVisible()
  await expect(dialogo.getByText('Nada é gravado na pré-visualização.')).toBeVisible()
  await expect(dialogo.getByText(MENSAGEM_RESPOSTA_INVALIDA)).toHaveCount(0)

  await filial.selectOption('403')
  await expect(dialogo.getByText('Imagem 2 de 2 · Filial 403')).toBeVisible()

  // Uma consulta da prévia por abertura; em desenvolvimento o StrictMode do React repete o efeito (até 2).
  expect(api.de('GET', '/api/ped/fechamentos/2/previa').length).toBeGreaterThanOrEqual(1)
  expect(api.de('GET', '/api/ped/fechamentos/2/previa').length).toBeLessThanOrEqual(2)
  expect(api.chamadas.filter((c) => c.metodo !== 'GET')).toEqual([])
  await page.waitForLoadState('networkidle')
  expect(api.naoSimuladas).toEqual([])
  expect(console.erros).toEqual([])
})
