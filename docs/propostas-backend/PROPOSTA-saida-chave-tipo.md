# PED — parâmetros de saída como "chave: tipo": proposta para o back-end

Proposta do front-end, 11/11/2026. Ainda não implementada. Vale para as duas modais de integração (dado externo e indicador).

## 1. O pedido

Hoje a TI preenche **Parâmetros de saída** com um **exemplo de valores** da resposta, numa lista com todas as filiais:

```json
[ { "codemp": "1", "codfil": "100", "vlrLiq": "0", "volLiq": "0", "metVlr": "0", "metVol": "0" } ]
```

Decisão do usuário: a saída deve **descrever a estrutura** da resposta, com o **tipo** de cada campo em vez de um valor de exemplo:

```json
{
  "codemp": "string",
  "codfil": "string",
  "vlrLiq": "number",
  "data": "date"
}
```

- **Só a saída muda.** A entrada continua com valores e variáveis (`%dataInicial%`, `%empresas%`), porque é o que vai na chamada.
- **Continua sendo JSON:** o tipo vai **entre aspas**.
- **Tipos aceitos (proposta):** `string`, `number`, `date` e `boolean`. Se precisarem de outros, como `datetime` ou `integer`, avisem.
- **A saída passa a ser um objeto:** ele descreve **um item** da resposta. A resposta real continua sendo uma lista com todas as filiais; o objeto da saída só declara os campos de cada item.

## 2. O ponto a decidir: como o back-end sabe qual campo é a filial e qual é o valor ou a meta

Hoje isso é resolvido pelo nome literal (`filial`, `valor`, `meta`) ou por um marcador no valor (`"%filial%"`, `"%valor%"`, `"%meta%"`). Com tipos no lugar dos valores, os marcadores deixam de ter onde ficar. Opções:

### Opção A — Só "chave: tipo"; o back-end referencia pelo nome da chave

A saída tem só `{ "campo": "tipo" }`, e o back-end identifica os campos **pelo nome da chave**.

```json
{ "codemp": "string", "codfil": "string", "vlrLiq": "number", "metVlr": "number" }
```

- **Front:** valida só o formato (objeto não vazio, cada valor um dos tipos aceitos). A modal fica mais simples, sem marcadores nem campos extras.
- **Back-end:** decide como mapear o nome da chave para filial e valor/meta. Por exemplo:
  - uma convenção de nomes (`codfil` → filial, `vlrLiq`/`metVlr` → valor/meta);
  - um mapa por fonte no próprio back-end;
  - exigir os nomes literais `filial` e `valor`/`meta` na chave.
- **Precisamos saber qual regra vale.** Assim a modal pode orientar a TI, por exemplo com a frase "use as chaves X e Y" ou com um modelo de exemplo.

### Opção B — "chave: tipo" + dois campos de mapeamento na modal

A saída declara os tipos, e a modal ganha dois campos: **"Campo da filial"** e **"Campo do valor"** (ou **"Campo da meta"** no indicador), cada um com o nome de uma chave da saída.

```json
{
  "parametros de saida": { "codemp": "string", "codfil": "string", "vlrLiq": "number" },
  "campo da filial": "codfil",
  "campo do valor": "vlrLiq"
}
```

- **Front:** valida que os dois campos apontam para chaves que existem na saída e que o tipo combina (o valor ou a meta precisa ser `number`).
- **Back-end:** dois campos novos no corpo de `concluir` e `integracao`, e na listagem do Admin. É a opção mais explícita: não depende de convenção de nomes.

### Opção C — Tipo e marcador no mesmo texto

O papel do campo vai junto do tipo:

```json
{ "codemp": "string", "codfil": "string %filial%", "vlrLiq": "number %valor%" }
```

- **Front:** valida o tipo e o marcador e mantém os botões de marcador ("Marcadores da saída").
- **Back-end:** precisa interpretar o texto "tipo + marcador". É compacto, mas mistura duas informações no mesmo valor.

## 3. Impactos comuns às três opções

- **Validação no back-end** (`concluir`, `integracao`, `POST /api/ped/integracao/validar`):
  - a saída passa a ser **objeto** de `chave: tipo`;
  - um tipo desconhecido gera `400` apontando `parametros de saida`, com a chave na mensagem;
  - o formato atual (lista com valores ou marcadores) deixa de ser aceito, ou é aceito por um período de transição. Avisem qual.
- **Integrações já salvas** com a saída em lista: elas precisam ser convertidas pelo back-end, ou a TI regrava cada uma. Avisem qual.
- **`GET /api/ped/integracao/variaveis-saida`:** deixa de ser necessário nas opções A e B.
- **Executor:** continua lendo a resposta real (lista com todas as filiais) e usa a saída só para saber os nomes e os tipos dos campos. Com `number`, a regra dos números ambíguos (`1.500`) continua valendo.
- **"Inserir modelo"** da saída passa a gerar o exemplo no formato escolhido.
- **Validação local na modal:** objeto não vazio e tipo válido em cada campo. Sai o "JSON válido com N campos" com os valores de exemplo, e entra o resumo `3 campos: codemp (string), codfil (string), vlrLiq (number)`.

## 4. O que precisamos de volta

1. Qual opção vale (A, B ou C)? Na A, qual é a regra para identificar filial e valor/meta pelo nome da chave?
2. A lista de tipos aceitos.
3. O formato atual deixa de ser aceito na hora, ou há um período de transição? E o que acontece com as integrações já salvas?

Até a resposta, o front continua no contrato atual (saída em lista, com nomes literais ou marcadores), que é o que o back-end aceita hoje.
