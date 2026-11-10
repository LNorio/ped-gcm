# PED — integração do dado externo: o que o front precisa implementar

Mudança de requisito de 09/11/2026 (documento do Leonardo Norio). Ao **concluir a construção** de um dado externo, a TI passa a registrar a integração completa (identificador, URL, parâmetros de saída e de entrada), e os mesmos campos podem ser editados depois pelo botão **Configurações**. O back guarda e **valida** tudo; o front monta a modal e mostra o feedback.

Vale só para a aba **Dados Externos** e só para o perfil **Admin**. Validador e Preenchedor não veem botões, modal nem os campos novos (o back nem devolve esses campos para eles).

> **Quebra de contrato:** `PUT /api/ped/dados-externos-cadastro/{id}/concluir` com só `{ "identificador": "..." }` agora devolve `400`. É preciso mandar os 4 campos.

---

## 1. Endpoints

Todos exigem o token (`Authorization: Bearer ...`) e **perfil Admin** (outro perfil recebe `403`).

| Método e rota | Para quê |
|---|---|
| `PUT /api/ped/dados-externos-cadastro/{id}/concluir` | Botão **Concluir construção** (dado `em_construcao`): grava a integração, ativa o dado e cria o indicador. |
| `PUT /api/ped/dados-externos-cadastro/{id}/integracao` | Botão **Configurações** (dado `ativo` ou `inativo`): só atualiza a integração. Em dado `em_construcao` devolve `400`. |
| `POST /api/ped/integracao/validar` | Validação em tempo real, **sem gravar**. |
| `GET /api/ped/integracao/variaveis` | Lista de variáveis para os botões abaixo do campo de entrada. |
| `GET /api/ped/dados-externos-cadastro/integracoes-pendentes` | Dados ativos/inativos sem integração (alerta para a TI). |
| `GET /api/ped/dados-externos-cadastro` | Listagem. Para o Admin, cada item traz os campos novos (seção 4). |

### Corpo de `concluir` e de `integracao`

Os quatro são obrigatórios. Os dois `parametros de ...` aceitam **texto JSON** (o que está na caixa de texto) ou **objeto** já decodificado.

```json
{
  "identificador": "VOLUME_MANN",
  "url": "https://ti.exemplo.com.br/api/consulta",
  "parametros de saida": "{ \"valor\": \"0\", \"referencia\": \"x\" }",
  "parametros de entrada": "{ \"filial\": \"%filial%\", \"inicio\": \"%dataInicial% - 3m\" }"
}
```

- `identificador`: letras sem acento, números, `_`, `-` e `.` (sem espaços), até 60. É gravado em **maiúsculas**.
- `url`: começa com `http://` ou `https://`, sem espaços, até 500 caracteres.
- Os dois JSONs precisam ser objeto `{ }` ou lista `[ ]` válidos.
- Resposta `200` de `concluir`: `{ "mensagem", "indicador criado": { id, nome, situacao } | null }`. De `integracao`: `{ "mensagem": "integracao atualizada", "variaveis usadas": [...] }`.
- Ordem das checagens do `concluir`: dado existe (`404`) → está em construção (`400`) → campos válidos (`400`).

### Resposta de erro (`400`)

```json
{
  "mensagem": "integracao invalida: URL ...",
  "erros": [
    { "campo": "url", "mensagem": "a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)" },
    { "campo": "parametros de saida", "mensagem": "virgula sobrando antes de '}'", "linha": 3, "coluna": 1 },
    { "campo": "parametros de entrada", "caminho": "inicio", "expressao": "5 / 0", "mensagem": "divisao por zero" }
  ]
}
```

`campo` é qual campo da modal errou; `linha`/`coluna` só vêm em erro de JSON; `caminho` e `expressao` só vêm em erro de conta na entrada (`caminho` é o ponto do JSON, como `filtro.inicio` ou `lista[0]`). As mensagens já estão em português: **mostre como vierem**.

---

