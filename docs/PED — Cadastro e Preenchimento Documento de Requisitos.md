# PED — Cadastro e Preenchimento: Documento de Requisitos

Nov 3, 2026 · @Leonardo Norio

## 1. Introdução

O PED Cadastro e Preenchimento cadastra os componentes do Programa de Excelência em Distribuição, recebe os lançamentos mensais por filial e encerra os períodos de cada dashboard, gerando imagens congeladas. A Consulta de Resultados, usada pelo usuário final, é outro sistema e não faz parte deste documento.

**Fontes.** Os requisitos vêm de duas fontes: o protótipo "PED — Cadastro e Preenchimento" (versão de 03/11/2026) e as decisões do responsável pelo projeto, registradas em 27/10/2026. Onde uma decisão altera o protótipo, vale a decisão; as diferenças estão na seção 9.

**Escopo.** Entram as abas Início, Tipos, Apontamentos, Dados Externos, Indicadores, Faixas, Dashboards, Preenchimento e Fechamentos, além das integrações da seção 6. Ficam fora a aba Aprovações e a aba Usuários.

**Convenção.** RF = requisito funcional, RN = regra de negócio, RNF = requisito não funcional, INT = integração e P = pendência. Um requisito que depende de uma pendência cita o código dela.

### Histórico de versões

| Versão | Data | Alterações |
| --- | --- | --- |
| 2.3 | 03/11/2026 | Apontamentos e dados externos não podem ser excluídos se já compuseram algum indicador |
| 2.2 | 03/11/2026 | Exclusão física de indicador só se nunca vinculado a dashboard; P-05 resolvida; P-08 e P-14 seguem em aberto |
| 2.1 | 03/11/2026 | Decisões das pendências: Tipos só para Admin e Validador; Admin e Validador ativam qualquer dado externo; Validador com acesso total a Indicadores e Faixas; meta só manual; sem sincronização com o Bitrix24; reabertura de mês só pelo Admin; fórmula em texto livre; dados externos guardados por mês. P-02, P-03, P-04, P-06, P-09, P-10 e P-15 resolvidas; P-05, P-08 e P-14 parcialmente |
| 2.0 | 03/11/2026 | Revisão pelo protótipo de 03/11/2026: uma imagem por colaborador em todos os tipos de vínculo, colaborador nas imagens, na prévia e na consulta; P-07 e P-16 resolvidas |
| 1.1 | 27/10/2026 | Origem da meta do indicador (manual ou sistema terceiro); pendência P-15 |
| 1.0 | 27/10/2026 | Versão inicial |

### Glossário

| Termo | Definição |
| --- | --- |
| Tipo de apontamento | Área a que um apontamento ou dado externo pertence. São 7 tipos fixos (Comercial, Financeiro, Recursos Humanos, Tecnologia da Informação, Fiscal, Processos e Contabilidade), e é possível cadastrar tipos personalizados. |
| Apontamento | Informação lançada manualmente no PED, uma vez por mês de competência e filial. |
| Dado externo | Informação coletada pelo backend em um sistema terceiro, conforme a parametrização. |
| Indicador | Medida avaliada contra uma meta, composta por um ou vários apontamentos ou por um único dado externo. |
| Pontos base | Peso de um indicador dentro de um dashboard específico. |
| Pontuação base máxima | Soma obrigatória dos pontos base de um dashboard; não muda depois do cadastro. |
| Dashboard | Conjunto de indicadores com periodicidade, vínculo (filiais, cargos ou colaboradores) e pontos base. |
| Tabela de faixas | Faixas De/Até com alíquota, por dashboard e filial, com histórico de versões. |
| Mês de competência | Mês a que um lançamento se refere. |
| Período aberto | Único mês de competência que aceita lançamentos, correções e ajustes de meta, para todas as filiais. |
| Encerramento | Ação manual que fecha o período atual de um dashboard e gera as imagens congeladas. |
| Imagem congelada | Registro somente leitura do resultado de um dashboard em um período, gerado no encerramento. |
| PED (%) | Soma dos pontos realizados de todos os indicadores de uma imagem. |

## 2. Perfis de acesso

O sistema tem três perfis: Admin, Validador e Preenchedor. O perfil, o vínculo com os tipos e as filiais de acesso de cada usuário vêm da API de autenticação de terceiros (INT-01); o PED não cadastra usuários. O vínculo do usuário com os tipos é feito pelo grupo do usuário, conforme a configuração da aba Tipos (P-01).

- **Admin:** acesso total aos cadastros, à abertura de período e aos fechamentos.
- **Validador:** acessa todos os tipos, preenche, edita dashboards existentes, acessa Indicadores e Faixas e encerra períodos.
- **Preenchedor:** vê e cadastra apenas apontamentos e dados externos dos seus tipos, nas filiais a que tem acesso.

### Matriz de permissões

