# PED — Ajuste pedido ao back-end: cálculo no período fica no dashboard (26/11/2026)

Resposta do front à entrega **D-2** (página de pendências de 25/11 e `ped.yaml` de produção, `info.version` "2026-11-25"). Complementa a [`PROPOSTA-calculo-no-periodo-dashboard.md`](PROPOSTA-calculo-no-periodo-dashboard.md), que continua sendo o contrato pedido.

## Decisão

O negócio decidiu **manter o modelo do front**. O cálculo do período é escolhido **por indicador dentro do dashboard**, e não no cadastro do indicador.

**Motivo:** o mesmo indicador pode entrar em dashboards de periodicidades diferentes e precisar de cálculos diferentes em cada um. Por exemplo, um indicador pode ser somado num dashboard trimestral e usar só o último valor num anual. Com a periodicidade presa ao indicador:
- é preciso cadastrar um indicador para cada periodicidade;
- o cálculo não muda sem inativar e cadastrar de novo;
- a regra fica limitada a dado externo com meta manual.

O pedido do negócio vale para **todos os indicadores** de um dashboard não mensal.

O front já está pronto nesse modelo (F7.15):
- O formulário de dashboard mostra o campo obrigatório **"Cálculo no período"** em cada indicador quando a periodicidade não é `mensal`. As opções são "Somar", "Fazer a média" e "Usar só o último valor", e não há valor padrão.
- O formulário mostra o aviso: "Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador."
- O cadastro, a edição e a prévia enviam `"calculo do periodo"` em cada item de `indicadores`. No dashboard mensal, o campo não vai.
- O detalhe é lido para preencher a edição.

## O que precisa ser ajustado no back-end

### 1. Receber o campo no dashboard

Rotas: `POST /api/ped/dashboards`, `PUT /api/ped/dashboards/{id}` e `POST /api/ped/dashboards/previa-tarefa`.

O campo novo vai em cada item de `indicadores`:

```json
"indicadores": [
  { "id indicador": 7, "pontos base": 40, "calculo do periodo": "soma" },
  { "id indicador": 9, "pontos base": 60, "calculo do periodo": "media" }
]
```

Regras:
- **Valores aceitos:** `soma`, `media` ou `ultimo`.
- **Dashboard não mensal:** o campo é obrigatório em cada indicador. Sem ele, ou com valor fora da lista, o back-end responde `400`. Sugestão de mensagens:
  - `"informe o calculo do periodo do indicador \"X\""`
  - `"calculo do periodo invalido: use soma, media, ultimo"`
- **Dashboard mensal:** o campo é ignorado e gravado como `null`. O front não o envia.
- **Edição que passa para mensal:** os valores deixam de valer e ficam `null`.
- **Prévia da tarefa para a TI:** deve mostrar o cálculo de cada indicador, porque a TI precisa dele para construir o dashboard.

### 2. Devolver o campo no detalhe

`GET /api/ped/dashboards/{id}` deve trazer `"calculo do periodo"` em cada item de `indicadores`. O valor é `null` no dashboard mensal e nos dashboards não mensais cadastrados antes do ajuste.

### 3. Usar o campo no fechamento, para todos os tipos de indicador

Na prévia, no encerramento e nas imagens congeladas de um dashboard não mensal, o resultado do período de cada indicador é a combinação dos seus **resultados mensais**, conforme o `calculo do periodo` do dashboard. Isso vale para os indicadores de **apontamentos** e de **dado externo**, e também para os de meta via API (ver item 6).

Para as regras de agregação, aproveitem as que já foram definidas na D-2. O front concorda com todas:
- **Meses usados:** os do período do dashboard, até o mês aberto.
- **Mês sem dado:** fica de fora da soma e da média. `ultimo` usa o último mês que tem dado.
- **Meta:** acompanha o cálculo nos mesmos meses.
  - `soma`: soma das metas mensais.
  - `media`: média das metas.
  - `ultimo`: meta do último mês que tem dado e meta.
  - A regra usada fica registrada na observação do cálculo. Exemplo: "Meta: soma das metas de 2 mes(es)."
