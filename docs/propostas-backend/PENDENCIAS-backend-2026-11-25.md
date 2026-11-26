# PED — O que ainda falta do back-end

Levantamento do front de 25/11/2026. **Este documento substitui o [`PENDENCIAS-backend-2026-11-24.md`](PENDENCIAS-backend-2026-11-24.md) como lista do que falta.** O documento de 24/11 continua valendo como histórico e para o contexto completo de cada item.

A base é a verificação das pendências contra o Swagger ([`VERIFICACAO-swagger-2026-11-24.md`](VERIFICACAO-swagger-2026-11-24.md)), refeita em 25/11 com o Swagger de **desenvolvimento** (`ped.yaml`, `info.version` "2026-11-25"). Em relação ao de produção ("2026-11-23"), o de desenvolvimento só mudou a descrição do parâmetro `busca` de `GET /api/ped/imagens`. Os números de linha citados (l. …) valem para os dois contratos. Quando o Swagger e o JSON real divergem, vale o JSON real.

Aqui entram só os itens **não atendidos**, os **atendidos em parte** e o que o front precisa confirmar. Os itens já atendidos estão em "Recebido desde o último documento".

## Resumo

### Itens técnicos

| # | Item | O que falta do back-end | O que fica bloqueado no front | Prioridade |
| --- | --- | --- | --- | --- |
| 1 | D1 — campo de contagem nas sugestões de identificador | Confirmar o nome real do campo: `"dados cadastrados"` (Swagger) ou `quantidade` | Se o campo for `"dados cadastrados"`, as sugestões de identificador somem sem erro visível no cadastro de dado externo e na integração do indicador | Alta |
| 2 | A-08 — pontuação pela fórmula do cadastro | Calcular a pontuação pela `formula de pontuacao` do dashboard, no lugar das 4 etapas fixas; informar a sintaxe | Imagens congeladas não seguem a fórmula cadastrada; validação da fórmula no cadastro | Alta |
| 3 | Composição do DRG | Configurar a fonte do DRG; dizer se o aviso pode vir só em `resumo.avisos` | Prévia com o mesmo aviso em todas as imagens; PDFs sem a composição; encerramentos congelados sem a composição | Alta |
| 4 | F6.14\* — meta via API de ponta a ponta | Ligar `PED_EXECUTOR_ATIVO` e indicar uma fonte SOAP real | Validação com o servidor real dos estados `ok`/`erro`, "Última consulta", `filiais sem meta` e meta no dashboard | Alta |
| 5 | D2 — `versao`/`motivo` nulos no histórico de faixas | Dizer quando os dois campos vêm `null` | Se vier um `null`, o histórico de faixas inteiro deixa de abrir | Média |
| 6 | A-20 — tipos no acesso do Admin e do Validador | Confirmar com um JSON real de `GET /api/ped/acesso` de um Admin que vêm todos os tipos | Admin ou Validador sem vínculo com um tipo novo não consegue cadastrar apontamento nem dado externo nele | Média |
| 7 | Versão do servidor | Dizer se produção já está na versão do Swagger e quando a de desenvolvimento (25/11) será publicada | O front não sabe se pode contar com `progresso por filial` e `resumo.avisos` na prévia | Média |
| 8 | JSON real de `GET /api/ped/imagens` com itens | Enviar um exemplo real com uma imagem de filial e uma de colaborador | Leitura do bloco `unidade` (nome da filial e cargo, RF-84) só com o formato documentado | Média |
| 9 | A-11 — colaborador ↔ zona de venda e coleta | Zona do colaborador em `GET /api/ped/vinculos`; coleta para Colaborador e Zona de venda | Dados externos de Colaborador e Zona de venda ficam sem realizado e não pontuam | Média |
| 10 | F12.5 — link e status da tarefa no Bitrix24 | Id do usuário no Bitrix (ou o link pronto) e o `status bitrix` nas respostas | Link "Abrir no Bitrix24" e situação real da tarefa em dados externos e dashboards | Baixa |

### Decisões do negócio

