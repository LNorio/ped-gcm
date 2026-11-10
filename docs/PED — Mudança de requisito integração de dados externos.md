# PED — Mudança de requisito: integração de dados externos

Nov 9, 2026 · @Leonardo Norio

## Resumo

A conclusão da construção de um dado externo pela TI passa a ser feita em uma modal que registra a integração completa: identificador da consulta, URL, parâmetros de saída e parâmetros de entrada. Os mesmos campos podem ser editados depois por um botão **Configurações**.

Hoje a TI informa apenas o identificador da consulta e clica em Ativar. Com a mudança, o PED passa a guardar como chamar a consulta (URL e entrada) e o que esperar de volta (saída), com validação dos JSONs antes de ativar o dado.

## Escopo e perfis

A mudança vale só para a aba **Dados Externos** e só para o perfil Admin (equipe de TI). Preenchedor e validador não veem os botões nem a modal.

| Ação | Quando aparece | Perfil |
| --- | --- | --- |
| Concluir construção | Dado com situação “Em construção (TI)” | Admin |
| Configurações | Dado com situação Ativo ou Inativo | Admin |

Fora do escopo: o cadastro do dado externo, a abertura da tarefa no Bitrix24 e a forma como a consulta é executada no sistema de origem.

## Fluxo

&#91;embedded content: fluxo da integração · 2 entradas, 1 validação, 2 resultados\]

Os dois caminhos usam a mesma modal: “Concluir construção” ativa o dado e cria o indicador, e “Configurações” só atualiza a integração. Enquanto algum campo estiver vazio ou inválido, o botão de salvar fica bloqueado.

## Campos da modal

Todos os quatro campos são obrigatórios e aparecem nesta ordem, com asterisco vermelho no rótulo.

| Campo | Tipo | Regra para ser aceito |
| --- | --- | --- |
| Identificador da consulta | Texto | Não pode ficar vazio; é gravado em maiúsculas |
| URL | Texto | Começa com http:// ou https:// e não tem espaços |
| Parâmetros de saída | JSON | JSON válido com a estrutura que a consulta devolve ao PED |
| Parâmetros de entrada | JSON | JSON válido; variáveis e expressões conforme a seção seguinte |

- Os dois campos JSON têm o atalho **Inserir modelo**, que preenche um exemplo pronto.
- O botão de salvar fica bloqueado enquanto algum campo estiver vazio ou inválido.
- Ao lado do botão aparece o que falta, por exemplo “falta: URL válida, JSON de saída válido”. Com tudo certo, aparece “Todos os campos obrigatórios preenchidos”.

## Parâmetros de entrada

O JSON de entrada aceita variáveis escritas com o nome entre % e expressões matemáticas com números, variáveis numéricas e datas. Cada valor de texto do JSON é resolvido no momento da consulta.

### Variáveis

Abaixo do campo há a lista de variáveis, obtida de uma API de variáveis do PED; clicar em uma insere o texto no ponto do cursor. As variáveis já usadas ficam destacadas.

| Variável | Conteúdo | Tipo |
| --- | --- | --- |
| %filial% | Código da filial | Número |
| %colaborador% | Matrícula do colaborador | Texto |
| %zona% | Código da zona de venda | Texto |
| %mes% | Mês do período (1 a 12) | Número |
| %ano% | Ano do período | Número |
| %competencia% | Competência MM/AAAA | Texto |
| %dataInicial% | Primeiro dia do período | Data |
| %dataFinal% | Último dia do período | Data |
| %hoje% | Data da execução da consulta | Data |
| %diaColeta% | Dia de coleta configurado no dado | Número |
| %mesesRetro% | Meses de periodicidade retroativa do dado | Número |

### Expressões

- **Operadores:** soma +, subtração -, multiplicação \*, divisão /, potência ^, parênteses e sinal negativo. Ao lado da lista há botões para inserir cada um.
- **Ordem de cálculo:** parênteses, depois potência, depois multiplicação e divisão, por último soma e subtração.
- **Números:** aceitam vírgula ou ponto decimal.
- **Datas:** variáveis de data ou datas escritas em dd/mm/aaaa. Data ± número soma ou subtrai dias; com o sufixo m são meses e com a são anos. Data − data dá a quantidade de dias.
- **Meses:** quando o dia não existe no mês de destino, vale o último dia desse mês (31/01/2026 + 1m = 28/02/2026).
- **Textos que não viram conta:** datas sozinhas (dd/mm/aaaa ou mm/aaaa) e textos com letras, como "Filial-%filial%", só recebem a troca das variáveis.

