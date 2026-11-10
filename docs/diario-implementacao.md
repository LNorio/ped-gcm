# Diário de Implementação — PED

## 09/11/2026

**Resumo:** A build foi gerada com a máquina aliviada, os indicadores vinculados voltaram a aparecer na aba Apontamentos (F4.9\*) e a mudança de requisito "integração de dados externos" foi implementada em TDD. De manhã foi feita só a tela; à tarde o front foi adequado ao contrato publicado pelo back-end. Ao fim do dia, 72 requisitos implementados e plano em 72% (83/116). Nada foi commitado.

### Implementações
- Build validada às 09:21, já com a F4.9\*: 67/67 requisitos, unitários 2646/2646, integração 377/377 e carga com 100% de 2xx (28.185 requisições, média de 17 ms, p99 de 42 ms). Bundle `index-BVDCRcit.js` com 493 kB.
- Motor local de validação da integração (F5.14), em `src/utils/integracao/`:
  - parser JSON próprio com linha, coluna e mensagens em pt-BR;
  - validação da URL e dos parâmetros de saída;
  - expressões com precedência, datas, sufixos `m`/`a` e ajuste de fim de mês;
  - parâmetros de entrada com cálculos e prévia;
  - modelos ("Inserir modelo") e valores de exemplo.
- Variáveis da integração pela API (F5.15): `GET /api/ped/integracao/variaveis`, com `exemplo` usado na prévia. Painel de variáveis e operadores na modal, inseridos no cursor.
- Configurações da integração (F5.16, só Admin): ação "Configurações" / "Preencher integração" no menu, que grava por `PUT .../{id}/integracao`. Nova permissão `configurar-integracao-dado-externo`.
- Alerta de integração pendente (F5.17, só Admin): `GET .../integracoes-pendentes`, aviso com "Ver pendentes", sinal na aba Dados Externos e etiqueta "Integração pendente (TI)".
- Validação híbrida pelo back-end (F5.18): o motor local responde na hora; `POST /api/ped/integracao/validar`, cerca de 400 ms depois, prevalece. Se a chamada falhar, fica o resultado local.
- Documentos incluídos no repositório: `docs/PED — Mudança de requisito integração de dados externos.md`, `docs/backend/FRONT-integracao-dado-externo.md` e `docs/backend/API (25).md`.

### Modificações
- Build: as tentativas de 06/11 e a primeira de 09/11 falharam por timeout, com a máquina sobrecarregada (jogo, Spotify, Riot, Steam). Com os programas fechados, passou: primeiro com 2627/375 e depois com a F4.9\*.
- Correção (F4.9\*): os indicadores do apontamento vêm da API como lista de nomes. A coluna Indicadores e o aviso de bloqueio da exclusão voltaram a mostrar os nomes. Afetou F4.1, F4.2 e F4.6.
- Concluir construção (F5.7): a modal ganhou quatro campos obrigatórios (identificador, URL, JSON de saída e JSON de entrada). Também ganhou "Inserir modelo", validação em tempo real e o texto "falta: ..." ao lado de "Concluir e ativar".
- Contrato da integração (F1.3, F5.1): o concluir passou a enviar os quatro campos, porque só o identificador agora dá 400. Os erros 400 aparecem por campo, e os tipos ganharam os campos da integração.
- Listagem (F5.2): a URL aparece abaixo do identificador, e a etiqueta "Integração pendente (TI)" fica na situação.
- Filtro (F5.3): nova situação `integracao_pendente`, só para o Admin.
- Mudança de rumo: de manhã a decisão foi "só a tela, sem API", com rota de variáveis proposta pelo front. À tarde veio o contrato do back-end e o front foi adequado a ele.
- API (25) comparada com a (24): a única novidade a implementar agora era a integração. Nota nova em F11.2: o `aviso de acesso` vem `null` também para o Validador.
- Correções da revisão de qualidade: `aaaa-mm-dd` sozinho não vira conta (`expressoes.ts`), e as faixas de validação ganharam `overflow-wrap`.
- Requisitos que passaram por `em-alteracao` e voltaram a `implementado`: F1.3, F4.1, F4.2, F4.6, F5.1, F5.2, F5.3 e F5.7. Novos e implementados: F5.14 a F5.18.

### Pendências
- O motor local recusa entrada em lista `[ ]`, que o contrato aceita. Em Configurações, um dado salvo com lista abre com o botão bloqueado (precisa de decisão do usuário).
- Clicar numa variável sem ter focado o campo insere no início e quebra o JSON. Sugestão: inserir no fim.
- Baixas:
  - tipos `numero` (back) × `número` (local);
  - limites de 60/500 caracteres não checados no front;
  - erros 400 por campo só somem no novo envio;
  - `aria-pressed` no destaque das variáveis e região de status oculta quando vazia.
- Lacunas de teste: o caso `aaaa-mm-dd`, e `useVariaveisIntegracao` e `useValidacaoServidor` sem teste próprio.
- Confirmar com o back-end que `campo` nos erros do `validar` é o caminho no JSON.
- Pendências anteriores:
  - edição de tipo sem grupo nem usuário;
  - RF-13 e RF-37 no documento de requisitos;
  - imagens por filial × por colaborador;
  - id do usuário no Bitrix para o link;
  - F2.7;
  - colaborador × zona;
  - `tarefaBitrix.ts` sem teste próprio.
- Próximas atividades: F5.10, F9.1, F10.1, F11.1 e F1.18.
- Commit e push: nada foi commitado hoje (inclui o fechamento de 06/11). Aguardando pedido do usuário.

