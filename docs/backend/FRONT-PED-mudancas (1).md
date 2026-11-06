# PED — o que mudou no back e o que o front precisa implementar

Guia para o dev front. O contrato completo continua em `API.md`; aqui está só o que é **novo ou diferente** desde a última entrega, tela por tela, com exemplos.

Convenções que não mudaram: `Authorization: Bearer {token}`; chaves de corpo JSON em português **com espaço** (`"id colaborador"`); parâmetros de query string com **underscore** (`?id_colaborador=1`); erros de validação voltam `400` com `{ "mensagem": "..." }`; falta de permissão volta `403`.

---

## 1. Usuário sem acesso ao PED

`GET /api/ped/acesso` devolve `"perfil": null` quando o usuário não tem perfil (nem é Admin do sistema).

**Front:** se `perfil` for `null`, não abrir o PED. Mostrar uma tela com a mensagem:

> Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal

Os demais endpoints do PED respondem `403` com `"usuario sem acesso ao PED"` para esse usuário.

O perfil (`admin`, `validador`, `preenchedor`) agora vem dos **grupos do usuário no ERP** (ver item 8), definido pelo back. O front só lê.

---

### Novos papéis no cadastro de colaboradores (Premiações)

`POST /api/usuarios` e `PUT /api/usuarios/{id}` passam a aceitar `"role": "validador"` e `"role": "preenchedor"`, além de `admin`, `gerente`, `coordenador`, `vendedor` e `padrao`. O login (`POST /api/valida-usuario`) devolve esse `role`.

- No **Premiações** esses dois papéis se comportam como os demais não-admin: entram normalmente e só enxergam a própria filial.
- No **PED** o papel vale como perfil quando o colaborador não tem perfil definido pelo ERP (`ped_perfil`); o perfil do ERP, quando existe, vence.
- **Front:** acrescentar `Validador` e `Preenchedor` nas opções de papel do cadastro de colaborador e tratar esses valores de `role` na navegação.

---

## 2. Filiais: quem vê o quê

| Perfil | Filiais visíveis |
|---|---|
| Admin e Validador | **Todas** |
| Preenchedor (e demais) | A própria **mais as da abrangência** |

- O seletor de filiais deve usar `GET /api/ped/acesso` → `filiais` (lista de `{ "filial", "nome filial" }`) e `"todas as filiais"` (`true` para Admin e Validador).
- `GET /api/ped/filiais` devolve a mesma lista.
- Quando `"todas as filiais": true`, mostrar a opção "Todas" no seletor (`?filial=todas` ou omitir o parâmetro). Para os demais, não mostrar "Todas": se houver mais de uma filial, o usuário escolhe uma; se enviar `?filial=` fora da lista, o back responde `403` (`"voce nao tem acesso a esta filial"`).
- **Preenchimento de apontamentos** exige sempre uma filial escolhida (a opção "Todas" não vale). Para quem tem uma só filial, usar a própria.
- **Faixas** e **Imagens** (aba de fechamento): só Admin e Validador, **de todas as filiais**. O Preenchedor recebe `403` (não mostrar essas abas para ele).

---

## 3. Aba Usuários (Admin) — abrangência e grupos

`GET /api/ped/usuarios` (só Admin) agora traz, por usuário:

```json
{
  "id colaborador": 12, "nome": "...", "perfil": "preenchedor",
  "tipos": [{ "id": 1, "nome": "Comercial" }],
  "abrangencia": ["101", "200"],
  "grupos": ["DEF_OPERADOR DE CAIXA"]
}
```

- `abrangencia`: códigos das filiais **além da própria**.
- `grupos`: grupos do ERP do usuário (somente leitura).

`PUT /api/ped/usuarios/{id}/acesso` (só Admin) aceita `filiais` além de `perfil` e `tipos`:

```json
{ "perfil": "preenchedor", "tipos": [1, 3], "filiais": ["101", "200"] }
```

