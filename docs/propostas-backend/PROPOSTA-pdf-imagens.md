# PED — Proposta: imagens em PDF (prévia e imagens congeladas)

> **Respondida pelo back-end em 17/11/2026:** ver `FRONT-pdf-zip.md`, `FRONT-pdf-fechamento.md` e `API (29).md`, seção "PDF do fechamento". As 4 rotas, os nomes e o CORS foram publicados como propostos. Divergências:
>
> - limite de **100 imagens por ZIP** em produção (o `API (29)` cita padrão 50). **Em 17/11/2026 foi pedido ao back-end que retire o limite.** O front passou a avisar quantas imagens serão geradas e que a exibição e o ZIP podem demorar, e mostra "Montando o ZIP com N imagens…" durante a exportação. Um `400` do ZIP continua sendo exibido pela `mensagem`;
> - limites de uso: **20 PDFs/min** e **5 ZIPs/min** (`429`);
> - o Validador vê **todas** as filiais;
> - a prévia é recalculada a cada pedido, sem identificador de cálculo;
> - a fonte é Helvetica;
> - a geração é síncrona.

Proposta do front de 17/11/2026, para a fase de fechamentos ("fase 8" do `API.md`). **Precisa de rotas novas no back-end.** Nenhuma rota existente muda.

## Motivação

Na aba Fechamentos, a pré-visualização mostra as imagens montadas na tela, e não há como baixá-las. O responsável pelo projeto pediu duas coisas, válidas na prévia e também nas imagens congeladas (consulta retroativa):

1. ver **cada imagem em PDF**, para conferir os valores no formato final;
2. um botão **Exportar** com duas opções: **um único PDF**, o da imagem exibida, ou **todos de uma vez**, num ZIP com um PDF por imagem.

O back-end gera os PDFs. Assim o documento fica igual para todos e não depende do navegador, e o front não ganha dependência nova. O front só mostra o PDF embutido (visualizador do navegador) e baixa os arquivos.

## Rotas novas

| Método e rota | Devolve | Acesso |
| --- | --- | --- |
| `GET /api/ped/fechamentos/{id}/previa/pdf?chave={chave}` | `application/pdf`: uma imagem da prévia | Admin e Validador |
| `GET /api/ped/fechamentos/{id}/previa/zip` | `application/zip`: um PDF por imagem da prévia | Admin e Validador |
| `GET /api/ped/imagens/{id}/pdf` | `application/pdf`: uma imagem congelada | Admin e Validador; o Validador só vê a própria filial |
| `GET /api/ped/imagens/zip` | `application/zip`: um PDF por imagem da consulta | Admin e Validador; o Validador só vê a própria filial |

Detalhes de cada rota:

- **`previa/pdf`:**
  - `chave` é a mesma `chave` de cada item de `imagens` em `GET /fechamentos/{id}/previa`.
  - O cálculo é o mesmo da prévia, feito na hora e **sem gravar nada**.
- **`previa/zip`:**
  - Traz todas as imagens que a prévia geraria agora, na ordem de `GET /fechamentos/{id}/previa` (filial e depois colaborador).
- **`imagens/zip`:**
  - Aceita **os mesmos filtros** de `GET /api/ped/imagens`: `filial`, `periodo`, `dashboard`, `tipo`, `id_colaborador` e `busca`.
  - Exporta exatamente o que a consulta lista.

## Respostas de sucesso (`200`)

- **Cabeçalhos:**
  - `Content-Type` é `application/pdf` ou `application/zip`.
  - `Content-Disposition: inline; filename="..."`. O front usa o nome tanto para mostrar quanto para baixar.
- **Nomes sugeridos**, sem acentos nem espaços:
  - PDF da prévia: `PREVIA_<dashboard>_<periodo>_F<filial>[_<colaborador>].pdf`
  - PDF de imagem congelada: `<codigo>_<dashboard>_<periodo>_F<filial>[_<colaborador>].pdf`, por exemplo `IMG-000123_PED-Gerentes_11-2026_F101_Joao-Silva.pdf`
  - ZIP da prévia: `PREVIA_<dashboard>_<periodo>.zip`
  - ZIP da consulta: `IMAGENS_<aaaa-mm-dd>.zip`
  - Dentro do ZIP, cada PDF tem o mesmo nome do PDF avulso.
