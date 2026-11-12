# PED — saída da integração por "chave: tipo": o que o front precisa fazer

Contrato **final** (11/11/2026). Os `parametros de saida` são **só a documentação da saída esperada do web service**, para o desenvolvedor back-end. O sistema valida o formato e os tipos; **não identifica** filial, valor, meta nem competência. Detalhes da decisão em `RESPOSTA-saida-sem-mapeamento.md`; contrato completo em `API.md`.

## 1. Onde vale

`PUT /api/ped/dados-externos-cadastro/{id}/concluir`, `PUT .../{id}/integracao`, `PUT /api/ped/indicadores-cadastro/{id}/integracao` e `POST /api/ped/integracao/validar`.

```json
{
  "identificador": "VOLUME_MANN",
  "url": "https://...?wsdl",
  "parametros de saida": { "codigo_filial": "string", "quantidade": "number", "data": "date" },
  "parametros de entrada": { "operacao": "...", "parametros": { } }
}
```

## 2. Regras

- **Objeto** `{ "campo": "tipo" }` = formato por tipos (descreve **um item** da resposta). **Lista** (com valores ou marcadores `%filial%`, `%valor%`...) = formato antigo, inalterado. O front decide pela forma. Pode enviar objeto ou texto JSON.
- Tipos aceitos: `string`, `number`, `date`, `boolean` (não existe `integer`). Os nomes dos campos são **livres**.
- `campo da filial`, `campo do valor`, `campo da meta` e `campo da competencia`: se vierem, são **ignorados sem erro** (e não são gravados). A modal não precisa enviar nem ter listas de campo.
- `"mapeamento da saida"` continua nas listagens do Admin, mas é sempre `null`.
- Os tipos não rejeitam a resposta real da fonte (o ERP devolve números como texto).

## 3. Erros (`400`)

Formato de sempre, com todos os erros de uma vez: `{ "mensagem": "integracao invalida: ...", "erros": [{ "campo": "parametros de saida", "mensagem": "..." }] }`. Exibir a `mensagem`, não interpretar o texto. Casos:

- JSON inválido (vem com `linha` e `coluna`);
- saída vazia (`{}` ou `[]`): `a saida precisa descrever ao menos um campo, ex.: { "codfil": "string", "vlrLiq": "number" }`;
- tipo inválido: `o campo "x" da saida tem tipo "texto"; use string, number, date ou boolean`;
- tipo que não é texto (número ou objeto no lugar do tipo).

Não existe mais erro de "não foi possível identificar o campo" nem de ambiguidade.

## 4. Validação em tempo real (`POST /api/ped/integracao/validar`)

Resposta na saída por tipos (`finalidade` não influencia):

```json
{ "saida": { "valido": true, "formato": "tipos",
  "campos": [{ "campo": "codigo_filial", "tipo": "string" }, { "campo": "quantidade", "tipo": "number" }],
  "resumo": "2 campos: codigo_filial (string), quantidade (number)" } }
```

Com erro: `{ "saida": { "valido": false, "erro": { "mensagem": "...", "linha": null, "coluna": null }, "erros": ["..."] } }`. Sem `mapeamento`. No formato antigo (lista) a resposta é a de sempre, sem `formato`. `GET /api/ped/integracao/variaveis-saida` só serve ao formato antigo (e não traz mais `nomes aceitos`).

## 5. Modal

- Sem listas de campo. "Inserir modelo" genérico: `{ "codigo_filial": "string", "quantidade": "number", "data": "date" }` (o mesmo para dado externo e indicador).
- Ajuda sugerida: *"Descreva um item da resposta do web service com o tipo de cada campo. É só referência para a equipe de desenvolvimento; os nomes são livres."*
- Integração salva em lista: abrir com aviso; só migra se for reescrita como objeto.

## 6. O que continua igual

Entrada (valores e variáveis, inclusive `%empresas%`), URL, `tipo de servico`, identificador, regra de números ambíguos (`1.500` falha a consulta), agenda. O executor genérico segue desligado por padrão e, quando ligado, é melhor esforço (ver `RESPOSTA-saida-sem-mapeamento.md`).
