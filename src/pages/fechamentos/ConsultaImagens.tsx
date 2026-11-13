/**
 * Consulta retroativa das imagens congeladas (F10.6 — RF-84, RN-18), na aba Fechamentos, abaixo da lista
 * de dashboards. Lista as imagens da filial do cabeçalho com filtros de busca, período e tipo; cada linha
 * abre o `DialogoImagem`. Somente leitura: nenhuma ação de alterar ou excluir.
 */
import { useState } from 'react'
import { BarraFiltros } from '../../components/BarraFiltros'
import { Botao } from '../../components/Botao'
import { Card } from '../../components/Card'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Select, type OpcaoSelect } from '../../components/Select'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { ROTULOS_TIPO_IMAGEM, TIPOS_IMAGEM, type ImagemDaConsulta, type TipoImagem } from '../../types/dominio'
import { formatarDataHora, formatarPercentual } from '../../utils/formato'
import { DialogoImagem } from './DialogoImagem'
import { useConsultaImagens } from './useConsultaImagens'
import './ConsultaImagens.css'

const AUSENTE = '—'
const TEXTO_FILIAL_SEM_COLABORADOR = 'Filial (sem colaborador vinculado)'
const TEXTO_SEM_IMAGENS = 'Nenhuma imagem congelada encontrada.'
const TEXTO_SEM_IMAGENS_FILTRO = 'Nenhuma imagem encontrada com os filtros selecionados.'

const OPCOES_TIPO: OpcaoSelect[] = [
  { valor: 'todas', rotulo: 'Todos os tipos' },
  ...TIPOS_IMAGEM.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_TIPO_IMAGEM[tipo] })),
]

function ehTipoFiltro(valor: string): valor is TipoImagem | 'todas' {
  return valor === 'todas' || (TIPOS_IMAGEM as readonly string[]).includes(valor)
}

function textoFilial(imagem: ImagemDaConsulta): string {
  if (!imagem.filial) return AUSENTE
  return imagem.nomeFilial ? `${imagem.filial} - ${imagem.nomeFilial}` : imagem.filial
}

function Colaborador({ imagem }: { imagem: ImagemDaConsulta }) {
  if (!imagem.colaborador) return <span className="consulta-imagens__sem-colaborador">{TEXTO_FILIAL_SEM_COLABORADOR}</span>
  return (
    <div className="consulta-imagens__colaborador">
      <span>{imagem.colaborador}</span>
      {imagem.cargo ? <span className="consulta-imagens__cargo">{imagem.cargo}</span> : null}
    </div>
  )
}

export function ConsultaImagens() {
  const {
    imagens,
    total,
    periodos,
    filtros,
    filtrosAtivos,
    definirFiltro,
    setBusca,
    limparFiltros,
    carregando,
    erro,
    recarregar,
  } = useConsultaImagens()
  const [aberta, setAberta] = useState<ImagemDaConsulta | null>(null)

  const opcoesPeriodo: OpcaoSelect[] = [
    { valor: '', rotulo: 'Todos os períodos' },
    ...periodos.map((periodo) => ({ valor: periodo, rotulo: periodo })),
  ]

  const colunas: ColunaTabela<ImagemDaConsulta>[] = [
    { chave: 'dashboard', titulo: 'Dashboard', render: (imagem) => imagem.dashboard ?? AUSENTE },
    { chave: 'colaborador', titulo: 'Colaborador', render: (imagem) => <Colaborador imagem={imagem} /> },
    { chave: 'tipo', titulo: 'Tipo', render: (imagem) => ROTULOS_TIPO_IMAGEM[imagem.tipo] },
    { chave: 'periodo', titulo: 'Período', render: (imagem) => imagem.periodo ?? AUSENTE },
    { chave: 'filial', titulo: 'Filial', render: textoFilial },
    {
      chave: 'geradoEm',
      titulo: 'Gerada em',
      render: (imagem) => (imagem.geradoEm ? formatarDataHora(imagem.geradoEm) || AUSENTE : AUSENTE),
    },
    { chave: 'usuario', titulo: 'Por', render: (imagem) => imagem.usuario ?? AUSENTE },
    {
      chave: 'pedPercentual',
      titulo: 'PED',
      alinhar: 'direita',
      render: (imagem) => formatarPercentual(imagem.pedPercentual) || AUSENTE,
    },
    {
      chave: 'acao',
      titulo: 'Ação',
      render: (imagem) => (
        <Botao
          variante="contorno"
          tamanho="pequeno"
          aria-label={`Visualizar imagem ${imagem.codigo}`}
          onClick={() => setAberta(imagem)}
        >
          Visualizar
        </Botao>
      ),
    },
  ]

  const mostrarTabela = erro === null && (!carregando || imagens.length > 0)

  return (
    <Card
      titulo="Imagens congeladas — consulta retroativa"
      semPadding
      className="consulta-imagens"
      acoes={<span className="consulta-imagens__contagem">{`${imagens.length} de ${total} imagens`}</span>}
    >
      <BarraFiltros
        busca={filtros.busca}
        onBuscaChange={(valor) => setBusca(valor)}
        rotuloBusca="Buscar imagens"
        placeholderBusca="Buscar dashboard, colaborador, cargo, filial, código ou usuário..."
        filtrosAdicionaisAtivos={filtros.periodo !== '' || filtros.tipo !== 'todas'}
        onLimpar={limparFiltros}
      >
        <div className="consulta-imagens__filtros">
          <Select
            rotulo="Período das imagens"
            opcoes={opcoesPeriodo}
            value={filtros.periodo}
            onChange={(evento) => definirFiltro('periodo', evento.target.value)}
          />
          <Select
            rotulo="Tipo de imagem"
            opcoes={OPCOES_TIPO}
            value={filtros.tipo}
            onChange={(evento) => {
              const valor = evento.target.value
              if (ehTipoFiltro(valor)) definirFiltro('tipo', valor)
            }}
          />
        </div>
      </BarraFiltros>

      <div className="consulta-imagens__estado">
        <EstadoCarga
          carregando={carregando}
          mensagemCarregando="Carregando imagens..."
          erro={erro}
          onTentarNovamente={recarregar}
        />
      </div>

      {mostrarTabela ? (
        <Tabela
          colunas={colunas}
          dados={imagens}
          obterChave={(imagem) => imagem.id}
          legenda="Imagens congeladas"
          textoVazio={filtrosAtivos ? TEXTO_SEM_IMAGENS_FILTRO : TEXTO_SEM_IMAGENS}
        />
      ) : null}

      <DialogoImagem imagem={aberta} onFechar={() => setAberta(null)} />
    </Card>
  )
}
