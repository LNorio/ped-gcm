# PED — Verificação das pendências contra o Swagger do back-end

Verificação de 24/11/2026. Compara as pendências enviadas em [`PENDENCIAS-backend-2026-11-24.md`](PENDENCIAS-backend-2026-11-24.md) com o contrato publicado pelo back-end em `http://192.168.7.18:8080/api-docs/ped.yaml` (OpenAPI 3.0.3, `info.version` **"2026-11-23"**, 6.668 linhas). Também compara esse contrato com o código do front (`src/services/*.ts`, `src/types/dominio.ts`), com o `API (31).md` (19/11) e com os exemplos reais de `docs/backend/exemplos-reais/`. O Swagger é de 23/11, um dia antes do documento de pendências, então era esperado que muitos itens não estivessem atendidos. Os números de linha citados são do `ped.yaml` baixado. Quando a documentação e o JSON real divergem, vale o JSON real.

## Revisão de 25/11/2026: Swagger de desenvolvimento

A verificação foi refeita com o Swagger de **desenvolvimento**, `http://192.168.1.244:8081/ped.yaml`, versão **"2026-11-25"**. Os links dos dois ambientes estão em `docs/backend/.env`.

**Resultado: nada muda nesta verificação.** O contrato de desenvolvimento tem as mesmas 6.668 linhas e as mesmas rotas do de produção. Por isso, os números de linha citados abaixo valem para os dois. Ele difere em só dois pontos:

- `info.version`: de "2026-11-23" para "2026-11-25";
- descrição do parâmetro `busca` (`FiltroImagemBusca`, l. 5482): passou a dizer que a busca considera "a filial (código e nome)" e "o colaborador (nome e cargo)", com os valores congelados no encerramento. Isso **resolve a divergência D8**, que era só de documentação.

Os demais itens seguem com o mesmo status, inclusive os que ainda não foram atendidos:

- A-08: a fórmula de pontuação continua como texto livre;
- A-11: zona nos vínculos e coleta por colaborador e zona;
- F12.5: id do Bitrix no acesso.

Também continuam abertas as duas divergências que podem quebrar o front:

- D1: `"dados cadastrados"` nos identificadores;
- D2: `versao`/`motivo` nulos no histórico de faixas.

Como o Swagger de desenvolvimento é de 25/11, o documento de pendências de 24/11 provavelmente ainda não foi tratado pelo back-end.

## Status das pendências

### Itens técnicos

| # | Item | Status | Evidência principal |
| --- | --- | --- | --- |
| 1 | A-20 — tipos no acesso do Admin e do Validador | **Atendido em parte** | `GET /ped/acesso` agora restringe os tipos só para o Preenchedor (l. 115), e o `POST` de apontamento e de dado externo só barra o Preenchedor (l. 1302, l. 1931). Falta confirmar no JSON real que o Admin e o Validador recebem todos os tipos. A opção B não foi adotada. |
| 2 | F6.14\* — executor da meta via API | **Não dá para saber pelo Swagger** | Os estados `ok`, `erro` e `aguardando_consulta` estão documentados (l. 6141, l. 3121). O exemplo ainda traz `meta via api.integracao: false` (l. 2780). `PED_EXECUTOR_ATIVO` é configuração do servidor. |
| 3 | Composição do DRG desligada | **Não dá para saber pelo Swagger** (configuração). Pergunta 3: **atendida em parte** | O comportamento sem DRG é o mesmo (l. 4782). Novidade: na prévia, `resumo.avisos` traz o aviso do DRG **uma vez** (l. 6450), mas ele **continua** em cada imagem. |
| 4 | Formato real de `GET /ped/imagens` | **Atendido** (na documentação), com formato diferente do sugerido | A lista vem pura (l. 5091). `filial` e `colaborador` continuam em texto (l. 5108, l. 5116), e o bloco novo `unidade` traz `filial {codigo, nome}` e `colaborador {id, nome, cargo}` (l. 5119–5148). `pontuacao` é número ou `null` (l. 5156). A `busca` considera o cargo e o nome da filial (l. 5076). Ainda não há exemplo real com itens. |
| 5 | A-08 — pontuação pela fórmula do cadastro | **Não atendido** | A fórmula continua "texto livre, só guardada e enviada à TI (o cálculo real é feito pelo sistema)" (l. 3619, l. 6336–6339). O bloco `pontuacao` não tem `formula` (l. 6600–6650). |
| 6 | A-11 — colaborador ↔ zona e coleta | **Não atendido** | `tipo=colaboradores` devolve `id colaborador`, `nome`, `cargo` e `filial`, sem zona (l. 3475). Não existe `tipo=zonas` (enum na l. 3486). A coleta continua só para a referência `filial` (l. 1936, l. 5989). |
| 7 | A-22 — tipo de valor nas últimas alterações | **Atendido** (na documentação) | `ultimas alteracoes[].tipo de valor` aparece no schema (l. 448–451) e no exemplo (l. 500). |
| 8 | F12.5 — link e status da tarefa no Bitrix24 | **Não atendido** | `TarefaBitrixRef` tem só `id`, `status` e `titulo` (l. 5854–5866), e `Tarefa` tem `titulo`, `descricao`, `status` e `id bitrix` (l. 5828–5842). Não existem `link` nem `status bitrix`, e `GET /ped/acesso` não traz `id bitrix` (l. 5746–5771). |
| 9 | Progresso por filial na prévia | **Atendido** (na documentação) | `ResumoFechamento."progresso por filial"`, com `filial`, `nome filial`, `preenchidos` e `total`, só na prévia (l. 6453–6466, exemplo na l. 4823). **Ainda não aparece no JSON real** de 24/11. |

