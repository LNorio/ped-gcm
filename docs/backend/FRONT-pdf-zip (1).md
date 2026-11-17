# PDF em ZIP e novos nomes de arquivo: guia para o front (2026-11-17, já em produção, sem limite de imagens)

Resposta à `PROPOSTA-pdf-imagens` (17/11/2026). Contrato completo em `docs/ped/API.md` (seção "PDF do fechamento"). Só Admin e Validador; Preenchedor recebe `403`.

## O que mudou

1. **Rotas novas (GET, `Authorization: Bearer`)**
   - `GET /api/ped/fechamentos/{id}/previa/zip`: um PDF por unidade da prévia do dashboard.
   - `GET /api/ped/imagens/zip`: um PDF por imagem congelada da consulta. Aceita os **mesmos filtros** de `GET /api/ped/imagens` (`filial`, `periodo`, `dashboard`, `tipo`, `id_colaborador`, `busca`): mande os da tela.
2. **PDF avulso** (`previa/pdf`, `imagens/{id}/pdf`) agora vem com `Content-Disposition: inline` (antes `attachment`) e **nome novo**. Com `?formato=base64`, o `nome` do JSON também mudou.
3. **CORS** passa a expor `Content-Disposition`: o `fetch` lê o nome do arquivo direto do cabeçalho.

## Nomes (sem acento, só `A-Z a-z 0-9 _ - .`)

| Arquivo | Nome |
| --- | --- |
| PDF da prévia | `PREVIA_<dashboard>_<periodo>_F<filial>[_<colaborador>].pdf` |
| PDF de imagem congelada | `<IMG-codigo>_<dashboard>_<periodo>_F<filial>[_<colaborador>].pdf` |
| ZIP da prévia | `PREVIA_<dashboard>_<periodo>.zip` |
| ZIP da consulta | `IMAGENS_<aaaa-mm-dd>.zip` |

Espaço e barra viram hífen (`11/2026` vira `11-2026`). `_<colaborador>` só aparece em unidade de colaborador. Dentro do ZIP, nome repetido ganha `-2`, `-3`. O nome vem **entre aspas** no cabeçalho nos dois formatos: `inline; filename="..."`.

## Respostas às 3 perguntas da proposta

1. **Limite por ZIP:** **sem limite** (decisão de 17/11). A geração é síncrona, sem fila, então um ZIP grande só demora mais: cerca de 0,11 s por PDF no servidor de produção (60 PDFs em ~7 s). O Apache corta a resposta em cerca de 60 s, o que dá em torno de 500 PDFs; acima disso o `fetch` pode falhar por tempo, então mostre o indicador de espera e, se der erro de rede, sugira filtrar. Se um dia o servidor definir `PED_PDF_ZIP_MAX`, volta o `400` `"a exportacao tem N imagens; o limite e M. Use os filtros para reduzir"` (leia o `M` da mensagem).
2. **Quem pode:** Admin e Validador. O Validador **não** é restrito à própria filial: pela decisão de 03/11 (RF-01), Admin e Validador veem todas as filiais. Isso diverge da proposta.
3. **Cálculo da prévia:** a prévia **recalcula a cada pedido**; no ZIP todas as unidades saem do mesmo cálculo (mesmo instante). Não existe identificador de cálculo.

## Outras divergências com a proposta

- A fonte do PDF é Helvetica (a Ubuntu não está disponível no servidor).
- Geração síncrona; não há modo assíncrono.

## O que o front deve fazer

- Botões "Baixar todos (ZIP)" na prévia e na consulta de imagens, chamando as rotas novas com `fetch` + `Bearer` e baixando o `blob`; nome do arquivo em `Content-Disposition`:

```js
const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!r.ok) throw new Error((await r.json().catch(() => ({}))).mensagem || 'Falha ao gerar o ZIP.');
const nome = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'PED.zip';
const a = document.createElement('a');
a.href = URL.createObjectURL(await r.blob());
a.download = nome; a.click(); URL.revokeObjectURL(a.href);
```

- Mostrar carregamento (pode levar até cerca de 20 s com 50 PDFs) e desabilitar o botão durante a chamada.
- PDF avulso: como agora é `inline`, o front escolhe: `download` no `<a>` baixa; abrir o `blob` em nova aba exibe.
- Tratar os erros abaixo mostrando `mensagem`.

## Erros (JSON com `mensagem`)

| Código | Quando |
| --- | --- |
| 400 | sem imagens (`nao ha imagens a gerar na previa deste dashboard` / `nenhuma imagem encontrada para os filtros informados`); dashboard não ativo |
| 401 | sem token ou expirado |
| 403 | Preenchedor ou sem perfil no PED |
| 404 | dashboard inexistente |
| 429 | limite de **5 ZIPs por minuto por usuário**; vem `Retry-After`; desabilite o botão pelo tempo indicado |
| 500 | `erro ao gerar o zip ...` |

## O que continua igual

Rotas, parâmetros, erros e limite (20/min) dos PDFs avulsos; conteúdo do PDF; `?formato=base64` do PDF avulso (só o `nome` mudou). O ZIP não tem `formato=base64`.