| # | Item | Quem decide | Situação |
| --- | --- | --- | --- |
| D-1 | P-01 — usuário sem nenhuma filial de acesso | Negócio; o back-end aplica a regra | Aberta. A API segue com "sem filial = nada" |
| D-2 | P-08 — realizado de dado externo em dashboards não mensais | Negócio, com atualização do documento de requisitos | Aberta. A API usa "valor da data atual" |
| D-3 | P-12 — desempenho, volume e disponibilidade | Negócio, com os números do back-end e da infraestrutura | Aberta. Só há limites por minuto |
| D-4 | P-14 — LGPD e segurança da sessão | Negócio e segurança da informação; o back-end define logout e registro de acessos | Atendida em parte. Token de 12 horas, sem renovação pelo uso |
| D-5 | Imagem por filial em dashboard vinculado a filiais (A-07) | Negócio | Aberta. A API segue com uma imagem por filial |

---

## Pendências técnicas

### 1. D1 — campo de contagem nas sugestões de identificador

**Contexto.** O cadastro de dado externo e a integração do indicador mostram sugestões de identificador a partir de `GET /api/ped/dados-externos-cadastro/identificadores`. O `API (31).md` não dava o nome do campo de contagem, e o front foi feito esperando `quantidade`.

**O que falta.** O Swagger (l. 2079–2096) documenta o item como `{ identificador, nome, unidade, ativo, "dados cadastrados" }`. Precisamos saber qual é o nome real do campo na resposta do servidor.

**Formato documentado no Swagger.**

```json
[
  {
    "identificador": "FATURAMENTO",
    "nome": "Atingimento meta faturamento",
    "unidade": "valor",
    "ativo": true,
    "dados cadastrados": 1
  }
]
```

**Impacto no front.** O front exige `quantidade` numérico. Se vier `"dados cadastrados"`, a lista inteira é recusada como resposta inválida e as telas ficam **sem sugestões, sem nenhum erro visível**. O ajuste no front é pequeno, mas precisamos do nome certo antes de mudar.

**Perguntas.**

1. O servidor devolve `"dados cadastrados"` (como no Swagger) ou `quantidade`?
2. O nome vai se manter nas próximas versões?
3. Podem enviar um JSON real dessa rota?

### 2. A-08 — pontuação pela fórmula do cadastro

**Contexto.** O dashboard tem o campo obrigatório "Fórmula de pontuação". Pela decisão do negócio de 24/11/2026, o back-end deve **passar a calcular a pontuação pela `formula de pontuacao` do cadastro do dashboard**, no lugar das 4 etapas fixas (Resultado Operacional, faixa atingida, base pelo maior entre A e B, base × PED ÷ 100). Vale para a prévia, o encerramento e o PDF. Imagens já congeladas não mudam (RN-18).

**O que falta.** Não atendido. O Swagger continua com a fórmula como "texto livre, só guardada e enviada à TI" (l. 3619, l. 6336–6339), e o bloco `pontuacao` da imagem não tem `formula` (l. 6600–6650).

**Formato sugerido.** O mesmo bloco `pontuacao`, com a fórmula aplicada e, quando ela não puder ser calculada, `calculada: false` com o motivo:

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

Se a fórmula não usar os passos intermediários (faixa atual, opções A e B, base de cálculo), eles podem vir `null`.

**Impacto no front.** A tela não quebra: o front já mostra a pontuação pronta e já trata `calculada: false`. Mas, enquanto o cálculo não mudar, toda imagem congelada sai por uma regra diferente da que o negócio cadastrou, e isso não pode ser corrigido depois do encerramento. Com a sintaxe, o front também pode validar a fórmula no cadastro.

**Perguntas.**

1. Qual é a sintaxe da fórmula (variáveis disponíveis, como Resultado Operacional, PED, alíquota e faixa, e operadores)?
2. A validação acontece ao salvar o dashboard (`422`/`400`), no cálculo (`calculada: false`) ou nos dois? Preferimos os dois.
3. O bloco `pontuacao` vai ganhar o campo `formula`?
4. Dashboards já cadastrados com fórmula só de texto (ex.: `"teste"`) passam a vir com `calculada: false` até a TI corrigir?
5. Qual é a previsão?

### 3. Composição do DRG

**Contexto.** Sem a fonte do DRG, toda imagem da prévia vem com `"composicao do resultado": null` e o aviso abaixo (l. 4782):

```text
Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada.
```

**O que falta.**

