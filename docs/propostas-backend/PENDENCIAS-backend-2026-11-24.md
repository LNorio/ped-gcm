# PED — Pendências do front que dependem do back-end

Levantamento do front de 24/11/2026. Reúne o que ainda bloqueia ou limita telas do front por falta de algo no back-end, para a equipe de back-end responder num lugar só. A base é o contrato `API (31).md` (19/11/2026), os guias `FRONT-*.md` e as propostas já trocadas em `docs/propostas-backend/`. O que já foi acertado não é repetido aqui, só listado em "Já resolvido".

Nenhuma rota existente precisa mudar de forma. Os pedidos são campos novos em rotas que já existem, configuração do servidor e confirmações de formato.

## Resumo

### Itens técnicos

| # | Item | O que falta do back-end | O que fica bloqueado no front | Prioridade sugerida |
| --- | --- | --- | --- | --- |
| 1 | A-20 — tipos no acesso do Admin e do Validador | `GET /api/ped/acesso` devolver em `tipos` todos os tipos ativos para Admin e Validador; responder as 3 perguntas da proposta | Admin ou Validador sem vínculo com um tipo novo não consegue cadastrar apontamento nem dado externo nele | Alta |
| 2 | F6.14\* — meta via API de ponta a ponta | Ligar `PED_EXECUTOR_ATIVO=true` no ambiente de validação (ou informar quando será ligado) | Validação contra o servidor real dos estados `ok`/`erro`, "Última consulta", `filiais sem meta` e meta no dashboard | Alta |
| 3 | Composição do DRG desligada | Configurar a fonte do DRG no servidor ou informar a previsão | Todas as imagens da prévia trazem o aviso "fonte de dados (DRG) nao configurada"; PDFs sem a tabela de composição; todo encerramento lista filiais sem composição | Alta |
| 4 | Formato real de `GET /api/ped/imagens` | Enviar um exemplo real com itens ou confirmar o formato; incluir cargo e nome da filial na linha | Consulta retroativa de imagens só testada com formato suposto; coluna e busca por cargo (RF-84) | Média |
| 5 | A-08 — pontuação pela fórmula do cadastro | Passar a calcular a pontuação pela `formula de pontuacao` do cadastro do dashboard, no lugar das 4 etapas fixas (decisão do negócio de 24/11/2026) | Nada na tela hoje; as imagens congeladas não seguem a fórmula cadastrada | Média |
| 6 | A-11 (parte restante) — colaborador ↔ zona de venda | Vínculo colaborador ↔ zona em `GET /api/ped/vinculos`; previsão de coleta para Colaborador e Zona de venda | Dados externos de Colaborador e Zona de venda ficam sem realizado (`"valor": null`) e não pontuam | Média |
| 7 | A-22 — tipo de valor nas últimas alterações do Início | Campo `tipo de valor` em cada item de `ultimas alteracoes` de `GET /api/ped/inicio` | F12.12\*: apontamentos de porcentagem aparecem sem "%" no Início | Baixa |
| 8 | F12.5 — link e status da tarefa no Bitrix24 | Id do usuário no Bitrix (ou o link pronto) e o `status_bitrix` nas respostas | Link "Abrir no Bitrix24" e situação real da tarefa em dados externos e dashboards | Baixa |
| 9 | Progresso por filial na prévia | Progresso de lançamentos por filial em `GET /api/ped/fechamentos/{id}/previa` | Progresso da filial escolhida na prévia (RF-80) | Baixa |

### Decisões do negócio

| # | Item | Quem decide | O que fica bloqueado no front |
| --- | --- | --- | --- |
| D-1 | P-01 — usuário sem nenhuma filial de acesso | Negócio; o back-end aplica a regra no acesso | F2.7 |
| D-2 | P-08 — realizado de dado externo em dashboards não mensais | Negócio, com atualização do documento de requisitos | F10.8 |
| D-3 | P-12 — metas de desempenho, volume e disponibilidade | Negócio, com os números do back-end e da infraestrutura | F12.3 |
| D-4 | P-14 — LGPD e segurança da sessão | Negócio e segurança da informação; o back-end define a expiração e o registro de acessos | F12.4 |
| D-5 | Imagens de dashboard vinculado a filiais (A-07) | Negócio | Revisão do resumo de imagens da F7.5, se a regra mudar |

---

## Pendências técnicas

