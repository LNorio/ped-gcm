# PED — meta do indicador via API: resposta final do back-end

Fecha a conversa sobre a `PROPOSTA-meta-via-api.md` e a `RESPOSTA-FRONT-contraproposta-meta-via-api.md`. Este documento **substitui** todas as versões anteriores da contraproposta. O que está aqui já foi **decidido pelo negócio e pela TI**; falta só a **confirmação do front** (seção 7) para o back-end começar a implementar.

**Estado:** nada da meta via API está implementado ainda. Só as variáveis `%empresa%` e `%empresas%` (seção 3.3) já estão no código, e ficam disponíveis depois do próximo deploy.

---

## 1. Decisões finais

| Tema | Decisão |
| --- | --- |
| Fontes da meta | Três, sem travar nenhuma: **manual** (como hoje), **ERP** e **outro sistema**. |
| API | A "API" é o **web service do ERP** (SOAP da Senior), de onde já vêm realizado e meta. `origem da meta = terceiro` significa meta vinda de fonte externa. |
| Quem busca | **O PED busca** (controla o horário), como já faz com o ERP. A TI não envia nada. |
| Meta do ERP agora | **Liberada** para **faturamento e os 6 volumes** (Mann, Tecfil, Ipiranga, Texaco, Premium e Moto). |
| Outros 4 indicadores | Novos clientes, produto por PDV, cobertura e produtos parados **continuam com meta manual** (o ERP não devolve meta para eles). |
| Meta automática | **Nunca é editável** à mão, nem no cadastro nem no preenchimento. |
| Agregação | A meta **acompanha o dado**: `soma` → soma das metas dos mesmos meses; `media` → média; `ultimo` → meta do mês. Usa o **mesmo conjunto de meses** do realizado (mês sem realizado ou sem meta fica de fora dos dois). Meta `0` conta como sem meta. |
| Tarefa no Bitrix | A meta de **outra fonte** abre tarefa, como o dado externo. **Admin cadastra sem gerar tarefa**; a tarefa nasce no cadastro do **Validador**. |
| Fonte da meta | **Fixa** depois de salva. Quem errou inativa e recria. |
| Integração na fonte ERP | **Não se cadastra integração no indicador.** Mostra-se a integração do **dado externo**, só para leitura. |
| Executor | Fase 2. **SOAP** da Senior primeiro (mesmas credenciais do ERP, no servidor), **POST**, **sem restrição de URL**, resposta com **todas as filiais numa lista**. **REST/JSON** entra quando houver a primeira fonte REST. |

---

## 2. Contrato final

### 2.1 Cadastro e Definir meta

`POST /api/ped/indicadores-cadastro` e `PUT /api/ped/indicadores-cadastro/{id}/meta`.

```json
{
  "nome": "Faturamento",
  "origem da meta": "terceiro",
  "fonte da meta": "dado_externo",
  "sentido": "maior_melhor",
  "meta editavel": false,
  "dado externo": 42
}
```

`fonte da meta` é um **enum** (no lugar do booleano `meta do dado externo` da resposta do front):

| `fonte da meta` | Regras |
| --- | --- |
| `dado_externo` | Exige `dado externo` cuja coleta tenha `fornece meta: true`. A meta fica disponível **na hora**. Não há integração no indicador. Sem tarefa. |
| `integracao` | Vale com dado externo **ou apontamentos**. O indicador é **aceito e gravado** (`201`), nasce com `integracao pendente: true` e `situacao da meta via api: integracao_pendente`. Cadastro do **Validador** abre tarefa no Bitrix; cadastro do **Admin** não. |

Para as duas: `"meta editavel": true` → `400`; `meta` ou `metas por filial` junto com `terceiro` → `400`. Continua valendo "a meta só se define uma vez".

**Erros `400` (mensagem):**

| Situação | Mensagem |
| --- | --- |
| `dado_externo` com dado cuja coleta não fornece meta (ex.: Cobertura) | "o dado externo X nao fornece meta; informe a meta manualmente" |
| `dado_externo` com apontamentos | "meta via API exige um dado externo do ERP" |
| `meta editavel: true` com `terceiro` | "meta automatica nao pode ser editavel" |
| `meta` ou `metas por filial` com `terceiro` | "meta via API nao aceita meta manual" |

### 2.2 Integração do indicador: `PUT /api/ped/indicadores-cadastro/{id}/integracao` (só Admin)

**Só para `fonte da meta = integracao`.** Mesmo corpo, validações e erros da integração do dado externo. Esta gravação é a **conclusão da solicitação** (como o "Concluir construção" do dado externo).