---

## 06/11/2026

**Resumo:** A build foi gerada, a listagem de dashboards foi corrigida (id da tarefa Bitrix em texto) e o front foi adequado aos dois documentos novos do back-end: grupos nos tipos, exclusão de indicador só pelo Admin, tarefas Bitrix e identificador com `-` e `.`. Com isso, 67 de 67 requisitos estão implementados. Tudo entrou no commit local `f06e197`, que ainda não foi enviado ao GitHub.

### Implementações
- Build validada em `dist/`: unitários 2380/2380, integração 327/327 e carga com 100% de 2xx (6687 requisições, média de 75 ms, p99 de 142 ms). Bundle `index-DtTYGzW6.js` com 481 kB.
- Análise dos documentos `docs/backend/FRONT-PED-mudancas (1).md` e `FRONT-tarefas-bitrix (1).md`, separada em: o que afeta o que já foi implementado, o que desbloqueia (A-01..A-07, A-09) e o que fica fora do escopo (aba Usuários A-13, papéis no Premiações). Os dois documentos foram incluídos no repositório.
- Tipos, cadastro (F3.4): botão "Novo tipo" com `FormularioTipo` e `SecaoVinculosTipo`. O nome é único sem diferenciar maiúsculas, e é preciso vincular ao menos um grupo ou usuário. Admin e Validador podem cadastrar.
- Tipos, edição de grupos (F3.5): `FormularioVinculosTipo` para tipos fixos e personalizados. O PUT envia só as listas alteradas.
- Serviço de tipos: `listarGrupos` (`GET /api/ped/grupos`), `criarTipo` e `atualizarTipo`. Usuários vêm de `/vinculos?tipo=colaboradores`.
- Permissões novas: `cadastrar-tipo` e `editar-tipo` (Admin e Validador).
- Exclusão de indicador liberada (F6.7, A-09), só para o Admin. No erro 400, aparece a mensagem da API seguida de "Dashboards: A, B.".
- `src/utils/tarefaBitrix.ts`: regra comum de exibição da tarefa (`#N`, "Tarefa #N", "Aguardando envio ao Bitrix") e frase de confirmação ao gravar.
- Auxiliar `numeroDaTarefaBitrix` em `adaptadores.ts`.
- Cobertura complementar dos tipos: 16 testes.

### Modificações
- Correção (F7.13*): o id da tarefa Bitrix passou a aceitar texto só com dígitos (ex.: `"328439"`), convertido para número. Antes, um item assim derrubava a listagem de dashboards. Vale para dashboards e dados externos.
- Tipos (F3.1–F3.3): coluna "Grupos vinculados" e `MenuAcoes` "Ações do tipo" (Editar grupos / Excluir). Validador também cadastra, edita e exclui.
- Correção (tipos): usuários vinculados vêm da API como `{ "id colaborador", nome }`. Os dois formatos são aceitos, e `"id colaborador"` tem preferência.
- Correções da revisão de qualidade: o Enter na busca de vínculos não envia mais o formulário, e a tabela de tipos não some na recarga (o foco era perdido).
- Exclusão de indicador: passou de Admin e Validador para só Admin, como na API.
- Tarefas Bitrix (F5, F7):
  - leitura de `"id bitrix"` na resposta de gravação;
  - mensagens "Tarefa #N criada no Bitrix para a equipe de TI." e "A tarefa para a TI será criada no Bitrix em instantes.";
  - exibição de `#N` / "Aguardando envio ao Bitrix" nas tabelas e diálogos;
  - histórico aceita tarefa com id `null`.
- Dado externo: o identificador passou a aceitar `-` e `.`. Validador e Preenchedor veem o aviso "Ao salvar, será aberta uma tarefa para a equipe de TI.".
- Separador entre a mensagem da API e "Dashboards: ..." no 400 da exclusão de indicador.
- Requisitos que passaram por `em-alteracao` e voltaram a `implementado`: F3.1–F3.3, F5.1, F5.2, F5.5–F5.7, F6.1, F6.2, F6.5, F6.6, F7.1–F7.3 e F7.7–F7.10. Novos: F3.4 e F3.5. F6.7 passou a `implementado`.
- Commit `f06e197` (unitários 2627/2627, integração 375/375, hook aprovado). Ele inclui o diário e a documentação de 05/11.

### Pendências
- Enviar ao GitHub os commits `f2f88d6`, `7df4dd4` e `f06e197`.
- Definir se a edição de tipo pode ficar sem nenhum grupo ou usuário.
- Atualizar RF-13 e RF-37 no documento de requisitos.
- Imagens de dashboard: o back gera imagem por filial, mas o documento e a F7.5 preveem uma por colaborador mais "Filial (sem colaborador vinculado)".
- Id do usuário no Bitrix para o link (F12.5 parcial).
- F2.7: cancelar ou manter.
- Vínculo colaborador ↔ zona.
- `tarefaBitrix.ts` sem teste próprio.
- Nova atividade F1.18: mover o `SeletorBusca` para `src/components` e corrigir o Enter nos dashboards.
- Ambiente: com o caminho em `c:\` minúsculo, o Vitest 5.0.5 carrega duas instâncias e falha. É preciso abrir o editor ou terminal em `C:\`.
- Plano: 77 de 110 (70%). F5.10, F9.12 e F10.7 foram desbloqueadas.
- Os dias 22/10 e 03/11 continuam sem fechamento.

---

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
