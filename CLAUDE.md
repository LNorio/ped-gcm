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
| `npm run test:all` | Unitários + integração |
| `npm run test:load` | Teste de carga (`scripts/teste-carga.mjs`) |
| `npm run build:app` | Build sem testes — usado apenas pelo `build-validado` após aprovação |

O hook `.githooks/pre-commit` executa `scripts/testes-commit.mjs`, que roda os testes relacionados aos
arquivos do commit (ou todos, se mudar configuração ou houver exclusão em `src/`) e **bloqueia o commit**
se não houver 100% de sucesso, exibindo o percentual e os erros por bateria. Vale também para commits
feitos fora do Claude (o `npm install` ativa o hook). O hook do Claude Code em `.claude/settings.json`
impede o uso de `git commit --no-verify` e a desativação do hook.

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
| `ui-componentes` | Layout, componentes visuais reutilizáveis, estilos, navegação |
| `cadastro-formularios` | Telas de cadastro: formulários, validação, listagem, edição e exclusão |
| `integracao-api` | Serviços de acesso ao backend, tipos de dados, tratamento de erros de rede |
| `qualidade-testes` | Revisão de código, testes, build e lint antes de considerar uma tarefa concluída |
| `gerador-testes` | Ao concluir uma funcionalidade, componente ou marco: gera os testes unitários e de integração |
| `testes-unitarios` | Antes de todo commit: executa os testes unitários relacionados aos arquivos do commit |
| `testes-integracao` | Antes de todo commit: executa os testes de integração relacionados aos arquivos do commit |
| `build-validado` | Quando o usuário pedir a build: roda todos os testes e só gera a build com 100% de sucesso |
| `fechamento-dia` | Ao final do dia: registra implementações e modificações no diário e na documentação |
| `resumo-semanal` | Gera ou atualiza o resumo dos últimos 7 dias a partir da documentação |

## Fluxo de trabalho

1. **Entender** — leia o pedido e o código relevante. Se faltar informação de negócio
   (campos, regras, obrigatoriedade), pergunte ao usuário antes de delegar.
2. **Planejar** — quebre o pedido em atividades pequenas e independentes, indicando o agente de cada uma.
3. **Delegar** — envie cada atividade ao agente correspondente com contexto suficiente:
   objetivo, arquivos envolvidos, regras de negócio e critério de pronto.
   Atividades independentes podem rodar em paralelo; dependentes (ex.: tipos da API antes do
   formulário) rodam em sequência.
4. **Testar** — ao concluir uma funcionalidade, um componente ou um grande marco, acione
   `gerador-testes` com a lista de arquivos e a descrição do que foi feito.
5. **Validar** — acione `qualidade-testes` para revisar as alterações e rodar typecheck, lint e testes.
6. **Reportar** — resuma ao usuário o que foi feito, arquivos alterados e pendências.

## Commit

Quando o usuário pedir um commit:

1. Prepare os arquivos (`git add`) e obtenha a lista com `git diff --cached --name-only`.
2. Acione `testes-unitarios` e `testes-integracao` **em paralelo**, enviando a lista de arquivos.
3. Se ambos retornarem **APROVADO** (100%), faça o commit. O hook de pre-commit executa os testes
   novamente como garantia.
4. Se qualquer um retornar **REPROVADO**, **não faça o commit**. Informe ao usuário que o teste não foi
   concluído com sucesso, o percentual de sucesso de cada bateria e cada erro retornado.
5. Repasse ao usuário os alertas de arquivos sem testes relacionados.

## Build

Quando o usuário pedir a build do sistema, acione **somente** o agente `build-validado`; não rode
`npm run build:app` diretamente. Repasse ao usuário a tabela de resultados. Se a build não foi
realizada, deixe claro que houve falha nos testes e quais testes falharam.

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
- Toda tarefa só é considerada concluída com `npm run typecheck`, `npm run lint` e `npm run test:all`
  sem erros.
- Commits apenas quando o usuário pedir.