### 1. A-20 — tipos no acesso do Admin e do Validador

**Contexto.** O campo Tipo do "Novo apontamento" e do "Novo dado externo" lista os `tipos` de `GET /api/ped/acesso`. Desde 18/11/2026 o front já relê o acesso depois de criar ou alterar um tipo e ao abrir os dois cadastros (opção A da [`PROPOSTA-tipos-no-acesso`](PROPOSTA-tipos-no-acesso.md), F2.11\*). Se a releitura falhar, o front mantém a lista anterior.

**O que falta do back-end.** O item 1 da proposta. Pelo `API (31).md`, `acesso.tipos` continua trazendo só os tipos vinculados ao usuário, diretamente ou por grupo, para todos os perfis. As listagens, por outro lado, mostram todos os tipos ao Admin e ao Validador.

**Formato sugerido.** Sem mudança de formato. Para Admin e Validador, `tipos` traz todos os tipos ativos, na mesma ordem da `contagem por tipo` (por nome):

```json
{
  "perfil": "admin",
  "tipos": [
    { "id": 1, "nome": "Comercial" },
    { "id": 7, "nome": "Contabilidade" },
    { "id": 8, "nome": "Departamento Pessoal" },
    { "id": 2, "nome": "Financeiro" }
  ]
}
```

O Preenchedor continua só com os tipos vinculados a ele ou a um grupo dele.

**Impacto no front.** Sem o item 1, o Admin ou o Validador que não está vinculado a um tipo novo (caso real: "Departamento Pessoal", id 8) não o vê no campo Tipo, mesmo depois da releitura e de um novo login. Ele não consegue cadastrar apontamento nem dado externo nesse tipo. Com o item 1, o front não precisa mudar.

**Perguntas.**

1. Vocês aceitam o item 1? Se sim, há previsão?
2. O Admin e o Validador podem cadastrar apontamento e dado externo em **qualquer** tipo, mesmo sem vínculo? O `POST` recusa tipo não vinculado?
3. O `GET /api/ped/acesso` aguenta a releitura a cada abertura de cadastro (opção A, já implementada)? Ou preferem a opção B (`"tipos do usuario"` na resposta de `POST`/`PUT /api/ped/tipos-apontamento`)?
4. Para o Preenchedor vinculado a um tipo novo por outro usuário, basta a releitura ao abrir o cadastro? Hoje o filtro da listagem não relê o acesso.

### 2. F6.14\* — validar de ponta a ponta a meta via API

**Contexto.** O front já foi adequado em 11/11/2026 à fase 1 e ao executor da fase 2 (`FRONT-meta-via-api-fase1.md`, `FRONT-meta-via-api-fase2.md`): `fonte da meta` (`dado_externo`/`integracao`), entrada SOAP com `operacao` e `parametros`, `situacao da meta via api` com `ok` e `erro`, `ultima consulta em`, `erro da ultima consulta` (Admin), `filiais sem meta` e o `400` do dashboard quando a fonte `integracao` não tem meta no mês aberto. Enquanto `meta via api.integracao` vier `false`, o front mostra "a consulta desta fonte ainda não está disponível".

**O que falta do back-end.** Pelo `API (31).md`, o executor (`php artisan ped:executar-integracoes`, às 02:30) só roda com `PED_EXECUTOR_ATIVO=true` e vem desligado por padrão. Sem ele ligado, os estados `ok`/`erro` e a lista de `filiais sem meta` nunca aparecem, e o front não consegue validar a tela com dados reais.

**Formato sugerido.** Nenhum formato novo. Basta o executor ligado e uma fonte SOAP real cadastrada.

**Impacto no front.** A F6.14\* é a única atividade pendente da fase de Indicadores. O cadastro e a validação da integração já podem ser testados; o resultado da consulta, não.

**Perguntas.**

1. O `PED_EXECUTOR_ATIVO` já está ligado no ambiente que o front usa para validar? Se não, quando será?
2. Há alguma fonte SOAP real (indicador na fonte `integracao`) cadastrada nesse ambiente para o teste? Se não, a TI pode cadastrar uma e rodar `--simular` antes?
3. Existem no ambiente integrações salvas no formato antigo (saída em lista)? Elas continuam funcionando no back-end, mas a modal do front só salva o formato novo, então precisariam ser reescritas pela TI antes de qualquer edição.

