# Resposta final: saída da integração é só documentação

Resposta à `RESPOSTA-FRONT-saida-sem-mapeamento.md` (11/11/2026). **Decisão do negócio:** os `parametros de saida` são **somente a documentação da saída esperada do web service**, para o desenvolvedor back-end. É ele quem escreve, no código, a ligação com o web service e as amarrações (qual campo é a filial, o valor, a meta). O sistema, ao salvar, **não identifica nem cobra** nada disso.

Nota de histórico: uma versão anterior desta resposta descrevia uma regra automática por nomes (canônicos e apelidos), o `400` de "não foi possível identificar" e o campo `nomes aceitos`. **Foi retirada antes de chegar ao servidor; nunca esteve em produção.** O que o front já faz (não enviar `campo da ...`) continua certo e não precisa mudar.

## 1. O que o back valida (só formato e tipos)

`parametros de saida` é um objeto `{ "campo": "tipo" }` (ou o texto JSON dele), descrevendo **um item** da resposta. **Qualquer nome de campo vale.**

`400` apenas para:

- JSON inválido (vem com `linha` e `coluna`);
- objeto vazio `{}` ou lista vazia `[]`;
- tipo fora de `string`, `number`, `date`, `boolean` (a mensagem cita a chave, ex.: `o campo "x" da saida tem tipo "texto"; use string, number, date ou boolean`);
- tipo que não é texto (ex.: número ou objeto no lugar do tipo).

## 2. O que o back NÃO valida

Se existe campo de filial, de valor, de meta ou de competência; se há nomes repetidos ou parecidos; se o tipo faz sentido para o papel. Nada de ambiguidade. Os tipos também não rejeitam a resposta real da fonte (o ERP devolve números como texto).

## 3. `campo da filial/valor/meta/competencia`

Se vier no pedido, é **ignorado, sem erro e sem gravar**. `"mapeamento da saida"` continua nas listagens do Admin, mas **sempre `null`**. O `POST /api/ped/integracao/validar` na saída por tipos devolve só `valido`, `formato`, `campos`, `resumo` (sem `mapeamento`); `finalidade` não influencia. `GET /api/ped/integracao/variaveis-saida` perdeu o campo `nomes aceitos` (rota e demais campos intactos).

## 4. Modal

- Sem listas de campo e sem envio dos `campo da ...` (como já está).
- Validar na tela: objeto não vazio e tipos entre os quatro.
- **"Inserir modelo"**, apenas exemplo genérico, sem nomes obrigatórios: `{ "codigo_filial": "string", "quantidade": "number", "data": "date" }`. O mesmo modelo serve para dado externo e indicador.
- Texto de ajuda sugerido: *"Descreva um item da resposta do web service com o tipo de cada campo. É só referência para a equipe de desenvolvimento; os nomes são livres."*
- Exibir a `mensagem` de cada item de `erros` junto ao campo de saída. Formato de sempre: `400 { "mensagem": "integracao invalida: ...", "erros": [{ "campo": "parametros de saida", "mensagem": "..." }] }`. Exibir, não interpretar o texto.

## 5. Formato antigo

Saída em **lista** (com valores ou marcadores `%filial%`, `%valor%`...) continua aceita e inalterada, com as regras de antes (item com `filial` e `valor`/`meta`). Pela forma: objeto = por tipos, lista = antigo. Integração salva em lista abre com aviso e só migra se reescrita como objeto.

## 6. O que continua igual

Entrada, URL, `tipo de servico`, identificador, regra dos números ambíguos (`1.500` falha a consulta), agenda. O executor genérico segue **desligado** (`PED_EXECUTOR_ATIVO=false`); quando ligado, resolve a ligação por nome em tempo de execução, em melhor esforço, e registra erro claro na fonte se não conseguir. A ligação definitiva é código do dev back-end.