| Aba / ação | Admin | Validador | Preenchedor |
| --- | --- | --- | --- |
| Início | Sim | Sim | Sim (seus tipos e filiais) |
| Tipos | Sim | Sim | Não |
| Apontamentos — consultar | Todos os tipos | Todos os tipos | Seus tipos |
| Apontamentos — cadastrar | Sim | Sim | Sim (seus tipos) |
| Apontamentos — ativar/desativar | Qualquer apontamento | Qualquer apontamento | Não |
| Apontamentos — excluir | Sim, se nunca compôs indicador | Não | Não |
| Dados externos — consultar | Todos os tipos | Todos os tipos | Seus tipos |
| Dados externos — cadastrar já ativo (com identificador) | Sim | Não | Não |
| Dados externos — pedir construção à TI | Não | Sim | Sim (seus tipos) |
| Dados externos — concluir construção (informar identificador) | Sim | Não | Não |
| Dados externos — ativar/desativar | Qualquer dado externo | Qualquer dado externo | Não |
| Dados externos — excluir | Sim, se nunca compôs indicador | Não | Não |
| Indicadores | Sim | Sim | Não |
| Faixas | Sim | Sim | Não |
| Dashboards — consultar, ver pesos e histórico | Sim | Sim | Não |
| Dashboards — cadastrar | Sim | Sim | Não |
| Dashboards — concluir construção ou modificação (TI) | Sim | Não | Não |
| Dashboards — editar | Sim | Sim | Não |
| Dashboards — ativar/desativar e excluir | Sim | Não | Não |
| Preenchimento — lançar e corrigir | Sim | Sim | Sim (seus tipos e filiais) |
| Preenchimento — editar metas | Sim | Sim | Sim (indicadores dos seus tipos) |
| Preenchimento — abrir período | Sim | Não | Não |
| Fechamentos — pré-visualizar, encerrar e consultar imagens | Sim | Sim | Não |

**RF-01 — Filial no cabeçalho.** O cabeçalho mostra a filial de trabalho conforme as filiais de acesso do usuário:

- com acesso a todas as filiais, um seletor livre com a opção "Todas as filiais";
- com acesso a uma única filial, a filial fixa, sem opção de troca;
- com acesso a várias filiais, um seletor restrito a elas.

**RF-02 — Identificação.** O cabeçalho mostra o nome do usuário, a etiqueta do perfil e o botão Sair.

## 3. Requisitos funcionais — acesso e cadastros base

### 3.1 Autenticação

- **RF-03:** o login valida usuário e senha na API de autenticação de terceiros (INT-01). O PED não armazena senhas.
- **RF-04:** após o login, o sistema aplica o perfil, o vínculo com os tipos e as filiais de acesso devolvidos pela API (P-01).
- **RF-05:** o botão Sair encerra a sessão.

### 3.2 Início

- **RF-06:** o Início mostra um aviso com o período aberto para preenchimento e a regra de que só um período fica aberto por vez.
- **RF-07:** o Preenchedor vê um aviso de que acessa apenas os seus tipos e filiais. Um usuário de outro perfil com filiais restritas vê um aviso com essas filiais.
- **RF-08:** os indicadores-resumo variam conforme o perfil:
  - Admin: apontamentos ativos, dados externos ativos, total de indicadores, dados externos em construção pela TI e lançamentos pendentes no período;
  - Validador: apontamentos ativos, dashboards com seus apontamentos, seus dados externos em construção, dashboards ativos e pendentes no período;
  - Preenchedor: os mesmos do Validador, sem "Dashboards ativos", com "Apontamentos dos meus tipos".
- **RF-09:** o botão "Preencher apontamentos do período" leva à aba Preenchimento.
- **RF-10:** a lista "Períodos em aberto" mostra cada dashboard ativo visível ao usuário, com:
  - periodicidade e período atual;
  - progresso ("X de Y lançamentos") nas filiais selecionadas ainda não encerradas;
  - botão Preencher.

  Para o Preenchedor, só entram dashboards com apontamentos dos seus tipos, e o progresso considera só esses tipos.
- **RF-11:** a lista "Últimas alterações em apontamentos" mostra os 6 lançamentos ou correções mais recentes, com ação, apontamento, competência, filial, valor anterior → novo, data e usuário. O Preenchedor vê só os dos seus tipos.

### 3.3 Tipos de apontamento

- **RF-12:** listar os tipos com nome, origem (Fixo ou Personalizado), grupos vinculados e quantidade de apontamentos.
- **RF-13:** cadastrar tipo personalizado. O nome é obrigatório e único (sem diferenciar maiúsculas), e é preciso vincular ao menos um grupo.
- **RF-14:** editar os grupos vinculados de qualquer tipo, fixo ou personalizado.
- **RF-15:** excluir tipo personalizado. Os 7 tipos fixos não podem ser excluídos, e a exclusão é bloqueada enquanto o tipo tiver apontamentos.
- **RF-16:** o vínculo grupo → tipo define a quais tipos o usuário tem acesso: o usuário acessa os tipos ligados ao seu grupo (P-01). A aba é acessível somente a Admin e Validador, e a lista de grupos vem da API de cadastros (INT-02).

### 3.4 Apontamentos

- **RF-17:** listar os apontamentos visíveis ao usuário com nome, descrição, situação, tipo, tipo de valor, indicadores de que faz parte, data e autor do cadastro. Etiquetas mostram "Vinculado a dashboard" e "Desativado, mas usado em indicador ativo".
- **RF-18:** filtros:
  - busca por nome, tipo, descrição ou tipo de valor, sem diferenciar acentos;
  - situação: todas, ativos, inativos ou com problemas;
  - botões por tipo, com contagem.
