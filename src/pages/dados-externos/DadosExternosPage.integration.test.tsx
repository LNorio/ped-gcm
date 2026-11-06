import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { MENSAGEM_RESPOSTA_INVALIDA } from '../../services/api'
import {
  DADO_FATURAMENTO_API,
  DADO_TAREFA_ENVIADA_API,
  DADO_TAREFA_SEM_NUMERO_API,
  NOMES_DADOS_EXTERNOS,
  RESPOSTA_REAL_LISTAGEM_API,
  dadosExternosApi,
  identificadoresApi,
  rotaListarDadosExternos,
} from '../../test/dadosExternosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDadoExterno } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F5.2 — Listagem de dados externos (integração: /dados-externos com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', lista = dadosExternosApi(), listar?: () => Response) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: listar ?? rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
    })
  }

  it('Admin abre /dados-externos: GET da listagem com o Bearer e todas as linhas com as colunas do RF-23', async () => {
    const chamadas = simularSessao('admin')
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    expect(screen.getByRole('heading', { level: 1, name: 'Dados Externos' })).toBeInTheDocument()
    for (const nome of NOMES_DADOS_EXTERNOS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    const get = chamadas.find((c) => c.metodo === 'GET' && c.caminho === ROTA)!
    expect(cabecalhoDaChamada(get, 'Authorization')).toBe('Bearer token-salvo')
    expect(get.url.search).toBe('')

    const linhaDevolucoes = within(tabela).getByText('Devoluções de venda').closest('tr')!
    expect(within(linhaDevolucoes).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(within(linhaDevolucoes).getByText('#1044')).toBeInTheDocument()
    expect(within(linhaDevolucoes).getByText('a definir pela TI')).toBeInTheDocument()
    expect(within(tabela).queryByRole('columnheader', { name: 'Campo/cálculo' })).not.toBeInTheDocument()
  })

  it('resposta real da API com "indicadores" em texto: a tabela carrega, sem "Resposta inválida do servidor."', async () => {
    simularSessao('admin', RESPOSTA_REAL_LISTAGEM_API)
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    expect(within(tabela).getByText('teste')).toBeInTheDocument()
    expect(within(tabela).getByText('teste 2')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('dado em construção com "tarefa bitrix" sem número (id null): a tabela carrega, sem "Resposta inválida do servidor." e com "Aguardando envio ao Bitrix" (sem número) na linha', async () => {
    simularSessao('admin', [...dadosExternosApi(), DADO_TAREFA_SEM_NUMERO_API])
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    for (const nome of NOMES_DADOS_EXTERNOS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    const linha = within(tabela).getByText('Bonificações pagas').closest('tr')!
    expect(within(linha).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(within(linha).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(linha).queryByText(/^#/)).not.toBeInTheDocument()
    expect(within(tabela).getByText('#1044')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('dado em construção com o número da tarefa em texto ("328440", status "enviada"): a tabela carrega, sem "Resposta inválida do servidor.", e mostra "#328440" na linha', async () => {
    simularSessao('admin', [...dadosExternosApi(), DADO_TAREFA_ENVIADA_API])
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    for (const nome of NOMES_DADOS_EXTERNOS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    const linha = within(tabela).getByText('Comissões pagas').closest('tr')!
    expect(within(linha).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(within(linha).getByText('#328440')).toBeInTheDocument()
    expect(within(linha).queryByText('Aguardando envio ao Bitrix')).not.toBeInTheDocument()
    expect(within(tabela).getByText('#1044')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('número da tarefa em texto com espaços nas pontas aparece sem os espaços ("#328440")', async () => {
    simularSessao('admin', [
      ...dadosExternosApi(),
      { ...DADO_TAREFA_ENVIADA_API, 'tarefa bitrix': { id: ' 328440 ', status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' } },
    ])
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    const linha = within(tabela).getByText('Comissões pagas').closest('tr')!
    expect(within(linha).getByText('#328440')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('número da tarefa em texto não numérico: a listagem mostra "Resposta inválida do servidor." (a resposta fora do formato continua rejeitada)', async () => {
    simularSessao('admin', [
      ...dadosExternosApi(),
      { ...DADO_TAREFA_ENVIADA_API, 'tarefa bitrix': { id: 'abc', status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' } },
    ])
    renderizarApp('/dados-externos')

    expect(await screen.findByText(MENSAGEM_RESPOSTA_INVALIDA)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Dados externos' })).not.toBeInTheDocument()
  })

  it('Admin abre "Ver detalhes" de um dado: os campos fora da tabela aparecem na linha de detalhes', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    renderizarApp('/dados-externos')
    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    await escolherAcao(user, rotuloAcoesDadoExterno('Devoluções de venda'), 'Ver detalhes')

    const detalhes = within(tabela).getByText('Devoluções de venda').closest('tr')!.nextElementSibling as HTMLElement
    expect(detalhes).toHaveTextContent('Soma do valor líquido das notas de devolução de venda, por filial, no período.')
    expect(within(detalhes).getByText('Campo/cálculo', { selector: 'dt' })).toBeInTheDocument()
    expect(within(detalhes).getByText('Janela retroativa', { selector: 'dt' })).toBeInTheDocument()
    expect(within(detalhes).getByText('Somente o mês')).toBeInTheDocument()
  })

  it('Preenchedor vê os dados devolvidos pela API (dos seus tipos), sem ações de linha além de "Ver detalhes"', async () => {
    const user = usuarioRapido()
    simularSessao('preenchedor', [DADO_FATURAMENTO_API])
    renderizarApp('/dados-externos')

    const tabela = await screen.findByRole('table', { name: 'Dados externos' })

    expect(screen.getByText('Preenchedor')).toBeInTheDocument()
    expect(within(tabela).getByText('Faturamento líquido')).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual(['Ver detalhes'])
    expect(screen.getByRole('button', { name: 'Novo dado externo' })).toBeInTheDocument()
  })

  it('Validador vê Ativar/Desativar mas não Concluir construção nem Excluir', async () => {
    const user = usuarioRapido()
    simularSessao('validador')
    renderizarApp('/dados-externos')

    await screen.findByRole('table', { name: 'Dados externos' })

    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Faturamento líquido'))).toEqual(['Ver detalhes', 'Desativar'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Cobertura de clientes'))).toEqual(['Ver detalhes', 'Ativar'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDadoExterno('Devoluções de venda'))).toEqual(['Ver detalhes'])
  })

  it('500 na listagem: Aviso de erro com a mensagem da API e "Tentar novamente"', async () => {
    simularSessao('admin', [], () => respostaErro(500, 'Falha ao consultar os dados externos.'))
    renderizarApp('/dados-externos')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os dados externos.')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Dados externos' })).not.toBeInTheDocument()
  })

  it('401 na listagem encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularSessao('admin', [], () => respostaErro(401))
    renderizarApp('/dados-externos')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
