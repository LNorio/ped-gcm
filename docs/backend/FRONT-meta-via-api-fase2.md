# PED — meta via API, fase 2 (executor): o que muda para o front

Complementa `FRONT-meta-via-api-fase1.md`. Contrato completo no `docs/ped/API.md`, seção "Executor das integrações". O PED agora **busca** os dados das fontes cadastradas (decisão do negócio).

## 1. O que muda na tela

- **Estados reais:** `situacao da meta via api` passa a assumir `ok` e `erro` na fonte `integracao` (antes só `integracao_pendente` e `aguardando_consulta`). `erro` traz o texto em `erro da ultima consulta` (só Admin).
- **`meta via api.integracao`** fica `true` quando o executor está ligado no servidor. Enquanto for `false`, mantenha o aviso "a consulta desta fonte ainda não está disponível".
- **`filiais sem meta`** da fonte `integracao` agora lista as filiais sem meta no mês aberto **depois da primeira consulta** (antes da consulta continua `[]`).
- **Dado externo (Admin):** a listagem traz `ultima consulta em` e `erro da ultima consulta`. Vale mostrar "Última consulta" e o erro, como nos indicadores.
- **Dashboard:** a fonte `integracao` agora só entra com **meta no mês aberto**; nova mensagem de `400`: "...ainda nao tem meta no mes aberto (a consulta nao trouxe meta)...".

## 2. Mudanças de contrato (atenção)

1. **A entrada SOAP precisa de `operacao` e `parametros` (ou `chamadas`).** `PUT .../concluir`, `.../integracao` (dado externo e indicador) e `POST /api/ped/integracao/validar` passam a recusar uma entrada sem esse formato (erro em `parametros de entrada`; no `validar`, `campo: ""`). Com `tipo de servico: "rest"` não se cobra. **O "Inserir modelo" da entrada deve gerar:**
   ```json
   { "operacao": "NomeDaOperacao", "parametros": { "EDatIni": "%dataInicial%", "EDatFim": "%dataFinal%", "ECodEmp": "%empresas%" } }
   ```
   Para várias chamadas da mesma operação: `{ "operacao": "...", "chamadas": [ { "parametros": { ... } }, { "parametros": { ... } } ] }`.
2. **Saída com marcadores (o que o front ia ajustar):** a saída aceita os nomes literais **ou** marcadores nos valores. Exemplo para o indicador:
   ```json
   [ { "codfil": "%filial%", "metVlr": "%meta%" } ]
   ```
   Para o dado externo: `[ { "codfil": "%filial%", "vlrLiq": "%valor%" } ]`. A validação local pode aceitar os dois jeitos; o back valida igual (`POST /api/ped/integracao/validar`). `GET /api/ped/integracao/variaveis-saida` (Admin) devolve a lista dos marcadores: `%filial%`, `%valor%`, `%meta%`, `%competencia%`.
3. **Variáveis numa chamada que traz todas as filiais:** `%filial%` **não tem valor** (a consulta é uma só para todas). Use `%empresas%`. O back recusa a execução com a mensagem "use %empresas%" (aparece em `erro da ultima consulta`).

## 3. Cuidados com os números da fonte

Se a fonte devolve `1.500` (ponto e três dígitos, sem vírgula), o executor **não adivinha** (1,5 ou 1500): a consulta falha com "valor ambiguo" em `erro da ultima consulta`. A TI precisa devolver `1500` ou `1500,00`.

## 4. Roteiro de teste

Só funciona com o executor ligado no servidor e uma fonte SOAP real; o fluxo de cadastro e de validação (itens 1 e 2 da seção 2) pode ser testado já. No servidor, a TI roda `php artisan ped:executar-integracoes --simular` para ver as chamadas antes de ligar.