- **RF-19:** cadastrar apontamento com nome (obrigatório), tipo (entre os do usuário), tipo de valor (Porcentagem, Numeral ou Booleano) e descrição (opcional). O apontamento nasce ativo para todos os perfis e já aparece no Preenchimento.
- **RF-20:** apontamento não pode ser editado depois de salvo.
- **RF-21:** ativar ou desativar um apontamento pede confirmação e registra quem fez e quando.
  - Desativado, ele sai do Preenchimento e dos cálculos dos próximos fechamentos.
  - Lançamentos já feitos e imagens congeladas são mantidos.
- **RF-22:** excluir apontamento exige confirmação e é bloqueado se ele compõe ou já compôs qualquer indicador, mesmo que esse indicador tenha sido excluído; a mensagem lista os indicadores atuais. A exclusão é definitiva.

### 3.5 Dados externos

- **RF-23:** listar os dados visíveis ao usuário com nome, tipo, data e autor, situação (com o número da tarefa Bitrix, quando houver), origem, identificador da consulta (ou "a definir pela TI"), campo/cálculo, referência, coleta, janela retroativa e tipo de valor.
- **RF-24:** filtros:
  - busca por nome, origem, identificador, campo, tipo ou referência;
  - situação: todas, ativos, inativos, em construção (TI) ou com problemas.
- **RF-25:** campos comuns do cadastro:
  - nome;
  - tipo de apontamento relacionado;
  - sistema de origem (Senior ERP (Sapiens), Senior HCM, Bitrix24 ou Outro sistema);
  - tipo de valor;
  - referência (Filial, Colaborador ou Zona de venda);
  - coleta (Diária ou Data específica do mês, com dia de 1 a 31);
  - sentido do cálculo (somar, fazer a média ou usar só o último valor, que sobrepõe os anteriores);
  - janela retroativa (somente o mês, 2, 3, 6, 12 ou 24 meses), oculta quando o sentido é "último valor";
  - comentários, obrigatórios quando a origem é "Outro sistema".
- **RF-26:** no cadastro do Admin, o identificador da consulta é obrigatório e é gravado em maiúsculas. O dado nasce ativo.
- **RF-27:** no cadastro do Validador e do Preenchedor, é obrigatório descrever o campo a buscar ou o cálculo a fazer. Ao salvar:
  - o dado fica "Em construção (TI)";
  - é criada uma tarefa de construção no Bitrix24 (INT-04).
- **RF-28:** para concluir a construção, o Admin informa o identificador criado pela TI e ativa o dado.
  - Se nenhum indicador usar esse dado, o sistema cria automaticamente um indicador com o mesmo nome, aguardando a definição da meta (RF-36).
- **RF-29:** dado externo não pode ser editado depois de salvo.
- **RF-30:** ativar ou desativar um dado externo pede confirmação e registra quem fez e quando. Desativado, o dado deixa de ser coletado e de compor os indicadores dos próximos fechamentos; imagens já congeladas são mantidas.
- **RF-31:** excluir dado externo exige confirmação e é bloqueado se ele compõe ou já compôs algum indicador, mesmo que esse indicador tenha sido excluído. A exclusão é definitiva.

## 4. Requisitos funcionais — indicadores, faixas e dashboards

### 4.1 Indicadores

- **RF-32:** listar os indicadores com:
  - nome;
  - composição (apontamentos em azul, dado externo em dourado, componentes desativados marcados);
  - sentido (e soma ou média, quando há mais de um apontamento);
  - meta;
  - dashboards em que aparece, com os pontos base em cada um.

  Etiquetas: criado automaticamente, meta a definir, componentes desativados, inativo, meta editável no preenchimento e vinculado a dashboard.
- **RF-33:** filtros:
  - busca por indicador, apontamento ou dado externo;
  - situação: todas, ativos, inativos, aguardando definição de meta ou com problemas.

  A aba mostra alertas quando há indicadores aguardando meta ou com componente desativado. A aba Indicadores ganha um sinal de alerta no menu nesses casos.
- **RF-34:** cadastrar indicador com:
  - nome (obrigatório);
  - meta, sempre inserida manualmente no sistema (número maior que zero);
  - sentido ("Maior é melhor" ou "Menor é melhor (custo)");
  - cálculo do realizado (soma ou média), exibido só quando há apontamentos;
  - descrição (opcional);
  - opção "Meta editável no preenchimento".
- **RF-35:** a composição é um ou vários apontamentos ativos **ou** exatamente um dado externo ativo, nunca os dois. Escolhido um tipo, o outro fica bloqueado. A seleção tem busca e lista os itens escolhidos com opção de remover.
- **RF-36:** um indicador criado automaticamente (RF-28) mostra "Definir meta". O formulário pede meta (maior que zero), sentido e meta editável e mostra o dado externo de origem. A meta só pode ser definida uma vez, e antes disso o indicador não pode entrar em dashboard.
- **RF-37:** indicador não pode ser editado depois de cadastrado. Ele pode ser inativado a qualquer momento (RF-38) e só pode ser excluído quando nunca tiver sido vinculado a nenhum dashboard. A exclusão é física e definitiva e pede confirmação.
- **RF-38:** inativar ou reativar qualquer indicador, vinculado ou não a dashboard, pede confirmação, registra quem fez e quando e informa os dashboards afetados. Enquanto inativo, os pontos base do indicador nesses dashboards ficam sem pontuação; imagens já congeladas são mantidas.
- **RF-39:** para indicadores com meta editável, a linha oferece o histórico de alterações de meta (data, filial, mês, de, para, usuário e motivo), filtrado pela filial selecionada no cabeçalho.
- **RF-40:** um indicador com componente desativado mostra um aviso explicando o impacto:
  - dado externo desativado: o indicador fica sem resultado;
  - todos os apontamentos desativados: o indicador fica sem resultado;
  - parte dos apontamentos desativada: o cálculo segue sem eles e pode distorcer o resultado.

  O aviso orienta a reativar o componente ou desativar o indicador.