### 3. Composição do DRG desligada

**Contexto.** O front exibe os `avisos` de cada imagem da prévia e, depois do encerramento, o aviso de `resumo."filiais sem composicao"` (F10.12\*). No JSON real da prévia recebido em 24/11/2026 (`docs/backend/exemplos-reais/previa.json`), **todas** as imagens trazem `"composicao do resultado": null` e o aviso:

```text
Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada.
```

**O que falta do back-end.** Pelo `API (31).md` (seção "PDF do fechamento"), isso acontece com `DRG_DB_HOST` vazio ou quando a consulta ao DRG falha. Falta configurar a fonte do DRG no servidor.

**Formato sugerido.** Nenhum formato novo. Com o DRG ligado, a imagem passa a trazer `composicao do resultado` com os 12 meses (`fonte: "DRG"`), como já documentado.

**Impacto no front.**

- Todas as imagens da prévia mostram o mesmo aviso, o que esconde os avisos que pedem ação (lançamentos pendentes, unidade sem faixas).
- Os PDFs saem sem a tabela de composição.
- Todo encerramento feito agora congela as imagens sem a composição, e o aviso "Filiais encerradas sem a composição do Resultado Operacional (DRG)" aparece com todas as filiais. Essas imagens ficam assim para sempre (RN-18).

**Perguntas.**

1. Há previsão para configurar o DRG no servidor?
2. Enquanto o DRG não estiver configurado, o negócio deve evitar encerrar períodos? Ou é aceitável congelar imagens sem a composição?
3. O aviso de DRG desligado pode vir **uma vez** em `resumo.avisos` da prévia, em vez de em cada imagem? Assim o front mostra o aviso geral uma vez e deixa os avisos de cada imagem só para o que é da unidade. Se preferirem manter como está, o front pode filtrar, mas dependeria do texto da mensagem.

### 4. Formato real de `GET /api/ped/imagens` com itens

**Contexto.** Em 24/11/2026 o front ajustou a prévia ao formato real (`GET /api/ped/fechamentos/{id}/previa`, F10.18\*):

- `unidade.filial = { "codigo", "nome" }`;
- `unidade.colaborador = { "id", "nome", "cargo" }`;
- `pontuacao.faixas` (com `versao` e `linhas`).

Por consistência, a consulta retroativa (`GET /api/ped/imagens`) passou a aceitar os mesmos formatos, além dos antigos. Mas o único exemplo real que o front tem da consulta é uma lista vazia (`docs/backend/exemplos-reais/imagens.json` = `[]`). O `API (31).md` diz só que cada linha traz `id`, `codigo`, `lote`, `dashboard`, `periodo`, `filial`, `colaborador`, `gerado em`, `usuario`, `ped percentual` e `pontuacao`, sem o formato de `filial` e `colaborador`.

**O que falta do back-end.**

1. Um exemplo real da resposta com pelo menos uma imagem de filial e uma de colaborador, ou a confirmação do formato abaixo.
2. O **cargo** do colaborador e o **nome da filial** na linha. O RF-84 pede o cargo na consulta, e a busca por cargo depende dele.

**Formato sugerido.** O mesmo da prévia:

```json
[
  {
    "id": 41,
    "codigo": "IMG-000041",
    "lote": "ENC-000003",
    "tipo": "colaborador",
    "id colaborador": 250,
    "dashboard": "PED",
    "periodo": "10/2026",
    "filial": { "codigo": "403", "nome": "Filial 403" },
    "colaborador": { "id": 250, "nome": "Nome do colaborador", "cargo": "Gerente" },
    "gerado em": "2026-11-24 10:15:00-04:00",
    "usuario": "Nome do usuário",
    "ped percentual": 47.59,
    "pontuacao": 32682.19
  },
  {
    "id": 42,
    "codigo": "IMG-000042",
    "lote": "ENC-000003",
    "tipo": "filial",
    "id colaborador": null,
    "dashboard": "PED Filiais",
    "periodo": "10/2026",
    "filial": { "codigo": "101", "nome": "Filial 101" },
    "colaborador": null,
    "gerado em": "2026-11-24 10:15:00-04:00",
    "usuario": "Nome do usuário",
    "ped percentual": 88.1,
    "pontuacao": 12500
  }
]
```

Os valores do exemplo são ilustrativos.

