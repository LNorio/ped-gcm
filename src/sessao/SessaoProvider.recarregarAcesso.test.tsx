import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { obterToken, limparToken } from '../services/sessao'
import {
  FILIAIS_API,
  TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API,
  TIPOS_FIXOS_ACESSO_API,
  acessoApi,
  respostaErro,
  respostaJson,
  respostaPendente,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../test/apiFalsa'
import { SessaoProvider, useSessao, type Sessao } from './SessaoProvider'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

/** Última sessão vista pelo consumidor (para chamar `recarregarAcesso` direto do teste). */
let sessaoAtual: Sessao | undefined
/** Estados pelos quais a sessão passou (registrados a cada mudança). */
let historicoEstados: string[] = []
/** Quantas vezes o consumidor foi montado (a releitura não pode desmontar a tela). */
let montagens = 0

function Consumidor() {
  const sessao = useSessao()
  useEffect(() => {
    sessaoAtual = sessao
  }, [sessao])
  useEffect(() => {
    montagens += 1
  }, [])
  useEffect(() => {
    historicoEstados.push(sessao.estado)
  }, [sessao.estado])
  const filial =
    sessao.filialSelecionada === 'todas'
      ? 'todas'
      : sessao.filialSelecionada === null
        ? ''
        : sessao.filialSelecionada.codigo
  return (
    <div>
      <output aria-label="Estado">{sessao.estado}</output>
      <output aria-label="Nome">{sessao.acesso?.nome ?? ''}</output>
      <output aria-label="Perfil">{sessao.acesso?.perfil ?? ''}</output>
      <output aria-label="Erro">{sessao.erro ?? ''}</output>
      <output aria-label="Filial">{filial}</output>
      <output aria-label="Tipos">{(sessao.acesso?.tipos ?? []).map((tipo) => `${tipo.id}:${tipo.nome}`).join('|')}</output>
    </div>
  )
}

const estado = () => screen.getByRole('status', { name: 'Estado' })
const nome = () => screen.getByRole('status', { name: 'Nome' })
const perfil = () => screen.getByRole('status', { name: 'Perfil' })
const erro = () => screen.getByRole('status', { name: 'Erro' })
const filial = () => screen.getByRole('status', { name: 'Filial' })
const tipos = () => screen.getByRole('status', { name: 'Tipos' })

const textoTipos = (lista: Array<{ id: number; nome: string }>) => lista.map((tipo) => `${tipo.id}:${tipo.nome}`).join('|')

const ACESSO_INICIAL = acessoApi({ perfil: 'admin', tipos: TIPOS_FIXOS_ACESSO_API, 'todas as filiais': true, filiais: FILIAIS_API })
const ACESSO_COM_DP = acessoApi({
  perfil: 'admin',
  tipos: TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API,
  'todas as filiais': true,
  filiais: FILIAIS_API,
})

const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')

describe('F2.1 — Autenticação e sessão: recarregarAcesso() (releitura do acesso sem deslogar)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessaoAtual = undefined
    historicoEstados = []
    montagens = 0
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  /** Monta a sessão restaurada (1º GET /acesso) e espera ficar autenticada. */
  async function montarAutenticado(...releituras: RotaFalsa[]) {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': rotaEmSequencia(() => respostaJson(ACESSO_INICIAL), ...releituras),
    })
    const resultado = render(
      <SessaoProvider>
        <Consumidor />
      </SessaoProvider>,
    )
    await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
    historicoEstados = []
    return { chamadas, ...resultado }
  }

  async function recarregar(): Promise<unknown> {
    let retorno: unknown = 'nao-resolvido'
    await act(async () => {
      retorno = await sessaoAtual!.recarregarAcesso()
    })
    return retorno
  }

  it('o contexto da sessão expõe recarregarAcesso como função', async () => {
    await montarAutenticado()

    expect(typeof sessaoAtual!.recarregarAcesso).toBe('function')
  })

  it('chama GET /api/ped/acesso de novo com o Bearer e troca os tipos pelos da resposta (7 fixos → 8 com "Departamento Pessoal"), resolvendo sem valor', async () => {
    const { chamadas } = await montarAutenticado(() => respostaJson(ACESSO_COM_DP))
    expect(tipos()).toHaveTextContent(textoTipos(TIPOS_FIXOS_ACESSO_API))

    const retorno = await recarregar()

    expect(retorno).toBeUndefined()
    expect(getsAcesso(chamadas)).toHaveLength(2)
    expect(new Headers(getsAcesso(chamadas)[1].init?.headers).get('Authorization')).toBe('Bearer token-salvo')
    expect(tipos()).toHaveTextContent(textoTipos(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API))
    expect(tipos()).toHaveTextContent('8:Departamento Pessoal')
    expect(estado()).toHaveTextContent('autenticado')
    expect(erro()).toHaveTextContent('')
    expect(obterToken()).toBe('token-salvo')
  })

  it('atualiza também o perfil e os demais dados do acesso (ex.: nome), sem deslogar', async () => {
    await montarAutenticado(() =>
      respostaJson(acessoApi({ perfil: 'validador', nome: 'Fulano de Tal', tipos: TIPOS_FIXOS_ACESSO_API, 'todas as filiais': true, filiais: FILIAIS_API })),
    )
    expect(perfil()).toHaveTextContent('admin')

    await recarregar()

    expect(perfil()).toHaveTextContent('validador')
    expect(nome()).toHaveTextContent('Fulano de Tal')
    expect(estado()).toHaveTextContent('autenticado')
  })

  it('não passa por "carregando" nem desmonta a tela: enquanto a releitura está pendente, o acesso anterior continua exposto', async () => {
    const pendente = respostaPendente()
    await montarAutenticado(pendente.rota)
    expect(montagens).toBe(1)

    let promessa: Promise<void> | undefined
    act(() => {
      promessa = sessaoAtual!.recarregarAcesso()
    })

    expect(estado()).toHaveTextContent('autenticado')
    expect(tipos()).toHaveTextContent(textoTipos(TIPOS_FIXOS_ACESSO_API))

    await act(async () => {
      pendente.responder(respostaJson(ACESSO_COM_DP))
      await promessa
    })

    expect(tipos()).toHaveTextContent('8:Departamento Pessoal')
    expect(historicoEstados).not.toContain('carregando')
    expect(historicoEstados).not.toContain('anonimo')
    expect(montagens).toBe(1)
  })

  describe('filial selecionada', () => {
    it('preserva a filial escolhida no cabeçalho quando ela continua no acesso', async () => {
      await montarAutenticado(() => respostaJson(ACESSO_COM_DP))
      act(() => sessaoAtual!.selecionarFilial('102'))
      expect(filial()).toHaveTextContent('102')

      await recarregar()

      expect(filial()).toHaveTextContent('102')
    })

    it('preserva "todas" quando o usuário continua com todas as filiais', async () => {
      await montarAutenticado(() => respostaJson(ACESSO_COM_DP))
      expect(filial()).toHaveTextContent('todas')

      await recarregar()

      expect(filial()).toHaveTextContent('todas')
    })

    it('se a filial escolhida saiu do acesso, volta à filial inicial do novo acesso (a primeira da lista)', async () => {
      await montarAutenticado(() =>
        respostaJson(acessoApi({ perfil: 'admin', tipos: TIPOS_FIXOS_ACESSO_API, 'todas as filiais': false, filiais: [FILIAIS_API[0], FILIAIS_API[1]] })),
      )
      act(() => sessaoAtual!.selecionarFilial('102'))
      expect(filial()).toHaveTextContent('102')

      await recarregar()

      expect(filial()).toHaveTextContent('100')
    })
  })

  describe('falhas', () => {
    it.each([
      ['500', () => respostaErro(500)],
      ['403', () => respostaErro(403, 'Sem permissão.')],
      ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ] as Array<[string, RotaFalsa]>)(
      '%s: mantém o acesso anterior, resolve normalmente (não rejeita) e não expõe erro nem desloga',
      async (_caso, rota) => {
        const { chamadas } = await montarAutenticado(rota)
        act(() => sessaoAtual!.selecionarFilial('101'))
        await waitFor(() => expect(filial()).toHaveTextContent('101'))
        historicoEstados = []

        const retorno = await recarregar()

        expect(retorno).toBeUndefined()
        await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(2))
        // Dá tempo a qualquer atualização tardia de estado (sob carga) antes de conferir que nada mudou.
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        expect(estado()).toHaveTextContent('autenticado')
        expect(tipos()).toHaveTextContent(textoTipos(TIPOS_FIXOS_ACESSO_API))
        expect(perfil()).toHaveTextContent('admin')
        expect(filial()).toHaveTextContent('101')
        expect(erro()).toHaveTextContent('')
        expect(obterToken()).toBe('token-salvo')
        expect(historicoEstados).toEqual([])
      },
    )

    it('401: segue o fluxo de sessão expirada (anônimo, token limpo, "Sua sessão expirou. Entre novamente.") sem rejeitar para quem chamou', async () => {
      await montarAutenticado(() => respostaErro(401))

      let rejeitou = false
      await act(async () => {
        await sessaoAtual!.recarregarAcesso().catch(() => {
          rejeitou = true
        })
      })

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
      expect(obterToken()).toBeNull()
      expect(rejeitou).toBe(false)
    })
  })

  describe('chamadas concorrentes', () => {
    it('a resposta da chamada mais recente vence: a resposta atrasada de uma chamada anterior é descartada', async () => {
      const primeira = respostaPendente()
      const segunda = respostaPendente()
      const { chamadas } = await montarAutenticado(primeira.rota, segunda.rota)
      const ACESSO_ANTIGO = acessoApi({
        perfil: 'admin',
        tipos: [{ id: 1, nome: 'Comercial' }],
        'todas as filiais': true,
        filiais: FILIAIS_API,
      })

      let p1: Promise<void> | undefined
      let p2: Promise<void> | undefined
      act(() => {
        p1 = sessaoAtual!.recarregarAcesso()
        p2 = sessaoAtual!.recarregarAcesso()
      })
      expect(getsAcesso(chamadas)).toHaveLength(3)

      await act(async () => {
        segunda.responder(respostaJson(ACESSO_COM_DP))
        await p2
      })
      expect(tipos()).toHaveTextContent('8:Departamento Pessoal')

      await act(async () => {
        primeira.responder(respostaJson(ACESSO_ANTIGO))
        await p1
      })

      expect(tipos()).toHaveTextContent(textoTipos(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API))
    })

    it('uma chamada anterior que falha depois de a mais recente responder não altera o acesso nem expõe erro', async () => {
      const primeira = respostaPendente()
      await montarAutenticado(primeira.rota, () => respostaJson(ACESSO_COM_DP))

      let p1: Promise<void> | undefined
      act(() => {
        p1 = sessaoAtual!.recarregarAcesso()
      })
      await recarregar()
      expect(tipos()).toHaveTextContent('8:Departamento Pessoal')

      await act(async () => {
        primeira.responder(respostaErro(500))
        await p1
      })

      expect(tipos()).toHaveTextContent('8:Departamento Pessoal')
      expect(erro()).toHaveTextContent('')
      expect(estado()).toHaveTextContent('autenticado')
    })
  })

  it('desmontar com a releitura pendente não gera erro nem aviso no console', async () => {
    const pendente = respostaPendente()
    const consoleErro = vi.spyOn(console, 'error')
    const { unmount } = await montarAutenticado(pendente.rota)

    let promessa: Promise<void> | undefined
    act(() => {
      promessa = sessaoAtual!.recarregarAcesso()
    })
    unmount()

    await act(async () => {
      pendente.responder(respostaJson(ACESSO_COM_DP))
      await promessa
    })

    expect(consoleErro).not.toHaveBeenCalled()
  })
})
