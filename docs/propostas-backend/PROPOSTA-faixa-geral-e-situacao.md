# PED — faixa geral, inativação de faixas e alertas no dashboard: proposta de contrato para o back-end

Proposta do front-end, 12/11/2026.

Base: `API (27).md`, seção "Cadastro e Preenchimento — fase 5: faixas". Nenhum campo existente é renomeado ou removido. O front já é implementado seguindo este contrato e tolera a resposta atual (sem os campos novos) enquanto ele não estiver no servidor.

---

## 1. O que muda para o usuário

1. **Faixa geral.** Além da tabela de faixas por filial, o dashboard pode ter uma **faixa geral**, que vale para **todas as filiais**.
2. **Geral OU por filial.** Num dashboard, ou vale a faixa geral, ou valem as faixas por filial:
   - com uma faixa geral **ativa**, nenhuma faixa de filial pode estar ativa no mesmo dashboard, e vice-versa;
   - por filial, no máximo **uma faixa ativa** por dashboard e filial.
3. **Inativar em vez de excluir.** Enquanto a faixa estiver vinculada a um dashboard (o dashboard existe), ela **não pode ser excluída**, só **inativada**. A faixa inativada pode ser **reativada**, desde que não deixe duas faixas ativas no dashboard.
4. **Motivo obrigatório** para inativar, reativar e excluir (alterar as faixas já exigia).
5. **Alertas no dashboard** para faixas em conflito, para dashboard sem faixa ativa e para a tentativa bloqueada (seção 6).
6. **"Ver motivo"** na listagem das faixas mostra o motivo, o autor e a data da última alteração. Isso usa a rota de histórico que já existe e não pede nada novo ao back-end (seção 7).

---

## 2. Tabela de faixas: campos novos

Em `GET /api/ped/faixas`, `GET /api/ped/faixas/{id}` e nas respostas de `POST`/`PUT`:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `geral` | booleano | `true` = faixa geral (todas as filiais). |
| `filial` | texto ou `null` | `null` na faixa geral (hoje é obrigatório). |
| `nome filial` | texto ou `null` | `null` na faixa geral. |
| `situacao` | `"ativa"` ou `"inativa"` | Tabela existente sem o campo = `ativa`. |
| `motivo da situacao` | texto ou `null` | Motivo da última inativação/reativação. `null` se nunca mudou. |
| `data da situacao` | data ou `null` | Quando a situação mudou pela última vez. |
| `usuario da situacao` | texto ou `null` | Quem mudou. |

Exemplo de faixa geral inativada:

```json
{
  "id": 7, "id dashboard": 3, "dashboard": "PED Gerentes", "dashboard excluido": false,
  "geral": true, "filial": null, "nome filial": null,
  "situacao": "inativa", "motivo da situacao": "passou a valer faixa por filial",
  "data da situacao": "2026-11-12T14:05:00.000000Z", "usuario da situacao": "admin",
  "descricao": null, "versao vigente": 2, "data da versao": "2026-11-01T10:00:00.000000Z",
  "autor da versao": "admin", "quantidade de faixas": 3, "faixas": [ ... ]
}
```

**Listagem.** Novo filtro `situacao` = `ativas` (padrão do front), `inativas` ou `todas`. O filtro `filial` (Admin e Validador) também traz a faixa geral do dashboard, porque ela vale para a filial pedida.

---

## 3. Cadastro: `POST /api/ped/faixas`

Faixa geral: `"filial": "todas"` (ou `"geral": true` sem `filial`). Faixa por filial: como hoje.

```json
{ "dashboard": 3, "filial": "todas", "descricao": "opcional", "faixas": [ { "de": 0, "ate": 1000, "aliquota": 0 } ] }
```

Nasce `ativa`, versão 1. `400` (com `mensagem` e `conflitos`, ver seção 5) quando:

- já existe uma faixa geral ativa no dashboard;
- é uma faixa geral e o dashboard tem alguma faixa de filial ativa;
- é uma faixa de filial e o dashboard tem uma faixa geral ativa, ou essa filial já tem uma faixa ativa.

Faixas **inativas** não contam: é possível cadastrar uma nova faixa no lugar de uma inativada.

**Acesso (definido pelo negócio em 12/11/2026):** **Admin e Validador** cadastram, alteram, inativam, reativam e excluem a faixa geral, com as mesmas regras. O Validador tem acesso a **todas as filiais**. Por isso, a restrição atual das faixas ("o Validador trabalha sempre na própria filial; o parâmetro `filial` dele é ignorado; outra filial dá `403`", P-04) deve ser retirada: o Validador passa a ter, nas faixas, o mesmo escopo do Admin. O Preenchedor continua sem acesso (`403`).

