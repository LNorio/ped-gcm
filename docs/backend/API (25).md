# API — PED (Comercial Mariano)

Contrato dos endpoints do PED para o front-end. É **independente** da documentação do Premiação ([../../API.md](../../API.md)): o PED só compartilha com ele o login (tabela de usuários/colaboradores) e o cadastro mestre de filiais. Arquitetura, decisões e pendências do PED estão em [PED.md](PED.md).

## Base e autenticação

- Base URL: a mesma do Premiação (`http://192.168.7.18:8080/api` em produção). As rotas do PED estão publicadas no servidor desde 2026-10-30.
- Login: o mesmo do Premiação, `POST /api/valida-usuario`, que devolve o token Sanctum. Todas as rotas abaixo exigem `Authorization: Bearer {token}`. Sem token: `401`.
- Todas as respostas são JSON. Erros trazem `{"mensagem": "..."}`.

## Convenções

- Filtros na query string usam underscore (`mes_de_referencia`), porque o PHP converte espaço em `_` nos parâmetros de URL.
- Chaves das respostas seguem o padrão do projeto, em português e com espaço (`"mes de referencia"`, `"nome filial"`).
- `mes_de_referencia` aceita qualquer data (ex: `2026-10-15`) e é normalizada para o primeiro dia do mês. Se omitido, usa o mês atual.

## Escopo por filial

Vale para os endpoints `/api/ped/*` (RF-01):

- **Admin e Validador (perfil do PED)** podem informar `?filial=<código>`, `?filial=todas` ou omitir o parâmetro (as duas últimas formas trazem todas as filiais).
- **Demais perfis** veem a própria filial **mais as da abrangência** (cadastrada por `PUT /api/ped/usuarios/{id}/acesso`). Sem `?filial=`, trazem todas essas; com `?filial=` dentro delas, só aquela; fora delas, `403` (`"voce nao tem acesso a esta filial"`).
- Usuário **sem filial e sem abrangência** não vê nada (listas vazias).

---

## GET /api/ped/indicadores

Lista os indicadores ativos do PED, na ordem de exibição.

Resposta `200`:

```json
[
  { "indicador": "novos_clientes", "nome": "Atingimento meta novos clientes", "unidade": "quantidade" },
  { "indicador": "produtos_parados", "nome": "Produtos parados no estoque", "unidade": "percentual" }
]
```

`unidade` é `quantidade`, `percentual`, `volume`, `valor` ou `media`.

## GET /api/ped/filiais

Lista as filiais que o usuário pode consultar (para o seletor de filial). Admin e Validador: todas; demais: a própria mais a abrangência.

Resposta `200`:

```json
[
  { "filial": "100", "nome filial": "Filial 100", "empresa": "1" }
]
```

`empresa` é o código da empresa no ERP (`filiais.codigo_empresa`).

## GET /api/ped/dados-externos

Valores dos indicadores que vêm de fontes externas (hoje, os relatórios do ERP), por filial, num mês.

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `mes_de_referencia` | não | Qualquer data do mês desejado. Padrão: mês atual. |
| `filial` | não | Código da filial (`todas` ou omitido = todas as que o usuário pode ver). Fora da abrangência: `403`. |
| `indicador` | não | Código do indicador (ver tabela abaixo) para trazer só ele. |

Resposta `200`:

```json
{
  "mes de referencia": "2026-10-01",
  "dados": [
    {
      "filial": "100",
      "nome filial": "Filial 100",
      "empresa": "1",
      "indicadores": [
        {
          "indicador": "produtos_parados",
          "nome": "Produtos parados no estoque",
          "unidade": "percentual",
          "valor": 4.52,
          "numerador": 350327.55,
          "denominador": 7753324.04,
          "meta": null,
          "atingimento": null,
          "tipo": "erp",
          "atualizado em": "2026-10-19 09:58:19"
        }
      ]
    }
  ]
}
```

Como ler:

- `valor` é o número do indicador. Para percentuais e médias, `numerador` e `denominador` trazem as duas partes (`valor = numerador / denominador * 100` nos percentuais); nos demais indicadores ficam `null`.
- `valor financeiro`, `meta financeira` e `atingimento financeiro` só vêm nos seis `volume_*` (nos demais ficam `null`; no `faturamento` o próprio `valor` já é R$). São a venda líquida em R$ da marca, a meta de valor da marca e o atingimento em R$ (`valor financeiro ÷ meta financeira × 100`). O `valor`/`meta`/`atingimento` desses indicadores seguem em volume. O atingimento em volume e o em R$ são diferentes (preço médio e mix mudam), então o front deve rotular qual está mostrando. Filial sem meta de valor vem com `meta financeira: 0` e `atingimento financeiro: null`.
- `meta` e `atingimento` só vêm preenchidos em `faturamento` e nos seis `volume_*` (nos outros indicadores ficam `null`). `meta` é a meta do mês da filial no ERP, na mesma unidade do `valor` (R$ no faturamento, volume nos `volume_*`). `atingimento` = `valor ÷ meta × 100`, em %, arredondado em 2 casas (pode passar de 100). Quando a filial não tem meta cadastrada para aquele indicador, `meta` vem `0` e `atingimento` vem `null`: mostrar "sem meta", e não 0% nem erro.
- `tipo` é a fonte do dado: `erp` hoje; `drg` e `manual` virão depois.
- `atualizado em` é quando o valor foi gravado/alterado pela última vez no PED.
- Um indicador **sem dado no mês simplesmente não aparece** em `indicadores`. O front deve tratar a ausência como "sem dado".
- Com uma filial específica (com `?filial=100`), a filial **sempre aparece** na resposta, com `indicadores: []` quando não há dado no mês.
- Com todas as filiais, só aparecem as que têm algum dado no mês; `dados` pode vir vazio.
- Ordem: filiais por código, indicadores na ordem de `GET /api/ped/indicadores`.

Erros:

| Status | Quando |
|---|---|
| `400` | `indicador` inexistente ou `mes_de_referencia` que não é data. |
| `403` | `filial` fora do que o usuário pode ver (`"voce nao tem acesso a esta filial"`). |
| `404` | `filial` que não existe (`"filial nao encontrada"`). |
| `500` | Erro inesperado (`mensagem` com o motivo). |

## POST /api/ped/sincronizar-erp

Só **Admin** (`403` para os demais). Consulta o ERP (Senior) e atualiza os dados. Corpo opcional: `{"mes de referencia": "2026-10-01"}`.

> **Atenção:** a rota roda os 5 relatórios na própria requisição. A sincronização completa leva vários minutos, e o limite de tempo do PHP/Apache deve derrubar a requisição antes do fim. Enquanto isso não virar um job em segundo plano, a atualização é feita pelo comando `php artisan ped:sincronizar-erp`, agendado todo dia às 06:00 (fuso America/Campo_Grande; no relógio do servidor, 07:00). O front **não** deve depender desta rota.

Resposta `200` (os números abaixo são ilustrativos; mostram só o formato):

```json
{
  "mensagem": "sincronizacao concluida",
  "mes de referencia": "2026-10-01",
  "novos clientes": 21,
  "cobertura": 18,
  "produto pdv": 15,
  "volume venda consolidado": 147,
  "produtos parados": 21,
  "dados externos": 70
}
```

Cada número é a quantidade de linhas gravadas por relatório; `dados externos` é o total de valores de indicador consolidados.

---

## Indicadores liberados para o front (atualizado em 2026-10-23)

Liberados: **todos os 11 indicadores** — **`produto_pdv`**, **`cobertura`**, **`novos_clientes`**, **`faturamento`**, os seis **`volume_*`** (`volume_mann`, `volume_tecfil`, `volume_ipiranga`, `volume_texaco`, `volume_premium`, `volume_moto`) e **`produtos_parados`**. Os três primeiros foram conferidos com os relatórios do ERP de setembro/2026; `faturamento` e `volume_*` foram conferidos com o relatório `RFNF200` de agosto/2026; `produtos_parados` foi validado pelo negócio no ambiente de homologação do Senior (base parada, onde o web service e o relatório podem ser comparados exatamente).

Chamadas (todas `GET`, com `Authorization: Bearer {token}`):

| Para quê | Requisição |
|---|---|
| Seletor de filial | `/api/ped/filiais` |
| Um indicador, todas as filiais (Admin) | `/api/ped/dados-externos?mes_de_referencia=2026-09-01&indicador=cobertura` |
| Um indicador, uma filial | `/api/ped/dados-externos?mes_de_referencia=2026-09-01&filial=100&indicador=novos_clientes` |
| Todos de uma filial | uma chamada **sem** `indicador` (o filtro `indicador` aceita um código por vez) |

Como cada indicador deve ser lido:

| `indicador` | `unidade` | `valor` | `numerador` / `denominador` |
|---|---|---|---|
| `produto_pdv` | `media` | Média de produtos por cliente (a "Média" do relatório). Empresas 1 e 6: linha "Total da Unidade PDV"; empresas 7, 8 e 9: linha "Total da Unidade Total" (o front não precisa diferenciar, o `valor` já vem certo). | `numerador` = produtos, `denominador` = clientes (da mesma linha) |
| `cobertura` | `percentual` | "% realizada" da "Performance da Unidade": clientes com venda ÷ clientes cadastrados × 100. | `numerador` = clientes com venda, `denominador` = clientes cadastrados |
| `novos_clientes` | `quantidade` | Clientes cadastrados no mês **com faturamento líquido mínimo de R$ 1.500 no mesmo mês**. Filial sem nenhum cliente nessa condição vem com `0`. | `null` |
| `faturamento` | `valor` | Venda líquida em R$ da filial no mês: vendas + serviços − devoluções, sem as saídas não comissionadas (`RFNF200` sem meta, "Considerar Serviço = Sim"). `meta` = meta de valor (R$) da filial no mês. | `null` |
| `volume_mann`, `volume_tecfil`, `volume_ipiranga`, `volume_texaco`, `volume_premium`, `volume_moto` | `volume` | Volume líquido (vendas − devoluções) dos produtos da meta: `MANN` marca 0001, `TECFI` marca 0002, `IPIR` marca 0003, `TEXA` marca 0197, `MOTO` família 0006, `PREMI` agrupamento `PREMI`. Sem serviços. Mesma unidade do `RFNF200`. `meta` = meta de volume da filial para aquele produto no mês. | `null` |
| `produtos_parados` | `percentual` | Custo do estoque parado ÷ custo total do estoque × 100 (`SECE160`). "Parado" = produto sem movimentação há 180 dias, valorizado pelo custo da tabela de preço da filial. | `numerador` = custo parado (R$), `denominador` = custo total (R$) |

Exemplo real (filial 100, setembro/2026), com três indicadores no mesmo objeto:

```json
{
  "mes de referencia": "2026-09-01",
  "dados": [
    {
      "filial": "100",
      "nome filial": "Filial 100",
      "empresa": "1",
      "indicadores": [
        { "indicador": "novos_clientes", "nome": "Atingimento meta novos clientes", "unidade": "quantidade", "valor": 8, "numerador": null, "denominador": null, "meta": null, "atingimento": null, "tipo": "erp", "atualizado em": "2026-10-20 13:45:41" },
        { "indicador": "produto_pdv", "nome": "Produto por PDV", "unidade": "media", "valor": 2.64, "numerador": 1418, "denominador": 537, "meta": null, "atingimento": null, "tipo": "erp", "atualizado em": "2026-10-21 12:30:19" },
        { "indicador": "cobertura", "nome": "Percentual de cobertura", "unidade": "percentual", "valor": 37.78, "numerador": 677, "denominador": 1792, "meta": null, "atingimento": null, "tipo": "erp", "atualizado em": "2026-10-20 10:06:18" }
      ]
    }
  ]
}
```

Exemplo real de `faturamento` e `volume_mann` (filial 100, setembro/2026), já com meta e atingimento:

```json
{ "indicador": "faturamento", "nome": "Atingimento meta faturamento", "unidade": "valor", "valor": 5260660.72, "numerador": null, "denominador": null, "meta": 4600000, "atingimento": 114.36, "tipo": "erp", "atualizado em": "2026-10-27 14:17:26" },
{ "indicador": "volume_mann", "nome": "Atingimento meta filtros Mann", "unidade": "volume", "valor": 5449, "numerador": null, "denominador": null, "meta": 5223, "atingimento": 104.33, "valor financeiro": 299977.47, "meta financeira": 281000, "atingimento financeiro": 106.75, "tipo": "erp", "atualizado em": "2026-10-27 15:06:35" }
```

Pontos de atenção para o front:

- **`produtos_parados` é uma foto do momento da sincronização, não do mês:** o ERP não recebe período, devolve o estoque parado de **agora** e o serviço grava no mês de referência informado. O campo `atualizado em` mostra quando a foto foi tirada. Por isso só o mês corrente tem dado: outubro/2026 (sincronizado em 23/10). Agosto e setembro não têm `produtos_parados` (o valor que setembro tinha era uma foto de 20/10 feita com a regra antiga e foi apagado em 23/10). Em produção há vendas o tempo todo, então o valor muda de uma sincronização para outra e dificilmente é igual ao de um relatório gerado em outro horário.
- **Metas e atingimento (liberados em 27/10/2026):** `faturamento` e `volume_*` trazem `meta` e `atingimento` (ver "Como ler"). Filial sem meta cadastrada (ex.: filial 600 em `volume_mann`) vem com `meta: 0` e `atingimento: null`. Valem para agosto, setembro e outubro/2026. O `faturamento` usa a meta de valor e os `volume_*` usam a meta de volume; a meta em branco não tem volume cadastrado. Os demais indicadores (`novos_clientes`, `produto_pdv`, `cobertura`, `produtos_parados`) ainda não têm meta: ficam `null`. Os números de meta vieram direto do ERP e ainda não foram conferidos contra nenhum relatório.
- **Cobertura:** as filiais 700, 800 e 900 não têm cobertura (o relatório do ERP também não as traz); o indicador simplesmente não aparece nelas. A 701 vem com `valor` 0 (1 cliente cadastrado, nenhuma venda).
- **Mês em andamento:** os valores do mês corrente mudam a cada sincronização. Só meses fechados e conferidos com o relatório do ERP são definitivos: hoje, `produto_pdv`, `cobertura` e `novos_clientes` em setembro/2026 e `faturamento` e `volume_*` em agosto/2026. Os demais meses estão sincronizados, mas não foram comparados com relatório.
- **Atualização dos dados:** vem da sincronização com o ERP, que roda sozinha todo dia às 06:00 (fuso America/Campo_Grande) no mês corrente. Meses anteriores só são carregados à mão (`php artisan ped:sincronizar-erp --mes=AAAA-MM-01`).

## Indicadores disponíveis

| `indicador` | Nome | `unidade` | Como o valor é calculado |
|---|---|---|---|
| `novos_clientes` | Atingimento meta novos clientes | `quantidade` | Clientes cadastrados no mês **com faturamento líquido mínimo de R$ 1.500 no mesmo mês**, na filial (filial sem nenhum cliente nessa condição vem com 0) |
| `produtos_parados` | Produtos parados no estoque | `percentual` | Custo parado ÷ custo total × 100 (`numerador` e `denominador` em R$) |
| `volume_mann` | Atingimento meta filtros Mann | `volume` | Volume líquido da meta MANN |
| `volume_tecfil` | Atingimento meta Tecfil | `volume` | Volume líquido da meta TECFI |
| `faturamento` | Atingimento meta faturamento | `valor` | Vendas líquidas (R$) |
| `volume_ipiranga` | Atingimento meta litragem Ipiranga | `volume` | Volume líquido da meta IPIR |
| `volume_texaco` | Atingimento meta litragem Texaco | `volume` | Volume líquido da meta TEXA |
| `volume_premium` | Atingimento meta mix premium | `volume` | Volume líquido da meta PREMI |
| `volume_moto` | Atingimento meta moto | `volume` | Volume líquido da meta MOTO |
| `produto_pdv` | Produto por PDV | `media` | Média de produtos por cliente: "Total da Unidade PDV" nas empresas 1 e 6, "Total da Unidade Total" nas 7, 8 e 9 (`numerador` = produtos, `denominador` = clientes) |
| `cobertura` | Percentual de cobertura | `percentual` | Vendas ÷ cadastro × 100 (`numerador` = clientes com venda, `denominador` = cadastro) |

## Estado atual dos dados

