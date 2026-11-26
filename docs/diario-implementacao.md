# Diário de Implementação — PED

## 25/11/2026

**Resumo:** O front passou a ter os dois Swaggers do back-end (produção e desenvolvimento), refez a verificação com o de desenvolvimento e escreveu o novo documento de bloqueios do back-end. Foram criadas as páginas públicas `/backend` (F2.13) e `/resumo` (F2.14), e o front foi adequado à resposta do back-end à verificação (D1, D2, D6 e os campos novos do deploy `c2c6c84`), mantendo a F6.14\* como estava. No fim do dia entrou o requisito novo F7.15 (cálculo no período de cada indicador em dashboard não mensal), com proposta de contrato ao back-end. Bateria validada: 116 de 116 requisitos `implementado`, plano em 92% (157 de 170). O commit do dia foi pedido junto com este fechamento.

### Implementações
- Dois Swaggers em `docs/backend/.env`: `SWAGGER_PRODUCAO_*` (`http://192.168.7.18:8080/api-docs/`) e `SWAGGER_DESENVOLVIMENTO_*` (`http://192.168.1.244:8081/`, com o `ped.yaml` na raiz).
- Documento `docs/propostas-backend/PENDENCIAS-backend-2026-11-25.md`: 10 itens por prioridade, decisões D-1 a D-5 separadas e seção "Recebido". Substitui o de 24/11 como lista do que falta.
- Página pública `/backend` (F2.13): todos os `.md` de `docs/propostas-backend/` (`import.meta.glob`), lista do mais recente ao mais antigo, Markdown com tabelas, `?doc=<id>`, links entre documentos dentro da página e HTML cru não executado. Fora do menu e sem login. 50 testes.
- Página pública `/resumo` (F2.14): abas "Diário de implementação" e "Documentação" (setas, Home/End), `?aba=diario|documentacao`, links do índice levando ao dia e HTML cru descartado. Fora do menu e sem login. 54 testes.
- Dependências novas: `react-markdown` 10.1.0 e `remark-gfm` 4.0.1, para mostrar Markdown com tabelas sem `dangerouslySetInnerHTML`.
- Campos novos do servidor (deploy `c2c6c84`):
  - Início com "%" nas últimas alterações pelo `tipo de valor` (F12.12\*);
  - prévia com "Progresso da filial {código}: p de t" (RF-80);
  - aviso geral (`resumo.avisos`, ex.: DRG) uma vez no topo da prévia e da confirmação;
  - nome da filial e cargo da consulta de imagens pelo bloco `unidade`.
- F7.15 (requisito novo): em dashboard não mensal, cada indicador tem o campo obrigatório "Cálculo no período" (Somar, Fazer a média, Usar só o último valor), sem padrão, com coluna, aviso e erro "Selecione o cálculo no período.". No mensal o campo some e não é enviado; o valor fica guardado. 76 testes.
- Contrato proposto `"calculo do periodo": soma|media|ultimo` em cada item de `indicadores` (POST, PUT, prévia e detalhe) e documento `docs/propostas-backend/PROPOSTA-calculo-no-periodo-dashboard.md` com 5 perguntas (A-23).

### Modificações
- `docs/documentacao.md`: nome antigo das variáveis do Swagger atualizado na entrada de 24/11.
- Verificação do Swagger refeita com o de desenvolvimento (versão "2026-11-25"): mesmas 6.668 linhas e rotas. Só a D8 foi resolvida (documentação do `busca` das imagens). Revisão anotada no topo de `VERIFICACAO-swagger-2026-11-24.md`.
- D1: as sugestões de identificador leem `"dados cadastrados"`, com `quantidade` como reserva. Antes, as sugestões sumiam.
- D2: o histórico de faixas aceita `motivo` nulo ou ausente e `versao` nula ("—" na tela, sem "Ver faixas da versão"). O teste "versão sem motivo vira ApiError" foi trocado por "motivo que não é texto".
- D6: todos os perfis pedem `?filial` no Início dentro do próprio escopo. O comportamento já estava certo; testes dos dois `403` e comentário do `inicioService.ts` atualizados.
- Requisitos alterados: F5.1, F5.5, F5.7, F6.11, F8.1, F8.5, F8.8, F10.1, F10.4, F10.5, F10.6, F11.1 e F11.5.
- `vite.config.ts`: bibliotecas usadas só por páginas lazy vão para `vendor-sob-demanda`. O `vendor` inicial caiu de 476 kB para 311 kB.
- F6.14\* mantida como estava, por decisão do usuário (o back-end não tem fonte SOAP real e o executor está desligado de propósito).
- Ocorrência de agentes: o primeiro implementador do D2 não podia mudar teste, e um teste antigo contraditório ficou vermelho até o `gerador-testes` adequá-lo.
- F7.1 e F7.5–F7.8 adequados ao F7.15 (detalhe com `calculoNoPeriodo`, gravação e prévia exigindo o cálculo no não mensal).
- Validação final: `test:implementados` com integração 848 de 848 e unitários 5220 de 5221; a falha (F2.13) era cache antigo do Vitest, que não conhecia o `.md` novo, e passou a 50 de 50 após limpar o cache. F2.14 e os 13 requisitos alterados voltaram a `implementado`.
- Orientação sem alteração de código: como rodar o projeto pelo IP da máquina na rede (`npm run dev -- --host` ou `npm run preview -- --host`, porta no firewall).

### Pendências
- Commit e push do dia, pedidos junto com este fechamento (nada commitado desde o `941a63c`, de 17/11). O usuário deve confirmar se o `docs/backend/.env` entra.
- A-23: back-end aceitar e usar o `"calculo do periodo"`; envio da proposta a cargo do usuário.
- F7.15: "Ver pesos" (F7.9) deve mostrar o cálculo? Dashboards não mensais existentes abrem com o campo vazio e exigem escolha (pergunta 3 ao back-end). Relação com a P-08 / F10.8. Texto cortado em 360 px.
- Páginas `/backend` e `/resumo` são públicas e citam IPs internos (também visíveis na rede se o projeto rodar com `--host`).
- Bloco da página `/resumo` com cerca de 355 kB, que cresce com a documentação.
- Defeito do primeiro Tab ("Pular para o conteúdo").
- Layout de Apontamentos e Fechamentos em 360 px.
- JSON de `/acesso` do usuário do caso A-20.
- Gerar e enviar uma prévia nova para confirmar o formato real.
- Reticências: "..." ou "…".
- Seletor de filial: trocar só ao confirmar?
- Envio do documento de bloqueios de 25/11 ao back-end.
- Motivação da seção "Ocorrências" do HTML do plano (18/11) ainda não informada.

