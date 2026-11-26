# PED — Resposta do front à contraproposta da rota de alertas do menu

Esta é a resposta do front, de 19/11/2026, à [`CONTRAPROPOSTA-alertas-menu`](CONTRAPROPOSTA-alertas-menu.md) do back-end.

**Aceitamos a contraproposta** e respondemos abaixo às 5 confirmações. Dois pontos pedem ajuste: o 1 (a aba `tipos` do Preenchedor) e o 5 (a `descricao` concordando com a quantidade). Nenhum dos dois bloqueia o início da implementação.

Também aceitamos estes pontos, sem ressalvas:

- a rota não recebe `?filial`;
- o `total` é a soma das contagens, e o front não escreve "N indicadores" a partir dele;
- itens com `quantidade` 0 são omitidos;
- o `429` traz `Retry-After`;
- o `403` vale para usuário sem perfil no PED.

## Confirmações

### 1. Abas por perfil: confirmado, com uma diferença no Preenchedor

No menu do front, o Admin e o Validador veem todas as abas. O Preenchedor vê só **Início, Apontamentos, Dados Externos e Preenchimento**, e não vê **Tipos**.

| Aba | Admin | Validador | Preenchedor no front | Preenchedor na contraproposta |
| --- | --- | --- | --- | --- |
| `inicio` | sim | sim | sim | sim |
| `tipos` | sim | sim | **não** | **sim** |
| `apontamentos` | sim | sim | sim | sim |
| `dados-externos` | sim | sim | sim | sim |
| `indicadores` | sim | sim | não | não vem |
| `faixas` | sim | sim | não | não vem |
| `dashboards` | sim | sim | não | não vem |
| `preenchimento` | sim | sim | sim | sim |
| `fechamentos` | sim | sim | não | não vem |

O front cruza as chaves da resposta com o menu do perfil. Por isso, a chave `tipos` enviada ao Preenchedor **não causa erro**: o front simplesmente a ignora. Mesmo assim, sugerimos tirar `tipos` da resposta do Preenchedor, para a rota seguir o menu. A decisão fica com o back-end, porque isso depende do que a rota de tipos permite ao Preenchedor.

### 2. `integracao pendente` em Indicadores para o Validador: confirmado

Decisão do negócio de 19/11/2026: **o Validador precisa do alerta, mesmo sem poder editar a integração**. Aceitamos o ajuste 2 como proposto:

- **Indicadores:** Admin e Validador recebem o item `integracao pendente`. O front passa a acender a aba para os dois. O Validador também ganha o filtro "Integração pendente (TI)" na listagem, para encontrar os indicadores que acenderam o alerta. As ações de preencher e configurar a integração continuam **só do Admin**.
- **Dados externos:** o item `integracao pendente` continua só do Admin. Para o Validador e o Preenchedor, a aba vem com `total: 0` e `itens: []`.

O front fará essa mudança antes de a rota nova ficar pronta. Ela vale também para o `GET /api/ped/indicadores-cadastro` atual, que já entrega esse número ao Validador.

### 3. Primeira versão só com `indicadores` e `dados-externos`: confirmado

As demais abas vêm sempre com `total: 0`. Novos alertas entram depois como itens novos, sem mudar o front.

### 4. Limite de 30 chamadas por minuto: confirmado

O front prevê cerca de 12 chamadas por hora por usuário: no login, ao trocar de filial, quando a janela volta ao foco e a cada 5 minutos com a aba visível. No `429`, o front mantém os alertas que já tinha e só tenta de novo depois do `Retry-After`.

### 5. `descricao`: sim, o front vai usar, com um ajuste

A `descricao` vira a dica da aba no menu, por exemplo: "2 indicadores aguardando definição de meta · 1 indicador com integração da meta pendente". Por isso, pedimos que ela **não seja omitida**.

**Ajuste pedido:** a `descricao` já deve vir **concordando com a `quantidade`** e **incluindo o número**. Com uma frase fixa no plural, o front escreveria "1 indicadores…". Se a frase vier pronta, o front não precisa conhecer o `codigo` de cada alerta para escrever certo, o que mantém a regra de que um alerta novo não muda o front.

| `codigo` | `quantidade` | `descricao` |
| --- | --- | --- |
| `aguardando meta` | 1 | `1 indicador aguardando definição de meta` |
| `aguardando meta` | 2 | `2 indicadores aguardando definição de meta` |
| `meta pendente por filial` | 3 | `3 indicadores com filial sem meta` |
| `integracao pendente` (indicadores) | 1 | `1 indicador com integração da meta pendente` |
| `integracao pendente` (dados externos) | 4 | `4 dados externos sem integração configurada` |

Se o back-end preferir manter a frase sem o número, aceitamos também. Nesse caso, a concordância continua sendo pedida, e o front escreve "{quantidade} {descricao}".

## Resumo do contrato acertado

- `GET /api/ped/alertas-menu`, só de leitura, com `Authorization: Bearer`, sem `?filial`.
- A resposta tem `abas` → `{ total, itens: [{ codigo, quantidade, descricao }] }`.
- Vêm só as abas que a API permite ao perfil, e o front cruza com o próprio menu.
- A aba acende com `total > 0`.
- As contagens são iguais às das rotas de origem, calculadas pelo mesmo serviço.
- `integracao pendente` de Indicadores vem para o Admin e o Validador; a de Dados externos, só para o Admin.
- O limite é de 30 chamadas por minuto por usuário, com `429` e `Retry-After`.
- Os erros são `401`, `403`, `429` e `500`. Em todos, o front mantém os alertas que já tinha e não mostra mensagem.

Aguardamos o guia `FRONT-alertas-menu.md` com o contrato final para começar a integração no front.
