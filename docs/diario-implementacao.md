# Diário de Implementação — PED

## 05/11/2026

**Resumo:** Três fases em TDD no mesmo dia: Indicadores (F6), Dashboards (F7) e Faixas (F8). Também houve ajustes de tela pedidos para seguir o protótipo e várias correções contra a API real. Dois commits locais, `f2f88d6` e `7df4dd4`, ainda não enviados ao GitHub.

### Implementações
- Testes TDD da F6 (Indicadores), F6.1–F6.9: 28 arquivos de teste, a fixture `indicadoresFalsos.ts` e os requisitos registrados como `pendente`.
- Aba Indicadores (F6.1–F6.6, F6.8, F6.9): serviço, listagem com etiquetas e `MenuAcoes`, filtros e alertas, cadastro, definir meta, inativar/reativar, histórico de metas em tabela própria e aviso de componente desativado.
- F6.7 (exclusão de indicador): o front ficou pronto (`DialogoExcluirIndicador`, `excluirIndicador`), mas a atividade continua bloqueada pela A-09 e o requisito segue `pendente`.
- Sinal de alerta nas abas do menu, pelo contexto `AlertasMenu` (`AlertasMenuProvider` no `LayoutPrincipal`).
- 14 ações novas de permissão: 5 de indicadores, 5 de dashboards e 4 de faixas.
- Aba Dashboards (F7.1–F7.10): serviço, listagem e filtros, `MenuAcoes` com os itens do RF-48, formulário com vínculo, indicadores e pontos base, prévia da tarefa, edição, pesos, histórico, ativar/desativar, concluir e excluir.
- Aba Faixas (F8.1–F8.6): serviço, lista de tabelas com `MenuAcoes`, nova tabela com `EditorFaixas` e validação das linhas, alteração com nova versão e motivo, histórico de versões e exclusão.
- Prop opcional `descricao` no `Select`, para a orientação do campo desabilitado.

### Modificações
- `Dialogo`: o cabeçalho passou de `header` para `div`, para não criar landmark "banner" dentro do diálogo. A rolagem passou a ficar dentro da modal, com cabeçalho e rodapé fixos (F1.17*).
- Modal "Novo indicador" com o visual do protótipo: 680 px, topo, blocos e rodapé, com escopo isolado por `:has()`.
- Composição do indicador (F6.4): dropdown com busca e lista só dos itens escolhidos, no lugar das caixas de seleção e dos rádios.
- Correção (F5.12*): `DadoExterno.indicadores` passou a `string[]`, porque a API real devolve só os nomes.
- Correção (F4.8*, F5.13*): regra "2xx = gravado" em ativar/desativar apontamento e dado externo e em concluir construção. Os testes de serviço foram separados em arquivos próprios.
- Modal de dashboard alinhada ao protótipo (F7.4–F7.8):
  - tarefa da TI sempre visível, com prévia automática 500 ms após a última alteração;
  - vínculo em dropdown;
  - "Indicadores vinculados" com totais;
  - bloco de tarefa de modificação na edição.
- RF-54 alterado: o indicador base da faixa fica só entre os indicadores vinculados ao dashboard e, junto com a fórmula, abaixo da seção "Indicadores vinculados".
- Correção (F7.11*): a tarefa Bitrix com `id: null` passou a ser aceita em dashboards e dados externos. "Tarefa nº" só aparece com número.
- Correção (F7.12*): a edição de dashboard parte dos códigos de `vinculos` (`codigosVinculados`), e não dos rótulos.
- Cadeado da pontuação base máxima fixado em 14 px.
- Fixture: o dado externo de Devoluções passou a "Devoluções (dado externo)". O teste de 404 passou a esperar "Registro não encontrado.", e a busca de moeda passou a usar o espaço especial do "R$".
- Diário e documentação de 04/11 incluídos no commit `f2f88d6`.

### Pendências
- Enviar ao GitHub os commits `f2f88d6` e `7df4dd4`.
- Confirmar formatos da API:
  - `vinculos` de dashboard por cargos e colaboradores;
  - `vinculos: null`;
  - `id` da tarefa omitido;
  - listagens de faixas e dashboards.
- Decisões do usuário:
  - rascunho no bloco da tarefa e asterisco nos campos obrigatórios;
  - descrição da tarefa de modificação, observação na edição e autor das tarefas anteriores;
  - fechar dropdowns com clique fora ou Esc;
  - exclusão de indicador pelo Validador;
  - sinal do menu no login e sinal de alerta para Dashboards;
  - alíquota até 100 e faixas sem lacuna;
  - quais dashboards oferecer no cadastro de faixas;
  - atualizar o texto do RF-54 no documento de requisitos.