---

## 24/11/2026

**Resumo:** A prévia do fechamento passou a ler o formato real do back-end (F10.18\*). Foram concluídas as atividades que não dependem do back-end: F5.10, F1.18, F12.1 (acessibilidade) e F12.2 (responsividade e pt-BR), com 113 requisitos `implementado`. Foram criados os testes E2E com Playwright, que encontraram um defeito no primeiro Tab, e uma build foi validada depois de corrigir um teste intermitente. O front também escreveu o documento de bloqueios do back-end e verificou o Swagger. Nada foi para commit desde o `941a63c`.

### Implementações
- Levantamento do que falta implementar a partir do plano: prontas, dependentes do back-end e bloqueadas por decisão do negócio.
- Prévia do fechamento pelo formato real (F10.18\*, não planejada): `imagensService` aceita `unidade.filial`, `unidade.colaborador` e `pontuacao.faixas`, além dos formatos antigos. Exemplo real em `docs/backend/exemplos-reais/previa.json`. 25 testes novos.
- F5.10: 17 testes de ponta a ponta das referências Colaborador e Zona de venda. O comportamento já existia.
- F12.1, acessibilidade:
  - link "Pular para o conteúdo";
  - título "{Aba} · PED" e foco no `<h1>` ao navegar (`useTituloDocumento`);
  - `Dialogo` com iframe no Tab e a prop `focoAoFechar`;
  - `Aviso` com a prop `anunciar`;
  - dica do alerta do menu por `aria-describedby`.
- F12.2, responsividade e pt-BR:
  - prop `quebrar` na `Tabela`;
  - `formatarInteiro` ("1.500");
  - link "Abrir PDF em nova aba".
- Testes E2E com Playwright: `@playwright/test` 1.62.1, `playwright.config.ts`, `e2e/` e o script `test:e2e`. 18 cenários, 17 aprovados.
- Documento `docs/propostas-backend/PENDENCIAS-backend-2026-11-24.md`: 9 itens técnicos e as decisões D-1 a D-5.
- Link do Swagger em `docs/backend/.env` e a verificação em `docs/propostas-backend/VERIFICACAO-swagger-2026-11-24.md`.

### Modificações
- F1.18: `SeletorBusca` movido para `src/components/`. O Enter na busca dos Dashboards não envia mais o formulário, e Tipos não usa mais o CSS de Dashboards (`FormularioTipo.css`). Novo teste `src/isolamentoDashboards.test.ts`.
- F12.1:
  - anel de foco sólido, alto contraste e tokens de contraste novos em `tema.css`;
  - o foco não se perde ao escolher ou remover itens em Indicadores, Dashboards e Faixas, nem ao navegar na prévia;
  - "Limpar seleção" devolve o foco ao seletor (fora do pedido, aceito).
- F12.2:
  - editor de faixas abaixo de 420 px;
  - formulários de Indicadores e Dashboards como folha inferior no celular;
  - `SelectPesquisavel` e `MenuAcoes` dentro da tela;
  - aba ativa visível;
  - plural pelo total e fim do "(s)";
  - resultado do cálculo vindo do servidor com vírgula.
- Requisitos alterados e concluídos de novo: F10.1 e F10.4 (pela F10.18\*); F3.4, F7.5 e F7.6 (pela F1.18); F3.3, F5.5, F5.7, F6.4 e F10.6 (pela F12.2).
- Correção do teste intermitente `rotas.titulo.integration.test.tsx`: em `LayoutPrincipal.tsx`, o destino do foco passou a guardar a rota de origem.
- Build validada na 2ª tentativa: unitários 5437/5437, integração 854/854, carga 100% 2xx com p99 de 109 ms e `dist/` com 1,6 MB.
- A-08: o documento de bloqueios pede ao back-end que calcule a pontuação pela "fórmula de pontuação" do cadastro (mudança de rumo do usuário).
- Agente de responsividade parado: encerrado sem perda de trabalho. Os "vermelhos" do mapa eram agentes interrompidos.

### Pendências
- Commit do trabalho de 18/11, 19/11 e 24/11, incluindo os documentos do back-end e o Playwright.
- Defeito do primeiro Tab: vai para a aba ativa, e não para "Pular para o conteúdo". O cenário E2E está como `test.fail`.
- Conferência visual em 360 px de Apontamentos e Fechamentos.
- Divergências do Swagger: `"dados cadastrados"` × `quantidade` nas sugestões de identificador, e `versao`/`motivo` nulos no histórico de faixas. A proposta de aceitar os dois formatos aguarda resposta.
- Atividades novas do plano: F1.22\*, F1.23\* e F12.7\* a F12.12\*.
- Dúvidas para o usuário:
  - reticências: "..." ou "…";
  - seletor de filial: trocar só ao confirmar;
  - remover a `VisualizacaoImagem`;
  - prioridade das atividades novas.
- Envio dos documentos de pendências e de verificação ao back-end, a cargo do usuário.

---

## 19/11/2026

**Resumo:** O dropdown da composição do indicador passou a fechar ao clicar fora (F6.15\*). O Validador passou a ver o alerta de integração pendente. As abas do menu passaram a mostrar os alertas desde o login, pelo `GET /api/ped/alertas-menu` (F2.12\*), depois de proposta, contraproposta e resposta ao back-end. Uma build foi gerada com 109/109 requisitos. Sem commit.

