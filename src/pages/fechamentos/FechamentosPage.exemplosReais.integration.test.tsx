import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fechamentosReais from '../../../docs/backend/exemplos-reais/fechamentos.json'
import imagensReais from '../../../docs/backend/exemplos-reais/imagens.json'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { TEXTO_SEM_IMAGENS, TITULO_CONSULTA_IMAGENS } from '../../test/consultaImagensFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const MENSAGEM_RESPOSTA_INVALIDA = 'Resposta inválida do servidor.'
const SECAO = 'Encerrar período por dashboard'
const LEGENDA = 'Fechamentos por dashboard'

/**
 * Aba Fechamentos contra as respostas reais do back-end (F10.2, sobre o serviço da F10.1). Só a rede é
 * simulada; `GET /api/ped/fechamentos` e `GET /api/ped/imagens` respondem com os JSONs de
 * `docs/backend/exemplos-reais/` (enviados pelo usuário em 16/11/2026). Motivo: contra o servidor real,
 * a aba mostrava "Resposta inválida do servidor." porque o serviço esperava listas em "indicadores com
 * problema" e "unidades sem tabela de faixas", que chegam como contagens numéricas.
 *
 * Admin com todas as filiais.
 */
describe('F10.2 — Aba Fechamentos com as respostas reais do back-end (integração: /fechamentos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/fechamentos': () => respostaJson(fechamentosReais),
      'GET /api/ped/imagens': () => respostaJson(imagensReais),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function linha(tabela: HTMLElement, nome: string): HTMLElement {
    const tr = within(tabela).getByText(nome).closest('tr')
    if (!tr) throw new Error(`Linha de ${nome} não encontrada`)
    return tr
  }

  async function abrirTabela(): Promise<HTMLElement> {
    renderizarApp('/fechamentos')
    return screen.findByRole('table', { name: LEGENDA })
  }

  it('carrega o PED sem "Resposta inválida do servidor.": 11/2026, "Em aberto" e "0 de 420 lançamentos", sem alerta', async () => {
    const tabela = await abrirTabela()
    const tr = linha(tabela, 'PED')

    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: SECAO })).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(tr).getByText('Cargos: Consultor de Vendas Balcão')).toBeInTheDocument()
    expect(within(tr).getByText('60 colaboradores')).toBeInTheDocument()
    expect(within(tr).getByText('60 com pendências')).toBeInTheDocument()
    expect(within(tr).getByText('Mensal')).toBeInTheDocument()
    expect(within(tr).getByText('11/2026')).toBeInTheDocument()
    expect(within(tr).getByText('Em aberto')).toBeInTheDocument()
    expect(within(tr).getByText('0 de 420 lançamentos')).toBeInTheDocument()
    expect(within(tr).getByRole('progressbar', { name: 'Progresso de lançamentos de PED' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('com as contagens 0, a linha não mostra as etiquetas de indicadores com problema nem de falta de tabela de faixas', async () => {
    const tabela = await abrirTabela()
    const tr = linha(tabela, 'PED')

    expect(within(tr).queryByText(/com problema/)).not.toBeInTheDocument()
    expect(within(tr).queryByText(/Sem tabela de faixas/)).not.toBeInTheDocument()
  })

  it('a consulta retroativa com a lista real vazia mostra "Nenhuma imagem congelada encontrada.", sem alerta', async () => {
    renderizarApp('/fechamentos')
    const regiao = await screen.findByRole('region', { name: TITULO_CONSULTA_IMAGENS })

    expect(await within(regiao).findByText(TEXTO_SEM_IMAGENS)).toBeInTheDocument()
    expect(within(regiao).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })
})
