# PED — Resposta do back-end à verificação do Swagger (25/11/2026)

Resposta ao `VERIFICACAO-swagger-2026-11-24.md`. Conferido contra o código do back-end (não só contra o Swagger). O servidor da rede interna já está na versão do Swagger de 24/11 (deploy de 24/11, commit `c2c6c84`).

## 1. Correções no front

### D1 — `GET /api/ped/dados-externos-cadastro/identificadores`
O Swagger está certo. O back devolve `"dados cadastrados"` e **nunca** devolveu `quantidade` nessa rota (campo existe desde a primeira versão do módulo). Ajuste o conversor para ler `dados cadastrados`. O back não vai mudar.

```json
[ { "identificador": "FATURAMENTO", "nome": "Faturamento", "unidade": "quantidade", "ativo": true, "dados cadastrados": 1 } ]
```

(`quantidade` existe em outra rota: `GET /api/ped/dados-externos-cadastro/pendentes`, na raiz do objeto.)

### D2 — `GET /api/ped/faixas/{id}/historico`
- `versao` vem sempre como número nos casos atuais.
- **`motivo` pode vir `null`**: no cadastro da versão 1 o motivo é opcional. Uma tabela cadastrada sem motivo devolve `"motivo": null` na linha `acao: "cadastro"`. Aceite `null` no conversor, ou o histórico inteiro é rejeitado.
- Em linhas de `inativacao`, `reativacao` e `exclusao`, `quantidade de faixas` vem `null`.
- Por segurança, trate também `versao` como possivelmente `null` (o campo aceita, ainda que hoje não ocorra).

### D6 — `GET /api/ped/inicio?filial=`
O Swagger está certo e o `API (31).md` estava desatualizado. Todos os perfis podem pedir uma filial, dentro do escopo de cada um: Admin e Validador veem todas; os demais, a própria mais a abrangência. Fora do escopo: `403` `"voce nao tem acesso a esta filial"`. Sem filial e sem abrangência: `403` `"usuario sem filial definida"`. Atualize o comentário de `inicioService.ts`.

## 2. D5 e itens "ainda não aparece no JSON real"
O `previa.json` de 24/11 foi gerado antes do deploy. Agora o servidor devolve `resumo."progresso por filial"` e o aviso único do DRG em `resumo.avisos`. Gere uma prévia nova. O mesmo vale para `tipo de valor` no Início e `unidade` em `GET /api/ped/imagens`.

## 3. Documentação ajustada no Swagger
- `info.version` passa a `2026-11-25`.
- D8: a descrição do parâmetro `busca` das imagens agora cita o cargo e o nome da filial (valores congelados no encerramento).
- D9: no `ped.yaml` atual o campo `filial` já consta nas `properties` de `GET /ped/vinculos` (junto de `cargo`, `id colaborador` etc.). Se na sua cópia faltava, baixe de novo.

## 4. Aviso do DRG (pergunta 5)
O aviso por imagem **fica**: o PDF o imprime e as imagens já congeladas o guardam. Para mostrar o aviso uma vez só, filtre de `imagens[].avisos` o texto idêntico ao de `resumo.avisos` ("Composicao do Resultado Operacional indisponivel: fonte de dados (DRG) nao configurada."). O texto vem de uma constante única no back, então não varia.

## 5. Respostas às perguntas
1. **Identificadores:** ver D1.
2. **Histórico de faixas:** ver D2 (o `null` é o `motivo` do cadastro).
3. **Versão no ar:** sim, o servidor está no Swagger de 24/11 (ver seção 2).
4. **A-20:** o back devolve **todos** os tipos para Admin e Validador (testado em `tests/manual/ped/fase1.php`). Se o Admin do caso real viu menos, a causa provável é o `perfil` dele ser `preenchedor`, vindo do grupo do ERP (o grupo prevalece sobre o papel). Envie o JSON de `GET /api/ped/acesso` desse usuário, com o campo `perfil`. Para o Preenchedor, a releitura ao abrir o cadastro basta.
5. **DRG:** o dado virá de um endpoint de outro sistema, que ainda não existe; sem previsão. **Por enquanto não serão encerrados períodos**, para não congelar imagens sem a composição.
6. **Executor:** `PED_EXECUTOR_ATIVO` está desligado de propósito. As 11 fontes cadastradas usam coletas nativas do ERP e não passam por ele. Não há fonte SOAP real de meta via API; a única fonte de integração é um cadastro de teste do próprio front, que será limpo no fim do desenvolvimento.
7. **Imagens:** ainda não há encerramento real, então não há exemplo com itens. `colaborador` na raiz é o **nome** (texto) e `filial` é o **código** (texto); o detalhado está em `unidade`.
8. **A-08:** depende de decisão do negócio (sintaxe da fórmula, validação e impacto nas regras já definidas). Sem previsão.
9. **A-11 (zona de venda):** sem previsão; depende de fonte do ERP e de decisão.
10. **F12.5 (Bitrix):** `link` e `status bitrix` ainda não existem. O comando de sincronização de status existe, mas não está agendado, e o link exigiria expor o endereço do portal. Fica junto com a decisão do Bitrix.
11. **D-4:** o token vale 12 h, sem renovação pelo uso, e não há rota de logout nem registro de acessos. O login via ERP, previsto, deve reavaliar isso.
12. **D-1, D-2, D-3 e D-5:** decisões do negócio; o back mantém as regras atuais até lá.
