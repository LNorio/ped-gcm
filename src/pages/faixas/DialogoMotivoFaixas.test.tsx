import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  TABELA_COMERCIAL_100_INATIVA_API,
  TABELA_COMERCIAL_101_API,
  TABELA_GERAL_GERENTES_INATIVA_API,
  historicoComAcaoFaixasApi,
  historicoFaixasApi,
} from '../../test/faixasFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoMotivoFaixas, type DialogoMotivoFaixasProps } from './DialogoMotivoFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const INATIVA_100 = paraTabelaFaixas(TABELA_COMERCIAL_100_INATIVA_API)
const GERAL_GERENTES_INATIVA = paraTabelaFaixas(TABELA_GERAL_GERENTES_INATIVA_API)
const ROTA = '/api/ped/faixas'

/**
 * "Ver motivo" (pedido do usuário de 12/11/2026; proposta "faixa geral e situação", seção 7): o diálogo
 * "Motivo da última alteração" consulta sozinho `GET .../{id}/historico` (rota existente) ao abrir e
 * mostra, da primeira linha (a mais recente), a ação, o motivo, o autor e a data, como pares
 * `<dt>`/`<dd>`. Ação: Cadastro, Alteração das faixas (também quando a linha não traz `acao`),
 * Inativação ou Reativação. Na tabela inativa, mostra também "Motivo da inativação" e "Inativada em"
 * ("{data} por {usuário}"), da situação da tabela. Somente leitura.
 *
 * Contrato final (F8.12*): quinta ação `exclusao` ("Exclusão") e datas no formato
 * `2026-11-12 14:05:00-04:00`, mostradas como "12/11/2026 14:05" (nunca "Data inválida").
 */
