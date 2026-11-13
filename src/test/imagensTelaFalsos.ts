/**
 * Imagens congeladas já no formato do domínio (`ImagemCongelada`, F10.1), para os testes de tela da F10
 * (F10.3 a F10.7). Espelham, campo a campo, as imagens da API de `fechamentosFalsos.ts` (que não deve ser
 * alterado), como o `imagensService` as converte (ver `src/services/imagensService.conteudo.test.ts`):
 *
 * - `IMAGEM_COMERCIAL_100` — IMG-000001 · filial 100 MATRIZ (`tipo: filial`) · PED Comercial · 3º tri/2026;
 *   exemplo do negócio: Resultado Operacional 451.590,62; faixa atual 400.000,00–600.000,00 (1,95%),
 *   anterior 0,00–399.999,99 (2,21%); A = 8.840,00, B = 8.806,02, opção A, base 8.840,00; PED 99,99% →
 *   pontuação 8.839,12; faixas "Resultado operacional" v2 (3 linhas, a 2ª atingida); por Ana Costa em
 *   30/09/2026 18:00;
 * - `IMAGEM_COMERCIAL_101_SEM_FAIXA` — IMG-000002 · filial 101 CAMPO GRANDE (`tipo: filial`); sem tabela de
 *   faixas (não calculada, motivo "unidade sem tabela de faixas"); Faturamento **sem meta** (`meta: null`)
 *   e Cobertura de clientes com lançamento **pendente** (realizado `null`); PED 0; uma pendência e um aviso;
 * - `IMAGEM_GERENTES_ANA` — IMG-000003 · colaborador Ana Souza (Gerente de Loja), filial 100
 *   (`tipo: colaborador`) · PED Gerentes · 10/2026; "Vendas por colaborador" **sem coleta ainda**
 *   (`coletaDisponivel: false`); sem faixa anterior, opção B; PED 20 → pontuação 150; faixas v1 sem nome
 *   (1 linha, atingida); um aviso; por admin em 01/11/2026 09:00; sem fórmula de pontuação;
 * - `IMAGEM_GERENTES_DIEGO` — IMG-000004 · colaborador Diego Rocha (Gerente de Loja), filial 102 DOURADOS
 *   (`tipo: colaborador`); sem tabela de faixas; PED 16.
 *
 * `imagemDaPrevia(imagem, chave)` devolve a mesma imagem como na prévia: sem `id`, `codigo`, `lote`,
 * `geradoEm` e `usuario`, e com a `chave` da unidade.
 */
import type { ImagemCongelada, PontuacaoDaImagem } from '../types/dominio'

export const MOTIVO_SEM_FAIXA_DOMINIO = 'unidade sem tabela de faixas'

const PONTUACAO_SEM_FAIXA: PontuacaoDaImagem = {
  calculada: false,
  motivo: MOTIVO_SEM_FAIXA_DOMINIO,
  faixaAtual: null,
  faixaAnterior: null,
  aliquotaAnterior: null,
  aliquotaAtual: null,
  pisoDaFaixa: null,
  opcaoA: null,
  opcaoB: null,
  opcaoSelecionada: null,
  baseDeCalculo: null,
  valor: null,
}

const DASHBOARD_COMERCIAL: NonNullable<ImagemCongelada['dashboard']> = {
  id: 1,
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  pontuacaoMaxima: 100,
  tipoVinculo: 'filiais',
  formulaDePontuacao: 'Base de cálculo × PED (%) ÷ 100',
}

const DASHBOARD_GERENTES: NonNullable<ImagemCongelada['dashboard']> = {
  id: 2,
  nome: 'PED Gerentes',
  periodicidade: 'mensal',
  pontuacaoMaxima: 50,
  tipoVinculo: 'cargos',
  formulaDePontuacao: null,
}

