# PED — Proposta: tipos de apontamento atualizados no acesso do usuário

Proposta do front de 18/11/2026. Trata do `GET /api/ped/acesso` e das rotas de tipos de apontamento (`POST/PUT /api/ped/tipos-apontamento`). Nenhuma rota nova é obrigatória.

## Problema

No "Novo apontamento" (aba Apontamentos) e no "Novo dado externo", o campo **Tipo** lista os `tipos` de `GET /api/ped/acesso`. O front lê o acesso **uma vez**, no login ou ao recarregar a página, e não lê de novo.

Caso real de 18/11/2026: o Admin criou o tipo personalizado **"Departamento Pessoal" (id 8)**. Ele aparece na `contagem por tipo` de `GET /api/ped/apontamentos`:

```json
"contagem por tipo": [
  { "id": 1, "nome": "Comercial", "quantidade": 0 },
  { "id": 7, "nome": "Contabilidade", "quantidade": 1 },
  { "id": 8, "nome": "Departamento Pessoal", "quantidade": 0 },
  { "id": 2, "nome": "Financeiro", "quantidade": 5 },
  { "id": 5, "nome": "Fiscal", "quantidade": 0 },
  { "id": 6, "nome": "Processos", "quantidade": 0 },
  { "id": 3, "nome": "Recursos Humanos", "quantidade": 3 },
  { "id": 4, "nome": "Tecnologia da Informação", "quantidade": 1 }
]
```

O campo Tipo do cadastro, porém, mostra só os 7 tipos fixos. "Departamento Pessoal" não aparece, então o Admin não consegue cadastrar apontamento nesse tipo.

Há duas causas:

1. **O acesso fica desatualizado.** Depois que um tipo é criado ou tem os vínculos alterados, o acesso guardado pelo front continua o mesmo até o próximo login.
2. **O que entra em `acesso.tipos` para o Admin e o Validador.** Pela API, o acesso traz os tipos vinculados ao usuário, diretamente ou por grupo. Já as listagens mostram ao Admin e ao Validador todos os tipos. Se o Admin não estiver vinculado ao tipo novo, ele não aparece no acesso dele nem depois de um novo login.

## Proposta

### 1. Tipos do Admin e do Validador no acesso (back-end)

O `GET /api/ped/acesso` passa a devolver em `tipos`:

- **Admin e Validador:** todos os tipos de apontamento ativos, os mesmos da `contagem por tipo`, na mesma ordem (por nome).
- **Preenchedor:** sem mudança, só os tipos vinculados a ele ou a algum grupo dele.

O formato continua o mesmo (`[{ "id", "nome" }]`).

### 2. Acesso atualizado depois de criar ou alterar um tipo

Há duas formas de fazer isso. Basta uma delas, e a escolha fica com o back-end.

- **Opção A, sem mudança no back-end:** o front faz uma nova chamada a `GET /api/ped/acesso`:
  - depois de um `POST` ou `PUT /api/ped/tipos-apontamento` com sucesso;
  - ao abrir o "Novo apontamento" e o "Novo dado externo". Isso cobre o tipo criado ou vinculado por **outro** usuário enquanto esta sessão estava aberta.

  O back-end só precisa confirmar que o `GET /api/ped/acesso` aguenta essas chamadas extras: ele é chamado a cada abertura de cadastro e não tem limite de uso documentado.
- **Opção B, com mudança no back-end:** `POST` e `PUT /api/ped/tipos-apontamento` devolvem também os tipos atualizados do usuário logado, num campo `"tipos do usuario": [{ "id", "nome" }]` (mesmo formato de `acesso.tipos`). O front troca a lista sem uma nova chamada. Essa opção **não** cobre o tipo criado por outro usuário, então o front faria a nova chamada ao abrir os cadastros mesmo assim.

**Recomendação do front:** item 1 mais a opção A. Assim o front não depende de mudar as rotas de tipos e ainda cobre as alterações feitas por outros usuários.

## O que o front faz

- Com o item 1, o campo Tipo do Admin e do Validador passa a listar todos os tipos assim que o acesso é lido.
- Com a opção A, o front lê o acesso de novo nos momentos descritos acima e atualiza o campo Tipo do "Novo apontamento" e do "Novo dado externo", além do que mais depender de `acesso.tipos`. Se a nova leitura falhar, o front mantém a lista anterior e não bloqueia o cadastro.

## Perguntas

1. O Admin e o Validador podem cadastrar apontamento e dado externo em **qualquer** tipo, mesmo sem vínculo com ele? Se não, qual é a regra? O `POST` recusa tipo não vinculado?
2. O back-end prefere a opção A (o front faz uma nova chamada ao acesso) ou a B (as rotas de tipos devolvem `tipos do usuario`)?
3. Para o Preenchedor vinculado a um tipo novo por outro usuário, a nova leitura do acesso ao abrir o cadastro é suficiente? Ou ele também deveria ver o tipo novo no filtro da listagem sem recarregar a página?
