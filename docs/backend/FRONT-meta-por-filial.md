# PED — meta por filial no cadastro do indicador: o que o front precisa implementar

Resposta à pergunta do front (API 25): o back agora **grava meta por filial no cadastro** do indicador, tanto no `POST /api/ped/indicadores-cadastro` quanto no `PUT /api/ped/indicadores-cadastro/{id}/meta` (Definir meta). O contrato é o que o front propôs, com os detalhes abaixo. Contrato completo em `docs/ped/API.md`, seção "Indicadores".

**O que não muda:** o cadastro com **uma meta para todas as filiais** continua igual (`"meta": 1500`). Quem só manda `meta` não precisa mudar nada.

---

## 1. Contrato

Dois campos. Envie **um ou o outro, nunca os dois juntos nem nenhum** (`400`):

| Campo | O que é |
|---|---|
| `meta` | Meta **única**, para todas as filiais. Maior que zero. |
| `metas por filial` | Lista `[{ "filial": "101", "meta": 1500 }, ...]`, com ao menos 1 item. A meta de cada filial listada. **As filiais que ficarem fora ficam sem meta (pendentes).** |

```json
{
  "nome": "Atingimento de cobertura",
  "sentido": "maior_melhor",
  "meta editavel": true,
  "dado externo": 12,
  "metas por filial": [
    { "filial": "101", "meta": 1500 },
    { "filial": "200", "meta": "2.000,50" }
  ]
}
```

- **Checkbox "mesma meta para todas as filiais" ativo:** mande só `meta`, como hoje.
- **Checkbox desmarcado, ou uma filial específica no cabeçalho:** mande `metas por filial`, só com as filiais preenchidas. A filial que não estiver na lista fica **sem meta (pendente)**.
- `filial` é o **código** da filial (o mesmo `filial` usado nas outras telas do PED). Texto (`"101"`) ou número (`101`). Precisa existir e **não pode repetir** na lista.
- Vale igual no **Definir meta** (`PUT .../{id}/meta`): `{ "sentido": "...", "meta editavel": true, "metas por filial": [...] }` **ou** com `meta`.

### Formato do número da meta (atenção)

Envie a meta como **número JSON** (`1500`, `1500.5`) ou **texto com vírgula decimal** (`"1.500,00"`, `"1500,5"`). O texto **`"1.500"`** (ponto e três dígitos, sem vírgula) é **recusado** com `400`, porque poderia significar 1,5 ou 1500 e o back não adivinha. Se a máscara do campo mostra `1.500`, converta para número antes de enviar (por exemplo, `Number(texto.replace(/\./g, '').replace(',', '.'))`).

### Erros (`400`)

Formato: `{ "mensagem": "<primeiro erro>", "erros": [{ "filial": "101", "mensagem": "..." }] }`. A lista `erros` traz **todos** os erros de uma vez; `filial` é `null` quando o erro não é de uma filial (por exemplo, "os dois campos juntos").


| Situação | Mensagem (trecho) |
|---|---|
| Nem `meta` nem `metas por filial` | "informe a meta (para todas as filiais) ou as metas por filial" |
| `meta` e `metas por filial` juntas | "envie a meta (para todas as filiais) ou as metas por filial, nunca as duas juntas" |
| Filial que não existe | "filial 99999 nao encontrada" |
| Mesma filial duas vezes | "a filial 101 aparece mais de uma vez em "metas por filial"" |
| Meta zero, negativa ou texto | "a meta da filial 101 deve ser um numero maior que zero" |
| Meta no formato `"1.500"` | "a meta da filial 101 ("1.500") e ambigua: envie como numero (1500) ou com virgula decimal" |
| Definir meta de novo | "a meta deste indicador ja foi definida e nao pode ser alterada" |

Se qualquer item falhar, **nada** é gravado. Não há erro `403` de filial nesta tela: Admin e Validador veem todas as filiais do PED.

---

## 2. Como ver a meta por filial

### Listagem (`GET /api/ped/indicadores-cadastro`)

Cada indicador ganhou:

| Campo | Conteúdo |
|---|---|
| `meta` | Meta única. **`null`** se o indicador tem metas por filial. |
| `metas por filial` | **Todas** as filiais, ordenadas por código: `[{ "filial": "101", "nome filial": "Filial 101", "meta": 1500 }, { "filial": "200", "nome filial": "...", "meta": null }]`, com `meta: null` nas **pendentes**. `null` quando a meta é única (ou o indicador ainda está sem meta). |
| `filiais sem meta` | Códigos das filiais pendentes, ex.: `["200", "305"]`. `[]` se nenhuma. |
| `meta por filial` | `true` se o indicador tem metas por filial. |
| `meta a definir` | `true` **só** quando não há meta única **nem** meta em nenhuma filial. |