### Implementações
- F2.12\*, alertas das abas desde o login:
  - `alertasMenuService.ts` e `useVerificadorAlertasMenu.ts`;
  - consulta no login, na troca de filial, no foco da janela e a cada 5 minutos;
  - o 429 espera o `Retry-After`;
  - tooltip com as descrições.
- Nova ação `ver-integracao-pendente-indicador` (Admin e Validador).
- Proposta `PROPOSTA-alertas-menu.md` (opção 2, todas as abas) e resposta à contraproposta do back-end (`RESPOSTA-contraproposta-alertas-menu.md`). Documentos do back-end registrados: `FRONT-alertas-menu.md` e `API (31).md`.

### Modificações
- F6.15\* (F6.4): o `SeletorComponentes` do formulário de indicador fecha ao clicar fora e com Esc. O Esc não fecha o diálogo.
- F6.11 e F6.3: o alerta e o filtro "Integração pendente (TI)" passaram a valer também para o Validador.
- Build gerada a pedido do usuário: 109/109 requisitos.
- Propostas ao back-end movidas pelo usuário de `docs/backend/` para `docs/propostas-backend/`.

### Pendências
- Commit do trabalho do dia.

---

## 18/11/2026

**Resumo:** O campo Tipo dos cadastros passou a mostrar os tipos criados depois do login, pela releitura do acesso (F2.11\*, opção A da proposta ao back-end). Os dropdowns passaram a fechar ao clicar fora, por padrão (F1.21\*). Sem commit.

### Implementações
- `recarregarAcesso()` no `SessaoProvider` (F2.11\*): relê `GET /api/ped/acesso` sem tela de carregamento, preserva a filial e mantém o acesso anterior se a leitura falhar.
- Proposta ao back-end `PROPOSTA-tipos-no-acesso.md` (A-20): todos os tipos no acesso do Admin e do Validador.

### Modificações
- `useTipos` relê o acesso depois de criar ou alterar um tipo. "Novo apontamento" e "Novo dado externo" releem o acesso ao abrir (F2.1, F3.4, F3.5, F4.4, F5.4).
- F1.21\*:
  - o `SeletorBusca` fecha ao clicar fora e com Esc (prop `onFechar`) e limpa a busca;
  - "Vincular dashboard a" (`SecaoVinculo`) e os dropdowns de vínculo dos Tipos fecham ao clicar fora;
  - `SelectPesquisavel` e `MenuAcoes` fecham quando o foco vai para o iframe do PDF.
- Script `.claude/scripts/plano-html.mjs`: nova seção opcional "Ocorrências e mudanças de decisão" no HTML do plano.
- `test:implementados` aprovado: 5183 unitários e 812 de integração, 109/109.

### Pendências
- Item 1 da proposta de tipos no acesso (A-20) e as 3 perguntas ao back-end.
- Motivação da nova seção do `plano-html.mjs` não informada.

---

## 17/11/2026

**Resumo:** A aba Fechamentos passou a mostrar as imagens em PDF gerado pelo back-end, na prévia e nas imagens congeladas, com o botão "Exportar" (PDF desta imagem ou todas em ZIP) (F10.10, novo). O front foi adequado aos documentos novos do back-end: limite de uso (429), encerramento pelo mês aberto, filiais sem composição do DRG e Início sem mês aberto. A lista de imagens da prévia virou um dropdown pesquisável reutilizável (`SelectPesquisavel`, F1.20, novo). Duas builds foram validadas, com 109/109 requisitos `implementado`. Todo o trabalho do dia está sem commit (depois do `2a105f6`). Plano em 93% (139/149).

### Implementações
- Download de arquivos pela API (F10.10a\*):
  - `apiFetchArquivo` e `nomeDoArquivo` em `api.ts` (Blob e nome do `Content-Disposition`);
  - `obterPdfPrevia`/`obterZipPrevia` e `obterPdfImagem`/`obterZipImagens`;
  - utilitário `baixarArquivo`.
- PDF embutido e "Exportar" (F10.10b\*): `usePdfImagem`, `VisualizadorPdf` e `ExportarImagens` (menu "PDF desta imagem" / "Todas as imagens (ZIP)"), na prévia e no diálogo da imagem congelada. O ZIP da consulta usa os filtros aplicados.
- Limite de uso 429 (F10.11\*):
  - hook `useBloqueioLimite`: bloqueia o "Exportar" e o "Tentar novamente" do PDF pelo tempo do servidor (60 s padrão);
  - `EstadoCarga` com `tentarNovamenteDesabilitado`.
- Aviso da quantidade de imagens (F10.13\*): `AvisoQuantidadeImagens` ("Serão geradas N imagens em PDF." e o aviso de demora) e o status "Montando o ZIP com N imagens…". O ZIP não tem mais limite no front.
- Componente reutilizável `SelectPesquisavel` (F1.20, novo) e combobox "Imagem" na prévia (F10.14\*).
- Dica quando o ZIP falha por rede ou tempo (status 0/502/503/504) (F10.16\*), com texto de dica diferente na consulta e na prévia.
- Proposta ao back-end `docs/backend/PROPOSTA-pdf-imagens.md` (A-19), respondida no mesmo dia. Documentos novos do back-end registrados: API (29) e (30), FRONT-pdf-zip, FRONT-pdf-fechamento, FRONT-fechamentos-e-imagens e FRONT-tela-inicio.

### Modificações
- `MenuAcoes` com as props `rotuloVisivel` e `desabilitado` (F1.16).
- Prévia (F10.4, F10.7):
  - o PDF ocupa o lugar da `VisualizacaoImagem`;
  - a tabela "Imagens da filial" e o campo "Buscar colaborador ou cargo" saíram, substituídos pelo dropdown "Imagem".
- Diálogo da imagem congelada (F10.6): o PDF ocupa o lugar do detalhe JSON (`GET /imagens/{id}`), com o "Exportar".
- Encerramento (F10.1, F10.5, F10.12\*):
  - a confirmação mostra o período congelado, que contém o mês aberto;
  - depois de encerrar, aparece o aviso das filiais sem composição do Resultado Operacional (DRG).
