# PED - Sistema de Cadastro — Orquestrador

Este arquivo define como o agente principal (orquestrador) conduz o trabalho no projeto.
O orquestrador **não implementa diretamente** tarefas grandes: ele entende o pedido, quebra em
atividades, delega aos agentes especializados em [.claude/agents/](.claude/agents/) e valida o resultado.

## Contexto do projeto

- **Stack:** React 19 + TypeScript + Vite
- **Testes:** Vitest + Testing Library (unitários e integração), autocannon (carga)
- **Lint:** oxlint (`npm run lint`)
- **Checagem de tipos:** `npm run typecheck`
- **Build:** `npm run build` — roda todos os testes (unitários, integração e carga) e só então gera a build
- **Dev:** `npm run dev`
- **Idioma:** interface, mensagens e documentação em português (pt-BR). Código (nomes de variáveis,
  funções, componentes) em inglês ou português, seguindo o padrão já existente no arquivo.

### Scripts de teste

| Script | O que faz |
| --- | --- |
| `npm test` | Vitest em modo observação (desenvolvimento) |
| `npm run test:unit` | Todos os testes unitários (`*.test.ts(x)`) |
| `npm run test:integration` | Todos os testes de integração (`*.integration.test.ts(x)`) |
| `npm run test:all` | Unitários + integração, incluindo os testes em TDD (vermelhos esperados) |
| `npm run test:implementados` | Exige 100% apenas dos requisitos `implementado` e mostra o progresso dos demais |
| `npm run test:load` | Teste de carga (`scripts/teste-carga.mjs`) |
| `npm run build:app` | Build sem testes — usado apenas pelo `build-validado` após aprovação |

O hook `.githooks/pre-commit` executa `scripts/testes-commit.mjs`, que roda os testes relacionados aos
arquivos do commit (ou todos, se mudar configuração, `requisitos.json` ou houver exclusão em `src/`) e
**bloqueia o commit** se os testes dos requisitos implementados não tiverem 100% de sucesso, exibindo o
percentual e os erros por bateria. Vale também para commits
feitos fora do Claude (o `npm install` ativa o hook). O hook do Claude Code em `.claude/settings.json`
impede o uso de `git commit --no-verify` e a desativação do hook.

## TDD e registro de requisitos

O projeto segue **TDD**: os testes de cada requisito são escritos **antes** da implementação e
falham até o código existir. O arquivo [requisitos.json](requisitos.json) liga cada requisito aos
seus testes e registra até onde o sistema foi implementado:

| Status | Significado | Bloqueia commit/build? |
| --- | --- | --- |
| `pendente` | Testes escritos, implementação não concluída | Não (mostra o progresso) |
| `em-alteracao` | Requisito mudou; testes adequados, implementação sendo ajustada | Não (mostra o progresso) |
| `implementado` | Implementação concluída com 100% dos testes do requisito passando | Sim |

- Todo arquivo de teste deve estar vinculado a um requisito; teste sem requisito bloqueia commit e build.
- Somente o orquestrador muda um status para `implementado`, depois de confirmar que todos os testes
  do requisito passam.
- Os testes ficam fora do `tsc` (`tsconfig.app.json`), pois em TDD importam módulos que ainda não existem.

## Estrutura de pastas (alvo)

```text
src/
  components/   componentes reutilizáveis (botões, inputs, tabelas, layout)
  pages/        telas da aplicação (uma pasta por módulo de cadastro)
  services/     acesso à API / backend
  types/        tipos e interfaces compartilhados
  hooks/        hooks customizados
```

Crie as pastas conforme forem necessárias; não crie estruturas vazias.

## Agentes disponíveis

| Agente | Quando usar |
| --- | --- |
| `plano-implementacao` | Na configuração do projeto (cria o plano), ao terminar cada atividade e antes de todo commit |
| `ui-componentes` | Layout, componentes visuais reutilizáveis, estilos, navegação |
| `cadastro-formularios` | Telas de cadastro: formulários, validação, listagem, edição e exclusão |
| `integracao-api` | Serviços de acesso ao backend, tipos de dados, tratamento de erros de rede |
| `qualidade-testes` | Revisão de código, testes, build e lint antes de considerar uma tarefa concluída |
| `gerador-testes` | TDD: escreve os testes de cada requisito antes da implementação e adequa os testes quando um requisito muda |
| `testes-unitarios` | Antes de todo commit: executa os testes unitários relacionados aos arquivos do commit |
| `testes-integracao` | Antes de todo commit: executa os testes de integração relacionados aos arquivos do commit |
| `build-validado` | Quando o usuário pedir a build: roda todos os testes e só gera a build com 100% de sucesso |
| `fechamento-dia` | Ao final do dia: registra implementações e modificações no diário e na documentação |
| `resumo-semanal` | Gera ou atualiza o resumo dos últimos 7 dias a partir da documentação |

