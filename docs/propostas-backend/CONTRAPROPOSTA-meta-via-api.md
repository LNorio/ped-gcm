# PED — meta do indicador via API: contraproposta do back-end (versão 2)

Resposta do back-end à `PROPOSTA-meta-via-api.md` do front (10/11/2026), **revisada** depois do esclarecimento do negócio: **"API" é o web service do ERP, de onde já vêm os dados de meta e de realizado**; isso não exclui trazer dados de outro sistema no futuro. Nada abaixo está implementado ainda.

**Em uma frase:** como a API é o ERP, a meta via API **já tem fonte pronta e coletada todos os dias** para parte dos indicadores. O back propõe liberar `terceiro` **primeiro com a fonte ERP** (sem executor novo e sem integração própria no indicador) e deixar **a integração própria do indicador** (URL, entrada e saída da proposta do front) para as **outras fontes**, numa segunda etapa.

---

## 1. O que muda em relação à primeira versão

| Antes (versão 1) | Agora (versão 2) |
| --- | --- |
| Faltava um executor para buscar a meta | Para o ERP, o executor **já existe e roda todo dia** (`PedErpService`, 06:00). O executor genérico só é preciso para **outras fontes**. |
| Atalho possível com a meta do ERP | A meta do ERP é o **caso principal**. |
| Autenticação e método HTTP em aberto | Para o ERP já estão resolvidos (SOAP, com usuário e senha no `.env` do servidor). Ficam em aberto só para **outras fontes**. |
| Integração própria no indicador sempre | Só quando a fonte **não** é a do dado externo (etapa 2). |

---

## 2. O que o ERP já entrega hoje (fato do back-end)

O ERP devolve a meta junto com o realizado, **por filial e mês**, e o PED grava isso todo dia em `ped_dados_externos` (colunas `valor` e `meta`):

| Indicador (coleta) | Realizado | Meta que o ERP devolve |
| --- | --- | --- |
| `faturamento` | valor líquido (R$) | meta de valor (`metVlr`) |
| `volume_mann`, `volume_tecfil`, `volume_ipiranga`, `volume_texaco`, `volume_premium`, `volume_moto` | volume líquido | meta de volume (`metVol`) |
| `novos_clientes`, `produto_pdv`, `cobertura`, `produtos_parados` | sim | **não devolve meta** |

- Já existem metas coletadas para **agosto, setembro e outubro/2026**.
- Filial sem meta cadastrada no ERP vem com `meta = 0`. O PED trata `0` como **sem meta** (sem atingimento).
- O realizado e a meta vêm da **mesma consulta**, na **mesma unidade** (R$ no faturamento, volume nas marcas), então são comparáveis.
- Falha da coleta já é registrada e a última coleta boa **é mantida**. O mês fechado guarda a meta que foi coletada, então o fechamento é reprodutível.

**Consequência:** só **faturamento e os 6 volumes** (7 indicadores) podem ter meta via ERP **hoje**. Para os outros 4, o ERP precisaria passar a devolver meta (mudança do lado do Senior) ou a meta continua manual.

---

## 3. Contraproposta: duas fontes de meta via API

### Etapa 1 — Fonte ERP: "mesma fonte do dado externo" (sem integração nova)

O indicador é composto por um **dado externo** cuja coleta do ERP devolve meta. Com `origem da meta = terceiro`, a meta de cada filial e mês é **a que o ERP já devolveu para aquele dado**. Não há URL, entrada nem saída no indicador: a fonte é a do próprio dado externo.

```json
{ "nome": "Faturamento", "origem da meta": "terceiro", "sentido": "maior_melhor", "meta editavel": false, "dado externo": 42 }
```

Regras:
- `terceiro` + `dado externo` cuja coleta **fornece meta** → aceito. O indicador nasce **ativo** e com meta **disponível imediatamente** (sem "integração pendente").
- `terceiro` + `dado externo` cuja coleta **não** fornece meta (ex.: Cobertura) → `400` ("o dado externo X nao fornece meta; informe a meta manualmente").
- `terceiro` + **apontamentos** → `400` ("meta via API exige um dado externo; com apontamentos so a integracao propria, ainda indisponivel").
- `terceiro` com `meta` ou `metas por filial` → `400`. `"meta editavel": true` → `400`.
- Vale igual no **Definir meta** (`PUT .../{id}/meta`) do indicador criado automaticamente: `{ "origem da meta": "terceiro", "sentido": "...", "meta editavel": false }`. Como esse indicador já tem um dado externo, a regra é a mesma.

Para o front saber quais dados externos podem ser usados com o checkbox, `GET /api/ped/dados-externos-cadastro` ganha, para todos os perfis, o campo **`fornece meta`** (`true`/`false`). O checkbox "Buscar metas via API" só deve ser oferecido quando o dado escolhido tem `fornece meta: true`.

