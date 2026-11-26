import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../test/apiFalsa'
import {
  CHAVE_ROTA_ALERTAS_MENU,
  MENSAGEM_ERRO_ALERTAS_MENU,
  ROTA_ALERTAS_MENU,
  alertasMenuAdminApi,
  alertasMenuAdminSemAlertasApi,
  alertasMenuPreenchedorApi,
  respostaLimiteAlertasMenu,
  rotaAlertasMenuFalsa,
} from '../test/alertasMenuFalsos'
import { rotasDoInicio } from '../test/inicioFalsos'
import { renderizarApp } from '../test/renderizarApp'
import { usuarioRapido } from '../test/usuario'

/**
 * F2.12 — alertas das abas do menu desde o login (integração: sessão + layout + verificador + serviço,
 * só a rede simulada). O caso principal: depois do login, a aba Indicadores aparece acesa no menu sem
 * que a tela /indicadores seja visitada.
 */
const DICA_INDICADORES_ADMIN =
  '2 indicadores aguardando definição de meta · 3 indicadores com filial sem meta · 1 indicador com integração da meta pendente'
const DICA_INDICADORES_VALIDADOR = '2 indicadores aguardando definição de meta · 1 indicador com integração da meta pendente'
const DICA_DADOS_EXTERNOS_ADMIN = '4 dados externos sem integração configurada'

const abas = () => screen.getByRole('navigation', { name: 'Abas' })
const link = (nome: RegExp) => within(abas()).getByRole('link', { name: nome })
const marcador = (nome: RegExp) => within(link(nome)).queryByRole('img', { name: 'Com alertas' })

function consultas(chamadas: ChamadaRegistrada[]) {
  return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_ALERTAS_MENU)
}

function chamadasDe(chamadas: ChamadaRegistrada[], caminho: string) {
  return chamadas.filter((c) => c.caminho === caminho)
}

async function focarJanela() {
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
}

