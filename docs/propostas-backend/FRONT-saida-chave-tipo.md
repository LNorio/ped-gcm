# PED — saída da integração por "chave: tipo": o que o front precisa fazer

Resposta do back-end à `PROPOSTA-saida-chave-tipo.md` (11/11/2026). **Implementada a opção B** (tipos + campos de mapeamento), com um campo a mais e uma transição.

## 1. Respostas às 3 perguntas

1. **Opção B**, com o **`campo da competencia`** além dos dois da proposta. A opção A (só pelo nome) não se sustenta porque cada fonte nomeia os campos de um jeito; a C mistura duas informações num texto.
2. **Tipos aceitos:** `string`, `number`, `date`, `boolean`. Não existe `integer` (o `number` cobre).
3. **Transição:** o back aceita os **dois formatos**. Objeto `{chave: tipo}` é o novo; lista (com valores ou marcadores) é o antigo e continua funcionando. As integrações já salvas não precisam ser convertidas; para migrar, a TI salva de novo no formato novo.

## 2. Contrato novo

Vale para `PUT /api/ped/dados-externos-cadastro/{id}/concluir`, `PUT .../{id}/integracao`, `PUT /api/ped/indicadores-cadastro/{id}/integracao` e `POST /api/ped/integracao/validar`.

```json
{
  "identificador": "VOLUME_MANN",
  "url": "https://...?wsdl",
  "parametros de saida": { "codemp": "string", "codfil": "string", "vlrLiq": "number", "metVlr": "number", "data": "date" },
  "campo da filial": "codfil",
  "campo do valor": "vlrLiq",
  "campo da competencia": "data",
  "parametros de entrada": { "operacao": "...", "parametros": { } }
}
```

| Campo | Onde vale | Obrigatório | Tipo do campo apontado |
|---|---|---|---|
| `campo da filial` | dado externo e indicador | sim | `string` ou `number` |
| `campo do valor` | **dado externo** | sim | `number` |
| `campo da meta` | **indicador** (meta de fonte própria) | sim | `number` |
| `campo da competencia` | os dois | não | `date` ou `string` |

Regras: cada campo apontado precisa existir na saída; cada papel usa um campo diferente; a saída não pode ser vazia; o tipo de cada chave precisa ser um dos quatro. O front pode mandar `parametros de saida` como objeto ou como texto JSON (como hoje).

**A resposta real da fonte continua sendo uma lista com todas as filiais**; o objeto da saída descreve **um item**. Os tipos servem para validar o cadastro e não rejeitam a resposta (o ERP devolve números como texto, como `"1.234,50"`).

## 3. Erros (`400`)

Mesmo formato de antes: `{ "mensagem": "integracao invalida: ...", "erros": [{ "campo": "parametros de saida", "mensagem": "..." }] }`, com **todos** os erros de uma vez. Mensagens:

- `a saida precisa descrever ao menos um campo, ex.: { "codfil": "string", "vlrLiq": "number" }`
- `o campo "x" da saida tem tipo "texto"; use string, number, date ou boolean`
- `informe o "campo da filial" (o nome do campo da saida que traz o codigo da filial)`
- `informe o "campo do valor" ...` / `informe o "campo da meta" ...`
- `o "campo da filial" aponta para "x", que nao existe na saida`
- `o "campo do valor" ("codemp") e do tipo string; precisa ser number`
- `cada papel (filial, valor, meta, competencia) precisa de um campo diferente da saida`

## 4. Validação em tempo real (`POST /api/ped/integracao/validar`)

Mande `parametros de saida`, os campos de mapeamento e `finalidade` (`valor` para o dado externo, `meta` para o indicador). Resposta na saída por tipos:

```json
{ "saida": { "valido": true, "formato": "tipos",
  "campos": [{ "campo": "codemp", "tipo": "string" }, { "campo": "codfil", "tipo": "string" }, { "campo": "vlrLiq", "tipo": "number" }],
  "resumo": "3 campos: codemp (string), codfil (string), vlrLiq (number)",
  "mapeamento": { "campo da filial": "codfil", "campo do valor": "vlrLiq" } } }
```

Com erro: `{ "saida": { "valido": false, "erro": { "mensagem": "...", "linha": null, "coluna": null }, "erros": ["...", "..."] } }`. JSON mal formado volta com `linha` e `coluna`, como antes. No formato antigo (lista) a resposta é a de sempre, sem `formato`.

## 5. Listagem (só Admin)

Dado externo e indicador (fonte `integracao`) passam a trazer `mapeamento da saida`: `{ "campo da filial": "codfil", "campo do valor": "vlrLiq" }`, ou `null` quando a integração está no formato antigo. `parametros de saida` volta como objeto (formato novo) ou lista (antigo): **o front decide pela forma** (objeto = tipos, lista = antigo) para montar a modal de edição.

## 6. O que muda na modal

- Entra, abaixo da saída, **"Campo da filial"**, **"Campo do valor"** (dado externo) ou **"Campo da meta"** (indicador) e **"Campo da competência"** (opcional), idealmente listas de seleção alimentadas pelas chaves da saída digitada.
- Os botões de marcador (`%filial%`...) e `GET /api/ped/integracao/variaveis-saida` **não são mais necessários** no formato novo (a rota continua existindo para o formato antigo).
- "Inserir modelo": `{ "codfil": "string", "vlrLiq": "number" }`.
- Resumo local: `3 campos: codemp (string), codfil (string), vlrLiq (number)` (o back devolve o mesmo texto em `resumo`).
- Para editar uma integração salva em lista, mostrar o formato antigo ou pedir para reescrever no novo; ao salvar em lista, o back limpa o mapeamento.

## 7. O que continua igual

Entrada (valores e variáveis, inclusive `%empresas%`), URL, `tipo de servico`, identificador, regra de números ambíguos (`1.500` ainda falha a consulta), executor e agenda.