```json
{
  "identificador": "META_FATURAMENTO",
  "url": "https://servico.exemplo/api/metas",
  "parametros de saida": "[ { \"filial\": \"100\", \"meta\": \"4600000\" } ]",
  "parametros de entrada": "{ \"operacao\": \"Metas\", \"parametros\": { \"ECodEmp\": \"%empresas%\", \"EDatIni\": \"%dataInicial%\", \"EDatFim\": \"%dataFinal%\" } }",
  "tipo de servico": "soap"
}
```

- Resposta `200`: `{ "mensagem": "integracao atualizada", "variaveis usadas": [...] }`. A situação passa a `aguardando_consulta`.
- `400`: erros por campo (mesmo formato da integração do dado externo); indicador com `fonte da meta = dado_externo` ("a meta vem do dado externo"); indicador que não é `terceiro`.
- `404`; `403` para Validador e Preenchedor.
- **`tipo de servico`** é **opcional e assume `soap`**. Aceita `soap` ou `rest`; outro valor dá `400`. A modal **não precisa de seletor agora**.

### 2.3 Saída da integração: uma lista com todas as filiais

A saída cadastrada **é uma lista**. Cada item precisa de:
- `filial` (código), obrigatório;
- `meta` (integração de meta) **ou** `valor` (integração de dado externo), obrigatório;
- `competencia` (MM/AAAA), opcional.

O back valida ao salvar e recusa com `400`, apontando `parametros de saida`, a saída que **não for lista** ou cujo item **não tenha** `filial` e `meta`/`valor`. O botão **Inserir modelo** da saída deve gerar uma lista de exemplo.

### 2.4 Listagem: `GET /api/ped/indicadores-cadastro`

Para indicador `terceiro` (todos os perfis):

| Campo | Conteúdo |
| --- | --- |
| `fonte da meta` | `dado_externo` ou `integracao`; `null` nos de meta manual. |
| `situacao da meta via api` | `dado_externo`: `ok` ou `sem_meta_no_mes`. `integracao`: `integracao_pendente`, `aguardando_consulta`, `erro` ou `ok`. |
| `filiais sem meta` | Filiais sem meta no **mês aberto** (meta `0` ou ausente). `[]` se nenhuma. |
| `meta`, `metas por filial`, `meta a definir` | `null`, `null` e `false`. A tela mostra "Via API". |
| `tarefa` | Na fonte `integracao`: `{ "titulo", "status", "id bitrix" }` (mesmo formato do dado externo). |

Só para o **Admin**:
- fonte `dado_externo`: `integracao do dado externo` (só leitura: `identificador`, `url`, `parametros de saida`, `parametros de entrada`);
- fonte `integracao`: `identificador`, `url`, `parametros de saida`, `parametros de entrada`, `variaveis usadas`, `integracao pendente`, `integracao alterada em/por`, `ultima consulta em`, `erro da ultima consulta`.

Também:
- **`alertas`:** `aguardando meta` **não** conta `terceiro`; `"integracao pendente": N` conta só a fonte `integracao` sem integração salva.
- **Filtro:** `situacao=integracao_pendente` (fonte `integracao`).
- **Topo da resposta:** `"meta via api": { "dado externo": true, "integracao": false }`. `integracao: false` significa que **a consulta ainda não roda** (fase 2): o cadastro é aceito, mas a meta só chega quando o executor existir.

### 2.5 Dados externos

`GET /api/ped/dados-externos-cadastro` ganha, **para todos os perfis**, o campo `fornece meta` (`true`/`false`). Hoje é `true` em faturamento e nos 6 volumes. O checkbox "Buscar metas via API" só aparece quando o dado escolhido tem `fornece meta: true` (fonte `dado_externo`).

### 2.6 Editar metas e dashboards

- **Editar metas:** o indicador `terceiro` **não aparece** em `GET /api/ped/metas`, e `PUT /api/ped/metas` para ele devolve **`403`** (já é o comportamento atual). Tratar `403`, e não `400`.
- **Dashboards:** fonte `dado_externo` entra normalmente (filial sem meta fica sem atingimento). Fonte `integracao` **só entra** com a integração salva **e** meta no mês aberto; senão, `400` com o motivo ("integracao da meta pendente" ou "aguardando a primeira consulta").

---

## 3. Integração: o que mudou para a modal

### 3.1 Variáveis (agora 13)

`GET /api/ped/integracao/variaveis` traz as 13: `%filial%`, **`%empresa%`**, **`%empresas%`**, `%colaborador%`, `%zona%`, `%mes%`, `%ano%`, `%competencia%`, `%dataInicial%`, `%dataFinal%`, `%hoje%`, `%diaColeta%` e `%mesesRetro%`.

### 3.2 `%empresa%` e `%empresas%`

