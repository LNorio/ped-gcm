# PED — meta do indicador buscada via API: proposta de implementação para o back-end

Proposta do front-end, 10/11/2026. **Ainda não implementada no back-end.** O front já está pronto sobre este contrato e passa a funcionar quando as rotas e os campos abaixo existirem.

Base: `API (26).md` (seção "Cadastro e Preenchimento — fase 4: indicadores e metas") e `FRONT-integracao-dado-externo.md`, cuja integração este documento reaproveita.

---

## 1. O que muda para o usuário

Na aba **Indicadores**, a meta pode passar a vir de uma **consulta externa** em vez de ser digitada.

| Onde | O que acontece |
| --- | --- |
| Cadastro do indicador e modal **Definir meta** (Admin e Validador) | Checkbox **"Buscar metas via API"**, desmarcado por padrão. Marcado, ele esconde os campos de meta (meta única, "Replicar a meta para todas as filiais", metas por filial) e a opção "Meta editável no preenchimento". |
| Listagem, logo depois de salvar | Etiqueta **"Integração pendente (TI)"** na linha, e "Via API" na coluna Meta. |
| Menu da linha (**só Admin**) | **"Preencher integração"** enquanto a integração está pendente, e **"Configurações"** depois de salva. Os dois abrem a mesma modal da integração do dado externo: identificador, URL, parâmetros de saída e de entrada, com validação em tempo real. |
| Sinal da aba Indicadores (só Admin) | Também acende quando há indicadores com a integração pendente. |

**Regra do usuário:** meta via API **não pode ser editada à mão**, nem no cadastro nem no preenchimento.

---

## 2. Cadastro: `POST /api/ped/indicadores-cadastro`

Com o checkbox marcado, o front envia `"origem da meta": "terceiro"`, **sem** `meta` e **sem** `metas por filial`, e sempre com `"meta editavel": false`:

```json
{
  "nome": "Faturamento com meta da TI",
  "origem da meta": "terceiro",
  "sentido": "maior_melhor",
  "meta editavel": false,
  "dado externo": 42
}
```

Regras propostas:

- `origem da meta`: o enum já tem `manual` e `terceiro`, e hoje `terceiro` responde `400` (P-15). Proposta: liberar `terceiro`. Se preferirem outro nome (ex.: `api`), avisem, e o front ajusta num ponto só.
- Com `terceiro`:
  - `meta` ou `metas por filial` enviados → `400` ("meta via API não aceita meta manual");
  - `"meta editavel": true` → `400`.
- A composição (apontamentos ou dado externo), o sentido e o cálculo seguem as regras atuais.
- O indicador nasce **ativo**, com a **integração pendente** e sem meta até a integração ser salva e a primeira consulta rodar (ver seção 6).

## 3. Definir meta do indicador automático: `PUT /api/ped/indicadores-cadastro/{id}/meta`

A modal "Definir meta" também tem o checkbox. Marcado, o corpo vai assim:

```json
{ "origem da meta": "terceiro", "sentido": "maior_melhor", "meta editavel": false }
```

As mesmas regras do cadastro valem aqui. Como hoje, a meta só pode ser definida uma vez: depois deste PUT, o indicador sai de "meta a definir" e passa a ter a integração pendente.

---

## 4. Configurações da integração: `PUT /api/ped/indicadores-cadastro/{id}/integracao` (só Admin)

O corpo, as validações e os erros são **os mesmos** de `PUT /api/ped/dados-externos-cadastro/{id}/integracao`:

```json
{
  "identificador": "META_FATURAMENTO",
  "url": "https://ti.exemplo.com.br/api/metas",
  "parametros de saida": "{ \"filial\": \"100\", \"meta\": \"4600000\" }",
  "parametros de entrada": "{ \"filial\": \"%filial%\", \"competencia\": \"%competencia%\" }"
}
```

- **Campos:**
  - `identificador`: letras sem acento, números, `_`, `-` e `.`, com até 60 caracteres, gravado em maiúsculas;
  - `url`: `http://` ou `https://`, sem espaços, com até 500 caracteres;
  - os dois JSONs: texto ou objeto, válidos. O front só aceita **objeto** na entrada.
- **Resposta `200`:** `{ "mensagem": "integracao atualizada", "variaveis usadas": [...] }`. O front trata qualquer 2xx como gravado e recarrega a lista.
- **Erro `400`:** `{ "mensagem", "erros": [{ "campo", "mensagem", "linha"?, "coluna"?, "caminho"?, "expressao"? }] }`, no mesmo formato da integração do dado externo. O front mostra cada erro no campo correspondente.
- **Outras respostas de erro:**
  - `400` se o indicador não tem `origem da meta = terceiro`;
  - `404` se o indicador não existe;
  - `403` para Validador e Preenchedor.
- **Gravação:** guarda quem salvou e quando. Não muda a situação do indicador.
- **Reaproveitado sem mudança:**
  - `POST /api/ped/integracao/validar`, para a validação em tempo real;
  - `GET /api/ped/integracao/variaveis`, para os botões de variáveis.

