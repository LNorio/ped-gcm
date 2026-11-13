import { describe, expect, it } from 'vitest'
import {
  paraAcesso,
  paraApontamento,
  paraCorpoAjusteMetas,
  paraCorpoDashboard,
  paraCorpoNovaTabelaFaixas,
  paraCorpoNovoApontamento,
  paraCorpoNovoDadoExterno,
  paraCorpoNovoIndicador,
  paraCorpoPreenchimento,
  paraDadoExterno,
  paraDashboard,
  paraFechamento,
  paraFilial,
  paraHistoricoMeta,
  paraIndicador,
  paraPeriodo,
  paraTabelaFaixas,
  paraTipoApontamento,
  paraTipoValor,
} from './adaptadores'
import { DADO_TAREFA_SEM_NUMERO_API } from '../test/dadosExternosFalsos'
import { RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API } from '../test/dashboardsFalsos'

describe('F1.3 — Adaptadores da API (ida: resposta → tipo)', () => {
  it('paraTipoValor converte "Porcentagem"/"Numeral"/"Booleano" (qualquer caixa) para o enum', () => {
    expect(paraTipoValor('Porcentagem')).toBe('porcentagem')
    expect(paraTipoValor('NUMERAL')).toBe('numeral')
    expect(paraTipoValor('booleano')).toBe('booleano')
  })

  it('paraTipoValor lança erro para valor desconhecido (falha explícita, não silenciosa)', () => {
    expect(() => paraTipoValor('x')).toThrow()
    expect(() => paraTipoValor('')).toThrow()
  })

  it('paraFilial converte "empresa" numérica em texto', () => {
    const resposta = { filial: '100', 'nome filial': 'Filial 100', empresa: 1 } as unknown as Parameters<
      typeof paraFilial
    >[0]

    expect(paraFilial(resposta)).toEqual({ codigo: '100', nome: 'Filial 100', empresa: '1' })
  })

  it('paraFilial lê "nome filial" e "empresa"', () => {
    expect(paraFilial({ filial: '100', 'nome filial': 'Filial 100', empresa: '1' })).toEqual({
      codigo: '100',
      nome: 'Filial 100',
      empresa: '1',
    })
  })

  it('paraFilial aceita filial sem empresa (ex.: /api/ped/acesso)', () => {
    expect(paraFilial({ filial: '101', 'nome filial': 'CAMPO GRANDE' })).toEqual({
      codigo: '101',
      nome: 'CAMPO GRANDE',
      empresa: null,
    })
  })

  it('paraAcesso converte a resposta de GET /api/ped/acesso', () => {
    const resposta = {
      'id colaborador': 12,
      nome: 'Fulano',
      perfil: 'preenchedor',
      tipos: [{ id: 1, nome: 'Comercial' }],
      'todas as filiais': false,
      filiais: [{ filial: '101', 'nome filial': 'CAMPO GRANDE' }],
      'periodo aberto': '2026-10-01',
    }

    expect(paraAcesso(resposta)).toEqual({
      idColaborador: 12,
      nome: 'Fulano',
      perfil: 'preenchedor',
      tipos: [{ id: 1, nome: 'Comercial' }],
      todasAsFiliais: false,
      filiais: [{ codigo: '101', nome: 'CAMPO GRANDE', empresa: null }],
      periodoAberto: '2026-10-01',
    })
  })

  it('paraAcesso mantém perfil null para usuário sem acesso ao PED', () => {
    const acesso = paraAcesso({
      'id colaborador': 30,
      nome: 'Sem Perfil',
      perfil: null,
      tipos: [],
      'todas as filiais': false,
      filiais: [],
      'periodo aberto': null,
    })

    expect(acesso.perfil).toBeNull()
    expect(acesso.tipos).toEqual([])
    expect(acesso.filiais).toEqual([])
    expect(acesso.periodoAberto).toBeNull()
  })

  it('paraPeriodo converte GET /api/ped/periodo', () => {
    expect(
      paraPeriodo({ 'mes de referencia': '2026-10-01', 'aberto por': 'Admin', 'aberto em': '2026-10-01 08:00:00' }),
    ).toEqual({ mesDeReferencia: '2026-10-01', abertoPor: 'Admin', abertoEm: '2026-10-01 08:00:00' })
  })

  it('paraTipoApontamento converte um item de GET /api/ped/tipos-apontamento', () => {
    expect(
      paraTipoApontamento({
        id: 1,
        nome: 'Comercial',
        origem: 'Fixo',
        'quantidade usuarios': 3,
        'quantidade apontamentos': 7,
      }),
    ).toEqual({ id: 1, nome: 'Comercial', origem: 'Fixo', quantidadeUsuarios: 3, quantidadeApontamentos: 7 })
  })

  it('paraApontamento converte um item de GET /api/ped/apontamentos', () => {
    const resposta = {
      id: 5,
      nome: 'Visitas realizadas',
      descricao: 'Visitas a clientes no mês',
      ativo: true,
      'id tipo': 1,
      tipo: 'Comercial',
      'tipo de valor': 'Numeral',
      indicadores: [{ id: 12, nome: 'Atingimento de cobertura' }],
      'vinculado a dashboard': true,
      'desativado mas usado em indicador ativo': false,
      'cadastrado em': '2026-10-28 10:15:00',
      'cadastrado por': 'Fulano',
      'situacao alterada em': null,
      'situacao alterada por': null,
    }

    expect(paraApontamento(resposta)).toEqual({
      id: 5,
      nome: 'Visitas realizadas',
      descricao: 'Visitas a clientes no mês',
      ativo: true,
      idTipo: 1,
      tipo: 'Comercial',
      tipoValor: 'numeral',
      indicadores: [{ id: 12, nome: 'Atingimento de cobertura' }],
      vinculadoADashboard: true,
      desativadoMasUsadoEmIndicadorAtivo: false,
      cadastradoEm: '2026-10-28 10:15:00',
      cadastradoPor: 'Fulano',
      situacaoAlteradaEm: null,
      situacaoAlteradaPor: null,
    })
  })

  it('paraApontamento trata descrição ausente como null e indicadores ausentes como lista vazia', () => {
    const apontamento = paraApontamento({
      id: 6,
      nome: 'Meta batida',
      ativo: false,
      'id tipo': 2,
      tipo: 'Financeiro',
      'tipo de valor': 'Booleano',
      'vinculado a dashboard': false,
      'desativado mas usado em indicador ativo': true,
      'situacao alterada em': '2026-10-29 09:00:00',
      'situacao alterada por': 'Validador',
    })

    expect(apontamento.descricao).toBeNull()
    expect(apontamento.indicadores).toEqual([])
    expect(apontamento.tipoValor).toBe('booleano')
    expect(apontamento.cadastradoEm).toBeNull()
    expect(apontamento.situacaoAlteradaPor).toBe('Validador')
  })

  it('paraDadoExterno converte um item de GET /api/ped/dados-externos-cadastro', () => {
    const resposta = {
      id: 3,
      nome: 'Faturamento líquido',
      'id tipo': 1,
      tipo: 'Comercial',
      situacao: 'em_construcao',
      'situacao descricao': 'Em construção (TI)',
      'tarefa bitrix': { id: 9, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Faturamento líquido' },
      'sistema de origem': 'senior_erp',
      identificador: null,
      'campo calculo': 'Vendas líquidas do mês',
      referencia: 'filial',
      coleta: 'dia do mes',
      'dia da coleta': 15,
      'coleta descricao': 'Dia 15 de cada mês',
      'sentido do calculo': 'soma',
      'janela retroativa': 3,
      comentarios: null,
      'tipo de valor': 'Numeral',
      'coleta disponivel': false,
      indicadores: [],
      'cadastrado em': '2026-10-28 11:00:00',
      'cadastrado por': 'Validador',
      'situacao alterada em': null,
      'situacao alterada por': null,
    }

    expect(paraDadoExterno(resposta)).toEqual({
      id: 3,
      nome: 'Faturamento líquido',
      idTipo: 1,
      tipo: 'Comercial',
      situacao: 'em_construcao',
      situacaoDescricao: 'Em construção (TI)',
      tarefaBitrix: { id: 9, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Faturamento líquido' },
      sistemaOrigem: 'senior_erp',
      identificador: null,
      campoCalculo: 'Vendas líquidas do mês',
      referencia: 'filial',
      coleta: 'dia do mes',
      diaDaColeta: 15,
      coletaDescricao: 'Dia 15 de cada mês',
      sentidoCalculo: 'soma',
      janelaRetroativa: 3,
      comentarios: null,
      tipoValor: 'numeral',
      coletaDisponivel: false,
      indicadores: [],
      cadastradoEm: '2026-10-28 11:00:00',
      cadastradoPor: 'Validador',
      situacaoAlteradaEm: null,
      situacaoAlteradaPor: null,
      // Integração (09/11/2026): ausente para Validador/Preenchedor → valores vazios.
      url: null,
      parametrosSaida: null,
      parametrosEntrada: null,
      variaveisUsadas: [],
      integracaoPendente: false,
      integracaoAlteradaEm: null,
      integracaoAlteradaPor: null,
      // Alteração de 10/11/2026: "fornece meta" ausente → false.
      forneceMeta: false,
      // Executor (11/11/2026): "ultima consulta em"/"erro da ultima consulta" ausentes → null.
      ultimaConsultaEm: null,
      erroUltimaConsulta: null,
      // Saída sem mapeamento (11/11/2026): sem `mapeamentoSaida` (toEqual exige a ausência).
    })
  })

  /**
   * Alteração de 10/11/2026 (seção 2.5 de `RESPOSTA-FINAL-meta-via-api.md`): a listagem traz, para
   * todos os perfis, `"fornece meta"` (true/false) → `forneceMeta`; ausente ou null → false.
   */
  it.each<[string, boolean, Record<string, unknown>]>([
    ['"fornece meta": true', true, { 'fornece meta': true }],
    ['"fornece meta": false', false, { 'fornece meta': false }],
    ['"fornece meta" ausente', false, {}],
    ['"fornece meta": null', false, { 'fornece meta': null }],
  ])('paraDadoExterno: %s → forneceMeta %s', (_nome, esperado, campos) => {
    const dado = paraDadoExterno({
      id: 5,
      nome: 'Faturamento',
      'id tipo': 1,
      tipo: 'Comercial',
      situacao: 'ativo',
      'situacao descricao': 'Ativo',
      'tarefa bitrix': null,
      'sistema de origem': 'senior_erp',
      identificador: 'FATURAMENTO',
      'campo calculo': null,
      referencia: 'filial',
      coleta: 'diaria',
      'dia da coleta': null,
      'coleta descricao': 'Diária',
      'sentido do calculo': 'soma',
      'janela retroativa': 1,
      comentarios: null,
      'tipo de valor': 'Numeral',
      'coleta disponivel': true,
      indicadores: [],
      ...campos,
    } as Parameters<typeof paraDadoExterno>[0])

    expect(dado.forneceMeta).toBe(esperado)
  })

  it('paraDadoExterno: campos da integração que só o Admin recebe (09/11/2026)', () => {
    const dado = paraDadoExterno({
      id: 4,
      nome: 'Cobertura',
      'id tipo': 1,
      tipo: 'Comercial',
      situacao: 'ativo',
      'situacao descricao': 'Ativo',
      'tarefa bitrix': null,
      'sistema de origem': 'senior_erp',
      identificador: 'COBERTURA',
      'campo calculo': null,
      referencia: 'filial',
      coleta: 'diaria',
      'dia da coleta': null,
      'coleta descricao': 'Diária',
      'sentido do calculo': 'soma',
      'janela retroativa': 1,
      comentarios: null,
      'tipo de valor': 'Porcentagem',
      'coleta disponivel': true,
      indicadores: [],
      url: 'https://ti.exemplo.com.br/api/cobertura',
      'parametros de saida': { valor: '0' },
      'parametros de entrada': { filial: '%filial%' },
      'variaveis usadas': ['filial'],
      'integracao pendente': false,
      'integracao alterada em': '2026-11-09 10:00:00',
      'integracao alterada por': 'Equipe TI',
    })

    expect(dado).toMatchObject({
      url: 'https://ti.exemplo.com.br/api/cobertura',
      parametrosSaida: { valor: '0' },
      parametrosEntrada: { filial: '%filial%' },
      variaveisUsadas: ['filial'],
      integracaoPendente: false,
      integracaoAlteradaEm: '2026-11-09 10:00:00',
      integracaoAlteradaPor: 'Equipe TI',
    })
  })

  /**
   * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): o back-end
   * ainda pode mandar `"mapeamento da saida"`, mas o adaptador não o lê — `DadoExterno` não tem mais
   * `mapeamentoSaida` — e nenhum valor do campo rejeita o dado. A saída em objeto continua em `parametrosSaida`.
   */
  it.each<[string, unknown]>([
    ['objeto do formato anterior', { 'campo da filial': 'codfil', 'campo do valor': 'vlrLiq', 'campo da competencia': 'data' }],
    ['null', null],
    ['texto', 'codfil'],
    ['sem "campo da filial"', { 'campo do valor': 'vlrLiq' }],
  ])('paraDadoExterno: "mapeamento da saida" %s é ignorado (sem mapeamentoSaida)', (_nome, mapeamento) => {
    const bruto: Record<string, unknown> = {
      ...DADO_TAREFA_SEM_NUMERO_API,
      'parametros de saida': { codfil: 'string', vlrLiq: 'number', data: 'date' },
      'mapeamento da saida': mapeamento,
    }

    const dado = paraDadoExterno(bruto as Parameters<typeof paraDadoExterno>[0])

    expect(dado.parametrosSaida).toEqual({ codfil: 'string', vlrLiq: 'number', data: 'date' })
    expect(dado).not.toHaveProperty('mapeamentoSaida')
  })

  it('paraDadoExterno: dado ativo do Admin com identificador, sem tarefa e com janela nula em "ultimo"', () => {
    const dado = paraDadoExterno({
      id: 4,
      nome: 'Cobertura',
      'id tipo': 1,
      tipo: 'Comercial',
      situacao: 'ativo',
      'situacao descricao': 'Ativo',
      'tarefa bitrix': null,
      'sistema de origem': 'senior_erp',
      identificador: 'COBERTURA',
      'campo calculo': null,
      referencia: 'filial',
      coleta: 'diaria',
      'dia da coleta': null,
      'coleta descricao': 'Diária',
      'sentido do calculo': 'ultimo',
      'janela retroativa': null,
      comentarios: null,
      'tipo de valor': 'Porcentagem',
      'coleta disponivel': true,
      indicadores: ['Cobertura'],
    })

    expect(dado.tarefaBitrix).toBeNull()
    expect(dado.identificador).toBe('COBERTURA')
    expect(dado.diaDaColeta).toBeNull()
    expect(dado.janelaRetroativa).toBeNull()
    expect(dado.sentidoCalculo).toBe('ultimo')
    expect(dado.tipoValor).toBe('porcentagem')
    expect(dado.coletaDisponivel).toBe(true)
    expect(dado.indicadores).toEqual(['Cobertura'])
  })

  it('paraIndicador converte um item de GET /api/ped/indicadores-cadastro', () => {
    const resposta = {
      id: 12,
      nome: 'Atingimento de cobertura',
      descricao: null,
      ativo: true,
      composicao: {
        tipo: 'apontamentos',
        itens: [
          { id: 5, nome: 'Visitas realizadas', ativo: true },
          { id: 7, nome: 'Clientes atendidos', ativo: false },
        ],
      },
      tipos: ['Comercial'],
      sentido: 'maior_melhor',
      calculo: 'media',
      meta: 1500.5,
      'meta a definir': false,
      'origem da meta': 'manual',
      'meta editavel no preenchimento': true,
      'criado automaticamente': false,
      'componentes desativados': true,
      problema: { tipo: 'apontamentos_parcialmente_desativados', mensagem: 'O cálculo segue sem eles.' },
      dashboards: [{ id: 3, nome: 'PED Comercial', 'pontos base': 40 }],
      'vinculado a dashboard': true,
      'cadastrado em': '2026-10-28 12:00:00',
      'cadastrado por': 'Admin',
      'situacao alterada em': null,
      'situacao alterada por': null,
    }

    expect(paraIndicador(resposta)).toEqual({
      id: 12,
      nome: 'Atingimento de cobertura',
      descricao: null,
      ativo: true,
      composicao: {
        tipo: 'apontamentos',
        itens: [
          { id: 5, nome: 'Visitas realizadas', ativo: true },
          { id: 7, nome: 'Clientes atendidos', ativo: false },
        ],
      },
      tipos: ['Comercial'],
      sentido: 'maior_melhor',
      calculo: 'media',
      meta: 1500.5,
      metaADefinir: false,
      origemDaMeta: 'manual',
      metaEditavel: true,
      criadoAutomaticamente: false,
      componentesDesativados: true,
      problema: { tipo: 'apontamentos_parcialmente_desativados', mensagem: 'O cálculo segue sem eles.' },
      dashboards: [{ id: 3, nome: 'PED Comercial', pontosBase: 40 }],
      vinculadoADashboard: true,
      metasPorFilial: [],
      filiaisSemMeta: [],
      metaPorFilial: false,
      cadastradoEm: '2026-10-28 12:00:00',
      cadastradoPor: 'Admin',
      situacaoAlteradaEm: null,
      situacaoAlteradaPor: null,
    })
  })

  it('paraIndicador: indicador automático por dado externo, sem meta e sem sentido', () => {
    const indicador = paraIndicador({
      id: 20,
      nome: 'Cobertura',
      descricao: null,
      ativo: true,
      composicao: { tipo: 'dado_externo', itens: [{ id: 4, nome: 'Cobertura', ativo: true }] },
      tipos: ['Comercial'],
      sentido: null,
      calculo: null,
      meta: null,
      'meta a definir': true,
      'origem da meta': null,
      'meta editavel no preenchimento': false,
      'criado automaticamente': true,
      'componentes desativados': false,
      problema: null,
      dashboards: [],
      'vinculado a dashboard': false,
    })

    expect(indicador.composicao.tipo).toBe('dado_externo')
    expect(indicador.sentido).toBeNull()
    expect(indicador.calculo).toBeNull()
    expect(indicador.meta).toBeNull()
    expect(indicador.metaADefinir).toBe(true)
    expect(indicador.criadoAutomaticamente).toBe(true)
    expect(indicador.problema).toBeNull()
    expect(indicador.dashboards).toEqual([])
  })

  it('paraDashboard converte um item de GET /api/ped/dashboards', () => {
    const resposta = {
      id: 3,
      nome: 'PED Comercial',
      situacao: 'ativo',
      'situacao descricao': 'Ativo',
      'tarefa bitrix': { id: 11, status: 'concluida', titulo: '[PED] Construir dashboard: PED Comercial' },
      'tipo de vinculo': 'filiais',
      'itens vinculados': ['101', '201'],
      'unidades de imagem': 2,
      periodicidade: 'trimestral',
      'periodo atual': '4º tri/2026',
      'quantidade de indicadores': 2,
      pontos: { soma: 100, maximo: 100 },
      alertas: [{ indicador: 'Clientes atendidos', motivo: 'Indicador inativo', 'pontos afetados': 60 }],
      'cadastrado em': '2026-10-28 13:00:00',
      'ultima alteracao': '2026-10-30 09:30:00',
    }

    expect(paraDashboard(resposta)).toEqual({
      id: 3,
      nome: 'PED Comercial',
      situacao: 'ativo',
      situacaoDescricao: 'Ativo',
      tarefaBitrix: { id: 11, status: 'concluida', titulo: '[PED] Construir dashboard: PED Comercial' },
      tipoVinculo: 'filiais',
      itensVinculados: ['101', '201'],
      unidadesDeImagem: 2,
      periodicidade: 'trimestral',
      periodoAtual: '4º tri/2026',
      quantidadeDeIndicadores: 2,
      pontos: { soma: 100, maximo: 100 },
      alertas: [{ indicador: 'Clientes atendidos', motivo: 'Indicador inativo', pontosAfetados: 60 }],
      alertasDeFaixas: [],
      cadastradoEm: '2026-10-28 13:00:00',
      ultimaAlteracao: '2026-10-30 09:30:00',
    })
  })

  it('paraDashboard: "tarefa bitrix" sem número (id null, ainda não enviada ao Bitrix24) mantém a tarefa com id null', () => {
    const dashboard = paraDashboard(RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API[0])

    expect(dashboard.tarefaBitrix).toEqual({ id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' })
    expect(dashboard.situacao).toBe('em_construcao')
    expect(dashboard.itensVinculados).toEqual(['100 - Filial 100'])
  })

  it('paraDadoExterno: "tarefa bitrix" sem número (id null) mantém a tarefa com id null', () => {
    const dado = paraDadoExterno(DADO_TAREFA_SEM_NUMERO_API)

    expect(dado.tarefaBitrix).toEqual({ id: null, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Bonificações pagas' })
    expect(dado.situacao).toBe('em_construcao')
  })

  it('paraTabelaFaixas converte um item de GET /api/ped/faixas', () => {
    const resposta = {
      id: 8,
      'id dashboard': 3,
      dashboard: 'PED Comercial',
      'dashboard excluido': false,
      filial: '101',
      'nome filial': 'CAMPO GRANDE',
      descricao: null,
      'versao vigente': 2,
      'data da versao': '2026-10-30 10:00:00',
      'autor da versao': 'Admin',
      'quantidade de faixas': 2,
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
      ],
    }

    expect(paraTabelaFaixas(resposta)).toEqual({
      id: 8,
      idDashboard: 3,
      dashboard: 'PED Comercial',
      dashboardExcluido: false,
      filial: '101',
      nomeFilial: 'CAMPO GRANDE',
      geral: false,
      situacao: 'ativa',
      motivoDaSituacao: null,
      dataDaSituacao: null,
      usuarioDaSituacao: null,
      descricao: null,
      versaoVigente: 2,
      dataDaVersao: '2026-10-30 10:00:00',
      autorDaVersao: 'Admin',
      quantidadeDeFaixas: 2,
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
      ],
    })
  })

  it('paraTabelaFaixas converte a faixa geral inativa (F8.7): geral, filial e nome filial null, situação, motivo, data e usuário da situação', () => {
    const resultado = paraTabelaFaixas({
      id: 7,
      'id dashboard': 3,
      dashboard: 'PED Gerentes',
      'dashboard excluido': false,
      geral: true,
      filial: null,
      'nome filial': null,
      situacao: 'inativa',
      'motivo da situacao': 'passou a valer faixa por filial',
      'data da situacao': '2026-11-12T14:05:00.000000Z',
      'usuario da situacao': 'admin',
      descricao: null,
      'versao vigente': 2,
      'data da versao': '2026-11-01T10:00:00.000000Z',
      'autor da versao': 'admin',
      'quantidade de faixas': 1,
      faixas: [{ de: 0, ate: 1000, aliquota: 0 }],
    })

    expect(resultado).toMatchObject({
      id: 7,
      geral: true,
      filial: null,
      nomeFilial: null,
      situacao: 'inativa',
      motivoDaSituacao: 'passou a valer faixa por filial',
      dataDaSituacao: '2026-11-12T14:05:00.000000Z',
      usuarioDaSituacao: 'admin',
    })
  })

  it('paraDashboard converte "alertas de faixas" (F7.14): tipo, mensagem e filial (ou null)', () => {
    const dashboard = paraDashboard({
      ...RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API[0],
      'alertas de faixas': [
        { tipo: 'conflito', mensagem: 'faixa geral e faixa da filial 101 ativas ao mesmo tempo', filial: '101' },
        { tipo: 'sem_faixa', mensagem: 'dashboard sem faixa ativa', filial: null },
      ],
    })

    expect(dashboard.alertasDeFaixas).toEqual([
      { tipo: 'conflito', mensagem: 'faixa geral e faixa da filial 101 ativas ao mesmo tempo', filial: '101' },
      { tipo: 'sem_faixa', mensagem: 'dashboard sem faixa ativa', filial: null },
    ])
    expect(dashboard.alertas).toEqual([])
  })

  it('paraTabelaFaixas usa a quantidade de faixas da lista quando a API não envia "quantidade de faixas"', () => {
    const resultado = paraTabelaFaixas({
      id: 9,
      'id dashboard': 3,
      dashboard: 'PED Comercial',
      filial: '201',
      'nome filial': 'DOURADOS',
      'versao vigente': 1,
      faixas: [
        { de: 0, ate: 500, aliquota: 0 },
        { de: 500.01, ate: 1000, aliquota: 1 },
        { de: 1000.01, ate: 2000, aliquota: 2 },
      ],
    })

    expect(resultado.quantidadeDeFaixas).toBe(3)
    expect(resultado.faixas).toHaveLength(3)
  })

  it('paraHistoricoMeta converte um item de GET .../metas-historico', () => {
    expect(
      paraHistoricoMeta({
        data: '2026-10-29 14:00:00',
        filial: '101',
        'mes de referencia': '2026-10-01',
        de: 1500.5,
        para: 2000.25,
        usuario: 'Fulano',
        motivo: 'sazonalidade',
      }),
    ).toEqual({
      data: '2026-10-29 14:00:00',
      filial: '101',
      mesDeReferencia: '2026-10-01',
      de: 1500.5,
      para: 2000.25,
      usuario: 'Fulano',
      motivo: 'sazonalidade',
    })
  })

  it('paraFechamento converte uma linha de GET /api/ped/fechamentos', () => {
    expect(
      paraFechamento({
        id: 3,
        nome: 'PED Comercial',
        'tipo de vinculo': 'filiais',
        'itens vinculados': ['101', '201'],
        periodicidade: 'trimestral',
        'periodo atual': '4º tri/2026',
        'situacao do periodo': 'aberto',
        'unidades de imagem': 2,
        'unidades encerradas': 0,
        'unidades com pendencias': 1,
        progresso: { preenchidos: 3, total: 4 },
        'indicadores com problema': ['Clientes atendidos'],
        'unidades sem tabela de faixas': ['201'],
      }),
    ).toEqual({
      id: 3,
      nome: 'PED Comercial',
      tipoVinculo: 'filiais',
      itensVinculados: ['101', '201'],
      periodicidade: 'trimestral',
      periodoAtual: '4º tri/2026',
      situacaoDoPeriodo: 'aberto',
      unidadesDeImagem: 2,
      unidadesEncerradas: 0,
      unidadesComPendencias: 1,
      progresso: { preenchidos: 3, total: 4 },
      indicadoresComProblema: ['Clientes atendidos'],
      unidadesSemTabelaDeFaixas: ['201'],
    })
  })

  it('paraFechamento sem "progresso" devolve progresso zerado (0 de 0)', () => {
    const resultado = paraFechamento({
      id: 4,
      nome: 'PED Contábil',
      'tipo de vinculo': 'filiais',
      periodicidade: 'trimestral',
      'periodo atual': '10/2026',
      'situacao do periodo': 'aberto',
    })

    expect(resultado.progresso).toEqual({ preenchidos: 0, total: 0 })
  })
})

describe('F1.3 — Adaptadores da API (volta: tipo → corpo da requisição)', () => {
  it('paraCorpoNovoIndicador sem apontamentos e sem dado externo envia "apontamentos" como lista vazia', () => {
    const corpo = paraCorpoNovoIndicador({
      nome: 'Indicador vazio',
      descricao: null,
      meta: 1,
      sentido: 'maior_melhor',
      metaEditavel: true,
    })

    expect(corpo.apontamentos).toEqual([])
    expect(corpo).not.toHaveProperty('dado externo')
    expect(corpo).not.toHaveProperty('calculo')
  })

  it('paraCorpoNovoApontamento monta o corpo de POST /api/ped/apontamentos', () => {
    expect(
      paraCorpoNovoApontamento({ nome: 'Visitas realizadas', idTipo: 1, tipoValor: 'numeral', descricao: 'Visitas no mês' }),
    ).toEqual({ nome: 'Visitas realizadas', 'id tipo': 1, 'tipo de valor': 'numeral', descricao: 'Visitas no mês' })
  })

  it('paraCorpoNovoApontamento envia descricao null quando não informada', () => {
    expect(paraCorpoNovoApontamento({ nome: 'Meta batida', idTipo: 2, tipoValor: 'booleano' })).toEqual({
      nome: 'Meta batida',
      'id tipo': 2,
      'tipo de valor': 'booleano',
      descricao: null,
    })
  })

  it('paraCorpoNovoDadoExterno monta o corpo do Admin (identificador em maiúsculas) com coleta em dia do mês', () => {
    expect(
      paraCorpoNovoDadoExterno({
        nome: 'Faturamento líquido',
        idTipo: 1,
        sistemaOrigem: 'senior_erp',
        tipoValor: 'numeral',
        referencia: 'filial',
        coleta: 'dia do mes',
        diaDaColeta: 15,
        sentidoCalculo: 'soma',
        janelaRetroativa: 3,
        comentarios: null,
        campoCalculo: null,
        identificador: 'faturamento',
        observacao: null,
      }),
    ).toEqual({
      nome: 'Faturamento líquido',
      'id tipo': 1,
      'sistema de origem': 'senior_erp',
      'tipo de valor': 'numeral',
      referencia: 'filial',
      coleta: 'dia do mes',
      'dia da coleta': 15,
      'sentido do calculo': 'soma',
      'janela retroativa': 3,
      comentarios: null,
      'campo calculo': null,
      identificador: 'FATURAMENTO',
      observacao: null,
    })
  })

  it('paraCorpoNovoDadoExterno: pedido do Validador/Preenchedor sem identificador, coleta diária e sentido "ultimo" sem janela', () => {
    const corpo = paraCorpoNovoDadoExterno({
      nome: 'Turnover',
      idTipo: 3,
      sistemaOrigem: 'outro',
      tipoValor: 'porcentagem',
      referencia: 'colaborador',
      coleta: 'diaria',
      diaDaColeta: null,
      sentidoCalculo: 'ultimo',
      janelaRetroativa: null,
      comentarios: 'Planilha do RH',
      campoCalculo: 'Desligados ÷ ativos × 100',
      identificador: null,
      observacao: 'Urgente',
    })

    expect(corpo).toEqual({
      nome: 'Turnover',
      'id tipo': 3,
      'sistema de origem': 'outro',
      'tipo de valor': 'porcentagem',
      referencia: 'colaborador',
      coleta: 'diaria',
      'dia da coleta': null,
      'sentido do calculo': 'ultimo',
      'janela retroativa': null,
      comentarios: 'Planilha do RH',
      'campo calculo': 'Desligados ÷ ativos × 100',
      identificador: null,
      observacao: 'Urgente',
    })
  })

  it('paraCorpoNovoIndicador monta o corpo com apontamentos', () => {
    expect(
      paraCorpoNovoIndicador({
        nome: 'Atingimento de cobertura',
        descricao: 'opcional',
        meta: 1500.5,
        sentido: 'maior_melhor',
        calculo: 'media',
        metaEditavel: true,
        apontamentos: [5, 7],
      }),
    ).toEqual({
      nome: 'Atingimento de cobertura',
      descricao: 'opcional',
      'origem da meta': 'manual',
      meta: 1500.5,
      sentido: 'maior_melhor',
      calculo: 'media',
      'meta editavel': true,
      apontamentos: [5, 7],
    })
  })

  it('paraCorpoNovoIndicador monta o corpo com um dado externo (sem apontamentos nem cálculo)', () => {
    const corpo = paraCorpoNovoIndicador({
      nome: 'Cobertura',
      descricao: null,
      meta: 80,
      sentido: 'menor_melhor',
      metaEditavel: false,
      dadoExterno: 4,
    })

    expect(corpo).toEqual({
      nome: 'Cobertura',
      descricao: null,
      'origem da meta': 'manual',
      meta: 80,
      sentido: 'menor_melhor',
      'meta editavel': false,
      'dado externo': 4,
    })
    expect(corpo).not.toHaveProperty('apontamentos')
    expect(corpo).not.toHaveProperty('calculo')
  })

  it('paraCorpoDashboard monta o corpo de POST/PUT /api/ped/dashboards', () => {
    expect(
      paraCorpoDashboard({
        nome: 'PED Comercial',
        periodicidade: 'trimestral',
        pontuacaoBaseMaxima: 100,
        tipoVinculo: 'filiais',
        itensVinculados: ['101', '201'],
        indicadores: [
          { idIndicador: 12, pontosBase: 40 },
          { idIndicador: 15, pontosBase: 60 },
        ],
        indicadorBaseDaFaixa: 20,
        formulaDePontuacao: 'texto livre, construído pela TI',
        observacaoParaTi: 'opcional',
      }),
    ).toEqual({
      nome: 'PED Comercial',
      periodicidade: 'trimestral',
      'pontuacao base maxima': 100,
      'tipo de vinculo': 'filiais',
      'itens vinculados': ['101', '201'],
      indicadores: [
        { 'id indicador': 12, 'pontos base': 40 },
        { 'id indicador': 15, 'pontos base': 60 },
      ],
      'indicador base da faixa': 20,
      'formula de pontuacao': 'texto livre, construído pela TI',
      'observacao para ti': 'opcional',
    })
  })

  it('paraCorpoDashboard inclui "enviar tarefa ti" só quando informado (edição)', () => {
    const base = {
      nome: 'PED Comercial',
      periodicidade: 'mensal' as const,
      pontuacaoBaseMaxima: 100,
      tipoVinculo: 'cargos' as const,
      itensVinculados: ['Vendedor'],
      indicadores: [{ idIndicador: 12, pontosBase: 100 }],
      indicadorBaseDaFaixa: 12,
      formulaDePontuacao: 'f',
      observacaoParaTi: null,
    }

    expect(paraCorpoDashboard(base)).not.toHaveProperty('enviar tarefa ti')
    expect(paraCorpoDashboard({ ...base, enviarTarefaTi: true })).toMatchObject({ 'enviar tarefa ti': true })
  })

  it('paraCorpoNovaTabelaFaixas monta o corpo de POST /api/ped/faixas', () => {
    expect(
      paraCorpoNovaTabelaFaixas({
        dashboard: 3,
        filial: '101',
        descricao: null,
        faixas: [
          { de: 0, ate: 1000, aliquota: 0 },
          { de: 1000.01, ate: 2000, aliquota: 1.5 },
        ],
      }),
    ).toEqual({
      dashboard: 3,
      filial: '101',
      descricao: null,
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
      ],
    })
  })

  it('paraCorpoNovaTabelaFaixas da faixa geral (F8.7) envia "filial": "todas"', () => {
    expect(
      paraCorpoNovaTabelaFaixas({ dashboard: 3, filial: 'todas', descricao: 'Régua única', faixas: [{ de: 0, ate: 2000, aliquota: 1 }] }),
    ).toEqual({ dashboard: 3, filial: 'todas', descricao: 'Régua única', faixas: [{ de: 0, ate: 2000, aliquota: 1 }] })
  })

  it('paraCorpoPreenchimento monta o corpo de PUT /api/ped/preenchimento (lançamento e correção)', () => {
    expect(
      paraCorpoPreenchimento({
        filial: '101',
        mesDeReferencia: '2026-10-01',
        itens: [
          { idApontamento: 5, valor: 1234.56 },
          { idApontamento: 7, valor: true },
          { idApontamento: 9, valor: 80, motivo: 'digitação errada' },
        ],
      }),
    ).toEqual({
      filial: '101',
      'mes de referencia': '2026-10-01',
      itens: [
        { 'id apontamento': 5, valor: 1234.56 },
        { 'id apontamento': 7, valor: true },
        { 'id apontamento': 9, valor: 80, motivo: 'digitação errada' },
      ],
    })
  })

  it('paraCorpoAjusteMetas monta o corpo de PUT /api/ped/metas', () => {
    expect(
      paraCorpoAjusteMetas({
        filial: '101',
        mesDeReferencia: '2026-10-01',
        itens: [{ idIndicador: 12, meta: 2000.25, motivo: 'sazonalidade' }],
      }),
    ).toEqual({
      filial: '101',
      'mes de referencia': '2026-10-01',
      itens: [{ 'id indicador': 12, meta: 2000.25, motivo: 'sazonalidade' }],
    })
  })
})