### Decisões do negócio

| # | Item | Status | Evidência |
| --- | --- | --- | --- |
| D-1 | P-01 — usuário sem filial | **Não atendido** (a regra da API segue a mesma) | "Quem não tem filial nem abrangência não vê nada (listas vazias) ou recebe `403` `"usuario sem filial definida"`" (l. 55). A decisão é do negócio. |
| D-2 | P-08 — dado externo em dashboard não mensal | **Não dá para saber pelo Swagger** | O Swagger não descreve a regra. O JSON real da prévia mostra a observação "valor da data atual" nos indicadores de dado externo. |
| D-3 | P-12 — desempenho e volume | **Não dá para saber pelo Swagger** | Só os limites por minuto: PDF 20, prévia 60, ZIP 5 e alertas 30 (l. 64). Não há metas de tempo nem de volume. |
| D-4 | P-14 — LGPD e sessão | **Atendido em parte** | O token vale **12 horas** a partir do login e **não é renovado pelo uso** (l. 23). O Swagger não tem rota de logout nem registro de acessos. |
| D-5 | Imagem por filial (A-07) | **Não atendido** (a regra segue a mesma) | "Cada filial gera uma imagem; cada colaborador do cargo, uma; cada colaborador escolhido, uma" (l. 3616). A decisão é do negócio. |

## Evidência por item

### 1. A-20 — tipos no acesso

- `GET /ped/acesso`, l. 115: "admin e validador recebem `"todas as filiais": true` [...] **O preenchedor recebe só os tipos vinculados a ele** (diretamente ou pelos grupos dele)." O `API (31).md` não fazia essa distinção. A frase indica que o Admin e o Validador recebem todos os tipos, mas não diz isso de forma explícita, e o exemplo (l. 121–133) é de um Preenchedor.
- `GET /ped/tipos-apontamento`, l. 1002, diz explicitamente "admin e validador veem todos".
- Pergunta 2 respondida: o `POST /ped/apontamentos` (l. 1302) e o `POST /ped/dados-externos-cadastro` (l. 1931) só recusam com `403` o **Preenchedor** em tipo sem acesso. O Admin e o Validador podem cadastrar em qualquer tipo.
- Pergunta 3: o `POST /ped/tipos-apontamento` devolve só `{ mensagem, id }` (l. 1095–1108). A opção B (`"tipos do usuario"`) não foi adotada, e a opção A, já implementada, continua valendo.
- Pergunta 4 continua sem resposta.
- **Para fechar:** um JSON real de `GET /ped/acesso` de um Admin sem vínculo com o tipo "Departamento Pessoal" (id 8). Se o tipo vier, a F2.11\* pode ser validada sem mudar o front.

### 2. F6.14\* — executor

