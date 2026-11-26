# PED — Proposta: rota leve para os alertas das abas do menu

Proposta do front de 19/11/2026. Pede uma rota nova, só de leitura: `GET /api/ped/alertas-menu`. Nenhuma rota existente muda.

O formato já prevê **todas as abas** do menu. Hoje só Indicadores e Dados externos têm alertas, mas qualquer aba pode ganhar alertas no futuro sem mudar o contrato nem o front.

## Problema

Hoje duas abas do menu mostram um sinal de alerta quando há algo pendente nelas:

| Aba | Quando acende | Quem vê | Origem atual do número |
| --- | --- | --- | --- |
| Indicadores | Indicadores ativos aguardando meta, com componente desativado, com filial sem meta ou com a integração da meta pendente (esta última só para o Admin) | Perfis com acesso à aba. A integração pendente só para o Admin | Bloco `alertas` de `GET /api/ped/indicadores-cadastro` |
| Dados externos | Dados externos sem integração configurada | Só o Admin | `quantidade` de `GET /api/ped/dados-externos-cadastro/integracoes-pendentes` |

O front só faz essas consultas **quando a aba é aberta**. Quem entra no sistema não vê o alerta no menu até abrir a aba Indicadores ou Dados externos, então o alerta não avisa quando mais importa.

Mostrar os alertas já no login com as rotas atuais exigiria chamá-las no início da sessão e depois periodicamente. Isso tem dois problemas:

- `GET /api/ped/indicadores-cadastro` devolve a **lista inteira** de indicadores (metas, componentes, integrações) só para o front ler quatro números;
- cada verificação faria uma chamada por aba com alerta. O número de chamadas cresceria a cada aba nova e se repetiria no login, ao trocar de filial, quando a janela volta ao foco e a cada 5 minutos.

## Proposta

Uma rota única, com as contagens de alerta de **todas as abas** do menu:

```http
GET /api/ped/alertas-menu
Authorization: Bearer <token>
```

### Abas do menu

Cada aba do menu tem uma chave na resposta. A lista e a ordem são as do menu:

| Chave | Aba | Alertas hoje |
| --- | --- | --- |
| `inicio` | Início | — |
| `tipos` | Tipos | — |
| `apontamentos` | Apontamentos | — |
| `dados-externos` | Dados Externos | `integracao pendente` (só Admin) |
| `indicadores` | Indicadores | `aguardando meta`, `com componente desativado`, `meta pendente por filial` e `integracao pendente` (este último só para o Admin) |
| `faixas` | Faixas | — |
| `dashboards` | Dashboards | — |
| `preenchimento` | Preenchimento | — |
| `fechamentos` | Fechamentos | — |