1. Configurar a fonte do DRG no servidor (configuração; o Swagger não mostra).
2. O aviso **uma vez só**. O Swagger passou a trazer o aviso uma vez em `resumo.avisos` da prévia (l. 6450), o que é bom, mas manteve o mesmo aviso em cada `imagens[].avisos`. O pedido de 24/11 era o aviso no resumo **em vez de** em cada imagem.

**Formato sugerido.** Com o DRG desligado:

```json
{
  "resumo": {
    "avisos": [
      "Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada."
    ]
  },
  "imagens": [
    {
      "composicao do resultado": null,
      "avisos": []
    }
  ]
}
```

Em `imagens[].avisos` ficam só os avisos da unidade (lançamentos pendentes, unidade sem faixas).

**Impacto no front.**

- O aviso repetido em todas as imagens esconde os que pedem ação. Para mostrá-lo uma vez, o front teria de filtrar pelo texto da mensagem, o que quebra se o texto mudar.
- Os PDFs saem sem a tabela de composição.
- Todo encerramento feito agora congela as imagens sem a composição, para sempre (RN-18).

**Perguntas.**

1. Há previsão para configurar o DRG no servidor?
2. Enquanto o DRG estiver desligado, o negócio deve evitar encerrar períodos, ou é aceitável congelar imagens sem a composição?
3. Agora que o aviso vem em `resumo.avisos`, podem tirá-lo de `imagens[].avisos`? Se preferirem manter, o texto da mensagem é fixo?

### 4. F6.14\* — meta via API de ponta a ponta

**Contexto.** O front já trata a meta via API das fases 1 e 2: `fonte da meta`, entrada SOAP, os estados de `situacao da meta via api` (inclusive `aguardando_consulta`, l. 6141 e l. 3121), "Última consulta", erro da consulta (Admin), `filiais sem meta` e o `400` do dashboard sem meta no mês aberto.

**O que falta.** O executor (`php artisan ped:executar-integracoes`) só roda com `PED_EXECUTOR_ATIVO=true`. O exemplo do Swagger ainda traz `meta via api.integracao: false` (l. 2780). Sem o executor ligado e uma fonte real, os estados `ok`/`erro` e as `filiais sem meta` nunca aparecem.

**Formato sugerido.** Nenhum formato novo.

**Impacto no front.** A F6.14\* é a única atividade pendente da fase de Indicadores e só pode ser fechada com o resultado real de uma consulta.

**Perguntas.**

1. O `PED_EXECUTOR_ATIVO` está ligado no ambiente que o front usa para validar? Se não, quando será?
2. Há uma fonte SOAP real (indicador com fonte `integracao`) cadastrada nesse ambiente? Se não, a TI pode cadastrar uma e rodar `--simular` antes?
3. Existem integrações salvas no formato antigo (saída em lista)? A modal do front só salva o formato novo, então elas precisariam ser reescritas antes de qualquer edição.

### 5. D2 — `versao` e `motivo` nulos no histórico de faixas

**Contexto.** `GET /api/ped/faixas/{id}/historico` alimenta o histórico de versões da tabela de faixas. Pelo `API (31).md`, `versao` sempre vem e o motivo é sempre gravado.

**O que falta.** O Swagger documenta `versao` e `motivo` como `nullable` e inclui a ação `exclusao` (l. 4576–4585). Precisamos saber quando eles vêm nulos.

**Formato documentado no Swagger.**

```json
[
  {
    "acao": "exclusao",
    "versao": null,
    "vigente": false,
    "motivo": null,
    "data": "2026-11-24 10:15:00-04:00",
    "usuario": "Nome do usuário"
  }
]
```

**Impacto no front.** O front exige `versao` numérico e `motivo` em texto. Um único `null` faz o histórico inteiro ser recusado. O ajuste é simples, mas queremos mostrar o caso de forma correta (ex.: "sem versão" na exclusão).

**Perguntas.**

1. Em que casos `versao` vem `null`? Só na `exclusao`, em eventos antigos ou em outros?
2. Em que casos `motivo` vem `null`?

### 6. A-20 — tipos no acesso do Admin e do Validador