---

## 5. Listagem: `GET /api/ped/indicadores-cadastro`

Campos novos em cada indicador. Como no dado externo, eles vêm **só para o Admin**; para os outros perfis podem vir ausentes.

| Campo | Conteúdo |
| --- | --- |
| `origem da meta` | `manual` ou `terceiro`. Já existe. |
| `identificador` | Identificador da consulta, ou `null` enquanto não foi configurado. **Necessário** para a modal Configurações abrir preenchida. |
| `url` | URL da consulta, ou `null`. |
| `parametros de saida` / `parametros de entrada` | Objetos JSON salvos, ou `null`. |
| `variaveis usadas` | Lista de nomes, ex.: `["filial", "competencia"]`, ou `[]`. |
| `integracao pendente` | `true` quando `origem da meta = terceiro` e não há integração salva. |
| `integracao alterada em` / `integracao alterada por` | Quando e quem salvou a integração. |

- `meta`, `metas por filial` e `meta a definir`: para indicador `terceiro`, sugerimos `meta: null`, `metas por filial: null` e `meta a definir: false`. O front mostra "Via API" na coluna Meta.
- **`alertas`:** campo novo `"integracao pendente": N`, com a quantidade de indicadores **ativos** com a integração pendente. O front usa no sinal da aba, só para o Admin. Se o campo não vier, o front considera 0.
- **Compatibilidade:** se nenhum desses campos vier, o front trata o indicador como de meta manual. A API atual continua funcionando.

---

## 6. Meta via API no restante do sistema

- **Preenchimento ("Editar metas"):**
  - `GET /api/ped/metas` não deve listar indicadores `terceiro`;
  - `PUT /api/ped/metas` deve recusá-los (`400` ou `403`), porque a meta não é editável à mão.
- **Cálculo, prévia e fechamento:** a meta vigente de um indicador `terceiro`, numa filial e num mês, é a meta devolvida pela consulta. Sem integração salva, ou quando a consulta falha, a filial fica **sem meta**: o dashboard mostra o realizado sem atingimento ("sem meta"), como já acontece com a filial pendente da meta por filial.
- **Dashboards:** hoje "indicador sem meta não entra em dashboard". Proposta: um indicador `terceiro` com integração salva pode entrar. Com a integração pendente, ele fica indisponível, com o motivo "integração da meta pendente".

---

## 7. Pontos a decidir com o back-end

1. **Estrutura da saída.** Que campos a consulta deve devolver? Proposta:
   - `meta` (número), obrigatório;
   - `filial` (código), quando a consulta devolve uma lista com a meta de cada filial;
   - `competencia` (MM/AAAA), opcional, quando a consulta devolve vários meses.

   O back-end valida a saída ao salvar a integração e recusa com `400` o que não tiver `meta`?
2. **Quando a meta é buscada.** Em qual destes momentos a consulta deve rodar:
   - na abertura do mês;
   - na coleta diária, junto com os dados externos;
   - sob demanda, na prévia e no fechamento?

   E a meta buscada é gravada (por filial e mês) ou consultada a cada uso?
3. **Falha da consulta.** Tenta de novo, registra o erro e avisa a TI? Sugestão: guardar `erro da ultima consulta` e `ultima consulta em` e devolvê-los na listagem. O front mostraria isso nos detalhes do indicador numa próxima entrega.
4. **Histórico.** A meta buscada entra no histórico de metas (`metas-historico`) como a origem "API"?
5. **Filtro.** Incluir `situacao=integracao_pendente` na listagem de indicadores, como no dado externo?
6. **Trocar a origem.** Um indicador `terceiro` pode voltar a ter meta manual (e vice-versa)? Hoje o front não oferece essa troca depois de salvo.

---

## 8. Roteiro de teste sugerido

1. Cadastrar indicador com `"origem da meta": "terceiro"` e sem meta: `201`. A listagem traz `integracao pendente: true`, `meta: null` e `alertas["integracao pendente"]` maior ou igual a 1.
2. Enviar `terceiro` junto com `meta`, `metas por filial` ou `"meta editavel": true`: cada caso devolve `400`.
3. Pelo "Definir meta" de um indicador automático, enviar `{ "origem da meta": "terceiro", ... }`: grava. Uma segunda tentativa devolve `400`.
4. `PUT .../integracao` como Admin com os 4 campos válidos: `200`. A integração sai de pendente, e a listagem traz `identificador`, `url`, os JSONs e `integracao alterada em/por`.
5. `PUT .../integracao` com JSON inválido ou URL sem `http`: `400`, com `erros` por campo.
6. `PUT .../integracao` como Validador: `403`. Em indicador de meta manual: `400`.
7. `GET /api/ped/metas` não lista o indicador `terceiro`, e `PUT /api/ped/metas` para ele é recusado.