**Impacto no front.** A consulta funciona com o formato suposto e com os antigos. Se o formato real for outro, a coluna Filial e o Colaborador podem sair em branco, como aconteceu na prévia antes da F10.18\*. A coluna e a busca por cargo esperam o campo.

**Perguntas.**

1. A linha de `GET /api/ped/imagens` usa o mesmo formato de `unidade` da prévia (`filial = { codigo, nome }`, `colaborador = { id, nome, cargo }`)? Se não, qual é?
2. A lista vem pura ou embrulhada (ex.: `{ "imagens": [...] }`)?
3. Podem incluir o cargo e o nome da filial na linha? A busca (`busca`) passaria a considerar o cargo?
4. `pontuacao` na linha é o número (`pontuacao.valor` da imagem) ou o objeto inteiro? E vem `null` quando a unidade ficou sem pontuação?

### 5. A-08 — pontuação pela fórmula do cadastro

**Contexto.** O dashboard tem o campo obrigatório "Fórmula de pontuação", em texto livre, que segue na tarefa da TI (RF-54). O documento de requisitos diz que "a pontuação final sobre a tabela de faixas segue a fórmula informada no cadastro do dashboard e construída pela TI". O front mostra a pontuação que vem pronta do back-end, na prévia e no PDF.

**O que falta do back-end.** O `API (31).md` calcula a pontuação em **quatro etapas fixas** (Resultado Operacional, faixa atingida, base de cálculo pelo maior entre A e B, base × PED ÷ 100) e diz que essa regra foi "definida pelo negócio" (P-10). A `formula de pontuacao` fica só como texto de referência. No JSON real da prévia, o dashboard tem `"formula de pontuacao": "teste"`, e a pontuação sai pelas 4 etapas. Ou seja: a fórmula do cadastro não tem efeito no cálculo.

**Pedido.** Decisão do negócio de 24/11/2026: o back-end deve **passar a calcular a pontuação pela `formula de pontuacao` enviada no cadastro do dashboard**, e não mais pelas 4 etapas fixas. Isso vale para a prévia do fechamento, para o encerramento e para o PDF das imagens congeladas. Imagens já congeladas não mudam (RN-18).

**Formato sugerido.** A imagem continua com o mesmo bloco `pontuacao`, para o front seguir funcionando sem mudança. Pedimos só que o bloco informe a fórmula aplicada e, quando ela não puder ser calculada, a pontuação venha como não calculada, com o motivo:

```json
"pontuacao": {
  "calculada": true,
  "motivo": null,
  "formula": "texto da fórmula do cadastro aplicada",
  "valor": 32682.19
}
```

```json
"pontuacao": {
  "calculada": false,
  "motivo": "Fórmula de pontuação inválida: <detalhe>",
  "formula": "texto da fórmula do cadastro",
  "valor": null
}
```

**Impacto no front.** Nenhuma tela fica bloqueada: o front já mostra a pontuação pronta e já trata `calculada: false` com o motivo. Se o back-end mantiver os passos intermediários (faixa atual, opções A e B, base de cálculo), eles continuam aparecendo; se a fórmula não usar esses passos, eles podem vir `null`.

**Perguntas.**

1. Qual é a sintaxe da fórmula que o back-end vai interpretar (variáveis disponíveis, como Resultado Operacional, PED, alíquota e faixa, e operadores)? O front pode validar a fórmula no cadastro se recebermos essa lista, como já faz com as expressões da integração do dado externo.
2. A validação da fórmula acontece ao salvar o dashboard (erro `422` no cadastro) ou só no cálculo (`calculada: false` na prévia)? Preferimos as duas.
3. Os dashboards já cadastrados com fórmula só de texto (ex.: `"teste"`) passam a mostrar `calculada: false` na prévia até a TI corrigir a fórmula? Há previsão de quando a mudança entra?

### 6. A-11 (parte restante) — vínculo colaborador ↔ zona de venda e coleta

**Contexto.** Desde 06/11/2026, o cadastro de dado externo aceita as referências `colaborador` e `zona`, e o front mostra as três opções. Sem coleta, o front trata `"coleta disponivel": false` e o realizado com `"valor": null` como "sem coleta ainda", sem erro (F5.10, validada em 24/11/2026).

**O que falta do back-end.**

