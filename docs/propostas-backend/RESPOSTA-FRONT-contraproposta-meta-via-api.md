# PED — meta do indicador via API: resposta do front à contraproposta (versão 2)

Resposta do front-end à `CONTRAPROPOSTA-meta-via-api.md` (versão 2 do back-end), 10/11/2026. Nada abaixo está implementado no back-end.

**Em uma frase:** a meta vinda do ERP não precisa de um caminho separado. Ela cabe na **etapa 2** (integração própria do indicador) com um flag a mais no indicador, **"Meta vinda do dado externo"**. Com o flag marcado, o sistema **não executa a chamada de novo**: usa a meta que o dado externo já coleta. O cadastro da integração no indicador serve de **apoio e organização**, não para uma segunda coleta.

---

## 1. Proposta: um caminho só, com o flag "Meta vinda do dado externo"

O indicador com `"origem da meta": "terceiro"` usa **sempre** o mesmo modelo, que é a integração própria da etapa 2: identificador, URL, parâmetros de saída e de entrada, `PUT .../{id}/integracao` e o estado "integração pendente". O que muda é um flag:

| Flag "Meta vinda do dado externo" | De onde vem a meta | A chamada é executada pelo indicador? |
| --- | --- | --- |
| **Marcado** | Da coleta do **dado externo** que compõe o indicador, hoje o ERP (`metVlr` e `metVol`), já gravada por filial e mês em `ped_dados_externos`. | **Não.** A chamada já é feita pela coleta do dado externo e não deve rodar duas vezes. |
| **Desmarcado** | Da integração própria do indicador (outro sistema). | **Sim**, pelo executor genérico, quando ele existir. Aqui o botão **Configurações** e a modal com **todos os campos** (identificador, URL, parâmetros de saída e de entrada) são **obrigatórios**: sem a integração salva, não há de onde buscar a meta. |

**Por que cadastrar a integração mesmo com o flag marcado.** Os dados externos não deixam registrado, junto do indicador, que consulta traz a meta nem com que parâmetros. Com a integração preenchida no indicador, a TI tem num só lugar o identificador, a URL, a saída e a entrada da meta, o que ajuda na documentação, na manutenção e na conferência. Esse cadastro é **só de apoio**: com o flag marcado, o back-end **não deve executar** a chamada do indicador.

**Consequências:**

- **Faturamento e os 6 volumes** passam a ter meta automática já, sem executor novo: com o flag marcado, o caso é igual ao da etapa 1 da contraproposta.
- **Outras fontes (flag desmarcado):** o indicador pode ser **cadastrado e configurado já**: ele é salvo, o Admin preenche a integração pela modal e o cadastro fica completo. Só a **execução** da chamada depende do executor genérico. Até ele existir, o indicador fica `aguardando_consulta`, sem meta. As perguntas da seção 7.2 (autenticação, método, segurança da URL, `%empresa%`) valem só para esse caso.

---

## 2. Contrato

### 2.1 Cadastro e Definir meta

`POST /api/ped/indicadores-cadastro` e `PUT /api/ped/indicadores-cadastro/{id}/meta` com o campo **`"meta do dado externo"`** (booleano):

```json
{ "nome": "Faturamento", "origem da meta": "terceiro", "meta do dado externo": true, "sentido": "maior_melhor", "meta editavel": false, "dado externo": 42 }
```

**Regras:**

- `"meta do dado externo": true`:
  - **exige** `dado externo` cuja coleta **forneça meta** (`fornece meta: true`). Dado externo sem meta, ou indicador composto por apontamentos → `400`;
  - a meta fica disponível **na hora**, vinda da coleta do dado.
- `"meta do dado externo": false`, ou ausente, com `terceiro`:
  - usa a integração própria (etapa 2) e vale também para indicador composto por **apontamentos**;
  - o indicador é **aceito e gravado** mesmo antes de existir o executor. Ele nasce com `integracao pendente: true` (`situacao da meta via api: integracao_pendente`). Depois que o Admin salva a integração, passa a `aguardando_consulta` até a primeira consulta;
  - **pedimos que não seja recusado com `400`** enquanto `meta via api.integracao` for `false`. A TI precisa conseguir cadastrar e configurar já, e só a execução fica para depois.
