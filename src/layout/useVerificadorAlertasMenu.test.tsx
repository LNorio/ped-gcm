import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESSAO_EXPIRADA } from '../services/api'
import { definirToken, limparToken } from '../services/sessao'
import type { Aba } from '../sessao/permissoes'
import type { Sessao } from '../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import {
  respostaErro,
  respostaJson,
  respostaPendente,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../test/apiFalsa'
import {
  CHAVE_ROTA_ALERTAS_MENU,
  ROTA_ALERTAS_MENU,
  alertasMenuAdminApi,
  alertasMenuAdminSemAlertasApi,
  respostaLimiteAlertasMenu,
} from '../test/alertasMenuFalsos'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { AlertasMenuProvider, useAlertasMenu, type AlertasMenuContexto } from './AlertasMenu'
import { useVerificadorAlertasMenu } from './useVerificadorAlertasMenu'

/**
 * Verificador central dos alertas do menu (F2.12): consulta `GET /api/ped/alertas-menu` com a sessão
 * autenticada (ao montar/autenticar, ao trocar a filial, no `focus` da janela e a cada 5 minutos com a aba
 * do navegador visível) e acende/apaga as abas do menu pelo `definirAlerta` do `AlertasMenuProvider`.
 */
const CINCO_MINUTOS = 5 * 60 * 1000

const ACESSO_ADMIN = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
const ACESSO_PREENCHEDOR = acessoFalso({ perfil: 'preenchedor', todasAsFiliais: false, filiais: [FILIAIS[1], FILIAIS[2]] })

const SESSAO_ADMIN: Partial<Sessao> = { estado: 'autenticado', acesso: ACESSO_ADMIN, filialSelecionada: 'todas' }

/** Último valor do contexto dos alertas, lido pelos testes depois de cada renderização. */
const sonda: { contexto: AlertasMenuContexto | null } = { contexto: null }

function Sonda() {
  useVerificadorAlertasMenu()
  const valor = useAlertasMenu()
  useEffect(() => {
    sonda.contexto = valor
  })
  return null
}

const contexto = {
  get abasComAlerta() {
    return sonda.contexto!.abasComAlerta
  },
  definirAlerta(aba: Aba, ativo: boolean) {
    sonda.contexto!.definirAlerta(aba, ativo)
  },
}

function arvore(sessao: Partial<Sessao>) {
  return (
    <ProvedorSessaoFalso sessao={sessao}>
      <AlertasMenuProvider>
        <Sonda />
      </AlertasMenuProvider>
    </ProvedorSessaoFalso>
  )
}

const acesas = () => [...contexto.abasComAlerta].sort()

function consultas(chamadas: ChamadaRegistrada[]) {
  return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_ALERTAS_MENU)
}

function corpoAbas(abas: Record<string, { total: number; itens: Array<{ codigo: string; quantidade: number; descricao: string | null }> }>) {
  return respostaJson({ abas })
}

/** Deixa promessas e timers pendentes rodarem, avançando o relógio falso. */
async function avancar(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function focarJanela() {
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
  })
}

let visibilidade: DocumentVisibilityState = 'visible'