describe('F8.8 — DialogoMotivoFaixas ("Ver motivo" da última alteração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar(props: Partial<DialogoMotivoFaixasProps> = {}, rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoFaixasApi()),
      [`GET ${ROTA}/6/historico`]: () => respostaJson(historicoComAcaoFaixasApi()),
      ...rotas,
    })
    const onFechar = props.onFechar ?? vi.fn()
    render(<DialogoMotivoFaixas tabela={props.tabela === undefined ? COMERCIAL_101 : props.tabela} onFechar={onFechar} />)
    return { chamadas, onFechar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Motivo da última alteração' })
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  /** Valor (`<dd>`) do par rótulo/valor (`<dt>`/`<dd>`); `null` se o rótulo não existe. */
  function valor(rotulo: string): string | null {
    const termo = within(dialogo()).queryByText(rotulo, { selector: 'dt' })
    if (termo === null) return null
    return termo.nextElementSibling?.textContent ?? null
  }

  it('com tabela null não renderiza nada nem consulta a API', () => {
    const { chamadas } = renderizar({ tabela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chamadas).toHaveLength(0)
  })

  it('abre "Motivo da última alteração" com o nome da tabela, anuncia o carregamento e consulta GET .../{id}/historico uma vez', async () => {
    const { chamadas } = renderizar()

    expect(dialogo()).toHaveTextContent('PED Comercial · Filial 101')
    expect(within(dialogo()).getByRole('status')).toHaveTextContent('Carregando motivo...')

    await waitFor(() => expect(valor('Motivo')).toBe('Reajuste do trimestre'))
    expect(gets(chamadas, `${ROTA}/1/historico`)).toHaveLength(1)
  })

  it('tabela ativa: ação, motivo, autor e data (dd/mm/aaaa hh:mm) da linha mais recente; linha sem "acao" = "Alteração das faixas"', async () => {
    renderizar()

    await waitFor(() => expect(valor('Motivo')).toBe('Reajuste do trimestre'))
    expect(valor('Ação')).toBe('Alteração das faixas')
    expect(valor('Autor')).toBe('Ana Costa')
    expect(valor('Data')).toBe('20/10/2026 15:30')
    expect(valor('Motivo da inativação')).toBeNull()
    expect(within(dialogo()).queryByText('Cadastro inicial')).not.toBeInTheDocument()
  })

  it('tabela inativa: a última linha (inativação) e, também, o motivo da situação com data e autor', async () => {
    renderizar({ tabela: INATIVA_100 })

    await waitFor(() => expect(valor('Ação')).toBe('Inativação'))
    expect(valor('Motivo')).toBe('Filial passou a usar outra régua')
    expect(valor('Autor')).toBe('Ana Costa')
    expect(valor('Data')).toBe('10/11/2026 08:00')
    expect(valor('Motivo da inativação')).toBe('Filial passou a usar outra régua')
    expect(valor('Inativada em')).toBe('10/11/2026 08:00 por Ana Costa')
  })

  it('faixa geral inativa cujo histórico ainda não traz a inativação: mostra a última linha e o motivo da situação da tabela', async () => {
    renderizar(
      { tabela: GERAL_GERENTES_INATIVA },
      {
        [`GET ${ROTA}/7/historico`]: () =>
          respostaJson([{ versao: 2, vigente: true, motivo: 'Régua 2026', data: '2026-11-01 10:00:00', usuario: 'admin', 'quantidade de faixas': 1, acao: 'alteracao' }]),
      },
    )

    await waitFor(() => expect(valor('Motivo')).toBe('Régua 2026'))
    expect(dialogo()).toHaveTextContent('PED Gerentes · Geral')
    expect(valor('Ação')).toBe('Alteração das faixas')
    expect(valor('Motivo da inativação')).toBe('passou a valer faixa por filial')
    expect(valor('Inativada em')).toBe('12/11/2026 14:05 por admin')
  })

  it.each([
    ['cadastro', 'Cadastro'],
    ['reativacao', 'Reativação'],
    ['exclusao', 'Exclusão'],
  ])('ação "%s" aparece como "%s"', async (acao, rotulo) => {
    renderizar({}, { [`GET ${ROTA}/1/historico`]: () => respostaJson([{ ...historicoFaixasApi()[0], acao }]) })

    await waitFor(() => expect(valor('Ação')).toBe(rotulo))
  })

  it('data da linha e da situação no formato final (com fuso -04:00) aparecem formatadas em pt-BR', async () => {
    renderizar(
      { tabela: GERAL_GERENTES_INATIVA },
      {
        [`GET ${ROTA}/7/historico`]: () =>
          respostaJson([
            {
              versao: 2,
              vigente: false,
              motivo: 'passou a valer faixa por filial',
              data: '2026-11-12 14:05:00-04:00',
              usuario: 'admin',
              'quantidade de faixas': null,
              acao: 'inativacao',
            },
          ]),
      },
    )

    await waitFor(() => expect(valor('Ação')).toBe('Inativação'))
    expect(valor('Data')).toBe('12/11/2026 14:05')
    expect(valor('Inativada em')).toBe('12/11/2026 14:05 por admin')
    expect(dialogo()).not.toHaveTextContent(/inválida/i)
  })

  it('histórico vazio: "Nenhuma alteração registrada."', async () => {
    renderizar({}, { [`GET ${ROTA}/1/historico`]: () => respostaJson([]) })

    expect(await within(dialogo()).findByText('Nenhuma alteração registrada.')).toBeInTheDocument()
    expect(valor('Motivo')).toBeNull()
  })

  it('erro da API: alerta com a mensagem e "Tentar novamente", que consulta de novo', async () => {
    const user = usuarioRapido()
    let falhar = true
    const { chamadas } = renderizar(
      {},
      { [`GET ${ROTA}/1/historico`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o histórico.') : respostaJson(historicoFaixasApi())) },
    )

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Falha ao consultar o histórico.')

    falhar = false
    await user.click(within(dialogo()).getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(valor('Motivo')).toBe('Reajuste do trimestre'))
    expect(gets(chamadas, `${ROTA}/1/historico`)).toHaveLength(2)
  })

  it('"Fechar" chama onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()
    await waitFor(() => expect(valor('Motivo')).toBe('Reajuste do trimestre'))

    await user.click(within(dialogo()).getAllByRole('button', { name: 'Fechar' })[0])

    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})