`alertas` ganhou **`meta pendente por filial`**: quantidade de indicadores **ativos** com metas por filial e ao menos uma filial em `filiais sem meta`. Use para o sinal da aba Indicadores.

Para a coluna "Meta" da tabela, sugestão: se `meta por filial` for `false`, mostre `meta`; se for `true`, mostre "Por filial" com a lista (tooltip ou linha expansível) e destaque as filiais de `filiais sem meta`.

### Editar metas no preenchimento (`GET /api/ped/metas?filial=&mes_de_referencia=`)

Já era por filial e continua. O que mudou:
- `meta do cadastro` agora é a meta **da filial** (se houver) ou a geral, e vem o campo novo **`meta do cadastro origem`** (`"filial"` ou `"geral"`).
- **Só aparecem os indicadores que têm meta para a filial consultada.** Um indicador que só tem metas por filial não aparece para uma filial que ficou de fora.
- No `PUT /api/ped/metas`, ajustar um indicador numa filial sem meta cadastrada devolve `400` ("nao tem meta cadastrada para a filial ...").

---

### Definir as filiais pendentes (`PUT /api/ped/indicadores-cadastro/{id}/metas-filiais`)

Para a ação "Definir metas pendentes". Corpo igual ao do cadastro, só com as filiais que ainda **não** têm meta:

```json
{ "metas por filial": [ { "filial": "200", "meta": 980 }, { "filial": "305", "meta": "1.200,50" } ] }
```

- Resposta `200`: `{ "mensagem": "metas definidas", "filiais definidas": ["200", "305"], "filiais sem meta": [...as que continuam pendentes] }`. Atualize a linha com `filiais sem meta`.
- **Só filiais pendentes.** Filial que já tem meta devolve `400` (`erros[0].filial` é a filial) e **nada** é gravado. Para mudar o valor de um mês, use o ajuste de **Editar metas** (`PUT /api/ped/metas`).
- `400` também para: indicador de **meta única** (não existe filial pendente), indicador **ainda sem meta** (use o "Definir meta" normal), lista vazia, filial inexistente e meta inválida ou no formato ambíguo `"1.500"`. `404` se o indicador não existe. `403` para o Preenchedor.
- Oriente a modal a listar só as filiais de `filiais sem meta`.

### Filtro da listagem

`GET /api/ped/indicadores-cadastro?situacao=meta_filial_pendente` devolve só os indicadores **ativos** com ao menos uma filial em `filiais sem meta`. Use na opção "Meta pendente por filial" do filtro de situação.

---

## 3. Qual meta vale no cálculo (precedência)

Para uma filial e um mês, o back usa, nesta ordem:

1. **Ajuste do mês** feito no preenchimento (mês aberto, com motivo), se existir;
2. **Meta da filial** definida no cadastro;
3. **Meta geral** do cadastro.

Filial sem nenhuma das três fica **sem meta**: o dashboard mostra o realizado, sem atingimento (mostrar "sem meta", e não 0%).

---

## 4. Roteiro de teste

1. Cadastrar indicador só com `meta` (como antes): lista mostra `meta`, `metas por filial: null` e `filiais sem meta: []`.
2. Cadastrar só com `metas por filial` (duas filiais): `meta` vem `null`, `meta por filial` `true`, `meta a definir` `false`; `metas por filial` traz todas as filiais e `filiais sem meta` as demais; o alerta `meta pendente por filial` conta o indicador.
3. Enviar `meta` e `metas por filial` juntas: `400` ("nunca as duas juntas").
4. Enviar `"1.500"`, filial inexistente, filial repetida e meta zero: cada um devolve `400` com a mensagem acima.
5. Indicador criado automaticamente (aguardando meta): "Definir meta" só com `metas por filial` funciona uma vez; a segunda tentativa devolve `400`.
6. Em "Editar metas", numa filial sem meta própria nem geral, o indicador não aparece; numa filial com meta própria, `meta do cadastro origem` vem `filial`.
7. "Definir metas pendentes": enviar uma filial pendente grava e a tira de `filiais sem meta`; enviar uma filial que já tem meta devolve `400` sem gravar nada; ao completar todas as filiais, o indicador sai do filtro e o alerta `meta pendente por filial` diminui.