describe('F2.12 — useVerificadorAlertasMenu (verificador central dos alertas do menu)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    visibilidade = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidade })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
    // Volta ao getter do protótipo (Document.prototype.visibilityState).
    delete (document as unknown as Record<string, unknown>).visibilityState
  })

  function simular(rota: RotaFalsa) {
    return simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: rota })
  }

  describe('quando consulta', () => {
    it('com a sessão autenticada e com perfil, consulta GET /api/ped/alertas-menu ao montar, sem ?filial', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))

      render(arvore(SESSAO_ADMIN))

      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
      expect(consultas(chamadas)[0].url.search).toBe('')
    })

    it.each<[string, Partial<Sessao>]>([
      ['anônima', { estado: 'anonimo', acesso: null, filialSelecionada: null }],
      ['carregando', { estado: 'carregando', acesso: null, filialSelecionada: null }],
      ['sem acesso (perfil null)', { estado: 'sem-acesso', acesso: acessoFalso({ perfil: null }) }],
    ])('com a sessão %s, não consulta', async (_nome, sessao) => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))

      render(arvore(sessao))
      await avancar(CINCO_MINUTOS)
      await focarJanela()

      expect(consultas(chamadas)).toHaveLength(0)
    })

    it('consulta ao autenticar (carregando → autenticado)', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      const { rerender } = render(arvore({ estado: 'carregando', acesso: null, filialSelecionada: null }))
      await avancar()
      expect(consultas(chamadas)).toHaveLength(0)

      rerender(arvore(SESSAO_ADMIN))

      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
    })

    it('consulta de novo ao trocar a filial selecionada (e não ao rerenderizar com a mesma filial)', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      const { rerender } = render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      rerender(arvore(SESSAO_ADMIN))
      await avancar()
      expect(consultas(chamadas)).toHaveLength(1)

      rerender(arvore({ ...SESSAO_ADMIN, filialSelecionada: FILIAIS[2] }))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
      // A rota não aceita filial: a troca só dispara a consulta.
      expect(consultas(chamadas)[1].url.search).toBe('')

      rerender(arvore({ ...SESSAO_ADMIN, filialSelecionada: FILIAIS[1] }))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(3))
    })

    it('consulta de novo no evento focus da janela', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      await focarJanela()

      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
    })

    it('consulta a cada 5 minutos com a aba do navegador visível', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      await avancar(CINCO_MINUTOS - 1000)
      expect(consultas(chamadas)).toHaveLength(1)

      await avancar(2000)
      expect(consultas(chamadas)).toHaveLength(2)

      await avancar(CINCO_MINUTOS)
      expect(consultas(chamadas)).toHaveLength(3)
    })

    it('com a aba do navegador oculta (visibilityState hidden), o intervalo de 5 minutos não consulta', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      visibilidade = 'hidden'
      await avancar(CINCO_MINUTOS)
      await avancar(CINCO_MINUTOS)

      expect(consultas(chamadas)).toHaveLength(1)
    })

    it('ao desmontar, para de consultar (intervalo e focus)', async () => {
      const chamadas = simular(() => respostaJson(alertasMenuAdminApi()))
      const { unmount } = render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      unmount()
      await avancar(CINCO_MINUTOS)
      await focarJanela()

      expect(consultas(chamadas)).toHaveLength(1)
    })

    it('não dispara uma nova consulta enquanto outra está em andamento', async () => {
      const pendente = respostaPendente()
      const chamadas = simular(rotaEmSequencia(pendente.rota, () => respostaJson(alertasMenuAdminApi())))
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      await focarJanela()
      await focarJanela()
      await avancar(CINCO_MINUTOS)
      expect(consultas(chamadas)).toHaveLength(1)

      await act(async () => {
        pendente.responder(respostaJson(alertasMenuAdminApi()))
        await vi.advanceTimersByTimeAsync(0)
      })
      await waitFor(() => expect(acesas()).toEqual(['dados-externos', 'indicadores']))

      await focarJanela()
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
    })
  })

  describe('como marca as abas', () => {
    it('acende as abas com total > 0 (exemplo do Admin: Indicadores e Dados externos)', async () => {
      simular(() => respostaJson(alertasMenuAdminApi()))

      render(arvore(SESSAO_ADMIN))

      await waitFor(() => expect(acesas()).toEqual(['dados-externos', 'indicadores']))
    })

    it('apaga a aba visível que veio com total 0', async () => {
      const chamadas = simular(
        rotaEmSequencia(
          () => respostaJson(alertasMenuAdminApi()),
          () => respostaJson(alertasMenuAdminSemAlertasApi()),
        ),
      )
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(acesas()).toEqual(['dados-externos', 'indicadores']))

      await focarJanela()

      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
      await waitFor(() => expect(acesas()).toEqual([]))
    })

    it('total 0 também apaga um alerta informado por uma tela (definirAlerta)', async () => {
      const pendente = respostaPendente()
      simular(pendente.rota)
      render(arvore(SESSAO_ADMIN))
      act(() => {
        contexto.definirAlerta('indicadores', true)
      })
      expect(acesas()).toEqual(['indicadores'])

      await act(async () => {
        pendente.responder(respostaJson(alertasMenuAdminSemAlertasApi()))
        await vi.advanceTimersByTimeAsync(0)
      })

      await waitFor(() => expect(acesas()).toEqual([]))
    })

    it('aba visível que não veio na resposta fica como está', async () => {
      const pendente = respostaPendente()
      simular(pendente.rota)
      render(arvore(SESSAO_ADMIN))
      act(() => {
        contexto.definirAlerta('faixas', true)
      })

      await act(async () => {
        pendente.responder(
          corpoAbas({
            indicadores: { total: 1, itens: [{ codigo: 'aguardando meta', quantidade: 1, descricao: '1 indicador aguardando definição de meta' }] },
          }),
        )
        await vi.advanceTimersByTimeAsync(0)
      })

      await waitFor(() => expect(acesas()).toEqual(['faixas', 'indicadores']))
    })

    it('cruza com as abas do perfil: o Preenchedor não acende Indicadores mesmo se a resposta trouxer a chave', async () => {
      simular(() =>
        corpoAbas({
          inicio: { total: 0, itens: [] },
          indicadores: { total: 2, itens: [{ codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' }] },
          'dados-externos': { total: 1, itens: [{ codigo: 'integracao pendente', quantidade: 1, descricao: '1 dado externo sem integração configurada' }] },
        }),
      )

      render(arvore({ estado: 'autenticado', acesso: ACESSO_PREENCHEDOR, filialSelecionada: FILIAIS[1] }))

      // `dados-externos` acende porque a rota mandou total > 0: o front não filtra além do menu.
      await waitFor(() => expect(acesas()).toEqual(['dados-externos']))
      expect(contexto.abasComAlerta.has('indicadores')).toBe(false)
    })

    it('chaves desconhecidas na resposta não quebram nem acendem nada', async () => {
      simular(() =>
        corpoAbas({
          relatorios: { total: 9, itens: [{ codigo: 'novo', quantidade: 9, descricao: '9 relatórios' }] },
          tipos: { total: 1, itens: [{ codigo: 'novo', quantidade: 1, descricao: '1 tipo novo' }] },
        }),
      )

      render(arvore(SESSAO_ADMIN))

      await waitFor(() => expect(acesas()).toEqual(['tipos']))
    })
  })

  describe('erros', () => {
    async function montarComAlertasEFalharNaSegunda(segunda: RotaFalsa) {
      const chamadas = simular(rotaEmSequencia(() => respostaJson(alertasMenuAdminApi()), segunda))
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(acesas()).toEqual(['dados-externos', 'indicadores']))
      await focarJanela()
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
      await avancar()
      return chamadas
    }

    it.each<[string, RotaFalsa]>([
      ['403', () => respostaErro(403, 'usuario sem acesso ao ped')],
      ['500', () => respostaErro(500, 'erro ao consultar os alertas do menu')],
      [
        'falha de rede',
        () => {
          throw new TypeError('Failed to fetch')
        },
      ],
    ])('%s mantém os alertas anteriores', async (_nome, segunda) => {
      await montarComAlertasEFalharNaSegunda(segunda)

      expect(acesas()).toEqual(['dados-externos', 'indicadores'])
    })

    it('403 na primeira consulta não acende nenhuma aba', async () => {
      const chamadas = simular(() => respostaErro(403, 'usuario sem acesso ao ped'))

      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
      await avancar()

      expect(acesas()).toEqual([])
    })

    it('depois de uma falha (500), o próximo gatilho consulta de novo e aplica a resposta', async () => {
      const chamadas = simular(
        rotaEmSequencia(
          () => respostaErro(500, 'erro ao consultar os alertas do menu'),
          () => respostaJson(alertasMenuAdminApi()),
        ),
      )
      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
      await avancar()

      await focarJanela()

      await waitFor(() => expect(consultas(chamadas)).toHaveLength(2))
      await waitFor(() => expect(acesas()).toEqual(['dados-externos', 'indicadores']))
    })

    it('429 mantém os alertas e não consulta de novo antes do Retry-After; depois dele, volta a consultar', async () => {
      // Retry-After de 7 minutos: bloqueia o intervalo de 5 minutos e o focus nesse meio-tempo.
      const chamadas = await montarComAlertasEFalharNaSegunda(() => respostaLimiteAlertasMenu(420))
      expect(acesas()).toEqual(['dados-externos', 'indicadores'])

      await avancar(CINCO_MINUTOS)
      await focarJanela()
      await avancar(60 * 1000)
      await focarJanela()
      expect(consultas(chamadas)).toHaveLength(2)
      expect(acesas()).toEqual(['dados-externos', 'indicadores'])

      await avancar(61 * 1000)
      await focarJanela()

      // Passado o Retry-After, o focus volta a consultar (uma nova tentativa automática no fim da espera
      // também é aceita).
      await waitFor(() => expect(consultas(chamadas).length).toBeGreaterThanOrEqual(3))
    })

    it('401 não acende abas e segue o tratamento da sessão (evento de sessão expirada)', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      const chamadas = simular(() => respostaErro(401))

      render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))
      await avancar()

      expect(ouvinte).toHaveBeenCalled()
      expect(acesas()).toEqual([])
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
    })
  })

  describe('resposta atrasada', () => {
    it('a resposta que chega depois de sair da sessão é descartada', async () => {
      const pendente = respostaPendente()
      const chamadas = simular(pendente.rota)
      const { rerender } = render(arvore(SESSAO_ADMIN))
      await waitFor(() => expect(consultas(chamadas)).toHaveLength(1))

      rerender(arvore({ estado: 'anonimo', acesso: null, filialSelecionada: null }))
      await act(async () => {
        pendente.responder(respostaJson(alertasMenuAdminApi()))
        await vi.advanceTimersByTimeAsync(0)
      })
      await avancar()

      expect(acesas()).toEqual([])
    })
  })
})