### 4.2 Faixas

- **RF-41:** a aba mostra as tabelas de faixas da filial selecionada (ou de todas) e permite escolher uma delas. Para a tabela escolhida, mostra:
  - dashboard e filial;
  - versão vigente, data e autor;
  - linhas De e Até (em reais) e Alíquota (%).
- **RF-42:** cadastrar tabela com dashboard, filial (pedida só quando o cabeçalho está em "Todas as filiais"), descrição (opcional) e uma ou mais linhas. Existe no máximo uma tabela por dashboard e filial; se já houver, o sistema orienta a usar "Alterar faixas".
- **RF-43:** validações das linhas:
  - De, Até e Alíquota preenchidos;
  - De menor que Até;
  - alíquota não negativa;
  - cada faixa começa acima do Até da anterior;
  - ao menos uma faixa.
- **RF-44:** "Alterar faixas" gera uma nova versão (v+1). O motivo é obrigatório, e a versão anterior permanece no histórico.
- **RF-45:** o histórico de versões lista versão, etiqueta de vigente, motivo, data e autor, e permite ver as faixas de cada versão.
- **RF-46:** uma tabela só pode ser excluída quando o seu dashboard não existe mais. A exclusão remove a tabela e o histórico; imagens congeladas mantêm as faixas usadas no encerramento.

### 4.3 Dashboards

- **RF-47:** listar os dashboards com:
  - nome e tipo de vínculo;
  - situação e número da tarefa Bitrix mais recente;
  - data de cadastro ou da última alteração;
  - periodicidade e itens vinculados;
  - quantidade de indicadores e pontos (soma dos pontos base / máximo);
  - período atual.

  Filtros: busca por dashboard, grupo ou indicador; situação (todas, ativos, inativos, em construção/modificação, com problemas). Dashboards ativos com indicador problemático mostram alerta com os indicadores, o motivo e os pontos afetados.
- **RF-48:** menu de ações por dashboard:
  - Editar;
  - Ver pesos dos indicadores;
  - Histórico de modificações;
  - Preencher apontamentos (dashboard ativo);
  - Ativar/Desativar (Admin, fora de construção ou modificação) ou Concluir construção/modificação (Admin, quando em TI);
  - Excluir (Admin).
- **RF-49:** cadastrar dashboard (Admin e Validador) com:
  - nome;
  - periodicidade (mensal, bimestral, trimestral, semestral ou anual);
  - pontuação base máxima (maior que zero);
  - tipo de vínculo e itens vinculados;
  - indicadores com pontos base;
  - indicador base da faixa;
  - fórmula de pontuação;
  - observação para a TI (opcional).
- **RF-50:** o encerramento gera uma imagem por colaborador vinculado, conforme o tipo de vínculo:
  - por filiais: uma imagem por colaborador das filiais escolhidas, com opção "Selecionar todas";
  - por cargos: uma imagem por colaborador do cargo, apenas nas filiais que têm colaboradores desse cargo;
  - por colaboradores específicos: uma imagem por colaborador escolhido.

  As listas de filiais, cargos e colaboradores vêm da API de cadastros (INT-02), com busca por nome, cargo ou filial. Uma filial sem nenhum colaborador vinculado gera uma única imagem, identificada como "Filial (sem colaborador vinculado)". O formulário informa quantas imagens serão geradas e em quais filiais.
- **RF-51:** cada indicador incluído exige pontos base maiores que zero. A soma deve ser exatamente igual à pontuação base máxima; o formulário mostra o total e quanto falta ou excede.
- **RF-52:** não podem ser incluídos indicadores inativos, com componente desativado ou com meta a definir. Eles aparecem na seleção como indisponíveis, com o motivo.
- **RF-53:** dashboard vinculado por filiais não aceita indicador composto por dado externo de referência Zona de venda ou Colaborador, mesmo gerando uma imagem por colaborador. Dashboards por cargo ou por colaborador aceitam dados de qualquer referência.
- **RF-54:** o indicador base da faixa é obrigatório e pode ser qualquer indicador cadastrado, mesmo fora do dashboard. A fórmula de pontuação também é obrigatória, em campo de texto livre. Os dois seguem na tarefa enviada à TI.
- **RF-55:** ao salvar um novo dashboard:
  - o sistema cria uma tarefa de construção no Bitrix24 (INT-04);
  - o dashboard fica inativo, "em construção (TI)", até o Admin registrar a conclusão no PED; então fica ativo.

  Antes de salvar, o formulário mostra o título e a descrição da tarefa.
