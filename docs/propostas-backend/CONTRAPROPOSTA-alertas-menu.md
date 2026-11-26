# PED — Contraproposta: rota de alertas das abas do menu

Resposta do back-end à `PROPOSTA-alertas-menu` do front (19/11/2026). **Aceitamos a rota nova** `GET /api/ped/alertas-menu`, só de leitura, sem mudar nenhuma rota existente. Abaixo estão os ajustes que propomos e as respostas às 4 perguntas. **Ainda não foi implementada:** queremos a confirmação do front nos pontos marcados como **Confirmar** antes de começar.

## O que aceitamos como está

- Rota única `GET /api/ped/alertas-menu`, com `Authorization: Bearer`, e não um campo no `GET /api/ped/inicio` (o `inicio` é mais pesado).
- O formato `abas` → `{ total, itens: [{ codigo, quantidade, descricao }] }`, com uma chave por aba, na ordem do menu.
- A aba acende quando `total > 0`. Alerta novo no futuro é só um item novo em `itens`, sem mudar o front.
- Chaves de aba e `codigo` com hífen ou espaço (`dados-externos`, `aguardando meta`), como no resto da API.
- O front ignora chaves de aba que não conhece.
- Contagens **iguais** às das rotas de origem: `indicadores` igual ao bloco `alertas` de `GET /api/ped/indicadores-cadastro`, e `dados-externos` igual à `quantidade` de `GET /api/ped/dados-externos-cadastro/integracoes-pendentes`. Para isso, as três rotas passarão a usar **o mesmo código de contagem** no back-end.

## Ajustes que propomos

### 1. Quais abas vêm, por perfil

O back-end não conhece o menu do front; ele só sabe o que cada rota permite por perfil. A rota devolve **as abas que a API permite ao perfil**, e o front **cruza** com o menu que ele já mostra.

| Aba | Admin | Validador | Preenchedor |
| --- | --- | --- | --- |
| `inicio` | sim | sim | sim |
| `tipos` | sim | sim | sim |
| `apontamentos` | sim | sim | sim |
| `dados-externos` | sim | sim | sim |
| `indicadores` | sim | sim | não vem |
| `faixas` | sim | sim | não vem |
| `dashboards` | sim | sim | não vem |
| `preenchimento` | sim | sim | sim |
| `fechamentos` | sim | sim | não vem |

- Usuário **sem perfil no PED** (por exemplo, gerente sem acesso ao PED): `403` com `mensagem`. O front não marca nenhuma aba.
- Aba que o perfil acessa e não tem alerta vem com `total: 0` e `itens: []`.
- Aba que o perfil **não** acessa não vem na resposta (a chave fica ausente).

### 2. `integracao pendente` em Indicadores vale para Admin **e Validador**

A proposta tinha duas regras que não cabiam juntas: a regra 2 dizia "só o Admin", e a regra 3 dizia "igual às rotas atuais". Hoje o `GET /api/ped/indicadores-cadastro` entrega esse número também ao Validador, então propomos **manter como hoje**: Admin e Validador veem o item `integracao pendente` em `indicadores`. Assim a aba acende no menu e, ao abrir, o número é o mesmo.

Já em `dados-externos`, o item `integracao pendente` continua **só para o Admin**, como na rota atual. Para Validador e Preenchedor, a aba `dados-externos` vem com `total: 0` e `itens: []`.

### 3. Sem `?filial`

Os alertas são de **cadastro** (pendências da TI e da validação), não de uma filial específica. A rota **não aceita `?filial`**, e o front não deve enviar. As contagens de `meta pendente por filial` consideram **todas as filiais cadastradas**, como na listagem. Como só Admin e Validador acessam `indicadores`, e os dois veem todas as filiais, o resultado é o mesmo que "as filiais do acesso".

### 4. `total` é uma soma de contagens, não uma contagem de registros

Um mesmo indicador pode entrar em mais de um alerta (por exemplo, aguardando meta **e** com componente desativado). Por isso o `total` de `indicadores` pode ser maior que o número de indicadores distintos. A aba acende por `total > 0`, então isso não atrapalha. Pedimos só que o front **não escreva** "N indicadores no total" a partir do `total`. A `descricao` de cada item é a frase certa para a dica do menu.

### 5. Itens com `quantidade` 0 são omitidos

Um tipo de alerta sem registros não vem em `itens`. Uma aba sem nenhum alerta vem com `total: 0` e `itens: []`.

### 6. Limite de uso

Hoje essa rota não tem limite. Propomos `throttle` de **30 chamadas por minuto por usuário**, no mesmo padrão dos limites do PDF. Bem acima das ~12 chamadas por hora que o front prevê, e protege contra um laço no front. Quando passa do limite, a resposta é `429` em JSON com `mensagem`, `segundos para tentar novamente` e o cabeçalho `Retry-After`.

