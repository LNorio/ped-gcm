/**
 * Pré-visualização das imagens do encerramento de um dashboard (F10.4 — RF-80).
 *
 * Ao abrir, consulta `obterPreviaFechamento(fechamento.id)` uma única vez; **nada é gravado**. Mostra o
 * progresso de lançamentos, a escolha da filial (com quantidade de imagens, lançamentos e falta de
 * faixas; no vínculo por filiais, as vinculadas sem imagem aparecem como "já encerrada", desabilitadas),
 * a escolha da imagem da filial num dropdown pesquisável (`SelectPesquisavel`, busca por colaborador ou
 * cargo), a imagem exibida em PDF gerado pelo back-end (`obterPdfPrevia`, F10.10) com a navegação entre todas as
 * imagens do dashboard e o botão "Exportar" (PDF da imagem exibida ou ZIP da prévia), os avisos
 * de pendências e de falta de faixas e o botão "Encerrar e gerar {N} imagem(ns)", que entrega a prévia
 * carregada a `onEncerrar` (a confirmação fica com `DialogoEncerrarFechamento`).
 */
import { useMemo, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Dialogo } from '../../components/Dialogo'
import { Select, type OpcaoSelect } from '../../components/Select'
import { SelectPesquisavel, type OpcaoSelectPesquisavel } from '../../components/SelectPesquisavel'
import { obterPdfPrevia, obterZipPrevia } from '../../services/fechamentosService'
import type { Fechamento, ImagemCongelada, PreviaFechamento } from '../../types/dominio'
import { formatarNumero, formatarPercentual } from '../../utils/formato'
import {
  TEXTO_CALCULANDO,
  TEXTO_SEM_IMAGENS_A_GERAR,
  agruparPorFilial,
  compararCodigos,
  filiaisDosAvisos,
  filialDaImagem,
  rotuloEncerrar,
  rotuloFilial,
  textoImagens,
  type GrupoFilial,
} from './previaFechamento'
import { AvisosFechamento } from './AvisosFechamento'
import { AvisoQuantidadeImagens } from './AvisoQuantidadeImagens'
import { ExportarImagens } from './ExportarImagens'
import { tituloPdfImagem, usePdfImagem } from './usePdfImagem'
import { usePreviaFechamento } from './usePreviaFechamento'
import { VisualizadorPdf } from './VisualizadorPdf'
import './DialogoPreviaFechamento.css'

export interface DialogoPreviaFechamentoProps {
  fechamento: Fechamento
  onFechar: () => void
  onEncerrar: (previa: PreviaFechamento) => void
}

/** Descrição da opção da imagem: "{cargo} · {PED} · {pontuação}" (imagem de filial, sem o cargo). */
function descricaoImagem(imagem: ImagemCongelada): string {
  const ped = formatarPercentual(imagem.pedPercentual) || '—'
  const pontuacao =
    imagem.pontuacao.calculada && imagem.pontuacao.valor !== null ? formatarNumero(imagem.pontuacao.valor) : 'Sem pontuação'
  const partes = imagem.tipo === 'filial' ? [ped, pontuacao] : [imagem.unidade.cargo ?? '—', ped, pontuacao]
  return partes.join(' · ')
}

function rotuloOpcao(grupo: GrupoFilial, pendencias: string[], semFaixas: string[]): string {
  const partes = [
    rotuloFilial(grupo.codigo, grupo.nome),
    textoImagens(grupo.imagens.length),
    pendencias.includes(grupo.codigo) ? 'lançamentos pendentes' : 'lançamentos completos',
  ]
  if (semFaixas.includes(grupo.codigo)) partes.push('sem tabela de faixas')
  return partes.join(' · ')
}

const SEM_IMAGENS: ImagemCongelada[] = []