- Todos os campos são opcionais; só o que vier é alterado. `"filiais": []` limpa a abrangência **cadastrada à mão**.
- A abrangência que vem do ERP é gravada pela rotina do back e **não** some ao salvar aqui.
- O perfil também é definido pelo ERP quando o usuário está em um grupo mapeado; um `PUT` manual de perfil pode ser sobrescrito na próxima sincronização.

---

## 4. Aba Tipos — Admin **e** Validador

Antes só o Admin acessava. Agora **Admin e Validador** consultam e gravam. O vínculo principal é **grupo → tipo** (o vínculo direto por usuário continua existindo e soma-se).

### Listar grupos do ERP (novo)

`GET /api/ped/grupos` (Admin e Validador). Filtro opcional `?busca=`.

```json
[{ "id": 4, "nome": "DEF_OPERADOR DE CAIXA", "quantidade usuarios": 37, "tipos": [{ "id": 1, "nome": "Comercial" }] }]
```

### Tipos

`GET /api/ped/tipos-apontamento` — para Admin e Validador cada tipo traz `usuarios` e `grupos` (`[{ "id", "nome" }]`). Para o Preenchedor esses dois vêm `null` e a lista só tem os tipos dele.

`POST /api/ped/tipos-apontamento` (Admin e Validador):

```json
{ "nome": "Financeiro", "grupos": [4, 7], "usuarios": [12] }
```

Exige **ao menos um grupo ou um usuário** (senão `400`: `"informe ao menos um grupo ou usuario"`). Nome único, sem diferenciar maiúsculas.

`PUT /api/ped/tipos-apontamento/{id}` (Admin e Validador):

```json
{ "grupos": [4] }
```

Troca **só a lista enviada**: se mandar só `grupos`, os `usuarios` ficam como estão (e vice-versa). Vale para tipo fixo ou personalizado; o nome não muda.

`DELETE /api/ped/tipos-apontamento/{id}` — Admin e Validador; só tipo personalizado e sem apontamentos.

**Front:** na tela de tipos, trocar o seletor "usuários vinculados" por um seletor de **grupos** (alimentado por `/ped/grupos`) e manter, se quiser, o de usuários como opção secundária.

---

## 5. Indicadores — excluir (novo)

`DELETE /api/ped/indicadores-cadastro/{id}` — **só Admin**.

- `200` `{ "mensagem": "indicador excluido" }`.
- `400` se o indicador está em algum dashboard (ou é o indicador-base das faixas de um): vem `"mensagem"` e `"dashboards": ["Nome 1", ...]`. Mostrar a lista para o usuário.
- `404` se não existir.

A exclusão é lógica: o indicador some das telas. Por isso, **apontamento e dado externo que já compuseram um indicador (mesmo excluído) não podem ser excluídos**. O `DELETE` deles responde `400` com `"mensagem"` e `"indicadores": [...]` (a lista inclui os já excluídos).

Sugestão: botão "Excluir" no indicador, com confirmação, visível só para Admin.

---

## 6. Período — reabertura de mês (Admin)

`POST /api/ped/periodo/abrir` (só Admin), corpo `{ "mes de referencia": "2026-09-01" }` (qualquer dia do mês).

- Agora aceita **mês passado** (reabre). Mês futuro e o mês que já é o aberto continuam `400`.
- Resposta `201`: `{ "mensagem": "periodo aberto" | "periodo reaberto", "mes de referencia": "2026-09-01" }`.
- Só **um mês fica aberto por vez**: reabrir setembro fecha o mês que estava aberto. Para voltar ao mês corrente, abra-o de novo.
- `GET /api/ped/periodo` e `GET /api/ped/periodo/historico` ganharam `"reaberto": true|false`.

**Front:** no seletor de mês do Admin, permitir escolher meses passados; avisar "isto fechará o preenchimento de <mês atual>"; indicar visualmente quando o mês aberto é uma reabertura.

---

## 7. Dados externos — referência e identificador