1. O vínculo de cada colaborador com a zona de venda nas listas de cadastro. O INT-02 do documento de requisitos prevê "colaboradores (com cargo e filial) e o vínculo de cada colaborador com a zona de venda". Hoje `GET /api/ped/vinculos?tipo=colaboradores` traz `id colaborador`, `nome`, `cargo` e `filial`, sem zona.
2. A coleta para as referências Colaborador e Zona de venda. O `API (31).md` diz que, quando houver coleta, o cálculo ganha um ramo no `PedDadoExternoService`, mas não dá previsão.

**Formato sugerido.**

```json
[
  { "id colaborador": 250, "nome": "Nome do colaborador", "cargo": "Vendedor", "filial": "101", "zona": { "codigo": "Z03", "nome": "Zona 03" } },
  { "id colaborador": 251, "nome": "Nome do colaborador", "cargo": "Vendedor", "filial": "101", "zona": null }
]
```

`zona: null` para colaborador sem zona. Se fizer sentido, também `GET /api/ped/vinculos?tipo=zonas` com `codigo` e `nome`.

**Impacto no front.** Dados externos de Colaborador e Zona de venda são cadastrados, mas não têm realizado e não pontuam nos dashboards por cargo ou por colaborador. Com a zona na lista, o front pode mostrá-la no vínculo de colaboradores do dashboard e no resumo de imagens.

**Perguntas.**

1. Há previsão para a coleta por Colaborador e por Zona de venda? Ela depende de alguma fonte do ERP ainda não disponível?
2. De onde vem a zona de venda do colaborador? Podem incluí-la em `GET /api/ped/vinculos?tipo=colaboradores`?
3. Até lá, o negócio deve evitar dados externos dessas referências em dashboards ativos?

### 7. A-22 — tipo de valor nas últimas alterações do Início

**Contexto.** O bloco "Últimas alterações" do Início mostra `valor anterior` e `valor novo` de cada lançamento ou correção. Nas outras telas, o front formata o valor pelo `tipo de valor` do apontamento (`Porcentagem`, `Numeral` ou `Booleano`). No Início, esse campo não vem.

**O que falta do back-end.** O `tipo de valor` em cada item de `ultimas alteracoes` de `GET /api/ped/inicio`.

**Formato sugerido.** Os mesmos valores da listagem de apontamentos:

```json
"ultimas alteracoes": [
  {
    "acao": "correcao",
    "apontamento": "Qualidade do lançamento",
    "tipo de valor": "Porcentagem",
    "competencia": "2026-10-01",
    "filial": "101",
    "valor anterior": 85,
    "valor novo": 92.5,
    "data": "2026-11-24 09:30:00-04:00",
    "usuario": "Nome do usuário"
  }
]
```

**Impacto no front.** F12.12\* bloqueada: um apontamento de porcentagem aparece como "85" e "92,5", sem "%". Quando o campo vier, o front só ajusta a formatação. Se não vier, continua como hoje.

**Pergunta.** Podem incluir o `tipo de valor` em `ultimas alteracoes`? Há outra forma preferida, como o `id apontamento` para o front cruzar com a listagem?

### 8. F12.5 — link e status da tarefa no Bitrix24

**Contexto.** O front mostra o número da tarefa (`tarefa bitrix.id`, o id do Bitrix) em dados externos e dashboards e trata `aguardando_envio` com `id: null`. O `FRONT-tarefas-bitrix (1).md` sugere o link `https://gcm.bitrix24.com.br/company/personal/user/<seu id>/tasks/task/view/<id>/`.

**O que falta do back-end.**

1. O id do usuário logado no Bitrix24, para montar o link. A API não devolve esse id.
2. O status vindo do Bitrix. O `API (31).md` diz que `ped:sincronizar-status-bitrix` grava `status_bitrix`, mas a rotina não está agendada e o campo ainda não volta nas respostas.

**Formato sugerido.** Duas opções; basta uma para o link:

- **A:** `GET /api/ped/acesso` traz `"id bitrix": 1234` do usuário logado, e o front monta o link.
- **B (preferida pelo front):** a própria `tarefa bitrix` traz o `link` pronto, e o front não precisa conhecer o endereço do portal.

```json
"tarefa bitrix": {
  "id": 328169,
  "status": "enviada",
  "status bitrix": "em_andamento",
  "titulo": "[PED] Construir dado externo: ...",
  "link": "https://.../tasks/task/view/328169/"
}
```

