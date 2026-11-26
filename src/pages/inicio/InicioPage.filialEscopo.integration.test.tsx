/**
 * F11.1 — Tela Início: `?filial=` para todos os perfis, dentro do escopo (integração: app completo com a
 * rede simulada).
 *
 * D6 da resposta do back-end de 25/11/2026 (`docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`):
 * todos os perfis podem pedir uma filial dentro do próprio escopo (Admin e Validador: todas; os demais: a
 * própria mais a abrangência). O front não restringe o envio por perfil: a filial do cabeçalho vai em
 * `?filial={código}` para qualquer perfil; "Todas as filiais" (ou nenhuma filial) não envia o parâmetro.
 * Os dois `403` do escopo aparecem como a mensagem da API em `role="alert"`, com "Tentar novamente":
 * - filial fora do escopo: "voce nao tem acesso a esta filial";
 * - sem filial e sem abrangência: "usuario sem filial definida".
 */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  MENSAGEM_FILIAL_FORA_DO_ESCOPO,
  MENSAGEM_SEM_FILIAL_DEFINIDA,
  inicioPreenchedorApi,
  inicioValidadorApi,
  rotasDoInicio,
} from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/inicio'

describe('F11.1 — Tela Início: filial do cabeçalho para todos os perfis e os 403 do escopo (D6)', () => {
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

  const getsInicio = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })

  async function abrirInicio() {
    renderizarApp('/')
    return await screen.findByRole('heading', { level: 1, name: 'Início' })
  }

  /** Preenchedor com abrangência: a própria filial (101) e a 102. */
  const acessoPreenchedorComAbrangencia = () =>
    acessoApi({ perfil: 'preenchedor', 'todas as filiais': false, filiais: [FILIAIS_API[1], FILIAIS_API[2]] })

  it('Validador: escolher a filial 101 no cabeçalho consulta de novo com ?filial=101', async () => {
    const user = usuarioRapido()
    const chamadas = simularApi(fetchFalso, rotasDoInicio('validador'))
    await abrirInicio()
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
    expect(getsInicio(chamadas)[0].url.search).toBe('')

    await user.selectOptions(seletorFilial(), '101')

    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
    expect([...getsInicio(chamadas)[1].url.searchParams.entries()]).toEqual([['filial', '101']])
  })

  it('Preenchedor com abrangência: começa com ?filial=101 e, ao escolher a 102, consulta com ?filial=102', async () => {
    const user = usuarioRapido()
    const chamadas = simularApi(fetchFalso, {
      ...rotasDoInicio('preenchedor'),
      'GET /api/ped/acesso': () => respostaJson(acessoPreenchedorComAbrangencia()),
    })
    await abrirInicio()
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))
    expect([...getsInicio(chamadas)[0].url.searchParams.entries()]).toEqual([['filial', '101']])

    await user.selectOptions(seletorFilial(), '102')

    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
    expect([...getsInicio(chamadas)[1].url.searchParams.entries()]).toEqual([['filial', '102']])
  })

  it('filial fora do escopo (403 "voce nao tem acesso a esta filial"): mostra a mensagem e "Tentar novamente", mantendo o título', async () => {
    const user = usuarioRapido()
    const chamadas = simularApi(fetchFalso, {
      ...rotasDoInicio('preenchedor'),
      'GET /api/ped/acesso': () => respostaJson(acessoPreenchedorComAbrangencia()),
      [`GET ${ROTA}`]: (_init, url) =>
        url.searchParams.get('filial') === '102'
          ? respostaErro(403, MENSAGEM_FILIAL_FORA_DO_ESCOPO)
          : respostaJson(inicioPreenchedorApi()),
    })
    await abrirInicio()
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))

    await user.selectOptions(seletorFilial(), '102')

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_FILIAL_FORA_DO_ESCOPO)
    expect(getsInicio(chamadas).at(-1)!.url.searchParams.get('filial')).toBe('102')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
  })

  it('sem filial e sem abrangência (403 "usuario sem filial definida"): consulta sem ?filial e mostra a mensagem da API', async () => {
    const chamadas = simularApi(fetchFalso, {
      ...rotasDoInicio('preenchedor'),
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'preenchedor', 'todas as filiais': false, filiais: [] })),
      [`GET ${ROTA}`]: () => respostaErro(403, MENSAGEM_SEM_FILIAL_DEFINIDA),
    })

    await abrirInicio()

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_FILIAL_DEFINIDA)
    expect(getsInicio(chamadas)[0].url.search).toBe('')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('Validador com a filial escolhida recebe a resposta da própria filial (a API filtra pelo escopo)', async () => {
    const user = usuarioRapido()
    const chamadas = simularApi(fetchFalso, {
      ...rotasDoInicio('validador'),
      [`GET ${ROTA}`]: () => respostaJson(inicioValidadorApi()),
    })
    await abrirInicio()
    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(1))

    await user.selectOptions(seletorFilial(), '102')

    await waitFor(() => expect(getsInicio(chamadas)).toHaveLength(2))
    expect(getsInicio(chamadas)[1].url.searchParams.get('filial')).toBe('102')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
