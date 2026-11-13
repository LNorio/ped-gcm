import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import type { PreviaFechamento, ResultadoEncerramento } from '../../types/dominio'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  MENSAGEM_DASHBOARD_NAO_ATIVO,
  MENSAGEM_TODAS_ENCERRADAS,
  previaComercialApi,
  previaGerentesApi,
  respostaEncerramentoApi,
  type PreviaFechamentoApiFalsa,
} from '../../test/fechamentosFalsos'
import { carregarFechamentoDominio, carregarPreviaDominio } from '../../test/previaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoEncerrarFechamento, type DialogoEncerrarFechamentoProps } from './DialogoEncerrarFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const GERENTES = carregarFechamentoDominio(FECHAMENTO_GERENTES_API)

const ROTA_PREVIA = 'GET /api/ped/fechamentos/1/previa'
const ROTA_ENCERRAR = 'POST /api/ped/fechamentos/1/encerrar'

const AVISO_PENDENCIAS = (filiais: string) =>
  `Filiais com lançamentos pendentes: ${filiais}. Se o período for encerrado agora, eles serão congelados sem valor.`
const AVISO_SEM_FAIXAS = (filiais: string) =>
  `Filiais sem tabela de faixas: ${filiais}. As imagens dessas filiais ficarão sem pontuação.`
const OUTROS_DASHBOARDS = 'Os outros dashboards não são afetados: cada dashboard é encerrado individualmente.'
const BLOQUEIO_TODAS_ENCERRADAS = 'Todas as unidades deste dashboard já foram encerradas no período atual.'

/**
 * Encerramento manual com confirmação (F10.5 — RF-77, RF-81, RF-82, RNF-07). O diálogo monta a
 * confirmação a partir do resumo da prévia: a recebida em `previa` (vinda da pré-visualização) ou, sem
 * ela, uma consulta própria a `obterPreviaFechamento(fechamento.id)` (aberto pelo menu da linha).
 * Confirmar chama `encerrarFechamento(fechamento.id)` (`POST /api/ped/fechamentos/{id}/encerrar`).
 *
 * Interface:
 * - props `{ fechamento: Fechamento; previa?: PreviaFechamento | null; onCancelar: () => void;
 *   onEncerrado: (resultado: ResultadoEncerramento) => void }`;
 * - diálogo "Encerrar {nome} — {período atual}"; enquanto consulta a prévia, "Calculando as imagens...";
 * - "Total de imagens a gerar: {N} (uma por filial|uma por colaborador)" e a lista "Imagens por filial",
 *   com "Filial {código} - {nome}: {n} imagem(ns)" em ordem de código;
 * - "Os outros dashboards não são afetados: cada dashboard é encerrado individualmente.";
 * - os avisos de filiais com pendências e sem tabela de faixas (os mesmos textos da prévia);
 * - "Cancelar" (e Esc) chama `onCancelar`; "Encerrar e gerar {N} imagem(ns)" encerra (desabilitado
 *   enquanto grava; um único POST);
 * - sucesso: `onEncerrado(resultado)`; erro (ex.: `400`): mensagem da API em `role="alert"` dentro do
 *   diálogo, que continua aberto;
 * - sem imagens a gerar (RNF-07): "Todas as unidades deste dashboard já foram encerradas no período
 *   atual." e só o botão "Entendi" (chama `onCancelar`), sem POST.
 */
