# Documentação — PED

## Índice

| Data | Tags | Resumo |
| --- | --- | --- |
| [04/11/2026](#2026-11-04) | #apontamentos #dados-externos #tipos #cadastro #api #validacao #componente #layout #refatoracao #correcao #testes #configuracao #documentacao | Aba Apontamentos (F4) revisada e commitada, aba Dados Externos (F5) implementada, hooks genéricos, MenuAcoes, correção do POST e testes mais rápidos |

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