- **Meta automática nunca é editável** (regra do negócio, 10/11/2026). Com `terceiro`, `"meta editavel"` precisa ser `false`, com o flag marcado ou desmarcado. `"meta editavel": true` → `400` ("meta automatica nao pode ser editavel"), e o back-end **não deve gravar** `meta editavel = true` em nenhum caminho: cadastro, Definir meta e `PUT .../integracao`. O front já esconde a opção "Meta editável no preenchimento" e envia `false`.
- Continuam como na contraproposta: `terceiro` com `meta` ou `metas por filial` → `400`; troca de origem depois de salvo não é permitida.
- **Equivalência com a contraproposta:** `"meta do dado externo": true` corresponde a `"fonte da meta": "dado_externo"`, e `false` corresponde a `"fonte da meta": "integracao"`. Se o back-end preferir manter só `fonte da meta` no corpo e na listagem, o front se adapta; o que importa é a regra do flag.

### 2.2 Integração do indicador: `PUT /api/ped/indicadores-cadastro/{id}/integracao` (só Admin)

O corpo, as validações e os erros são os mesmos da integração do dado externo e da nossa proposta.

- **Flag desmarcado (obrigatória):** é aqui que a TI informa todos os campos da consulta (identificador, URL, saída e entrada). Sem ela, o indicador fica com a integração pendente e sem meta. Depois de salva, é executada pelo executor genérico, quando ele existir.
- **Flag marcado (apoio):** na contraproposta, a fonte ERP respondia `400` ("a meta vem do dado externo"). Pedimos que **aceite e grave** a integração também nesse caso, só para registro. A integração salva **não é executada**: a meta continua vindo da coleta do dado externo.
- **Proposta:** aceitar também `"meta do dado externo"` neste PUT, para o Admin corrigir o flag sem recriar o indicador. Se preferirem não permitir, o flag fica fixo no cadastro.

### 2.3 Listagem: `GET /api/ped/indicadores-cadastro`

Aceitamos os campos da contraproposta, com estes ajustes:

| Campo | Conteúdo |
| --- | --- |
| `meta do dado externo` | O flag (ou `fonte da meta`, ver 2.1). Para todos os perfis. |
| `situacao da meta via api` | Flag marcado: `ok` ou `sem_meta_no_mes`, vindos da coleta do dado. Flag desmarcado: `integracao_pendente`, `aguardando_consulta`, `erro` ou `ok`. |
| `integracao pendente` | `true` quando a integração ainda não foi salva, **nos dois casos**. Com o flag marcado, a pendência é **só organizacional**: ela **não impede** a meta nem a entrada em dashboard, assim como hoje a integração pendente do dado externo não impede a coleta. |
| `filiais sem meta` | Para `terceiro`: filiais sem meta no mês aberto (meta `0` ou ausente). `[]` se nenhuma. |
| Campos da integração (só Admin) | `identificador`, `url`, `parametros de saida`, `parametros de entrada`, `variaveis usadas`, `integracao alterada em/por`, mais `ultima consulta em` e `erro da ultima consulta` (só com o flag desmarcado). |
| `meta`, `metas por filial`, `meta a definir` | `null`, `null` e `false`, como na contraproposta. |

**`alertas["integracao pendente"]`** conta os indicadores `terceiro` ativos com a integração ainda não salva, nos dois casos, para lembrar a TI de registrar.

**Dashboards:**

- **Flag marcado:** o indicador entra normalmente, mesmo com a integração pendente.
- **Flag desmarcado:** com a integração pendente, não entra (`400`), como na contraproposta.

### 2.4 Dados externos

O campo **`fornece meta`** em `GET /api/ped/dados-externos-cadastro` continua necessário: o front só mostra o flag quando o dado escolhido fornece meta.

---

## 3. Regra de agregação da meta (seção 5 da contraproposta): **confirmada**

Decisão do usuário (10/11/2026): **a meta segue a mesma regra do dado.**

