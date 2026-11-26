# PED — Proposta: cálculo no período dos indicadores em dashboard não mensal (25/11/2026)

O pedido vem do negócio (front, 25/11/2026). Ainda não existe no Swagger de desenvolvimento (`ped.yaml`, `info.version` "2026-11-25").

## Motivação

Num dashboard **bimestral, trimestral, semestral ou anual**, o resultado do período é formado pelos resultados **mensais** dos meses que o compõem. O cadastro do dashboard ainda não diz como esses meses se combinam em cada indicador. Um indicador de volume, por exemplo, deve somar os meses. Um de percentual deve fazer a média. Um de saldo ou estoque deve usar só o último mês.

O negócio quer que, em dashboard não mensal, **cada indicador** do dashboard informe o cálculo do período:

| Valor | Rótulo na tela | Resultado do período |
| --- | --- | --- |
| `soma` | Somar | Soma dos resultados mensais dos meses do período |
| `media` | Fazer a média | Média dos resultados mensais dos meses do período |
| `ultimo` | Usar só o último valor | Resultado do último mês do período |

São os mesmos valores de `sentido do calculo` do dado externo (`soma`, `media`, `ultimo`).

## O que o front já faz (ou fará nesta entrega)

- Na seção de indicadores do formulário de dashboard, quando a periodicidade não é `mensal`, cada indicador tem um select **"Cálculo no período"**. Ele é **obrigatório** e não tem valor padrão.
- Junto da seção aparece o aviso: "Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador."
- Com a periodicidade `mensal`, o campo não aparece e **não é enviado**.

## Contrato proposto

### `POST /api/ped/dashboards`, `PUT /api/ped/dashboards/{id}` e `POST /api/ped/dashboards/previa-tarefa`

Um novo campo em cada item de `indicadores`:

```json
{
  "nome": "PED Trimestral",
  "periodicidade": "trimestral",
  "indicadores": [
    { "id indicador": 7, "pontos base": 40, "calculo do periodo": "soma" },
    { "id indicador": 9, "pontos base": 60, "calculo do periodo": "media" }
  ]
}
```

Regras:

- **`calculo do periodo`:** enum `soma | media | ultimo`.
  - Obrigatório em cada indicador quando `periodicidade` não é `mensal`. Sem ele, a resposta é `400` com mensagem do tipo `"informe o calculo do periodo do indicador <nome>"`.
  - Quando `periodicidade` é `mensal`, o front não envia o campo. Sugestão: o back ignora o campo, ou o grava como `null`.
  - Na edição, se a periodicidade passar de não mensal para mensal, o valor deixa de valer.
- **Prévia da tarefa para a TI:** sugerimos que ela mostre o cálculo de cada indicador, porque a TI precisa dele para montar o dashboard.

### `GET /api/ped/dashboards/{id}`

O mesmo campo em cada item de `indicadores` do detalhe, para a edição vir preenchida. Ele vem `null` em dashboard mensal e nos dashboards não mensais cadastrados antes da mudança:

```json
"indicadores": [
  { "id": 7, "nome": "Volume de vendas", "pontos base": 40, "calculo do periodo": "soma", "ativo": true, "problema": null }
]
```

### Histórico do dashboard (`GET /api/ped/dashboards/{id}/historico`)

Uma troca do cálculo de um indicador deveria constar no histórico como modificação, da mesma forma que hoje consta a troca dos pontos base.

## Uso no fechamento

No fechamento (`/api/ped/fechamentos/...`) e nas imagens congeladas de um dashboard não mensal:

1. o resultado mensal de cada indicador é calculado em cada mês do período, como já é hoje no dashboard mensal;
2. o resultado do período é a combinação desses meses, segundo o `calculo do periodo` do indicador;
3. o atingimento, os pontos e as faixas seguem como hoje, a partir do resultado do período.

Seria útil que a imagem congelada guardasse o `calculo do periodo` de cada indicador e os valores mensais usados, para que o PDF mostre de onde veio o resultado do período.

## Perguntas ao back-end

1. Como o back calcula hoje o resultado de um dashboard não mensal? Soma os meses, usa só o mês aberto ou outra regra?
2. A **meta** do período segue o mesmo `calculo do periodo` do indicador, ou tem regra própria? Por exemplo, somar as metas mensais no `soma` e fazer a média das metas no `media`.
3. Como devem ficar os **dashboards não mensais que já existem**? Há duas opções:
   - o back aplica um padrão (por exemplo, `soma`) até alguém editar;
   - o dashboard fica com alerta até o cálculo ser informado.
   No segundo caso, o front pode mostrar o alerta, se ele vier em `alertas`.
4. Em `media`, entram só os meses que têm valor (como no dado externo), ou um mês sem valor conta como zero?
5. O nome `calculo do periodo` serve, ou preferem outro? O front se adapta.