- Riscos:
  - exclusão de tabela de faixas com `id dashboard` nulo;
  - lista inteira de colaboradores carregada no formulário de dashboard;
  - timeouts de testes sob carga.
- Bloqueadas: F2.7 (A-01), F3.4 e F3.5 (A-02), F5.10 (A-11) e F6.7 (A-09).
- Próxima fase: F9 (Preenchimento). F10.1 e F11.1 podem ser adiantadas em paralelo. Progresso do plano: 68% (73 de 108).
- Os dias 22/10 e 03/11 continuam sem fechamento.

---

## 04/11/2026

**Resumo:** Revisão de qualidade e commit da Fase 4 (aba Apontamentos) e implementação da Fase 5 (aba Dados Externos), com componentização da lógica comum, novo menu de ações, correção do POST contra a API real e aceleração da suíte de testes. Dois commits enviados ao GitHub (`cab66d2` e `aa6018f`).

### Implementações
- Aba Apontamentos (F4.1–F4.6): serviço, listagem com etiquetas e histórico de situação, filtros (busca, situação e tipo, com contagem), cadastro, ativar/desativar e exclusão com bloqueio quando compõe indicador.
- Infraestrutura de consulta e ações (F1.13*): `useConsulta`, `useAcaoConfirmada`, `EstadoCarga`, permissões de ação (`podeAcao`) e prop `obrigatorio` nos campos.
- Aba Dados Externos (F5.1–F5.9): serviço, listagem, filtros pela API, cadastro pelo Admin, pedido de construção à TI, Concluir construção, ativar/desativar e excluir.
- Hooks genéricos `useFiltrosConsulta` e `useAcoesSituacaoExclusao`, além da função `correspondeASituacao` (F1.14*).
- Componente reutilizável `MenuAcoes` (menu de três pontos acessível) (F1.16*).
- Função `limparIdentificador` (só A–Z, 0–9 e "_", em maiúsculas).
- Auxiliares de teste `usuarioRapido()` e `colar()` (`src/test/usuario.ts`) e `src/test/menuAcoes.ts`.

### Modificações
- Busca com espera de 500 ms após a última tecla, e item que deixa de corresponder ao filtro de situação saindo da lista na hora.
- Limites de tempo dos testes: `testTimeout` de 15 s e `asyncUtilTimeout` de 3 s.
- Aba Tipos migrada para `EstadoCarga` e `useAcaoConfirmada`, sem mudança de comportamento.
- Abas Apontamentos e Dados Externos migradas para os hooks genéricos (Apontamentos com −87 linhas).
- 59 arquivos de teste migrados para a digitação sem atraso (suíte de 284 s para 235 s, sem timeouts).
- Correção (F4.7*): POST de apontamento com 2xx passa a significar "gravado", e a lista é sempre recarregada.
- Correção (F5.11*): mesma regra no POST de dado externo, com retorno `{dadoExterno|null, tarefa|null}`.
- Correção: texto duplicado (`<strong>`) no diálogo Concluir construção.
- Diálogos "Novo apontamento" e "Novo dado externo" mais largos (`.dialogo--largo`, 800 px) (F1.15*).
- Tabela de Dados Externos enxuta: cinco colunas foram para os detalhes expandidos, e as ações e o "Ver detalhes" foram para o menu de três pontos.
- Prop `expandidas` (expansão controlada) no componente `Tabela`.
- Cadastro de dado externo: o campo ou cálculo passou a aparecer e ser obrigatório também para o Admin.
- Identificador do dado externo sem acento, espaço ou caractere especial, sem transliteração.
- Aba Apontamentos: as ações foram para o menu "Ações do apontamento X".
- `requisitos.json` e `docs/plano-implementacao.md` atualizados (progresso: 43/102 atividades, 40 requisitos `implementado`).

### Pendências
- Confirmar com o back-end o formato das respostas de POST/PUT/DELETE que seguem estritas (`alterarSituacao`, `concluirConstrucao`, `alterarSituacaoDadoExterno`, `excluirDadoExterno`, criar e editar em `tiposService`).
- Decisões da revisão da F5: botão de fechar no aviso de indicador criado, plural "usado por N dado(s)", aviso sem tipos no formulário e lacunas de teste (`SugestoesIdentificador`).
- Próxima fase: F6 (Indicadores), começando pelo serviço F6.1. Confirmar se a aba usa o `MenuAcoes` e a tabela enxuta.
- Itens bloqueados: F2.7 (A-01), F3.4 e F3.5 (A-02), F5.10 (A-11) e F6.7 (A-09).

---