- `IndicadorCadastro."situacao da meta via api"`: `[ok, sem_meta_no_mes, integracao_pendente, aguardando_consulta, erro, null]` (l. 6141). O front já trata os cinco valores (`SITUACOES_META_VIA_API`, `dominio.ts:135`).
- `PUT /ped/indicadores-cadastro/{id}/integracao`, l. 3121: "Depois de salvar, a situação da meta passa a `aguardando_consulta` até o executor consultar a fonte."
- `GET /ped/indicadores-cadastro`, l. 2688 e l. 2780: `meta via api.integracao: false` = "a consulta da fonte própria ainda não roda sozinha".
- O Swagger não diz se `PED_EXECUTOR_ATIVO` está ligado nem se existe uma fonte SOAP real. As três perguntas do item seguem em aberto.

### 3. Composição do DRG

- Prévia, l. 4782: com o DRG indisponível, `composicao do resultado` vem `null` e um aviso é acrescentado em `avisos`.
- `ResumoFechamento.avisos`, l. 6450: "Na prévia, com o DRG desligado, traz uma **entrada única**: "Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada." (**o aviso por imagem continua** em `imagens[].avisos`)."
- O pedido era o aviso uma vez **em vez de** em cada imagem. O back-end acrescentou o aviso único, mas manteve o de cada imagem. Para o front mostrar o aviso uma vez, ainda precisa filtrar os avisos de cada imagem pelo texto da mensagem.
- **JSON real** (`previa.json`, recebido em 24/11): `resumo.avisos` é `[]`, e cada imagem traz o aviso do DRG. Ou seja, o servidor que gerou o exemplo ainda não tinha esse comportamento.
- Perguntas 1 (previsão do DRG) e 2 (encerrar sem composição) continuam sem resposta.

### 4. Formato de `GET /ped/imagens`

- A resposta é uma lista pura (`type: array`, l. 5091). Responde à pergunta 2.
- Linha, l. 5094–5158: `id`, `codigo`, `lote`, `dashboard` (texto), `periodo` (texto), `filial` (**texto**, código), `tipo`, `id colaborador`, `colaborador` (**texto**), `unidade` (objeto), `gerado em`, `usuario`, `ped percentual` e `pontuacao` (**número**, `nullable`). Responde à pergunta 4.
- `unidade`, l. 5119–5148, "mesmo formato de `GET /ped/imagens/{id}`": `tipo`, `filial { codigo, nome }`, `colaborador { id, nome, cargo }` ou `null`. Em imagem antiga, sem o bloco, `filial.nome` e `colaborador` vêm nulos (l. 5121). Responde às perguntas 1 e 3: o cargo e o nome da filial vêm em `unidade`, não na raiz.
- `busca`, l. 5076: "considera também o cargo do colaborador e o nome da filial congelados no encerramento". A descrição do parâmetro `FiltroImagemBusca` (l. 5482) não cita o cargo. É uma inconsistência só da documentação.
- Ainda não há exemplo real com itens: `imagens.json` continua `[]`.
- **Impacto no front:** veja a divergência D3 abaixo. O front lê `filial` e `colaborador` da raiz, mas não lê `unidade`, então o nome da filial e o cargo ficam em branco.

### 5. A-08 — fórmula de pontuação

- `POST /ped/dashboards`, l. 3619: "A fórmula é texto livre, só guardada e enviada à TI (o cálculo real é feito pelo sistema)." `DashboardCorpo."formula de pontuacao"`, l. 6336–6339: "Texto livre, só guardado e enviado à TI".
- `ImagemConteudo.pontuacao`, l. 6600–6650: `calculada`, `motivo`, `valor`, `faixas` e os passos das 4 etapas (`faixa atual` … `base de calculo`). Não tem `formula`.
- Esperado: a decisão do negócio é de 24/11, depois do Swagger. As três perguntas seguem em aberto.

### 6. A-11 — zona de venda

- `GET /ped/vinculos`, l. 3475: `tipo=colaboradores` devolve `id colaborador`, `nome`, `cargo` e `filial`, sem zona. O `enum` de `tipo` é `[filiais, cargos, colaboradores]` (l. 3486), sem `zonas`.
- `POST /ped/dados-externos-cadastro`, l. 1936: "Hoje só `filial` tem coleta; nas outras o realizado vem sem valor (`coleta disponivel: false`)". `DadoExternoCadastro."coleta disponivel"`, l. 5989: "a referência é `filial`".
- Detalhe de documentação: o schema de `GET /ped/vinculos` (l. 3497–3510) não lista `filial` para os colaboradores. Ela aparece só na descrição e no exemplo.