- Início sem mês aberto (F11.1, F11.2, F11.4, F11.8\*): "Nenhum período aberto para preenchimento." no lugar de "Resposta inválida do servidor", e o botão "Preencher apontamentos do período" fica escondido.
- Mudança de rumo no `SelectPesquisavel` (F1.20, F10.15\*): o gatilho virou um botão não editável, e a barra "Buscar colaborador ou cargo" fica dentro da lista aberta.
- Layout da prévia:
  - "Exportar" na linha do "Progresso de lançamentos";
  - aviso da quantidade em largura total;
  - durante o cálculo da prévia, o aviso usa a estimativa `unidadesDeImagem − unidadesEncerradas`.
- Correção do "dropdown quebrado": o `npm run dev` servia o CSS do `SelectPesquisavel` vazio. O arquivo foi regravado.
- Duas builds validadas. A última teve 5103 unitários, 777 de integração e carga com p99 de 149 ms.

### Pendências
- Prévia com dados reais: aparece "Filial · 60 imagens", sem o código da filial. Aguardando o JSON real de `GET /fechamentos/{id}/previa`.
- Confirmar três decisões padrão:
  - sem contagem regressiva no 429;
  - aviso de filiais sem composição até o próximo encerramento;
  - links "Preencher {dashboard}" mantidos sem mês aberto.
- Risco: um ZIP acima de cerca de 500 PDFs pode falhar por tempo; o front só mostra a dica.
- Validação contra o servidor real: PDF, ZIP, 429 e encerramento pelo mês aberto.
- Commit do trabalho do dia e dos testes estabilizados em 16/11.
- Próximas atividades: F1.18 (avaliar unir o `SeletorBusca` ao `SelectPesquisavel`), F12.1, F12.2, F5.10 e F6.14\*.

---

## 16/11/2026

**Resumo:** A abertura do Início ficou mais rápida, com pré-carga da rota e pré-consulta (F11.7\*). O resumo do Início passou a mostrar os rótulos com acento. O Preenchimento (F9.13\*) e os Fechamentos (F10.9\*) foram adequados ao formato real das respostas do back-end, o que acabou com o erro "Resposta inválida do servidor". A janela "Editar metas" ficou mais larga e com menos colunas. Foram feitos os commits `c8a7988` e `2a105f6`, enviados ao GitHub. A build foi gerada na segunda tentativa, depois de estabilizar dois testes instáveis. Plano em 93% (129/139).

### Implementações
- Pré-carga do chunk do Início na carga do app (`src/utils/preCarga.ts`), para que o `lazy` resolva sem suspender (F11.7\*).
- Aviso de acesso obtido (`src/sessao/acessoObtido.ts`), disparado pelo `SessaoProvider` antes de aplicar a sessão autenticada.
- `AntecipacaoDaRota` em `rotas.tsx` (`handle.aoObterAcesso`) e pré-consulta do Início (`src/pages/inicio/consultasInicio.ts`):
  - `GET /api/ped/inicio` e, para Admin e Validador, as pendências do cadastro saem em paralelo com a renderização do layout;
  - `useInicio` e `usePendenciasInicio` reaproveitam a pré-consulta, sem novo GET.
- Expiração adiada no `SessaoProvider` (F2.5): o 401 de uma consulta antecipada só encerra a sessão depois que a sessão autenticada aparece.
- Rótulos do resumo do Início com acento pelo front (`ROTULOS_RESUMO_INICIO`, pela `chave`) (F11.1, F11.3).
- Exemplos reais do back-end em `docs/backend/exemplos-reais/`: `preenchimento-meses.json`, `preenchimento.json`, `metas.json`, `fechamentos.json` e `imagens.json`, com testes de contrato sobre eles.

### Modificações
- Correções da expiração adiada (F2.5, em TDD):
  - a expiração podia ficar presa num novo login sem sair ou em logins concorrentes;
  - `sair()` não zerava a expiração adiada.

  Agora o provider usa `versaoAutenticacao` e `useLayoutEffect`.
- Correção do GET duplicado no `<StrictMode>` em `useInicio` e `usePendenciasInicio` (TDD).
- Preenchimento com o formato real das respostas (F9.13\*): `mes` como data `AAAA-MM-DD` nos meses e `composicao` como lista de textos nas metas. F9.1, F9.3, F9.6–F9.9 e F9.12 foram reabertos e concluídos de novo.
- "Editar metas" (F9.9):
  - saíram as colunas Tipos, Composição e Meta do cadastro;
  - a janela ficou mais larga (`dialogo-editar-metas`, max-width de 1040px), sem rolagem horizontal.
- Foco no primeiro apontamento com erro quando a API recusa o lote; a recarga do mesmo mês mantém a subaba.
- Fechamentos com o formato real de `GET /api/ped/fechamentos` (F10.9\*, não planejada):
  - "indicadores com problema" e "unidades sem tabela de faixas" aceitos como número ou lista;
  - etiquetas por contagem, e nenhuma etiqueta quando o valor é 0.

  F1.3, F10.1, F10.2, F10.4, F10.5 e F10.7 foram concluídos de novo.
- Commits `c8a7988` (11:38, 69 arquivos, com o fechamento de 13/11) e `2a105f6` (14:51, 17 arquivos), enviados ao GitHub.
- Build:
  - 1ª tentativa não realizada: falhou o teste instável `SessaoProvider.expiracaoAdiada` e a carga deu p99 de 532 ms;
  - 2ª tentativa realizada: 5626/5626 testes, p99 de 118 ms e saída em `dist/`.
- Testes instáveis estabilizados, sem mudança de requisito nem de `src/`:
  - `SessaoProvider.expiracaoAdiada.test.tsx` (F2.5): espera o estado final em `waitFor` e confere a subsequência;
  - `rotas.antecipacao.test.tsx` (F2.3): `act` antes do aviso.