**Contexto.** O campo Tipo do "Novo apontamento" e do "Novo dado externo" lista os `tipos` de `GET /api/ped/acesso`. O front relê o acesso ao abrir os dois cadastros e depois de criar ou alterar um tipo.

**O que já veio.** O Swagger diz que "o preenchedor recebe só os tipos vinculados a ele" (l. 115), e os `POST` de apontamento e de dado externo só recusam o Preenchedor em tipo sem acesso (l. 1302, l. 1931). Isso indica que o Admin e o Validador recebem todos os tipos, mas não diz de forma explícita, e o exemplo (l. 121–133) é de um Preenchedor.

**O que falta.** A confirmação com um JSON real de um Admin sem vínculo com um tipo novo (ex.: "Departamento Pessoal", id 8).

**Formato esperado.** Sem mudança de formato:

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

**Impacto no front.** Se o tipo vier, a F2.11\* é validada sem mudar o front. Se não vier, o Admin ou o Validador não consegue cadastrar nesse tipo.

**Perguntas.**

1. Confirmam que `GET /api/ped/acesso` devolve **todos** os tipos ativos para o Admin e o Validador?
2. Podem enviar o JSON real de um Admin sem vínculo com o tipo id 8?
3. Para o Preenchedor vinculado a um tipo novo por outro usuário, basta o front reler o acesso ao abrir o cadastro?

### 7. Versão do servidor

**Contexto.** O JSON real da prévia recebido em 24/11 (`GET /api/ped/fechamentos/{id}/previa`) veio com `resumo.avisos: []`, mesmo com o DRG desligado, e sem `progresso por filial`. Os dois estão documentados no Swagger (l. 6450–6466, exemplo na l. 4823).

**O que falta.** Saber qual versão está no ar em cada ambiente.

**Impacto no front.** O front vai passar a usar `progresso por filial` e `resumo.avisos`. Enquanto o servidor não os enviar, a prévia segue com o progresso geral e os avisos de cada imagem, sem erro. Mas não conseguimos validar com dados reais.

**Perguntas.**

1. Produção já está na versão do Swagger de produção ("2026-11-23")? Se sim, por que a prévia de 24/11 veio sem os dois campos?
2. Quando a versão de desenvolvimento ("2026-11-25") será publicada em produção?
3. Qual ambiente o front deve usar para validar as novidades?

### 8. JSON real de `GET /api/ped/imagens` com itens

**Contexto.** O Swagger documenta a linha da consulta retroativa com `filial` e `colaborador` em texto e o bloco `unidade` congelado no encerramento (l. 5094–5158), e a busca por nome da filial e cargo (l. 5076, l. 5482). O front vai passar a ler `unidade`. O único exemplo real que temos é uma lista vazia (`[]`).

**O que falta.** Um JSON real com pelo menos uma imagem de filial e uma de colaborador.

**Formato documentado (resumido).**

```json
[
  {
    "id": 41,
    "codigo": "IMG-000041",
    "lote": "ENC-000003",
    "dashboard": "PED",
    "periodo": "10/2026",
    "filial": "403",
    "tipo": "colaborador",
    "id colaborador": 250,
    "colaborador": "Nome do colaborador",
    "unidade": {
      "tipo": "colaborador",
      "filial": { "codigo": "403", "nome": "Filial 403" },
      "colaborador": { "id": 250, "nome": "Nome do colaborador", "cargo": "Gerente" }
    },
    "gerado em": "2026-11-24 10:15:00-04:00",
    "usuario": "Nome do usuário",
    "ped percentual": 47.59,
    "pontuacao": 32682.19
  }
]
```

Os valores são ilustrativos.

**Impacto no front.** A consulta funciona hoje, mas a coluna e a busca por cargo (RF-84) dependem de `unidade`. Se o formato real for outro, o nome da filial e o cargo ficam em branco, como aconteceu na prévia antes do ajuste de 24/11.

**Perguntas.**

1. Podem enviar o JSON real com uma imagem de filial e uma de colaborador?
2. O `colaborador` em texto na raiz é o nome do colaborador?
3. Em imagem antiga, sem o bloco, `unidade` vem com `filial.nome` e `colaborador` nulos (l. 5121) ou não vem?

### 9. A-11 — vínculo colaborador ↔ zona de venda e coleta