- **Depois do período:** atingimento, pontos e faixas seguem como hoje, a partir do resultado do período.

Também pedimos que a imagem congelada guarde o `calculo do periodo` de cada indicador e os valores mensais usados. Assim o PDF mostra de onde veio o resultado.

### 4. Retirar `periodicidade` e `agregacao mensal` do indicador

A D-2 incluiu esses dois campos no cadastro de indicador. Com a decisão acima, eles passam a ser uma segunda fonte para a mesma regra. Pedimos:
- **Tirar os campos** de `POST /api/ped/indicadores-cadastro` e da resposta do indicador. Se preferirem manter por compatibilidade, deixem-nos sem efeito e documentados como obsoletos. O front não vai enviá-los.
- **Tirar a regra de "mesma periodicidade"** entre o indicador e o dashboard, incluindo o indicador base da faixa. Hoje essa regra devolve `400` no cadastro e na edição do dashboard. Sem periodicidade no indicador, qualquer indicador volta a poder entrar em qualquer dashboard.
- **Indicadores já cadastrados com os campos preenchidos:** como os campos acabaram de ser publicados, o front não cadastrou nenhum. Se houver algum de teste, pode ser limpo.

### 5. Dashboards não mensais que já existem

Esses dashboards vão ter `calculo do periodo` `null`. Proposta:
- **Até alguém editar:** a prévia usa o comportamento atual e o dashboard mostra um alerta em `alertas`. Sugestão de texto: "Cálculo no período não definido: edite o dashboard e escolha o cálculo de cada indicador." O front já mostra os `alertas` do dashboard.
- **Encerramento:** com indicador sem cálculo definido num dashboard não mensal, o back-end responde `400` com mensagem clara, no mesmo padrão do método de pontuação indisponível. Assim nenhuma imagem é congelada com regra indefinida.
- **Edição:** na tela, o front já exige a escolha ao editar esses dashboards.

### 6. Meta via API

A D-2 recusa a agregação com meta via API ("a agregacao mensal ainda nao esta disponivel com meta via API"). No modelo do dashboard, pedimos uma de duas saídas:
- **(a)** aplicar a mesma regra também à meta vinda da API;
- **(b)** se ainda não for possível, responder `400` no dashboard com uma mensagem que cite o indicador. O front mostra a mensagem no formulário.

### 7. Histórico do dashboard

A troca do cálculo de um indicador deve aparecer em `GET /api/ped/dashboards/{id}/historico` como modificação, da mesma forma que aparece hoje a troca dos pontos base.

## Resumo para o Swagger

| Onde | Mudança |
| --- | --- |
| `DashboardEntrada.indicadores[]` | Novo `calculo do periodo`: enum `soma`, `media`, `ultimo`, nullable. Obrigatório quando `periodicidade` ≠ `mensal`. |
| Detalhe do dashboard `indicadores[]` | Novo `calculo do periodo` (nullable). |
| `IndicadorEntrada` e resposta do indicador | Retirar `periodicidade` e `agregacao mensal`, ou marcá-los como obsoletos e sem efeito. |
| `POST`/`PUT /ped/dashboards` | Retirar o `400` de "mesma periodicidade". Incluir os `400` do item 1. |
| `POST /ped/fechamentos/{id}/encerrar` | `400` quando faltar o cálculo de algum indicador num dashboard não mensal. |
| Prévia e imagens | Realizado e meta do período pelo `calculo do periodo` do dashboard. A imagem guarda o cálculo e os meses usados. |

## Perguntas

1. Algum dashboard real em produção já usa indicador com `periodicidade` ou `agregacao mensal` preenchidos?
2. Para meta via API, vocês preferem a saída (a) ou a (b) do item 6?
3. Há previsão para o ajuste? Enquanto ele não chega, o back-end ignora o `"calculo do periodo"` enviado pelo front, e os dashboards não mensais seguem o comportamento anterior.