export const IMAGEM_COMERCIAL_100: ImagemCongelada = {
  id: 1,
  codigo: 'IMG-000001',
  lote: 'ENC-000001',
  chave: null,
  tipo: 'filial',
  idColaborador: null,
  dashboard: { ...DASHBOARD_COMERCIAL },
  periodo: { codigo: '3º tri/2026', inicio: '2026-07-01', fim: '2026-09-30' },
  unidade: { filial: '100', nomeFilial: 'MATRIZ', colaborador: null, cargo: null },
  resultadoOperacional: { indicador: 'Faturamento', valor: 451590.62, observacao: 'Realizado do indicador base da faixa' },
  pedPercentual: 99.99,
  pontosBaseTotal: 100,
  indicadores: [
    {
      indicador: 'Faturamento',
      meta: 400000,
      realizado: 451590.62,
      coletaDisponivel: true,
      atingimento: 112.9,
      pontosBase: 60,
      pontosRealizados: 60,
      observacao: 'Pontos limitados aos pontos base',
    },
    {
      indicador: 'Cobertura de clientes',
      meta: 80,
      realizado: 79.98,
      coletaDisponivel: true,
      atingimento: 99.98,
      pontosBase: 40,
      pontosRealizados: 39.99,
      observacao: null,
    },
  ],
  pontuacao: {
    calculada: true,
    motivo: null,
    faixaAtual: { de: 400000, ate: 600000, aliquota: 1.95 },
    faixaAnterior: { de: 0, ate: 399999.99, aliquota: 2.21 },
    aliquotaAnterior: 2.21,
    aliquotaAtual: 1.95,
    pisoDaFaixa: 400000,
    opcaoA: 8840,
    opcaoB: 8806.02,
    opcaoSelecionada: 'A',
    baseDeCalculo: 8840,
    valor: 8839.12,
  },
  faixas: {
    nome: 'Resultado operacional',
    versao: 2,
    linhas: [
      { de: 0, ate: 399999.99, aliquota: 2.21 },
      { de: 400000, ate: 600000, aliquota: 1.95 },
      { de: 600000.01, ate: 1000000, aliquota: 1.5 },
    ],
  },
  pendencias: [],
  avisos: [],
  geradoEm: '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
}

export const IMAGEM_COMERCIAL_101_SEM_FAIXA: ImagemCongelada = {
  id: 2,
  codigo: 'IMG-000002',
  lote: 'ENC-000001',
  chave: null,
  tipo: 'filial',
  idColaborador: null,
  dashboard: { ...DASHBOARD_COMERCIAL },
  periodo: { codigo: '3º tri/2026', inicio: '2026-07-01', fim: '2026-09-30' },
  unidade: { filial: '101', nomeFilial: 'CAMPO GRANDE', colaborador: null, cargo: null },
  resultadoOperacional: { indicador: 'Faturamento', valor: 320000, observacao: null },
  pedPercentual: 0,
  pontosBaseTotal: 100,
  indicadores: [
    {
      indicador: 'Faturamento',
      meta: null,
      realizado: 320000,
      coletaDisponivel: true,
      atingimento: null,
      pontosBase: 60,
      pontosRealizados: null,
      observacao: 'Filial sem meta',
    },
    {
      indicador: 'Cobertura de clientes',
      meta: 80,
      realizado: null,
      coletaDisponivel: true,
      atingimento: null,
      pontosBase: 40,
      pontosRealizados: null,
      observacao: 'Lançamento pendente: entrou sem valor',
    },
  ],
  pontuacao: { ...PONTUACAO_SEM_FAIXA },
  faixas: null,
  pendencias: ['Visitas a clientes (3º tri/2026): sem lançamento'],
  avisos: ['Filial 101 sem tabela de faixas: sem pontuação'],
  geradoEm: '2026-09-30 18:00:00-04:00',
  usuario: 'Ana Costa',
}