/** Estado das imagens da prévia: agrupamento por filial, posição exibida e o PDF da imagem atual. */
function useImagensPrevia(idFechamento: number, previa: PreviaFechamento | null) {
  const imagens = previa?.imagens ?? SEM_IMAGENS
  const grupos = useMemo(() => agruparPorFilial(imagens), [imagens])
  const ordenadas = useMemo(() => grupos.flatMap((grupo) => grupo.imagens), [grupos])
  const [posicao, setPosicao] = useState(0)

  const atual: ImagemCongelada | undefined = ordenadas[Math.min(posicao, ordenadas.length - 1)]
  const chaveAtual = atual?.chave ?? null
  const pdf = usePdfImagem(chaveAtual === null ? null : `${idFechamento}|${chaveAtual}`, (signal) =>
    obterPdfPrevia(idFechamento, chaveAtual ?? '', { signal }),
  )
  return { grupos, ordenadas, atual, chaveAtual, setPosicao, pdf }
}

type ImagensPrevia = ReturnType<typeof useImagensPrevia>

export function DialogoPreviaFechamento({ fechamento, onFechar, onEncerrar }: DialogoPreviaFechamentoProps) {
  const { previa, carregando, erro } = usePreviaFechamento(fechamento.id)
  const imagens = useImagensPrevia(fechamento.id, previa)

  const titulo = `Pré-visualização — ${fechamento.nome} · ${fechamento.periodoAtual}`
  const semImagens = previa !== null && previa.imagens.length === 0
  /** Enquanto a prévia é calculada, a quantidade vem da linha do fechamento (unidades ainda abertas). */
  const estimativa = fechamento.unidadesDeImagem - fechamento.unidadesEncerradas
  const chaveAtual = imagens.chaveAtual

  const acoes = (
    <>
      <Botao variante="contorno" onClick={onFechar}>
        Fechar pré-visualização
      </Botao>
      {previa && !semImagens ? (
        <Botao onClick={() => onEncerrar(previa)}>{rotuloEncerrar(previa.resumo.imagensAGerar)}</Botao>
      ) : null}
    </>
  )

  return (
    <Dialogo aberto titulo={titulo} onFechar={onFechar} acoes={acoes} className="dialogo--largo dialogo-previa">
      {carregando ? (
        <>
          <p role="status" className="dialogo-previa__carregando">
            {TEXTO_CALCULANDO}
          </p>
          {!erro ? <AvisoQuantidadeImagens quantidade={estimativa} /> : null}
        </>
      ) : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {previa ? (
        <>
          <p className="dialogo-previa__nota">Nada é gravado na pré-visualização.</p>
          <div className="dialogo-previa__topo">
            <p className="dialogo-previa__progresso">
              Progresso de lançamentos: {fechamento.progresso.preenchidos} de {fechamento.progresso.total}
            </p>
            {!semImagens && chaveAtual !== null ? (
              <ExportarImagens
                quantidade={imagens.ordenadas.length}
                dicaFalhaZip="Tente novamente ou exporte os PDFs das imagens individualmente."
                obterPdf={(signal) =>
                  imagens.pdf.arquivo
                    ? Promise.resolve(imagens.pdf.arquivo)
                    : obterPdfPrevia(fechamento.id, chaveAtual, { signal })
                }
                obterZip={(signal) => obterZipPrevia(fechamento.id, { signal })}
              />
            ) : null}
          </div>
          {!semImagens ? <AvisoQuantidadeImagens quantidade={previa.imagens.length} /> : null}
          <AvisosFechamento resumo={previa.resumo} />
          {semImagens ? (
            <Aviso tipo="info">{TEXTO_SEM_IMAGENS_A_GERAR}</Aviso>
          ) : (
            <ConteudoPrevia fechamento={fechamento} previa={previa} imagens={imagens} />
          )}
        </>
      ) : null}
    </Dialogo>
  )
}

interface ConteudoPreviaProps {
  fechamento: Fechamento
  previa: PreviaFechamento
  imagens: ImagensPrevia
}

function ConteudoPrevia({ fechamento, previa, imagens }: ConteudoPreviaProps) {
  const { grupos, ordenadas, setPosicao, pdf } = imagens
  const atual = imagens.atual as ImagemCongelada
  const { pendencias, semFaixas } = filiaisDosAvisos(previa.resumo)

  const filialAtual = filialDaImagem(atual)
  const grupoAtual = grupos.find((grupo) => grupo.codigo === filialAtual) ?? grupos[0]

  const opcoes = useMemo<OpcaoSelect[]>(() => {
    const comImagens = new Set(grupos.map((grupo) => grupo.codigo))
    const itens: { codigo: string; opcao: OpcaoSelect }[] = grupos.map((grupo) => ({
      codigo: grupo.codigo,
      opcao: { valor: grupo.codigo, rotulo: rotuloOpcao(grupo, pendencias, semFaixas) },
    }))
    if (fechamento.tipoVinculo === 'filiais') {
      for (const codigo of fechamento.itensVinculados) {
        if (comImagens.has(codigo)) continue
        comImagens.add(codigo)
        itens.push({ codigo, opcao: { valor: codigo, rotulo: `Filial ${codigo} · já encerrada`, desabilitado: true } })
      }
    }
    return itens.sort((a, b) => compararCodigos(a.codigo, b.codigo)).map((item) => item.opcao)
  }, [grupos, pendencias, semFaixas, fechamento.tipoVinculo, fechamento.itensVinculados])

  const opcoesImagem = useMemo<OpcaoSelectPesquisavel[]>(
    () =>
      grupoAtual.imagens.map((imagem) => ({
        valor: String(ordenadas.indexOf(imagem)),
        rotulo: imagem.tipo === 'filial' ? 'Imagem da filial' : (imagem.unidade.colaborador ?? '—'),
        descricao: descricaoImagem(imagem),
      })),
    [grupoAtual, ordenadas],
  )

  function escolherFilial(codigo: string) {
    const primeira = ordenadas.findIndex((imagem) => filialDaImagem(imagem) === codigo)
    if (primeira >= 0) setPosicao(primeira)
  }

  const indiceAtual = ordenadas.indexOf(atual)
  const chaveAtual = atual.chave
  const tituloPdf = tituloPdfImagem(filialAtual || null, atual.tipo === 'filial' ? null : atual.unidade.colaborador)

  return (
    <div className="dialogo-previa__conteudo">
      <div className="dialogo-previa__filtros">
        <Select
          rotulo="Filial"
          opcoes={opcoes}
          value={grupoAtual.codigo}
          onChange={(evento) => escolherFilial(evento.target.value)}
        />
        <p className="dialogo-previa__contagem">
          {grupoAtual.imagens.length} nesta filial · {ordenadas.length} no total
        </p>
        <SelectPesquisavel
          rotulo="Imagem"
          rotuloBusca="Buscar colaborador ou cargo"
          className="dialogo-previa__imagem"
          opcoes={opcoesImagem}
          valor={String(indiceAtual)}
          onSelecionar={(valor) => setPosicao(Number(valor))}
          textoVazio="Nenhum colaborador encontrado."
        />
      </div>

      <div className="dialogo-previa__navegacao">
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={indiceAtual <= 0}
          onClick={() => setPosicao(indiceAtual - 1)}
        >
          Imagem anterior
        </Botao>
        <span className="dialogo-previa__posicao">
          Imagem {indiceAtual + 1} de {ordenadas.length} · Filial {filialAtual}
        </span>
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={indiceAtual >= ordenadas.length - 1}
          onClick={() => setPosicao(indiceAtual + 1)}
        >
          Próxima imagem
        </Botao>
      </div>

      {chaveAtual !== null ? (
        <div className="dialogo-previa__pdf">
          <VisualizadorPdf pdf={pdf} titulo={tituloPdf} />
        </div>
      ) : null}
    </div>
  )
}