- **Sem nome no cabeçalho:** o front monta um a partir dos dados que já tem.
- **CORS:** o back-end precisa expor o `Content-Disposition` (`Access-Control-Expose-Headers: Content-Disposition`). Sem isso o front não consegue ler o nome.

## Erros

Os erros seguem o padrão do resto da API: JSON `{ "mensagem": "..." }`, e o front mostra a `mensagem`.

| Status | Quando |
| --- | --- |
| `400` | Dashboard que não está ativo; `chave` ausente ou que não está na prévia; prévia sem imagens a gerar (ZIP vazio); filtros inválidos; ZIP acima do limite (ver abaixo) |
| `401` | Sessão expirada |
| `403` | Preenchedor, ou Validador pedindo imagem de outra filial |
| `404` | Dashboard ou imagem inexistente |

**Limite do ZIP (sugestão).** Até 500 imagens por ZIP. Acima disso, `400` com mensagem como "a exportação tem 812 imagens; o limite é 500. Use os filtros para reduzir". Se o back-end preferir outro limite, basta informar o número.

## Conteúdo do PDF

O PDF segue o layout do protótipo da imagem (RF-83), com o mesmo conteúdo que `GET /imagens/{id}` e os itens de `previa` já devolvem:

1. Título "PED — Programa de Excelência em Distribuição".
2. Na prévia, a marca **"PRÉVIA · ainda não congelada"** (no topo e, se possível, como marca d'água) e a linha "Prévia calculada em dd/mm/aaaa hh:mm com os lançamentos, metas e faixas atuais". Na imagem congelada, o código `IMG-…` e o lote `ENC-…`.
3. Quadros:
   - colaborador e cargo, ou "Filial (sem colaborador vinculado)";
   - filial;
   - período;
   - dashboard;
   - vínculo.
4. Blocos:
   - Resultado Operacional (base da faixa);
   - PED (pontuação total, %);
   - Pontuação (valor calculado, ou "Sem pontuação" com o motivo).
5. Tabela de indicadores: Indicador, Meta, Realizado, % Ating., Pts Base, Pts Real. e a linha TOTAL, com as observações de cada indicador (sem lançamento, inativo etc.).
6. Faixas vigentes (nome e versão) com De, Até, Alíquota e Status, destacando a faixa atingida. Se não houver faixa, o aviso de que a imagem fica sem pontuação.
7. Rodapé:
   - na prévia, "Nada é gravado na pré-visualização";
   - na imagem congelada, "Gerada em dd/mm/aaaa hh:mm por <usuário>".

Formatos pt-BR (RNF-03): vírgula decimal, ponto de milhar, R$ e datas dd/mm/aaaa hh:mm. Página A4 retrato, uma imagem por PDF.

## O que o front faz

- **Prévia** e **visualização da imagem congelada:** o painel da imagem passa a ser o PDF embutido (visualizador do navegador). Filial, colaborador, lista, navegação "Imagem X de N" e "Encerrar" continuam como estão. Cada troca de imagem pede o PDF daquela imagem.
- **Botão "Exportar":**
  - "PDF desta imagem" baixa a rota `.../pdf`;
  - "Todas as imagens (ZIP)" baixa a rota `.../zip`: na prévia, todas as imagens do dashboard; na consulta, as imagens filtradas.
- Enquanto o PDF carrega, o front mostra "Gerando PDF…". Em caso de erro, mostra a `mensagem` e oferece "Tentar novamente".

## Perguntas

1. O limite de 500 imagens por ZIP serve? Se o back-end preferir gerar o ZIP de forma assíncrona (gerar, avisar e baixar), o fluxo muda, e precisamos combinar antes.
2. Na prévia, o PDF pode refazer o cálculo a cada pedido? Se os lançamentos mudarem no meio, o PDF pode divergir da tela. A alternativa é a prévia devolver um identificador do cálculo, válido por alguns minutos.
3. Qual fonte usar no PDF? O front usa Ubuntu, mas qualquer fonte com acentuação completa serve.