export const IMAGEM_GERENTES_ANA: ImagemCongelada = {
  id: 3,
  codigo: 'IMG-000003',
  lote: 'ENC-000002',
  chave: null,
  tipo: 'colaborador',
  idColaborador: 11,
  dashboard: { ...DASHBOARD_GERENTES },
  periodo: { codigo: '10/2026', inicio: '2026-10-01', fim: '2026-10-31' },
  unidade: { filial: '100', nomeFilial: 'MATRIZ', colaborador: 'Ana Souza', cargo: 'Gerente de Loja' },
  resultadoOperacional: { indicador: 'Faturamento', valor: 150000, observacao: null },
  pedPercentual: 20,
  pontosBaseTotal: 50,
  indicadores: [
    {
      indicador: 'Custo de frete por entrega',
      meta: 12,
      realizado: 10,
      coletaDisponivel: true,
      atingimento: 120,
      pontosBase: 20,
      pontosRealizados: 20,
      observacao: 'Menor é melhor',
    },
    {
      indicador: 'Vendas por colaborador',
      meta: 50000,
      realizado: null,
      coletaDisponivel: false,
      atingimento: null,
      pontosBase: 30,
      pontosRealizados: null,
      observacao: 'Sem coleta ainda',
    },
  ],
  pontuacao: {
    calculada: true,
    motivo: null,
    faixaAtual: { de: 0, ate: 3000, aliquota: 0.5 },
    faixaAnterior: null,
    aliquotaAnterior: 0,
    aliquotaAtual: 0.5,
    pisoDaFaixa: 0,
    opcaoA: 0,
    opcaoB: 750,
    opcaoSelecionada: 'B',
    baseDeCalculo: 750,
    valor: 150,
  },
  faixas: { nome: null, versao: 1, linhas: [{ de: 0, ate: 3000, aliquota: 0.5 }] },
  pendencias: [],
  avisos: ['Vendas por colaborador: sem coleta ainda'],
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
}

export const IMAGEM_GERENTES_DIEGO: ImagemCongelada = {
  id: 4,
  codigo: 'IMG-000004',
  lote: 'ENC-000002',
  chave: null,
  tipo: 'colaborador',
  idColaborador: 14,
  dashboard: { ...DASHBOARD_GERENTES },
  periodo: { codigo: '10/2026', inicio: '2026-10-01', fim: '2026-10-31' },
  unidade: { filial: '102', nomeFilial: 'DOURADOS', colaborador: 'Diego Rocha', cargo: 'Gerente de Loja' },
  resultadoOperacional: { indicador: 'Faturamento', valor: 98000, observacao: null },
  pedPercentual: 16,
  pontosBaseTotal: 50,
  indicadores: [
    {
      indicador: 'Custo de frete por entrega',
      meta: 12,
      realizado: 15,
      coletaDisponivel: true,
      atingimento: 80,
      pontosBase: 20,
      pontosRealizados: 16,
      observacao: 'Menor é melhor',
    },
    {
      indicador: 'Vendas por colaborador',
      meta: 50000,
      realizado: null,
      coletaDisponivel: false,
      atingimento: null,
      pontosBase: 30,
      pontosRealizados: null,
      observacao: 'Sem coleta ainda',
    },
  ],
  pontuacao: { ...PONTUACAO_SEM_FAIXA },
  faixas: null,
  pendencias: [],
  avisos: ['Filial 102 sem tabela de faixas: sem pontuação'],
  geradoEm: '2026-11-01 09:00:00-04:00',
  usuario: 'admin',
}

/** Cópia independente de uma imagem (para alterar nos testes sem afetar as constantes). */
export function copiarImagemDominio(imagem: ImagemCongelada): ImagemCongelada {
  return structuredClone(imagem)
}

/** A mesma imagem como vem na prévia: sem id, código, lote, data e usuário, e com a chave da unidade. */
export function imagemDaPrevia(imagem: ImagemCongelada, chave: string): ImagemCongelada {
  return { ...copiarImagemDominio(imagem), id: null, codigo: null, lote: null, chave, geradoEm: null, usuario: null }
}
