# PED: faixa geral, situação (ativa/inativa), alertas e motivo na exclusão

Guia para o front. Responde à proposta de 12/11/2026 (`PROPOSTA-faixa-geral-e-situacao`). Contrato completo em `API.md`, seção "fase 5: faixas".

**Ordem de publicação: back e front juntos.** O `DELETE /api/ped/faixas/{id}` passa a exigir `motivo`; o front antigo, que não envia, receberia `400`. A migration do back só acrescenta colunas/tabela (as faixas existentes ficam `ativa`).

## O que mudou

1. Faixa **geral** (vale para todas as filiais do dashboard): `filial` nula.
2. Cada faixa tem **situação** `ativa`/`inativa`. Só ativa vale no cálculo.
3. Regra por dashboard (só entre ativas): ou uma geral, ou faixas por filial; por filial, uma só. O back **nunca resolve conflito sozinho**: responde `400` com `conflitos`.
4. Rota nova `PUT /api/ped/faixas/{id}/situacao`.
5. `DELETE` com `motivo` obrigatório.
6. Histórico em lista única, com `acao`.
7. Dashboards trazem `alertas de faixas` e aceitam `situacao=problemas_faixa`.
8. Cálculo e encerramento: vale a geral ativa; sem ela, a ativa da filial.

## Faixa (GET lista, GET por id)

Campos novos: `geral`, `situacao`, `motivo da situacao`, `data da situacao`, `usuario da situacao`. `filial` e `nome filial` vêm `null` na faixa geral.

```json
{
  "id": 7, "id dashboard": 3, "dashboard": "PED Gerentes", "dashboard excluido": false,
  "geral": true, "filial": null, "nome filial": null,
  "situacao": "inativa", "motivo da situacao": "passou a valer faixa por filial",
  "data da situacao": "2026-11-12 14:05:00-04:00", "usuario da situacao": "admin",
  "descricao": null, "versao vigente": 2, "quantidade de faixas": 3, "faixas": [ ... ]
}
```

- Data no formato do resto da API (`2026-11-12 14:05:00-04:00`), não ISO com `Z`.
- Os três campos `... da situacao` vêm `null` até a primeira inativação/reativação.
- **Filtro `situacao` = `ativas|inativas|todas`; o padrão do back é `todas`** (não mudar o que já funciona). Para listar só as ativas, o front envia `situacao=ativas`. Valor inválido: `400`.
- Com `filial=101` a lista traz a faixa da 101 **e as gerais**. Gerais vêm primeiro.
- Faixas de dashboard já excluído continuam com `situacao: "ativa"` (a situação não muda ao excluir o dashboard); com `situacao=ativas` elas aparecem, e é ali que se exclui.

## Cadastrar: `POST /api/ped/faixas`

Geral: `"filial": "todas"` **ou** `"geral": true` sem `filial`.

```json
{ "dashboard": 3, "filial": "todas", "descricao": "opcional", "motivo": "opcional", "faixas": [ { "de": 0, "ate": 1000, "aliquota": 0 } ] }
```

`201`: `{ "mensagem": "tabela de faixas cadastrada", "id": 12, "versao": 1, "geral": true }`. Não devolve a tabela; recarregar a lista.

Mudança de comportamento: `"filial": "todas"` dava `400` e agora **cadastra a geral**. Filial de código inexistente: `400` ("filial nao encontrada"). Filial + `geral: true`: `400`.

## Conflito (`400`, no cadastro e na reativação)

```json
{
  "mensagem": "o dashboard tem uma tabela de faixas geral ativa; inative-a antes de usar tabelas por filial",
  "conflitos": [ { "id": 7, "geral": true, "filial": null, "nome filial": null } ]
}
```

Mostrar `mensagem` e, se vier, a lista de `conflitos`; não interpretar o texto. A mensagem **não cita o nome do dashboard** (o front que sabe qual é, pode acrescentar). Em corrida entre duas gravações pode vir um `400` só com `mensagem` e sem `conflitos`.

## Inativar / reativar: `PUT /api/ped/faixas/{id}/situacao`

```json
{ "ativa": false, "motivo": "passou a valer faixa por filial" }
```