### Resposta `200`

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
      "total": 7,
      "itens": [
        { "codigo": "aguardando meta",           "quantidade": 2, "descricao": "indicadores aguardando definição de meta" },
        { "codigo": "com componente desativado", "quantidade": 1, "descricao": "indicadores com componente desativado" },
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

Campos de cada aba:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `total` | número | Soma das `quantidade` dos itens. A aba **acende quando `total > 0`** |
| `itens` | lista | Um item por tipo de alerta da aba. Lista vazia quando não há alerta |
| `itens[].codigo` | texto | Identifica o alerta (ex.: `aguardando meta`). É estável e não muda de nome |
| `itens[].quantidade` | número | Quantos registros estão nessa situação. Um item com `quantidade` 0 pode ser omitido |
| `itens[].descricao` | texto, opcional | Texto curto em pt-BR. O front pode usá-lo como dica no menu, como "2 indicadores aguardando definição de meta" |

### Regras

1. **Todas as abas que o usuário pode acessar vêm na resposta**, mesmo sem alerta (`total: 0`, `itens: []`). Assim o front sabe que a aba foi verificada e pode apagar um alerta antigo.
2. **Abas sem acesso não vêm.** O mesmo vale para itens que o perfil não pode ver. Nesses casos, a chave ou o item ficam ausentes; não vêm com `0`. Hoje:
   - o item `integracao pendente` de `indicadores` e a aba `dados-externos` só vêm para o **Admin**;
   - as demais abas seguem as permissões de acesso ao menu de cada perfil.
3. **Mesmas contagens das rotas atuais.** Os números dos alertas que já existem devem ser iguais aos que as rotas de origem devolvem hoje para o mesmo usuário:
   - `indicadores`: igual ao bloco `alertas` de `GET /api/ped/indicadores-cadastro`. Os códigos são os nomes dos campos desse bloco. Conta só indicadores **ativos** e não depende do filtro da listagem;
   - `dados-externos.integracao pendente`: igual à `quantidade` de `GET /api/ped/dados-externos-cadastro/integracoes-pendentes`.
4. **Escopo de filiais.** Os alertas por filial (hoje, `meta pendente por filial`) consideram as filiais do acesso do usuário, como em `GET /api/ped/indicadores-cadastro`. Veja a pergunta 2.
5. **Leve.** Só contagens, sem listas de registros. O front chama a rota com frequência (veja abaixo), então ela deve responder rápido e não ter limite de uso que bloqueie esse ritmo.

### Novos alertas no futuro

Para criar um alerta numa aba, basta o back-end acrescentar um item em `itens` (novo `codigo`) e somá-lo ao `total`. **O front não precisa mudar** para isso:

- a aba acende pelo `total`, sem o front conhecer o `codigo`;
- a dica do menu usa a `descricao`, quando vier;
- o front só precisa ser alterado se o alerta novo tiver uma ação própria na tela, como um aviso com botão de filtro. Nesse caso o `codigo` é combinado entre as equipes.

Se uma aba nova entrar no menu, ela ganha uma chave nova em `abas`. O front ignora as chaves que ainda não conhece.

Sugestões de alertas futuros, só como exemplo do que o formato comporta. **Nenhuma é pedida agora**, e cada uma depende de confirmação da regra de negócio:

| Aba | Possível alerta |
| --- | --- |
| Início | Avisos do período ou do acesso ainda não lidos |
| Tipos | Tipos ativos sem nenhum usuário ou grupo vinculado |
| Apontamentos | Apontamentos ativos sem valor no mês aberto |
| Faixas | Unidades sem tabela de faixas |
| Dashboards | Dashboards em construção ou sem indicadores |
| Preenchimento | Lançamentos pendentes ou metas a definir no mês aberto |
| Fechamentos | Fechamentos prontos para encerrar ou filiais sem composição do DRG |

### Erros

| Status | Quando | O que o front faz |
| --- | --- | --- |
| `401` | Sessão expirada | Tratamento atual da sessão |
| `403` | Usuário sem acesso | Não marca nenhuma aba |
| Outros ou rede | Falha | Mantém os alertas que já estavam e tenta de novo na próxima verificação, sem mensagem na tela |

## Quando o front chama

- logo depois do login, assim que o acesso é lido;
- ao trocar de filial;
- quando a janela do navegador volta ao foco;
- a cada 5 minutos, só com a aba do navegador visível.

Isso dá, no máximo, cerca de 12 chamadas por hora por usuário com o sistema aberto. É uma chamada só por verificação, qualquer que seja o número de abas com alerta.

Com a aba Indicadores ou Dados externos aberta, a tela continua lendo as contagens da própria listagem e atualiza o alerta na hora depois de cada ação, por exemplo ao definir uma meta ou concluir uma integração. A rota nova serve para o restante do tempo.

## O que o front faz

- Um verificador central chama `GET /api/ped/alertas-menu` nos momentos acima e acende as abas com `total > 0`.
- A regra "a aba tem alerta?" fica num lugar só, usado pelo verificador e pelas telas, para que não divirjam.
- Se a rota atrasar, o front pode usar as rotas atuais como solução provisória, com o custo descrito no Problema. Quando a rota entrar, só a fonte do verificador muda.

## Perguntas

1. O back-end prefere a rota nova `GET /api/ped/alertas-menu` ou um campo `"alertas menu"` no `GET /api/ped/inicio`? O front prefere a rota nova, porque o `inicio` é mais pesado e seria chamado a cada 5 minutos.
2. `meta pendente por filial` deve considerar todas as filiais do acesso ou só a filial selecionada no cabeçalho? Hoje o front não envia a filial em `GET /api/ped/indicadores-cadastro`. Se for por filial, a rota passa a receber `?filial=<código>`, valendo para todas as abas.
3. A rota tem limite de uso? Com que ritmo o front pode chamá-la?
4. Das sugestões de alertas futuros, alguma já é calculada pelo back-end ou já foi pedida pelo negócio? Há outras pendências que deveriam acender abas?
