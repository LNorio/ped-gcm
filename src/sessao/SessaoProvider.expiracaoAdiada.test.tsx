import { render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESSAO_EXPIRADA } from '../services/api'
import { limparToken, obterToken } from '../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../test/apiFalsa'
import { rotaInicioFalsa } from '../test/inicioFalsos'
import { renderizarApp } from '../test/renderizarApp'
import { usuarioRapido } from '../test/usuario'
import { ouvirAcessoObtido, type AcessoObtido } from './acessoObtido'
import { SessaoProvider, useSessao, type EstadoSessao } from './SessaoProvider'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

/** Estados da sessão efetivamente exibidos (um por commit), na ordem. */
let estadosExibidos: EstadoSessao[] = []

function Consumidor() {
  const sessao = useSessao()
  useEffect(() => {
    estadosExibidos.push(sessao.estado)
  }, [sessao.estado])
  const filial =
    sessao.filialSelecionada === 'todas' ? 'todas' : sessao.filialSelecionada === null ? '' : sessao.filialSelecionada.codigo
  return (
    <div>
      <output aria-label="Estado">{sessao.estado}</output>
      <output aria-label="Nome">{sessao.acesso?.nome ?? ''}</output>
      <output aria-label="Erro">{sessao.erro ?? ''}</output>
      <output aria-label="Filial">{filial}</output>
      <button
        type="button"
        onClick={() => {
          sessao.entrar('fulano', 'segredo').catch(() => {})
        }}
      >
        Entrar
      </button>
    </div>
  )
}

function renderizar() {
  return render(
    <SessaoProvider>
      <Consumidor />
    </SessaoProvider>,
  )
}

const estado = () => screen.getByRole('status', { name: 'Estado' })
const nome = () => screen.getByRole('status', { name: 'Nome' })
const erro = () => screen.getByRole('status', { name: 'Erro' })
const filial = () => screen.getByRole('status', { name: 'Filial' })

/** Simula o 401 de uma consulta antecipada que chega antes de a sessão autenticada ser exibida. */
function expirarAoObterAcesso(vezes = 1) {
  let restantes = vezes
  return ouvirAcessoObtido(() => {
    if (restantes <= 0) return
    restantes -= 1
    window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
  })
}

describe('F2.5 — Sessão expirada adiada (401 de consulta antecipada antes de a sessão aparecer)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let pararDeOuvir: (() => void) | null = null

  beforeEach(() => {
    estadosExibidos = []
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    pararDeOuvir?.()
    pararDeOuvir = null
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('aviso de acesso obtido: só com perfil no PED, com o acesso e a filial que a sessão vai selecionar', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'validador', filiais: [FILIAIS_API[2]] })),
    })
    const avisos: AcessoObtido[] = []
    pararDeOuvir = ouvirAcessoObtido((obtido) => avisos.push(obtido))

    renderizar()

    await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
    expect(avisos).toHaveLength(1)
    expect(avisos[0].acesso.perfil).toBe('validador')
    expect(avisos[0].filialSelecionada).toEqual({ codigo: '102', nome: 'DOURADOS', empresa: null })
  })

  it('aviso de acesso obtido: não é enviado para usuário sem perfil no PED', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: null, tipos: [], filiais: [] })),
    })
    const ouvinte = vi.fn()
    pararDeOuvir = ouvirAcessoObtido(ouvinte)

    renderizar()

    await waitFor(() => expect(estado()).toHaveTextContent('sem-acesso'))
    expect(ouvinte).not.toHaveBeenCalled()
  })

  it('na restauração: a sessão autenticada é exibida e logo depois expira, sem dados em memória', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
    })
    pararDeOuvir = expirarAoObterAcesso()

    renderizar()

    await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
    expect(estadosExibidos).toEqual(['carregando', 'autenticado', 'anonimo'])
    expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(nome()).toHaveTextContent('')
    expect(filial()).toHaveTextContent('')
    expect(obterToken()).toBeNull()
    expect(sessionStorage.getItem('ped.token')).toBeNull()
  })

  it('no login: a sessão autenticada é exibida e logo depois expira, sem dados em memória', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'preenchedor' })),
    })
    pararDeOuvir = expirarAoObterAcesso()
    renderizar()

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA))
    expect(estado()).toHaveTextContent('anonimo')
    expect(estadosExibidos).toEqual(['anonimo', 'autenticado', 'anonimo'])
    expect(nome()).toHaveTextContent('')
    expect(filial()).toHaveTextContent('')
    expect(obterToken()).toBeNull()
  })

  it('depois da expiração adiada, um novo login sem 401 permanece autenticado', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-novo' }),
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin' })),
    })
    pararDeOuvir = expirarAoObterAcesso(1)
    renderizar()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA))

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
    // Dá tempo a qualquer expiração residual (não deve haver nenhuma).
    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(estado()).toHaveTextContent('autenticado')
    expect(nome()).toHaveTextContent('Fulano')
    expect(erro()).toHaveTextContent('')
    expect(obterToken()).toBe('token-novo')
  })

  it('na aplicação: volta ao login com o aviso de sessão expirada', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/inicio': rotaInicioFalsa('admin'),
    })
    pararDeOuvir = expirarAoObterAcesso()

    renderizarApp('/')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(obterToken()).toBeNull()
    // O formulário de login está pronto para entrar de novo.
    const formulario = screen.getByRole('button', { name: 'Entrar' }).closest('form')
    expect(formulario).not.toBeNull()
    expect(within(formulario!).getByLabelText('Usuário')).toHaveValue('')
  })
})