- **RF-56:** editar dashboard (Admin e Validador) permite alterar todos os campos de RF-49, exceto a pontuação base máxima. A opção "Enviar tarefa à TI" cria uma tarefa de modificação:
  - o dashboard fica inativo, "em modificação (TI)";
  - o sistema guarda o estado anterior (ativo ou inativo) e o retoma quando o Admin registra a conclusão no PED.

  O formulário mostra as tarefas anteriores.
- **RF-57:** toda gravação registra no histórico de modificações:
  - ação (Cadastro, Edição, Desativado, Reativado, Construção/Modificação concluída);
  - data e usuário;
  - lista das alterações (nome, periodicidade, vínculo, indicadores incluídos ou removidos e mudanças de pontos);
  - tarefa Bitrix e observação, quando houver.
- **RF-58:** desativar um dashboard tira-o do Início e dos Fechamentos e impede encerrar seus períodos; imagens e lançamentos são mantidos. Reativar devolve-o a partir do período atual.
- **RF-59:** excluir dashboard (Admin) exige confirmação e mantém as imagens congeladas.

## 5. Requisitos funcionais — preenchimento e fechamentos

### 5.1 Preenchimento de apontamentos

- **RF-60:** o preenchimento exige uma filial selecionada. Com "Todas as filiais" no cabeçalho, a aba pede a escolha de uma.
- **RF-61:** o seletor de mês de competência mostra os 12 meses do ano escolhido:
  - o mês aberto aparece com a etiqueta "aberto" e a quantidade de pendentes;
  - os demais meses passados aparecem como "fechado · consulta";
  - meses futuros ficam desabilitados.

  O ano é escolhido por setas ou digitação (de 2000 ao ano atual), com o atalho "Ir para o período aberto".
- **RF-62:** só o mês aberto aceita lançamentos e correções. Em outro mês, a aba fica somente para consulta e mostra qual é o mês aberto.
- **RF-63:** a aba mostra a filial, a situação do mês, o progresso ("X de Y apontamentos preenchidos") e quem abriu o período e quando.
- **RF-64:** os apontamentos ativos dos tipos do usuário aparecem separados por tipo, com contagem. Uma busca por apontamento ou indicador procura em todos os tipos do usuário.
- **RF-65:** cada apontamento mostra:
  - nome, tipo de valor e situação (Pendente, Não lançado, Preenchido ou Corrigido);
  - indicadores de que faz parte;
  - dashboards e periodicidades em que entra.
- **RF-66:** valores aceitos:
  - Booleano: botões Sim/Não;
  - Numeral e Porcentagem: número decimal com vírgula, não negativo (Porcentagem mostra "%").
- **RF-67:** cada apontamento é lançado uma única vez por mês de competência e filial, e o valor vale para todos os dashboards que o usam.
- **RF-68:** a correção de um valor já lançado exige um valor diferente do atual e um motivo, que fica no histórico.
- **RF-69:** o histórico de cada apontamento lista data, ação (Lançamento ou Correção), valor anterior, valor novo, usuário e motivo, do mais recente para o mais antigo.
- **RF-70:** se o mês já foi congelado na imagem de algum dashboard, o apontamento avisa quais imagens são essas. Uma correção vale só para os períodos ainda abertos; a imagem já gerada não muda.

### 5.2 Edição de metas no preenchimento

- **RF-71:** o botão "Editar metas" (com contagem) aparece quando há indicadores ativos com meta editável compostos por apontamentos ou dado externo dos tipos do usuário.
- **RF-72:** a janela mostra filial, mês e situação, com filtro por tipo. Para cada indicador, mostra os tipos, a composição, a meta do cadastro, a meta vigente e a etiqueta "Ajustada" quando houver ajuste.
- **RF-73:** a nova meta vale só para a filial e o mês exibidos; nos demais continua valendo a meta do cadastro. Regras:
  - só no mês aberto;
  - valor maior que zero e diferente da meta vigente;
  - motivo obrigatório.
- **RF-74:** cada indicador ajustado oferece o histórico (data, de, para, usuário e motivo).

### 5.3 Abertura de período

- **RF-75:** existe um único mês aberto para preenchimento, comum a todas as filiais.
- **RF-76:** o Admin abre outro mês pela aba Preenchimento, com confirmação.
  - O mês aberto anterior fecha para preenchimento, e os lançamentos dele continuam disponíveis para consulta.
  - Cada abertura registra o mês, o usuário e a data.
  - Só o Admin pode reabrir um mês passado já fechado.

### 5.4 Fechamentos

- **RF-77:** o encerramento é sempre manual; não há encerramento automático.
- **RF-78:** a aba lista os dashboards ativos, ordenados por periodicidade e nome. Cada linha mostra:
  - nome e vínculo;
  - quantidade de filiais e quantas têm pendências;
  - periodicidade e período atual;
  - progresso de lançamentos e ação.

  Etiquetas indicam indicadores com problema e falta de tabela de faixas.
