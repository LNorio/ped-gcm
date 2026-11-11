# Documentação — PED

## Índice

| Data | Tags | Resumo |
| --- | --- | --- |
| [10/11/2026](#2026-11-10) | #dados-externos #integracao #indicadores #dashboards #apontamentos #cadastro #api #validacao #componente #layout #navegacao #configuracao #testes #documentacao | Duas builds validadas, decisões da integração, `TextoTruncado`, tabelas sem rolagem, build dividida e abas sob demanda, meta por filial com metas pendentes, meta via API pelo contrato final e commit `a2ab9cc` |
| [09/11/2026](#2026-11-09) | #apontamentos #dados-externos #integracao #cadastro #api #validacao #componente #correcao #testes #documentacao | Build validada, indicadores do apontamento como lista de nomes (F4.9\*) e mudança de requisito "integração de dados externos" (F5.7 e F5.14–F5.18), da tela sem API ao contrato do back-end com validação híbrida |
| [06/11/2026](#2026-11-06) | #tipos #indicadores #dashboards #dados-externos #cadastro #api #validacao #componente #correcao #testes #configuracao #documentacao | Build validada, id da tarefa Bitrix em texto, adequação aos documentos novos do back-end (grupos nos tipos, exclusão de indicador só pelo Admin, tarefas Bitrix, identificador com - e .) e 67/67 requisitos implementados |
| [05/11/2026](#2026-11-05) | #indicadores #dashboards #faixas #apontamentos #dados-externos #cadastro #api #validacao #componente #layout #correcao #testes #documentacao | Abas Indicadores (F6), Dashboards (F7) e Faixas (F8) em TDD, modais alinhadas ao protótipo, RF-54 alterado e correções contra a API real |
| [04/11/2026](#2026-11-04) | #apontamentos #dados-externos #tipos #cadastro #api #validacao #componente #layout #refatoracao #correcao #testes #configuracao #documentacao | Aba Apontamentos (F4) revisada e commitada, aba Dados Externos (F5) implementada, hooks genéricos, MenuAcoes, correção do POST e testes mais rápidos |

---

<a id="2026-11-10"></a>
## 10/11/2026

**Tags:** #dados-externos #integracao #indicadores #dashboards #apontamentos #cadastro #api #validacao #componente #layout #navegacao #configuracao #testes #documentacao

### Visão geral
De manhã o usuário pediu a build ("gere uma build") e decidiu as dúvidas da integração do dado externo que a revisão de qualidade levantou em 09/11. Depois vieram ajustes visuais nas listagens de Dados Externos e Apontamentos. Para resolver o aviso de chunk > 500 kB, a build foi dividida em `vendor` × `index` e as abas passaram a carregar sob demanda. Uma build em andamento foi interrompida para incluir essas mudanças, e a nova build validada saiu por volta das 13h.

À tarde vieram três funcionalidades da aba Indicadores:
- **meta por filial**: o front propôs o contrato, o back-end publicou o seu com diferenças e o front se adequou;
- **"Definir metas pendentes"**: incluída por decisão do usuário, porque sem ela a pendência não tinha como sumir;
- **meta via API**: negociada com o back-end em proposta, contraproposta, resposta do front, resposta final e confirmação. O front foi adequado ao contrato final, mas nada está implementado no back-end.

Também foi ajustado o estilo da modal "Definir meta". O dia terminou com o commit `a2ab9cc`, que reúne o trabalho de 06/11 a 10/11 (o anterior era `f06e197`). A primeira tentativa foi reprovada por timeouts sob carga.

Ao fim do dia:
- 78 requisitos `implementado`;
- typecheck ok e lint só com o aviso antigo (`AlertasMenu.tsx:48`);
- `test:implementados`: unitários 3588/3588 e integração 482/482;
- plano em 73% (93/127).

Também hoje a assinatura do Claude deu erro de cobrança uma vez. Um agente parou e foi retomado, sem efeito no código.

### Implementações

#### Builds validadas do sistema
- **Tags:** #testes #configuracao
- **Arquivos:** `dist/` (gerado; fora do controle de versão)
- **Descrição:** duas builds feitas pelo `build-validado`, só com 100% dos testes dos requisitos implementados.
  - **1ª build** ("gere uma build"), antes dos ajustes do dia:
    - 72/72 requisitos;
    - unitários 3069/3069 e integração 420/420, em baterias separadas, porque a execução única do `test:implementados` falhou por timeouts com Steam, Riot e Spotify abertos;
    - carga 100% 2xx (10.983 requisições, média 45 ms, p99 98 ms);
    - `index-BUMhKzHh.js` com 521 kB e aviso do Vite de chunk > 500 kB.
  - **2ª build** (~13h), iniciada depois da F12.6\* e da F2.9\*. Uma build anterior, já em andamento, foi interrompida para incluir as abas sob demanda.
    - 74/74 requisitos;
    - unitários 3145/3145 e integração 424/424 na execução única;
    - carga 100% 2xx (5.183 requisições, média 97 ms, p99 264 ms, com a máquina carregada);
    - primeira visita com `vendor` 310 kB + `index` 32 kB e um chunk por aba.
- **Motivação:** pedidos do usuário ("gere uma build" e "faça uma nova build dividindo o código em duas partes...").
- **Como usar / observações técnicas:** nenhuma das builds inclui o que foi feito depois das 13h: F4.10\*, F5.19\*, F6.10\*–F6.13\* e a adequação ao contrato final da meta via API.

#### Componente `TextoTruncado` (F1.19\*)
- **Tags:** #componente #layout #dados-externos
- **Arquivos:** `src/components/TextoTruncado.tsx`, `src/components/TextoTruncado.css`, `src/components/TextoTruncado.test.tsx`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `src/pages/dados-externos/TabelaDadosExternos.configuracoes.test.tsx`
- **Descrição:** texto em uma linha que, quando passa da largura disponível, é cortado com reticências e esmaece no final.
  - O texto completo fica no DOM e no `title`, e aparece como dica ao passar o mouse.
  - O corte é detectado por `scrollWidth > clientWidth` e marcado com `data-cortado="true"`. Só nesse caso o esmaecer é aplicado.
  - A medida é refeita com `ResizeObserver`, quando disponível.
  - Aplicado na URL da listagem de Dados Externos.
- **Motivação:** pedido do usuário: "A URL na lista de dados externos está estourando..." (a URL passava da largura da tela).
- **Como usar / observações técnicas:** `<TextoTruncado texto={...} className={...} />`. Houve desvio do TDD: o `ui-componentes` implementou o componente antes dos testes, por ser ajuste visual. O `gerador-testes` escreveu os testes depois (15 em `TextoTruncado.test.tsx` e 1 em `TabelaDadosExternos.configuracoes.test.tsx`). O requisito `F1.19` foi criado já como `implementado`.

#### Build dividida em `vendor` e `index` (F12.6\*)
- **Tags:** #configuracao
- **Arquivos:** `vite.config.ts`
- **Descrição:** a build passou a gerar o grupo `vendor`, com as bibliotecas de `node_modules` (React, React Router), separado do `index`, com o código do sistema. A configuração está em `build.rolldownOptions.output.codeSplitting.groups`. Resultado: `vendor` com 310 kB e `index` com 212 kB.
- **Motivação:** pedido do usuário ("faça uma nova build dividindo o código em duas partes..."), depois do aviso do Vite de chunk > 500 kB (521 kB). O `vendor` muda pouco e fica no cache do navegador entre versões.
- **Como usar / observações técnicas:** sem dependências novas. Resolve a dúvida do chunk > 500 kB registrada no plano.

#### Abas carregadas sob demanda (F2.9\*)
- **Tags:** #navegacao #layout #configuracao
- **Arquivos:** `src/rotas.tsx`, `src/layout/LayoutPrincipal.tsx`, `src/rotas.sobDemanda.test.ts`, `src/rotas.sobDemanda.integration.test.tsx`, `src/layout/LayoutPrincipal.sobDemanda.test.tsx`, `src/rotas.test.tsx`, `src/test/renderizarApp.tsx`
- **Descrição:**
  - As páginas das abas e a 404 são carregadas com `React.lazy` + `import()` dinâmico, e cada uma vira um chunk próprio.
  - `LoginPage`, `SemAcessoPage` e `ErroPage` continuam com import estático: são a entrada da aplicação e o fallback de erro.
  - O `LayoutPrincipal` envolve o `Outlet` num `Suspense` com `key={location.pathname}`. Enquanto o chunk baixa, mostra "Carregando..." (`RegiaoStatus`), e o cabeçalho, as abas e o rodapé continuam visíveis.
  - A `key` é necessária porque o React Router navega dentro de `startTransition`. Sem ela, a aba anterior ficaria na tela durante o download.
  - Falha ao baixar um chunk cai no `errorElement` (`ErroPage`).
- **Motivação:** pedido do usuário ("carrega as abas sob demanda"): primeira carga mais leve. A primeira visita passou de `index` 212 kB para 32 kB, mais o `vendor` de 310 kB.
- **Como usar / observações técnicas:** os testes da F2.3 foram adaptados para `findBy*`, sem mudar o que verificam. Depende da F12.6\*. Requisito `F2.9` `implementado`.

#### Meta por filial (F6.10\*)
- **Tags:** #indicadores #cadastro #api #validacao
- **Arquivos:** `src/pages/indicadores/CamposMetaPorFilial.tsx`, `useMetaPorFilial.ts`, `FormularioIndicador.tsx`, `DialogoDefinirMeta.tsx`, `TabelaIndicadores.tsx`, `IndicadoresPage.tsx`, `useIndicadores.ts`; `src/services/indicadoresService.ts`, `src/services/adaptadores.ts`, `src/types/dominio.ts`; testes `*.metasPorFilial.*`, `*.errosPorFilial.*`, `*.metaFilialPendente.*` e `TabelaIndicadores.campoMetaPorFilial.test.tsx`; `src/test/indicadoresFalsos.ts`
- **Descrição:**
  - Vale no cadastro do indicador e no "Definir meta".
  - Na visão "Todas as filiais", o checkbox "Replicar a meta para todas as filiais" vem marcado. Desmarcado, lista as filiais com a meta de cada uma.
  - Com uma filial selecionada no cabeçalho, a meta vale só para ela.
  - Os erros 400 por filial (`errosPorFilial`) aparecem no campo de cada filial.
  - As filiais sem meta geram alerta na listagem ("Meta pendente em N filiais", "Filiais sem meta") e no sinal da aba.
  - Novo filtro "Meta pendente por filial" (`meta_filial_pendente`).
  - O campo `meta por filial` é lido da API; quando vem ausente, é derivado de `metas por filial` não vazia. A meta é enviada como número.
- **Motivação:** pedido do usuário (checkbox para replicar a meta para todas as filiais e alerta das filiais em branco). Decisões do usuário: propor o contrato e implementar, valer nos dois fluxos e mostrar o alerta na listagem e no sinal da aba.
- **Como usar / observações técnicas:**
  - O front escreveu `docs/propostas-backend/PROPOSTA-meta-por-filial.md` em paralelo à implementação ("faça o documento de contrato em paralelo").
  - À tarde o back-end publicou `docs/backend/FRONT-meta-por-filial.md` e `docs/backend/API (26).md`, com diferenças que foram adequadas (ver Modificações).
  - Impactos anotados no plano em F9.9 e F10.3/F10.4.

#### "Definir metas pendentes" (F6.12\*)
- **Tags:** #indicadores #cadastro #api
- **Arquivos:** `src/pages/indicadores/DialogoDefinirMetasPendentes.tsx`, `src/pages/indicadores/useMetasPendentesIndicador.ts`, `src/services/indicadoresService.ts` (`definirMetasPendentes`), testes `DialogoDefinirMetasPendentes.test.tsx`, `*.metasPendentes.*`
- **Descrição:** ação do menu que abre uma modal com as filiais sem meta e grava por `PUT /api/ped/indicadores-cadastro/{id}/metas-filiais` (`{ "metas por filial": [...] }`). A ação aparece para Admin e Validador, só em indicadores ativos que têm filiais pendentes. Não aparece em indicadores "Meta a definir" nem com meta via API (`terceiro`).
- **Motivação:** decisão do usuário de incluir a ação, porque sem ela a pendência de meta por filial não tinha como ser resolvida pela tela.
- **Como usar / observações técnicas:** a rota real é `metas-filiais`. Depende da F6.10\*. Fica oculta em indicador "Meta a definir", comportamento assumido que precisa de confirmação.

#### Meta via API (F6.11\*)
- **Tags:** #indicadores #dados-externos #integracao #cadastro #api #validacao
- **Arquivos:** `src/utils/metaViaApi.ts`, `src/pages/indicadores/useIntegracaoIndicador.ts`, `FormularioIndicador.tsx`/`.css`, `DialogoDefinirMeta.tsx`, `TabelaIndicadores.tsx`, `IndicadoresPage.tsx`, `useIndicadores.ts`; `src/pages/dados-externos/DialogoConcluirConstrucao.tsx` (modal da integração generalizada); `src/services/indicadoresService.ts` (`atualizarIntegracaoIndicador`), `src/services/adaptadores.ts`, `src/types/dominio.ts`, `src/sessao/permissoes.ts`; testes `*.metaViaApi.*` e `*.fonteDaMeta.*`
- **Descrição:** fluxo do contrato final (`RESPOSTA-FINAL-meta-via-api.md`):
  - O campo `fonte da meta` é um enum: `dado_externo` ou `integracao`.
  - O checkbox "Meta vinda do dado externo" só aparece quando o dado externo da composição fornece meta (`forneceMeta`). Marcado, a fonte é `dado_externo`: a chamada não é executada de novo, e o cadastro serve de apoio e organização.
  - Desmarcado, a fonte é `integracao`. Aparece o botão de configuração, só para o Admin, que abre a mesma modal dos dados externos com todos os campos obrigatórios.
  - A meta automática nunca é editável ("Meta editável" fica oculta e vai `"meta editavel": false`).
  - O mesmo checkbox existe no cadastro e no "Definir meta".
  - Etiquetas por situação (`situacao da meta via api`), coluna Meta "Via API", filtro e alerta "Integração pendente (TI)" na fonte `integracao`.
  - Na fonte `integracao`, aparece o aviso de que a consulta ainda não está disponível.
  - Agregação: a meta segue a regra do dado.
- **Motivação:** pedidos do usuário:
  - checkbox de buscar metas via API, com botão de configuração só para o Admin e modal igual à de dados externos;
  - o mesmo checkbox na modal "Definir meta";
  - meta via API não editável manualmente.
  
  Depois da contraproposta do back-end, valeu a ideia do usuário: um caminho só, com o flag. A regra de agregação também foi decisão do usuário.
- **Como usar / observações técnicas:** histórico dos documentos em `docs/propostas-backend/`:
  1. `PROPOSTA-meta-via-api.md` (pedido "criar um documento de proposta");
  2. `CONTRAPROPOSTA-meta-via-api.md` do back-end ("API" = web service do ERP, em etapas 1 e 2);
  3. `RESPOSTA-FRONT-contraproposta-meta-via-api.md`;
  4. `RESPOSTA-FINAL-meta-via-api.md`: meta do ERP liberada para faturamento e os 6 volumes, os outros 4 indicadores com meta manual, fonte fixa, saída da integração em lista, variáveis `%empresa%`/`%empresas%`, tarefa do Bitrix quando o Validador cadastra na fonte `integracao` e executor só na fase 2;
  5. `CONFIRMACAO-FRONT-meta-via-api.md`.

  Nada está implementado no back-end: a fase 1 está pendente e a F6.14\* segue bloqueada (A-15).

#### Integração do dado externo em modo leitura (F5.19\*)
- **Tags:** #dados-externos #integracao #indicadores #componente
- **Arquivos:** `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `src/pages/dados-externos/DialogoConcluirConstrucao.leitura.test.tsx`
- **Descrição:** modo "leitura" da modal de integração, usado pela ação "Ver integração do dado externo" (Admin) quando a fonte da meta é `dado_externo`.
- **Motivação:** decisão do negócio e da TI no contrato final do back-end (`RESPOSTA-FINAL-meta-via-api.md`):
  - seção 1: "Integração na fonte ERP: não se cadastra integração no indicador; mostra-se a integração do dado externo, só para leitura";
  - seção 4, item 4: "Para o Admin na fonte dado_externo, abrir a integração do dado externo, só para leitura".

  O front confirmou em `CONFIRMACAO-FRONT-meta-via-api.md`, atendendo ao pedido do usuário "leia a proposta final e faça as alterações necessárias".
- **Como usar / observações técnicas:** requisito `F5.19` novo, `implementado`. A F6.11\* e a F6.14\* dependem dele. Por causa dele, o antigo F5.19\* do plano (Dados Externos sem rolagem) foi renumerado para F5.20\*.

#### Documentos de contrato com o back-end
- **Tags:** #documentacao #api
- **Arquivos:**
  - `docs/propostas-backend/`: `PROPOSTA-meta-por-filial.md`, `PROPOSTA-meta-via-api.md`, `CONTRAPROPOSTA-meta-via-api.md`, `RESPOSTA-FRONT-contraproposta-meta-via-api.md`, `RESPOSTA-FINAL-meta-via-api.md` e `CONFIRMACAO-FRONT-meta-via-api.md`;
  - `docs/backend/`: `FRONT-meta-por-filial.md` e `API (26).md`.
- **Descrição:** propostas e respostas do front (escritas pelos agentes a pedido do usuário) e documentos publicados pelo back-end. Todos entraram no commit.
- **Motivação:** pedidos do usuário ("faça o documento de contrato em paralelo", "criar um documento de proposta", "leia os novos documentos de backend...").
- **Como usar / observações técnicas:** a negociação também está registrada no histórico do plano (A-14 resolvida; A-15 pendente no back-end).

### Modificações

#### Decisões sobre as dúvidas da integração do dado externo (F5.7, F5.14, F5.16, F5.18)
- **Tags:** #dados-externos #integracao #validacao
- **Arquivos:** `src/utils/integracao/` (`saida.ts`, `entrada.ts`, `expressoes.ts` e outros), `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `PainelVariaveis.tsx`, testes correspondentes
- **Antes:** a revisão de 09/11 deixou estes pontos em aberto:
  - se a entrada deveria aceitar lista;
  - tipos da saída como "número" no motor local e `numero` no back-end;
  - variável clicada sem cursor ia para a posição 0 e quebrava o JSON;
  - sem os limites de 60/500 caracteres;
  - erros do 400 só sumiam no novo envio.
- **Depois:**
  - a entrada continua só em objeto (o risco em Configurações foi aceito);
  - valem os nomes de tipo do back-end (`numero`);
  - variável ou operador sem cursor vai para o fim e, depois, para a última posição do usuário; "Inserir modelo" reinicia a posição;
  - identificador limitado a 60 caracteres e URL a 500;
  - o erro do 400 some do campo ao editá-lo.
  - O ponto "`campo` = caminho no JSON" ficou como dúvida rebaixada: não foi possível confirmar sem o back-end, e o código aceita `caminho` ou `campo`.
- **Motivação:** decisões do usuário sobre os pontos da revisão de qualidade de 09/11.
- **Impacto:** modal de concluir/configurar a integração. Os requisitos passaram por `em-alteracao` e voltaram a `implementado` (73 na época; unitários 3118, integração 422).

#### Listagem de Dados Externos sem rolagem lateral (F5.20\*)
- **Tags:** #dados-externos #layout
- **Arquivos:** `src/pages/dados-externos/TabelaDadosExternos.tsx`, `TabelaDadosExternos.css`, `DadosExternosPage.css`
- **Antes:** a tabela tinha rolagem lateral, por causa do `nowrap` nas células e do teto de 1240px.
- **Depois:** identificador com `TextoTruncado`, identificador e URL limitados a `min(14rem, 50vw)`, Nome e Cadastro com quebra de linha e conteúdo até 1600px, só nesta aba.
- **Motivação:** pedido do usuário ("diminuir o campo de identificador da listagem e aumentar o tamanho da tabela...").
- **Impacto:** só visual, sem teste novo. Falta a conferência no navegador pelo usuário. Foi numerada F5.19\* no plano e renumerada para F5.20\*.

#### Listagem de Apontamentos sem rolagem lateral (F4.10\*)
- **Tags:** #apontamentos #layout
- **Arquivos:** `src/pages/apontamentos/TabelaApontamentos.tsx`, `TabelaApontamentos.css`, `ApontamentosPage.css` e testes de `ApontamentosPage`/`TabelaApontamentos`
- **Antes:** a listagem tinha rolagem lateral e a coluna Indicadores não tinha limite de largura.
- **Depois:** área de até 1440px só nesta aba, Nome até 20rem, Indicadores até 16rem com quebra de linha, Tipo e Cadastro até 10rem.
- **Motivação:** pedido do usuário ("aumentar um pouco o tamanho da listagem da aba de apontamentos para não aparecer a barra de rolagem lateral e limitar o tamanho da coluna de indicadores"). A causa é a mesma da F5.20\*.
- **Impacto:** só visual. Falta a conferência no navegador.

#### Estilo da modal "Definir meta" (F6.13\*)
- **Tags:** #indicadores #layout
- **Arquivos:** `src/pages/indicadores/DialogoDefinirMeta.tsx`, `src/pages/indicadores/FormularioIndicador.css`
- **Antes:** layout da modal mostrado no print do usuário.
- **Depois:** origem no bloco "Composição", Meta e Sentido lado a lado, largura máxima de 560px e rodapé com padding e filete.
- **Motivação:** pedido do usuário com print ("ajustar o estilo").
- **Impacto:** só visual. Falta a conferência pelo usuário.

#### Adequação ao contrato do back-end da meta por filial (API 26)
- **Tags:** #indicadores #api #validacao
- **Arquivos:** `src/services/indicadoresService.ts`, `src/services/adaptadores.ts`, `src/types/dominio.ts`, `src/pages/indicadores/*`, testes `*.errosPorFilial.*` e `*.metaFilialPendente.*`
- **Antes:** o front seguia a sua proposta (`PROPOSTA-meta-por-filial.md`).
- **Depois:** as diferenças publicadas pelo back-end foram adequadas: erros 400 por filial (`errosPorFilial`) no campo de cada filial, campo `meta por filial`, filtro `meta_filial_pendente` ("Meta pendente por filial") e meta enviada como número.
- **Motivação:** pedido do usuário ("leia os novos documentos de backend..."), depois da publicação de `FRONT-meta-por-filial.md` e `API (26).md`.
- **Impacto:** F1.3, F6.1, F6.2, F6.3, F6.5, F6.6 e F6.7 passaram por `em-alteracao` e voltaram a `implementado` (77 requisitos na época; unitários 3402, integração 462).

#### Meta via API adequada ao contrato final (F1.3, F5.1, F5.7, F5.14–F5.16, F5.18, F6.3, F6.11, F7.6)
- **Tags:** #indicadores #dados-externos #dashboards #integracao #api
- **Arquivos:** `src/utils/metaViaApi.ts`, `src/utils/integracao/` (saída em lista), `src/types/dominio.ts`, `src/services/adaptadores.ts`, `src/services/dadosExternosService.ts`, `src/pages/dashboards/regrasDashboard.ts`, `src/pages/dashboards/SecaoIndicadores.tsx`, `src/pages/indicadores/*`, testes `*.fonteDaMeta.*` e `*.metaViaApi.*` (inclusive de dashboards)
- **Antes:**
  - checkbox "Buscar metas via API" (`"origem da meta": "terceiro"`) com integração própria;
  - saída da integração em objeto;
  - etiqueta única "Integração pendente (TI)".
- **Depois:**
  - `fonte da meta`: `dado_externo` (checkbox "Meta vinda do dado externo", só com dado externo `forneceMeta`) ou `integracao` (botão de configuração, modal com todos os campos obrigatórios);
  - saída em lista (`filial` + `valor`/`meta`);
  - etiquetas por situação;
  - os dashboards recusam indicadores da fonte `integracao` sem situação `ok`.
  - A F6.11\* foi reaberta e concluída no mesmo dia.
- **Motivação:** contrato decidido pelo negócio e pela TI (`RESPOSTA-FINAL-meta-via-api.md`) e pedido do usuário "leia a proposta final e faça as alterações necessárias".
- **Impacto:** abas Indicadores, Dados Externos e Dashboards. Impacto anotado na F9.9: `403` para indicador `terceiro`, que não aparece em `GET /api/ped/metas`. São 78 requisitos `implementado`.

#### Commit `a2ab9cc` e testes divididos em baterias paralelas
- **Tags:** #testes #configuracao #documentacao
- **Arquivos:** 158 arquivos (trabalho de 06/11 a 10/11, desde `f06e197`), incluindo `CLAUDE.md`, `.claude/agents/plano-implementacao.md`, `.claude/scripts/plano-html.mjs` e `docs/plano-implementacao.html` (mudanças de configuração do próprio usuário), além dos fechamentos de 06/11 e 09/11
- **Antes:** primeira tentativa de commit reprovada na bateria de integração (98,48%, 455/462). Foram 7 timeouts sob carga, e todos os testes passaram isolados. Não houve commit.
- **Depois:** a pedido do usuário ("suba mais dois subagentes para realizarem os testes de forma paralela"), as baterias foram divididas em 4 agentes: unitários A/B e integração A/B. Todas deram 100% (unitários 3588/3588, integração 482/482), e o commit `a2ab9cc` foi feito com o hook aprovando.
- **Motivação:** pedido de commit do usuário e instabilidade dos testes sob carga.
- **Impacto:** o histórico do Git passa a ter todo o trabalho desde `f06e197`. O push para o GitHub não foi feito, porque não foi pedido.

### Pendências
- Back-end: fase 1 da meta via API e executor (fase 2). A F6.14\* segue bloqueada (A-15).
- Comportamentos assumidos que precisam de confirmação:
  - erro na consulta deixa o indicador indisponível no dashboard;
  - etiquetas de situação da meta via API para todos os perfis;
  - sem `meta via api`, não mostra aviso;
  - falha ao carregar os dados externos no "Definir meta" é silenciosa (o checkbox "Meta vinda do dado externo" não aparece);
  - "Definir metas pendentes" some em indicador "Meta a definir";
  - no 400 por filial, erros com `filial: null` diferentes da mensagem principal não aparecem.
- Confirmar com o back-end que `campo` nos erros de validação é o caminho no JSON.
- Conferência visual pelo usuário: tabelas de Dados Externos e Apontamentos e modal "Definir meta".
- Builds: nenhuma build validada inclui as mudanças feitas depois das 13h (meta por filial, meta via API, metas pendentes, tabelas e estilo).
- Testes instáveis sob carga: avaliar os timeouts ou manter as baterias divididas.
- Push para o GitHub não foi feito (não foi pedido).
- Próximas atividades do plano: F5.10, F9.1, F10.1, F11.1 e F1.18.

---

<a id="2026-11-09"></a>
## 09/11/2026

**Tags:** #apontamentos #dados-externos #integracao #cadastro #api #validacao #componente #correcao #testes #documentacao

### Visão geral
O dia começou pela build, que tinha falhado em 06/11 ("dashboard não está carregando novamente" / build). Em seguida o usuário relatou que "na aba de apontamentos não está mostrando os indicadores vinculados". Isso virou a correção F4.9\*, e a build foi refeita ("faça a nova build").

A maior parte do dia foi a mudança de requisito "integração de dados externos" ("leia o arquivo de mudança e faça a implementação"). O ponto de partida foi o documento `docs/PED — Mudança de requisito integração de dados externos.md`. Ao concluir a construção de um dado externo, a TI passa a registrar numa modal a integração completa: identificador, URL, parâmetros de saída e de entrada. Os JSONs são validados, aceitam variáveis e expressões, e há um botão Configurações e um alerta de integração pendente. Tudo isso é só para o Admin.

Como não havia contrato no back-end, o usuário decidiu de manhã fazer "só a tela, sem API". À tarde o back-end publicou o contrato (`docs/backend/FRONT-integracao-dado-externo.md` e `docs/backend/API (25).md`), e o usuário pediu "leia os novos arquivos de backend e faça as mudanças". Houve mudança de rumo: concluir, Configurações, variáveis, pendentes e validação passaram a usar as rotas reais.

A validação em tempo real ficou híbrida ("front primeiro, back depois"), por decisão do usuário. A API (25) também foi comparada com a (24) ("leia também o arquivo de API(25)"). Tudo seguiu o TDD. Ao fim do dia:
- 72 requisitos implementados;
- `test:all` 3489/3489;
- `test:implementados`: unitários 3069/3069 e integração 420/420;
- typecheck ok e lint só com o aviso antigo (`AlertasMenu.tsx:48`);
- plano em 72% (83/116).

Nada foi commitado.

### Implementações

#### Build validada do sistema
- **Tags:** #testes
- **Arquivos:** `dist/` (gerado; fora do controle de versão)
- **Descrição:** build feita pelo `build-validado`, só com 100% dos testes dos requisitos implementados.
  - A build final, das 09:21, já inclui a F4.9\*: 67/67 requisitos, unitários 2646/2646, integração 377/377 e carga com 100% de respostas 2xx (28.185 requisições, média de 17 ms, p99 de 42 ms). O bundle gerado é o `index-BVDCRcit.js`, com 493 kB.
  - Antes dela, segundo o registro do plano, houve uma build do mesmo dia sem a F4.9\*: unitários 2627/2627, integração 375/375 e `index-k_JAyCbp.js` com 492,87 kB.
- **Motivação:** pedidos do usuário ("faça a build" no início do dia e "faça a nova build" depois da F4.9\*).
- **Como usar / observações técnicas:**
  - As builds de 06/11 e a primeira tentativa de 09/11 falharam por timeouts dos testes, com a máquina sobrecarregada (jogo, Spotify, Riot e Steam abertos). Com os programas fechados a pedido do usuário, passou. Não houve mudança de código por causa disso.
  - Rode a build com a máquina aliviada.

#### Motor local de validação da integração (F5.14)
- **Tags:** #dados-externos #integracao #validacao
- **Arquivos:** `src/utils/integracao/json.ts`, `url.ts`, `saida.ts`, `expressoes.ts`, `entrada.ts`, `erros.ts`, `exemplos.ts`, `modelos.ts` e os testes `*.test.ts` de cada um
- **Descrição:** funções puras que validam a integração na tela.
  - `json.ts`: parser JSON próprio, com a mesma gramática do `JSON.parse`. No erro, devolve linha e coluna (a partir de 1) e a explicação em pt-BR, no formato `Linha L, coluna C: <explicação>`. `\r\n` conta como uma quebra. Texto sem aspas de fechamento aponta para a aspa de abertura; fim inesperado aponta para logo depois do último caractere.
  - `url.ts` (`urlValida`): sem os espaços das pontas, a URL começa com `http://` ou `https://`, tem algo depois do esquema e não tem espaços no meio.
  - `saida.ts` (`validarSaida`):
    - objeto → campos e tipos;
    - lista → campos do primeiro item, que deve ser objeto;
    - os tipos saem em português (texto, número, booleano, nulo, lista, objeto);
    - o resultado é `vazio`, `valido` (com resumo, ex.: `3 campos: valor (texto), ...`) ou `invalido`.
  - `expressoes.ts`:
    - variáveis entre `%`;
    - operadores `+ - * / ^`, parênteses e sinal negativo, com precedência: parênteses, potência (à direita), sinal negativo, multiplicação/divisão e soma/subtração;
    - números com vírgula ou ponto; resultado com vírgula, sem zeros desnecessários;
    - datas (variáveis do tipo `data` ou `dd/mm/aaaa`): data ± número soma ou subtrai dias, sufixo `m` são meses e `a` são anos, e data − data dá a quantidade de dias;
    - dia inexistente no mês de destino vira o último dia desse mês;
    - variável sem valor de exemplo vale 1 se for número, o próprio nome se for texto e `hoje` se for data.
  - `entrada.ts` (`validarEntrada`): percorre objetos e listas aninhados na ordem do JSON e resolve cada texto. O caminho usa `.` e `[i]`. Devolve as variáveis usadas, os cálculos e a prévia do JSON resolvido. Os erros saem no formato `Campo "<caminho>": <motivo> em "<expressão>"`.
  - `erros.ts` (`formatarErroIntegracao`): formata os erros do back-end. Com linha e coluna, usa o formato do parser; com caminho e expressão, o formato de campo; senão, só a mensagem.
  - `exemplos.ts` (`valoresDeExemplo`):
    - período no mês de `hoje`;
    - `mesesRetro` da janela retroativa e `diaColeta` do dia da coleta (ambos `null` → 1);
    - filial, colaborador e zona fictícios;
    - o `exemplo` da API de variáveis prevalece.
  - `modelos.ts`: `MODELO_JSON_SAIDA` e `MODELO_JSON_ENTRADA`, usados por "Inserir modelo" (válidos pelo próprio motor).
- **Motivação:** documento de mudança de requisito de 09/11, que pede a validação dos JSONs antes de ativar o dado.
  - O parser próprio existe porque o `JSON.parse` dá mensagens em inglês e sem posição.
  - De manhã era a única validação ("só a tela, sem API"). À tarde passou a ser a primeira camada da validação híbrida (F5.18).
- **Como usar / observações técnicas:**
  - Requisito `F5.14` (atividade não planejada F5.14\*).
  - Recusa entrada em lista `[ ]`, que o contrato aceita (pendência).
  - A correção da revisão de que `aaaa-mm-dd` sozinho não vira conta não tem teste.

#### Variáveis da integração pela API (F5.15)
- **Tags:** #dados-externos #integracao #api #componente
- **Arquivos:** `src/services/dadosExternosService.ts` (`listarVariaveisIntegracao`), `src/services/dadosExternosService.variaveis.test.ts`, `src/pages/dados-externos/useVariaveisIntegracao.ts`, `src/pages/dados-externos/PainelVariaveis.tsx`, `src/types/dominio.ts` (`VariavelIntegracao`, `TIPOS_VARIAVEL_INTEGRACAO`)
- **Descrição:**
  - `listarVariaveisIntegracao` chama `GET /api/ped/integracao/variaveis` (só Admin) e aceita lista pura ou `{ variaveis: [...] }`.
  - Cada item vem como `{ variavel: "%filial%", nome, tipo, descricao, exemplo }`:
    - o nome vem de `nome` (ou `variavel`), sem os `%`;
    - o tipo é `numero`, `texto` ou `data`;
    - descrição ausente vira `''`;
    - exemplo numérico vira texto; ausente vira `null`.
  - Item fora do formato rejeita a resposta com "Resposta inválida do servidor.".
  - `useVariaveisIntegracao` carrega as variáveis a cada abertura da modal e ignora respostas atrasadas.
  - `PainelVariaveis` mostra os botões das variáveis e dos operadores (`+ - * / ^ ( )`). Eles inserem o texto no cursor do JSON de entrada, e as variáveis usadas ficam destacadas (`aria-pressed`).
- **Motivação:** decisão do usuário de manhã, de variáveis "só da API", sem a lista de reserva do documento. A rota inicial foi proposta pelo front (`GET /api/ped/dados-externos-cadastro/variaveis`). À tarde foi trocada pela rota real do contrato, cujo `exemplo` passou a ser usado na prévia.
- **Como usar / observações técnicas:** requisito `F5.15`. `useVariaveisIntegracao` não tem teste próprio; é coberto pelos testes de integração.

#### Configurações da integração (F5.16)
- **Tags:** #dados-externos #integracao #cadastro #api
- **Arquivos:** `src/sessao/permissoes.ts`, `src/sessao/permissoes.integracao.test.ts`, `src/services/dadosExternosService.ts` (`atualizarIntegracao`), `src/services/dadosExternosService.configuracoes.test.ts`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `TabelaDadosExternos.configuracoes.test.tsx`, `useDadosExternos.ts`, `useDadosExternos.configuracoes.test.tsx`, `DadosExternosPage.tsx`, `DadosExternosPage.configuracoes.integration.test.tsx`, `DialogoConcluirConstrucao.tsx`, `DialogoConcluirConstrucao.configuracoes.test.tsx`
- **Descrição:**
  - Nos dados ativos e inativos, o menu de ações ganhou, logo após "Ver detalhes", a ação "Configurações" ("Preencher integração" quando a integração está pendente).
  - A ação abre a mesma modal em modo `configurar`: título "Configurações da integração" e botão "Salvar configurações". Os campos vêm preenchidos com os valores salvos (JSONs com `JSON.stringify(..., null, 2)`).
  - Salvar envia `PUT /api/ped/dados-externos-cadastro/{id}/integracao`, com o mesmo corpo do concluir. Mostra "Integração atualizada.", recarrega a lista com os filtros atuais e consulta os pendentes de novo.
  - A situação não muda e nenhum indicador é criado.
  - A ação depende da nova permissão `configurar-integracao-dado-externo`, só do Admin.
- **Motivação:** documento de mudança de requisito (botão Configurações para editar a integração). Ficou de fora de manhã por depender da API e foi feito com o contrato publicado à tarde.
- **Como usar / observações técnicas:** requisito `F5.16`. Risco: os textos salvos não passam pelo back-end na abertura, então um dado salvo com entrada em lista abre com o botão bloqueado (pendência).

#### Alerta de integração pendente (F5.17)
- **Tags:** #dados-externos #integracao #api #componente
- **Arquivos:** `src/services/dadosExternosService.ts` (`listarIntegracoesPendentes`), `src/services/dadosExternosService.pendentes.test.ts`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `TabelaDadosExternos.css`, `TabelaDadosExternos.pendentes.test.tsx`, `DadosExternosPage.tsx`, `DadosExternosPage.css`, `DadosExternosPage.pendentes.integration.test.tsx`
- **Descrição:**
  - Para o Admin, a página consulta `GET .../integracoes-pendentes` (`{ quantidade, dados: [{ id, nome, identificador, situacao }] }`) ao carregar e depois de concluir ou salvar.
  - Com quantidade > 0:
    - mostra o aviso "N dados externos com integração pendente (TI)." (singular com 1), com o botão "Ver pendentes", que aplica o filtro `integracao_pendente`;
    - marca a aba Dados Externos no menu (`definirAlerta('dados-externos', ...)`). A marca não some ao sair da aba.
  - A linha do dado pendente mostra a etiqueta "Integração pendente (TI)".
  - Falha da consulta é silenciosa.
- **Motivação:** documento de mudança de requisito (alerta de integração pendente). Feito com o contrato publicado à tarde.
- **Como usar / observações técnicas:** requisito `F5.17`. O sinal usa o contexto `AlertasMenu` (05/11).

#### Validação pelo back-end, híbrida (F5.18)
- **Tags:** #dados-externos #integracao #validacao #api
- **Arquivos:** `src/services/dadosExternosService.ts` (`validarIntegracao`), `src/services/dadosExternosService.validacao.test.ts`, `src/pages/dados-externos/useValidacaoServidor.ts`, `ValidacaoIntegracao.tsx`, `DialogoConcluirConstrucao.tsx`, `DialogoConcluirConstrucao.validacaoServidor.test.tsx`, `DadosExternosPage.validacaoServidor.integration.test.tsx`, `DialogoConcluirConstrucao.css`
- **Descrição:**
  - O motor local (F5.14) mostra o resultado na hora.
  - 400 ms (`ATRASO_VALIDACAO_SERVIDOR_MS`) depois da última mudança, `useValidacaoServidor` chama `POST /api/ped/integracao/validar` só com os textos não vazios. Com os dois vazios, não chama; os valores salvos na abertura também não disparam chamada.
  - O resultado do back-end vale por campo enquanto o texto for o enviado.
  - Respostas fora de ordem ou após o fechamento são ignoradas. Falha mantém o resultado local, e a próxima mudança tenta de novo.
  - A resposta é convertida:
    - saída: campos e tipos, ou erro com linha/coluna;
    - entrada: variáveis usadas, cálculos, prévia ou erros. O `campo` do back-end é lido como caminho no JSON, e `caminho`, quando vem, prevalece.
  - `ValidacaoSaida` e `ValidacaoEntrada` exibem o resultado em vigor num `role="status"`.
- **Motivação:** decisão do usuário pela validação híbrida "front primeiro, back depois". Foram descartadas a validação só pelo back-end (a recomendada, por evitar divergência) e só o motor do front.
- **Como usar / observações técnicas:**
  - Requisito `F5.18`.
  - Correção da revisão: `overflow-wrap` nas faixas de validação.
  - `useValidacaoServidor` não tem teste próprio; é coberto pelos testes de integração.
  - A leitura de `campo` como caminho ainda precisa de confirmação do back-end.

#### Documentos da mudança de requisito e do back-end
- **Tags:** #documentacao #integracao
- **Arquivos:** `docs/PED — Mudança de requisito integração de dados externos.md`, `docs/backend/FRONT-integracao-dado-externo.md`, `docs/backend/API (25).md`
- **Descrição:** documentos novos incluídos no projeto (ainda não versionados).
  - O primeiro é o documento de mudança de requisito, de 09/11, de Leonardo Norio.
  - Os outros dois são o contrato da integração publicado pelo back-end à tarde.
  - Na comparação com a API (24), a única novidade a implementar agora era a integração. O restante já tinha sido feito em 06/11 (tipos com grupos, exclusão de indicador só Admin, RN-12, Bitrix, filiais por abrangência) ou pertence a fases já anotadas no plano (reabertura F9.12, imagens F10.6/F10.7, referências F5.10).
  - A aba Usuários continua fora do escopo (A-13).
  - Nota nova em F11.2: o `aviso de acesso` vem `null` também para o Validador.
- **Motivação:** pedidos do usuário ("leia o arquivo de mudança...", "leia os novos arquivos de backend...", "leia também o arquivo de API(25)").
- **Como usar / observações técnicas:** o plano passou a citar esses documentos como fontes.

### Modificações

#### Indicadores do apontamento como lista de nomes (F4.9\*)
- **Tags:** #apontamentos #api #correcao
- **Arquivos:** `src/types/dominio.ts`, `src/services/adaptadores.ts`, `src/services/apontamentosService.ts`, `src/test/apontamentosFalsos.ts`, `src/services/adaptadores.test.ts`, `src/services/apontamentosService.test.ts`, `src/pages/apontamentos/ApontamentosPage.test.tsx`, `TabelaApontamentos.test.tsx`, `ApontamentosPage.integration.test.tsx`, `ApontamentosPage.exclusao.integration.test.tsx`
- **Antes:** o front esperava `indicadores` como `[{ id, nome }]` (`ReferenciaNomeada[]`). Com a API real (`"indicadores": ["teste 2", "teste indicador", "testes"]`), a coluna Indicadores ficava vazia sem erro, e o aviso de bloqueio da exclusão listava nomes vazios.
- **Depois:**
  - Novo tipo `IndicadorDoApontamento { id: number | null; nome }`.
  - `paraIndicadorDoApontamento` converte texto em `{ id: null, nome }` e mantém o `id` numérico dos objetos.
  - `ehApontamentoApi` aceita `indicadores` ausente, `null` ou lista de textos e/ou objetos com `nome`. Outro formato rejeita a listagem com "Resposta inválida do servidor.", e no POST/PUT devolve `null`.
  - A fixture aceita objetos, nomes ou lista mista.
- **Motivação:** bug relatado pelo usuário contra a API real ("na aba de apontamentos não está mostrando os indicadores vinculados").
- **Impacto:** aba Apontamentos (coluna Indicadores e aviso de bloqueio da exclusão). Requisitos F4.1, F4.2 e F4.6 passaram por `em-alteracao` e voltaram a `implementado`. Atividade não planejada F4.9\*.

#### Modal de concluir construção com a integração completa (F5.7)
- **Tags:** #dados-externos #integracao #cadastro #validacao #componente
- **Arquivos:** `src/pages/dados-externos/DialogoConcluirConstrucao.tsx`, `DialogoConcluirConstrucao.css`, `DialogoConcluirConstrucao.test.tsx`, `PainelVariaveis.tsx`, `ValidacaoIntegracao.tsx`, `DadosExternosPage.tsx`, `DadosExternosPage.concluir.integration.test.tsx`, `useDadosExternos.ts`, `useDadosExternos.concluir.test.tsx`
- **Antes:** o Admin informava só o identificador e clicava em ativar.
- **Depois:** a modal, mais larga (1040 px, JSONs lado a lado), pede quatro campos obrigatórios, nesta ordem:
  - identificador, com sugestões e `limparIdentificador`;
  - URL;
  - parâmetros de saída;
  - parâmetros de entrada.

  Cada JSON tem "Inserir modelo de saída/entrada", validação em tempo real e o painel de variáveis e operadores. "Concluir e ativar" só fica habilitado com tudo válido, e o texto ao lado diz o que falta (`falta: identificador, URL válida, JSON de saída válido, JSON de entrada válido`). A mesma modal serve ao modo Configurações (F5.16). Os erros da API ficam na modal, sem apagar o que foi preenchido: a mensagem geral no alerta e os erros 400 junto a cada campo. Clique duplo grava uma vez só.
- **Motivação:** documento de mudança de requisito de 09/11.
  - O identificador manteve a regra do back-end (A–Z, 0–9, `_`, `-`, `.`, maiúsculas), em vez de "só obrigatório" como no documento, por decisão do usuário.
- **Impacto:** fluxo de conclusão da construção (Admin). Requisito F5.7 passou por `em-alteracao` e voltou a `implementado`.

#### Contrato da integração: concluir com quatro campos e erros por campo (F1.3, F5.1)
- **Tags:** #dados-externos #integracao #api
- **Arquivos:** `src/services/dadosExternosService.ts`, `src/services/adaptadores.ts`, `src/types/dominio.ts`, `src/test/dadosExternosFalsos.ts`, `src/services/dadosExternosService.concluir.test.ts`, `src/services/dadosExternosService.test.ts`, `src/services/adaptadores.test.ts`
- **Antes:**
  - De manhã ("só a tela, sem API"), `concluirConstrucao(id, identificador)` enviava `{ identificador }`, e a URL e os JSONs ficavam só na tela.
  - Os tipos não tinham campos de integração.
- **Depois:**
  - `concluirConstrucao(id, integracao)` envia `{ identificador, url, "parametros de saida", "parametros de entrada" }`: identificador em maiúsculas, URL aparada e JSONs como digitados.
  - `errosDaIntegracao` lê os erros por campo do 400 (`{ mensagem, erros: [{ campo, mensagem, linha?, coluna?, caminho?, expressao? }] }`).
  - `DadoExternoApi` e `DadoExterno` ganharam `url`, `parametrosSaida`, `parametrosEntrada`, `variaveisUsadas`, `integracaoPendente`, `integracaoAlteradaEm` e `integracaoAlteradaPor`, que só o Admin recebe.
  - Novos tipos `IntegracaoDadoExterno`, `ErroIntegracao`, `IntegracoesPendentes` e os resultados da validação do servidor.
- **Motivação:** mudança de rumo à tarde. O back-end publicou o contrato com quebra: concluir só com o identificador passa a dar 400.
- **Impacto:** conclusão da construção e leitura da listagem de dados externos. Requisitos F1.3 e F5.1 passaram por `em-alteracao` e voltaram a `implementado`.

#### Listagem e filtro de dados externos com a integração (F5.2, F5.3)
- **Tags:** #dados-externos #integracao #componente
- **Arquivos:** `src/pages/dados-externos/TabelaDadosExternos.tsx`, `TabelaDadosExternos.css`, `DadosExternosPage.tsx`, `src/services/dadosExternosService.ts`, `useDadosExternos.ts`, `DadosExternosPage.filtros.integration.test.tsx`, `DadosExternosPage.test.tsx`
- **Antes:** a coluna Identificador mostrava só o identificador (ou "a definir pela TI"), e o filtro de situação tinha todas, ativos, inativos, em construção e com problemas.
- **Depois:**
  - A URL aparece abaixo do identificador, e a etiqueta "Integração pendente (TI)" fica na coluna Situação.
  - O filtro ganhou a situação `integracao_pendente` ("Integração pendente (TI)"), oferecida só a quem tem `configurar-integracao-dado-externo` (Admin).
  - Na lista, quem deixa de estar pendente sai pelo critério `integracao_pendente`.
- **Motivação:** contrato do back-end publicado à tarde (URL na lista e filtro de pendentes), que de manhã tinham ficado de fora por dependerem da API.
- **Impacto:** aba Dados Externos para o Admin; os demais perfis não veem a opção nova. Requisitos F5.2 e F5.3 passaram por `em-alteracao` e voltaram a `implementado`.

#### Correções da revisão de qualidade
- **Tags:** #correcao #validacao
- **Arquivos:** `src/utils/integracao/expressoes.ts`, `src/pages/dados-externos/DialogoConcluirConstrucao.css`
- **Antes:** um texto `aaaa-mm-dd` sozinho era tratado como conta (subtrações), e as mensagens longas das faixas de validação podiam estourar a largura.
- **Depois:** `aaaa-mm-dd` sozinho não vira conta, e as faixas de validação usam `overflow-wrap`.
- **Motivação:** apontamentos da revisão do `qualidade-testes`.
- **Impacto:** prévia do JSON de entrada e leitura das mensagens na modal. O caso `aaaa-mm-dd` ainda não tem teste.

#### Status dos requisitos e validação do dia
- **Tags:** #testes
- **Arquivos:** `requisitos.json`
- **Antes:** 67 requisitos implementados; plano em 70% (77/110).
- **Depois:**
  - Novos requisitos F5.14 a F5.18, escritos em TDD e implementados.
  - F1.3, F4.1, F4.2, F4.6, F5.1, F5.2, F5.3 e F5.7 passaram por `em-alteracao` e voltaram a `implementado`.
  - 72 requisitos implementados.
  - `test:all` 3489/3489; `test:implementados` com unitários 3069/3069 e integração 420/420.
  - Typecheck ok e lint só com o aviso antigo de `AlertasMenu.tsx:48`.
  - Plano em 72% (83/116).
- **Motivação:** fluxo TDD do projeto (o requisito só passa a `implementado` com 100% dos testes).
- **Impacto:** commit e build passam a exigir os novos requisitos. Nada foi commitado hoje.

### Pendências
- Média: o motor local recusa entrada em lista `[ ]`, que o contrato aceita. Em Configurações, os textos da abertura não passam pelo back-end, então um dado salvo com lista abre com o botão bloqueado. Depende de decisão do usuário.
- Média: clicar numa variável sem ter focado o campo insere no início e quebra o JSON. Sugestão: inserir no fim.
- Baixas:
  - tipos `numero` (back-end) × `número` (motor local);
  - limites de 60/500 caracteres do contrato não checados no front;
  - erros 400 por campo só somem no novo envio;
  - `aria-pressed` no destaque das variáveis e região de status oculta quando vazia.
- Lacunas de teste: o caso `aaaa-mm-dd`, e `useVariaveisIntegracao` e `useValidacaoServidor` sem teste próprio.
- Confirmar com o back-end que `campo` nos erros de `POST /api/ped/integracao/validar` é o caminho no JSON.
- Pendências anteriores:
  - edição de tipo sem grupo nem usuário;
  - RF-13 e RF-37 no documento de requisitos;
  - imagens por filial × por colaborador;
  - id do usuário no Bitrix para o link;
  - F2.7;
  - vínculo colaborador × zona;
  - `tarefaBitrix.ts` sem teste próprio.
- Próximas atividades do plano: F5.10, F9.1, F10.1, F11.1 e F1.18.
- Commit e push: nada foi commitado hoje (inclui o fechamento de 06/11). Aguardando pedido do usuário.

---

<a id="2026-11-06"></a>
## 06/11/2026

**Tags:** #tipos #indicadores #dashboards #dados-externos #cadastro #api #validacao #componente #correcao #testes #configuracao #documentacao

### Visão geral
O dia começou com a build do sistema ("faça a build do sistema"). Em seguida veio uma correção contra a API real: a listagem de dashboards voltou a falhar ("dashboard não está carregando novamente").

Depois, o usuário pediu a análise de dois documentos novos do back-end ("leia os dois arquivos de documentos novos ... e verifique as mudanças que ocorreram no backend"). Com base nela, decidiu "fazer as adequações necessárias com as atualizações do backend". A adequação seguiu o TDD completo:
- grupos e usuários nos tipos, com cadastro e edição (A-02);
- exclusão de indicador liberada só para o Admin (A-09);
- nova exibição das tarefas do Bitrix;
- identificador de dado externo com `-` e `.`.

Durante os testes contra a API real, apareceu mais uma divergência de formato, agora na aba Tipos ("a aba tipos está dando erro ao carregar as informações"), e ela foi corrigida. Por fim, o commit `f06e197` foi feito ("após o ajuste do erro, realizar o commit") e o dia foi encerrado.

Toda alteração de comportamento seguiu o mesmo fluxo:
1. o `gerador-testes` adequou os testes;
2. os requisitos passaram por `em-alteracao`;
3. os requisitos voltaram a `implementado` com o gate a 100%.

Situação no fim do dia:
- requisitos: 67 de 67 `implementado`;
- plano: 70% (77 de 110 atividades), com as fases F3 e F6 concluídas;
- commits: `f2f88d6`, `7df4dd4` e `f06e197` ainda não enviados ao GitHub.

### Implementações

#### Build validada do sistema
- **Tags:** #configuracao #testes
- **Arquivos:** `dist/` (gerado; fora do controle de versão)
- **Descrição:** o `build-validado` rodou todas as baterias e só então gerou a build:
  - unitários: 2380/2380;
  - integração: 327/327;
  - carga: 100% de respostas 2xx em 6687 requisições, com média de 75 ms e p99 de 142 ms.

  O bundle principal saiu como `index-DtTYGzW6.js`, com 481 kB.
- **Motivação:** pedido do usuário ("faça a build do sistema").
- **Como usar / observações técnicas:** há um problema de ambiente. Se o caminho do projeto for aberto como `c:\` (minúsculo), o Vitest 5.0.5 carrega duas instâncias e falha 100% dos testes com "failed to find the current suite". A partir de `C:\` (maiúsculo), tudo funciona. Recomendação: abrir o editor ou o terminal em `C:\`.

#### Análise dos documentos novos do back-end
- **Tags:** #documentacao #api
- **Arquivos:** `docs/backend/FRONT-PED-mudancas (1).md`, `docs/backend/FRONT-tarefas-bitrix (1).md` (adicionados ao repositório no commit `f06e197`)
- **Descrição:** os dois documentos foram comparados com o front atual, e o resultado ficou em três grupos:
  - o que afeta o que já foi implementado: formatos de tipos, tarefas e identificador, e a permissão de exclusão de indicador;
  - o que desbloqueia: as pendências A-01..A-07 e A-09;
  - o que fica fora do escopo: a aba Usuários (A-13) e os papéis no Premiações.
- **Motivação:** pedido do usuário ("leia os dois arquivos de documentos novos ... e verifique as mudanças que ocorreram no backend").
- **Como usar / observações técnicas:** a análise embasou as decisões do usuário registradas em "Modificações". Ficou esclarecido que a tarefa do Bitrix é disparada pelo próprio back-end. O front só pede para salvar e não faz requisição de criação de tarefa (já funcionava assim). A prévia `POST /dashboards/previa-tarefa`, que não grava, foi mantida.

#### Cadastro de tipo de apontamento (F3.4)
- **Tags:** #tipos #cadastro #validacao #componente #api
- **Arquivos:** `src/pages/tipos/FormularioTipo.tsx`, `FormularioTipo.css`, `SecaoVinculosTipo.tsx`, `TiposPage.tsx`, `TiposPage.css`, `useTipos.ts`, `src/services/tiposService.ts`, `src/sessao/permissoes.ts`, `src/types/dominio.ts`; testes `FormularioTipo.test.tsx`, `TiposPage.cadastro.test.tsx`, `TiposPage.cadastro.integration.test.tsx`, `useTipos.cadastro.test.tsx`, `src/services/tiposService.grupos.test.ts`, `src/sessao/permissoes.tipos.cadastro.test.ts`; fixture `src/test/tiposFalsos.ts`
- **Descrição:**
  - o botão "Novo tipo" abre o `FormularioTipo`;
  - o nome é obrigatório e único, sem diferenciar maiúsculas de minúsculas;
  - é preciso vincular ao menos um grupo do ERP ou um usuário;
  - a `SecaoVinculosTipo` faz a busca e seleção de grupos (`GET /api/ped/grupos[?busca=]`, que traz os tipos aos quais cada grupo já está vinculado) e de usuários (`/vinculos?tipo=colaboradores`);
  - a gravação usa `POST /api/ped/tipos-apontamento` com `{ nome, grupos, usuarios }`.
- **Motivação:** pendência A-02, desbloqueada pelos documentos novos do back-end, e decisão do usuário de fazer as adequações. A regra "ao menos um grupo ou usuário" segue a API; o RF-13 fala só em grupo e precisa ser atualizado.
- **Como usar / observações técnicas:** a nova ação `cadastrar-tipo` vale para Admin e Validador. Pela regra "2xx = gravado", `criarTipo` resolve `TipoApontamento | null`.

#### Edição dos vínculos de tipo (F3.5)
- **Tags:** #tipos #cadastro #componente #api
- **Arquivos:** `src/pages/tipos/FormularioVinculosTipo.tsx`, `SecaoVinculosTipo.tsx`, `TiposPage.tsx`, `useTipos.ts`, `src/services/tiposService.ts`, `src/sessao/permissoes.ts`; testes `FormularioVinculosTipo.test.tsx`, `TiposPage.edicao.test.tsx`, `TiposPage.edicao.integration.test.tsx`, `useTipos.edicao.test.tsx`, `src/sessao/permissoes.tipos.edicao.test.ts`
- **Descrição:**
  - a ação "Editar grupos" abre o `FormularioVinculosTipo`, que vale para tipos fixos e personalizados;
  - a gravação usa `PUT /api/ped/tipos-apontamento/{id}` e envia só as listas alteradas (`grupos` e/ou `usuarios`).
- **Motivação:** pendência A-02 e decisão do usuário de fazer as adequações com as atualizações do back-end.
- **Como usar / observações técnicas:** a nova ação `editar-tipo` vale para Admin e Validador. Ainda está em aberto se a edição pode deixar o tipo sem nenhum grupo ou usuário.

#### Exclusão de indicador (F6.7)
- **Tags:** #indicadores #cadastro #api
- **Arquivos:** `src/pages/indicadores/IndicadoresPage.tsx`, `src/sessao/permissoes.ts`; testes `IndicadoresPage.exclusao.integration.test.tsx`, `useIndicadores.exclusao.test.tsx`, `src/sessao/permissoes.indicadores.test.ts`, `src/services/indicadoresService.test.ts`
- **Descrição:**
  - a exclusão, que tinha o front pronto desde 05/11, foi liberada só para o Admin;
  - quando a API responde 400 (indicador em uso), a tela mostra a mensagem da API, um separador e a lista "Dashboards: A, B.". O separador foi um pequeno ajuste do orquestrador.
- **Motivação:** a rota foi publicada (A-09). A restrição ao Admin está explicada em "Modificações".
- **Como usar / observações técnicas:** o requisito passou de `pendente` a `implementado`.

#### Regra comum de exibição da tarefa Bitrix
- **Tags:** #dashboards #dados-externos #componente
- **Arquivos:** `src/utils/tarefaBitrix.ts` (novo)
- **Descrição:** o arquivo traz:
  - `ROTULO_AGUARDANDO_ENVIO` ("Aguardando envio ao Bitrix");
  - `STATUS_AGUARDANDO_ENVIO` (`aguardando_envio`);
  - `tarefaAguardandoEnvio`: verdadeiro quando o id é `null` ou o status é `aguardando_envio`;
  - `numeroTarefaEnviada`;
  - `textoTarefaBitrix(tarefa, prefixo)`, que gera `#N`, "Tarefa #N" ou o rótulo de aguardando envio;
  - `fraseTarefaGravada`, que gera "Tarefa #N criada no Bitrix para a equipe de TI." ou "A tarefa para a TI será criada no Bitrix em instantes.".

  Sem tarefa, nada é exibido, e não há link para o Bitrix24.
- **Motivação:** seguir o documento `FRONT-tarefas-bitrix`, a pedido do usuário ("fazer as adequações necessárias com as atualizações do backend").
- **Como usar / observações técnicas:** o arquivo não tem teste próprio; ele é coberto indiretamente pelos testes de tabelas e diálogos. Fica como pendência.

#### Cobertura complementar dos tipos
- **Tags:** #testes #tipos
- **Arquivos:** testes da pasta `src/pages/tipos/`
- **Descrição:** o `gerador-testes` acrescentou 16 testes no modo "cobertura complementar" depois da revisão de qualidade.
- **Motivação:** fluxo do projeto (passo 5 do ciclo), para cobrir os casos apontados na revisão.
- **Como usar / observações técnicas:** os testes cobrem, entre outros, o Enter na busca e a manutenção da tabela durante a recarga.

### Modificações

#### Id da tarefa Bitrix em texto (F7.13*)
- **Tags:** #correcao #dashboards #dados-externos #api
- **Arquivos:** `src/services/adaptadores.ts`, `src/services/dashboardsService.ts`, `src/services/dadosExternosService.ts` e testes (`dashboardsService.test.ts`, `dashboardsService.acoes.test.ts`, `dadosExternosService.test.ts`); fixtures `src/test/dashboardsFalsos.ts` e `dadosExternosFalsos.ts`
- **Antes:** o id da tarefa só podia ser número ou `null`. Se um único item viesse com `"tarefa bitrix": { "id": "328439", "status": "enviada" }`, a listagem inteira de dashboards era rejeitada.
- **Depois:**
  - o id aceita número, `null` ou texto só com dígitos (após `trim()`), que é convertido para número pelo novo auxiliar `numeroDaTarefaBitrix`;
  - texto não numérico (`''`, `'31a'`, `'31.5'`, `'-31'`) continua inválido;
  - zeros à esquerda são aceitos (`"0031"` vira 31);
  - no histórico, texto numérico solto também é aceito.

  A regra vale para dashboards (listagem, detalhe, histórico, tarefas e gravação) e para dados externos.
- **Motivação:** o usuário relatou "dashboard não está carregando novamente" e enviou o JSON real. A API passou a mandar o id em texto. Os zeros à esquerda e o texto solto no histórico foram decisões assumidas na correção.
- **Impacto:** abas Dashboards e Dados Externos. Atividade não planejada F7.13*. Requisitos F5.1, F5.2, F7.1 e F7.2.

#### Tipos: grupos vinculados, MenuAcoes e permissões (F3.1–F3.3)
- **Tags:** #tipos #componente #api
- **Arquivos:** `src/pages/tipos/TabelaTipos.tsx`, `TiposPage.tsx`, `TiposPage.css`, `useTipos.ts`, `src/services/tiposService.ts`, `src/services/adaptadores.ts`, `src/sessao/permissoes.ts`, `src/types/dominio.ts` e testes da pasta `src/pages/tipos/`
- **Antes:** a listagem não mostrava os grupos vinculados, e as ações ficavam direto na linha.
- **Depois:**
  - a listagem tem a coluna "Grupos vinculados" e o `MenuAcoes` "Ações do tipo" (Editar grupos / Excluir);
  - Admin e Validador recebem `grupos` e `usuarios`, que vêm `null` para o Preenchedor;
  - o Validador cadastra, edita e exclui tipos.
- **Motivação:** pendência A-02 e documento `FRONT-PED-mudancas`. O usuário decidiu implementar os tipos já ("Tipos implementado já").
- **Impacto:** aba Tipos de Apontamento.

#### Formato dos usuários vinculados ao tipo
- **Tags:** #correcao #tipos #api
- **Arquivos:** `src/services/adaptadores.ts` (`UsuarioVinculadoApi`), `src/services/tiposService.ts` e testes
- **Antes:** os usuários vinculados eram lidos como `{ id, nome }`, conforme o documento do back-end.
- **Depois:** são aceitos `{ "id colaborador", nome }` (formato real) e `{ id, nome }`; se vierem os dois, vale `"id colaborador"`. Os grupos continuam `{ id, nome }`.
- **Motivação:** o usuário relatou "a aba tipos está dando erro ao carregar as informações" e enviou o JSON real, que diverge do documento do back-end. A correção também respondeu qual id vai em `usuarios`.
- **Impacto:** aba Tipos. Requisitos F3.1, F3.2 e F3.5.

#### Correções da revisão de qualidade nos tipos
- **Tags:** #correcao #tipos #componente
- **Arquivos:** `src/pages/tipos/SecaoVinculosTipo.tsx`, `TiposPage.tsx`
- **Antes:** o Enter na busca de vínculos enviava o formulário. Além disso, a tabela de tipos sumia durante a recarga, e o foco se perdia.
- **Depois:** o Enter na busca não envia o formulário, e a tabela continua visível durante a recarga.
- **Motivação:** problemas apontados pelo `qualidade-testes` na revisão.
- **Impacto:** aba Tipos. O mesmo problema do Enter existe nos dashboards e virou a nova atividade F1.18 (mover o `SeletorBusca` para `src/components` e corrigir o Enter).

#### Exclusão de indicador só pelo Admin
- **Tags:** #indicadores #validacao
- **Arquivos:** `src/sessao/permissoes.ts`, `src/sessao/permissoes.indicadores.test.ts`, testes de `src/pages/indicadores/`
- **Antes:** a ação `excluir-indicador` valia para Admin e Validador, como no documento de requisitos.
- **Depois:** a ação vale só para o Admin, como na API.
- **Motivação:** decisão do usuário ("só Admin, como a API"). Se o front liberasse a ação, o Validador receberia 403 da API. O documento de requisitos foi preterido e precisa ser atualizado (RF-37).
- **Impacto:** aba Indicadores; o Validador deixa de ver a ação Excluir.

#### Exibição e mensagens das tarefas Bitrix
- **Tags:** #dashboards #dados-externos #api #componente
- **Arquivos:** `src/pages/dashboards/TabelaDashboards.tsx`, `DialogoConcluirDashboard.tsx`, `DialogoHistoricoDashboard.tsx`, `FormularioDashboard.tsx`, `DashboardsPage.tsx`, `src/pages/dados-externos/TabelaDadosExternos.tsx`, `DialogoConcluirConstrucao.tsx`, `DadosExternosPage.tsx`, `src/services/dashboardsService.ts`, `src/services/dadosExternosService.ts`, `src/utils/tarefaBitrix.ts` e testes correspondentes
- **Antes:** a tarefa aparecia como "Tarefa nº" só quando havia número, e a resposta da gravação não lia `"id bitrix"`.
- **Depois:**
  - a resposta da gravação passa a ler `"id bitrix"`;
  - ao gravar, a mensagem é "Tarefa #N criada no Bitrix para a equipe de TI." ou "(Salvo.) A tarefa para a TI será criada no Bitrix em instantes.";
  - as tabelas mostram `#N`, e os diálogos mostram "Tarefa #N";
  - tarefa sem número ou com status `aguardando_envio` aparece como "Aguardando envio ao Bitrix";
  - o histórico aceita tarefa com id `null`.
- **Motivação:** documento `FRONT-tarefas-bitrix` e decisão do usuário de tratar os itens de tarefa como alteração de requisito.
- **Impacto:** abas Dashboards e Dados Externos. Requisitos F5.1, F5.2, F5.6, F5.7, F7.1–F7.3 e F7.7–F7.10.

#### Identificador de dado externo com `-` e `.` e aviso da tarefa
- **Tags:** #dados-externos #validacao #cadastro
- **Arquivos:** `src/utils/identificador.ts`, `src/utils/identificador.test.ts`, `src/pages/dados-externos/FormularioDadoExterno.tsx` e testes (`FormularioDadoExterno.admin.test.tsx`, `FormularioDadoExterno.solicitacao.test.tsx`, `DadosExternosPage.*.integration.test.tsx`)
- **Antes:** `limparIdentificador` mantinha só A–Z, 0–9 e `_`.
- **Depois:**
  - `limparIdentificador` mantém também `-` e `.`, em maiúsculas (ex.: `"fat.liq/2026!@#$%&*()+=-"` vira `"FAT.LIQ2026-"`);
  - o formulário mostra a Validador e Preenchedor o aviso "Ao salvar, será aberta uma tarefa para a equipe de TI.".
- **Motivação:** documento `FRONT-PED-mudancas`, item 7: o back-end aceita letras sem acento, números, `_`, `-` e `.`. O usuário decidiu tratar o identificador como alteração de requisito.
- **Impacto:** aba Dados Externos. Requisitos F5.5–F5.7.

#### Status dos requisitos e commit do dia
- **Tags:** #testes #documentacao
- **Arquivos:** `requisitos.json`, `docs/diario-implementacao.md`, `docs/documentacao.md` (entradas de 05/11), `docs/plano-implementacao.md` (mantido pelo `plano-implementacao`)
- **Antes:** 64 requisitos `implementado` e 1 `pendente` (F6.7).
- **Depois:**
  - F3.1–F3.3, F5.1, F5.2, F5.5–F5.7, F6.1, F6.2, F6.5, F6.6, F7.1–F7.3 e F7.7–F7.10 passaram por `em-alteracao` e voltaram a `implementado`;
  - F3.4 e F3.5 são novos;
  - F6.7 passou a `implementado`;
  - total: 67 de 67.

  O commit `f06e197` foi feito depois dos testes do commit (unitários 2627/2627, integração 375/375), com o hook aprovado. Ele incluiu o diário e a documentação de 05/11.
- **Motivação:** pedido do usuário ("após o ajuste do erro, realizar o commit").
- **Impacto:** o plano chegou a 77 de 110 (70%), com F3 e F6 concluídas. F5.10, F9.12 e F10.7 foram desbloqueadas, F1.18 foi criada e F12.5 ficou parcial (falta o id do usuário no Bitrix para o link).

### Pendências
- Enviar ao GitHub os commits `f2f88d6`, `7df4dd4` e `f06e197`.
- Definir se a edição de tipo pode ficar sem nenhum grupo ou usuário.
- Atualizar RF-13 (ao menos um grupo ou usuário) e RF-37 (exclusão só pelo Admin) no documento de requisitos.
- Imagens de dashboard: o back-end gera imagem por filial, mas o documento de requisitos e a F7.5 preveem uma por colaborador mais "Filial (sem colaborador vinculado)".
- Id do usuário no Bitrix para o link da tarefa (F12.5 parcial).
- F2.7: cancelar ou manter.
- Vínculo colaborador ↔ zona.
- `src/utils/tarefaBitrix.ts` sem teste próprio.
- F1.18: mover o `SeletorBusca` para `src/components` e corrigir o Enter nos dashboards.
- Ambiente: abrir o editor ou terminal em `C:\` maiúsculo, por causa da falha do Vitest 5.0.5 com `c:\`.
- Os dias 22/10 e 03/11 continuam sem fechamento.

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