| Expressão | Resultado (exemplo: período 10/2026, 3 meses retroativos) |
| --- | --- |
| "(%mesesRetro% \* 30) - 1" | 89 |
| "%ano% - 1" | 2025 |
| "1000 / 4 + 2,5" | 252,5 |
| "%dataInicial% - 30" | 01/09/2026 |
| "%dataFinal% + 1m" | 30/11/2026 |
| "%hoje% - 1a" | um ano antes da data da execução |
| "%dataFinal% - %dataInicial% + 1" | 31 |

Exemplo de JSON de entrada:

```json
{
  "filial": "%filial%",
  "competencia": "%competencia%",
  "inicio": "%dataInicial% - 3m",
  "fim": "%dataFinal%",
  "dias": "%dataFinal% - %dataInicial% + 1"
}
```

## Validações em tempo real

Os dois JSONs são validados enquanto a TI digita; nada aparece enquanto o campo está vazio.

- **Saída válida:** faixa verde “JSON válido” com os campos encontrados e seus tipos, por exemplo “3 campos: valor (texto), referencia (texto), competencia (texto)”.
- **Saída inválida:** mensagem vermelha “JSON de saída inválido” com a linha, a coluna e a explicação do erro em português.
- **Entrada válida:** faixa verde com as variáveis usadas, os cálculos encontrados e uma prévia do JSON resolvido com valores de exemplo.
- **Entrada inválida:** lista vermelha com todos os erros encontrados.

Erros apontados na entrada:

| Erro | Exemplo |
| --- | --- |
| JSON mal formado | vírgula sobrando, aspas faltando |
| Variável desconhecida | "%foo%" |
| Variável de texto em conta | "%zona% + 1" |
| Parêntese não fechado | "(1 + 2" |
| Operador repetido ou fora de lugar | "3 \* \* 2" |
| Divisão por zero | "5 / 0" |
| Soma de duas datas | "%dataInicial% + %dataFinal%" |
| Data multiplicada, dividida ou elevada | "%dataInicial% \* 2" |
| Data subtraída de um número | "5 - %hoje%" |
| Unidade m ou a sem data | "3m + 1" |
| Data inexistente | "31/02/2026 + 1" |

## Efeitos e critérios de aceite

Concluir a construção ativa o dado e cria o indicador dele; salvar Configurações só altera a integração.

| Botão | O que muda no sistema |
| --- | --- |
| Concluir e ativar | Dado vai para Ativo; grava identificador, URL, saída, entrada e variáveis usadas; cria o indicador do dado aguardando a definição da meta (se ainda não houver um) |
| Salvar configurações | Atualiza identificador, URL e os dois JSONs; registra quem alterou e quando; não muda a situação do dado nem cria indicador; vale para as próximas coletas, sem alterar imagens já congeladas |

Na lista de dados externos, a URL aparece abaixo do identificador da consulta.

### Alerta de integração pendente

Dados externos ativos ou inativos sem integração gravada geram um alerta para a TI (perfil Admin):

- ponto laranja na aba Dados Externos;
- aviso no topo da lista com a quantidade de dados pendentes e o botão “Ver pendentes”;
- etiqueta “Integração pendente (TI)” na linha do dado;
- o botão Configurações aparece como “Preencher integração” até os campos serem salvos;
- opção “Integração pendente (TI)” no filtro de situação.

O alerta some quando a integração é salva.

### Critérios de aceite

- [ ] Dado em construção mostra “Concluir construção” só para o Admin, e o clique abre a modal.
- [ ] Dado ativo ou inativo mostra “Configurações” só para o Admin, e a modal abre com os valores salvos.
- [ ] O botão de salvar fica bloqueado até os quatro campos estarem preenchidos e válidos.
- [ ] URL sem http:// ou https:// não é aceita.
- [ ] JSON de saída inválido mostra o erro com linha e coluna enquanto se digita.
- [ ] Clicar em uma variável ou operador insere o texto no ponto do cursor da entrada.
- [ ] "(%mesesRetro% \* 30) - 1" com 3 meses retroativos resulta 89 na prévia.
- [ ] "31/01/2026 + 1m" resulta 28/02/2026 na prévia.
- [ ] Cada erro da tabela de validações aparece com o campo e a expressão que o causou.
- [ ] Concluir ativa o dado e cria o indicador; salvar Configurações não cria outro indicador.
- [ ] Mensagens de JSON inválido aparecem em português, com linha e coluna.
- [ ] Dado ativo sem integração mostra o alerta e o botão “Preencher integração”; após salvar, o alerta some.

## Decisões

| Ponto | Decisão |
| --- | --- |
| Lista de variáveis | Vem de uma API de variáveis do PED; a lista deste documento é a do protótipo |
| Método HTTP e cabeçalhos | A TI não informa o método nem cabeçalhos na modal |
| Mensagens de JSON inválido | Exibidas em português, com linha e coluna do erro |
| Dados ativos sem integração | O sistema alerta a TI para preencher a integração |
