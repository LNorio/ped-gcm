# Consistência de mês e escopo de filial (A-05, A-09, A-11, A-18)

Para quem desenvolve o front. Nenhum campo foi renomeado ou removido. Nenhuma rota nova. O front atual continua funcionando; há **três comportamentos que podem aparecer diferentes** (itens 1, 2 e 3 abaixo) e que vale conferir.

## 1. Mês de referência (A-05)

Regra nova: `mes de referencia` representa o **mês inteiro**. Na gravação o back guarda sempre o dia 1. Na leitura compara por mês, então linhas antigas gravadas com outro dia (ex.: `2026-09-17`) continuam sendo encontradas.

Vale para: Premiação, Comissão, Descontos/Bonificações, Lançamentos e Lançamentos Desligados.

| Situação | Antes | Depois |
|---|---|---|
| Salvar com `"mes de referencia": "2026-09-17"` | gravava dia 17; outro dia do mesmo mês criava outra linha | grava `2026-09-01`; atualiza a linha do mês, qualquer dia enviado |
| `GET /api/premiacoes?data_inicio=2026-09-10&data_fim=2026-09-20` | só linhas com data entre 10 e 20 | do dia 1 de setembro ao dia 30: o mês inteiro |
| `mes de referencia` / agrupamento no `GET /api/premiacoes` | o dia gravado | sempre `AAAA-MM-01` |
| `GET /api/lancamentos/desligados` -> `mes de referencia` | o dia gravado | sempre `AAAA-MM-01` |
| `GET /api/comissoes` sem `mes_de_referencia` | `500` | `200` com PEV `0` e comissão/garantido `0` |

Exemplo (Premiação, depois):

```json
{ "mes de referencia": "2026-09-01", "dados": [ { "id colaborador": 12, "...": "..." } ] }
```

O que o front deve conferir:
- Telas que **comparam** o `mes de referencia` devolvido com a data que enviaram (ex.: enviou `2026-09-17`, espera receber `2026-09-17`): passar a comparar por ano e mês, ou a esperar o dia 1.
- Telas de Premiação que enviam `data_inicio`/`data_fim` no meio do mês: o resultado agora inclui o mês inteiro. O "mês único" (colaboradores zerados) continua valendo quando início e fim caem no mesmo mês.
- Dados antigos: se um colaborador tinha duas linhas no mesmo mês gravadas em dias diferentes (legado), o `GET /api/premiacoes` pode mostrar as duas dentro do mesmo grupo do mês. Em Comissão, Lançamentos e Desligados o back escolhe uma (a do dia 1, senão a de menor id). Se aparecer duplicidade, avisar a TI.
- A Comissão sem `mes_de_referencia` deixou de dar erro; o front não deve depender disso, continue enviando o mês.
- Desconto/Bonificação continua aceitando **vários itens** por colaborador/mês (só o dia vai para 1).

## 2. Escopo de filial em leituras (A-09)

| Rota | Admin | Demais papéis |
|---|---|---|
| `GET /api/valores-plano-saude` | vê tudo; `filial=<codigo>` filtra; `filial=todas` (ou omitir) = todas | **só a própria filial**; o parâmetro `filial` é ignorado; sem filial no cadastro = lista vazia |
| `GET /api/bloqueios` | idem | idem |

Antes, qualquer usuário autenticado podia pedir qualquer `filial` nessas duas rotas. Agora:
- Um gerente/coordenador/vendedor que lia valores de plano ou bloqueios de **várias filiais** (ex.: tela de comparação, seletor de filial) passa a receber só a dele. O seletor de filial dessas telas só faz sentido para Admin.
- Antes `filial=todas` nessas rotas era tratado como código de filial (resultado vazio); agora funciona para Admin.
- Escritas dessas rotas continuam só Admin. O cálculo de valor nos Lançamentos não mudou.

## 3. Validação de usuários (A-11)

`POST /api/usuarios` e `PUT /api/usuarios/{id}` passam a devolver **`400`** (com `mensagem`) onde antes davam `500`:
- `telas` com id que não existe (`telas` deve ser lista de ids de `GET` de telas);
- `plano saude` / `plano odontologico` / `desligado` / `precisa trocar senha` que não sejam booleano (`true`, `false`, `1`, `0`);
- texto maior que o banco aceita: `codigo` até 20, `nome` até 100, `cpf` até 14, `funcao` até 45, `email` até 100, `usuario` até 45 caracteres.

Também: `PUT` agora valida `nome` e `funcao` (se enviados, não podem ser vazios). Antes, vazio era aceito/estourava.

O front deve: mostrar `mensagem` do `400` ao usuário e limitar os campos de texto a esses tamanhos (CPF com máscara cabe em 14).

## 4. Lotes transacionais (A-18)

Os `PUT` em lote (Premiação, Comissão, Descontos, Lançamentos, Adiantamento do Consolidado) passaram a gravar **tudo ou nada**. Respostas inalteradas. Se um item falhar, nenhum do lote é salvo (antes, os anteriores já ficavam gravados). O front não precisa mudar; se tratava "salvou parcialmente", isso deixou de acontecer.

## O que continua igual
Nomes de campos e rotas, formato das respostas, mensagens de sucesso, códigos `400/403/404`, escopo e permissões dos demais endpoints, vários itens de desconto por colaborador/mês.

## Roteiro de teste sugerido
1. Salvar premiação/comissão/lançamento com data no meio do mês e ler de volta: vem dia 1, sem linha duplicada.
2. Reabrir um mês antigo já lançado: valores aparecem.
3. Logar como gerente e abrir telas de valores de plano e de bloqueios: só a filial dele.
4. Logar como Admin: seletor de filial e "todas" funcionam.
5. Cadastrar/editar colaborador com telas inválidas e nome vazio: aparece o `400`.
