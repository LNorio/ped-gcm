/**
 * Verificador central dos alertas das abas do menu (F2.12): consulta `GET /api/ped/alertas-menu` com a
 * sessão autenticada e com perfil, e acende/apaga as abas pelo `AlertasMenuProvider`.
 *
 * Gatilhos: ao montar/autenticar, ao trocar a filial selecionada (a rota não recebe filial), no `focus`
 * da janela e a cada 5 minutos com a aba do navegador visível. Com uma consulta em andamento, os
 * gatilhos são ignorados (sem fila).
 *
 * Resposta: só as abas visíveis do perfil são consideradas; `total > 0` acende a aba e define a dica
 * (as `descricao` dos itens, unidas por " · ", sem as nulas); `total: 0` apaga a aba e a dica; aba que
 * não veio fica como está.
 *
 * Erros: 403, 500 e falha de rede mantêm os alertas (o próximo gatilho tenta de novo); 429 bloqueia os
 * gatilhos até `tentarNovamenteEm` (padrão de 60 s) e tenta de novo ao fim da espera; 401 segue o
 * tratamento da sessão (o `apiFetch` dispara o evento de sessão expirada). A resposta que chega depois
 * de sair da sessão (ou de desmontar) é descartada.
 *
 * Deve ser usado dentro do `SessaoProvider` e do `AlertasMenuProvider`.
 */
import { useEffect, useRef } from 'react'
import { ApiError, SEGUNDOS_BLOQUEIO_PADRAO } from '../services/api'
import { obterAlertasMenu, type AlertasMenu } from '../services/alertasMenuService'
import { TODAS_AS_FILIAIS } from '../sessao/filial'
import { abasVisiveis } from '../sessao/permissoes'
import { useSessao } from '../sessao/SessaoProvider'
import { useAlertasMenu } from './AlertasMenu'

/** Intervalo entre as consultas periódicas (com a aba do navegador visível). */
export const INTERVALO_ALERTAS_MENU_MS = 5 * 60 * 1000

const SEPARADOR_DICA = ' · '

const nada = () => {}

export function useVerificadorAlertasMenu(): void {
  const { estado, acesso, filialSelecionada } = useSessao()
  const { definirAlerta, definirDica } = useAlertasMenu()

  const perfil = acesso?.perfil ?? null
  const ativo = estado === 'autenticado' && perfil !== null
  const chaveFilial =
    filialSelecionada === TODAS_AS_FILIAIS ? TODAS_AS_FILIAIS : (filialSelecionada?.codigo ?? '')

  /** Consulta da sessão ativa (não faz nada sem sessão), usada pelo gatilho da troca de filial. */
  const consultarRef = useRef<() => void>(nada)

  useEffect(() => {
    if (!ativo || perfil === null) return

    const abas = abasVisiveis(perfil)
    let vivo = true
    let emAndamento = false
    let bloqueadoAte = 0
    let controle: AbortController | null = null
    let retentativa: ReturnType<typeof setTimeout> | undefined

    function aplicar(alertas: AlertasMenu) {
      for (const aba of abas) {
        const daAba = alertas[aba]
        if (!daAba) continue
        const comAlerta = daAba.total > 0
        definirAlerta(aba, comAlerta)
        const dica = daAba.itens
          .map((item) => item.descricao)
          .filter((descricao): descricao is string => typeof descricao === 'string' && descricao.trim() !== '')
          .join(SEPARADOR_DICA)
        definirDica(aba, comAlerta ? dica : null)
      }
    }

    function tratarErro(erro: unknown) {
      if (!(erro instanceof ApiError) || erro.status !== 429) return
      const espera = (erro.tentarNovamenteEm ?? SEGUNDOS_BLOQUEIO_PADRAO) * 1000
      bloqueadoAte = Date.now() + espera
      clearTimeout(retentativa)
      retentativa = setTimeout(() => {
        if (document.visibilityState === 'visible') consultar()
      }, espera)
    }

    function consultar() {
      if (!vivo || emAndamento || Date.now() < bloqueadoAte) return
      emAndamento = true
      controle = new AbortController()
      obterAlertasMenu({ signal: controle.signal })
        .then(
          (alertas) => {
            if (vivo) aplicar(alertas)
          },
          (erro: unknown) => {
            if (vivo) tratarErro(erro)
          },
        )
        .finally(() => {
          emAndamento = false
        })
    }

    function aoFocar() {
      consultar()
    }

    consultarRef.current = consultar
    consultar()
    window.addEventListener('focus', aoFocar)
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') consultar()
    }, INTERVALO_ALERTAS_MENU_MS)

    return () => {
      vivo = false
      controle?.abort()
      clearInterval(intervalo)
      clearTimeout(retentativa)
      window.removeEventListener('focus', aoFocar)
      consultarRef.current = nada
    }
  }, [ativo, perfil, definirAlerta, definirDica])

  // Troca da filial selecionada: consulta de novo (um rerender com a mesma filial não consulta).
  const filialAnterior = useRef<string | null>(null)
  useEffect(() => {
    if (!ativo) {
      filialAnterior.current = null
      return
    }
    if (filialAnterior.current !== null && filialAnterior.current !== chaveFilial) consultarRef.current()
    filialAnterior.current = chaveFilial
  }, [ativo, chaveFilial])
}