describe('F10.5 — DialogoEncerrarFechamento (encerramento manual com confirmação — RF-77, RF-81, RF-82, RNF-07)', () => {
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

  function renderizar(
    props: Partial<DialogoEncerrarFechamentoProps> = {},
    rotas: Record<string, RotaFalsa> = {},
  ) {
    const chamadas = simularApi(fetchFalso, {
      [ROTA_PREVIA]: () => respostaJson(previaComercialApi()),
      [ROTA_ENCERRAR]: () => respostaJson(respostaEncerramentoApi()),
      ...rotas,
    })
    const onCancelar = props.onCancelar ?? vi.fn()
    const onEncerrado = props.onEncerrado ?? vi.fn()
    render(
      <DialogoEncerrarFechamento
        fechamento={props.fechamento ?? COMERCIAL}
        previa={props.previa}
        onCancelar={onCancelar}
        onEncerrado={onEncerrado}
      />,
    )
    return { chamadas, onCancelar, onEncerrado }
  }

  const dialogo = (nome = 'Encerrar PED Comercial — 4º tri/2026') => screen.getByRole('dialog', { name: nome })
  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET')
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST')
  const itensPorFilial = (elemento: HTMLElement) =>
    within(within(elemento).getByRole('list', { name: 'Imagens por filial' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim())
  const botaoEncerrar = (nome = 'Encerrar e gerar 2 imagens') => within(dialogo()).getByRole('button', { name: nome })

  async function previaDominio(api: PreviaFechamentoApiFalsa = previaComercialApi(), id = 1): Promise<PreviaFechamento> {
    return carregarPreviaDominio(fetchFalso, api, id)
  }

  describe('resumo da confirmação (RF-81)', () => {
    it('aberto pelo menu (sem prévia), consulta a prévia uma vez e mostra "Calculando as imagens..." enquanto espera', async () => {
      const { chamadas } = renderizar()

      expect(within(dialogo()).getByText('Calculando as imagens...')).toBeInTheDocument()
      expect(await within(dialogo()).findByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
      expect(gets(chamadas).map((c) => c.caminho)).toEqual(['/api/ped/fechamentos/1/previa'])
      expect(posts(chamadas)).toHaveLength(0)
    })

    it('com a prévia recebida, não consulta a API para montar a confirmação', async () => {
      const previa = await previaDominio()
      const { chamadas } = renderizar({ previa })

      expect(within(dialogo()).getByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
      expect(chamadas).toHaveLength(0)
    })

    it('mostra o total, as imagens por filial, que os outros dashboards não são afetados, as pendências e a falta de faixas', async () => {
      const previa = await previaDominio()
      renderizar({ previa })

      const atual = dialogo()
      expect(within(atual).getByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
      expect(itensPorFilial(atual)).toEqual(['Filial 101 - CAMPO GRANDE: 1 imagem', 'Filial 102 - DOURADOS: 1 imagem'])
      expect(within(atual).getByText(OUTROS_DASHBOARDS)).toBeInTheDocument()
      expect(within(atual).getByText(AVISO_PENDENCIAS('102'))).toBeInTheDocument()
      expect(within(atual).getByText(AVISO_SEM_FAIXAS('102'))).toBeInTheDocument()
      expect(within(atual).getByRole('button', { name: 'Cancelar' })).toBeEnabled()
      expect(botaoEncerrar()).toBeEnabled()
    })

    it('agrupa por filial as imagens de colaborador (vínculo por cargos) e informa "uma por colaborador"', async () => {
      const api = previaGerentesApi()
      api.imagens.push({ ...structuredClone(api.imagens[0]), chave: 'colaborador:15', 'id colaborador': 15 })
      api.imagens[2].unidade.colaborador = { 'id colaborador': 15, nome: 'Bruno Lima', cargo: 'Gerente de Loja' }
      api.resumo['imagens a gerar'] = 3
      const previa = await previaDominio(api, 2)
      renderizar({ fechamento: GERENTES, previa })

      const atual = dialogo('Encerrar PED Gerentes — 11/2026')
      expect(within(atual).getByText('Total de imagens a gerar: 3 (uma por colaborador)')).toBeInTheDocument()
      expect(itensPorFilial(atual)).toEqual(['Filial 100 - MATRIZ: 2 imagens', 'Filial 102 - DOURADOS: 1 imagem'])
      expect(within(atual).getByText(AVISO_PENDENCIAS('100, 102'))).toBeInTheDocument()
      expect(within(atual).getByRole('button', { name: 'Encerrar e gerar 3 imagens' })).toBeInTheDocument()
    })

    it('sem pendências e com faixas, não mostra esses avisos', async () => {
      const api = previaComercialApi()
      api.resumo['unidades com pendencias'] = []
      api.resumo['unidades sem tabela de faixas'] = []
      const previa = await previaDominio(api)
      renderizar({ previa })

      expect(within(dialogo()).queryByText(/^Filiais com lançamentos pendentes/)).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText(/^Filiais sem tabela de faixas/)).not.toBeInTheDocument()
      expect(within(dialogo()).getByText(OUTROS_DASHBOARDS)).toBeInTheDocument()
    })

    it('erro ao consultar a prévia aparece no diálogo, sem o botão de encerrar', async () => {
      renderizar({}, { [ROTA_PREVIA]: () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO) })

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)
      expect(within(dialogo()).queryByRole('button', { name: /^Encerrar e gerar/ })).not.toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    })
  })

  describe('bloqueio: nenhuma imagem a gerar (RNF-07)', () => {
    it('explica o motivo e oferece só "Entendi", sem encerrar', async () => {
      const user = usuarioRapido()
      const api: PreviaFechamentoApiFalsa = {
        ...previaComercialApi(),
        resumo: { ...previaComercialApi().resumo, 'imagens a gerar': 0, 'unidades ja encerradas': 3 },
        imagens: [],
      }
      const previa = await previaDominio(api)
      const { chamadas, onCancelar } = renderizar({ previa })

      expect(within(dialogo()).getByText(BLOQUEIO_TODAS_ENCERRADAS)).toBeInTheDocument()
      const botoes = within(dialogo())
        .getAllByRole('button')
        .map((botao) => botao.getAttribute('aria-label') ?? botao.textContent?.trim())
        .filter((nome) => nome !== 'Fechar')
      expect(botoes).toEqual(['Entendi'])

      await user.click(within(dialogo()).getByRole('button', { name: 'Entendi' }))
      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(posts(chamadas)).toHaveLength(0)
    })
  })

  describe('confirmação e resultado', () => {
    it('"Encerrar e gerar 2 imagens" faz um único POST sem corpo e chama onEncerrado com o lote', async () => {
      const user = usuarioRapido()
      const previa = await previaDominio()
      const { chamadas, onEncerrado } = renderizar({ previa })

      await user.click(botaoEncerrar())

      await waitFor(() => expect(onEncerrado).toHaveBeenCalledTimes(1))
      expect(posts(chamadas).map((c) => c.caminho)).toEqual(['/api/ped/fechamentos/1/encerrar'])
      expect(posts(chamadas)[0].init?.body ?? null).toBeNull()
      const resultado = (onEncerrado as ReturnType<typeof vi.fn>).mock.calls[0][0] as ResultadoEncerramento
      expect(resultado).toMatchObject({ lote: 'ENC-000003', imagensGeradas: 2 })
    })

    it('enquanto grava, o botão fica desabilitado e um segundo clique não repete o POST', async () => {
      const user = usuarioRapido()
      const previa = await previaDominio()
      let liberar: (resposta: Response) => void = () => {}
      const { chamadas, onEncerrado } = renderizar(
        { previa },
        { [ROTA_ENCERRAR]: () => new Promise<Response>((resolver) => (liberar = resolver)) },
      )

      await user.click(botaoEncerrar())

      await waitFor(() => expect(within(dialogo()).getByRole('button', { name: /^Encerra/ })).toBeDisabled())
      await user.click(within(dialogo()).getByRole('button', { name: /^Encerra/ }))
      expect(posts(chamadas)).toHaveLength(1)

      liberar(respostaJson(respostaEncerramentoApi()))
      await waitFor(() => expect(onEncerrado).toHaveBeenCalledTimes(1))
    })

    it.each([
      ['todas as unidades já encerradas', MENSAGEM_TODAS_ENCERRADAS],
      ['dashboard não ativo', MENSAGEM_DASHBOARD_NAO_ATIVO],
    ])('400 (%s): mostra a mensagem dentro do diálogo, que continua aberto', async (_caso, mensagem) => {
      const user = usuarioRapido()
      const previa = await previaDominio()
      const { onEncerrado, onCancelar } = renderizar({ previa }, { [ROTA_ENCERRAR]: () => respostaErro(400, mensagem) })

      await user.click(botaoEncerrar())

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(mensagem)
      expect(onEncerrado).not.toHaveBeenCalled()
      expect(onCancelar).not.toHaveBeenCalled()
      expect(botaoEncerrar()).toBeEnabled()
    })

    it('"Cancelar" e Esc chamam onCancelar, sem encerrar', async () => {
      const user = usuarioRapido()
      const previa = await previaDominio()
      const { chamadas, onCancelar } = renderizar({ previa })

      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
      expect(onCancelar).toHaveBeenCalledTimes(1)

      await user.keyboard('{Escape}')
      await waitFor(() => expect(onCancelar).toHaveBeenCalledTimes(2))
      expect(posts(chamadas)).toHaveLength(0)
    })
  })
})