### Pendências
- Commit dos dois testes estabilizados e do `requisitos.json`.
- JSON real de `GET /api/ped/fechamentos/{id}/previa`: há o risco de os avisos de pendências e de falta de faixas sumirem se vierem só números.
- Decisões em aberto:
  - filtro "Com problemas de faixa";
  - menu das linhas fechadas;
  - pré-seleção da filial em "Preencher";
  - texto do Validador;
  - limite de 100% e decimais.
- Perguntas ao back-end:
  - acesso do Validador às imagens;
  - cargo e nome da filial nas imagens;
  - mês seguinte ao aberto vindo como "fechado";
  - JSON do histórico do apontamento;
  - deploy conjunto das faixas.
- O `scripts/lotes-testes.mjs` subestima os testes parametrizados (`it.each`): lotes reais chegaram a 225 testes.
- Próximas atividades: F1.18, F5.10, F6.14\*, F12.1 e F12.2. A F10.8 está bloqueada.

---

## 13/11/2026

**Resumo:** O front foi adequado ao contrato final da faixa geral e da situação enviado pelo back-end (F8.12\*, A-18 resolvida). Foram implementadas por completo as fases Preenchimento (F9), Fechamentos e imagens congeladas (F10.1–F10.7) e Início (F11). Foram feitos dois commits, `797bc54` e `d499d3e`, enviados ao GitHub junto com o `a9da8a5`. Depois do push, a aba Preenchimento passou a separar os tipos em subabas, como no protótipo, e o Início ganhou os blocos de indicadores com meta pendente e de dashboards em construção (F11.6). Esse trabalho ainda não tem commit. Ao fim do dia, 107 requisitos estão `implementado`.

### Implementações
- Registro dos documentos novos do back-end:
  - `docs/backend/RESPOSTA-faixa-geral-e-situacao.md`;
  - `docs/backend/FRONT-faixa-geral-e-situacao.md`;
  - `docs/backend/API (28).md`.
- Serviços do Preenchimento (F9.1): `preenchimentoService`, `periodoService` e `metasService`, mais os tipos do bloco "Preenchimento" em `dominio.ts`.
- Tela de Preenchimento (F9.2–F9.8):
  - filial obrigatória;
  - seletor de mês e ano;
  - cabeçalho do mês com progresso;
  - apontamentos por tipo, com busca;
  - lançamento de valores em lote ("Salvar lançamentos");
  - correção com motivo e histórico do apontamento;
  - aviso de mês congelado em imagens.
- "Editar metas" e histórico de ajustes de meta (F9.9–F9.10).
- Abrir outro mês e reabrir mês passado (F9.11–F9.12), com o histórico de períodos e a permissão `abrir-periodo`, só para o Admin.
- Serviços de fechamentos e imagens (F10.1): `fechamentosService` e `imagensService`.
- Lista de fechamentos com filtros e "Limpar filtros" (F10.2).
- Componente `VisualizacaoImagem`, para imagens de filial e de colaborador (F10.3).
- Pré-visualização do fechamento, com escolha de filial, busca de colaborador e navegação "Imagem X de N" (F10.4).
- Encerramento manual com confirmação e lote ENC (F10.5).
- Consulta retroativa de imagens dentro da aba Fechamentos (F10.6).
- Tipos de imagem pela regra A-07 do back-end (F10.7).
- Serviço `GET /api/ped/inicio` (F11.1).
- Tela Início (F11.2–F11.5):
  - avisos do período e de acesso;
  - resumo por perfil;
  - períodos em aberto, com "Preencher";
  - últimas 6 alterações.
- Blocos do Início para Admin e Validador (F11.6, atividade não planejada):
  - cards "Indicadores com meta pendente" e "Dashboards em construção";
  - painéis com as listas e os links "Ver indicadores" e "Ver dashboards";
  - dados das rotas existentes (`situacao=meta` + `meta_filial_pendente` e `situacao=construcao`), sem mudança no back-end.

### Modificações
- Faixas e dashboards adequados ao contrato final (F8.12\*):
  - ação `exclusao` no histórico;
  - tabela de dashboard excluído sem Inativar/Reativar;
  - conflito (400) com "Dashboard: {nome}" e a lista "Tabelas em conflito";
  - filtro "Com problemas de faixa" (`problemas_faixa`) na aba Dashboards.

  Os requisitos F7.1, F7.2, F7.14, F8.1, F8.5, F8.7 e F8.8 foram reabertos e concluídos de novo (510/510).
- `Dialogo` com pilha de diálogos (F1.8 reaberto): Esc e Tab agem só no diálogo de cima.
- Correções da revisão da F9:
  - corrida de filial durante a gravação;
  - erro escondido pela busca;
  - seletor que sumia após erro;
  - metas não recarregadas após abrir ou reabrir o mês;
  - correção que fechava durante o salvamento.
- A consulta das metas passou a ser antecipada no `usePreenchimento` (`onTelaRecebida` → `anteciparMetasPreenchimento`). Com isso, saíram cerca de 250 ms de atraso do "Editar metas", que esgotavam o tempo dos testes de integração sob carga. Nenhum teste foi alterado.
- `BarraFiltros`: novas props opcionais `children` e `filtrosAdicionaisAtivos`.
- `Card`: o cabeçalho passou de `<header>` para `<div>`.
- Testes de F2.2, F2.3 e F2.5 adequados para simular `GET /api/ped/inicio`, sem mudança de comportamento.
- Correção nos auxiliares `tabela()` e `linhas()` do teste `DialogoPreviaFechamento.test.tsx`, feita pelo gerador-testes. Eles buscavam sempre o diálogo "PED Comercial", e 5 testes abriam o "PED Gerentes".
- Commits:
  - `797bc54` (11:44), aprovado na terceira tentativa do hook;
  - `d499d3e` (16:55, 77 arquivos), com 4733/4733 unitários e 717/717 de integração.