| Sentido do dado externo | Realizado | Meta usada no período |
| --- | --- | --- |
| `soma` | Soma dos meses da janela | **Soma** das metas dos mesmos meses |
| `media` | Média dos meses da janela | **Média** das metas dos mesmos meses |
| `ultimo` | Último mês | **Meta do mês** |

Assim realizado e meta cobrem o mesmo período.

---

## 4. Respostas às perguntas ao front (seção 10)

1. **A etapa 1 atende?** Sim, mas pelo caminho da seção 1: etapa 2 com o flag marcado. O checkbox "Buscar metas via API" continua disponível. O flag **"Meta vinda do dado externo"** aparece quando a composição é por um dado externo com `fornece meta: true`, marcado por padrão nesse caso.
2. **Os campos cobrem a tela?** Sim: `meta do dado externo` (ou `fonte da meta`), `situacao da meta via api`, `filiais sem meta`, `integracao pendente` e `meta via api`.
3. **O `403` em "Editar metas" é tratável?** Sim. O front vai tratar `403`, e não `400`, para o indicador `terceiro`.

---

## 5. Como fica a tela

- **Cadastro e Definir meta:** o checkbox "Buscar metas via API" esconde a meta manual e a opção "Meta editável no preenchimento". Uma meta automática **nunca** é cadastrada como editável: o front sempre envia `"meta editavel": false`. Com composição por dado externo que fornece meta, aparece o flag **"Meta vinda do dado externo"**, marcado por padrão. Com o flag desmarcado, ou com composição por apontamentos, o indicador é salvo normalmente e fica com a integração pendente, para ser configurada em seguida.
- **Listagem:**
  - coluna Meta: "Via API";
  - etiqueta "Integração pendente (TI)" enquanto a integração não for salva (organizacional, com o flag marcado);
  - "Sem meta no mês" quando a situação for `sem_meta_no_mes`;
  - "Meta pendente em N filiais" para as filiais sem meta no mês.
- **Menu (só Admin):** "Preencher integração", enquanto pendente, ou "Configurações", depois de salva, abre a modal da integração com **todos os campos**, igual à do dado externo.
  - **Flag desmarcado:** o botão e a modal são **obrigatórios**. É por eles que a meta passa a ter fonte.
  - **Flag marcado:** o botão e a modal também aparecem, mas o cadastro é só de apoio e organização.

---

## 6. Ainda em aberto com o negócio

1. **Liberar a meta do ERP agora** (P-15)? Com o flag, entram Faturamento e os 6 volumes.
2. **Os outros 4 indicadores** (novos clientes, produto por PDV, cobertura, produtos parados): continuam com meta manual, ou o Senior passa a devolver meta para eles?
3. **Etapa 2 com o flag desmarcado:** as perguntas da seção 7.2 da contraproposta, só quando houver uma fonte além do ERP.

---

## 7. Roteiro de teste sugerido (complemento ao da contraproposta)

1. `terceiro` com `"meta do dado externo": true` e dado de **faturamento**: `201`. A meta está disponível na hora (`situacao da meta via api: ok`), `integracao pendente: true` e o indicador entra em dashboard.
2. Mesmo indicador: `PUT .../integracao` com os 4 campos → `200`. `integracao pendente` passa a `false`, e **nenhuma chamada nova** é feita: a meta continua vindo de `ped_dados_externos`.
3. `"meta do dado externo": true` com dado de **cobertura** (sem meta) ou com apontamentos: `400`. `terceiro` com `"meta editavel": true`, com o flag marcado ou desmarcado: `400`, e nada é gravado.
4. `"meta do dado externo": false` (dado externo ou apontamentos): `201`, com `integracao pendente: true` e `situacao da meta via api: integracao_pendente`. O indicador **não** entra em dashboard (`400`, "integracao da meta pendente").
5. Mesmo indicador: `PUT .../integracao` com os 4 campos → `200`. `integracao pendente` passa a `false` e a situação passa a `aguardando_consulta`, até o executor fazer a primeira consulta.
6. Período de 3 meses com dado `soma`: a meta usada é a soma das metas dos 3 meses. Com `media`, é a média. Com `ultimo`, é a meta do mês.