`link` e `status bitrix` vêm `null` enquanto a tarefa está `aguardando_envio`.

**Impacto no front.** Sem link, o usuário vê o número, mas precisa procurar a tarefa no Bitrix. Sem o status, o front não mostra se a TI já começou ou concluiu a tarefa.

**Perguntas.**

1. Preferem a opção A ou a B? O link do Bitrix funciona com o id de qualquer usuário, ou precisa ser o do próprio usuário logado?
2. Há previsão para agendar `ped:sincronizar-status-bitrix` e devolver o status nas respostas?

### 9. Progresso por filial na prévia

**Contexto.** Na prévia do fechamento, o front mostra o "Progresso de lançamentos" do dashboard (da linha de `GET /api/ped/fechamentos`) e separa as imagens por filial.

**O que falta do back-end.** O RF-80 pede o progresso da filial escolhida. A prévia traz o `resumo` geral e as imagens, sem o progresso por filial.

**Formato sugerido.**

```json
"resumo": {
  "imagens a gerar": 33,
  "progresso por filial": [
    { "filial": "101", "preenchidos": 18, "total": 20 },
    { "filial": "403", "preenchidos": 3, "total": 10 }
  ]
}
```

**Impacto no front.** Baixo. Hoje o front mostra o progresso geral, e as pendências de cada imagem aparecem nos `avisos`.

**Pergunta.** Podem incluir o progresso por filial no `resumo` da prévia? Se o custo for alto, o front segue com o progresso geral.

---

## Decisões do negócio que podem envolver o back-end

Estes itens não são técnicos: dependem de uma decisão de regra. Listamos aqui porque a decisão pode mudar o que o back-end devolve.

### D-1. P-01 — usuário sem nenhuma filial de acesso

**Situação.** O protótipo trata "nenhuma filial de acesso" como acesso a todas. O `API (31).md` faz o contrário: usuário sem filial e sem abrangência não vê nada (listas vazias). Hoje, com `filiais: []` no acesso, o seletor de filial não aparece.

**Quem decide.** O negócio define a regra; o back-end a aplica no `GET /api/ped/acesso` (por exemplo, com `"todas as filiais": true`) e no escopo das rotas.

**Pergunta.** Vale "sem filial = nenhuma" (regra atual da API) ou "sem filial = todas" (protótipo)? Se valer a da API, o front pode mostrar um aviso de que o usuário não tem filial de acesso, e a F2.7 pode ser encerrada.

### D-2. P-08 — realizado de dado externo em dashboards não mensais

**Situação.** O `API (31).md` usa o valor **da data atual** (o realizado do mês de hoje, com a janela retroativa do dado) e diz que isso foi definido pelo negócio. O documento de requisitos, que é a referência do front, mantém P-08 em aberto: falta definir como os meses são juntados (soma, média, último valor) e como isso combina com a janela retroativa.

**Quem decide.** O negócio, com a atualização do documento de requisitos.

**Pergunta.** A regra "valor da data atual" foi confirmada pelo negócio? Se sim, o documento será atualizado e a F10.8 pode seguir por ela.

### D-3. P-12 — desempenho, volume e disponibilidade

**Situação.** O teste de carga do front (`scripts/teste-carga.mjs`) não tem limites de referência. Também falta saber se a carga da lista completa de colaboradores no resumo de imagens do dashboard é aceitável, ou se o back-end deve dar uma contagem por filial.

**Quem decide.** O negócio define os tempos e a disponibilidade; o back-end e a infraestrutura informam o volume e os limites de uso das rotas.

**Pergunta.** Quais são os tempos de resposta esperados, o volume (usuários simultâneos, imagens por encerramento) e a janela de disponibilidade?

### D-4. P-14 — LGPD e segurança da sessão

**Situação.** O front guarda o token em `sessionStorage` (some ao fechar a aba), como decisão provisória. Faltam o tratamento dos dados de colaboradores, a guarda das credenciais das integrações e o registro de acessos.

**Quem decide.** O negócio e a segurança da informação. O back-end define a expiração do token, se haverá rota de logout e o registro de acessos.

**Perguntas.** Qual é o tempo de expiração do token? Haverá rota de logout? O registro de acessos fica no back-end?

### D-5. Imagens de dashboard vinculado a filiais (A-07)