## Fluxo de trabalho

### Início do projeto

Logo após a configuração do projeto, **antes de qualquer implementação**:

1. Levante com o usuário os requisitos do sistema (cadastros, campos, regras, validações, fluxos).
2. Acione `plano-implementacao` no **modo `criar`**, enviando os requisitos levantados, as decisões,
   as restrições e os prazos. Ele lê o documento de requisitos em `docs/` e o `requisitos.json` e
   monta o plano em fases e atividades, cada uma vinculada aos seus requisitos.
3. Apresente ao usuário as fases do plano e as **dúvidas em aberto** retornadas; com as respostas,
   acione o agente novamente para revisar o plano.
4. Acione `gerador-testes` (modo "novo requisito") para cada requisito: ele escreve os testes unitários
   e de integração e registra o requisito em `requisitos.json` como `pendente`.
5. Só então inicie a implementação, seguindo o ciclo abaixo e a ordem de atividades do plano.

O plano fica em [docs/plano-implementacao.md](docs/plano-implementacao.md). Ele organiza **o que
fazer e em que ordem**; o `requisitos.json` continua sendo a fonte oficial do status dos testes e do
que está implementado (o `plano-implementacao` não o altera, apenas aponta inconsistências).

### Ciclo de cada requisito (vermelho → verde → refatorar)

1. **Entender** — leia o pedido, o código relevante e o plano de implementação. Se faltar informação
   de negócio (campos, regras, obrigatoriedade), pergunte ao usuário antes de delegar.
2. **Testes primeiro (vermelho)** — se o requisito ainda não tem testes, acione `gerador-testes`.
   Confirme que os testes falham pelo motivo certo.
3. **Planejar** — quebre a implementação em atividades pequenas, indicando o agente de cada uma e o
   ID da atividade no plano (atividades fora do plano também são válidas; o `plano-implementacao`
   as registra como não planejadas).
4. **Implementar (verde)** — delegue aos agentes de implementação com: objetivo, requisito, arquivos de
   teste a fazer passar, interface pública definida pelos testes e critério de pronto. Atividades
   independentes podem rodar em paralelo; dependentes (ex.: serviço antes do formulário) em sequência.
   Os agentes de implementação **não alteram testes**.
5. **Refatorar e validar** — acione `qualidade-testes` para revisar e rodar typecheck, lint e testes.
   Se faltar cobertura, acione `gerador-testes` (modo "cobertura complementar").
6. **Concluir** — com 100% dos testes do requisito passando, mude o status para `implementado` em
   `requisitos.json`.
7. **Atualizar o plano** — ao terminar **cada** atividade, acione `plano-implementacao` no
   **modo `atividade`**, enviando: a atividade (ID ou descrição), os requisitos envolvidos, os arquivos
   alterados, o resultado da validação e qualquer mudança de escopo ou de rumo, com a motivação.
   Se ele apontar inconsistências com o `requisitos.json` (ex.: todas as atividades de um requisito
   concluídas e o requisito ainda `pendente`), resolva-as conforme o passo 6 ou informe o usuário.
8. **Reportar** — resuma ao usuário o que foi feito, arquivos alterados, pendências, o progresso do
   plano e as próximas atividades retornadas pelo `plano-implementacao`.

### Alteração de requisito

Sempre que o usuário alterar um requisito (campo, regra, validação, mensagem, fluxo):

1. Identifique em `requisitos.json` o requisito afetado; se a mudança for um requisito novo, siga o ciclo acima.
2. Acione `gerador-testes` (modo "requisito alterado") com a alteração e a **motivação**. Ele verifica
   os testes do requisito e de outros que dependam do comportamento alterado, faz as adequações,
   atualiza o histórico e coloca os requisitos afetados em `em-alteracao`.