- **RF-79:** filtros por periodicidade, por situação do período (em aberto ou encerrado) e busca por dashboard, grupo ou período, com "Limpar filtros".
- **RF-80:** "Pré-visualizar imagens" calcula as imagens com os lançamentos, metas e faixas atuais, sem gravar nada. A prévia:
  - permite escolher a filial, mostrando para cada uma a quantidade de imagens, o progresso de lançamentos, a falta de faixas e se já foi encerrada;
  - permite escolher o colaborador da filial, com busca por nome ou cargo;
  - lista as imagens que serão geradas na filial (colaborador, cargo, PED e pontuação), com a quantidade na filial e no total, e opção de visualizar cada uma;
  - navega entre todas as imagens do dashboard ("Imagem X de N · Filial F");
  - avisa que lançamentos pendentes serão congelados sem valor e quando não há tabela de faixas;
  - permite encerrar a partir dela.
- **RF-81:** cada dashboard é encerrado individualmente, no período atual da sua periodicidade. A confirmação informa:
  - quantas imagens serão geradas no total e em cada filial (uma por colaborador);
  - que os outros dashboards não são afetados;
  - as filiais com lançamentos pendentes;
  - as filiais sem tabela de faixas.
- **RF-82:** o encerramento gera, ao mesmo tempo, as imagens de todas as filiais ainda não encerradas (RF-50), no mesmo lote (código ENC-xxxxxx). Regras:
  - cada imagem usa os lançamentos, as metas e a tabela de faixas da filial do colaborador;
  - dados externos de referência Colaborador usam os valores do próprio colaborador;
  - uma filial é encerrada por inteiro, com as imagens de todos os seus colaboradores.
- **RF-83:** a imagem é somente leitura e não muda com correções posteriores. Ela contém:
  - código único, filial, período, dashboard e vínculo;
  - colaborador e cargo (ou "Filial (sem colaborador vinculado)");
  - Resultado Operacional (base da faixa), PED (pontuação total) e pontuação calculada;
  - por indicador: meta, realizado, % de atingimento, pontos base, pontos realizados e observação de cálculo;
  - total de pontos;
  - faixas vigentes no encerramento (nome e versão), destacando a faixa atingida;
  - data e usuário da geração.
- **RF-84:** a consulta retroativa lista as imagens da filial selecionada com dashboard, colaborador e cargo, período, filial, data, usuário e PED. Tem filtro por período e busca por dashboard, colaborador, cargo, filial, código ou usuário, e permite visualizar cada imagem.

## 6. Integrações

O PED depende de quatro integrações com sistemas terceiros, todas executadas pelo backend da aplicação.

| Código | Integração | O que faz | Dados trocados |
| --- | --- | --- | --- |
| INT-01 | API de autenticação | Valida o login do usuário | Envia: login e senha. Recebe: perfil, vínculo com tipos ou grupo (P-01) e filiais de acesso |
| INT-02 | API de cadastros | Fornece as listas usadas no vínculo dos dashboards e nas imagens | Filiais, cargos, grupos, colaboradores (com cargo e filial) e o vínculo de cada colaborador com a zona de venda |
| INT-03 | Coleta de dados externos | Busca nos sistemas de origem os valores dos dados externos ativos | Por dado: origem, identificador da consulta, referência, coleta diária ou no dia configurado |
| INT-04 | Bitrix24 | Cria tarefas para a TI | Título, descrição e responsável |

### INT-03 — Coleta de dados externos

- A coleta segue a parametrização de cada dado ativo: diária ou no dia do mês configurado.
- Os valores são guardados por referência (filial, colaborador ou zona de venda) e por mês, para depois serem juntados conforme o período do dashboard (RN-05).
- Dados desativados deixam de ser coletados.
- Sistemas de origem previstos: Senior ERP (Sapiens), Senior HCM, Bitrix24 e outros informados no cadastro.

### INT-04 — Bitrix24

O responsável de todas as tarefas é a Equipe de TI. Nesta versão não há sincronização de status com o Bitrix24: o Admin registra a conclusão no PED (RF-28, RF-55 e RF-56), e o número da tarefa aparece junto ao dado externo ou ao dashboard.

| Tarefa | Quando é criada | Título | Conteúdo da descrição |
| --- | --- | --- | --- |
| Construção de dado externo | Cadastro de dado externo pelo Validador ou Preenchedor (RF-27) | "\[PED\] Construir dado externo: \<nome>" | Sistema de origem (e comentário), campo ou cálculo, referência, coleta, janela retroativa (usando só os meses disponíveis da referência), tipo de valor, tipo de apontamento, autor e data, observação |
| Construção de dashboard | Cadastro de dashboard (RF-55) | "\[PED\] Construir dashboard: \<nome>" | Periodicidade, pontuação base máxima, vínculo, unidades de imagem, indicadores com pontos base, indicador base da faixa, fórmula de pontuação, solicitante, observação |
| Modificação de dashboard | Edição com "Enviar tarefa à TI" marcado (RF-56) | "\[PED\] Modificar dashboard: \<nome>" | Lista das alterações (ou aviso de que não houve alteração de cadastro), unidades de imagem, indicador base da faixa, fórmula de pontuação, solicitante, observação |

Um dashboard acumula várias tarefas (construção e depois cada modificação), e todas ficam no histórico.

## 7. Regras de negócio e cálculos

O PED calcula o resultado de cada indicador e o PED (%) de cada imagem; a pontuação final sobre a tabela de faixas segue a fórmula informada no cadastro do dashboard e construída pela TI (RF-54).

### Cálculo do indicador