- Push feito: `a9da8a5`, `797bc54` e `d499d3e` foram enviados, e o origin/main está em `d499d3e`.
- Aba Preenchimento com subabas por tipo, como no protótipo (F9.2, F9.5–F9.8 alterados e concluídos de novo):
  - abas "{tipo} {N}" navegáveis por setas, Home e End, abrindo na primeira com apontamentos;
  - a busca esconde as abas e mostra uma lista única com a etiqueta do tipo;
  - rascunhos preservados entre abas; erro em outra aba seleciona a aba e foca o campo.

  Substitui as regiões empilhadas, por decisão do usuário. 301 unitários e 105 de integração na pasta.
- Teste de F2.2 (`LoginPage.integration`) passou a comparar só as rotas de sessão, porque o Início do admin faz mais 3 chamadas.

### Pendências
- Erro "Resposta inválida do servidor" na aba Preenchimento: aguardando o JSON real de `GET /api/ped/preenchimento/meses` e de `GET /api/ped/preenchimento`, pedido ao usuário.
- Rótulos do resumo do Início sem acento vindos da API ("construcao", "Lancamentos").
- Risco de timeout do primeiro teste do Início sob carga, que pode bloquear o hook de pre-commit.
- Commit do trabalho da tarde (subabas e F11.6), junto com os documentos de fechamento.
- Publicação conjunta de back e front das faixas, porque o `DELETE` passou a exigir motivo. Verificar depois do deploy se o corpo do `DELETE` chega ao servidor; a alternativa é `?motivo=`.
- Confirmar com o usuário o filtro "Com problemas de faixa".
- F10.8, bloqueada pela P-08.
- F12.1 e F12.2 (acessibilidade e responsividade).
- F1.18, F5.10 e F6.14\*.
- O `lotes-testes.mjs` conta menos testes do que existem: os lotes reais chegam a 229.
- O `Suspense` das rotas sob demanda atrasa cerca de 300 ms e deixa instável, sob carga, o primeiro teste de integração de cada arquivo.
- Decisões pendentes do usuário na F10:
  - menu das linhas já encerradas: "Pré-visualizar"/"Encerrar" ou "Ver imagens" (protótipo);
  - aviso pela quantidade quando o resumo vem como número;
  - teste instável da prévia.
- "Preencher" do Início vai para `/preenchimento` sem pré-seleção, porque o RF-10 pede só o botão. É um risco médio, porque o contrato fala no preenchimento "daquela filial", e depende de decisão do usuário.
- Risco baixo da F10.5: a consulta de imagens perde os filtros depois de um encerramento, porque é remontada por `key`.
- Dúvidas de contrato da F9, da F10 e da F11, registradas no plano.
- Dúvidas abertas ao usuário:
  - limite de 100% na porcentagem;
  - "1.500" e mais de 2 casas decimais;
  - alerta de faixa com tipo desconhecido;
  - Validador × imagens (API linha 688 × A-05).

---

## 12/11/2026

**Resumo:** A aba Faixas ganhou a faixa geral, a situação ativa/inativa das tabelas com motivo obrigatório, a exclusão com motivo, o botão "Ver motivo" e a coluna "Ação" no histórico. A aba Dashboards passou a mostrar alertas de faixas. Tudo segue um contrato proposto ao back-end (A-18). Depois, foram escritos os testes TDD da F9.1 (serviços do Preenchimento), ainda sem implementação, por decisão do usuário. Antes disso, pela manhã, entrou o limite de tentativas no login (429, F2.10\*), e o commit `a9da8a5` foi feito. O trabalho da faixa geral e da F9.1 está no disco, sem commit. Ao fim do dia, 82 de 83 requisitos implementados (F9.1 `pendente`) e plano em 74%.

### Implementações
- Proposta de contrato ao back-end `docs/propostas-backend/PROPOSTA-faixa-geral-e-situacao.md` (F8.9\*, A-18): `geral`, `situacao` e dados da situação, `PUT /api/ped/faixas/{id}/situacao`, `DELETE` com motivo, `alertas de faixas` no dashboard e `acao` no histórico, com 3 dúvidas na seção 9.
- Serviços, tipos e adaptadores da faixa geral e da situação (F8.10\*): campos novos em `TabelaFaixas`, filtro `situacao`, `alterarSituacaoTabelaFaixas`, `alertasDeFaixas` em `Dashboard`, `acao` no histórico e permissão `alterar-situacao-faixas` (Admin e Validador). A leitura tolera a resposta atual do servidor.
- Faixa geral no cadastro (F8.7): caixa "Faixa geral (vale para todas as filiais)", envio de `filial: "todas"`, nome "{dashboard} · Geral" e filial "Todas as filiais (geral)".
- Inativar e reativar tabela de faixas com motivo obrigatório (F8.7): diálogo novo `DialogoSituacaoTabelaFaixas`, etiqueta "Inativa", filtro "Situação" (padrão Ativas) e o erro de conflito (400) mostrado no diálogo.
- Botão "Ver motivo" na listagem (F8.8): diálogo novo `DialogoMotivoFaixas` ("Motivo da última alteração"), que lê a linha mais recente do histórico.
- Alertas de faixas na aba Dashboards (F7.14\*): etiqueta e lista por dashboard ativo, e um aviso geral próprio.
- Testes TDD da F9.1 (serviços de período, preenchimento e metas), registrada como `pendente`: 6 arquivos de teste e as fixtures `src/test/preenchimentoFalsos.ts`. Os testes estão vermelhos pelo motivo certo. Um protótipo descartável passou em 164/164, e nenhum código de produção ficou.
- Limite de tentativas no login (F2.10\*, HTTP 429):
  - `ApiError.tentarNovamenteEm` lê `"segundos para tentar novamente"` ou o cabeçalho `Retry-After`;
  - mensagem pt-BR para o 429;
  - na `LoginPage`, o envio fica bloqueado por N s (padrão 60), com "Aguarde N s" e "Tente novamente em N s.", sem reenvio automático.

### Modificações
- Commit `a9da8a5` (10:19), com:
  - o F2.10\*;
  - o ajuste final da saída da integração (F5.23\*), descrito em 11/11;
  - os 3 documentos de qualidade do back-end recebidos hoje (só o 429 exigiu mudança no front);
  - o fechamento de 11/11 e o resumo semanal.

  Requisitos F1.2, F2.1 e F2.2 passaram por `em-alteracao` e voltaram a `implementado`.
