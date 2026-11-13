/**
 * Pré-visualização das imagens do encerramento de um dashboard (F10.4 — RF-80).
 *
 * Ao abrir, consulta `obterPreviaFechamento(fechamento.id)` uma única vez; **nada é gravado**. Mostra o
 * progresso de lançamentos, a escolha da filial (com quantidade de imagens, lançamentos e falta de
 * faixas; no vínculo por filiais, as vinculadas sem imagem aparecem como "já encerrada", desabilitadas),
 * a lista das imagens da filial (com busca por colaborador ou cargo quando há imagens de colaborador), a
 * imagem exibida (`VisualizacaoImagem`) com a navegação entre todas as imagens do dashboard, os avisos
 * de pendências e de falta de faixas e o botão "Encerrar e gerar {N} imagem(ns)", que entrega a prévia
 * carregada a `onEncerrar` (a confirmação fica com `DialogoEncerrarFechamento`).
 */
import { useMemo, useState } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Dialogo } from '../../components/Dialogo'
import { Etiqueta } from '../../components/Etiqueta'
import { Select, type OpcaoSelect } from '../../components/Select'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import type { Fechamento, ImagemCongelada, PreviaFechamento } from '../../types/dominio'
import { formatarNumero, formatarPercentual, normalizarBusca } from '../../utils/formato'
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
import { usePreviaFechamento } from './usePreviaFechamento'
import { VisualizacaoImagem } from './VisualizacaoImagem'
import './DialogoPreviaFechamento.css'

export interface DialogoPreviaFechamentoProps {
  fechamento: Fechamento
  onFechar: () => void
  onEncerrar: (previa: PreviaFechamento) => void
}

interface LinhaImagem {
  imagem: ImagemCongelada
  /** Posição da imagem na navegação (0 = primeira). */
  posicao: number
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

export function DialogoPreviaFechamento({ fechamento, onFechar, onEncerrar }: DialogoPreviaFechamentoProps) {
  const { previa, carregando, erro } = usePreviaFechamento(fechamento.id)

  const titulo = `Pré-visualização — ${fechamento.nome} · ${fechamento.periodoAtual}`
  const semImagens = previa !== null && previa.imagens.length === 0

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
        <p role="status" className="dialogo-previa__carregando">
          {TEXTO_CALCULANDO}
        </p>
      ) : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {previa ? (
        <>
          <p className="dialogo-previa__nota">Nada é gravado na pré-visualização.</p>
          <p className="dialogo-previa__progresso">
            Progresso de lançamentos: {fechamento.progresso.preenchidos} de {fechamento.progresso.total}
          </p>
          <AvisosFechamento resumo={previa.resumo} />
          {semImagens ? (
            <Aviso tipo="info">{TEXTO_SEM_IMAGENS_A_GERAR}</Aviso>
          ) : (
            <ConteudoPrevia fechamento={fechamento} previa={previa} />
          )}
        </>
      ) : null}
    </Dialogo>
  )
}

function ConteudoPrevia({ fechamento, previa }: { fechamento: Fechamento; previa: PreviaFechamento }) {
  const grupos = useMemo(() => agruparPorFilial(previa.imagens), [previa.imagens])
  const ordenadas = useMemo(() => grupos.flatMap((grupo) => grupo.imagens), [grupos])
  const { pendencias, semFaixas } = filiaisDosAvisos(previa.resumo)
  const comColaborador = previa.imagens.some((imagem) => imagem.tipo === 'colaborador')

  const [posicao, setPosicao] = useState(0)
  const [busca, setBusca] = useState('')

  const atual = ordenadas[Math.min(posicao, ordenadas.length - 1)]
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

  const linhas = useMemo<LinhaImagem[]>(() => {
    const termo = normalizarBusca(busca)
    return grupoAtual.imagens
      .map((imagem) => ({ imagem, posicao: ordenadas.indexOf(imagem) }))
      .filter(
        ({ imagem }) =>
          termo === '' ||
          normalizarBusca(imagem.unidade.colaborador).includes(termo) ||
          normalizarBusca(imagem.unidade.cargo).includes(termo),
      )
  }, [busca, grupoAtual, ordenadas])

  function escolherFilial(codigo: string) {
    const primeira = ordenadas.findIndex((imagem) => filialDaImagem(imagem) === codigo)
    if (primeira >= 0) setPosicao(primeira)
  }

  const colunas: ColunaTabela<LinhaImagem>[] = [
    {
      chave: 'colaborador',
      titulo: 'Colaborador',
      render: ({ imagem }) =>
        imagem.tipo === 'filial' ? 'Imagem da filial' : (imagem.unidade.colaborador ?? '—'),
    },
    {
      chave: 'cargo',
      titulo: 'Cargo',
      render: ({ imagem }) => (imagem.tipo === 'filial' ? '—' : (imagem.unidade.cargo ?? '—')),
    },
    {
      chave: 'ped',
      titulo: 'PED',
      alinhar: 'direita',
      render: ({ imagem }) => formatarPercentual(imagem.pedPercentual) || '—',
    },
    {
      chave: 'pontuacao',
      titulo: 'Pontuação',
      alinhar: 'direita',
      render: ({ imagem }) =>
        imagem.pontuacao.calculada && imagem.pontuacao.valor !== null
          ? formatarNumero(imagem.pontuacao.valor)
          : 'Sem pontuação',
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      render: (linha) =>
        linha.imagem === atual ? (
          <Etiqueta tom="info">Exibindo</Etiqueta>
        ) : (
          <Botao variante="link" tamanho="pequeno" onClick={() => setPosicao(linha.posicao)}>
            Visualizar
          </Botao>
        ),
    },
  ]

  const indiceAtual = ordenadas.indexOf(atual)

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
        {comColaborador ? (
          <Campo
            type="search"
            rotulo="Buscar colaborador ou cargo"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        ) : null}
      </div>

      <Tabela
        colunas={colunas}
        dados={linhas}
        obterChave={(linha) => linha.imagem.chave ?? linha.posicao}
        legenda={`Imagens da filial ${grupoAtual.codigo}`}
        textoVazio="Nenhum colaborador encontrado."
      />

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

      <VisualizacaoImagem imagem={atual} />
    </div>
  )
}