`200`: `{ "mensagem": "tabela de faixas inativada", "situacao": "inativa" }` (não devolve a tabela). Erros `400`: `motivo` vazio, `ativa` ausente, já estar na situação pedida, conflito (com `conflitos`). `404` se o id não existe. Faixa de dashboard **já excluído** não muda de situação: `400` "faixa de dashboard excluido nao muda de situacao" (só pode ser excluída). Não gera versão. Inativar a última faixa do dashboard é permitido.

`PUT /api/ped/faixas/{id}` (alterar faixas) em faixa inativa: `400` "a tabela de faixas esta inativa; reative a faixa antes de alterar". Resposta do alterar: `{ "mensagem", "versao" }`.

## Excluir: `DELETE /api/ped/faixas/{id}`

`motivo` obrigatório, no corpo `{ "motivo": "..." }` ou em `?motivo=` (até 500 caracteres). Sem motivo, ou com `motivo` que não seja texto (lista/objeto): `400` "informe o motivo da exclusao" (conferido **antes** da regra do dashboard). Enquanto o dashboard existe: `400` (a mensagem manda inativar).

## Histórico: `GET /api/ped/faixas/{id}/historico`

Lista única, mais recente primeiro. **`acao` vem sempre preenchida**: `cadastro`, `alteracao`, `inativacao`, `reativacao`.

```json
[
  { "acao": "inativacao", "versao": 2, "vigente": false, "motivo": "passou a valer faixa por filial", "data": "2026-11-12 14:05:00-04:00", "usuario": "admin", "quantidade de faixas": null },
  { "acao": "alteracao",  "versao": 2, "vigente": true,  "motivo": "reajuste", "data": "2026-11-01 10:00:00-04:00", "usuario": "admin", "quantidade de faixas": 3 },
  { "acao": "cadastro",   "versao": 1, "vigente": false, "motivo": "Cadastro inicial", "data": "2026-10-20 09:00:00-04:00", "usuario": "admin", "quantidade de faixas": 3 }
]
```

- Linhas de inativação/reativação **não são versões**: `vigente` é `false` e `quantidade de faixas` é `null`; não chamar `.../versoes/{versao}` por elas (use só em `cadastro`/`alteracao`).
- "Ver motivo": a primeira linha é a mais recente (motivo, autor, data, ação).
- Faixa **já excluída**: o histórico passa a responder `200` só com eventos, incluindo `acao: "exclusao"` (antes era `404`). O front deve aceitar essa quinta ação.

## Alertas nos dashboards

`GET /api/ped/dashboards` e `GET /api/ped/dashboards/{id}` trazem `alertas de faixas`:

```json
"alertas de faixas": [
  { "tipo": "conflito", "mensagem": "A filial 101 tem tabela de faixas ativa e o dashboard tambem tem uma tabela geral ativa.", "filial": "101" },
  { "tipo": "sem_faixa", "mensagem": "A filial 104 esta sem tabela de faixas ativa.", "filial": "104" },
  { "tipo": "sem_faixa", "mensagem": "Nenhuma tabela de faixas ativa para este dashboard.", "filial": null }
]
```

- Só dashboard `ativo` tem alerta; os outros vêm `[]`.
- `sem_faixa` por filial só quando **não** há geral ativa. Sem nenhuma ativa: um item com `filial: null`.
- Filtro `GET /api/ped/dashboards?situacao=problemas_faixa`. O filtro `problemas` não mudou (não inclui os alertas de faixas).

## O que continua igual

Validações das faixas, versão nova a cada alteração (motivo obrigatório), histórico de versões, permissões (Admin e Validador, todas as filiais; Preenchedor `403`), `GET .../versoes/{versao}`, formato dos campos antigos.

## Resumo do que o front precisa fazer

1. Enviar `situacao=ativas` na listagem se quiser só as ativas (o padrão do back é `todas`).
2. Aceitar `filial`/`nome filial` nulos e `geral`.
3. Enviar `motivo` no `DELETE`.
4. Tratar o `400` de conflito (com `conflitos`) no cadastro e na reativação.
5. Recarregar a lista após cadastrar e após inativar/reativar (as respostas não trazem a tabela).
6. No histórico, usar `acao` e não tentar abrir versão de linha de inativação/reativação; aceitar `exclusao`.
7. Ler `alertas de faixas` e usar `situacao=problemas_faixa`.