### 7. A-22 — tipo de valor no Início

- `GET /ped/inicio`, `ultimas alteracoes[]."tipo de valor"`, l. 448–451: "Mesmo rótulo de `GET /ped/apontamentos`", com exemplo `Numeral` (l. 500).
- Não há JSON real do Início com o campo. Hoje o front ignora o campo (`inicioService.ts:164–185`).

### 8. F12.5 — Bitrix24

- `TarefaBitrixRef` (l. 5854–5866): `id`, `status` e `titulo`. Sem `link` e sem `status bitrix`.
- `Acesso` (l. 5746–5771): sem `id bitrix`.
- `GET /ped/dashboards/{id}/tarefas` (l. 4050): `status` local `aguardando_envio` → `enviada` → `concluida`. Não traz o status vindo do Bitrix.

### 9. Progresso por filial na prévia

- `ResumoFechamento."progresso por filial"` (l. 6453–6466): só na prévia, das unidades ainda não encerradas, ordenado pelo código, sem repetir filial e vazio quando não há unidade aberta. Cada item traz `filial`, `nome filial`, `preenchidos` e `total`. O front tinha sugerido sem `nome filial`; o campo a mais é bem-vindo.
- O **JSON real** de 24/11 não traz o campo (`resumo` só com as 4 contagens e `avisos`). Hoje o front ignora o campo (`fechamentosService.ts`, `paraResumo`).

## Divergências entre o Swagger e o front

Gravidade: **quebra o front** = a tela falha ou perde a função; **o front tolera** = funciona, mas ignora ou perde informação; **documentação diferente do JSON real** = o Swagger não bate com o exemplo real.

| # | Onde | Swagger | Front hoje | Gravidade |
| --- | --- | --- | --- | --- |
| D1 | `GET /ped/dados-externos-cadastro/identificadores` | Item `{ identificador, nome, unidade, ativo, "dados cadastrados" }` (l. 2079–2096). O `API (31).md` não dava o nome do campo. | `converterIdentificador` exige `quantidade` numérico (`src/services/dadosExternosService.ts:280–283`). Sem ele, a lista inteira é rejeitada como "Resposta inválida", e as telas seguem **sem sugestões, sem erro visível** (`src/pages/dados-externos/DadosExternosPage.tsx:209`, `src/pages/indicadores/useIntegracaoIndicador.ts:73`). | **Quebra o front** (as sugestões de identificador somem em silêncio). Confirmar com um JSON real. |
| D2 | `GET /ped/faixas/{id}/historico` | `versao` e `motivo` são `nullable` (l. 4579–4585), e há `acao: exclusao` (l. 4578). | `converterVersao` exige `versao` numérico e `motivo` texto (`src/services/faixasService.ts:271–281`). Um único `null` rejeita o histórico inteiro. Pelo `API (31).md`, `versao` sempre vem (a vigente) e o motivo é sempre gravado. | **Quebra o front se vier `null`** (histórico de faixas, F8). Confirmar quando os dois campos vêm nulos. |
| D3 | Linha de `GET /ped/imagens` | `filial` e `colaborador` em texto, mais `unidade { filial { codigo, nome }, colaborador { id, nome, cargo } }` (l. 5108–5148). | `paraImagemDaConsulta` lê `filial` e `colaborador` da raiz (texto, OK), mas não lê `unidade` (`src/services/imagensService.ts:359–385`). O nome da filial e o **cargo** ficam `null`. | **O front tolera** (a consulta funciona, mas a coluna e a busca por cargo do RF-84 ficam sem dado). |
| D4 | Prévia: `resumo.avisos` e `resumo."progresso por filial"` | Aviso do DRG uma vez no resumo (l. 6450) e progresso por filial (l. 6453). | `paraResumo` lê `avisos`, mas a prévia não mostra `resumo.avisos`, e `progresso por filial` é ignorado (`src/services/fechamentosService.ts`, `src/pages/fechamentos/DialogoPreviaFechamento.tsx`). | **O front tolera.** |
| D5 | Prévia: `resumo` | Com o DRG desligado, `avisos` tem uma entrada, e há `progresso por filial` (l. 4817–4847, l. 6450–6466). | JSON real `previa.json` (24/11): `"avisos": []` e sem `progresso por filial`. | **Documentação diferente do JSON real** (o servidor provavelmente ainda não tem a versão do Swagger). |
| D6 | `GET /ped/inicio`, escopo da `filial` | Admin **e Validador** escolhem a filial. Os demais podem pedir uma filial da abrangência, e fora dela recebem `403` (l. 347). | O `API (31).md` dizia que só o Admin escolhe e que, para os outros, o parâmetro é ignorado. O comentário de `src/services/inicioService.ts:7–8` repete isso. O front manda a filial do cabeçalho quando há uma. | **O front tolera** (o Validador passa a ver o Início filtrado). Um `403` só aconteceria se o cabeçalho mandasse uma filial fora do escopo. |
| D7 | `GET /ped/inicio`, `ultimas alteracoes[]."tipo de valor"` | Campo novo (l. 448). | Ignorado (`src/services/inicioService.ts:164–185`). | **O front tolera** (a porcentagem continua sem "%"). |
| D8 | `FiltroImagemBusca` | Descrição sem o cargo (l. 5482), enquanto a rota diz que a busca considera o cargo (l. 5076). | Sem impacto. | Só documentação (inconsistência interna). **Resolvida no Swagger de desenvolvimento de 25/11.** |
| D9 | `GET /ped/vinculos?tipo=colaboradores` | `filial` só na descrição e no exemplo; falta nas `properties` (l. 3497–3510). | O front aceita `filial` opcional (`src/services/dashboardsService.ts:529–542`). | Só documentação. |