### 7. Só alertas que já existem

Nesta primeira versão **só `indicadores` e `dados-externos` têm itens**, como a proposta pede. As demais abas vêm com `total: 0`. O formato já comporta incluir mais alertas depois, sem mudar o front.

## Resposta final proposta

Exemplo para o **Admin** (com alertas):

```json
{
  "abas": {
    "inicio":         { "total": 0, "itens": [] },
    "tipos":          { "total": 0, "itens": [] },
    "apontamentos":   { "total": 0, "itens": [] },
    "dados-externos": {
      "total": 4,
      "itens": [
        { "codigo": "integracao pendente", "quantidade": 4, "descricao": "dados externos sem integração configurada" }
      ]
    },
    "indicadores": {
      "total": 6,
      "itens": [
        { "codigo": "aguardando meta",           "quantidade": 2, "descricao": "indicadores aguardando definição de meta" },
        { "codigo": "meta pendente por filial",  "quantidade": 3, "descricao": "indicadores com filial sem meta" },
        { "codigo": "integracao pendente",       "quantidade": 1, "descricao": "indicadores com integração da meta pendente" }
      ]
    },
    "faixas":         { "total": 0, "itens": [] },
    "dashboards":     { "total": 0, "itens": [] },
    "preenchimento":  { "total": 0, "itens": [] },
    "fechamentos":    { "total": 0, "itens": [] }
  }
}
```

Exemplo para o **Preenchedor** (só as abas que a API permite a ele):

```json
{
  "abas": {
    "inicio":         { "total": 0, "itens": [] },
    "tipos":          { "total": 0, "itens": [] },
    "apontamentos":   { "total": 0, "itens": [] },
    "dados-externos": { "total": 0, "itens": [] },
    "preenchimento":  { "total": 0, "itens": [] }
  }
}
```

## Erros

| Status | Quando | O que o front faz |
| --- | --- | --- |
| `401` | Sem token ou token expirado (os tokens duram 12 h) | Tratamento atual da sessão |
| `403` | Usuário sem perfil no PED | Não marca nenhuma aba |
| `429` | Mais de 30 chamadas por minuto | Mantém os alertas que já tinha e tenta de novo depois do `Retry-After` |
| `500` | Falha interna, `{"mensagem": "erro ao ..."}` sem detalhe | Mantém os alertas que já tinha, sem mensagem na tela |

## Respostas às perguntas do front

1. **Rota nova ou campo no `inicio`?** Rota nova, como o front prefere.
2. **`meta pendente por filial`: todas as filiais ou a filial do cabeçalho?** Todas as filiais, sem `?filial` (ver ajuste 3).
3. **Há limite de uso?** Propomos 30 por minuto por usuário; o ritmo previsto (cerca de 12 por hora) fica muito abaixo.
4. **Alguma sugestão de alerta futuro já existe?** Nenhuma existe hoje como contagem por aba. Já existem como dado, e poderiam virar contagem se o negócio pedir:
   - **Dashboards:** alertas de problema e de faixas por dashboard;
   - **Início e Preenchimento:** `lancamentos pendentes` no mês aberto;
   - **Fechamentos:** `indicadores com problema` por dashboard.
   - O alerta de "filiais sem composição do DRG" **não** teria dado hoje, porque o DRG está desligado. Os demais exemplos da proposta dependem de regra de negócio. Nada disso entra agora.

## O que o back-end fará

- Um serviço de contagens compartilhado, usado pela rota nova e pelas duas rotas de origem, para os números nunca divergirem.
- A rota, o limite de uso, os testes (perfis, `403`, `401`, vazio e igualdade com as rotas de origem) e o guia `FRONT-alertas-menu.md`, com o contrato final.
- Só código: sem migration, sem variável nova de ambiente e sem mudança nas rotas atuais. Nenhuma sessão é afetada.

## O que o front fará

- Chamar a rota nos momentos que a proposta descreve e **cruzar** as chaves de `abas` com o menu que ele já mostra por perfil.
- Tratar `401`, `403` (não marcar nada), `429`, `500` e falha de rede mantendo os alertas anteriores.
- Não enviar `?filial` e não derivar texto de "N indicadores" do `total`.

## Para o front confirmar

1. O mapa de abas por perfil da tabela acima está de acordo com o menu de vocês? Em especial: o Preenchedor vê as abas `tipos`, `apontamentos` e `dados-externos` no menu?
2. Tudo bem o Validador ter o alerta `integracao pendente` em Indicadores, e `dados-externos` sem alerta para ele?
3. Tudo bem a primeira versão ter alertas só em `indicadores` e `dados-externos`, com as demais abas sempre em `total: 0`?
4. O limite de 30 chamadas por minuto atende o uso previsto?
5. A `descricao` vai ser usada na dica do menu? Se não for, podemos omiti-la.
