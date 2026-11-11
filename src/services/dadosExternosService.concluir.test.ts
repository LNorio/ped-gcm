import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { DADO_DEVOLUCOES_API, respostaConclusaoApi } from '../test/dadosExternosFalsos'
import type { IntegracaoDadoExterno } from '../types/dominio'
import { ApiError, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { concluirConstrucao, errosDaIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'
/** Saída no formato "chave: tipo" (11/11/2026 — `FRONT-saida-chave-tipo.md`). */
const SAIDA = '{\n  "codfil": "string",\n  "vlrLiq": "number",\n  "data": "date"\n}'
const ENTRADA = '{ "filial": "%filial%", "inicio": "%dataInicial% - 3m" }'

/** Integração válida informada na modal (textos das caixas, como digitados; sem mapeamento desde 11/11/2026). */
function integracao(sobrescrever: Partial<IntegracaoDadoExterno> = {}): IntegracaoDadoExterno {
  return {
    identificador: 'DEVOLUCOES',
    url: 'https://ti.exemplo.com.br/api/consulta',
    parametrosSaida: SAIDA,
    parametrosEntrada: ENTRADA,
    ...sobrescrever,
  }
}

/** Resposta 400 documentada em `FRONT-integracao-dado-externo.md`, seção 1. */
const CORPO_400 = {
  mensagem: 'integracao invalida: URL ...',
  erros: [
    { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
    { campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 },
    { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' },
  ],
}

describe('F5.7 — Serviço de dados externos: concluirConstrucao(id, integracao) com a integração completa (contrato de 09/11/2026)', () => {
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

  const CONCLUIDO_API = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }

  describe('corpo do PUT .../{id}/concluir', () => {
    it('envia identificador (maiúsculas, sem espaços nas pontas), url (sem espaços nas pontas), os textos dos dois JSONs como digitados e nada mais', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(CONCLUIDO_API, null)),
      })

      await concluirConstrucao(3, integracao({ identificador: '  devolucoes ', url: '  https://ti.exemplo.com.br/api/consulta  ' }))

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/concluir`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toStrictEqual({
        identificador: 'DEVOLUCOES',
        url: 'https://ti.exemplo.com.br/api/consulta',
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
      })
    })

    it('o corpo tem exatamente as chaves do contrato (nem só o identificador, nem campos extras)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(CONCLUIDO_API, null)),
      })

      await concluirConstrucao(3, { ...integracao(), variaveisUsadas: ['filial'] } as IntegracaoDadoExterno)

      expect(Object.keys(corpoDaChamada(chamadas[0]) as object).sort()).toEqual(
        ['identificador', 'parametros de entrada', 'parametros de saida', 'url'].sort(),
      )
    })

    /**
     * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): os
     * parâmetros de saída só mostram ao back-end a saída esperada; não há amarração. O corpo **não** leva
     * `"campo da filial"`, `"campo do valor"`, `"campo da meta"` nem `"campo da competencia"` (nem o objeto
     * `mapeamento`), mesmo que um chamador antigo ainda mande o mapeamento.
     */
    it('não envia o mapeamento da saída, mesmo que venha na integração (chamador antigo)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(CONCLUIDO_API, null)),
      })
      const comMapeamento = {
        ...integracao(),
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoMeta: 'metVlr', campoCompetencia: 'data' },
      } as IntegracaoDadoExterno

      await concluirConstrucao(3, comMapeamento)

      const corpo = corpoDaChamada(chamadas[0]) as Record<string, unknown>
      for (const chave of ['campo da filial', 'campo do valor', 'campo da meta', 'campo da competencia', 'mapeamento', 'campoFilial']) {
        expect(corpo).not.toHaveProperty([chave])
      }
    })

    it('os textos dos JSONs vão como estão (quebras de linha e espaços preservados, sem reformatar)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(CONCLUIDO_API, null)),
      })
      const saida = '  { "codfil": "string" }\n'
      const entrada = '{\r\n"x": "(%mesesRetro% * 30) - 1"\r\n}'

      await concluirConstrucao(3, integracao({ parametrosSaida: saida, parametrosEntrada: entrada }))

      const corpo = corpoDaChamada(chamadas[0]) as Record<string, unknown>
      expect(corpo['parametros de saida']).toBe(saida)
      expect(corpo['parametros de entrada']).toBe(entrada)
    })
  })

  describe('resposta 2xx', () => {
    it('{ mensagem, "dado externo", "indicador criado" } devolve o dado ativado e o indicador', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () =>
          respostaJson({ mensagem: 'Construção concluída.', ...respostaConclusaoApi(CONCLUIDO_API, { id: 30, nome: 'Devoluções de venda' }) }),
      })

      await expect(concluirConstrucao(3, integracao())).resolves.toMatchObject({
        dadoExterno: { id: 3, situacao: 'ativo', identificador: 'DEVOLUCOES' },
        indicadorCriado: { id: 30, nome: 'Devoluções de venda' },
      })
    })

    it('resposta documentada { mensagem, "indicador criado": { id, nome, situacao } } sem o dado resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () =>
          respostaJson({ mensagem: 'construcao concluida', 'indicador criado': { id: 30, nome: 'Devoluções de venda', situacao: 'ativo' } }),
      })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('resposta 2xx só com { mensagem } resolve null, sem erro (o dado foi concluído)', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ mensagem: 'Construção concluída.' }) })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('resposta 200 com corpo vazio resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => new Response('', { status: 200 }) })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('resposta 204 sem corpo resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => new Response(null, { status: 204 }) })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('resposta 2xx só com { id } resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ id: 3 }) })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('dado incompleto (sem situacao e coleta) resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ id: 3, nome: 'Devoluções de venda', identificador: 'DEVOLUCOES' }),
      })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('dado com tipo de valor desconhecido resolve null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ ...CONCLUIDO_API, 'tipo de valor': 'Moeda' }),
      })

      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })

    it('resposta 2xx com lista ou texto solto resolve null, sem erro', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson([CONCLUIDO_API]) })
      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()

      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson('ok') })
      await expect(concluirConstrucao(3, integracao())).resolves.toBeNull()
    })
  })

  describe('erros', () => {
    it('400 { mensagem, erros } rejeita com ApiError(400) com a mensagem geral e o corpo em dados', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson(CORPO_400, 400) })

      const erro = await concluirConstrucao(3, integracao()).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'integracao invalida: URL ...' })
      expect((erro as ApiError).dados).toEqual(CORPO_400)
    })

    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaErro(500) })

      const erro = await concluirConstrucao(3, integracao()).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(concluirConstrucao(3, integracao())).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})

describe('F5.7 — errosDaIntegracao(falha): erros por campo do 400 da integração', () => {
  it('converte os erros documentados (campo, mensagem e, quando vierem, linha/coluna ou caminho/expressão)', () => {
    const falha = new ApiError(400, CORPO_400.mensagem, CORPO_400)

    expect(errosDaIntegracao(falha)).toEqual([
      {
        campo: 'url',
        mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)',
        linha: null,
        coluna: null,
        caminho: null,
        expressao: null,
      },
      { campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1, caminho: null, expressao: null },
      { campo: 'parametros de entrada', mensagem: 'divisao por zero', linha: null, coluna: null, caminho: 'inicio', expressao: '5 / 0' },
    ])
  })

  it('erro do identificador é convertido com campo "identificador"', () => {
    const falha = new ApiError(400, 'integracao invalida', {
      mensagem: 'integracao invalida',
      erros: [{ campo: 'identificador', mensagem: 'identificador invalido' }],
    })

    expect(errosDaIntegracao(falha)).toEqual([
      { campo: 'identificador', mensagem: 'identificador invalido', linha: null, coluna: null, caminho: null, expressao: null },
    ])
  })

  it('erro sem "campo" fica com campo null', () => {
    const falha = new ApiError(400, 'x', { mensagem: 'x', erros: [{ mensagem: 'erro geral' }] })

    expect(errosDaIntegracao(falha)).toEqual([
      { campo: null, mensagem: 'erro geral', linha: null, coluna: null, caminho: null, expressao: null },
    ])
  })

  it('itens sem mensagem em texto são ignorados; os demais são mantidos na ordem', () => {
    const falha = new ApiError(400, 'x', {
      mensagem: 'x',
      erros: [{ campo: 'url' }, 'texto solto', null, { campo: 'url', mensagem: 42 }, { campo: 'url', mensagem: 'URL invalida' }],
    })

    expect(errosDaIntegracao(falha).map((e) => e.mensagem)).toEqual(['URL invalida'])
  })

  it.each<[string, unknown]>([
    ['ApiError sem dados', new ApiError(400, 'Dados inválidos.')],
    ['dados sem "erros"', new ApiError(400, 'x', { mensagem: 'x' })],
    ['"erros" que não é lista', new ApiError(400, 'x', { mensagem: 'x', erros: 'url' })],
    ['dados que não são objeto', new ApiError(400, 'x', 'texto')],
    ['erro que não é ApiError', new Error('falhou')],
    ['valor qualquer', undefined],
  ])('%s → []', (_nome, falha) => {
    expect(errosDaIntegracao(falha)).toEqual([])
  })
})