### Pontos conferidos e compatíveis

- **Rotas:** todas as rotas que o front chama existem no Swagger, com o mesmo método. `POST /valida-usuario` é da API de Premiações (l. 21) e não aparece no `ped.yaml`, o que é esperado.
- **Prévia e detalhe da imagem** (`ImagemConteudo`, l. 6468–6657): `unidade.filial = { codigo, nome }` (l. 6496–6502), `unidade.colaborador = { id, nome, cargo }` (l. 6503–6513) e `pontuacao.faixas = { versao, linhas }` (l. 6612). Batem com `previa.json` e com o que o front lê desde a F10.18\*.
- **`GET /ped/alertas-menu`** (l. 515–582): `{ abas: { <aba>: { total, itens: [{ codigo, quantidade, descricao }] } } }`, sem parâmetros, com as abas por perfil e o `429`. Compatível com `alertasMenuService.ts`.
- **Envelopes de lista:** `GET /ped/apontamentos` → `{ apontamentos, ... }` e `GET /ped/indicadores-cadastro` → `{ indicadores, alertas, "meta via api" }` (objetos). Dados externos, dashboards, faixas, fechamentos, imagens, tipos e vínculos vêm como listas puras. O front aceita os dois formatos onde precisa.
- **Erros** (l. 5486–5714): `{ mensagem }` (mais `message` nos erros do Laravel), `400` com `erros` na integração e nas metas por filial, `conflitos` nas faixas, e `429` com `"segundos para tentar novamente"` e `Retry-After`. É o que `api.ts` já trata (l. 141, l. 154–169).
- **Meta via API:** os enums de `fonte da meta` e `situacao da meta via api` batem com `dominio.ts`.
- **Lista de fechamentos** (l. 4741–4748): `indicadores com problema` e `unidades sem tabela de faixas` como `integer`, como no JSON real.

## Novidades do Swagger

