# Guia para o front: tela Início do PED

Contrato completo em `docs/ped/API.md` (seção "fase 9: tela Início"). Este guia diz **como montar a tela** a partir dele.

## 1. Chamada

`GET /api/ped/inicio` (header `Authorization: Bearer {token}`). Uma chamada devolve tudo.

| Quem | Parâmetro `filial` |
|---|---|
| Admin | `?filial=101` escolhe uma filial; omitir ou `todas` = todas as filiais; código inexistente = `404` |
| Validador, Preenchedor e demais | ignorado: vale sempre a própria filial (mais a abrangência, se houver) |

O seletor "Todas as filiais" só faz sentido para o Admin. Para os outros, esconda o seletor e mostre a filial que vier em `filiais`.

Recarregue a tela ao trocar a filial e depois de qualquer lançamento ou correção no Preenchimento.

## 2. Respostas de erro

| Código | Quando | O que fazer |
|---|---|---|
| `401` | token ausente ou expirado (a sessão dura 12 h) | levar ao login |
| `403` | usuário sem perfil no PED | mostrar "sem acesso ao PED"; não tentar de novo |
| `404` | `filial` inexistente (só o Admin envia) | voltar para "todas" |
| `429` | muitas requisições | esperar e tentar de novo |

Todos trazem `mensagem`.

## 3. Blocos da tela (de cima para baixo)

### 3.1 Aviso do período aberto (RF-06)

Campo `periodo aberto`: `mes de referencia` (`2026-10-01`), `aberto por`, `aberto em` e `aviso` (texto pronto com a regra de um único período aberto). Mostre o mês como `MM/AAAA` e o `aviso` como veio.

Se `mes de referencia` vier `null`, não há mês aberto: esconda o botão Preencher e avise o usuário.

### 3.2 Aviso de acesso (RF-07)

Campo `aviso de acesso`. Se for `null` (Admin e Validador), não mostre nada. Senão, mostre `mensagem` como veio; `tipos` e `filiais` ajudam se quiser listar em etiquetas.

### 3.3 Resumo (RF-08)

Campo `resumo`: lista já ordenada de `{ chave, rotulo, valor }`. **Desenhe um cartão por item, na ordem recebida, usando `rotulo` e `valor`.** Não fixe a lista no front: ela muda com o perfil.

| Perfil | Cartões |
|---|---|
| Admin | apontamentos ativos, dados externos ativos, total de indicadores, dados externos em construção, lançamentos pendentes |
| Validador | apontamentos ativos, dashboards com meus apontamentos, meus dados externos em construção, dashboards ativos, lançamentos pendentes |
| Preenchedor | apontamentos dos meus tipos, dashboards com meus apontamentos, meus dados externos em construção, lançamentos pendentes |

`lancamentos pendentes` conta só o **mês aberto**, nas filiais da tela, e só os apontamentos que aparecem no preenchimento (ativos e ligados a indicador ativo de dashboard ativo), o mesmo conjunto de `GET /api/ped/preenchimento`.

### 3.4 Botão "Preencher apontamentos do período" (RF-09)

Só navegação: leva à aba Preenchimento, com a filial da tela e `periodo aberto.mes de referencia`. O back não tem endpoint para isso.

### 3.5 Períodos em aberto (RF-10)

Campo `periodos em aberto`: um item por dashboard ativo visível ao usuário, em ordem alfabética.

| Campo | Uso |
|---|---|
| `nome`, `periodicidade` | título e rótulo (mensal, bimestral, ...) |
| `periodo atual` | por exemplo `11/2026`, `1º Tri/2026`, `2026` |
| `filiais abertas` | quantas filiais da tela ainda não foram encerradas neste período |
| `progresso` | `preenchidos` de `total` ("X de Y lançamentos") |
| `periodo encerrado` | `true` = todas as unidades da tela já foram encerradas; mostre o selo "Encerrado" e desabilite o Preencher (o progresso vem 0 de 0) |

Botão **Preencher** de cada linha: leva ao Preenchimento da filial da tela. Para o Admin com "todas as filiais", peça para escolher a filial.

**`periodo atual` segue o mês aberto.**
- `periodo atual` é o período do dashboard que **contém o mês aberto para preenchimento** (`periodo aberto.mes de referencia`, RF-75), e não o da data de hoje. Se o Admin abriu outubro em novembro, um dashboard mensal mostra `10/2026`; um bimestral mostra o bimestre que contém outubro.
- O progresso e o `periodo encerrado` são contados nesse mesmo período.
- Só se não houver mês aberto o back cai no período da data atual.
- Não é preciso nenhuma observação extra na tela: o período mostrado já é o que aceita lançamento.
- Os números do progresso também não são os do card do Preenchimento: o Início conta só os apontamentos usados pelo dashboard, e o Preenchimento mostra todos os apontamentos da filial.

### 3.6 Últimas alterações (RF-11)

Campo `ultimas alteracoes`: até 6 itens, do mais recente para o mais antigo. Cada um traz `acao` (`lancamento` ou `correcao`), `apontamento`, `competencia` (`2026-10-01`, mostre `MM/AAAA`), `filial`, `valor anterior`, `valor novo`, `data` e `usuario`.

- Mostre `valor anterior → valor novo`; em lançamento novo o anterior é `null` (mostre `—`).
- Apontamento booleano vem `true`/`false`: mostre Sim/Não.
- O Preenchedor vê só os apontamentos dos seus tipos.

## 4. Checklist de teste

1. Admin, sem `filial`: todas as filiais em `filiais`, resumo com 5 cartões.
2. Admin com `?filial=101`: só a 101.
3. Validador: 5 cartões, outros nomes; sem aviso de acesso.
4. Preenchedor: 4 cartões e aviso de acesso com os tipos e as filiais.
5. Usuário sem perfil: `403`.
6. Dashboard cujo período já foi encerrado nas filiais da tela: `periodo encerrado: true`.
7. Mês aberto anterior ao mês de hoje: `periodo atual` dos dashboards = o período do mês aberto (ex.: `10/2026` em novembro).
