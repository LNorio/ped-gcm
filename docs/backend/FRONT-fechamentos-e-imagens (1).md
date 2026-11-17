# Front: Fechamentos no mês aberto e imagens congeladas (2026-11-16)

## O que mudou
1. **Fechamentos usam o mês aberto.** Lista, prévia, encerramento e PDF trabalham com o período que contém o **mês aberto para preenchimento** (`GET /api/ped/periodo`), e não o da data de hoje. O `periodo atual` de `GET /api/ped/dashboards` e do Início segue a mesma regra. Sem mês aberto, vale a data de hoje.
   - **Atenção:** encerrar agora congela o período do mês aberto (ex.: outubro aberto em novembro congela 10/2026). Deixe isso claro na confirmação do encerramento.
2. **`PUT /api/ped/preenchimento` pode devolver `400`** para apontamento sem dashboard ativo ("nao esta ligado a nenhum dashboard ativo"). Mostre a `mensagem`; o lote é tudo ou nada.
3. **`imagens congeladas` preenchido** em cada apontamento de `GET /api/ped/preenchimento`: lista de `{ "codigo", "dashboard", "periodo" }` das imagens da filial da tela que já usaram aquele mês. Vazia = nenhuma. Use para avisar que o valor já compõe uma imagem congelada (RF-70).
4. O apontamento do **indicador-base das faixas** de um dashboard ativo agora aparece no preenchimento e em `dashboards`, mesmo fora da composição.

Contrato completo em `docs/ped/API.md`.
