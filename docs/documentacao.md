# Documentação — PED

## Índice

| Data | Tags | Resumo |
| --- | --- | --- |
| [05/11/2026](#2026-11-05) | #indicadores #dashboards #faixas #apontamentos #dados-externos #cadastro #api #validacao #componente #layout #correcao #testes #documentacao | Abas Indicadores (F6), Dashboards (F7) e Faixas (F8) em TDD, modais alinhadas ao protótipo, RF-54 alterado e correções contra a API real |
| [04/11/2026](#2026-11-04) | #apontamentos #dados-externos #tipos #cadastro #api #validacao #componente #layout #refatoracao #correcao #testes #configuracao #documentacao | Aba Apontamentos (F4) revisada e commitada, aba Dados Externos (F5) implementada, hooks genéricos, MenuAcoes, correção do POST e testes mais rápidos |

---

<a id="2026-11-05"></a>
## 05/11/2026

**Tags:** #indicadores #dashboards #faixas #apontamentos #dados-externos #cadastro #api #validacao #componente #layout #correcao #testes #documentacao

### Visão geral
O dia cobriu três fases do plano, todas em TDD, com testes escritos antes da implementação.

**Fase 6 (Indicadores).** Os testes foram escritos a pedido do usuário ("Somente crie os testes da próxima fase"), e a implementação veio em seguida ("Faça a implementação da fase 6"). A F6.7 (exclusão) ficou com o front pronto, mas segue bloqueada pela A-09. Durante os testes contra a API real, o usuário pediu:
- ajustes visuais na modal "Novo indicador";
- composição em dropdown;
- rolagem interna das modais;
- duas correções de formato: indicadores do dado externo em texto, e regra "2xx = gravado" na troca de situação e na conclusão.

A F6 e esses ajustes entraram no commit `f2f88d6` às 12:35, que também levou o diário e a documentação de 04/11.

**Fases 7 (Dashboards) e 8 (Faixas).** Vieram na sequência ("Faça o commit e começe a próxima fase" e "Começe a próxima fase"). Depois, a modal de dashboard foi alinhada ao protótipo, e o RF-54 (indicador base da faixa) mudou por decisão do usuário. Também foram feitas três correções contra a API real:
- tarefa Bitrix com `id: null`;
- edição de dashboard vinculado por filial;
- tamanho do cadeado.

Tudo entrou no commit `7df4dd4` às 17:17.

Toda alteração seguiu o fluxo do projeto: o `gerador-testes` adequou os testes antes, os requisitos passaram por `em-alteracao` e voltaram a `implementado` com o gate a 100%. As correções contra a API real usaram como fixture a resposta real colada pelo usuário.

Última validação registrada: `npm run test:implementados` APROVADO, com 2380/2380 testes unitários e 327/327 de integração.

Situação no fim do dia:
- requisitos: 64 `implementado` e 1 `pendente` (F6.7);
- plano: 68% (73 de 108 atividades);
- commits: ainda não enviados ao GitHub (o último push foi o `aa6018f`).

### Implementações

#### Testes TDD da Fase 6 (Indicadores)
- **Tags:** #testes #indicadores
- **Arquivos:** 28 arquivos de teste novos em `src/pages/indicadores/`, `src/services/indicadoresService.test.ts`, `src/sessao/permissoes.indicadores.test.ts`, `src/layout/AlertasMenu.test.tsx` e `src/layout/LayoutPrincipal.alertas.test.tsx`; auxiliar `src/test/indicadoresFalsos.ts`; `src/test/menuAcoes.ts` (`rotuloAcoesIndicador`); `requisitos.json`
- **Descrição:** o `gerador-testes` escreveu os testes de F6.1 a F6.9 e registrou os requisitos como `pendente`, com 7 testes passando e 107 falhando pelo motivo certo. Nenhum código de produção foi alterado nessa etapa. Decisões fixadas nos testes:
  - `MenuAcoes` nas linhas ("Ações do indicador X"), com as colunas do RF-32 sem enxugar;
  - regra "2xx = gravado" desde o início no POST, no PUT de meta e no PUT de situação;
  - sinal de alerta no menu pelo contexto `AlertasMenu`;
  - 5 ações de permissão para Admin e Validador;
  - histórico de metas em tabela própria.
- **Motivação:** seguir o TDD do projeto. O usuário pediu apenas os testes ("Somente crie os testes da próxima fase") e a implementação a pedido posterior.
- **Como usar / observações técnicas:** a F6.7 tem testes escritos, inclusive o do 404 da rota ainda não publicada.

#### Aba Indicadores (F6.1–F6.6, F6.8, F6.9)
- **Tags:** #indicadores #cadastro #api #validacao #componente
- **Arquivos:** `src/services/indicadoresService.ts`, `src/pages/indicadores/IndicadoresPage.tsx`/`.css`, `useIndicadores.ts`, `TabelaIndicadores.tsx`/`.css`, `FormularioIndicador.tsx`/`.css`, `DialogoDefinirMeta.tsx`, `DialogoSituacaoIndicador.tsx`, `DialogoHistoricoMetas.tsx`/`.css`, `AvisoComponenteDesativado.tsx`, `src/sessao/permissoes.ts` e os testes da F6 (commit `f2f88d6`)
- **Descrição:**
  - **Serviço (F6.1):**
    - `listarIndicadores` faz `GET /api/ped/indicadores-cadastro` com filtros na query e traz os alertas;
    - `criarIndicador` faz o POST;
    - `definirMeta` faz `PUT .../{id}/meta`;
    - `alterarSituacaoIndicador` faz `PUT .../{id}/situacao`;
    - `listarHistoricoMetas` faz `GET .../{id}/metas-historico`, com filtro de filial;
    - `excluirIndicador` faz `DELETE .../{id}` (ver F6.7).

    As gravações seguem "2xx = gravado": resolvem `Indicador | null` e nunca rejeitam por formato. As leituras são estritas.
  - **Listagem (F6.2, RF-32):**
    - colunas: Nome com etiquetas, Composição (apontamentos em azul, dado externo em dourado e desativados marcados), Sentido e cálculo, Meta, Dashboards com pontos base, e Ações;
    - etiquetas: automático, meta a definir, componentes desativados, inativo, meta editável e vinculado;
    - não há ação de editar (RF-37);
    - as ações ficam no `MenuAcoes`, com "Ver detalhes".
  - **Filtros e alertas (F6.3, RF-33, RNF-09):**
    - busca com espera de 500 ms;
    - situação: todas, ativos, inativos, aguardando meta ou com problemas;
    - "Limpar filtros" na hora.

    Os alertas vêm da API sobre todos os indicadores e não mudam com o filtro. Os avisos da aba só aparecem com contagem maior que zero. O sinal no menu aparece depois da primeira carga da aba.
  - **Cadastro (F6.4, RF-34/RF-35):**
    - campos: nome, meta manual (> 0), sentido, cálculo (soma/média, só com apontamentos), descrição e meta editável;
    - composição exclusiva: apontamentos ativos **ou** um dado externo ativo.

    Para a forma final da composição, ver Modificações.
  - **Definir meta (F6.5, RF-36):** diálogo próprio com meta, sentido, meta editável e o dado externo de origem. O item "Definir meta" só aparece em indicador automático com meta a definir e some depois de usado. A troca é local: o contador "aguardando meta" diminui e, se a resposta 2xx vier sem o indicador, a lista é recarregada.
  - **Inativar/reativar (F6.6, RF-38, RN-08):** confirmação com a lista "Dashboards afetados". Cinco ações novas em `AcaoPermissao`, todas para Admin e Validador:
    - `cadastrar-indicador`;
    - `definir-meta-indicador`;
    - `alterar-situacao-indicador`;
    - `excluir-indicador`;
    - `ver-historico-metas-indicador`.
  - **Histórico de metas (F6.8, RF-39):** tabela própria de 7 colunas (data, filial, mês, de, para, usuário e motivo) em vez do componente `Historico`, para manter De/Para/Filial/Mês legíveis. O diálogo faz a própria consulta, com "Tentar novamente", e refaz a consulta ao trocar a filial do cabeçalho.
  - **Aviso de componente desativado (F6.9, RF-40):** fica nos detalhes expandidos da linha. O texto é montado a partir de `problema.tipo` e dos itens inativos, sempre com "Reative o componente ou inative o indicador.".
- **Motivação:** Fase 6 do plano, implementada a pedido do usuário ("Faça a implementação da fase 6").
- **Como usar / observações técnicas:**
  - alertas "aguardando meta" e "componente desativado" são ajustados localmente pelas ações, sem nova consulta;
  - desvio aceito: o sinal do menu é aplicado por `useLayoutEffect` em `IndicadoresPage`, porque o teste confere o marcador logo após a tabela aparecer;
  - o lint mostra 1 aviso aceito (react only-export-components em `AlertasMenu.tsx`).

#### Exclusão de indicador (F6.7, front pronto e bloqueada)
- **Tags:** #indicadores #cadastro #api
- **Arquivos:** `src/pages/indicadores/DialogoExcluirIndicador.tsx`, `src/services/indicadoresService.ts` (`excluirIndicador`), `src/pages/indicadores/useIndicadores.ts` e testes de exclusão
- **Descrição:**
  - "Excluir" (perigo) só aparece quando `!vinculadoADashboard`;
  - se o indicador estiver ou já tiver estado vinculado, o diálogo mostra o bloqueio com "Entendi", sem chamar a API (RNF-07).
- **Motivação:** atividade F6.7 do plano. Ela segue **Bloqueada (A-09)** porque a rota `DELETE /api/ped/indicadores-cadastro/{id}` ainda não existe na API, e a exclusão real falha até ela ser publicada.
- **Como usar / observações técnicas:** o requisito F6.7 continua `pendente` em `requisitos.json`; liberar a atividade é decisão do usuário. O teste de 404 foi corrigido para a mensagem já mapeada pela camada de API, "Registro não encontrado.", em vez de "Recurso não encontrado.".

#### Sinal de alerta nas abas do menu (`AlertasMenu`)
- **Tags:** #layout #componente #indicadores
- **Arquivos:** `src/layout/AlertasMenu.tsx`, `src/layout/LayoutPrincipal.tsx`, `src/layout/LayoutPrincipal.css` e os testes `AlertasMenu.test.tsx` e `LayoutPrincipal.alertas.test.tsx`
- **Descrição:**
  - `AlertasMenuProvider` guarda `abasComAlerta` (conjunto de abas), e cada tela informa o seu estado por `definirAlerta(aba, ativo)`;
  - as referências são estáveis: o conjunto só muda quando muda de fato, e `definirAlerta` nunca muda;
  - fora do provider, o contexto fica vazio e inerte;
  - no `LayoutPrincipal`, a barra de abas virou o componente `BarraAbas`, que marca a aba com a classe `layout-principal__aba--com-alerta` e o marcador acessível "Com alertas" (`role="img"`).
- **Motivação:** RF-33/RNF-09 (sinal de alerta na aba Indicadores do menu); a interface por contexto foi a decisão fixada nos testes da F6.
- **Como usar / observações técnicas:** hoje só a aba Indicadores usa o sinal. Dashboards ficou sem sinal porque a API não dá um total independente do filtro (a confirmar).

#### Aba Dashboards (F7.1–F7.10)
- **Tags:** #dashboards #cadastro #api #validacao #componente
- **Arquivos:**
  - `src/services/dashboardsService.ts`;
  - em `src/pages/dashboards/`: `DashboardsPage.tsx`/`.css`, `useDashboards.ts`, `TabelaDashboards.tsx`/`.css`, `FormularioDashboard.tsx`/`.css`, `SecaoVinculo.tsx`, `SecaoIndicadores.tsx`, `SeletorBusca.tsx`, `PesosDashboard.tsx`, `regrasDashboard.ts`, `DialogoHistoricoDashboard.tsx`, `DialogoSituacaoDashboard.tsx`, `DialogoConcluirDashboard.tsx`, `DialogoExcluirDashboard.tsx`;
  - `src/sessao/permissoes.ts`, `src/test/dashboardsFalsos.ts`, `src/test/menuAcoes.ts`;
  - 33 arquivos de teste, um requisito por arquivo (commit `7df4dd4`).
- **Descrição:**
  - **Serviço (F7.1):** cobre as rotas abaixo. As gravações seguem "2xx = gravado" desde o início, e as leituras são estritas.
    - `GET/POST /api/ped/dashboards`;
    - `GET/PUT/DELETE .../{id}`;
    - `POST .../previa-tarefa`;
    - `PUT .../{id}/concluir` e `PUT .../{id}/situacao`;
    - `GET .../{id}/historico` e `GET .../{id}/tarefas`;
    - listas de vínculo (filiais, cargos e colaboradores).
  - **Listagem e filtros (F7.2, RF-47):**
    - colunas do protótipo: Dashboard, Periodicidade, Vínculo, Indicadores, Período atual e Ações, com os campos do RF-47 dentro delas;
    - filtros pela API, com busca com espera de 500 ms;
    - alertas de indicadores com problema e dos pontos afetados.
  - **Menu de ações (F7.3, RF-48):** `MenuAcoes` por linha ("Ações do dashboard X") com Editar, Ver pesos, Histórico, Preencher apontamentos, Ativar/Desativar ou Concluir e Excluir, conforme perfil e situação.
    - Ações novas: `cadastrar-dashboard` e `editar-dashboard` para Admin e Validador; `alterar-situacao-dashboard`, `concluir-dashboard` e `excluir-dashboard` só para o Admin.
    - "Preencher apontamentos" leva a `/preenchimento?dashboard={id}`, que ainda cai no placeholder.
  - **Formulário — dados básicos (F7.4, RF-49, RF-54):**
    - nome;
    - periodicidade (Mensal, Bimestral, Trimestral, Semestral ou Anual, começando em Mensal);
    - pontuação base máxima (> 0, travada na edição);
    - indicador base da faixa e fórmula de pontuação (texto livre).

    A página carrega cinco listas ao abrir o formulário: indicadores, dados externos, filiais, cargos e colaboradores.
  - **Vínculo e resumo de imagens (F7.5, RF-50):** filiais (com "Selecionar todas"), cargos ou colaboradores, com busca. O resumo de imagens é calculado no front conforme o documento: uma imagem por colaborador, e "Filial (sem colaborador vinculado)" para filial sem colaborador. A API atual faz uma imagem por filial (A-07), mas o documento prevalece.
  - **Indicadores e pontos base (F7.6, RF-51 a RF-53):**
    - seleção em dropdown com busca e lista só dos escolhidos;
    - pontos base > 0, com o total e quanto falta ou excede;
    - indisponíveis visíveis e desabilitados, com o motivo, nesta ordem: inativo, componente desativado, meta a definir, regra de referência em dashboard por filiais.
  - **Prévia e gravação (F7.7, RF-55):** prévia da tarefa gerada pela API. O dashboard nasce "em construção (TI)", e o número da tarefa só aparece quando a API o devolve.
  - **Edição (F7.8, RF-56):**
    - todos os campos editáveis, exceto a pontuação máxima;
    - opção "Enviar tarefa à TI", desabilitada em dashboard em construção;
    - lista das tarefas anteriores.
  - **Pesos e histórico (F7.9, RF-57):** "Ver pesos" abre os pesos abaixo da linha, consultando o detalhe sob demanda. O histórico fica no `DialogoHistoricoDashboard`, com ação, data, usuário, alterações, tarefa e observação.
  - **Ativar/desativar, concluir e excluir (F7.10, RF-58, RF-59):** só o Admin, cada ação com o seu diálogo de confirmação.
- **Motivação:** Fase 7 do plano, pedida pelo usuário ("Faça o commit e começe a próxima fase"). Na criação, a prévia era em duas etapas para não chamar a API a cada tecla; essa decisão foi revertida no mesmo dia (ver Modificações).
- **Como usar / observações técnicas:**
  - formatos não documentados foram assumidos nos testes: envelope da listagem, indicadores e indicador base no detalhe, e tarefa;
  - a lista inteira de colaboradores é carregada no formulário, o que é um risco de desempenho.

#### Aba Faixas (F8.1–F8.6)
- **Tags:** #faixas #cadastro #api #validacao #componente
- **Arquivos:**
  - `src/services/faixasService.ts`;
  - em `src/pages/faixas/`: `FaixasPage.tsx`/`.css`, `useFaixas.ts`, `ListaTabelasFaixas.tsx`/`.css`, `TabelaValoresFaixas.tsx`, `EditorFaixas.tsx`/`.css`, `FormularioTabelaFaixas.tsx`, `FormularioAlterarFaixas.tsx`, `DialogoHistoricoFaixas.tsx`, `DialogoExcluirTabelaFaixas.tsx`, `regrasFaixas.ts`;
  - `src/sessao/permissoes.ts`, `src/test/faixasFalsos.ts`;
  - 17 arquivos de teste (commit `7df4dd4`).
- **Descrição:**
  - **Serviço (F8.1):** cobre as rotas abaixo, com "2xx = gravado" no POST, no PUT e no DELETE e leituras estritas.
    - `GET/POST /api/ped/faixas`;
    - `GET/PUT/DELETE .../{id}`;
    - `GET .../{id}/historico`;
    - `GET .../{id}/versoes/{versao}`.

    Os valores são enviados como números lidos por `lerDecimal` ("2.000" vira 2000).
  - **Lista de tabelas (F8.2, RF-41):** tabelas da filial selecionada (ou de todas) em `Tabela`, com `MenuAcoes` por linha ("Ações da tabela de faixas X"). "Ver faixas"/"Ocultar faixas" abre, abaixo da linha, as faixas da versão vigente: De/Até em R$ e Alíquota em %, com data e autor.
  - **Nova tabela (F8.3, RF-42, RF-43, RN-14):**
    - campos: dashboard, filial (só com "Todas as filiais"), descrição e linhas no `EditorFaixas`;
    - a orientação de "tabela já existe" é calculada no front e desabilita o salvar;
    - validação das linhas conforme o documento: cada faixa começa acima do "Até" da anterior, sem valores negativos;
    - não há limite de 100 na alíquota e lacunas são aceitas; essas duas regras ficaram para decisão do usuário.
  - **Alterar faixas (F8.4, RF-44):** diálogo "Alterando faixas — será gerada a versão vN", com "Motivo da alteração" obrigatório, as mesmas validações e o botão "Salvar nova versão".
  - **Histórico de versões (F8.5, RF-45):** diálogo que faz a própria consulta e mostra versão, vigente, motivo, data e autor, com as faixas de cada versão.
  - **Excluir tabela (F8.6, RF-46, RN-18):** permitido só para tabela de dashboard excluído, decidido pelo campo "dashboard excluido". "Excluir tabela" aparece também em tabela de dashboard existente; nesse caso, o diálogo explica o bloqueio sem chamar a API (RNF-07).
  - **Permissões:** `cadastrar-faixas`, `alterar-faixas`, `ver-historico-faixas` e `excluir-faixas`, para Admin e Validador. O Validador vê todas as filiais; o acesso real depende da A-04.
- **Motivação:** Fase 8 do plano, pedida pelo usuário ("Começe a próxima fase"). O `MenuAcoes` por tabela e os diálogos para alteração e histórico (no protótipo, um dropdown único e listas inline) foram escolhidos por coerência com as outras abas.
- **Como usar / observações técnicas:**
  - formatos não documentados foram assumidos: `{ tabelas }`, `{ tabela }`/`{ faixa }`, versão como objeto com faixas, decimais em texto e mensagem do 400 de tabela existente;
  - um teste de busca de moeda foi corrigido para o espaço especial do "R$";
  - risco: a exclusão real depende de a leitura aceitar `id dashboard` nulo depois da exclusão do dashboard.

#### Prop `descricao` no `Select`
- **Tags:** #componente #dashboards
- **Arquivos:** `src/components/Select.tsx`
- **Descrição:** a prop opcional `descricao?: ReactNode` mostra um texto de apoio abaixo do campo (`campo__dica`) e o inclui no `aria-describedby`, junto com o id do erro quando houver. Sem a prop, o comportamento não muda.
- **Motivação:** mostrar a orientação "Vincule indicadores para escolher o indicador base." no campo "Indicador base da faixa" desabilitado (alteração do RF-54).
- **Como usar / observações técnicas:** `<Select descricao="..." />`.

### Modificações

#### `Dialogo` compartilhado: cabeçalho em `div` e rolagem dentro da modal (F1.17*)
- **Tags:** #componente #layout
- **Arquivos:** `src/components/Dialogo.tsx`, `src/components/Dialogo.css`, `src/pages/indicadores/FormularioIndicador.css`
- **Antes:**
  - o cabeçalho do diálogo era um `<header>`;
  - nas modais longas, a página inteira rolava junto.
- **Depois:**
  - o cabeçalho é um `<div className="dialogo__cabecalho">`;
  - cabeçalho e ações têm `flex: none`, e a rolagem acontece dentro da modal, com cabeçalho e rodapé fixos.
- **Motivação:**
  - o `<header>` criava um landmark "banner" dentro do diálogo, um problema de acessibilidade encontrado na F6;
  - a rolagem foi pedido do usuário: "quando tiver a barra lateral, a rolagem seja a modal e não a tela toda".
- **Impacto:** todos os diálogos do sistema. Não houve requisito alterado nem teste novo (CSS e marcação), e a mudança já é coberta pelos testes de diálogo das abas.

#### Estilo da modal "Novo indicador" conforme o protótipo
- **Tags:** #layout #indicadores
- **Arquivos:** `src/pages/indicadores/FormularioIndicador.tsx`, `src/pages/indicadores/FormularioIndicador.css`
- **Antes:** a modal usava o estilo padrão dos formulários e ficava diferente do protótipo.
- **Depois:** a modal segue os valores visuais do protótipo (`Main.dc.html`, `indModal`): 680 px, topo, blocos e rodapé. O escopo do estilo é isolado pelo seletor `:has()`.
- **Motivação:** pedido do usuário ("está diferente do protótipo"); o protótipo é a referência aprovada.
- **Impacto:** só visual. A interação de composição não mudou nessa etapa e foi alterada logo depois (ver o item seguinte).

#### Composição do indicador em dropdown com busca (F6.4 alterado)
- **Tags:** #indicadores #cadastro #componente
- **Arquivos:** `src/pages/indicadores/FormularioIndicador.tsx`/`.css`, `FormularioIndicador.test.tsx`, `IndicadoresPage.cadastro.integration.test.tsx`, `requisitos.json`
- **Antes:**
  - todos os apontamentos apareciam como caixas de seleção, com busca;
  - os dados externos apareciam como rádios.
- **Depois:**
  - apontamentos e dado externo são escolhidos em dropdowns com busca (só por nome, sem diferenciar acento e maiúsculas);
  - a área de itens mostra só os escolhidos;
  - há bloqueio mútuo entre apontamentos e dado externo, com os textos do protótipo;
  - um dado externo escolhido oculta o botão (sem "Trocar").
- **Motivação:** pedido do usuário. A lista com todos os itens era longa e pesada, e o protótipo usa dropdown.
- **Impacto:** cadastro de indicador. F6.4 passou por `em-alteracao` e voltou a `implementado`. Os subtextos de apontamento e de dado externo foram escolha do agente e precisam de confirmação.

#### Indicadores do dado externo como lista de nomes (F5.12*)
- **Tags:** #dados-externos #api #correcao
- **Arquivos:** `src/types/dominio.ts`, `src/services/adaptadores.ts`, `src/services/dadosExternosService.ts`, `src/pages/dados-externos/DialogoExcluirDadoExterno.tsx`, `src/test/dadosExternosFalsos.ts` e os testes correspondentes
- **Antes:** `DadoExterno.indicadores: ReferenciaNomeada[]` (`{id, nome}`). A aba Dados Externos mostrava "Resposta inválida do servidor.", porque um item fora do formato rejeitava a lista inteira.
- **Depois:** `DadoExterno.indicadores: string[]` (nomes), sem id falso. O `DialogoExcluirDadoExterno` lê os nomes diretamente, e a mensagem de bloqueio não mudou.
- **Motivação:** a API real devolve `indicadores` como lista de nomes em texto. A resposta colada pelo usuário foi usada como fixture.
- **Impacto:** requisitos F1.3, F5.1, F5.2 e F5.9 alterados. F5.3 a F5.8 e F6.4 passaram por `em-alteracao` só por causa da fixture compartilhada. Todos voltaram a `implementado`.
- **Pendência registrada:** `GET /api/ped/apontamentos` ainda converte os indicadores para `{ id, nome }` e pode ter o mesmo problema.

#### Regra "2xx = gravado" em situação e conclusão (F4.8*, F5.13*)
- **Tags:** #apontamentos #dados-externos #api #correcao #testes
- **Arquivos:**
  - `src/services/apontamentosService.ts`, `src/pages/apontamentos/useApontamentos.ts`;
  - `src/services/dadosExternosService.ts`, `src/pages/dados-externos/useDadosExternos.ts`, `src/pages/dados-externos/DadosExternosPage.tsx`;
  - novos arquivos de teste: `apontamentosService.situacao.test.ts`, `useApontamentos.situacao.test.tsx`, `dadosExternosService.situacao.test.ts`, `dadosExternosService.concluir.test.ts`, `useDadosExternos.situacao.test.tsx`, `useDadosExternos.concluir.test.tsx`, `DadosExternosPage.concluir.integration.test.tsx`;
  - ajustes nos testes de integração de situação.
- **Antes:** `alterarSituacao` (apontamento), `alterarSituacaoDadoExterno` e `concluirConstrucao` exigiam o item completo na resposta 2xx. Ao reativar um apontamento ou inativar um dado externo, a tela mostrava "Resposta inválida do servidor." mesmo com a gravação feita.
- **Depois:** um 2xx significa gravado. Sem o item na resposta, a função resolve `null`, a lista é recarregada e nenhum erro aparece.
- **Motivação:** bug relatado pelo usuário, que recebia erro mesmo com resposta positiva. Aplica às trocas de situação e à conclusão a regra já adotada nos POSTs (F4.7*, F5.11*). Os testes de serviço foram separados em arquivos próprios porque o gate exige um requisito por arquivo de teste.
- **Impacto:** abas Apontamentos e Dados Externos. F4.5, F5.7 e F5.8 passaram por `em-alteracao` e voltaram a `implementado`.

#### Modal de dashboard alinhada ao protótipo (F7.4–F7.8 alterados)
- **Tags:** #dashboards #cadastro #layout
- **Arquivos:** `src/pages/dashboards/FormularioDashboard.tsx`/`.css`, `SecaoVinculo.tsx`, `SecaoIndicadores.tsx`, `SeletorBusca.tsx` e testes do formulário e da página
- **Antes:**
  - prévia da tarefa em duas etapas ("Ver prévia da tarefa", depois "Voltar" e "Salvar e criar tarefa no Bitrix");
  - vínculo e indicadores fora do arranjo do protótipo;
  - edição sem o bloco de modificação.
- **Depois:**
  - bloco da tarefa da TI sempre visível, com prévia vinda da API 500 ms após a última alteração e só com o formulário válido;
  - vínculo pelo dropdown "Vincular dashboard a", com "Selecionar todas" e "Limpar seleção";
  - grupo "Indicadores vinculados" com totais e cabeçalho;
  - na edição, a caixa "Enviar tarefa à TI" com o bloco de modificação e as tarefas anteriores;
  - rótulos e placeholders do protótipo.
- **Motivação:** pedido do usuário ("campos e funcionalidades diferentes do protótipo"); o protótipo é a referência de tela aprovada. A prévia em duas etapas foi descartada.
- **Impacto:** cadastro e edição de dashboard. Algumas diferenças com o protótipo foram mantidas de propósito:
  - erros por campo;
  - redação dos motivos de indisponibilidade conforme o documento;
  - filial como "{código} - {nome}";
  - busca fora do listbox (ARIA válido);
  - tarefa de modificação sem descrição.

  Depois, a modal apareceu sem estilo num print do usuário. O CSS é válido e é entregue corretamente por um servidor de desenvolvimento novo; a causa provável é cache. O usuário foi orientado a reiniciar o `npm run dev` e usar Ctrl+Shift+R.

#### Indicador base da faixa só entre os vinculados (RF-54 alterado)
- **Tags:** #dashboards #cadastro #validacao #componente
- **Arquivos:** `src/pages/dashboards/FormularioDashboard.tsx`, `src/components/Select.tsx`, testes `FormularioDashboard.test.tsx`, `FormularioDashboard.previa.test.tsx`, `FormularioDashboard.edicao.test.tsx`, `DashboardsPage.cadastro.integration.test.tsx`, `DashboardsPage.edicao.integration.test.tsx` e `requisitos.json`
- **Antes:** o "Indicador base da faixa" aceitava qualquer indicador cadastrado, mesmo fora do dashboard (RF-54 original), e ficava junto dos dados básicos.
- **Depois:**
  - o campo e a "Fórmula de pontuação" ficam abaixo de "Indicadores vinculados";
  - as opções são "Selecione" mais só os indicadores vinculados, na ordem da lista;
  - sem indicador vinculado, o campo fica desabilitado, com a orientação "Vincule indicadores para escolher o indicador base.";
  - remover a base dos vinculados limpa o campo;
  - na edição, uma base gravada fora dos vinculados abre vazia;
  - a prévia exige uma base válida.
- **Motivação:** o usuário disse que o campo "não existe" (ele não aparece no protótipo). O orquestrador explicou que a API exige o campo e que o fechamento o usa no resultado operacional. O usuário decidiu mantê-lo, restrito aos indicadores vinculados, porque o indicador base faz parte da composição do dashboard. A remoção foi descartada.
- **Impacto:** F7.4, F7.7 e F7.8 passaram por `em-alteracao` e voltaram a `implementado`. A API continua aceitando qualquer indicador, então a restrição é só no front. O texto do RF-54 no documento de requisitos ainda precisa ser atualizado.

#### Tarefa Bitrix com `id: null` (F7.11*)
- **Tags:** #dashboards #dados-externos #api #correcao
- **Arquivos:** `src/types/dominio.ts`, `src/services/adaptadores.ts`, `src/services/dashboardsService.ts`, `src/services/dadosExternosService.ts`, `src/pages/dashboards/TabelaDashboards.tsx`, `src/pages/dashboards/DialogoConcluirDashboard.tsx`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `src/test/dadosExternosFalsos.ts`, `src/test/dashboardsFalsos.ts` e testes
- **Antes:** `TarefaBitrix.id: number`. A aba Dashboards mostrava "Resposta inválida do servidor.", porque a listagem real traz `"tarefa bitrix": { "id": null, ... }` e o validador rejeitava a lista inteira.
- **Depois:**
  - `TarefaBitrix.id: number | null`;
  - `ehTarefaBitrixApi`, em dashboards e em dados externos, aceita `id` numérico ou `null` e continua rejeitando tarefa sem título, `id` em texto e tarefa que não é objeto;
  - "Tarefa nº {id}" só aparece com número.
- **Motivação:** a tarefa fica só registrada (`status = aguardando_envio`) até a fase do Bitrix24. Dados Externos tinha o mesmo validador e falharia do mesmo jeito com um dado em construção nessas condições.
- **Impacto:** requisitos F1.3, F5.1, F5.2, F7.1, F7.2 e F7.10 alterados e de volta a `implementado`.

#### Edição de dashboard vinculado por filial (F7.12*)
- **Tags:** #dashboards #api #correcao
- **Arquivos:** `src/services/dashboardsService.ts`, `src/pages/dashboards/FormularioDashboard.tsx`, `src/pages/dashboards/SecaoVinculo.tsx`, `src/test/dashboardsFalsos.ts`, testes `dashboardsService.test.ts`, `dashboardsService.vinculos.test.ts`, `FormularioDashboard.edicao.test.tsx`, `DashboardsPage.edicao.integration.test.tsx`
- **Antes:** a edição partia de `"itens vinculados"`, que traz rótulos (`["100 - Filial 100"]`). A filial vinculada não aparecia, e o PUT ia com `["100 - Filial 100","100"]`, recusado pela API.
- **Depois:**
  - `DetalheDashboard.codigosVinculados: string[]` é lido de `vinculos` (chaves `filial`, `cargo`, `id colaborador` ou `id`; `vinculos: null` é tratado como ausente);
  - a edição parte dos códigos;
  - na `SecaoVinculo`, um item fora da lista carregada aparece pelo código, com "Remover {código}", e o resumo de imagens conta só os itens conhecidos.
- **Motivação:** bug relatado pelo usuário, confirmado com a resposta real de `GET /api/ped/dashboards/{id}`.
- **Impacto:** F7.1 e F7.8 alterados e de volta a `implementado`. O formato de `vinculos` para cargos e colaboradores foi suposto (só o de filiais foi visto na API real).

#### Tamanho do ícone de cadeado
- **Tags:** #dashboards #layout
- **Arquivos:** `src/pages/dashboards/FormularioDashboard.css`
- **Antes:** o cadeado da pontuação base máxima na edição herdava os 42 px de altura de `.campo__sufixo`.
- **Depois:** fixado em 14 px, como no protótipo, só no formulário de dashboard.
- **Motivação:** pedido do usuário ("Ajustar o tamanho do ícone de cadeado").
- **Impacto:** só visual. Registrado na atividade F7.12*.

#### Ajustes de fixtures e expectativas de teste
- **Tags:** #testes
- **Arquivos:** `src/test/indicadoresFalsos.ts`, testes de exclusão de indicador e testes de faixas
- **Antes / Depois:**
  - o dado externo da fixture `INDICADOR_DEVOLUCOES_API` tinha o mesmo nome do indicador ("Devoluções de venda") e passou a "Devoluções (dado externo)";
  - o teste de 404 esperava "Recurso não encontrado." e passou a esperar "Registro não encontrado.";
  - duas buscas por valor em reais passaram a usar o espaço especial do "R$".
- **Motivação:**
  - o nome repetido fazia a busca na tabela encontrar dois elementos;
  - a camada de API já mapeia 404 para "Registro não encontrado.";
  - a formatação de moeda usa espaço não separável.
- **Impacto:** só nos testes. As asserções de comportamento foram mantidas.

#### Documentação de 04/11 incluída no commit
- **Tags:** #documentacao
- **Arquivos:** `docs/diario-implementacao.md`, `docs/documentacao.md`
- **Antes:** o fechamento de 04/11 estava só no disco.
- **Depois:** entrou no commit `f2f88d6`.
- **Motivação:** registrar no repositório o fechamento do dia anterior.
- **Impacto:** nenhum no sistema.

### Pendências
- **Envio ao GitHub:** os commits `f2f88d6` e `7df4dd4` ainda não foram enviados (o último push foi o `aa6018f`).
- **Formatos da API a confirmar:**
  - `vinculos` de dashboard por cargos e colaboradores;
  - `vinculos: null`;
  - chave `id` da tarefa possivelmente omitida;
  - listagens de faixas e dashboards;
  - indicadores na listagem de apontamentos.
- **Decisões do usuário em aberto:**
  - rascunho no bloco da tarefa ("(sem nome)", como no protótipo) em vez da orientação atual;
  - asterisco nos campos obrigatórios;
  - descrição da tarefa de modificação, observação na edição e autor das tarefas anteriores;
  - fechar dropdowns com clique fora ou Esc;
  - exclusão de indicador pelo Validador (hoje permitida em `permissoes.ts`);
  - sinal do menu no login;
  - sinal de alerta para Dashboards;
  - alíquota até 100 e faixas sem lacuna;
  - quais dashboards oferecer no cadastro de faixas;
  - liberação da F6.7;
  - atualização do texto do RF-54 no documento de requisitos.
- **Riscos:**
  - exclusão de tabela de faixas se `id dashboard` vier nulo depois da exclusão do dashboard;
  - lista inteira de colaboradores carregada no formulário de dashboard;
  - timeouts de testes quando as baterias unitária e de integração rodam juntas sob carga (separadas, passam).
- **Processo:** numa rodada, o orquestrador marcou requisitos como implementados antes do resultado do gate. O gate reprovou por timeouts de carga e passou na rodada seguinte, sem carga paralela. O erro já foi corrigido.
- **Bloqueadas:** F2.7 (A-01), F3.4 e F3.5 (A-02), F5.10 (A-11) e F6.7 (A-09).
- **Próxima fase:** F9 (Preenchimento). F10.1 e F11.1 podem ser adiantadas em paralelo.
- **Progresso:** plano em 68% (73 de 108); requisitos com 64 `implementado` e 1 `pendente` (F6.7).
- **Dias sem fechamento:** 22/10 e 03/11.

---

<a id="2026-11-04"></a>
## 04/11/2026

**Tags:** #apontamentos #dados-externos #tipos #cadastro #api #validacao #componente #layout #refatoracao #correcao #testes #configuracao #documentacao

### Visão geral
O dia começou com a revisão de qualidade e o commit da Fase 4 (aba Apontamentos), commit `cab66d2` às 10:07. Em seguida veio a Fase 5 (aba Dados Externos), em TDD: implementação de F5.1–F5.9 e revisão de qualidade. A revisão apontou lógica repetida entre as duas abas, e essa lógica foi extraída para hooks genéricos (F1.14*). Nos testes contra a API real, o usuário encontrou um bug no POST dos dois cadastros (F4.7* e F5.11*) e pediu ajustes de interface: diálogos mais largos (F1.15*), tabela de Dados Externos enxuta com menu de ações (F1.16*), menu também em Apontamentos, campo ou cálculo obrigatório para o Admin e identificador restrito a A–Z, 0–9 e "_". Toda alteração seguiu o TDD do projeto: o `gerador-testes` adequou os testes antes, os requisitos afetados passaram por `em-alteracao` e voltaram a `implementado` com 100% dos testes. O dia fechou com o commit `aa6018f` às 16:45 (112 arquivos; unitários 1456/1456 e integração 176/176 APROVADOS) e o push para o GitHub (`main`).

### Implementações

#### Aba Apontamentos (F4.1–F4.6)
- **Tags:** #apontamentos #cadastro #api #validacao
- **Arquivos:** `src/services/apontamentosService.ts`, `src/pages/apontamentos/ApontamentosPage.tsx`, `src/pages/apontamentos/ApontamentosPage.css`, `src/pages/apontamentos/useApontamentos.ts`, `src/pages/apontamentos/TabelaApontamentos.tsx`, `src/pages/apontamentos/TabelaApontamentos.css`, `src/pages/apontamentos/FormularioApontamento.tsx`, `src/pages/apontamentos/FormularioApontamento.css`, `src/pages/apontamentos/DialogoSituacaoApontamento.tsx`, `src/pages/apontamentos/DialogoExcluirApontamento.tsx`, auxiliar de teste `src/test/apontamentosFalsos.ts` e os testes unitários e de integração de `src/pages/apontamentos/` e `src/services/apontamentosService.test.ts` (commit `cab66d2`)
- **Descrição:**
  - **Serviço (F4.1, RF-17 a RF-22):** `listarApontamentos` envia os filtros na query (busca, situação e tipo; `situacao=todas` não é enviada) e recebe a contagem por tipo. Também oferece `criarApontamento` (POST), `alterarSituacao` (`PUT .../{id}/situacao`) e `excluirApontamento` (`DELETE .../{id}`; um 400 traz os `indicadores` que usam o apontamento). As respostas são validadas, e um formato inválido vira `ApiError`. Para a mudança posterior no POST, ver a Modificação "POST de cadastro com 2xx = gravado".
  - **Listagem:** etiquetas e histórico de situação (quem alterou e quando).
  - **Filtros:** busca textual com espera de 500 ms, situação e tipo, com a contagem por tipo. Se o tipo selecionado some da contagem, o filtro é limpo.
  - **Cadastro (RF-19, RF-20):** o apontamento nasce ativo e não pode ser editado depois.
  - **Ativar/desativar (RF-21):** disponível para Admin e Validador, com diálogo de confirmação.
  - **Exclusão (RF-22, RN-11, RN-12):** só para o Admin, e fica bloqueada quando o apontamento compõe um indicador.
- **Motivação:** Fase 4 do plano de implementação. Hoje o usuário pediu a revisão de qualidade ("Faça a revisão de qualidade") e o commit das fases ("Faça o commit das duas fases").
- **Como usar / observações técnicas:** decisões do usuário na revisão: "Alterar na hora" para o filtro de situação e "esperar 500ms" para a busca (ver Modificações). Permissões por meio de `podeAcao('alterar-situacao-apontamento')` e `podeAcao('excluir-apontamento')`.

#### Infraestrutura de consulta, ações confirmadas, permissões de ação e campos obrigatórios (F1.13*)
- **Tags:** #componente #refatoracao #validacao
- **Arquivos:** `src/hooks/useConsulta.ts`, `src/hooks/useListagem.ts`, `src/hooks/useAcaoConfirmada.ts`, `src/components/EstadoCarga.tsx`, `src/components/EstadoCarga.css`, `src/sessao/permissoes.ts`, `src/sessao/usePermissoes.ts`, `src/components/Campo.tsx`, `src/components/Campo.css`, `src/components/Select.tsx`, `src/components/AreaTexto.tsx`, mais os testes (`useConsulta.test.tsx`, `useAcaoConfirmada.test.tsx`, `EstadoCarga.test.tsx`, `Campo.obrigatorio.test.tsx`, `permissoes.acoes.test.ts`, `usePermissoes.acoes.test.tsx`)
- **Descrição:**
  - `useConsulta<R>(carregar, inicial, { recarregarAposMutacao? })` devolve `dados`, `setDados`, `carregando`, `carregouUmaVez`, `erro` e `recarregar`. Tem proteção contra respostas fora de ordem e recarrega automaticamente após uma mutação local feita com um GET pendente.
  - `useListagem` foi reescrito como invólucro de `useConsulta` (`recarregarAposMutacao: false`), sem mudar a interface.
  - `useAcaoConfirmada<T>(acao, { onSucesso })` controla o fluxo diálogo → confirmação → execução → erro.
  - `EstadoCarga` junta `RegiaoStatus` e um `Aviso` de erro com o botão "Tentar novamente".
  - Permissões de ação: tipo `AcaoPermissao` e `podeExecutar` em `permissoes.ts`, e `podeAcao` em `usePermissoes`.
  - A prop `obrigatorio` em `Campo`, `Select` e `AreaTexto` aplica `aria-required` e mostra " *". O rótulo usa `aria-labelledby`, para que o asterisco não entre no nome acessível.
- **Motivação:** atividade não planejada, extraída na revisão de qualidade da Fase 4 para remover a duplicação que a revisão apontou e servir de padrão para as fases 5 a 8.
- **Como usar / observações técnicas:** requisito `F1.13` `implementado`. Os testes estão em arquivos próprios, para não deixar vermelhos os de F1.6, F1.12 e F2.6.

#### Aba Dados Externos (F5.1–F5.9)
- **Tags:** #dados-externos #cadastro #api #validacao
- **Arquivos:** `src/services/dadosExternosService.ts`, `src/types/dominio.ts`, `src/sessao/permissoes.ts`, `src/pages/dados-externos/DadosExternosPage.tsx`, `src/pages/dados-externos/DadosExternosPage.css`, `src/pages/dados-externos/useDadosExternos.ts`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `src/pages/dados-externos/TabelaDadosExternos.css`, `src/pages/dados-externos/FormularioDadoExterno.tsx`, `src/pages/dados-externos/FormularioDadoExterno.css`, `src/pages/dados-externos/SugestoesIdentificador.tsx`, `src/pages/dados-externos/SugestoesIdentificador.css`, `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `src/pages/dados-externos/DialogoConcluirConstrucao.css`, `src/pages/dados-externos/DialogoSituacaoDadoExterno.tsx`, `src/pages/dados-externos/DialogoExcluirDadoExterno.tsx`, auxiliar de teste `src/test/dadosExternosFalsos.ts` e os testes da pasta (commit `aa6018f`)
- **Descrição:**
  - **Serviço (F5.1, RF-23 a RF-31, INT-03, INT-04):** rotas de `/api/ped/dados-externos-cadastro`, conforme `docs/backend/API (24).md`:
    - listagem filtrada (`busca`, `situacao`);
    - `identificadores` (coletas existentes, para Admin e Validador);
    - POST (cadastro pelo Admin ou pedido de construção à TI);
    - `PUT {id}/concluir` (`{ identificador }`, só Admin);
    - `PUT {id}/situacao` (Admin e Validador);
    - `DELETE {id}` (só Admin, recusado com 400 quando o dado compõe um indicador);
    - `GET {id}/realizado` (`filial`, `mes_de_referencia`; RN-05).

    Como os formatos de resposta não estão documentados, o serviço aceita os dois formatos prováveis de cada rota. Nas rotas estritas, um único item inválido rejeita a resposta inteira.
  - **Tipos novos em `dominio.ts`:** `TarefaConstrucao`, `IdentificadorColeta`, `MesConsiderado` e `RealizadoDadoExterno`.
  - **Permissões novas:** `cadastrar-dado-externo-ativo` (Admin), `concluir-dado-externo` (Admin), `alterar-situacao-dado-externo` (Admin e Validador) e `excluir-dado-externo` (Admin).
  - **Formulário (F5.4, RF-25, RF-29):** campos de nome, tipo, sistema de origem, tipo de valor, referência (Filial, Colaborador e Zona de venda), coleta (diária ou dia de 1 a 31), sentido do cálculo, janela retroativa e comentários.
    - A janela retroativa fica oculta em "último valor", e a janela de 1 mês aparece como "Somente o mês".
    - Os comentários são obrigatórios em "Outro sistema".
    - Os selects começam em "Selecione".
    - Não há edição depois de salvar.
  - **Admin:** cadastra o dado já ativo, com identificador e sugestões de identificadores existentes (`SugestoesIdentificador`).
  - **Validador e Preenchedor:** pedem a construção à TI, o que gera uma tarefa.
  - **Concluir construção:** o Admin informa o identificador, e a API pode criar um indicador automaticamente.
  - **Ativar/desativar e excluir:** com diálogos de confirmação.
- **Motivação:** Fase 5 do plano de implementação, a pedido do usuário ("Começe a fase 5").
- **Como usar / observações técnicas:** F5.10 (validar ponta a ponta as referências Colaborador e Zona de venda) está bloqueada pelo ajuste de API A-11. Na revisão de qualidade, foi corrigido o texto duplicado no diálogo Concluir construção: um `<strong>` repetia o texto e quebrava um teste de integração.

#### Hooks genéricos de filtros e de ações de situação/exclusão (F1.14*)
- **Tags:** #componente #refatoracao #apontamentos #dados-externos
- **Arquivos:** `src/hooks/useFiltrosConsulta.ts`, `src/hooks/useAcoesSituacaoExclusao.ts`, `src/utils/filtros.ts`, `src/pages/apontamentos/useApontamentos.ts`, `src/pages/apontamentos/ApontamentosPage.tsx`, `src/pages/dados-externos/useDadosExternos.ts`, `src/pages/dados-externos/DadosExternosPage.tsx`, e os testes `useFiltrosConsulta.test.tsx`, `useAcoesSituacaoExclusao.test.tsx` e `filtros.situacao.test.ts`
- **Descrição:**
  - **`useFiltrosConsulta<F, R>`** é construído sobre `useConsulta`:
    - `setBusca` atualiza a busca na hora e consulta 500 ms depois da última chamada (`ATRASO_BUSCA_PADRAO_MS`). Voltar ao texto da última consulta cancela a espera sem consultar.
    - `definirFiltro`, `limparFiltros` e `recarregar` consultam na hora e cancelam a espera.
    - Desmontar o componente cancela a espera pendente.
  - **`useAcoesSituacaoExclusao<T>`** usa duas instâncias de `useAcaoConfirmada`:
    - mostra um único erro por vez;
    - notifica no sucesso;
    - oferece `limparErros()`;
    - não aplica nada após a desmontagem.
  - **`correspondeASituacao(filtro, item, regras)`** em `filtros.ts`:
    - `'todas'` aceita qualquer item;
    - um filtro com regra usa essa regra;
    - um filtro sem regra aceita o item.
- **Motivação:** pedido do usuário ("Componentizar"), aprovando o item da revisão da F5 que apontou cerca de 70 linhas idênticas entre `useApontamentos` e `useDadosExternos` e o par ativar/desativar + excluir repetido nas duas páginas. A extração foi feita antes da aba Indicadores, que seria a terceira cópia.
- **Como usar / observações técnicas:** as duas abas foram migradas sem alterar os testes, e Apontamentos ficou com −87 linhas. Há uma diferença sutil de comportamento: confirmar uma ação só limpa o erro da outra quando a ação é de fato executada. Requisito `F1.14` `implementado`.

#### Menu de ações reutilizável — MenuAcoes (F1.16*)
- **Tags:** #componente #layout
- **Arquivos:** `src/components/MenuAcoes.tsx`, `src/components/MenuAcoes.css`, `src/components/MenuAcoes.test.tsx`, auxiliar de teste `src/test/menuAcoes.ts`
- **Descrição:** botão com ícone de três pontos verticais que abre um menu flutuante (`role="menu"` e `menuitem`).
  - **Teclado:** setas, Home/End, Esc e Tab.
  - **Fechamento:** um clique fora fecha o menu, e o foco volta ao gatilho.
  - **Instâncias:** só um menu fica aberto por vez no documento.
  - **Posição:** `position: fixed`, calculada a partir do gatilho, para o menu não ser cortado pela rolagem da tabela.
  - **Props:** `rotulo` (nome acessível do gatilho) e `itens` (`rotulo`, `onSelecionar`, `perigo` opcional para ações destrutivas).
- **Motivação:** pedido do usuário na aba Dados Externos. As ações em linha ocupavam espaço e deixavam a tabela larga e poluída.
- **Como usar / observações técnicas:** aplicado em Dados Externos e Apontamentos. Decisão registrada: o `MenuAcoes` é o padrão recomendado para as próximas abas, a confirmar caso a caso. Requisito `F1.16` `implementado`.

#### Normalização do identificador — limparIdentificador
- **Tags:** #dados-externos #validacao
- **Arquivos:** `src/utils/identificador.ts`, `src/pages/dados-externos/FormularioDadoExterno.tsx`, `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `src/pages/dados-externos/SugestoesIdentificador.tsx`
- **Descrição:** `limparIdentificador(texto)` remove tudo que não for A–Z, a–z, 0–9 ou "_" e converte o resultado para maiúsculas.
  - O filtro vem antes da conversão, para que letras como "ß" (que viraria "SS") sejam descartadas.
  - A função é idempotente.
- **Motivação:** ver a Modificação "Identificador do dado externo sem acento, espaço ou caractere especial".
- **Como usar / observações técnicas:** aplicada na digitação, na colagem e na sugestão, tanto no cadastro do Admin quanto em Concluir construção.

#### Auxiliares de teste para digitação rápida
- **Tags:** #testes
- **Arquivos:** `src/test/usuario.ts`, mais 59 arquivos de teste migrados
- **Descrição:**
  - `usuarioRapido()` cria o user-event com `delay: null`, sem o `setTimeout` entre teclas.
  - `colar(user, campo, texto)` preenche um campo vazio com clique + colar.
- **Motivação:** os testes de formulário estavam perto do limite de 15 s e falhavam de forma intermitente.
- **Como usar / observações técnicas:**
  - Não use `usuarioRapido()` em testes com fake timers; nesses, mantenha `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
  - Não use `colar()` onde o teste verifica a transformação ao digitar (como o identificador) nem o debounce da busca.
  - Resultado: a suíte caiu de 284 s para 235 s, os timeouts de 4 para 0, e o teste mais lento de 15,4 s para 7,6 s.

### Modificações

#### Filtro de situação e busca com espera (decisões da revisão da Fase 4)
- **Tags:** #apontamentos #refatoracao
- **Arquivos:** `src/pages/apontamentos/useApontamentos.ts`, `src/pages/apontamentos/ApontamentosPage.tsx` (lógica depois movida para `src/hooks/useFiltrosConsulta.ts` e `src/utils/filtros.ts`)
- **Antes:** havia duas questões em aberto na revisão. Uma era o que fazer com o item desativado quando há filtro de situação ativo; a outra era quando disparar a consulta da busca.
- **Depois:**
  - Com a decisão "Alterar na hora", o item que deixa de corresponder ao filtro de situação sai da lista imediatamente e é descontado da contagem.
  - Com a decisão "esperar 500ms", a busca consulta 500 ms depois da última tecla.
- **Motivação:** a lista deve refletir o filtro escolhido, e a espera evita uma chamada à API a cada tecla.
- **Impacto:** abas Apontamentos e, por meio dos hooks genéricos, Dados Externos.

#### Limites de tempo dos testes
- **Tags:** #testes #configuracao
- **Arquivos:** `vite.config.ts`, `src/test/setup.ts`
- **Antes:** valiam os padrões, com `testTimeout` de 5 s e 1 s para `findBy`/`waitFor`.
- **Depois:** `testTimeout` de 15 s nos testes unitários e `configure({ asyncUtilTimeout: 3000 })` no setup.
- **Motivação:** falhas intermitentes por timeout sob carga. As telas com muita digitação levavam cerca de 4 s, e o estouro de um teste vazava digitação para o seguinte. A abertura completa do app nos testes de integração passava de 1 s.
- **Impacto:** todas as baterias de teste. Não afeta a aplicação.

#### Aba Tipos migrada para a nova infraestrutura
- **Tags:** #tipos #refatoracao
- **Arquivos:** `src/pages/tipos/TiposPage.tsx`, `src/pages/tipos/TiposPage.css`
- **Antes:** a aba tinha tratamento próprio de estado de carga e de ações confirmadas.
- **Depois:** usa `EstadoCarga` e `useAcaoConfirmada` (F1.13*).
- **Motivação:** remover a duplicação apontada na revisão da Fase 4 (F1.13*).
- **Impacto:** nenhuma mudança de comportamento; os testes da aba Tipos não foram alterados.

#### POST de cadastro com 2xx = gravado (F4.7* e F5.11*)
- **Tags:** #correcao #api #apontamentos #dados-externos
- **Arquivos:** `src/services/apontamentosService.ts`, `src/pages/apontamentos/useApontamentos.ts`, `src/services/dadosExternosService.ts`, `src/pages/dados-externos/useDadosExternos.ts`, `src/pages/dados-externos/DadosExternosPage.tsx`, e os testes correspondentes
- **Antes:** `criarApontamento` e `criarDadoExterno` exigiam o registro completo na resposta do POST, num formato que a API não documenta. Contra a API real, o cadastro gravava, mas a tela mostrava "Resposta inválida do servidor." e não atualizava a lista.
- **Depois:**
  - Qualquer resposta 2xx significa que o registro foi gravado.
  - `criarApontamento` aceita o apontamento na raiz ou em `{ apontamento }`, com ou sem mensagem, e devolve `Apontamento | null`. Corpo vazio ou sem apontamento reconhecível resolve `null`, sem erro.
  - `criarDadoExterno` devolve `{ dadoExterno: DadoExterno | null, tarefa: TarefaConstrucao | null }`, e uma tarefa fora do formato vira `null`.
  - Os hooks recarregam a lista após qualquer POST 2xx.
  - O título padrão do pedido à TI usa o nome digitado.
- **Motivação:** bug relatado pelo usuário ao testar contra a API real. A alternativa de manter a validação estrita foi descartada, porque a tela mostrava erro com o dado já gravado.
- **Impacto:** cadastro nas abas Apontamentos e Dados Externos. Os requisitos F4.1, F4.4, F5.1, F5.4, F5.5 e F5.6 passaram por `em-alteracao` e voltaram a `implementado`. Risco conhecido: o PUT de situação, o concluir e o DELETE continuam estritos de propósito, até o back-end confirmar o formato.

#### Diálogos de cadastro mais largos (F1.15*)
- **Tags:** #layout #componente
- **Arquivos:** `src/components/Dialogo.css`, `src/pages/apontamentos/ApontamentosPage.tsx`, `src/pages/dados-externos/DadosExternosPage.tsx`
- **Antes:** todos os diálogos tinham largura máxima de 560 px.
- **Depois:** o modificador `.dialogo--largo` (`max-width: 800px`) é aplicado só aos diálogos "Novo apontamento" e "Novo dado externo".
- **Motivação:** pedido do usuário. O formulário de dado externo tem muitos campos.
- **Impacto:** só os dois diálogos de cadastro; os demais não mudaram. É uma mudança apenas de CSS, sem teste novo e sem requisito vinculado em `requisitos.json`.

#### Tabela de Dados Externos enxuta, com menu de ações
- **Tags:** #dados-externos #layout #componente
- **Arquivos:** `src/pages/dados-externos/TabelaDadosExternos.tsx`, `src/pages/dados-externos/TabelaDadosExternos.css`, `src/components/Tabela.tsx`, `src/pages/dados-externos/DadosExternosPage.tsx`, e os testes de F5.2 e F5.7–F5.9
- **Antes:** a tabela exibia Campo/cálculo, Referência, Coleta, Janela retroativa e Tipo de valor como colunas. As ações eram botões em linha, e a expansão de detalhes usava um botão por linha.
- **Depois:**
  - As cinco colunas passaram aos detalhes expandidos, exibidos num `<dl>` (F5.2).
  - As ações e o "Ver detalhes" ficam no `MenuAcoes`.
  - A `Tabela` ganhou a prop `expandidas` (F1.7), para expansão controlada pelo pai: sem a coluna nem o botão de expandir, seguindo o conjunto de chaves recebido. Sem a prop, a tabela mantém o comportamento anterior.
  - Os testes de F5.7–F5.9 foram adequados ao caminho pelo menu.
- **Motivação:** a tabela estava larga e poluída. A alternativa de manter a seta de expansão em cada linha foi descartada, e a expansão ficou só pelo menu.
- **Impacto:** aba Dados Externos. O componente `Tabela` continua compatível com os usos atuais.

#### Campo ou cálculo obrigatório também para o Admin (F5.4 e F5.5)
- **Tags:** #dados-externos #cadastro #validacao
- **Arquivos:** `src/pages/dados-externos/FormularioDadoExterno.tsx` e os testes correspondentes
- **Antes:** o campo "Campo ou cálculo" não aparecia no cadastro feito pelo Admin.
- **Depois:** o campo aparece para o Admin e é de preenchimento obrigatório.
- **Motivação:** o Admin também precisa registrar o campo ou o cálculo; antes, esse dado se perdia.
- **Impacto:** cadastro de dado externo pelo Admin.

#### Identificador do dado externo sem acento, espaço ou caractere especial (F5.5 e F5.7)
- **Tags:** #dados-externos #validacao
- **Arquivos:** `src/utils/identificador.ts`, `src/pages/dados-externos/FormularioDadoExterno.tsx`, `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `src/pages/dados-externos/SugestoesIdentificador.tsx`, e os testes correspondentes
- **Antes:** o identificador era só convertido para maiúsculas e aceitava acentos, espaços e símbolos.
- **Depois:** só A–Z, 0–9 e "_" são aceitos, em maiúsculas. Os caracteres inválidos são descartados na digitação, na colagem e na sugestão, sem transliteração ("ação ok" vira "AOOK").
- **Motivação:** o identificador aponta para o código da coleta no back-end, e acento ou espaço geram códigos que não batem. A transliteração ("ç" → "c") foi descartada.
- **Impacto:** cadastro do Admin e Concluir construção. Um teste do gerador esperava "Ñandú" → "NAND", o que contrariava a regra de não transliterar, e foi corrigido para "AND".

#### Aba Apontamentos com menu de ações (F4.2–F4.6)
- **Tags:** #apontamentos #layout #componente
- **Arquivos:** `src/pages/apontamentos/TabelaApontamentos.tsx`, `src/pages/apontamentos/TabelaApontamentos.css`, `src/pages/apontamentos/ApontamentosPage.tsx`, e os testes correspondentes
- **Antes:** as ações eram botões em linha, e os detalhes abriam por um botão de expansão.
- **Depois:** o menu "Ações do apontamento X" reúne:
  - "Ver detalhes", só quando há situação alterada;
  - "Desativar" ou "Ativar";
  - "Excluir".

  As colunas não mudaram.
- **Motivação:** manter o mesmo padrão nas abas. As colunas foram mantidas porque o usuário não pediu a tabela enxuta.
- **Impacto:** aba Apontamentos; as permissões continuam as mesmas.

#### Registro de requisitos e plano de implementação
- **Tags:** #documentacao
- **Arquivos:** `requisitos.json`, `docs/plano-implementacao.md`
- **Antes:** a Fase 4 e a Fase 5 estavam sem registro de conclusão.
- **Depois:** foram registrados os requisitos F1.13, F1.14, F1.16, F4.1–F4.6 e F5.1–F5.9 como `implementado`, com o histórico das alterações de 04/11/2026. O plano registra as atividades concluídas, incluindo as não planejadas (F1.13*, F1.14*, F1.15*, F1.16*, F4.7* e F5.11*), e as bloqueadas.
- **Motivação:** fluxo de TDD do projeto e manutenção do plano pelo agente `plano-implementacao`.
- **Impacto:** progresso do plano em 42% (43 de 102 atividades concluídas) e 40 requisitos `implementado`.

### Pendências
- Confirmar com o back-end o formato das respostas de POST/PUT/DELETE que seguem estritas:
  - `alterarSituacao` (apontamentos);
  - `concluirConstrucao`, `alterarSituacaoDadoExterno` e `excluirDadoExterno`;
  - criar e editar em `tiposService`.
- Decisões da revisão da F5 que dependem do usuário:
  - botão de fechar no aviso de indicador criado automaticamente;
  - plural "usado por N dado(s)";
  - aviso quando o usuário não tem tipos no formulário;
  - lacunas de testes, como o `SugestoesIdentificador`, sem teste próprio.
- Fase seguinte: F6 (Indicadores), começando pelo serviço F6.1. Confirmar se a aba usa o `MenuAcoes` e a tabela enxuta.
- Itens bloqueados por ajustes de API: F2.7 (A-01), F3.4 e F3.5 (A-02), F5.10 (A-11) e F6.7 (A-09).

---