- **RN-01 — Realizado.** Composto por dado externo: é o valor do dado. Composto por apontamentos: é a soma ou a média (conforme o cadastro) dos valores dos apontamentos ativos. Booleanos contam 1 para "Sim" e 0 para "Não".
- **RN-02 — Atingimento.** Para "Maior é melhor":

```latex
\text{Atingimento (\%)} = \frac{\text{Realizado}}{\text{Meta}} \times 100
```

Para "Menor é melhor (custo)", com realizado igual a zero valendo 100%:

```latex
\text{Atingimento (\%)} = \frac{\text{Meta}}{\text{Realizado}} \times 100
```

- **RN-03 — Pontos realizados.** O atingimento não tem teto, mas os pontos ficam limitados aos pontos base:

```latex
\text{Pontos realizados} = \min\left(\text{Pontos base},\ \text{Pontos base} \times \frac{\text{Atingimento}}{100}\right)
```

- **RN-04 — PED (%).** É a soma dos pontos realizados de todos os indicadores ativos do dashboard.
- **RN-05 — Dados externos.** O realizado de um dado externo segue o sentido do cálculo e a janela retroativa:
  - soma ou média dos valores dos meses da janela;
  - "último valor": usa só a coleta mais recente do período, sem janela retroativa;
  - quando a referência não tem todo o histórico (por exemplo, colaborador com 5 meses num dado de 12), usa só os meses disponíveis: a média divide pelos meses existentes e a soma considera só esses meses.

  Os valores são guardados por mês; em dashboards com mais de um mês, o realizado junta os meses do período (P-08).
- **RN-06 — Períodos com mais de um mês.** Em dashboards bimestrais, trimestrais, semestrais e anuais:
  - o valor de cada apontamento é a média dos meses lançados do período;
  - booleanos valem "Sim" só se todos os meses forem "Sim";
  - a meta é a média das metas vigentes de cada mês.
- **RN-07 — Meta vigente.** É o ajuste feito para a filial e o mês (RF-73), quando o indicador permite; senão, a meta do cadastro.
- **RN-08 — Componentes inativos.** Apontamentos e dados externos inativos ficam fora do cálculo. Indicador inativo não pontua; seus pontos base ficam sem pontuação.
- **RN-09 — Lançamento pendente.** Um apontamento sem lançamento no encerramento entra na imagem sem valor.
- **RN-10 — Arredondamento.** Metas, realizados, atingimentos e pontos são arredondados para 2 casas decimais.

### Integridade dos cadastros

- **RN-11:** um item vinculado a dashboard (indicador, ou apontamento e dado externo de um indicador vinculado) não pode ser excluído, só desativado. Indicador que já esteve vinculado a algum dashboard também não pode ser excluído, mesmo depois de desvinculado.
- **RN-12:** apontamento e dado externo não podem ser excluídos se compõem ou já compuseram algum indicador.
- **RN-13:** tipo não pode ser excluído enquanto tiver apontamentos; os 7 tipos fixos nunca podem.
- **RN-14:** existe no máximo uma tabela de faixas por dashboard e filial; alterações geram versões, nunca sobrescrevem.
- **RN-15:** a pontuação base máxima do dashboard não muda depois do cadastro, e a soma dos pontos base deve ser igual a ela.
- **RN-16:** a periodicidade define os períodos: mensal (MM/AAAA), bimestral, trimestral e semestral ("Nº bim/tri/sem/AAAA") e anual (AAAA). O período atual é o que contém a data de hoje.
- **RN-17:** dashboard inativo, em construção ou em modificação não aparece no Início nem nos Fechamentos e não pode ser encerrado.
- **RN-18:** imagens congeladas nunca são alteradas nem excluídas, mesmo quando o dashboard, o indicador ou a tabela de faixas são excluídos.

## 8. Requisitos não funcionais

Os RNFs abaixo vêm do protótipo; stack, infraestrutura, desempenho, disponibilidade, backup e LGPD ainda não foram definidos e estão na seção 9.

- **RNF-01 — Auditoria.** Toda inclusão, ativação, desativação, correção, alteração de meta, nova versão de faixas, edição de dashboard, abertura de período e encerramento registra usuário e data/hora. Os históricos não podem ser editados nem apagados pela interface.
- **RNF-02 — Imutabilidade das imagens.** Imagens congeladas guardam uma cópia dos valores, metas e faixas usados no encerramento e não dependem dos cadastros atuais.
- **RNF-03 — Formatos pt-BR.** Datas em dd/mm/aaaa hh:mm, números com vírgula decimal e ponto de milhar e valores monetários em reais. Campos numéricos aceitam vírgula como separador decimal.
- **RNF-04 — Responsividade.** O layout se adapta a telas menores; tabelas largas rolam horizontalmente dentro do próprio quadro.
- **RNF-05 — Acessibilidade.** Requisitos:
  - campos com rótulo associado;
  - botões de ícone com nome acessível;
  - foco visível;
  - janelas como diálogos modais;
  - seletores com papel de lista;
  - avisos de erro e de status anunciados.
- **RNF-06 — Identidade visual.** Padrão da Comercial Mariano: azul institucional, fonte Ubuntu e rodapé "Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano".
- **RNF-07 — Ações destrutivas.** Exclusões, desativações, abertura de período e encerramento pedem confirmação com o impacto descrito. Quando a ação é bloqueada por regra, a janela explica o motivo e oferece só "Entendi".
- **RNF-08 — Retorno ao usuário.** Erros de validação aparecem junto ao formulário ou à linha afetada. Ações concluídas mostram uma notificação temporária (cerca de 3 segundos).
- **RNF-09 — Busca.** As buscas ignoram maiúsculas e acentos.

