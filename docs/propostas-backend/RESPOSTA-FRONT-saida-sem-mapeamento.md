# PED — parâmetros de saída sem mapeamento: decisão do negócio

Resposta do front-end a `FRONT-saida-chave-tipo.md` (11/11/2026). **Muda o contrato da opção B.**

## 1. Decisão do usuário

Os **parâmetros de saída servem só para mostrar ao back-end qual é a saída esperada do web service**, campo a campo e com o tipo de cada um:

```json
{ "codfil": "string", "vlrLiq": "number", "filial": "number", "valor": "number" }
```

**Não há amarração na modal.** A TI não escolhe na tela qual campo é a filial, o valor, a meta ou a competência. O front:

- **remove** as listas "Campo da filial", "Campo do valor", "Campo da meta" e "Campo da competência";
- **não envia** `campo da filial`, `campo do valor`, `campo da meta` nem `campo da competencia` em `concluir`, `integracao` (dado externo e indicador) e `validar`;
- valida a saída **só na própria tela**: objeto `{ "campo": "tipo" }` não vazio, com os tipos `string`, `number`, `date` e `boolean`. A saída **deixa de ir para `POST /api/ped/integracao/validar`**, que continua sendo usado para a entrada.

## 2. O que precisamos do back-end

1. **Aceitar a saída sem mapeamento:**
   - em `PUT .../concluir` e `PUT .../integracao` (dado externo e indicador), aceitar `parametros de saida` como objeto `{ chave: tipo }` sem os campos `campo da ...`;
   - não devolver mais os `400` "informe o campo da filial", "informe o campo do valor" e "informe o campo da meta".
2. **Fazer a correspondência do lado do back-end.** Com a saída descrevendo os campos e os tipos, o back-end precisa definir como lê a filial, o valor ou a meta e a competência na resposta real do web service. Na resposta anterior, vocês observaram que a identificação só pelo nome não se sustentava, porque cada fonte nomeia os campos de um jeito. Opções para avaliar, todas sem nada na tela:
   - convenção de nomes nas chaves da saída (por exemplo, `filial`, `valor`/`meta` e `competencia` sempre presentes com esses nomes, como no exemplo acima);
   - um mapa por fonte no próprio back-end (configuração da TI no servidor);
   - deduzir pelo tipo e pela posição, quando for inequívoco.

   **Nos informem qual regra vale**, para a modal poder orientar a TI com o texto de ajuda e o "Inserir modelo".
3. **Ambiente de testes:** hoje o `POST /api/ped/integracao/validar` desse ambiente ainda responde "a saida precisa ser uma lista (entre colchetes)..." para uma saída em objeto. Parece estar sem a versão da opção B. Como a saída deixa de ser validada no servidor, isso deixa de afetar a modal. Mesmo assim, o `concluir` e o `integracao` precisam aceitar o objeto ao salvar.

## 3. O que continua igual

- **Na saída:** os tipos aceitos, o resumo "N campos: …" e o aviso de formato antigo. Uma integração salva em lista abre com um aviso e só é salva depois de reescrita no formato `{ "campo": "tipo" }`.
- **Fora da saída:** a entrada (com `operacao`/`parametros` e as variáveis), a URL, o identificador, o executor e a regra dos números ambíguos.
