# Front: chave `mensagem` nos erros nativos e 400 para data inválida

## O que mudou

1. **Erros que o Laravel gera sozinho** (sem token, rota/registro inexistente, método errado, validação `422`) continuam com o mesmo status e a chave `message` em inglês, e **ganham também `mensagem`**, como o resto da API. Nada foi removido.
2. **Filtros de data malformados na query string** passaram de `500` para `400` com `mensagem`:
   - `GET /api/premiacoes` e `/api/premiacoes/exportar-csv`: `data_inicio`, `data_fim`.
   - `GET /api/comissoes`, `/api/descontos-bonificacoes` e seus `/exportar-csv`, e `GET /api/bloqueios`: `mes_de_referencia`.
3. `GET /api/premiacoes` agora devolve `500` genérico (`{"mensagem": "erro ao consultar premiacoes"}`) em falha interna, em vez de erro cru.

## Antes e depois

Sem token (`Accept: application/json`):

```json
// antes
{ "message": "Unauthenticated." }
// depois (401)
{ "message": "Unauthenticated.", "mensagem": "nao autenticado" }
```

Data inválida: `GET /api/premiacoes?data_inicio=abc&data_fim=2026-09-30`

```json
// antes: 500
// depois: 400
{ "mensagem": "The data_inicio field must be a valid date." }
```

Mapa de `mensagem` nos erros nativos: `401` "nao autenticado", `404` "recurso nao encontrado", `405` "metodo nao permitido", `422` primeira mensagem de `errors`. `403` e `429` do framework não ganham `mensagem` (o `429` do login já tinha).

## O que o front deve fazer

- Ler `mensagem` e usar `message` só como reserva; um interceptor único para `401`/`404`/`405`/`422` basta.
- Tratar `400` desses GETs como erro de filtro (mostrar a mensagem ou corrigir o formato). Não mostrar o texto em inglês ao usuário final; use uma mensagem própria.
- Enviar datas em `yyyy-mm-dd`, `yyyy-mm` ou ISO com `T...Z`. Evitar `dd/mm/yyyy` (já falhava antes, só que como `500`; `mm/dd/yyyy` é lido à americana).
- Não enviar `data_inicio` ou `data_fim` vazios com texto qualquer: vazio é ignorado, texto inválido é `400`.

## O que continua igual

- Status e corpo de todos os erros nativos; `message` segue presente.
- Data ausente ou vazia: sem filtro (premiações) ou mês atual/sem filtro (demais). Datas válidas: mesma resposta `200` de antes, inclusive `2026-09-15T12:00:00.000Z` e `2026-09`.
- Premiações só filtra por período quando vêm `data_inicio` **e** `data_fim`.

## Erros possíveis

`400` (data inválida), `401`, `404`, `405`, `422`, `500` genérico.