- Exclusão de tabela de faixas (F8.6): agora pede o "Motivo da exclusão", e o `DELETE` vai com `{ motivo }`. O bloqueio de tabela de dashboard existente passou a orientar "Inativar tabela".
- Histórico de versões (F8.5): coluna "Ação" quando a API informa. Linhas de inativação e reativação ficam sem "Ver faixas da versão".
- Listagem de faixas (F8.2): a consulta leva sempre `situacao=ativas` por padrão, e "Alterar faixas" só aparece em tabela ativa.
- Restrição de filial do Validador nas faixas (P-04): por correção do usuário, a proposta pede ao back-end que a retire. Admin e Validador mexem na faixa geral com as mesmas regras.
- Requisito dos alertas de faixas renomeado de F7.11 para F7.14, porque colidia com uma atividade já concluída.
- Requisitos F1.3, F7.1, F8.1, F8.2, F8.5 e F8.6 reabertos (`em-alteracao`) e concluídos de novo. F8.7, F8.8 e F7.14 criados e concluídos. Suíte com 4422/4422 testes, mais 15 de cobertura complementar.

### Pendências
- F8.12\* bloqueada até o back-end implementar a proposta (A-18), incluindo as 3 dúvidas da seção 9.
- O nome acessível do "Ver motivo" é igual em todas as linhas. A correção exige ajustar um teste e depende de decisão do usuário.
- Confirmar se o servidor atual aceita `situacao=ativas` na listagem de faixas.
- Decidir sobre um filtro "Com problemas de faixa" na aba Dashboards.
- Implementar a F9.1 (integracao-api) e escrever os testes das telas F9.2–F9.12.
- Dúvidas de contrato da F9.1:
  - envelope e formato do mês em `/preenchimento/meses`;
  - campos dos apontamentos;
  - formato de `dados.erros`;
  - linhas do `/periodo/historico`;
  - envelope de `/metas`;
  - leitura de "2.000" na F9.6.
- Confirmar a validação local da F9.1 com 400 local.
- Pendências antigas:
  - push do `a9da8a5` (o origin está em `288d6c5`);
  - commit do trabalho de hoje;
  - build;
  - contagem do `scripts/lotes-testes.mjs`, que subestima (chegou a gerar um lote de 222 testes);
  - F6.14\* (depende de `PED_EXECUTOR_ATIVO`);
  - 429 ao recarregar a página;
  - texto próprio para erros 422.

---

## 11/11/2026

**Resumo:** O front foi adequado à meta via API das fases 1 e 2 do back-end (entrada SOAP, avisos, `finalidade`, executor e última consulta). A saída da integração mudou duas vezes: primeiro para "chave: tipo" com mapeamento, depois para "chave: tipo" só informativa, sem mapeamento, que é o contrato final com o back-end. Também entraram as regras de execução de testes em lotes de até 150. Dois commits (`6500740` e `288d6c5`), uma build validada e um ajuste final ainda não commitado. Ao fim do dia, 79 requisitos implementados.

### Implementações
- Entrada da integração no formato SOAP (`operacao` + `parametros`/`chamadas`), com o modelo novo do "Inserir modelo" (F5.7, F5.14).
- Aviso não bloqueante de `%filial%`/`%colaborador%`/`%zona%` na entrada, orientando o uso de `%empresas%`.
- `finalidade` (`valor`/`meta`) no `POST /api/ped/integracao/validar` e `tipo de servico` aceito na leitura, sem ser enviado.
- "Última consulta do dado externo" (F5.22\*, só Admin): etiqueta "Erro na última consulta" e, nos detalhes, "Última consulta" e "Erro da última consulta".
- Última consulta da meta no indicador da fonte `integracao` (F6.11), e dashboards com "Erro na consulta da meta" (F7.6).
- `scripts/lotes-testes.mjs`: divide as baterias em lotes de até 150 testes (contagem estática, first-fit, sem quebrar arquivos).
- Regras de execução de testes no `CLAUDE.md` e nos agentes `testes-unitarios`/`testes-integracao`: um agente por lote, 2 testes simultâneos por agente, no máximo 10 subagentes de qualquer tipo ao mesmo tempo.
- Hook `useInsercaoNoCursor` extraído para a inserção de variáveis e operadores no cursor. Surgiu com os marcadores da saída (F5.21*), para cada caixa ter o seu cursor, e foi mantido depois da remoção deles.
- Documentos com o back-end: `PROPOSTA-saida-chave-tipo.md` (opções A/B/C), `FRONT-saida-chave-tipo.md` (resposta do back, opção B) e `RESPOSTA-FRONT-saida-sem-mapeamento.md` (A-17).
- Build validada REALIZADA: 79/79, unitários 3753, integração 503, carga 100% 2xx (9.876 requisições, média 50 ms, p99 104 ms). Primeira visita: `vendor` 310 kB + `index` 34 kB.

### Modificações
- Saída da integração de lista (`filial` + `valor`/`meta`) para objeto "chave: tipo" (`string`, `number`, `date`, `boolean`), com mapeamento (F5.23\*, opção B do back-end). Lista antiga abre com aviso e salvar bloqueado.
- Marcadores da saída (F5.21\*, `%filial%`/`%valor%`/`%meta%`/`%competencia%`) implementados e depois removidos, por decisão do usuário.
- Saída sem mapeamento: as listas de campo de valor, competência e filial saíram da modal. A saída passou a ser validada só no front, o `validar` vai só com a entrada, os corpos levam só os 4 campos e `mapeamento.ts` foi removido.
- Erros de saída sem linha/coluna no motor local. Requisitos alterados: F1.3, F5.1, F5.7, F5.14, F5.16, F5.17, F5.18 e F6.11.
- Commit `6500740` (28 lotes 100%: unitários 3842, integração 506) e commit `288d6c5` (28 lotes 100%). Hook aprovado nos dois.
- Ajuste final (não commitado): modelo de saída único e genérico `{ "codigo_filial": "string", "quantidade": "number", "data": "date" }` para dado externo e indicador, texto de ajuda novo e cobertura dos erros 400 da saída junto ao campo. Unitários 3754/3754, integração 504/504.

