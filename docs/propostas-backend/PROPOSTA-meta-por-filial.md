# PED — meta do indicador por filial: proposta de contrato para o back-end

Proposta do front-end, 10/11/2026.

> **Situação em 10/11/2026 (tarde):** o back-end implementou a **meta por filial** e a rota **`metas-filiais`** (seções 1 a 4), conforme `docs/backend/FRONT-meta-por-filial.md` e `API (26).md`. Diferenças em relação a esta proposta:
>
> - erros por item em `erros: [{ filial, mensagem }]`;
> - campo `meta por filial` (booleano) na listagem;
> - filtro `situacao=meta_filial_pendente`;
> - resposta de `metas-filiais` com `filiais definidas`.
>
> A **meta via API** continua só como proposta e está em [PROPOSTA-meta-via-api.md](PROPOSTA-meta-via-api.md).

Base: `API (25).md`, seção "Cadastro e Preenchimento — fase 4: indicadores e metas".

---

## 1. O que muda para o usuário

Na aba **Indicadores** (Admin e Validador), a meta do indicador passa a poder ser **diferente por filial**. Vale no **cadastro do indicador** e na modal **Definir meta**, usada pelo indicador criado automaticamente a partir de um dado externo.

| Filial no cabeçalho | O que a tela mostra | O que o front envia |
| --- | --- | --- |
| **Todas as filiais**, com "Replicar a meta para todas as filiais" marcado (padrão) | Um campo **Meta** | `"meta"`, como hoje |
| **Todas as filiais**, com o checkbox desmarcado | Lista de todas as filiais, cada uma com o seu campo de meta. Filiais em branco são permitidas. | `"metas por filial"` só com as filiais preenchidas |
| **Uma filial específica** | Um campo de meta, sem checkbox | `"metas por filial"` só com essa filial |

As filiais que ficarem sem meta são sinalizadas na listagem e no alerta da aba (seção 4).

---

## 2. Cadastro: `POST /api/ped/indicadores-cadastro`

Envie **`meta`** ou **`metas por filial`**, nunca os dois.

**Meta replicada** (inalterado):

```json
{ "nome": "Atingimento de cobertura", "meta": "1.500,50", "sentido": "maior_melhor", "meta editavel": true, "apontamentos": [5, 7] }
```

**Meta por filial** (novo):

```json
{
  "nome": "Atingimento de cobertura",
  "metas por filial": [
    { "filial": "101", "meta": 1500.5 },
    { "filial": "200", "meta": 980 }
  ],
  "sentido": "maior_melhor",
  "meta editavel": true,
  "apontamentos": [5, 7]
}
```

Regras propostas:

- `meta`: igual a hoje. Vale para todas as filiais; nenhuma fica pendente.
- `metas por filial`:
  - lista com ao menos 1 item;
  - `filial` é o código da filial;
  - `meta` é um número maior que zero. O front envia número, como no `PUT .../meta` atual, e não texto com vírgula.
- `filiais sem meta` (seção 4) é a fonte da pendência para o front. Se não vier, o front a deriva dos itens com `meta: null`.
- Filial repetida, filial inexistente ou meta inválida → `400`. Nos erros por item, sugerimos o formato `{ "mensagem", "erros": [{ "filial", "mensagem" }] }`.
- Filial fora das que o usuário pode ver → `403` `"voce nao tem acesso a esta filial"`, como no restante da API.
- Os dois campos juntos, ou nenhum dos dois → `400`.
- As filiais que não vierem na lista ficam **sem meta (pendentes)**.

## 3. Definir meta do indicador automático: `PUT /api/ped/indicadores-cadastro/{id}/meta`

Mesma regra do cadastro: `meta` **ou** `metas por filial`, mais `sentido` e `meta editavel`.

```json
{ "metas por filial": [{ "filial": "101", "meta": 2500 }], "sentido": "maior_melhor", "meta editavel": true }
```