**Situação.** O back-end gera **uma imagem por filial** em dashboard vinculado a filiais. O documento de requisitos (RF-50, RF-80 a RF-82) previa uma imagem por colaborador, mais a imagem "Filial (sem colaborador vinculado)".

**Quem decide.** O negócio.

**Pergunta.** Vale a regra do back-end (uma por filial)? Se sim, o documento de requisitos será atualizado; se não, o back-end e o resumo de imagens do front mudam.

---

## Já resolvido

Itens recentes que o front recebeu e já aplicou. Não precisam de resposta.

| Item | Data | O que o front aplicou |
| --- | --- | --- |
| Formato real da prévia | 24/11/2026 | JSON real de `GET /api/ped/fechamentos/{id}/previa` recebido: filial em `unidade.filial = { codigo, nome }`, colaborador em `unidade.colaborador = { id, nome, cargo }`, faixas em `pontuacao.faixas`. A prévia agrupa as imagens pelo código da filial (F10.18\*). `unidades com pendencias` e `unidades sem tabela de faixas` lidas como contagens |
| A-21 — alertas do menu | 19/11/2026 | `GET /api/ped/alertas-menu` em uso (F2.12\*), sem `?filial`, com o Preenchedor sem a aba `tipos`, `integracao pendente` de Indicadores também para o Validador e `429` com `Retry-After` |
| A-19 — PDF e ZIP das imagens | 17/11/2026 | As 4 rotas de PDF e ZIP em uso; bloqueio pelo `429`; limite do ZIP retirado em produção (`FRONT-pdf-zip (1).md`); aviso de `filiais sem composicao` no encerramento |
| Período atual pelo mês aberto | 16/11/2026 | Fechamentos, Início e dashboards usam o período que contém o mês aberto |
| Formato real de `GET /api/ped/fechamentos` | 16/11/2026 | `indicadores com problema` e `unidades sem tabela de faixas` como contagens |
| Formato real do Preenchimento | 16/11/2026 | `/preenchimento/meses`, `/preenchimento` e `/metas` lidos pelo formato real (F9.13\*) |
| A-18 — faixa geral e situação | 13/11/2026 | Faixa geral, situação, motivo no `DELETE` e alertas de faixas no dashboard |
| A-16 e A-17 — saída da integração | 11/11/2026 | Saída `{ "campo": "tipo" }` só como documentação, sem mapeamento |
| A-15 — meta via API (fases 1 e 2) | 11/11/2026 | Front adequado; falta só a validação com o executor ligado (item 2) |
| A-14 — meta por filial | 10/11/2026 | Meta por filial no cadastro de indicador |

---

## Validação contra o servidor real

Pontos que o front precisa conferir com o servidor ligado. Alguns dependem dos itens acima.

| O que conferir | Depende de | Atividade do front |
| --- | --- | --- |
| Meta via API: estados `ok` e `erro`, "Última consulta", erro da consulta (Admin), `filiais sem meta` depois da primeira consulta e o `400` do dashboard sem meta no mês aberto | Item 2 (`PED_EXECUTOR_ATIVO=true` e uma fonte SOAP real) | F6.14\* |
| Consulta retroativa de imagens com itens reais: filial, colaborador, tipo da imagem, filtros `tipo` e `id_colaborador`, PDF e ZIP | Item 4 (exemplo real) e um encerramento feito no ambiente | F10.1, F10.6 |
| Avisos de pendências e de falta de faixas na prévia com as contagens reais | Nenhuma; só uma prévia com pendências | F10.4 |
| Composição do Resultado Operacional na prévia, no PDF e no encerramento (sem o aviso de DRG) | Item 3 (DRG configurado) | F10.4, F10.5 |
| Releitura do acesso ao abrir os cadastros e tipo novo no campo Tipo do Admin e do Validador | Item 1 | F2.11\* |
| `vinculos` do detalhe de dashboard vinculado por **cargos** e por **colaboradores** (chaves e tipo dos valores); hoje só o formato por filiais foi visto | Um dashboard de cada tipo no ambiente | F7.1, F7.8 |
| Texto real da chave `meus dados externos em construcao` no resumo do Início | Login de Validador ou Preenchedor com pedido em construção | F11.3 |
| Número e situação da tarefa logo depois de salvar um dado externo ou um dashboard (`enviada` com `id bitrix` ou `aguardando_envio`) | `BITRIX_ATIVO=true` no ambiente | F5.6, F7.7 |