- **`%empresa%`** (número): código da empresa da filial consultada (1, 6, 7, 8 ou 9). Na prévia vale `1`. Numa filial sem empresa cadastrada é um **erro claro**, e não valor vazio.
- **`%empresas%`** (texto): as empresas participantes, em ordem e separadas por vírgula (ex.: `1,6,7,8,9`), tiradas do cadastro das filiais (uma empresa nova entra sozinha). Serve para a chamada que traz **todas as filiais**. Não entra em conta.

Como a resposta é uma lista com **todas as filiais**, a entrada dessas chamadas usa `%empresas%` (e as datas), e não `%filial%`.

---

## 4. O que o front faz e o que não faz

**Faz:**
1. Trocar o booleano `meta do dado externo` pelo enum `fonte da meta` (`dado_externo` / `integracao`).
2. Mostrar o checkbox "Buscar metas via API" conforme `fornece meta` (fonte `dado_externo`) e `meta via api` (fonte `integracao`).
3. Mostrar na listagem o estado `situacao da meta via api` (incluindo `aguardando_consulta`), `filiais sem meta` e a `tarefa` do Bitrix.
4. Para o Admin na fonte `dado_externo`, abrir a integração do **dado externo**, só para leitura.
5. Para a fonte `integracao`, usar a modal de integração do indicador, com a **saída em lista** e o modelo de exemplo.
6. Tratar `403` em Editar metas e o `400` de dashboard com o motivo.
7. Enviar sempre `"meta editavel": false` com `terceiro`.

**Não faz (agora):**
- Cadastro de integração no indicador na fonte `dado_externo` (a etiqueta "Integração pendente" e o menu de integração só valem para a fonte `integracao`).
- Seletor `tipo de servico` (assume `soap`).

---

## 5. Entrega em duas fases

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **1** | Tudo da seção 2 (contrato, armazenamento, tarefa no Bitrix, regras de dashboard, agregação, `fornece meta`, criação da coleta ao concluir). Tem **migration**. | **Faturamento e os 6 volumes ganham meta automática** (fonte `dado_externo`). A fonte `integracao` pode ser cadastrada, configurada e solicitada, mas **ainda não é consultada** (`aguardando_consulta`). |
| **2** | Executor: chama a fonte (SOAP primeiro), grava o realizado e a meta por filial e mês, trata falha (uma nova tentativa, registra o erro e **mantém a última meta boa**). | A fonte `integracao` passa a trazer meta e realizado. |

O ERP **continua** pela coleta atual, sem migrar para o executor.

---

## 6. Roteiro de teste

1. `terceiro` + `fonte da meta: dado_externo` + dado de **faturamento**: `201`; `meta a definir: false`; `situacao da meta via api: ok`; sem tarefa; não entra em `alertas["aguardando meta"]` nem em `alertas["integracao pendente"]`; entra em dashboard.
2. `dado_externo` com dado de **cobertura** ou com apontamentos: `400`. `terceiro` com `meta`, `metas por filial` ou `meta editavel: true`: `400`, e nada é gravado.
3. `fonte da meta: integracao` como **Validador**: `201`, `integracao pendente: true`, `tarefa` presente; não entra em dashboard (`400`).
4. O mesmo como **Admin**: `201`, sem tarefa.
5. `PUT .../integracao` com a saída **em lista** e os campos obrigatórios: `200`; situação `aguardando_consulta`.
6. `PUT .../integracao` com saída que não é lista, ou item sem `filial`/`meta`: `400` em `parametros de saida`. Sem `tipo de servico`: aceita. Com valor diferente de `soap`/`rest`: `400`.
7. `PUT .../integracao` na fonte `dado_externo`: `400`. Como Validador: `403`.
8. `GET /api/ped/metas` não lista o indicador `terceiro`; `PUT /api/ped/metas` para ele: `403`.
9. `GET /api/ped/dados-externos-cadastro`: faturamento e os 6 volumes com `fornece meta: true`; os demais `false`.
10. `GET /api/ped/integracao/variaveis` traz **13** variáveis, com `%empresa%` e `%empresas%`.

---

## 7. O que precisamos do front para começar

Confirme os quatro pontos abaixo. Com o **OK**, o back inicia a **fase 1**:

1. O enum **`fonte da meta`** (`dado_externo` / `integracao`) no lugar do booleano atende?
2. A tela mostra o estado **`aguardando_consulta`** e a **`tarefa`** do Bitrix na listagem?
3. O campo **`meta via api.integracao`** (`false` = "a consulta ainda não roda") basta para avisar o usuário?
4. A modal de integração passa a orientar a **saída em lista** (`filial` e `meta`/`valor`), com o **Inserir modelo** gerando uma lista de exemplo?

Se algum ponto for um problema, diga qual e o que prefere no lugar. O resto (seções 1 a 3) é decisão fechada.