## 9. Fora do escopo, divergências e pendências

### Fora do escopo

- Aba Aprovações e o fluxo de aprovar ou reprovar solicitações.
- Aba Usuários: usuários, perfis, tipos e filiais vêm da API de autenticação.
- Botão "Trocar usuário" (simulação de acesso do protótipo).
- Encerramento automático de períodos.
- Consulta de Resultados pelo usuário final (sistema separado).

### Divergências em relação ao protótipo

| Tema | Protótipo | Requisito |
| --- | --- | --- |
| Aba Tipos | Oculta para todos os perfis | Entra no escopo; o grupo do usuário define seus tipos |
| Usuários | Cadastro local com perfil, tipos e filiais | Vêm da API de autenticação; aba removida |
| Colaboradores, cargos e filiais | Listas fixas | Vêm da API de cadastros |
| Dado de zona ou colaborador em dashboard por filial | Permitido | Proibido |
| Base da faixa | Fixa no dado "Resultado operacional (EBITDA − ISV)" | Indicador obrigatório, informado no cadastro e enviado à TI |
| Fórmula de pontuação | Fixa no código | Informada no cadastro do dashboard e enviada à TI |
| Tarefas Bitrix | Número sequencial local; conclusão manual | Criadas no Bitrix24, sem sincronização de status; conclusão manual pelo Admin |
| Ativar/desativar apontamento | Admin só os vinculados a dashboard; Validador todos | Admin e Validador, qualquer apontamento |
| Ativar/desativar dado externo | Só Admin e só os vinculados a dashboard | Admin e Validador, qualquer dado externo |
| Indicadores e Faixas | Só Admin | Admin e Validador |
| Indicador | Sem edição; exclusão só do não vinculado; inativação só do vinculado | Sem edição; inativação de qualquer indicador; exclusão física só se nunca vinculado a dashboard |
| Cadastro de dashboard | Só Admin | Admin e Validador |
| Dia da coleta de dado externo | De 1 a 28 | De 1 a 31 |
| Exclusão de apontamento e dado externo | Bloqueada enquanto compõe algum indicador | Bloqueada se já compôs algum indicador, mesmo que não componha mais |

### Pendências

- [ ] **P-01 — Retorno da API de autenticação.** A API devolve perfil + tipo, ou perfil + grupo (e o tipo sai do vínculo grupo → tipo da aba Tipos)? Também falta confirmar se "nenhuma filial de acesso" significa acesso a todas, como no protótipo.
- [x] **P-02 — Aba Tipos.** Resolvida: só Admin e Validador acessam a aba, e os grupos vêm da API de cadastros (INT-02).
- [x] **P-03 — Admin e dados externos.** Resolvida: o Admin pode ativar e desativar qualquer dado externo.
- [x] **P-04 — Validador em Indicadores e Faixas.** Resolvida: o Validador tem acesso a todas as ações das abas Indicadores e Faixas.
- [x] **P-05 — Exclusão e inativação de indicador.** Resolvida: qualquer indicador pode ser inativado; a exclusão é física e só vale para indicador nunca vinculado a nenhum dashboard (RF-37).
- [x] **P-06 — Conclusão sincronizada com o Bitrix24.** Resolvida: nesta versão não há sincronização com o Bitrix24; o Admin registra a conclusão no PED.
- [x] **P-07 — Imagens por colaborador.** Resolvida na versão 2.0: a imagem do colaborador usa os lançamentos, as metas e a tabela de faixas da filial dele, e os dados externos de referência Colaborador usam os valores do próprio colaborador (RF-82).
- [ ] **P-08 — Dados externos em dashboards não mensais.** Definido: os dados são guardados por mês e depois juntados conforme a necessidade. Falta definir como os meses são juntados (pelo sentido do cálculo do dado — soma, média ou último valor — ou de outra forma) e como isso se combina com a janela retroativa.
- [x] **P-09 — Reabertura de mês.** Resolvida: só o Admin pode reabrir um mês passado.
- [x] **P-10 — Campo da fórmula de pontuação.** Resolvida: texto livre.
- [ ] **P-11 — Stack e infraestrutura.** Linguagem, frameworks, banco de dados e hospedagem.
- [ ] **P-12 — Desempenho e disponibilidade.** Tempos de resposta, volume esperado e janela de disponibilidade.
- [ ] **P-13 — Backup.** Frequência, retenção e restauração.
- [ ] **P-14 — LGPD e segurança.** Definido: o sistema guarda log de modificações (RNF-01). Faltam o tratamento dos dados de colaboradores, a guarda das credenciais das integrações e o registro de acessos.
- [x] **P-15 — Meta vinda de sistema terceiro.** Resolvida: a meta é sempre inserida manualmente no sistema.
- [x] **P-16 — Dado de zona ou colaborador em dashboard por filial.** Resolvida na versão 2.0: a regra RF-53 continua valendo. Dashboard por filiais não aceita dado externo de zona de venda ou de colaborador, mesmo gerando uma imagem por colaborador.