**Contexto.** O cadastro de dado externo aceita as referências `colaborador` e `zona`. Sem coleta, o front mostra "sem coleta ainda" (`"coleta disponivel": false`, realizado com `"valor": null`).

**O que falta.** Não atendido.

1. A zona do colaborador em `GET /api/ped/vinculos?tipo=colaboradores`. Hoje vêm `id colaborador`, `nome`, `cargo` e `filial`, sem zona (l. 3475), e não existe `tipo=zonas` (l. 3486).
2. A coleta para as referências Colaborador e Zona de venda. Hoje só `filial` tem coleta (l. 1936, l. 5989).

**Formato sugerido.**

```json
[
  { "id colaborador": 250, "nome": "Nome do colaborador", "cargo": "Vendedor", "filial": "101", "zona": { "codigo": "Z03", "nome": "Zona 03" } },
  { "id colaborador": 251, "nome": "Nome do colaborador", "cargo": "Vendedor", "filial": "101", "zona": null }
]
```

`zona: null` para colaborador sem zona. Se fizer sentido, também `GET /api/ped/vinculos?tipo=zonas` com `codigo` e `nome`.

**Impacto no front.** Dados externos de Colaborador e Zona de venda são cadastrados, mas não têm realizado e não pontuam nos dashboards por cargo ou por colaborador.

**Perguntas.**

1. Qual é a previsão da coleta por Colaborador e por Zona de venda? Ela depende de alguma fonte do ERP ainda não disponível?
2. De onde vem a zona do colaborador? Podem incluí-la em `GET /api/ped/vinculos?tipo=colaboradores`?
3. Até lá, o negócio deve evitar dados externos dessas referências em dashboards ativos?

### 10. F12.5 — link e status da tarefa no Bitrix24

**Contexto.** O front mostra o número da tarefa (`tarefa bitrix.id`) em dados externos e dashboards e trata `aguardando_envio` com `id: null`.

**O que falta.** Não atendido. `TarefaBitrixRef` tem só `id`, `status` e `titulo` (l. 5854–5866), e `GET /api/ped/acesso` não traz `id bitrix` (l. 5746–5771). O status local vai de `aguardando_envio` a `concluida` (l. 4050), sem o status vindo do Bitrix.

**Formato sugerido.** Basta uma das opções para o link:

- **A:** `GET /api/ped/acesso` traz `"id bitrix": 1234` do usuário logado, e o front monta o link.
- **B (preferida pelo front):** a `tarefa bitrix` traz o `link` pronto.

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

1. Preferem a opção A ou a B? O link funciona com o id de qualquer usuário ou precisa ser o do usuário logado?
2. Qual é a previsão para agendar `ped:sincronizar-status-bitrix` e devolver o `status bitrix`?

---

## Decisões do negócio que podem envolver o back-end

Estes itens dependem de uma decisão de regra, não de desenvolvimento. Ficam aqui porque a decisão pode mudar o que o back-end devolve. O Swagger de 25/11 mantém as regras atuais em todos eles.

### D-1. P-01 — usuário sem nenhuma filial de acesso

**Situação.** O protótipo trata "nenhuma filial de acesso" como acesso a todas. A API faz o contrário: "Quem não tem filial nem abrangência não vê nada (listas vazias) ou recebe `403` `"usuario sem filial definida"`" (l. 55).

**Quem decide.** O negócio; o back-end aplica a regra no acesso e no escopo das rotas.

**Pergunta.** Vale "sem filial = nenhuma" (API) ou "sem filial = todas" (protótipo)? Se valer a da API, o front mostra um aviso de que o usuário não tem filial de acesso e encerra a F2.7.

### D-2. P-08 — realizado de dado externo em dashboards não mensais

**Situação.** A API usa o valor **da data atual** (o JSON real da prévia mostra a observação "valor da data atual" nos indicadores de dado externo). O documento de requisitos mantém P-08 em aberto: falta definir como os meses são juntados (soma, média, último valor) e como isso combina com a janela retroativa.

**Quem decide.** O negócio, com a atualização do documento de requisitos.

**Pergunta.** A regra "valor da data atual" foi confirmada pelo negócio? Se sim, o documento será atualizado e a F10.8 segue por ela.

### D-3. P-12 — desempenho, volume e disponibilidade