| Novidade | Onde | Vale uma atividade no front? |
| --- | --- | --- |
| `unidade` na linha de `GET /ped/imagens` (nome da filial e cargo) e busca por cargo | l. 5076, l. 5119–5148 | **Sim.** Ler `unidade` em `paraImagemDaConsulta` para preencher o nome da filial e o cargo (RF-84). Resolve D3. |
| `resumo."progresso por filial"` na prévia | l. 6453–6466 | **Sim.** Mostrar o progresso da filial escolhida na prévia (RF-80). Depende de o servidor passar a enviar o campo (D5). |
| Aviso do DRG uma vez em `resumo.avisos` da prévia | l. 6450 | **Sim.** Mostrar `resumo.avisos` uma vez na prévia e não repetir o aviso do DRG em cada imagem. Como o back-end manteve o aviso por imagem, o filtro depende do texto. |
| `tipo de valor` em `ultimas alteracoes` do Início | l. 448–451 | **Sim.** Liberar a F12.12\* (formatar porcentagem com "%"). |
| Início com escolha de filial também para o Validador | l. 347 | Pequena: revisar se o seletor de filial do Validador deve alimentar o Início e atualizar o comentário de `inicioService.ts`. |
| Token de 12 horas, sem renovação pelo uso | l. 23 | Opcional: avisar a expiração ou registrar a regra na D-4. |
| `situacao da meta via api = aguardando_consulta` depois de salvar a integração | l. 3121 | Não. O front já trata. |
| `premiacoes.yaml` | `docs/backend/.env` | Existe outro contrato, o da API de Premiações. Não foi analisado aqui. |
| Rotas existentes que o front não usa: `/ped/usuarios`, `/ped/usuarios/{id}/acesso`, `/ped/indicadores`, `/ped/filiais`, `/ped/dados-externos`, `/ped/sincronizar-erp`, `/ped/integracao/variaveis-saida` | l. 192, 270, 583, 624, 661, 806, 2506 | Não são novas: já estavam no `API (31).md`. |
| **Não aparecem:** zona nos vínculos, `id bitrix` no acesso, `link` e `status bitrix` na tarefa, `formula` na pontuação | — | Nada a fazer até o back-end publicar. |

## Perguntas que restam para o back-end

1. **Identificadores (D1):** `GET /api/ped/dados-externos-cadastro/identificadores` devolve `"dados cadastrados"` (como no Swagger) ou `quantidade`? Podem enviar um JSON real? Hoje o front espera `quantidade` e, se o campo não vier, deixa de mostrar as sugestões.
2. **Histórico de faixas (D2):** em que casos `versao` e `motivo` vêm `null` em `GET /api/ped/faixas/{id}/historico`? Por exemplo, na `exclusao` ou em eventos antigos.
3. **Versão no ar:** o servidor que o front usa já está na versão do Swagger de 23/11? O `previa.json` de 24/11 veio sem `progresso por filial` e com `resumo.avisos` vazio, mesmo com o DRG desligado.
4. **A-20:** confirmam que `GET /api/ped/acesso` devolve **todos** os tipos ativos para o Admin e o Validador? Podem enviar um JSON real de um Admin sem vínculo com o tipo id 8? Para o Preenchedor vinculado a um tipo novo por outro usuário, basta reler o acesso ao abrir o cadastro?
5. **DRG:** há previsão para configurar o DRG? Enquanto ele estiver desligado, o negócio deve evitar encerrar períodos? Podem tirar o aviso do DRG de `imagens[].avisos` agora que ele vem em `resumo.avisos`?
6. **Executor:** `PED_EXECUTOR_ATIVO` está ligado no ambiente de validação? Há uma fonte SOAP real cadastrada? Existem integrações salvas no formato antigo?
7. **Imagens:** podem enviar um exemplo real de `GET /api/ped/imagens` com uma imagem de filial e uma de colaborador? O texto de `colaborador` na raiz é o nome?
8. **A-08:** qual é a sintaxe da fórmula? A validação acontece ao salvar (`422`/`400`) e no cálculo (`calculada: false`)? Qual é a previsão? O bloco `pontuacao` vai ganhar `formula`?
9. **A-11:** qual é a previsão da coleta por Colaborador e por Zona de venda? De onde vem a zona do colaborador?
10. **F12.5:** preferem a opção A (`id bitrix` no acesso) ou a B (`link` pronto na tarefa)? Qual é a previsão para agendar `ped:sincronizar-status-bitrix` e devolver `status bitrix`?
11. **D-4:** além do token de 12 horas, haverá rota de logout e registro de acessos?
12. **Decisões do negócio D-1, D-2, D-3 e D-5:** o Swagger mantém as regras atuais (sem filial = nada; uma imagem por filial). Falta a decisão do negócio.