describe('F2.12 — Alertas das abas do menu desde o login (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Sessão restaurada (token salvo) com o perfil e a rota de alertas informada. */
  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', alertas: RotaFalsa, extras: Record<string, RotaFalsa> = {}) {
    sessionStorage.setItem('ped.token', 'token-salvo')
    return simularApi(fetchFalso, rotasDoInicio(perfil, { [CHAVE_ROTA_ALERTAS_MENU]: alertas, ...extras }))
  }

  describe('login', () => {
    it('Admin: depois do login, Indicadores e Dados Externos aparecem acesos no menu sem visitar /indicadores', async () => {
      const user = usuarioRapido()
      const chamadas = simularApi(
        fetchFalso,
        rotasDoInicio('admin', {
          'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
          'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
          [CHAVE_ROTA_ALERTAS_MENU]: rotaAlertasMenuFalsa('admin'),
        }),
      )
      const { roteador } = renderizarApp('/login')

      await user.type(await screen.findByLabelText('Usuário'), 'fulano')
      await user.type(screen.getByLabelText('Senha'), 'segredo')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()

      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      expect(marcador(/^Indicadores/)).toHaveAccessibleDescription(DICA_INDICADORES_ADMIN)
      expect(marcador(/^Dados Externos/)).not.toBeNull()
      expect(marcador(/^Dados Externos/)).toHaveAccessibleDescription(DICA_DADOS_EXTERNOS_ADMIN)
      for (const nome of [/^Início/, /^Tipos/, /^Apontamentos/, /^Faixas/, /^Dashboards/, /^Preenchimento/, /^Fechamentos/]) {
        expect(marcador(nome)).toBeNull()
      }

      // Sem abrir as telas: continua no Início (a tela Indicadores não foi aberta) e a rota de integrações
      // pendentes da tela Dados externos não foi lida.
      expect(roteador.state.location.pathname).toBe('/')
      expect(screen.queryByRole('heading', { level: 1, name: 'Indicadores' })).not.toBeInTheDocument()
      expect(chamadasDe(chamadas, '/api/ped/dados-externos-cadastro/integracoes-pendentes')).toHaveLength(0)

      // A rota é chamada com o token do login e sem ?filial.
      const consulta = consultas(chamadas)[0]
      expect(consulta.url.search).toBe('')
      expect(cabecalhoDaChamada(consulta, 'Authorization')).toBe('Bearer token-123')
    })

    it('sessão restaurada (recarga da página): o menu já abre com os alertas', async () => {
      const chamadas = simularSessao('admin', rotaAlertasMenuFalsa('admin'))
      renderizarApp('/')

      await screen.findByRole('heading', { level: 1, name: 'Início' })
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      expect(consultas(chamadas).length).toBeGreaterThanOrEqual(1)
    })

    it('ao sair, o menu deixa de existir e não há mais consultas no focus', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', rotaAlertasMenuFalsa('admin'))
      renderizarApp('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      const antes = consultas(chamadas).length

      await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sair' }))
      await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })
      await focarJanela()

      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
      expect(consultas(chamadas)).toHaveLength(antes)
    })
  })

  describe('perfis', () => {
    it('Validador: Indicadores acende com a integração pendente na dica; Dados Externos (total 0) fica apagada', async () => {
      simularSessao('validador', rotaAlertasMenuFalsa('validador'))
      renderizarApp('/')

      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      expect(marcador(/^Indicadores/)).toHaveAccessibleDescription(DICA_INDICADORES_VALIDADOR)
      expect(marcador(/^Dados Externos/)).toBeNull()
    })

    it('Preenchedor: só Início, Apontamentos, Dados Externos e Preenchimento; sem alertas, nenhum marcador', async () => {
      const chamadas = simularSessao('preenchedor', rotaAlertasMenuFalsa('preenchedor'))
      renderizarApp('/')

      await screen.findByRole('heading', { level: 1, name: 'Início' })
      await waitFor(() => expect(consultas(chamadas).length).toBeGreaterThanOrEqual(1))
      expect(within(abas()).getAllByRole('link').map((l) => l.textContent)).toEqual([
        'Início',
        'Apontamentos',
        'Dados Externos',
        'Preenchimento',
      ])
      expect(screen.queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
    })

    it('Preenchedor: Dados Externos acende quando a rota manda total > 0 (o front não filtra além do menu)', async () => {
      simularSessao('preenchedor', () =>
        respostaJson({
          abas: {
            ...alertasMenuPreenchedorApi().abas,
            'dados-externos': {
              total: 1,
              itens: [{ codigo: 'integracao pendente', quantidade: 1, descricao: '1 dado externo sem integração configurada' }],
            },
          },
        }),
      )
      renderizarApp('/')

      await waitFor(() => expect(marcador(/^Dados Externos/)).not.toBeNull())
      expect(marcador(/^Dados Externos/)).toHaveAccessibleDescription('1 dado externo sem integração configurada')
    })
  })

  describe('gatilhos', () => {
    it('trocar a filial no cabeçalho consulta de novo e aplica a nova resposta', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao(
        'admin',
        rotaEmSequencia(
          () => respostaJson(alertasMenuAdminApi()),
          () => respostaJson(alertasMenuAdminSemAlertasApi()),
        ),
      )
      renderizarApp('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      const antes = consultas(chamadas).length

      await user.selectOptions(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' }), '102')

      await waitFor(() => expect(consultas(chamadas).length).toBe(antes + 1))
      expect(consultas(chamadas).at(-1)!.url.search).toBe('')
      await waitFor(() => expect(marcador(/^Indicadores/)).toBeNull())
      expect(marcador(/^Dados Externos/)).toBeNull()
    })

    it('a janela voltar ao foco consulta de novo e acende a aba que passou a ter alerta', async () => {
      const chamadas = simularSessao(
        'admin',
        rotaEmSequencia(
          () => respostaJson(alertasMenuAdminSemAlertasApi()),
          () => respostaJson(alertasMenuAdminApi()),
        ),
      )
      renderizarApp('/')
      await waitFor(() => expect(consultas(chamadas).length).toBe(1))
      await screen.findByRole('heading', { level: 1, name: 'Início' })
      expect(marcador(/^Indicadores/)).toBeNull()

      await focarJanela()

      await waitFor(() => expect(consultas(chamadas).length).toBe(2))
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())
      expect(marcador(/^Dados Externos/)).toHaveAccessibleDescription(DICA_DADOS_EXTERNOS_ADMIN)
    })
  })

  describe('erros', () => {
    it('500: mantém os alertas anteriores, sem mensagem na tela', async () => {
      const chamadas = simularSessao(
        'admin',
        rotaEmSequencia(
          () => respostaJson(alertasMenuAdminApi()),
          () => respostaErro(500, MENSAGEM_ERRO_ALERTAS_MENU),
        ),
      )
      renderizarApp('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())

      await focarJanela()
      await waitFor(() => expect(consultas(chamadas).length).toBe(2))
      // Deixa a resposta de erro ser processada.
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 20))
      })

      expect(marcador(/^Indicadores/)).not.toBeNull()
      expect(marcador(/^Dados Externos/)).not.toBeNull()
      expect(screen.queryByText(MENSAGEM_ERRO_ALERTAS_MENU)).not.toBeInTheDocument()
      expect(screen.queryByText('Erro interno do servidor. Tente novamente mais tarde.')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    })

    it('500 logo na abertura: nenhuma aba acesa e nenhuma mensagem; o Início abre normalmente', async () => {
      simularSessao('admin', () => respostaErro(500, MENSAGEM_ERRO_ALERTAS_MENU))
      renderizarApp('/')

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 20))
      })
      expect(screen.queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
      expect(screen.queryByText(MENSAGEM_ERRO_ALERTAS_MENU)).not.toBeInTheDocument()
    })

    it('429: mantém os alertas e não consulta de novo antes do Retry-After; depois dele, o focus volta a consultar', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const chamadas = simularSessao(
        'admin',
        rotaEmSequencia(
          () => respostaJson(alertasMenuAdminApi()),
          () => respostaLimiteAlertasMenu(60),
          () => respostaJson(alertasMenuAdminSemAlertasApi()),
        ),
      )
      renderizarApp('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())

      await focarJanela()
      await waitFor(() => expect(consultas(chamadas).length).toBe(2))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 1000)
      })
      await focarJanela()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(consultas(chamadas).length).toBe(2)
      expect(marcador(/^Indicadores/)).not.toBeNull()
      expect(screen.queryByText('Muitas consultas. Tente novamente em instantes.')).not.toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31 * 1000)
      })
      await focarJanela()

      await waitFor(() => expect(consultas(chamadas).length).toBeGreaterThanOrEqual(3))
      await waitFor(() => expect(marcador(/^Indicadores/)).toBeNull())
    })

    it('401: segue o tratamento atual da sessão (volta ao login com a mensagem de sessão expirada)', async () => {
      simularSessao('admin', () => respostaErro(401))
      renderizarApp('/')

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
    })
  })
})