---

## 4. Listagem: `GET /api/ped/indicadores-cadastro`

Campos novos em cada indicador:

| Campo | Conteúdo |
| --- | --- |
| `metas por filial` | `[{ "filial": "101", "nome filial": "Matriz", "meta": 1500.5 }, { "filial": "200", "nome filial": "...", "meta": null }]`, com **todas** as filiais e `meta: null` nas pendentes. Quando a meta é única (replicada), pode vir `null`. |
| `filiais sem meta` | Códigos das filiais pendentes, ex.: `["200", "305"]`. Vem `[]` quando nenhuma está pendente. |

- `meta` continua existindo. Com meta por filial, sugerimos `null` e que o front leia `metas por filial`.
- `meta a definir` continua `true` só quando **nenhuma** filial tem meta.

Em `alertas`, um contador novo para o sinal da aba Indicadores:

```json
"alertas": { "aguardando meta": 1, "com componente desativado": 0, "meta pendente por filial": 3 }
```

`meta pendente por filial` = quantidade de indicadores **ativos** com ao menos uma filial em `filiais sem meta`.

**Compatibilidade:** se esses campos não vierem, o front trata como "sem meta por filial" e "sem pendência". Por isso a API atual continua funcionando.

### Preencher as filiais pendentes: `PUT /api/ped/indicadores-cadastro/{id}/metas-filiais` (novo)

Ação **"Definir metas pendentes"** no menu do indicador (Admin e Validador, como o Definir meta). Ela aparece em indicadores **ativos** com `filiais sem meta` não vazio. Sem esta rota, a pendência não tem como ser resolvida pela tela, porque hoje `PUT .../meta` só aceita uma definição e o indicador não tem edição.

```json
{ "metas por filial": [{ "filial": "200", "meta": 980 }, { "filial": "305", "meta": 1200 }] }
```

- Aceita **só filiais que ainda estão sem meta**. Filial que já tem meta → `400`; para alterar, vale o ajuste mensal de `PUT /api/ped/metas`.
- Lista com ao menos 1 item. As filiais que não vierem continuam pendentes.
- Mesmas regras de valor, `403` de filial fora do acesso e formato de erro do cadastro.
- Não vale para indicador com meta via API (`origem da meta = terceiro`) → `400`.
- Resposta `200`: `{ "mensagem": "metas definidas", "filiais sem meta": [...] }`. O front recarrega a lista de qualquer forma.

Na tela: com **Todas as filiais**, a modal lista só as filiais pendentes, cada uma com o seu campo. Com **uma filial específica**, a ação só aparece se essa filial estiver pendente, e a modal mostra um campo só para ela.

---

## 5. Meta buscada via API

Esta parte foi movida para um documento próprio: [PROPOSTA-meta-via-api.md](PROPOSTA-meta-via-api.md).

---

## 6. Pontos a decidir com o back-end

1. **Preencher as filiais pendentes depois.** Decidido (10/11/2026): rota `PUT .../metas-filiais` e ação "Definir metas pendentes" no front (seção 4).
2. **Meta vigente (RN-07).** Para a filial com meta própria, a meta do cadastro passa a ser a dela. O ajuste mensal de `PUT /api/ped/metas` continua valendo por cima.
3. **Filial sem meta no cálculo e nos dashboards.** Hoje "indicador sem meta não entra em dashboard". Com meta por filial:
   - o indicador entra num dashboard se **alguma** filial tiver meta?
   - a filial pendente fica sem atingimento (pendência na prévia ou no fechamento, como "sem meta")?
4. **Filial nova cadastrada depois.** Ela nasce pendente nos indicadores com meta por filial, e com a meta replicada nos de meta única?
5. **Filtro.** Vale incluir `situacao=meta_filial_pendente` na listagem?
6. **Histórico.** A definição das metas por filial deve gerar linhas em `metas-historico` (de `null` para o valor, por filial)?
