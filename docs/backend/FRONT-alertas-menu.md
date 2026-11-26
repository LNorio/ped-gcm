# Alertas das abas do menu: guia para o front (2026-11-19)

Resposta à `PROPOSTA-alertas-menu` e à `RESPOSTA-contraproposta-alertas-menu`. Contrato completo em `docs/ped/API.md` (seção "Alertas das abas do menu"). **Nenhuma rota existente muda de forma.**

## A rota

`GET /api/ped/alertas-menu` com `Authorization: Bearer`, sem parâmetros (**não envie `?filial`**). Qualquer perfil do PED.

```json
{
  "abas": {
    "inicio":         { "total": 0, "itens": [] },
    "dados-externos": { "total": 4, "itens": [
      { "codigo": "integracao pendente", "quantidade": 4, "descricao": "4 dados externos sem integração configurada" } ] },
    "indicadores":    { "total": 3, "itens": [
      { "codigo": "aguardando meta", "quantidade": 2, "descricao": "2 indicadores aguardando definição de meta" },
      { "codigo": "integracao pendente", "quantidade": 1, "descricao": "1 indicador com integração da meta pendente" } ] }
  }
}
```

(O exemplo foi encurtado; a resposta real traz todas as abas do perfil.)

## Quais abas vêm

| Aba | Admin | Validador | Preenchedor |
| --- | --- | --- | --- |
| `inicio` | sim | sim | sim |
| `tipos` | sim | sim | **não vem** |
| `apontamentos` | sim | sim | sim |
| `dados-externos` | sim | sim | sim |
| `indicadores` | sim | sim | não vem |
| `faixas` | sim | sim | não vem |
| `dashboards` | sim | sim | não vem |
| `preenchimento` | sim | sim | sim |
| `fechamentos` | sim | sim | não vem |

Aceitamos o seu ajuste: o Preenchedor **não recebe `tipos`** (o menu dele não tem a aba). A aba que o perfil acessa e não tem alerta vem com `total: 0` e `itens: []`; a aba que o perfil não acessa **não vem**. Continue cruzando as chaves da resposta com o seu menu: chave desconhecida é ignorada.

## Itens e `descricao`

- A aba acende quando `total > 0`. `total` é a **soma** das quantidades dos itens; um mesmo indicador pode estar em mais de um item, então **não escreva "N indicadores" a partir do `total`**.
- Itens com `quantidade` 0 **não vêm**.
- **`descricao` já traz o número e a concordância** (`1 indicador aguardando definição de meta`, `2 indicadores aguardando definição de meta`), como você pediu. Use-a direto na dica do menu, sem prefixar a quantidade. Um alerta novo entra com a sua própria frase, sem mudar o front.

| Aba | `codigo` | Quem recebe |
| --- | --- | --- |
| `indicadores` | `aguardando meta`, `meta pendente por filial`, `com componente desativado`, `integracao pendente` | Admin e Validador |
| `dados-externos` | `integracao pendente` | **só o Admin** (Validador e Preenchedor: `total: 0`) |

`integracao pendente` em `indicadores` vale para o **Validador** também (decisão do negócio de 19/11): a aba acende para ele e o número é o mesmo da listagem. As ações de configurar a integração continuam só do Admin.

## Números iguais aos das rotas atuais

`indicadores` é igual ao bloco `alertas` de `GET /api/ped/indicadores-cadastro` (só indicadores ativos), e `dados-externos` é igual à `quantidade` de `GET /api/ped/dados-externos-cadastro/integracoes-pendentes`. As três rotas usam o mesmo cálculo no back. Com a aba aberta, continue usando as contagens da própria listagem; esta rota serve para o restante do tempo.

## Erros

| Status | Quando | O que fazer |
| --- | --- | --- |
| `401` | Sem token ou token expirado (12 h) | Tratamento atual da sessão |
| `403` | Usuário sem perfil no PED | Não marcar nenhuma aba |
| `429` | Mais de **30 chamadas por minuto** por usuário | Manter os alertas e tentar de novo depois do `Retry-After` (vem também `segundos para tentar novamente` no JSON) |
| `500` | Falha interna (`mensagem` genérica) | Manter os alertas, sem mensagem na tela |

O ritmo previsto (cerca de 12 chamadas por hora por usuário) fica muito abaixo do limite.

## O que continua igual

Todas as rotas existentes, o formato do bloco `alertas` da listagem de indicadores e o da rota de integrações pendentes. Sem migration e sem variável nova no servidor.