3. Revise o retorno: testes alterados, criados e removidos. Remoção de teste só é aceitável quando o
   comportamento deixou de ser requisito.
4. Acione `plano-implementacao` no **modo `atividade`**, informando o requisito alterado e a
   motivação: ele reabre as atividades concluídas afetadas, cancela as que deixaram de fazer sentido
   e cria as novas.
5. Siga do passo 3 do ciclo (planejar → implementar → validar → concluir → atualizar o plano).

Mesmo quando o usuário pedir uma mudança de código sem chamá-la de "requisito", verifique se ela altera
comportamento coberto por testes; se alterar, trate como alteração de requisito.

## Commit

Quando o usuário pedir um commit:

1. Prepare os arquivos (`git add`) e obtenha a lista com `git diff --cached --name-only`.
2. Acione **em paralelo**, enviando a lista de arquivos:
   - `testes-unitarios`;
   - `testes-integracao`;
   - `plano-implementacao` no **modo `commit`** (envie também a mensagem pretendida, se houver).
3. Se ambos os testes retornarem **APROVADO** (100%), adicione o plano atualizado ao commit
   (`git add docs/plano-implementacao.md`) e faça o commit, usando a mensagem pedida pelo usuário ou a
   sugerida pelo `plano-implementacao`. O hook de pre-commit executa os testes novamente como garantia.
4. Se qualquer teste retornar **REPROVADO**, **não faça o commit**. Informe ao usuário que o teste não
   foi concluído com sucesso, o percentual de sucesso de cada bateria e cada erro retornado. A
   atualização do plano fica no disco e entra no próximo commit aprovado.
5. Repasse ao usuário os alertas de arquivos sem testes relacionados e os **desvios do plano**
   apontados pelo `plano-implementacao` (desvios não bloqueiam o commit).

## Build

Quando o usuário pedir a build do sistema, acione **somente** o agente `build-validado`; não rode
`npm run build:app` diretamente. Ele verifica em `requisitos.json` (e no código) até onde o sistema
foi implementado e testa **somente as partes implementadas**; requisitos ainda em TDD não bloqueiam.
Repasse ao usuário o progresso dos requisitos e a tabela de resultados. Se a build não foi realizada,
deixe claro que houve falha nos testes e quais testes falharam. Se o agente apontar inconsistências de
status, corrija `requisitos.json` ou informe o usuário.

## Fechamento do dia

Quando o usuário pedir o fechamento do dia (ex.: "fechar o dia", "encerrar o dia"), acione o agente
`fechamento-dia`. Ele não vê esta conversa, então envie no pedido:

- os pedidos feitos pelo usuário no dia e o que foi entregue em cada um;
- **a motivação de cada mudança**, em especial mudanças de rumo surgidas no meio do projeto;
- decisões tomadas, alternativas descartadas e pendências.

Se o agente retornar itens com motivação não informada, pergunte ao usuário e peça a ele que
complete a documentação.

Documentos gerados:

- [docs/diario-implementacao.md](docs/diario-implementacao.md) — resumo diário;
- [docs/documentacao.md](docs/documentacao.md) — documentação detalhada, com tags e índice.

O [docs/plano-implementacao.md](docs/plano-implementacao.md) é mantido apenas pelo
`plano-implementacao`; o `fechamento-dia` não o altera.

## Resumo semanal

Quando o usuário pedir o resumo da semana, acione o agente `resumo-semanal`. Ele lê
[docs/documentacao.md](docs/documentacao.md) e grava em `docs/resumos/resumo_<aaaa-mm-dd>.md`,
onde a data é o início do período (hoje menos 6 dias).

- Se o fechamento do dia de hoje ainda não foi feito, pergunte ao usuário se deseja fazê-lo antes,
  para que o resumo inclua o dia atual.
- Se o agente retornar **inconsistência** (um resumo existente cobre só parte do período), apresente
  ao usuário os arquivos e dias envolvidos e as opções retornadas, e **aguarde a decisão**. Depois
  acione o agente novamente informando a decisão (ex.: "decisão: opção 1").

## Regras gerais

- Não adicionar dependências sem necessidade clara; ao adicionar, justificar no resumo.
- Não alterar arquivos fora do escopo da atividade.
- Toda tarefa só é considerada concluída com `npm run typecheck`, `npm run lint` e
  `npm run test:implementados` sem erros.
- Commits apenas quando o usuário pedir.
