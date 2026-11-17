# PDF do fechamento do PED: guia para o front (2026-11-13)

O back-end gera o PDF. O front só chama a rota e entrega o arquivo ao usuário. Contrato completo em `docs/ped/API.md` (seção "PDF do fechamento").

## Rotas (GET, `Authorization: Bearer <token>`; Admin e Validador)

| Onde | Rota |
| --- | --- |
| Consulta de imagens (linha de uma imagem congelada) | `GET /api/ped/imagens/{id}/pdf` |
| Prévia do fechamento (linha de uma unidade) | `GET /api/ped/fechamentos/{id}/previa/pdf?chave=<chave da unidade>` |

`chave` é o campo `chave` que `GET /api/ped/fechamentos/{id}/previa` já devolve em cada imagem (`filial:12`, `colaborador:77`).

## Onde colocar o botão "PDF"

- Na **linha da prévia** (cada unidade ainda não encerrada): chama `previa/pdf` com a `chave` da linha.
- Na **consulta de imagens** (linha de cada imagem congelada): chama `imagens/{id}/pdf`.
- Unidade que já foi encerrada **não** tem PDF de prévia: a rota responde `400` e a mensagem aponta a imagem congelada. Depois de encerrar, atualize a lista e use o botão da imagem.
- Preenchedor não vê o botão (a rota responde `403`).

## Como baixar com o token

O navegador não manda o `Bearer` em um link `<a href>`. Use `fetch` e baixe como arquivo:

```js
async function baixarPdf(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const erro = await r.json().catch(() => ({}));
    throw new Error(erro.mensagem || 'Não foi possível gerar o PDF.');
  }
  const nome = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'PED.pdf';
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

Desde 2026-11-17 o servidor **expõe** o `Content-Disposition` no CORS e a resposta é `inline` (antes `attachment`), com nome novo (`PREVIA_<dashboard>_<periodo>_F<filial>.pdf` ou `<IMG-codigo>_...`); o exemplo acima lê o nome normalmente (o `download` do `<a>` força o salvamento; para abrir em nova aba use `window.open(URL.createObjectURL(blob))`). Também vale `?formato=base64` (devolve o `nome` pronto). Para vários PDFs de uma vez, veja `docs/ped/FRONT-pdf-zip.md`.

```js
const j = await (await fetch(url + '&formato=base64', { headers })).json();
// j['arquivo pdf'] (base64), j.nome, j.mensagem
const bytes = Uint8Array.from(atob(j['arquivo pdf']), c => c.charCodeAt(0));
const blob = new Blob([bytes], { type: 'application/pdf' });
```

(Na rota de imagem congelada use `?formato=base64`; na da prévia `&formato=base64`, pois já existe `?chave=`.)

## Erros (sempre JSON com `mensagem`)

| Código | Quando |
| --- | --- |
| 400 | `chave` ausente ou vazia; `chave` fora do padrão `filial:ID` / `colaborador:ID` (antes era 404; use sempre a chave devolvida pela prévia, sem alterar); dashboard não ativo; ou unidade já encerrada (use o PDF da imagem) |
| 401 | sem token ou token expirado |
| 403 | perfil sem acesso (Preenchedor ou usuário sem perfil no PED); ou usuário restrito a uma filial pedindo a `chave` de outra filial |
| 404 | imagem/dashboard inexistente, ou `chave` no padrão certo mas que não existe na prévia deste dashboard |
| 429 | limite por usuário: 20 PDFs por minuto (as duas rotas de PDF dividem o contador) e 60 prévias por minuto: JSON `{"mensagem": ..., "segundos para tentar novamente": N}` e cabeçalho `Retry-After`; desabilite o botão por alguns segundos e mostre a mensagem. A tela de prévia também pode receber 429 se for recarregada em excesso |
| 500 | erro genérico (`erro ao gerar o pdf ...`) |

O PDF tem **número de páginas variável** (no mínimo 3; muitos indicadores fazem as tabelas continuar na página seguinte); a numeração "Página N de M" fica no rodapé de todas as páginas. Não presuma 3 páginas.

## Encerramento: filiais sem composição

`POST /api/ped/fechamentos/{id}/encerrar` (continua `201`) ganhou, dentro de `resumo`:

```json
"resumo": {
  "filiais sem composicao": ["100", "101"],
  "avisos": ["Filiais encerradas sem a composicao do Resultado Operacional (DRG): 100, 101."]
}
```

- `filiais sem composicao`: códigos das filiais cujas imagens foram congeladas sem a tabela de composição do DRG (`[]` quando todas têm). A prévia **não** traz esse campo.
- Quando a lista não está vazia, há uma linha a mais em `resumo.avisos`. O encerramento **não** é bloqueado. Sugestão: mostrar esse aviso ao usuário (o PDF dessas imagens sai com a nota "Composição não congelada neste período"). Quem lê `resumo` e ignora campos desconhecidos não quebra.

A geração leva alguns segundos (a prévia recalcula o fechamento): mostre um indicador de carregamento no botão.

## O que mudou nas respostas existentes

- A prévia e a imagem congelada têm uma chave nova, `composicao do resultado` (tabela dos 12 meses; `null` se o DRG estiver desligado ou falhar). Pode ser ignorada pelo front.
- `avisos` passa a trazer "Composicao do Resultado Operacional indisponivel..." enquanto o DRG não estiver configurado no servidor. Se a tela de prévia exibe `avisos`, esse texto aparecerá.