**Situação.** O Swagger traz só os limites por minuto (PDF 20, prévia 60, ZIP 5, alertas 30; l. 64). Não há metas de tempo de resposta, volume nem disponibilidade, e o teste de carga do front não tem limites de referência.

**Quem decide.** O negócio define tempos e disponibilidade; o back-end e a infraestrutura informam volume e limites.

**Pergunta.** Quais são os tempos de resposta esperados, o volume (usuários simultâneos, imagens por encerramento) e a janela de disponibilidade? A lista completa de colaboradores no resumo de imagens do dashboard é aceitável, ou o back-end deve dar uma contagem por filial?

### D-4. P-14 — LGPD e segurança da sessão (atendida em parte)

**Situação.** O Swagger informa que o token vale **12 horas** a partir do login e **não é renovado pelo uso** (l. 23). Não há rota de logout nem registro de acessos. O front guarda o token em `sessionStorage`, como decisão provisória.

**Quem decide.** O negócio e a segurança da informação; o back-end define logout e registro de acessos.

**Perguntas.** Haverá rota de logout? O registro de acessos fica no back-end? Como ficam o tratamento dos dados de colaboradores e a guarda das credenciais das integrações?

### D-5. Imagens de dashboard vinculado a filiais (A-07)

**Situação.** O back-end gera **uma imagem por filial** em dashboard vinculado a filiais (l. 3616). O documento de requisitos (RF-50, RF-80 a RF-82) previa uma imagem por colaborador, mais a imagem "Filial (sem colaborador vinculado)".

**Quem decide.** O negócio.

**Pergunta.** Vale a regra do back-end (uma por filial)? Se sim, o documento de requisitos será atualizado; se não, o back-end e o resumo de imagens do front mudam.

---

## Recebido desde o último documento

Não precisam de resposta. **O front vai passar a usar estes itens.**

| Item | O que veio |
| --- | --- |
| A-22 — tipo de valor nas últimas alterações | `ultimas alteracoes[]."tipo de valor"` em `GET /api/ped/inicio` (l. 448–451) |
| Progresso por filial na prévia | `resumo."progresso por filial"` com `filial`, `nome filial`, `preenchidos` e `total` (l. 6453–6466), documentado; falta aparecer no servidor (item 7) |
| Bloco `unidade` em `/imagens` e busca | `unidade { filial { codigo, nome }, colaborador { id, nome, cargo } }` na linha (l. 5119–5148), e `busca` pelo nome da filial e pelo cargo (l. 5076, l. 5482) |
| Aviso do DRG no resumo | Entrada única em `resumo.avisos` da prévia (l. 6450); falta tirá-lo de cada imagem (item 3) |
| D8 — descrição de `busca` | A descrição de `FiltroImagemBusca` passou a citar o nome da filial e o cargo (Swagger de desenvolvimento, 25/11) |

---

## Como responder

Para cada item, basta responder às perguntas numeradas da seção. Pedimos também:

1. **Um JSON real** de cada rota citada, tirado do servidor que o front usa:
   - `GET /api/ped/dados-externos-cadastro/identificadores` (item 1);
   - `GET /api/ped/fechamentos/{id}/previa` com o DRG desligado (itens 3 e 7) e, quando ligado, com a composição (item 3);
   - `GET /api/ped/indicadores-cadastro` depois de uma consulta do executor, com `ok` ou `erro` (item 4);
   - `GET /api/ped/faixas/{id}/historico` com uma exclusão ou um evento antigo (item 5);
   - `GET /api/ped/acesso` de um Admin sem vínculo com o tipo id 8 (item 6);
   - `GET /api/ped/imagens` com uma imagem de filial e uma de colaborador (item 8);
   - `GET /api/ped/vinculos?tipo=colaboradores`, quando trouxer a zona (item 9);
   - uma `tarefa bitrix` de dado externo ou dashboard, quando trouxer o link ou o status (item 10).
2. **A versão do servidor** (`info.version` do Swagger correspondente) de produção e de desenvolvimento no momento em que os exemplos foram tirados.
3. **A previsão** dos itens não atendidos (2, 3, 4, 9 e 10), mesmo que aproximada.

Nos exemplos, podem trocar nomes de pessoas e de filiais por nomes genéricos.