### Pendências
- Commit do ajuste final e dos documentos novos do back-end. Build com o ajuste final (a build de hoje não o inclui).
- Melhorar o `scripts/lotes-testes.mjs`: a contagem estática subestima testes gerados (houve lote real com 251 testes).
- F6.14\* (validar a meta via API ponta a ponta) depende de `PED_EXECUTOR_ATIVO=true` no back-end.
- Integrações salvas em lista no ambiente real precisam ser reescritas pela TI.
- Decisões antigas em aberto: "Nenhuma consulta ainda" nos dados do ERP, formato da "Última consulta", regras assumidas da meta por filial e da meta via API.
- Teste lento `DadosExternosPage.concluir.integration` (~23–70 s).

---

## 10/11/2026

**Resumo:** Duas builds validadas, decisões sobre as dúvidas da integração, ajustes de tabelas e da modal "Definir meta", build dividida (`vendor`/`index`) e abas sob demanda. Também entraram a meta por filial com "Definir metas pendentes" e a meta via API, adequada ao contrato final negociado com o back-end. Commit `a2ab9cc` feito na segunda tentativa. Ao fim do dia, 78 requisitos implementados e plano em 73% (93/127).

### Implementações
- Build validada ("gere uma build"): 72/72 requisitos, unitários 3069/3069 e integração 420/420 em baterias separadas, carga 100% 2xx. `index` único de 521 kB, com aviso do Vite.
- `TextoTruncado` (F1.19\*): texto em uma linha com reticências, esmaecer e `title`. Aplicado na URL da listagem de Dados Externos. Feito antes dos testes (desvio do TDD registrado).
- Build dividida (F12.6\*): `vite.config.ts` separa `vendor` (310 kB) e `index` (212 kB).
- Abas sob demanda (F2.9\*): `React.lazy` em `rotas.tsx` e `Suspense` com `key` no `LayoutPrincipal`. A primeira visita baixa `vendor` 310 kB + `index` 32 kB.
- Segunda build validada (~13h): 74/74, unitários 3145, integração 424, carga 100% 2xx (média 97 ms com a máquina carregada).
- Meta por filial (F6.10\*): "Replicar a meta para todas as filiais" no cadastro e no "Definir meta", erros 400 por filial e alerta das filiais sem meta na listagem e no sinal da aba.
- "Definir metas pendentes" (F6.12\*): `PUT .../{id}/metas-filiais`, para Admin e Validador.
- Meta via API (F6.11\*): fonte `dado_externo` (flag "Meta vinda do dado externo") ou `integracao` (configuração só do Admin, modal com todos os campos obrigatórios). A meta automática nunca é editável. Há etiquetas por situação.
- Modo leitura da modal de integração (F5.19\*): "Ver integração do dado externo" para o Admin na fonte `dado_externo`. Atende à decisão do negócio e da TI na `RESPOSTA-FINAL-meta-via-api.md`: na fonte ERP, mostra-se a integração do dado externo, só para leitura.
- Documentos de contrato em `docs/propostas-backend/`: propostas de meta por filial e de meta via API, contraproposta e resposta final do back-end, resposta e confirmação do front.

### Modificações
- Integração do dado externo (F5.7, F5.14, F5.16, F5.18), com as decisões do usuário sobre as dúvidas de 09/11:
  - a entrada continua só em objeto;
  - os tipos usam `numero`;
  - variável sem cursor vai para o fim;
  - limites de 60/500 caracteres;
  - erros 400 somem ao editar o campo.
- Saída da integração passou de objeto para lista (`filial` + `valor`/`meta`). Também entraram `forneceMeta` no dado externo e os dashboards recusando indicadores da fonte `integracao` sem situação `ok` (F1.3, F5.1, F6.3, F7.6).
- Dados Externos sem rolagem lateral (F5.20\*, antes numerada F5.19\*): identificador e URL limitados, Nome e Cadastro com quebra de linha e conteúdo até 1600px.
- Apontamentos sem rolagem lateral (F4.10\*): área até 1440px e coluna Indicadores limitada a 16rem.
- Estilo da modal "Definir meta" (F6.13\*): bloco "Composição", Meta e Sentido lado a lado, rodapé com filete.
- Adequação à API (26) e ao `FRONT-meta-por-filial.md`: erros por filial, campo `meta por filial`, filtro `meta_filial_pendente` e meta enviada como número.
- Testes da F2.3 passaram a usar `findBy*` (abas sob demanda). Requisitos F1.3, F6.1–F6.3 e F6.5–F6.7 passaram por `em-alteracao` e voltaram a `implementado`.
- Commit: a primeira tentativa foi reprovada (integração 98,48%, 7 timeouts sob carga). Com as baterias divididas em 4 agentes, tudo passou a 100% (unitários 3588, integração 482) e o commit `a2ab9cc` foi feito. Ele inclui o trabalho de 06/11 a 10/11 e as mudanças de configuração do usuário.

### Pendências
- Back-end: fase 1 da meta via API e executor (fase 2). A F6.14\* segue bloqueada.
- Comportamentos assumidos que precisam de confirmação: indicador indisponível no dashboard quando a consulta dá erro; etiquetas de situação para todos os perfis; sem aviso quando não há `meta via api`; falha silenciosa ao carregar dados externos no "Definir meta"; "Definir metas pendentes" oculto em "Meta a definir"; erros `filial: null` não exibidos.
- O "`campo` = caminho" nos erros de validação continua sem confirmação do back-end.
- Conferência visual: tabelas de Dados Externos e Apontamentos e modal "Definir meta".
- Nenhuma build validada inclui as mudanças feitas depois das 13h.
- Testes instáveis sob carga (avaliar timeouts ou baterias divididas). Push não feito.
- Próximas atividades: F5.10, F9.1, F10.1, F11.1 e F1.18.

---

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