## 2. Validação em tempo real: `POST /api/ped/integracao/validar`

Chame enquanto a TI digita (sugestão: espera de ~400 ms após parar de digitar). Envie só o que quer validar; **campo vazio ou ausente volta `null`** (não mostre nada enquanto estiver vazio, como pede o documento).

```json
{ "parametros de saida": "...", "parametros de entrada": "..." }
```

Resposta `200`:

```json
{
  "saida": {
    "valido": true,
    "campos": [ { "campo": "valor", "tipo": "texto" }, { "campo": "referencia", "tipo": "texto" } ]
  },
  "entrada": {
    "valido": true,
    "variaveis usadas": ["dataFinal", "dataInicial", "filial"],
    "calculos": [ { "campo": "inicio", "expressao": "%dataInicial% - 3m", "resultado": "01/07/2026" } ],
    "previa": { "filial": "100", "inicio": "01/07/2026" }
  }
}
```

| Situação | O que vem | Como mostrar |
|---|---|---|
| Saída válida | `saida.valido = true` + `campos` (tipos: `texto`, `numero`, `booleano`, `lista`, `objeto`, `nulo`) | Faixa verde "JSON válido", "N campos: valor (texto), ..." |
| Saída inválida | `saida.valido = false` + `saida.erro { mensagem, linha, coluna }` | Mensagem vermelha "JSON de saída inválido" com linha, coluna e explicação |
| Entrada válida | `entrada.valido = true` + `variaveis usadas`, `calculos`, `previa` | Faixa verde com variáveis, cálculos e a prévia do JSON resolvido |
| Entrada inválida | `entrada.valido = false` + `entrada.erros[]` (`campo`, `expressao`, `mensagem`; ou `mensagem`/`linha`/`coluna` se o JSON estiver mal formado) | Lista vermelha com **todos** os erros |

A prévia usa valores de exemplo: filial 100, período 10/2026, 3 meses retroativos, e `%hoje%` é a data de hoje. Em **saída**, uma lista de objetos (`[ { ... } ]`) mostra os campos do primeiro item.

O botão de salvar fica **bloqueado** enquanto algum campo estiver vazio ou inválido; ao lado dele mostre o que falta ("falta: URL válida, JSON de saída válido") ou "Todos os campos obrigatórios preenchidos". A URL o front valida sozinho (começa com `http://`/`https://`, sem espaços); o back valida de novo ao salvar.

---

## 3. Variáveis: `GET /api/ped/integracao/variaveis`

```json
[
  { "variavel": "%filial%", "nome": "filial", "tipo": "numero", "descricao": "Codigo da filial", "exemplo": "100" },
  ...
]
```

Hoje são 11: `%filial%`, `%colaborador%`, `%zona%`, `%mes%`, `%ano%`, `%competencia%`, `%dataInicial%`, `%dataFinal%`, `%hoje%`, `%diaColeta%`, `%mesesRetro%`. Use a lista **da API** (não fixe no front). Clicar em uma insere `variavel` no ponto do cursor; destaque as que estão em `variaveis usadas`. Os botões de operador (`+ - * / ^ ( )`) são só inserção de texto.

### Regras das expressões (o back é quem resolve; isto é só para a ajuda na tela)

- Valem em **valores de texto** do JSON de entrada, em qualquer nível. Chaves e valores que não são texto (números, `true`) ficam como estão.
- Operadores `+ - * / ^`, parênteses e sinal negativo. Ordem: parênteses, potência, `*` e `/`, depois `+` e `-`. Números aceitam vírgula ou ponto.
- Datas: `data ± número` soma ou subtrai **dias**; com sufixo `m` são **meses** e `a` são **anos** (`%dataFinal% + 1m`); `data − data` dá a quantidade de dias. Dia que não existe no mês vale o último dia (`31/01/2026 + 1m` = `28/02/2026`).
- **Não viram conta:** um valor sozinho (número, data ou variável), `mm/aaaa`, `aaaa-mm-dd` e textos com letras (`"Filial-%filial%"`, que só recebe a troca das variáveis).
- **Cuidado:** `%mes%/%ano%` é uma **divisão**. Para MM/AAAA use `%competencia%`.
- Resultado numérico sai com vírgula (`252,5`); data como `dd/mm/aaaa`.

