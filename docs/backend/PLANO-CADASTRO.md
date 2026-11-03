# PED — Cadastro e Preenchimento: plano do back-end

Plano de construção do back-end a partir de [REQUISITOS-CADASTRO-PREENCHIMENTO.md](REQUISITOS-CADASTRO-PREENCHIMENTO.md) (RF/RN/RNF/INT/P citados abaixo são os códigos desse documento). Complementa [PED.md](PED.md) (coleta do ERP) e [API.md](API.md) (contrato de leitura já existente).

## 1. Decisões (27–28/10/2026)

| # | Decisão | Consequência |
|---|---|---|
| A | O back-end continua neste projeto Laravel | Mesmo banco, Sanctum, prefixo `/api/ped/...`, tabelas `ped_*`. Usuário e filial vêm de `colaboradores`/`filiais` (não há INT-01/INT-02 externas). |
| B | Os dados externos são os web services (ERP) | O "identificador da consulta" de um dado externo (RF-26) é a operação do WS (`NovCli`, `Cobertura`, `ProdPDV`, `VolVenConsolidado`, `ProPar`) mais seus parâmetros. As tabelas de coleta atuais (`ped_dados_externos` etc.) viram a fonte do realizado (INT-03). |
| C | Referência do dado externo conforme o documento: Filial, Colaborador ou Zona de venda | O cadastro tem o campo para as 3, **mas só Filial está liberada** (decisão de 28/10/2026). Colaborador e zona entram quando houver coleta: os WS atuais só devolvem por filial e a TI precisa expor essas consultas. |

### Pontos provisórios (adotados até haver resposta; marcados no código com `// P-xx`)

- **Perfis (P-01):** nova coluna `colaboradores.ped_perfil` (`admin`/`validador`/`preenchedor`, nulo = sem acesso ao PED). Vínculo com tipos por tabela pivô direta colaborador ↔ tipo (no lugar de grupo → tipo), trocável quando P-01/P-02 forem respondidas.
- **Filiais de acesso:** a `filial_id` do colaborador; `admin` vê todas (mesma regra do `ScopesFilial`).
- **Reabertura de mês (P-09):** não permitida (só abrir meses posteriores ao aberto).
- **Dado externo em período não mensal (P-08):** *resolvida* — usa o valor da data atual.
- **Fórmula de pontuação (P-10):** *resolvida* — o back-end calcula (4 etapas: ver `API.md`, fase 7); o campo no dashboard virou só referência.
- **Bitrix24 (INT-04, P-06):** adiado para a fase 8; até lá a tarefa é só um registro local.

## 2. Arquitetura

- Convenções do projeto mantidas: `$table` explícito, migrations incrementais (nunca `migrate:fresh`), `Validator` com `400`, `try/catch` nas gravações, chaves JSON em português com espaços, parâmetros de query com underscore, auditoria pelo `AuditObserver`.
- Services testáveis sem HTTP: `PedCalculoService` (RN-01 a RN-10) e `PedPeriodoService` (RN-16, período aberto).
- Escopo por perfil/tipo/filial num trait `ScopesPed` (análogo ao `ScopesFilial`).
- Imagens congeladas guardam cópia JSON de valores, metas e faixas (RNF-02, RN-18), sem FK para os cadastros.
- A API de leitura atual (`/api/ped/indicadores`, `/filiais`, `/dados-externos`) **não muda de contrato**; a tela temporária de conferência continua funcionando.

## 3. Modelo de dados

Nomes provisórios. A tabela existente `ped_indicadores` (catálogo de métricas do ERP) **mantém o nome**; o "indicador" do documento é a tabela nova `ped_indicador_cadastro`.

| Tabela | Conteúdo | Requisitos |
|---|---|---|
| `ped_tipos_apontamento`, `ped_tipo_colaborador` | 7 fixos + personalizados; vínculo com usuários | RF-12 a RF-16 |
| `ped_apontamentos` | nome, tipo, tipo de valor, ativo, quem ativou/desativou | RF-17 a RF-22 |
| `ped_lancamentos`, `ped_lancamentos_historico` | valor por apontamento × filial × mês; correções com motivo | RF-66 a RF-70 |
| `ped_dado_externo_cadastro` | nome, tipo, origem, identificador (→ `ped_indicadores.codigo`/operação do WS), referência (filial/colaborador/zona), coleta, sentido, janela, situação | RF-23 a RF-31 |
| `ped_indicador_cadastro`, `ped_indicador_apontamentos` | composição (apontamentos **ou** um dado externo), sentido, meta, meta editável | RF-32 a RF-40 |
| `ped_metas_ajustadas` | meta por indicador × filial × mês, com motivo | RF-71 a RF-74 |
| `ped_dashboards`, `ped_dashboard_indicadores`, `ped_dashboard_vinculos`, `ped_dashboard_historico` | periodicidade, vínculo, pontos base, fórmula, histórico | RF-47 a RF-59 |
| `ped_faixas`, `ped_faixas_versoes`, `ped_faixas_linhas` | tabela por dashboard × filial, versionada | RF-41 a RF-46 |
| `ped_periodo_aberto` | mês aberto, quem abriu, quando | RF-75, RF-76 |
| `ped_encerramentos`, `ped_imagens` | lote ENC-xxxxxx e imagem congelada | RF-77 a RF-84 |
| `ped_tarefas_bitrix` | tarefas de construção/modificação e status | INT-04 |

## 4. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| 0 | Decisões fechadas e este plano | feito |
| 1 | Perfis (`ped_perfil`), `ScopesPed`, tipos de apontamento, período aberto | **feito em 2026-10-28** |
| 2 | Apontamentos e lançamentos (cadastro, ativar/desativar, lançar, corrigir, histórico) | **feito em 2026-10-28** |
| 3 | Dados externos: cadastro ligado à coleta dos WS (INT-03); referência Filial por ora | **feito em 2026-10-28** |
| 4 | Indicadores: composição, metas, edição de meta por filial/mês (meta só manual por ora, P-15) | **feito em 2026-10-28** |
| 5 | Faixas com versões e histórico (feita depois da 6, porque pertence a um dashboard) | **feito em 2026-10-28** |
| 6 | Dashboards: cadastro, vínculo, pontos base, histórico (feita antes da 5, porque as faixas pertencem a um dashboard) | **feito em 2026-10-28** |
| 7 | Fechamentos: `PedCalculoService`, pré-visualização, encerramento em lote, imagens congeladas (P-08 e P-10 respondidas pelo negócio) | **feito em 2026-10-28** |
| 8 | Bitrix24 (INT-04) | **em standby (a pedido)**; precisa das credenciais e de P-06 |
| 9 | Início (resumos) e documentação final da API | **feito em 2026-10-28** |

Cada fase entrega migration, models, controller, rotas, atualização de `API.md`/`PED.md` e testes. O projeto ainda não tem testes automatizados; o cálculo da fase 7 (RN-01 a RN-10) será o primeiro a ganhar PHPUnit.

## 5. Riscos e pontos em aberto

- Coleta por **colaborador** e **zona de venda** (decisão C): os WS atuais devolvem só por filial. Precisa de consulta nova na Senior; até lá, esses dados externos podem ser cadastrados, mas ficam sem valores.
- Mapeamento dos perfis do PED para os papéis atuais (`admin`/`gerente`/`coordenador`/`vendedor`): decidir quem é Validador e quem é Preenchedor.
- P-08 e P-10 afetam o cálculo da fase 7; as respostas do responsável do projeto (Leonardo Norio) podem mudar o desenho.