### Etapa 2 — Outras fontes: integração própria do indicador (proposta do front)

Para meta vinda de **outro sistema** (ou composição por apontamentos), vale a proposta do front como está: identificador, URL, saída e entrada no indicador, `PUT .../{id}/integracao`, estado "integração pendente". Isso **exige um executor genérico** (que também serviria à integração do dado externo), e há perguntas de autenticação, método e segurança (seção 7). **Fica desligado até existir.**

Para diferenciar as duas fontes, o indicador `terceiro` passa a informar **`fonte da meta`**: `dado_externo` (etapa 1) ou `integracao` (etapa 2).

---

## 4. Contrato proposto

### 4.1 Listagem: `GET /api/ped/indicadores-cadastro`

Para indicador `terceiro` (todos os perfis, pois não há segredo):

| Campo | Conteúdo |
| --- | --- |
| `origem da meta` | `terceiro` (já existe). |
| `fonte da meta` | `dado_externo` ou `integracao`; `null` nos de meta manual. |
| `situacao da meta via api` | `ok` (fonte ERP com meta no mês aberto em ao menos uma filial), `sem_meta_no_mes` (a coleta não trouxe meta de nenhuma filial no mês aberto), `integracao_pendente` (etapa 2, sem integração salva), `aguardando_consulta` (etapa 2, integração salva e nenhuma consulta feita ainda), `erro` (etapa 2, última consulta falhou). `null` nos manuais. |
| `filiais sem meta` | Para `terceiro` na fonte ERP: códigos das filiais **sem meta no mês aberto** (meta `0` ou ausente no ERP). `[]` se nenhuma. |
| `meta`, `metas por filial`, `meta a definir` | `meta: null`, `metas por filial: null`, `meta a definir: false`. O front mostra "Via API". |

Só para o **Admin** e só na etapa 2 (como no dado externo): `identificador`, `url`, `parametros de saida`, `parametros de entrada`, `variaveis usadas`, `integracao pendente`, `integracao alterada em/por`, `ultima consulta em`, `erro da ultima consulta`.

- **`alertas`:** `aguardando meta` **não** conta `terceiro`. Campo novo `"integracao pendente": N` conta só `terceiro` na **etapa 2** sem integração salva (na etapa 1 não há pendência).
- **Filtro:** `situacao=integracao_pendente` (etapa 2).
- **Disponibilidade:** no topo da resposta, `"meta via api": { "dado externo": true, "integracao": false }`. O front mostra o checkbox só quando a fonte do caso está `true`.

### 4.2 Integração própria (etapa 2): `PUT /api/ped/indicadores-cadastro/{id}/integracao` (só Admin)

Exatamente como na proposta do front: mesmo corpo, validações, erros e resposta da integração do dado externo. Respostas: `200`, `400` com `erros` por campo, `400` se o indicador não for `terceiro` **com fonte `integracao`** (na fonte ERP: "a meta vem do dado externo"), `404`, `403`. Como na versão 1, a saída precisa trazer o campo `meta`.

### 4.3 "Editar metas" e dashboards

- **Editar metas:** o indicador `terceiro` não aparece em `GET /api/ped/metas`, e `PUT /api/ped/metas` para ele devolve **`403`** (já é o comportamento atual para indicador não editável). **Front:** tratar `403`, e não `400`.
- **Dashboards:** indicador `terceiro` na **fonte ERP** entra normalmente (a meta existe quando o ERP a devolve; filial sem meta fica sem atingimento). Na **etapa 2**, com integração pendente, não entra (`400`, "integracao da meta pendente").

---

## 5. Como a meta é calculada (precisamos alinhar uma regra)

Para um indicador `terceiro` na fonte ERP, a meta vigente de uma filial e mês é a meta que o ERP devolveu para a coleta do dado (em `ped_dados_externos`). **Não há ajuste manual** (`meta editavel = false`).

**Ponto a decidir (importante).** Hoje o dashboard calcula o **realizado** do dado externo conforme o **sentido** e a **janela retroativa** do dado (`soma`, `media` ou `ultimo`), mas a **meta** do indicador é a **média das metas mensais do período**. Para meta manual isso funciona. Para meta do ERP pode **descasar**: um dado com `soma` em 3 meses compara o realizado de 3 meses contra uma meta de 1 mês.

**Proposta:** para `terceiro`, a meta **acompanha o dado**: `soma` → soma das metas dos meses da janela; `media` → média das metas; `ultimo` → meta do mês. Assim realizado e meta cobrem o mesmo período. **O negócio confirma?**

---