- **Referência:** `colaborador` e `zona` agora são aceitas no `POST /api/ped/dados-externos-cadastro`. Mostrar as **três opções habilitadas** (Filial, Colaborador, Zona de venda). Para colaborador e zona não há coleta ainda: o dado é cadastrado, mas vem `"coleta disponivel": false` e o realizado (`GET .../{id}/realizado`) vem com `"valor": null`. Tratar como "sem coleta ainda", não como erro.
- **Identificador da consulta:** aceita só letras **sem acento**, números, `_`, `-` e `.` — **sem espaços** (ex.: `NOVOS_CLIENTES`). Caso contrário, `400` com a mensagem `"o identificador so aceita letras sem acento, numeros, _ , - e . (sem espacos)"`. O front pode validar antes (regex `^[A-Za-z0-9_\-\.]+$`) e já mostrar a mensagem no campo.
- Quem cadastra: o **Admin** cadastra já ativo (identificador obrigatório) e **não gera tarefa**; **Validador e Preenchedor** cadastram "em construção" e geram tarefa para a TI (ver `FRONT-tarefas-bitrix.md`).

---

## 8. Imagens congeladas — por filial **ou** por colaborador

`GET /api/ped/imagens` e `GET /api/ped/imagens/{id}` agora trazem, em cada imagem:

```json
{ "id": 10, "codigo": "IMG-000010", "filial": "101", "tipo": "colaborador", "id colaborador": 55, "colaborador": "Fulano" }
```

- `tipo`: `"filial"` ou `"colaborador"`. `"id colaborador"` é o colaborador a quem a imagem se refere (nulo nas de filial). Não confundir com `"usuario"`, que é **quem encerrou** o período.
- Novos filtros de query: `?tipo=filial|colaborador` e `?id_colaborador=55`, além de `filial`, `periodo`, `dashboard` e `busca`.
- Dashboard vinculado a **filiais** gera imagens de filial; vinculado a **cargos** ou **colaboradores** gera uma por colaborador.

**Front:** mostrar o tipo (ícone ou coluna "Filial / Colaborador") e oferecer o filtro por tipo.

---

## 9. Perfil e grupos do ERP (referência para o time)

Definidos pelo back, sem tela própria além dos itens 3 e 4:

| Grupo no ERP | Perfil no PED |
|---|---|
| `SENIOR` | Admin |
| `DEF_ANALISTA DE DESENVOLVIMENTO` | Validador |
| `DEF_OPERADOR DE CAIXA` | Preenchedor |

Quem está em mais de um desses grupos fica com o perfil mais alto. Regra provisória: pode mudar. A rotina que sincroniza isso é do back; o front não chama nada.

---

## 10. Resumo de endpoints novos ou alterados

| Endpoint | Mudança |
|---|---|
| `GET /api/ped/acesso` | `filiais` e `todas as filiais` conforme o item 2; `perfil: null` = sem acesso |
| `GET /api/ped/grupos` | **novo** (Admin e Validador) |
| `GET /api/ped/usuarios` | + `abrangencia`, `grupos` |
| `PUT /api/ped/usuarios/{id}/acesso` | + `filiais` |
| `GET/POST/PUT/DELETE /api/ped/tipos-apontamento` | Admin e Validador; `grupos` além de `usuarios` |
| `DELETE /api/ped/indicadores-cadastro/{id}` | **novo** (Admin) |
| `POST /api/ped/periodo/abrir` | aceita mês passado; `reaberto` nas respostas |
| `POST /api/ped/dados-externos-cadastro` | referências `colaborador` e `zona`; mensagem clara do identificador; `tarefa` com `status` e `id bitrix` |
| `GET /api/ped/imagens` e `/{id}` | + `tipo`, `id colaborador`; filtros `tipo` e `id_colaborador` |
| `GET/POST/PUT /api/ped/dashboards` | `tarefa` com `status` e `id bitrix` (ver `FRONT-tarefas-bitrix.md`) |
