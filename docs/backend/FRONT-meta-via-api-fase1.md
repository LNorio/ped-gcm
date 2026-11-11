# PED — meta via API, fase 1: o que foi entregue e o que difere do contrato

Complementa a `RESPOSTA-FINAL-meta-via-api.md` (contrato fechado) e a `CONFIRMACAO-FRONT-meta-via-api.md` (OK do front). Aqui estão só as **diferenças e detalhes de implementação** que o front precisa saber para testar. Contrato completo dos endpoints em `docs/ped/API.md`, seção "Indicadores".

## 1. O que a fase 1 entrega

- Cadastro e **Definir meta** com `origem da meta = terceiro` e `fonte da meta` (`dado_externo` / `integracao`).
- **Fonte `dado_externo`:** a meta que o ERP já coleta passa a valer **na hora** para o indicador (faturamento e os 6 volumes).
- **Fonte `integracao`:** o indicador é **aceito, gravado e solicitado** (tarefa no Bitrix quando o cadastro é do Validador), e o Admin salva a integração em `PUT /api/ped/indicadores-cadastro/{id}/integracao`. **A consulta ainda não roda** (fase 2): o estado fica `aguardando_consulta`, e o indicador não entra em dashboard.
- `fornece meta` no dado externo, `tarefa`, `filiais sem meta`, `situacao da meta via api`, alerta e filtro `integracao_pendente`, e `meta via api` no topo da listagem.

## 2. Diferenças e detalhes (leia antes de testar)

1. **Saída em lista vale também para o dado externo (quebra de contrato).** `PUT /api/ped/dados-externos-cadastro/{id}/concluir` e `.../integracao` com a saída antiga em **objeto** passam a devolver `400`. A saída precisa ser uma **lista** com `filial` e **`valor`** (no indicador, `filial` e **`meta`**). O front já valida isso localmente.
2. **`POST /api/ped/integracao/validar` aceita `finalidade`** (opcional): `"valor"` na modal do dado externo e `"meta"` na do indicador. Sem ela, aceita `valor` ou `meta`. Quando a saída não é uma lista, o retorno é `{ valido: false, erro: { mensagem, linha: null, coluna: null }, erros: [...] }` (`linha` e `coluna` vêm `null`, pois não é erro de sintaxe).
3. **Topo da listagem:** `"meta via api": { "dado externo": true, "integracao": false }`. As chaves têm **espaço** (`dado externo`), como o resto da API. `integracao: false` = a consulta ainda não roda.
4. **`tipo de servico`** é opcional e assume `soap`. A listagem do Admin devolve o campo (indicador e dado externo). Aceita `soap` ou `rest`; outro valor dá `400`.
5. **Ao concluir a construção ou salvar a integração de um dado externo**, o PED cria a **coleta** no catálogo se o identificador ainda não existir. Isso aparece nas listas de coletas (`GET /api/ped/indicadores` e `.../dados-externos-cadastro/identificadores`) sem valores.
6. **`filiais sem meta`:**
   - fonte `dado_externo`: as filiais sem meta (ou meta `0`) no **mês aberto**;
   - fonte `integracao`: sempre `[]` (o estado já diz que falta a integração ou a consulta).
7. **`situacao da meta via api`** na fonte `integracao` nesta fase só assume `integracao_pendente` ou `aguardando_consulta` (`erro` e `ok` vêm com o executor).
8. **Alerta `integracao pendente`** conta só a fonte `integracao` sem integração salva. A fonte `dado_externo` nunca fica pendente.
9. **Dashboard:** mensagens de `400` da fonte `integracao`: "...integracao da meta pendente..." (sem integração salva) e "...aguardando a primeira consulta da meta..." (integração salva, sem consulta).
10. **Só o Admin** vê `integracao do dado externo` (fonte ERP) e os campos da integração do indicador. Validador vê `fonte da meta`, `situacao da meta via api`, `filiais sem meta` e `tarefa`.
11. **Correção no cálculo:** indicador sem nenhuma meta passa a mostrar `meta: null` no dashboard (antes mostrava `0`). Vale para meta por filial pendente também.

## 3. Como testar

Roteiro completo na seção 6 da `RESPOSTA-FINAL-meta-via-api.md`. Atalho: cadastre um indicador `terceiro` / `dado_externo` com um dado de **faturamento** e confira `situacao da meta via api` e `filiais sem meta`; cadastre um `terceiro` / `integracao` como **Validador** e confira a `tarefa`; como **Admin**, salve a integração com uma saída em lista e confira `aguardando_consulta`.