Em 2026-10-23 foi feita uma ressincronização com o ERP para agosto, setembro e outubro/2026: os 11 indicadores têm dados nos três meses (`cobertura` com 18 filiais; `produtos_parados` só em outubro, porque o `ProPar` não recebe período). Os seis `volume_*` e o `faturamento` foram corrigidos no Senior e **conferidos com o relatório `RFNF200` de agosto/2026** (21 filiais, todas as metas). `produtos_parados` foi validado pelo negócio na homologação do Senior (ver [PED.md](PED.md#pendências-conhecidas), item 2).

Em 2026-10-30 o servidor de produção também recebeu agosto e setembro/2026 (207 valores por mês nas 21 filiais, sem `produtos_parados`) e outubro/2026 (228 valores). Os endpoints de apontamentos, dados externos cadastrados, indicadores, faixas, dashboards e fechamentos estão descritos nas seções abaixo.

## Cadastro e Preenchimento — fase 1 (2026-10-28)

Base do sistema descrito em [REQUISITOS-CADASTRO-PREENCHIMENTO.md](REQUISITOS-CADASTRO-PREENCHIMENTO.md): perfil de acesso, tipos de apontamento e período aberto. Mesmo Bearer token dos demais endpoints; erros de validação voltam `400` com `mensagem`, falta de permissão `403`.

**Perfis (P-01, provisório).** O perfil vem de `colaboradores.ped_perfil` (`admin`, `validador` ou `preenchedor`). Sem `ped_perfil`, valem os papéis de `colaboradores.role`: `admin`, `validador` e `preenchedor` (cadastráveis em `POST/PUT /api/usuarios`, campo `role`). O `ped_perfil` — definido pelo grupo no ERP ou à mão — sempre vence o `role`. Qualquer outro sem perfil não tem acesso (`403` nos endpoints abaixo, exceto `GET /api/ped/acesso`, que responde `"perfil": null`). O Preenchedor só enxerga os tipos vinculados a ele **ou a algum grupo dele** (ver abaixo).

**Perfil e grupos do ERP (decisão de 2026-11-03, provisória).** A rotina `php artisan ped:sincronizar-usuarios-erp` lê no ERP os grupos e a abrangência de cada usuário (casando `colaboradores.usuario` com o login do ERP) e define o perfil pelo grupo: `SENIOR` → Admin, `DEF_ANALISTA DE DESENVOLVIMENTO` → Validador, `DEF_OPERADOR DE CAIXA` → Preenchedor (vence o mais alto). O mapa fica em `config/ped.php`. Usuário sem nenhum desses grupos mantém o `ped_perfil` que já tinha. A rotina diária (05:30) só roda com `PED_USUARIOS_ERP_ATIVO=true`; antes disso, rodar `--simular`, que não grava nada.

### GET /api/ped/acesso

Perfil, tipos, filiais de acesso e período aberto do usuário logado (para montar o cabeçalho, RF-01/RF-02).

```json
{
  "id colaborador": 12, "nome": "Fulano", "perfil": "preenchedor",
  "tipos": [{ "id": 1, "nome": "Comercial" }],
  "todas as filiais": false,
  "filiais": [{ "filial": "101", "nome filial": "CAMPO GRANDE" }],
  "periodo aberto": "2026-10-01"
}
```

### GET /api/ped/grupos — Admin e Validador

Grupos do ERP conhecidos pelo PED (lidos pela rotina `ped:sincronizar-usuarios-erp`), para vincular a tipos de apontamento: `id`, `nome`, `quantidade usuarios` e `tipos` vinculados. Filtro opcional `?busca=`.

### GET /api/ped/usuarios — só Admin

Colaboradores ativos com perfil, tipos e `abrangencia` (códigos das filiais extras) no PED, em ordem alfabética. Filtro opcional `?perfil=admin|validador|preenchedor|nenhum`.

### PUT /api/ped/usuarios/{id}/acesso — só Admin

Corpo (os campos são opcionais): `{ "perfil": "validador", "tipos": [1, 3], "filiais": ["101", "200"] }`. `GET /api/ped/usuarios` também traz `grupos` (do ERP). A abrangência cadastrada aqui é "manual" e não é apagada pela sincronização com o ERP, que só refaz as linhas de origem "erp". `"perfil": null` remove o acesso. `tipos` e `filiais` (abrangência, além da filial própria; Admin e Validador veem todas) substituem a lista inteira; `[]` limpa. A troca de tipos e de abrangência não gera linha na auditoria (limitação do `sync()`); a de perfil gera.

### Tipos de apontamento

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/tipos-apontamento` | qualquer perfil do PED | Lista `id`, `nome`, `origem` (`Fixo`/`Personalizado`), `quantidade usuarios`, `quantidade apontamentos` e, só para Admin e Validador, `usuarios` e `grupos` (`id`, `nome`). O Preenchedor vê só os seus (vínculo direto ou por grupo). |
| `POST /api/ped/tipos-apontamento` | Admin e Validador | `{ "nome": "...", "grupos": [ids], "usuarios": [ids] }` — nome único sem diferenciar maiúsculas, ao menos um grupo ou usuário. |
| `PUT /api/ped/tipos-apontamento/{id}` | Admin e Validador | `{ "grupos": [ids], "usuarios": [ids] }` — troca só a lista enviada (a outra fica como está). Vale para tipo fixo ou personalizado; o nome não muda. |
| `DELETE /api/ped/tipos-apontamento/{id}` | Admin e Validador | Só tipo personalizado e sem apontamentos. |

Os 7 tipos fixos (Comercial, Financeiro, Recursos Humanos, Tecnologia da Informação, Fiscal, Processos, Contabilidade) nascem na migration e não podem ser excluídos.

### Período aberto

Existe um único mês aberto para preenchimento, comum a todas as filiais.

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/periodo` | qualquer perfil do PED | `{ "mes de referencia": "2026-10-01", "aberto por": "...", "aberto em": "..." }` |
| `GET /api/ped/periodo/historico` | qualquer perfil do PED | Aberturas, da mais recente para a mais antiga. Cada linha traz `reaberto` (o mês foi reaberto). |
| `POST /api/ped/periodo/abrir` | Admin | `{ "mes de referencia": "2026-11-01" }` — qualquer dia do mês serve. Abre um mês novo ou **reabre um mês passado** (o mês aberto passa a ser o último aberto; o anterior fecha para preenchimento). Recusa o mês que já é o aberto (`400`) e mês futuro (`400`). A resposta traz `"periodo reaberto"` ou `"periodo aberto"`. |

O período inicial é o mês corrente, criado pela migration.

## Cadastro e Preenchimento — fase 2: apontamentos e preenchimento (2026-10-28)

Mesmo Bearer token e mesmas convenções da fase 1. Um **apontamento** é uma informação lançada à mão, uma vez por mês de competência e filial; o valor vale para todos os dashboards que o usam. Os campos `indicadores`, `dashboards` e `imagens congeladas` já existem nas respostas, mas vêm vazios até as fases 4, 6 e 7.

### Apontamentos

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/apontamentos` | qualquer perfil do PED | Lista os apontamentos dos tipos do usuário (Admin e Validador veem todos). Filtros: `busca` (nome, tipo, descrição ou tipo de valor, sem diferenciar acento nem maiúscula), `situacao` (`todas`, `ativos`, `inativos`, `problemas`) e `tipo` (id). |
| `POST /api/ped/apontamentos` | qualquer perfil do PED | Cadastra. O apontamento nasce ativo. O Preenchedor só cadastra em tipo dele (`403` nos outros). |
| `PUT /api/ped/apontamentos/{id}/situacao` | Admin e Validador | `{ "ativo": false }` — qualquer apontamento. Grava quem alterou e quando. Desativado, sai do Preenchimento; lançamentos já feitos são mantidos. |
| `DELETE /api/ped/apontamentos/{id}` | Admin | Definitivo; apaga também lançamentos e histórico. Recusa (`400`, listando os indicadores) se o apontamento compõe indicador (valendo a partir da fase 4). |

Não há edição de apontamento depois de salvo.

Cadastro: `{ "nome": "...", "id tipo": 1, "tipo de valor": "numeral", "descricao": "..." }`. `tipo de valor` aceita `porcentagem`, `numeral` ou `booleano` (qualquer caixa).

A resposta de `GET` é `{ "apontamentos": [...], "contagem por tipo": [{ "id", "nome", "quantidade" }] }`; a contagem considera a busca e a situação, mas não o filtro de tipo. Cada apontamento traz `id`, `nome`, `descricao`, `ativo`, `id tipo`, `tipo`, `tipo de valor` (`Porcentagem`, `Numeral` ou `Booleano`), `indicadores`, `vinculado a dashboard`, `desativado mas usado em indicador ativo`, `cadastrado em/por` e `situacao alterada em/por`. O filtro `problemas` fica vazio até a fase 4.

### Preenchimento

O preenchimento exige uma filial. O Admin informa `filial=<código>` (`todas` não vale: `400`); os demais perfis usam sempre a própria filial e o parâmetro é ignorado. Só o **mês aberto** (ver `GET /api/ped/periodo`) aceita lançamento e correção; os outros meses são só consulta. Mês futuro ou anterior a 2000 dá `400`.

| Método e rota | O que faz |
| --- | --- |
| `GET /api/ped/preenchimento/meses?ano=2026&filial=` | Os 12 meses do ano: `situacao` (`aberto`, `fechado` ou `futuro`) e, no mês aberto, `pendentes`. Ano de 2000 até o atual. |
| `GET /api/ped/preenchimento?filial=&mes_de_referencia=2026-10&busca=` | A tela do mês (o padrão é o mês aberto). |
| `PUT /api/ped/preenchimento` | Lança ou corrige em lote. |
| `GET /api/ped/apontamentos/{id}/historico?filial=&mes_de_referencia=` | Lançamento e correções do apontamento naquela filial e mês, do mais recente para o mais antigo. |

`GET /api/ped/preenchimento` devolve `filial`, `nome filial`, `mes de referencia`, `situacao do mes` (`aberto`/`fechado`), `editavel`, `periodo aberto`, `aberto por`, `aberto em`, `progresso` (`preenchidos` e `total`, dos apontamentos ativos do usuário) e `tipos` — cada tipo do usuário com `quantidade` e `apontamentos`. Cada apontamento tem `situacao` (`Pendente` e `Nao lancado` quando não há valor, no mês aberto e nos fechados; `Preenchido`; `Corrigido`) e `valor` (número; `true`/`false` no booleano; `null` sem lançamento). A `busca` procura em todos os tipos do usuário.

`PUT /api/ped/preenchimento`:

```json
{
  "filial": "101",
  "mes de referencia": "2026-10-01",
  "itens": [
    { "id apontamento": 5, "valor": "1.234,56" },
    { "id apontamento": 7, "valor": "sim" },
    { "id apontamento": 9, "valor": 80, "motivo": "digitação errada" }
  ]
}
```

- `filial` só é lida para o Admin. `mes de referencia` precisa ser o mês aberto (qualquer dia do mês serve).
- **Valor:** numeral e porcentagem aceitam número ou texto com vírgula decimal (`1.234,56`), não negativo; booleano aceita `true`/`false`, `1`/`0`, `sim`/`nao`.
- **Lançamento:** primeira vez do apontamento naquela filial e mês. **Correção:** quando já existe valor; exige valor **diferente** do atual e `motivo`.
- **Tudo ou nada:** se um item for recusado, nenhum do lote é gravado. Erros: `400` (valor, motivo, mês fechado, apontamento desativado, mesmo apontamento repetido no lote), `403` (apontamento de tipo que o usuário não acessa).
- Resposta: `{ "mensagem": "preenchimento salvo", "lancados": 2, "corrigidos": 1 }`.

O histórico (`acao` = `lancamento` ou `correcao`, `valor anterior`, `valor novo`, `usuario`, `motivo`, `data`) não pode ser editado nem apagado pela API. Lançamentos e apontamentos entram na auditoria.

## Cadastro e Preenchimento — fase 3: dados externos (2026-10-28)

Um **dado externo** é a definição de uma informação coletada pelo backend nos web services (Senior ERP e outros): de onde vem, como é coletada e como entra no cálculo. O cadastro **não guarda valores**: os valores continuam em `ped_dados_externos` (a leitura em `GET /api/ped/dados-externos`, descrita acima, não mudou) e o `identificador` do cadastro aponta para o código da coleta (`GET /api/ped/indicadores`, sem diferenciar maiúsculas; ex.: `FATURAMENTO` → `faturamento`).

**Referência.** O cadastro aceita `filial`, `colaborador` e `zona` (RF-25). Só `filial` tem coleta hoje: nas outras o dado é cadastrado normalmente, mas `coleta disponivel` vem `false` e o realizado (`.../realizado`) vem com `valor: null` até a TI criar a fonte. O front pode mostrar as três opções habilitadas. Outro valor de `referencia` devolve `400`. Quando houver coleta por colaborador ou zona de venda, o cálculo do realizado ganha um ramo no `PedDadoExternoService`.

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/dados-externos-cadastro` | qualquer perfil do PED | Lista os dados dos tipos do usuário. Filtros: `busca` (nome, origem, identificador, campo/cálculo, tipo ou referência) e `situacao` (`todas`, `ativos`, `inativos`, `construcao`, `problemas`). |
| `GET /api/ped/dados-externos-cadastro/identificadores` | Admin e Validador | As coletas existentes que um identificador pode apontar, com quantos dados já usam cada uma. |
| `POST /api/ped/dados-externos-cadastro` | todos | Admin: cadastra já **ativo**, com identificador obrigatório. Validador e Preenchedor: **pedem a construção à TI** (nasce `em_construcao`, sem identificador, e gera uma tarefa). |
| `PUT /api/ped/dados-externos-cadastro/{id}/concluir` | Admin | Conclui a construção e ativa o dado. **Desde 2026-11-09 exige a integração completa**: `identificador`, `url`, `parametros de saida` e `parametros de entrada` (ver "Integração do dado externo"). |
| `PUT /api/ped/dados-externos-cadastro/{id}/integracao` | Admin | Botão **Configurações**: mesmos 4 campos, só para dado `ativo`/`inativo`. Não muda a situação nem cria indicador. |
| `GET /api/ped/dados-externos-cadastro/integracoes-pendentes` | Admin | `{ quantidade, dados: [{ id, nome, identificador, situacao }] }` — ativos/inativos sem integração (alerta para a TI). |
| `GET /api/ped/integracao/variaveis` | Admin | As variáveis aceitas no JSON de entrada, com `variavel`, `nome`, `tipo` (`numero`/`texto`/`data`), `descricao` e `exemplo`. |
| `POST /api/ped/integracao/validar` | Admin | Valida sem gravar, para o feedback em tempo real. Corpo: `parametros de saida` e/ou `parametros de entrada` (texto ou objeto; campo vazio volta `null`). |
| `PUT /api/ped/dados-externos-cadastro/{id}/situacao` | Admin e Validador | `{ "ativo": false }` — ativa ou desativa (grava quem e quando). Dado em construção só muda pela conclusão. |
| `DELETE /api/ped/dados-externos-cadastro/{id}` | Admin | Recusa (`400`) se o dado compõe indicador (valendo a partir da fase 4). |
| `GET /api/ped/dados-externos-cadastro/{id}/realizado?filial=&mes_de_referencia=` | qualquer perfil (Preenchedor só os dos seus tipos) | Realizado do dado na filial e mês (RN-05). Admin informa a `filial`; os demais usam a própria. |

Não há edição do cadastro depois de salvo (a integração, abaixo, é a exceção: o Admin a altera em **Configurações**).

#### Integração do dado externo (2026-11-09)

A TI registra **como chamar a fonte** do dado (web service ou outra) e **o que ela devolve**. Só Admin grava e só Admin recebe estes campos na listagem (`GET .../dados-externos-cadastro`): `url`, `parametros de saida`, `parametros de entrada` (objetos JSON), `variaveis usadas`, `integracao pendente` (`true` quando ativo/inativo sem URL), `integracao alterada em` e `integracao alterada por`. Validador e Preenchedor não os veem. A busca da listagem também acha pela URL, e `situacao=integracao_pendente` filtra os pendentes.

Corpo de `concluir` e de `integracao` (todos obrigatórios; `parametros de ...` aceitam texto JSON ou objeto):

```json
{
  "identificador": "VOLUME_MANN",
  "url": "https://ti.exemplo.com.br/api/consulta",
  "parametros de saida": "{ \"valor\": \"0\", \"referencia\": \"x\" }",
  "parametros de entrada": { "filial": "%filial%", "inicio": "%dataInicial% - 3m", "fim": "%dataFinal%" }
}
```

- `identificador`: como antes (letras sem acento, números, `_`, `-`, `.`), gravado em maiúsculas.
- `url`: começa com `http://` ou `https://`, sem espaços (até 500 caracteres). O método HTTP e os cabeçalhos não são informados.
- Os dois JSONs precisam ser objeto `{ }` ou lista `[ ]` válidos. Quando inválido, o erro traz `mensagem` em português, `linha` e `coluna`.
- **Variáveis** (`%nome%`, resolvidas na hora da consulta): `%filial%` (número), `%colaborador%` (texto), `%zona%` (texto), `%mes%` (número), `%ano%` (número), `%competencia%` (texto MM/AAAA), `%dataInicial%`, `%dataFinal%`, `%hoje%` (datas), `%diaColeta%` e `%mesesRetro%` (números). A lista oficial vem de `GET /api/ped/integracao/variaveis`.
- **Expressões** em valores de texto do JSON de entrada: `+ - * / ^`, parênteses e sinal negativo; ordem: parênteses, potência, `*` e `/`, depois `+` e `-`. Números com vírgula ou ponto. Datas: `data ± número` soma/subtrai dias, com sufixo `m` são meses e `a` anos (`31/01/2026 + 1m` = `28/02/2026`, vale o último dia do mês); `data − data` dá dias. Resultados numéricos saem com vírgula (`252,5`) e datas como `dd/mm/aaaa`.
- **Não viram conta**: um valor sozinho (número, data, variável), `mm/aaaa`, `aaaa-mm-dd` e textos com letras (`"Filial-%filial%"`, que só recebe a troca das variáveis). Atenção: `%mes%/%ano%` é uma divisão; para MM/AAAA use `%competencia%`.
- **Erros apontados** (cada um com `campo`/`caminho` e `expressao`): JSON mal formado, variável desconhecida, variável de texto em conta, parêntese não fechado ou sobrando, operador repetido ou fora de lugar, expressão incompleta, divisão por zero, soma de duas datas, data multiplicada/dividida/elevada, data subtraída de número, unidade `m`/`a` sem data, data inexistente.

Respostas de erro (`400`): `{ "mensagem": "integracao invalida: ...", "erros": [{ "campo": "parametros de entrada", "caminho": "inicio", "expressao": "...", "mensagem": "..." }] }`. Em `concluir`, a ordem das checagens é: dado existe (`404`), está em construção (`400`) e só então a validação dos campos.

`POST /api/ped/integracao/validar` devolve, para cada JSON enviado: saída `{ valido, campos: [{ campo, tipo }] }` ou `{ valido: false, erro: { mensagem, linha, coluna } }`; entrada `{ valido, "variaveis usadas", calculos: [{ campo, expressao, resultado }], previa }` ou `{ valido: false, erros: [...] }`. A prévia usa o período 10/2026, filial 100 e 3 meses retroativos; `%hoje%` é a data atual.

Dado cadastrado antes desta mudança fica com a integração **pendente** até a TI preencher; ela não impede a coleta atual, só sinaliza.

Cadastro:

```json
{
  "nome": "Faturamento líquido",
  "id tipo": 1,
  "sistema de origem": "senior_erp",
  "tipo de valor": "numeral",
  "referencia": "filial",
  "coleta": "dia do mes",
  "dia da coleta": 15,
  "sentido do calculo": "soma",
  "janela retroativa": 3,
  "comentarios": "obrigatório se a origem for outro",
  "campo calculo": "obrigatório para Validador e Preenchedor",
  "identificador": "FATURAMENTO",
  "observacao": "só entra na tarefa da TI"
}
```

- `sistema de origem`: `senior_erp`, `senior_hcm`, `bitrix24` ou `outro` (`comentarios` obrigatório). `tipo de valor`: `porcentagem`, `numeral` ou `booleano`.
- `coleta`: `diaria` ou `dia do mes` (com `dia da coleta` de 1 a 31). Hoje isso fica só registrado: a sincronização com o ERP continua rodando todo dia às 06:00 para todos os indicadores.
- `sentido do calculo`: `soma`, `media` ou `ultimo`. `janela retroativa` (meses): `1` (só o mês, padrão), `2`, `3`, `6`, `12` ou `24`; é ignorada e fica nula quando o sentido é `ultimo`.
- `identificador`: obrigatório para o Admin (gravado em maiúsculas; letras, números, `_`, `-` e `.`). Enviado por Validador ou Preenchedor, é ignorado.
- `id tipo`: o Preenchedor só cadastra em tipo dele (`403` nos outros).

Cada dado da listagem traz: `id`, `nome`, `id tipo`, `tipo`, `situacao` (`ativo`, `inativo`, `em_construcao`) e `situacao descricao`, `tarefa bitrix` (`id`, `status`, `titulo`, ou `null`), `sistema de origem` (+ `descricao`), `identificador` (`null` = "a definir pela TI"), `campo calculo`, `referencia`, `coleta`, `dia da coleta`, `coleta descricao`, `sentido do calculo`, `janela retroativa`, `comentarios`, `tipo de valor`, `coleta disponivel` (o identificador tem coleta cadastrada), `indicadores` (vazio até a fase 4) e os dados de cadastro e de mudança de situação.

**Tarefa para a TI.** Ao pedir a construção, o sistema monta o título (`[PED] Construir dado externo: <nome>`) e a descrição (origem e comentário, campo ou cálculo, referência, coleta, janela retroativa, tipo de valor, tipo de apontamento, solicitante e observação) e a devolve na resposta (`tarefa`). Ela é registrada com `status = aguardando_envio` (responsável "Equipe de TI") e enviada ao Bitrix24 pela rotina `ped:enviar-tarefas-bitrix` (ver "Tarefas no Bitrix24" abaixo); depois do envio o `status` passa a `enviada` e `tarefa bitrix.id` traz o número da tarefa no Bitrix.

**Realizado (RN-05).** Resposta de `.../realizado`: `valor`, `meses considerados` (`mes` e `valor` de cada mês usado), `janela retroativa`, `sentido do calculo` e `coleta disponivel`.
- `soma` e `media` usam o mês de referência e os anteriores até completar a janela, **só os meses que têm valor**: a média divide pelos meses existentes.
- `ultimo` usa só o valor do próprio mês.
- O resultado é arredondado em 2 casas. `valor` vem `null` quando não há nenhum valor no período ou quando o identificador ainda não tem coleta.

## Cadastro e Preenchimento — fase 4: indicadores e metas (2026-10-28)

Um **indicador** é uma medida avaliada contra uma meta. É composto por **um ou mais apontamentos ativos** *ou* por **exatamente um dado externo ativo**, nunca pelos dois. Não confundir com `GET /api/ped/indicadores`, que é o catálogo de coleta do ERP; o cadastro está em `/api/ped/indicadores-cadastro`.

**Acesso (P-04, provisório).** Admin e Validador fazem tudo na aba Indicadores; o Preenchedor não acessa a aba (`403`), mas ajusta metas no preenchimento (abaixo). **Meta (P-15).** Só meta digitada à mão: `"origem da meta": "terceiro"` responde `400`. A meta vinda do ERP (`metVlr`/`metVol`) fica para uma fase futura.

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/indicadores-cadastro` | Admin e Validador | Lista os indicadores. Filtros: `busca` (indicador, apontamento ou dado externo) e `situacao` (`todas`, `ativos`, `inativos`, `meta`, `problemas`). Devolve `indicadores` e `alertas`. |
| `POST /api/ped/indicadores-cadastro` | Admin e Validador | Cadastra. Sem edição depois de salvo. |
| `PUT /api/ped/indicadores-cadastro/{id}/meta` | Admin e Validador | Define a meta de um indicador criado automaticamente (só uma vez). |
| `PUT /api/ped/indicadores-cadastro/{id}/situacao` | Admin e Validador | `{ "ativo": false }` — inativa ou reativa. Devolve `dashboards afetados` (vazio até a fase 6). |
| `DELETE /api/ped/indicadores-cadastro/{id}` | só Admin | Exclui o indicador (RF-37). É exclusão **lógica**: some das telas, mas a composição fica guardada. `400` se ele estiver em algum dashboard (ou for o indicador-base das faixas de um), listando os dashboards em `dashboards`; `404` se não existir. |
| `GET /api/ped/indicadores-cadastro/{id}/metas-historico` | qualquer perfil (Preenchedor só dos seus tipos) | Histórico de ajustes de meta. |
| `GET /api/ped/metas` | qualquer perfil | Janela "Editar metas". |
| `PUT /api/ped/metas` | qualquer perfil | Ajusta metas por filial e mês. |

Cadastro:

```json
{
  "nome": "Atingimento de cobertura",
  "descricao": "opcional",
  "origem da meta": "manual",
  "meta": "1.500,50",
  "sentido": "maior_melhor",
  "calculo": "media",
  "meta editavel": true,
  "apontamentos": [5, 7]
}
```

- `sentido`: `maior_melhor` ou `menor_melhor` (custo). `calculo`: `soma` (padrão) ou `media`, só vale com apontamentos; com dado externo fica nulo.
- Composição: `apontamentos` (ids, todos ativos) **ou** `"dado externo": <id>` (dado `ativo`). Os dois juntos, ou nenhum, dão `400`.
- `meta`: maior que zero; aceita vírgula decimal. `meta editavel`: permite ajuste por filial e mês no preenchimento.

Cada indicador da listagem traz `id`, `nome`, `descricao`, `ativo`, `composicao` (`tipo` = `apontamentos`/`dado_externo` e `itens` com `id`, `nome`, `ativo`), `tipos`, `sentido` (+ `descricao`), `calculo`, `meta`, `meta a definir`, `origem da meta`, `meta editavel no preenchimento`, `criado automaticamente`, `componentes desativados`, `problema`, `dashboards`, `vinculado a dashboard` (vazios até a fase 6) e os dados de cadastro e de mudança de situação. `alertas` traz `aguardando meta` e `com componente desativado` (contam só indicadores ativos), para o sinal no menu.

**Componente desativado (RF-40).** `problema` vem `null` ou `{ "tipo", "mensagem" }`: `dado_externo_desativado` e `todos_apontamentos_desativados` (indicador sem resultado) ou `apontamentos_parcialmente_desativados` (o cálculo segue sem eles e pode distorcer). O filtro `problemas` lista só indicadores ativos com esse problema.

**Indicador automático (RF-28).** Ao concluir a construção de um dado externo (`PUT /api/ped/dados-externos-cadastro/{id}/concluir`), se nenhum indicador usar o dado, o sistema cria um com o mesmo nome, ativo e **sem meta nem sentido**; a resposta traz `indicador criado` (ou `null`). Ele fica em "meta a definir" (`situacao=meta`) até o `PUT .../meta`:

```json
{ "meta": 2500, "sentido": "maior_melhor", "meta editavel": true }
```

A meta só pode ser definida uma vez (`400` depois). Indicador sem meta não deve entrar em dashboard (regra aplicada na fase 6).

**Vínculos.** Agora que existem indicadores: `GET /api/ped/apontamentos` e `/dados-externos-cadastro` listam os `indicadores` de cada item; o filtro `situacao=problemas` lista o item **desativado que ainda compõe indicador ativo**; e a exclusão de apontamento ou dado externo que compõe qualquer indicador (ativo ou não) devolve `400` com a lista de nomes. Em `GET /api/ped/preenchimento`, cada apontamento mostra os indicadores de que faz parte.

### Metas no preenchimento (RF-71 a RF-74)

A nova meta vale **só para a filial e o mês** informados; nos demais continua a meta do cadastro (RN-07). Só o **mês aberto** aceita ajuste. A filial segue a regra do preenchimento (Admin informa `filial`, os demais usam a própria).

`GET /api/ped/metas?filial=&mes_de_referencia=&tipo=` lista os indicadores **ativos, com meta editável e meta já definida**, de algum dos tipos do usuário (Admin e Validador veem todos): `id`, `nome`, `tipos`, `composicao`, `sentido`, `meta do cadastro`, `meta vigente`, `ajustada`; mais `situacao do mes` e `editavel`.

`PUT /api/ped/metas`:

```json
{
  "filial": "101",
  "mes de referencia": "2026-10-01",
  "itens": [{ "id indicador": 12, "meta": "2.000,25", "motivo": "sazonalidade" }]
}
```

Regras: meta maior que zero e **diferente da vigente**; `motivo` obrigatório; indicador sem meta editável ou de tipo que o usuário não acessa dá `403`; tudo ou nada. Resposta: `{ "mensagem": "metas ajustadas", "ajustadas": 1 }`.

`GET /api/ped/indicadores-cadastro/{id}/metas-historico?filial=&mes_de_referencia=` devolve, do mais recente ao mais antigo, `data`, `filial`, `mes de referencia`, `de`, `para`, `usuario` e `motivo`. O Admin pode omitir a filial (ou usar `todas`) para ver todas; os demais veem sempre a própria. O histórico não pode ser alterado pela API.

## Cadastro e Preenchimento — fase 6: dashboards (2026-10-28)

Feita **antes das faixas** (fase 5 do plano), porque a tabela de faixas pertence a um dashboard. Um **dashboard** reúne indicadores com pontos base, tem uma periodicidade e um vínculo (filiais, cargos ou colaboradores) que define as "unidades de imagem" geradas no encerramento (fase 7).

**Acesso.** Admin e Validador consultam, cadastram e editam. Só o Admin ativa/desativa, conclui a construção e exclui. O Preenchedor não acessa (`403`).

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/ped/dashboards` | Admin e Validador | Lista. Filtros: `busca` (dashboard, item vinculado ou indicador) e `situacao` (`todas`, `ativos`, `inativos`, `construcao`, `problemas`). |
| `GET /api/ped/dashboards/{id}` | Admin e Validador | Detalhe, com os pesos dos indicadores, vínculos, base da faixa e fórmula. |
| `POST /api/ped/dashboards/previa-tarefa` | Admin e Validador | Mesmo corpo do cadastro; devolve o `titulo` e a `descricao` da tarefa, sem gravar nada. |
| `POST /api/ped/dashboards` | Admin e Validador | Cadastra. Nasce `em_construcao` (inativo) e gera a tarefa de construção. |
| `PUT /api/ped/dashboards/{id}` | Admin e Validador | Edita (tudo, menos a pontuação base máxima). `"enviar tarefa ti": true` cria a tarefa de modificação. |
| `PUT /api/ped/dashboards/{id}/concluir` | Admin | Conclui a construção ou a modificação. |
| `PUT /api/ped/dashboards/{id}/situacao` | Admin | `{ "ativo": true }` — ativa ou desativa. |
| `DELETE /api/ped/dashboards/{id}` | Admin | Exclui. |
| `GET /api/ped/dashboards/{id}/historico` | Admin e Validador | Histórico de modificações. |
| `GET /api/ped/dashboards/{id}/tarefas` | Admin e Validador | Tarefas de construção e modificação. |
| `GET /api/ped/vinculos?tipo=&busca=` | Admin e Validador | Listas para montar o vínculo (abaixo). |

Cadastro:

```json
{
  "nome": "PED Comercial",
  "periodicidade": "trimestral",
  "pontuacao base maxima": 100,
  "tipo de vinculo": "filiais",
  "itens vinculados": ["101", "201"],
  "indicadores": [
    { "id indicador": 12, "pontos base": 40 },
    { "id indicador": 15, "pontos base": "60,00" }
  ],
  "indicador base da faixa": 20,
  "formula de pontuacao": "texto livre, construído pela TI",
  "observacao para ti": "opcional"
}
```

- `periodicidade`: `mensal`, `bimestral`, `trimestral`, `semestral` ou `anual`.
- `tipo de vinculo` e `itens vinculados`: `filiais` (códigos das filiais), `cargos` (nomes de cargo) ou `colaboradores` (ids). Cada filial gera uma imagem; cada colaborador do cargo (ativo) gera uma; cada colaborador escolhido gera uma.
- `pontos base` maiores que zero; **a soma tem que ser exatamente a `pontuacao base maxima`** (a mensagem diz quanto falta ou excede). A pontuação máxima não muda depois do cadastro.
- Só entram indicadores **ativos, com meta definida e sem componente desativado**. Dashboard por filiais também recusa indicador cujo dado externo tem referência diferente de filial (RF-53).
- `indicador base da faixa` e `formula de pontuacao` são obrigatórios; o indicador base pode ser qualquer indicador cadastrado, mesmo fora do dashboard. A fórmula (P-10, provisório) é texto livre, só guardada e enviada à TI.

**Listas de vínculo (`GET /api/ped/vinculos`).** `tipo=filiais` devolve `filial` e `nome filial`; `tipo=cargos` devolve `cargo` e `colaboradores` (a função dos colaboradores ativos); `tipo=colaboradores` devolve `id colaborador`, `nome`, `cargo` e `filial` (sem desligados). A `busca` ignora acento e maiúscula. Como não há API externa de cadastros, as listas vêm do próprio banco.

Cada dashboard da listagem traz `id`, `nome`, `situacao` (`ativo`, `inativo`, `em_construcao`, `em_modificacao`) e `situacao descricao`, `tarefa bitrix` (a mais recente), `tipo de vinculo`, `itens vinculados`, `unidades de imagem`, `periodicidade`, `periodo atual`, `quantidade de indicadores`, `pontos` (`soma` e `maximo`), `alertas`, `cadastrado em` e `ultima alteracao`. O detalhe acrescenta `pontuacao base maxima`, `indicador base da faixa`, `formula de pontuacao`, `observacao para ti`, `vinculos`, `indicadores` (com `pontos base`, `ativo` e `problema`) e `periodo` (`codigo`, `inicio`, `fim`).

**Período atual.** É o que contém a data de hoje: mensal `10/2026`; bimestral, trimestral e semestral `5º bim/2026`, `4º tri/2026`, `2º sem/2026`; anual `2026`.

**Alertas.** Em dashboard **ativo**, cada indicador inativo ou com componente desativado vira `{ "indicador", "motivo", "pontos afetados" }`. O filtro `situacao=problemas` lista os dashboards ativos com algum alerta.

**Construção e modificação pela TI (P-06, provisório).**
- Ao cadastrar, o dashboard fica `em_construcao` e a resposta traz a `tarefa` (`titulo` = `[PED] Construir dashboard: <nome>` e `descricao`). A tarefa segue o mesmo envio ao Bitrix24 do dado externo (ver "Tarefas no Bitrix24" abaixo).
- Ao editar com `"enviar tarefa ti": true`, o dashboard passa a `em_modificacao`, guarda o estado anterior (`ativo` ou `inativo`) e gera a tarefa `[PED] Modificar dashboard: <nome>`, com a lista das alterações. Não é possível enviar tarefa de modificação a um dashboard em construção.
- O Admin confirma no PED com `PUT .../concluir`: construção concluída → `ativo`; modificação concluída → volta ao estado anterior. A tarefa local passa a `concluida`.
- Enquanto está em construção ou modificação, o dashboard não pode ser ativado nem desativado. Editar sem enviar tarefa não muda a situação; editar sem nenhuma diferença responde `"nenhuma alteracao"`.
- Na edição, a regra de elegibilidade (indicador ativo, com meta, sem componente desativado) vale só para indicadores **novos**; um que já estava e depois ficou inativo não impede alterar outros campos.

**Histórico.** Cada linha traz `acao` (`cadastro`, `edicao`, `desativado`, `reativado`, `concluida`) e `acao descricao`, `data`, `usuario`, `alteracoes` (lista de textos: nome, periodicidade, vínculo, indicadores incluídos/removidos, mudança de pontos, base da faixa e fórmula), `tarefa bitrix` e `observacao`.

**Ligações com o restante.** `GET /api/ped/indicadores-cadastro` passou a trazer `dashboards` (`id`, `nome`, `pontos base`) e `vinculado a dashboard`; inativar um indicador devolve os `dashboards afetados`; `GET /api/ped/apontamentos` marca `vinculado a dashboard` quando algum indicador do apontamento está em dashboard. **Exclusão de apontamento e dado externo (RN-12):** passa a ser bloqueada também quando o item **já compôs** um indicador que depois foi excluído; a mensagem lista esses indicadores. Excluir um dashboard apaga composição, vínculos e histórico, mas mantém as tarefas registradas (sem vínculo).

## Cadastro e Preenchimento — fase 5: faixas (2026-10-28)

Uma **tabela de faixas** é a lista De / Até (em reais) / Alíquota (%) de um **dashboard numa filial**. Existe no máximo uma por dashboard e filial. Alterar nunca sobrescreve: gera a versão seguinte, e as anteriores ficam no histórico.

**Acesso (P-04, provisório).** Admin e Validador fazem tudo; o Preenchedor não acessa (`403`). O Admin escolhe a filial; o Validador trabalha sempre na própria filial (o parâmetro `filial` dele é ignorado, e abrir ou alterar faixas de outra filial dá `403`).

| Método e rota | O que faz |
| --- | --- |
| `GET /api/ped/faixas?filial=&dashboard=` | Lista as tabelas, com as faixas da versão vigente. `filial` só vale para o Admin (omitir ou `todas` = todas). `dashboard` filtra por id. |
| `GET /api/ped/faixas/{id}` | Uma tabela, com as faixas vigentes. |
| `POST /api/ped/faixas` | Cadastra (versão 1). |
| `PUT /api/ped/faixas/{id}` | "Alterar faixas": gera a versão seguinte. |
| `GET /api/ped/faixas/{id}/historico` | Versões, da mais recente para a mais antiga. |
| `GET /api/ped/faixas/{id}/versoes/{versao}` | As faixas de uma versão. |
| `DELETE /api/ped/faixas/{id}` | Exclui (só se o dashboard já foi excluído). |

Cadastro:

```json
{
  "dashboard": 3,
  "filial": "101",
  "descricao": "opcional",
  "faixas": [
    { "de": 0, "ate": 1000, "aliquota": 0 },
    { "de": "1.000,01", "ate": "2.000,00", "aliquota": "1,5" }
  ]
}
```

Alteração: `{ "motivo": "reajuste do trimestre", "faixas": [ ... ] }`. O `motivo` é obrigatório, e as faixas não podem ser iguais às da versão vigente.

**Validações (RF-43).** `de`, `ate` e `aliquota` preenchidos e numéricos (aceitam vírgula decimal; um texto só com ponto, como `2.000`, é lido como decimal, ou seja, 2); `de` menor que `ate`; sem valores negativos; cada faixa **começa acima** do `ate` da anterior (começar exatamente nele já é erro; use `100,01` depois de `100`); ao menos uma faixa. As faixas são ordenadas por `de` ao gravar.

Cada tabela traz `id`, `id dashboard`, `dashboard`, `dashboard excluido`, `filial`, `nome filial`, `descricao`, `versao vigente`, `data da versao`, `autor da versao`, `quantidade de faixas` e `faixas` (`de`, `ate`, `aliquota`). O histórico traz `versao`, `vigente`, `motivo` (a primeira é "Cadastro inicial"), `data`, `usuario` e `quantidade de faixas`.

**Exclusão (RF-46).** Enquanto o dashboard existe, a tabela não pode ser excluída (`400`). Quando o dashboard é excluído, as faixas **continuam** (com `dashboard excluido: true` e o nome guardado em `dashboard`) e só então podem ser excluídas; isso remove também o histórico. As imagens congeladas (fase 7) guardam a cópia das faixas usadas no encerramento.

## Cadastro e Preenchimento — fase 7: fechamentos, cálculo e imagens congeladas (2026-10-28)

O **fechamento** de um dashboard calcula o resultado de cada unidade no período atual e, ao **encerrar**, grava uma **imagem congelada** por unidade. O encerramento é sempre manual, por dashboard, e só vale para o período atual da periodicidade dele (o que contém a data de hoje). O dashboard precisa estar **ativo** (em construção, em modificação ou inativo não aparece nos fechamentos e responde `400`).

**Acesso.** Admin e Validador (matriz de permissões). O Preenchedor não acessa (`403`). Na consulta de imagens, o Validador vê só as da própria filial (`403` nas outras).

| Método e rota | O que faz |
| --- | --- |
| `GET /api/ped/fechamentos` | Dashboards ativos, ordenados por periodicidade e nome. Filtros: `periodicidade`, `situacao` (`aberto`/`encerrado`, do período atual) e `busca` (dashboard, grupo vinculado ou período). |
| `GET /api/ped/fechamentos/{id}/previa` | Calcula as imagens com os lançamentos, metas e faixas de agora, **sem gravar nada**. |
| `POST /api/ped/fechamentos/{id}/encerrar` | Gera as imagens congeladas (uma por unidade ainda não encerrada) no mesmo lote. |
| `GET /api/ped/imagens` | Consulta retroativa. Filtros: `filial` (código ou `todas`; Admin e Validador veem todas), `periodo` (ex.: `4º tri/2026`), `dashboard` (id), `tipo` (`filial` ou `colaborador`), `id_colaborador` (colaborador-alvo) e `busca` (dashboard, filial, código da imagem ou do lote, colaborador ou usuário). Cada item traz `tipo` e `id colaborador` (nulo nas imagens de filial). |
| `GET /api/ped/imagens/{id}` | Uma imagem completa, com `tipo` e `id colaborador`. |

Não existe rota para alterar ou excluir imagem, e o próprio model recusa as duas operações (RN-18).

**Unidades de imagem (RF-50).** Dashboard por filiais: uma por filial. Por cargos: uma por colaborador ativo do cargo. Por colaboradores: uma por colaborador escolhido. Para colaboradores (P-07, provisório) vale a **filial dele**: lançamentos, metas e faixas são os dessa filial. Colaborador sem filial fica sem imagem, com aviso. Uma unidade que já tem imagem no período não gera outra; se todas já têm, o encerramento responde `400`.

**Linha do fechamento.** `id`, `nome`, `tipo de vinculo`, `itens vinculados`, `periodicidade`, `periodo atual`, `situacao do periodo`, `unidades de imagem`, `unidades encerradas`, `unidades com pendencias`, `progresso` (`preenchidos` e `total` de lançamentos nas unidades ainda abertas), `indicadores com problema` e `unidades sem tabela de faixas`.

**Prévia e encerramento.** A prévia devolve `dashboard`, `periodo`, `resumo` e `imagens` (uma por unidade a gerar, com `chave` e o conteúdo da imagem). O `resumo` traz `imagens a gerar`, `unidades ja encerradas`, `unidades com pendencias`, `unidades sem tabela de faixas` e `avisos`. O encerramento devolve `lote` (`ENC-000001`), `periodo`, `imagens geradas` e o mesmo `resumo`; cada imagem recebe um código `IMG-000001`. **Lançamentos pendentes entram sem valor** (RN-09) e **unidade sem tabela de faixas fica sem pontuação** (com o motivo); nenhum dos dois impede o encerramento.

### Como o resultado é calculado

**Indicador (RN-01 a RN-08).** `realizado` = soma ou média (conforme o cadastro) dos apontamentos ativos, ou o valor do dado externo; apontamento sem lançamento fica de fora (e vira pendência); booleano conta 1 para Sim e 0 para Não. `meta` = a vigente de cada mês (RN-07). `atingimento` = realizado ÷ meta × 100 (menor é melhor: meta ÷ realizado × 100, e realizado zero vale 100%). `pontos realizados` = o menor entre os pontos base e `pontos base × atingimento ÷ 100` (o atingimento não tem teto, os pontos sim). Indicador inativo não pontua. **PED (%)** = soma dos pontos realizados. Tudo em 2 casas decimais.

**Período com mais de um mês (RN-06).** O valor de cada apontamento é a **média dos meses lançados** no período (booleano vale Sim só se todos os meses lançados forem Sim) e a meta é a **média das metas vigentes dos meses do período**.

**Dado externo em período que não é mensal (P-08, definido pelo negócio).** Usa o valor **da data atual**: o realizado do dado no mês de hoje, com a janela retroativa do próprio dado. Não é consolidado pelos meses do período.

**Pontuação (P-10, definida pelo negócio).** Em quatro etapas, com as faixas vigentes da filial:
1. **Resultado Operacional** = realizado do *indicador base da faixa* do dashboard.
2. **Faixa atingida** = a de maior `de` que não passa do resultado; a faixa anterior é a de baixo. Acima da última faixa vale a última; abaixo da primeira não há pontuação. Na primeira faixa não há anterior, e a alíquota anterior vale 0.
3. **Base de cálculo** = o maior entre **A** (piso da faixa atual × alíquota da faixa anterior) e **B** (resultado × alíquota da faixa atual).
4. **Pontuação** = base × PED (%) ÷ 100.

Exemplo conferido nos testes: Resultado 451.590,62; faixas 2,21% (anterior) e 1,95% (atual, piso 400.000,00); A = 8.840,00, B = 8.806,02, base 8.840,00; PED 119,99% → **Pts 10.607,12**. O campo `formula de pontuacao` do dashboard continua existindo, mas só como texto de referência (e para a tarefa da TI): quem calcula é o back-end, como acima.

**Conteúdo da imagem (RF-83).** `dashboard` (id, nome, periodicidade, pontuação máxima, vínculo, fórmula), `periodo` (`codigo`, `inicio`, `fim`), `unidade` (`tipo`, `filial`, `colaborador`), `resultado operacional` (indicador, valor, observação), `ped percentual`, `pontos base total`, `indicadores` (`meta`, `realizado`, `atingimento`, `pontos base`, `pontos realizados` e `observacao` de cada um), `pontuacao` (os passos: `faixa atual`, `faixa anterior`, `aliquota anterior`, `aliquota atual`, `piso da faixa`, `opcao a`, `opcao b`, `opcao selecionada`, `base de calculo`, `valor`; ou `calculada: false` com o `motivo`), `faixas` (a `versao` e as `linhas` usadas), `pendencias` e `avisos`, mais `codigo`, `lote`, `gerado em` e `usuario`. A imagem guarda uma **cópia**: correções de lançamento, novas versões de faixas ou a exclusão do dashboard não a alteram. Se o dashboard for excluído, a imagem continua (com `dashboard_nome`).

Cada linha da consulta de imagens traz `id`, `codigo`, `lote`, `dashboard`, `periodo`, `filial`, `colaborador`, `gerado em`, `usuario`, `ped percentual` e `pontuacao`.

## Cadastro e Preenchimento — fase 9: tela Início (2026-10-28)

`GET /api/ped/inicio` devolve tudo o que a tela Início precisa, numa chamada só. Qualquer perfil do PED acessa; quem não tem perfil recebe `403`. A filial da tela segue o cabeçalho (RF-01): o **Admin** pode informar `?filial=<código>` (omitir ou `todas` = todas as filiais; código inexistente = `404`); os **demais perfis** usam sempre a própria filial e o parâmetro é ignorado.

```json
{
  "perfil": "preenchedor",
  "filiais": [{ "filial": "101", "nome filial": "CAMPO GRANDE" }],
  "periodo aberto": { "mes de referencia": "2026-10-01", "aberto por": "...", "aberto em": "...", "aviso": "Somente um periodo fica aberto..." },
  "aviso de acesso": { "tipo": "preenchedor", "mensagem": "...", "tipos": ["Comercial"], "filiais": ["101 - CAMPO GRANDE"] },
  "resumo": [{ "chave": "apontamentos dos meus tipos", "rotulo": "Apontamentos dos meus tipos", "valor": 3 }],
  "periodos em aberto": [{ "id": 7, "nome": "...", "periodicidade": "mensal", "periodo atual": "10/2026", "periodo encerrado": false, "filiais abertas": 1, "progresso": { "preenchidos": 2, "total": 3 } }],
  "ultimas alteracoes": [{ "acao": "correcao", "apontamento": "...", "competencia": "2026-10-01", "filial": "101", "valor anterior": 5, "valor novo": 6, "data": "...", "usuario": "..." }]
}
```

- **Avisos (RF-06, RF-07).** `periodo aberto.aviso` traz a regra de que só um período fica aberto por vez. `aviso de acesso` é `null` para o Admin e o Validador; para o Preenchedor lista os `tipos` e as `filiais` a que ele tem acesso; para os demais lista as `filiais` restritas.
- **Resumo (RF-08).** Uma lista ordenada de `{ chave, rotulo, valor }`, que muda com o perfil:
  - **Admin:** `apontamentos ativos`, `dados externos ativos`, `total de indicadores`, `dados externos em construcao`, `lancamentos pendentes`.
  - **Validador:** `apontamentos ativos`, `dashboards com meus apontamentos`, `meus dados externos em construcao`, `dashboards ativos`, `lancamentos pendentes`.
  - **Preenchedor:** `apontamentos dos meus tipos`, `dashboards com meus apontamentos`, `meus dados externos em construcao`, `lancamentos pendentes` (sem "Dashboards ativos").
  - `lancamentos pendentes` = apontamentos ativos (dos tipos do usuário) × filiais da tela, menos os já lançados no período aberto. "Dashboards com meus apontamentos" são os dashboards ativos que têm ao menos um indicador ativo com apontamento dos tipos do usuário (para o Validador, de todos os tipos). "Meus dados externos em construção" são os pedidos de construção **feitos pelo próprio usuário**.
- **Períodos em aberto (RF-10).** Cada dashboard ativo visível ao usuário, em ordem alfabética, com `periodicidade`, `periodo atual`, `filiais abertas` e `progresso` ("X de Y lançamentos"). O progresso conta só as filiais da tela que ainda têm unidade sem imagem no período (as já encerradas saem da conta), considerando os apontamentos ativos dos indicadores ativos do dashboard — e, para o Preenchedor, só os dos seus tipos. O Preenchedor só vê dashboards que têm apontamentos dos seus tipos. `periodo encerrado: true` quando todas as unidades da tela já foram encerradas (e o progresso fica 0 de 0). O botão Preencher leva à tela de preenchimento daquela filial.
- **Últimas alterações (RF-11).** Os 6 lançamentos ou correções mais recentes (`acao` = `lancamento` ou `correcao`), com `apontamento`, `competencia`, `filial`, `valor anterior` e `valor novo` (booleano em `true`/`false`), `data` e `usuario`. O Preenchedor vê só os dos seus tipos. Como nos demais filtros, valem as filiais da tela (Admin: a escolhida ou todas; demais: a própria).

## Tarefas no Bitrix24 (INT-04)

As tarefas do PED (construção de dado externo, construção e modificação de dashboard) vão para o fluxo **"Dpto TI - Criação de novos indicadores"** do Bitrix24. O pedido de indicador não gera tarefa: só dados externos e dashboards.

- **Envio:** logo depois de salvar (dado externo por Validador/Preenchedor, cadastro de dashboard, edição com `"enviar tarefa ti"`), o back tenta criar a tarefa no Bitrix, com espera máxima de 5 s; se falhar, o salvamento segue normalmente e `php artisan ped:enviar-tarefas-bitrix` (a cada 5 minutos quando `BITRIX_ATIVO=true`) reenvia. Usa `tasks.task.add` com `TITLE`, `DESCRIPTION`, `FLOW_ID` e, se configurado, `CREATED_BY` (`BITRIX_CRIADOR_ID`; hoje o usuário SISTEMA). O fluxo define o prazo. Todo o conteúdo vai na descrição. As respostas de cadastro e edição trazem `tarefa` com `titulo`, `descricao`, `status` e `id bitrix` (`null` enquanto na fila).
- **Status do PED:** `aguardando_envio` → `enviada` (com `bitrix_id`). Falha de rede ou erro do Bitrix não perde a tarefa: ela continua `aguardando_envio`, guarda `erro_envio` e `tentativas_envio` e é tentada de novo na rodada seguinte.
- **Número da tarefa mostrado no PED:** o ID do Bitrix (`tarefa bitrix.id`); enquanto não enviada, vem `null`.
- **Status vindo do Bitrix (previsto):** `php artisan ped:sincronizar-status-bitrix` grava o status bruto em `status_bitrix` (`aguardando`, `em_andamento`, `aguardando_controle`, `concluida`, `adiada`). Não está agendado e **não muda** dashboard nem dado externo; a conclusão sincronizada depende da pendência P-06. O campo ainda não é devolvido nas respostas da API.
- **Configuração (só no `.env` do servidor):** `BITRIX_ATIVO`, `BITRIX_WEBHOOK_URL` (webhook de entrada, contém a chave), `BITRIX_FLOW_ID`, `BITRIX_CRIADOR_ID`, `BITRIX_TIMEOUT`. A URL nunca é gravada em log, banco ou mensagem de erro.