## 6. Respostas aos pontos a decidir da proposta (seção 7 do front)

1. **Estrutura da saída.** Etapa 1: **não se aplica** (a fonte é a coleta do ERP, que já traz o realizado e a meta). Etapa 2: `meta` obrigatório; `filial` e `competencia` opcionais; uma chamada por filial e mês na v1.
2. **Quando a meta é buscada.** Etapa 1: **já é**, na coleta diária do ERP (06:00), gravada por filial e mês. Etapa 2: na coleta diária, gravando por filial e mês.
3. **Falha da consulta.** Etapa 1: a coleta do ERP já registra o erro e mantém a última meta boa. Etapa 2: uma nova tentativa, registrar `erro da ultima consulta` e `ultima consulta em`, e manter a última meta boa.
4. **Histórico.** Não entra no `metas-historico` por enquanto: aquela tabela exige "meta anterior" e "motivo". A meta do ERP fica gravada mês a mês.
5. **Filtro.** Sim, `situacao=integracao_pendente` (etapa 2).
6. **Trocar a origem depois de salvo.** Não: coerente com "meta só se define uma vez". Quem precisar recria o indicador.

---

## 7. Decisões em aberto

### 7.1 Do negócio
1. **Liberar a meta do ERP agora** (a P-15 deixou isso "para uma fase futura")? Entrando só **faturamento e os 6 volumes**.
2. **Regra de agregação** da seção 5: a meta acompanha o sentido e a janela do dado?
3. **Os outros 4 indicadores** (novos clientes, produto por PDV, cobertura, produtos parados): continuam com meta manual, ou o Senior passa a devolver meta para eles?

### 7.2 Só para a etapa 2 (outras fontes), quando houver uma fonte concreta
1. **Que outro sistema** seria a fonte, e como ele se autentica? A modal não tem cabeçalhos; o segredo não deve ficar no banco (iria no `.env`, referenciado por nome).
2. **Método HTTP** esperado (GET com query string ou POST com corpo).
3. **Segurança da URL:** o servidor chama a URL cadastrada; propomos restringir à rede interna ou a uma lista permitida.
4. **Variável `%empresa%`:** não existe hoje e algumas consultas do ERP a exigem.
5. A API devolve a meta de **uma filial** por chamada ou a **lista** de todas?

---

## 8. Entrega

| Etapa | Conteúdo | Observação |
| --- | --- | --- |
| **1** | Fonte ERP: `terceiro` com dado externo, `fornece meta`, listagem, `situacao da meta via api`, `meta via api` e regras de dashboard | **Sem migration** e **sem executor novo**: a coleta e as colunas já existem. |
| **2** | Integração própria do indicador, executor genérico, estado de consulta | Precisa de migration (colunas da integração e tabela da meta buscada) e das respostas de 7.2. Desligada até lá. |

Para o front, a etapa 1 já entrega valor: faturamento e volumes passam a ter meta automática, sem digitação.

---

## 9. Roteiro de teste

1. Cadastrar indicador com `terceiro` + dado externo de **faturamento**: `201`; `fonte da meta: dado_externo`; `meta a definir: false`; `situacao da meta via api: ok`; **não** entra em `alertas["aguardando meta"]`.
2. `terceiro` + dado externo de **cobertura** (sem meta no ERP): `400` ("nao fornece meta").
3. `terceiro` + apontamentos: `400`. `terceiro` com `meta`, `metas por filial` ou `meta editavel: true`: `400`.
4. A meta de cada filial no dashboard é a do ERP; filial com meta `0` fica **sem atingimento** ("sem meta") e aparece em `filiais sem meta`.
5. `GET /api/ped/metas` não lista o indicador; `PUT /api/ped/metas` para ele: `403`.
6. Em `GET /api/ped/dados-externos-cadastro`, faturamento e os 6 volumes vêm com `fornece meta: true`; os demais `false`.
7. `PUT .../integracao` num indicador na fonte ERP: `400` ("a meta vem do dado externo"). Etapa 2 (quando liberada): os casos da proposta do front.
8. Com `meta via api.integracao: false`, `POST` com `fonte da meta: integracao`: `400` ("ainda nao esta disponivel").

---

## 10. O que precisamos de volta

**Do front:**
1. A etapa 1 (sem integração no indicador, com `fornece meta` no dado externo) atende à tela? O checkbox passa a depender do dado escolhido.
2. Os campos `fonte da meta`, `situacao da meta via api`, `filiais sem meta` e `meta via api` cobrem o que a tela precisa mostrar?
3. O `403` em "Editar metas" para `terceiro` é tratável?

**Do negócio:** as três perguntas de 7.1.

**Da TI (somente se houver uma fonte além do ERP):** as perguntas de 7.2.