| Expressão (período 10/2026, 3 meses retroativos) | Resultado |
|---|---|
| `(%mesesRetro% * 30) - 1` | `89` |
| `%ano% - 1` | `2025` |
| `1000 / 4 + 2,5` | `252,5` |
| `%dataInicial% - 30` | `01/09/2026` |
| `%dataFinal% + 1m` | `30/11/2026` |
| `%dataFinal% - %dataInicial% + 1` | `31` |
| `31/01/2026 + 1m` | `28/02/2026` |

Erros que o back aponta (cada um com campo e expressão): JSON mal formado, variável desconhecida, variável de texto em conta, parêntese não fechado ou sobrando, operador repetido ou fora de lugar, expressão incompleta, divisão por zero, soma de duas datas, data multiplicada/dividida/elevada, data subtraída de número, unidade `m`/`a` sem data, data inexistente.

---

## 4. Listagem (`GET /api/ped/dados-externos-cadastro`)

Só para o **Admin**, cada item ganha:

| Campo | Conteúdo |
|---|---|
| `url` | URL da consulta (`null` se ainda não tem) |
| `parametros de saida` | objeto JSON salvo (`null` se não tem) |
| `parametros de entrada` | objeto JSON salvo (`null` se não tem) |
| `variaveis usadas` | lista de nomes, ex.: `["dataFinal", "filial"]` |
| `integracao pendente` | `true` se o dado está `ativo`/`inativo` e **sem integração** |
| `integracao alterada em` / `integracao alterada por` | quando e quem salvou |

- **URL abaixo do identificador** na linha, como pede o documento.
- Para a modal de **Configurações**, preencha os campos com `parametros de saida`/`parametros de entrada` (objetos): mostre-os formatados (`JSON.stringify(obj, null, 2)`).
- Filtro de situação: acrescente a opção **"Integração pendente (TI)"**, que envia `?situacao=integracao_pendente`. A busca (`?busca=`) também encontra pela URL.

### Alerta de integração pendente

Dados que já existiam antes desta mudança (por exemplo, os dados do ERP cadastrados à mão) aparecem como **pendentes** até a TI salvar a integração:

- ponto laranja na aba Dados Externos e aviso no topo da lista, com a quantidade e o botão "Ver pendentes": use `GET .../integracoes-pendentes` → `{ "quantidade": 11, "dados": [ { id, nome, identificador, situacao } ] }`;
- etiqueta "Integração pendente (TI)" na linha (`integracao pendente = true`);
- o botão Configurações aparece como **"Preencher integração"** nesses dados;
- o alerta some quando a integração é salva.

---

## 5. Roteiro de teste

1. Admin: dado `em_construcao` mostra **Concluir construção**; dado ativo/inativo mostra **Configurações** (ou "Preencher integração" se pendente). Validador e Preenchedor não veem nenhum dos dois.
2. Saída `{"a": 1,}` → erro "virgula sobrando antes de '}'" com linha e coluna.
3. Entrada `{"x": "%foo%"}` → "variavel desconhecida: %foo%".
4. Entrada `{"x": "(%mesesRetro% * 30) - 1"}` → prévia `89`. Entrada `{"x": "31/01/2026 + 1m"}` → `28/02/2026`.
5. URL `ti.exemplo.com.br` (sem `http://`) → não salva.
6. Concluir ativa o dado e cria o indicador; **Configurações** não cria outro indicador e não muda a situação.
7. Depois de salvar a integração de um dado pendente, o alerta some e a contagem diminui.

Contrato completo em `docs/ped/API.md`, seção "Integração do dado externo".
