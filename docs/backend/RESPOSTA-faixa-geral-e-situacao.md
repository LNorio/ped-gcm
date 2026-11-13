# Resposta à proposta "faixa geral, inativação e alertas" (12/11/2026)

A proposta foi aceita e implementada com os ajustes abaixo. Guia de uso: `FRONT-faixa-geral-e-situacao.md`; contrato: `API.md`.

## Respostas à seção 9

1. **Retirar a restrição de filial do Validador (P-04) tem impacto em outras rotas?** Nas faixas, nenhum novo: a restrição já tinha sido retirada em 03/11/2026 (Admin e Validador veem todas as filiais), e a regra existe separada em cada controller. Esta mudança só acrescenta que ambos também gerenciam a faixa geral. Os fechamentos têm a própria regra de filial e não foram tocados; o único efeito neles é qual faixa vale (a geral ativa, senão a da filial).
2. **`"filial": "todas"` ou `geral: true`?** Os dois são aceitos. `"todas"` cadastra a geral (antes dava `400`, ver divergências). `geral: true` sem `filial` também. Os dois juntos com uma filial específica: `400`.
3. **`DELETE` com corpo funciona?** Sim: o back lê o motivo do corpo JSON ou de `?motivo=`. Confirmado pelo código e pelo teste manual da fase 5 (que envia o corpo); não foi exercitado no Apache/PHP-FPM do servidor, então vale uma chamada de verificação após o deploy, usando `?motivo=` como alternativa se algum proxy descartar o corpo.

## Divergências da proposta

| Ponto | Proposta | Implementado |
| --- | --- | --- |
| Filtro `situacao` da listagem | padrão `ativas` | padrão **`todas`**; o front envia `ativas` quando quiser |
| Formato de data | ISO com `Z` (`2026-11-12T14:05:00.000000Z`) | `2026-11-12 14:05:00-04:00`, como o resto da API |
| Resposta de `PUT .../situacao` | tabela atualizada ou só `mensagem` | `mensagem` e `situacao` (sem a tabela) |
| Resposta de `POST` e `PUT` das faixas | com os campos novos | `POST`: `mensagem`, `id`, `versao`, `geral`; `PUT`: `mensagem`, `versao`. Recarregar a lista |
| `acao` do histórico | opcional; sem `acao` = alteração | **sempre presente**; a versão 1 é `cadastro`, as demais `alteracao` |
| Valores de `acao` | 4 | 4 + `exclusao` (só no histórico de faixa já excluída, que passa a responder `200` em vez de `404`) |
| Mensagem de conflito | cita o dashboard | não cita (o `conflitos` traz id, geral, filial, nome filial) |
| Filtro `problemas` | opcionalmente inclui os alertas de faixas | **não** inclui; use `problemas_faixa` |
| Exclusão sem motivo | `400` | `400`, conferido antes da regra do dashboard |
| `situacao` de faixa de dashboard excluído | não tratado | segue `ativa`; a exclusão não muda a situação |

## Acréscimos além da proposta

- Log de eventos (`ped_faixas_eventos`) com motivo, data e usuário de cadastro, alteração, inativação, reativação e exclusão; sobrevive à exclusão da faixa.
- `POST` aceita `motivo` opcional (vai para o log).
- Alertas de faixas só para dashboard `ativo`.

## Decisões do negócio refletidas

Reativar ou cadastrar em conflito responde `400` com `conflitos` e nunca resolve sozinho; nova faixa pode ser cadastrada no lugar de uma inativada (índices únicos só sobre as ativas); histórico em lista única com `acao`.

## Publicação

Back e front juntos, por causa do `motivo` obrigatório no `DELETE`. A migration só acrescenta colunas e tabela e relaxa `filial_id` para aceitar nulo; as faixas existentes ficam `ativa`.