---

## 4. Inativar e reativar: `PUT /api/ped/faixas/{id}/situacao` (rota nova)

```json
{ "ativa": false, "motivo": "passou a valer faixa por filial" }
```

- `motivo` obrigatório (texto não vazio), nos dois sentidos.
- Reativar (`"ativa": true`) segue as regras de conflito da seção 3. Se houver conflito, responde `400` com `conflitos`.
- Inativar a última faixa válida de um dashboard **é permitido**: o dashboard passa a mostrar o alerta "sem faixa ativa" (seção 6).
- Resposta: a tabela atualizada (ou só `mensagem`; o front recarrega a lista).
- A mudança entra no histórico (seção 7). Ela **não** gera versão nova das faixas.
- "Alterar faixas" (`PUT /api/ped/faixas/{id}`) numa faixa inativa: `400` "reative a faixa antes de alterar".

---

## 5. Exclusão: `DELETE /api/ped/faixas/{id}`

- Regra atual mantida: enquanto o dashboard existir, `400` ("a faixa está vinculada ao dashboard X; inative-a").
- **Novo:** corpo `{ "motivo": "..." }` obrigatório. Sem motivo, `400`.

Formato do `400` de conflito (cadastro e reativação):

```json
{
  "mensagem": "o dashboard PED Gerentes já tem faixa geral ativa; inative-a antes de ativar uma faixa por filial",
  "conflitos": [ { "id": 7, "geral": true, "filial": null, "nome filial": null } ]
}
```

O front mostra a `mensagem` (e a lista de `conflitos`, se vier) e não interpreta o texto.

---

## 6. Alertas de faixas no dashboard

Em `GET /api/ped/dashboards` e `GET /api/ped/dashboards/{id}`, campo novo **`alertas de faixas`** (lista, vazia quando não houver alerta):

```json
"alertas de faixas": [
  { "tipo": "conflito", "mensagem": "faixa geral e faixa da filial 101 ativas ao mesmo tempo", "filial": "101" },
  { "tipo": "sem_faixa", "mensagem": "filial 104 sem faixa ativa", "filial": "104" },
  { "tipo": "sem_faixa", "mensagem": "dashboard sem faixa ativa", "filial": null }
]
```

| `tipo` | Quando |
| --- | --- |
| `conflito` | Mais de uma faixa ativa onde só pode haver uma. A gravação já bloqueia, mas pode acontecer com dados antigos. |
| `sem_faixa` | Dashboard sem faixa geral ativa e com unidade vinculada sem faixa de filial ativa (`filial` preenchida). Se não houver nenhuma faixa ativa, um único item com `filial: null`. |

Filtro novo em `GET /api/ped/dashboards`: `situacao=problemas_faixa`. Opcionalmente, o `problemas` atual pode passar a incluir os dashboards com `alertas de faixas`.

A "tentativa bloqueada" é o próprio `400` de conflito (seção 5). O front mostra a mensagem no formulário e na ação de reativar, citando o dashboard.

---

## 7. Histórico: `GET /api/ped/faixas/{id}/historico`

Campo novo opcional em cada linha: **`acao`** = `cadastro`, `alteracao`, `inativacao` ou `reativacao`. Linha sem `acao` = alteração de faixas, como hoje.

- As linhas de inativação e reativação trazem o `motivo`, a `data` e o `usuario`, com a `versao` vigente no momento. Não criam versão nova e não têm "faixas da versão" próprias.
- O botão **"Ver motivo"** da listagem usa a primeira linha do histórico (a mais recente): motivo, autor, data e ação. Na faixa inativa, mostra também `motivo da situacao`.

---

## 8. Cálculo e encerramento (P-10)

Para cada unidade de imagem, a faixa usada é a **faixa geral ativa** do dashboard, se houver. Se não houver, é a **faixa ativa da filial**. Faixas inativas não entram no cálculo. Em "unidades sem tabela de faixas" do fechamento, contam as unidades sem nenhuma das duas.

---

## 9. Dúvidas para o back-end

1. Retirar a restrição de filial do Validador nas faixas (seção 3) tem impacto em outras rotas que usam a mesma regra (P-04)?
2. `filial: "todas"` ou `geral: true` no cadastro: o front envia **`"filial": "todas"`**. Se preferirem só `geral`, avisem.
3. A exclusão com corpo no `DELETE` funciona no servidor? Se não, a alternativa é `?motivo=` na query.
