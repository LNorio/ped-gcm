# Front: erros 500 sem detalhe técnico e limite de tentativas de login

Data: 2026-11-11. Vale para toda a API (Premiações e PED).

## O que mudou

### 1. Mensagem do erro 500

Antes, o `500` trazia o texto da exceção (SQL, nome de tabela). Agora traz só a ação que falhou; o detalhe fica no log do servidor.

Antes:
```json
{ "mensagem": "erro ao salvar dados: SQLSTATE[22001]: String data, right truncated ..." }
```
Depois:
```json
{ "mensagem": "erro ao salvar dados" }
```

Outros exemplos: `erro ao consultar usuarios`, `erro ao cadastrar`, `erro ao alterar`, `erro ao deletar` (Colaborador, Dependente), `erro ao cadastrar/alterar/encerrar/excluir` (valores de plano), `falha ao cadastrar dados` (Premiação), `erro ao sincronizar relatorios do erp`.

Exceção: `GET /api/lancamentos` (e a exportação CSV) continua devolvendo `500` com o texto de negócio quando falta valor de plano cadastrado ou o colaborador não tem filial (ex.: `nenhum valor de plano saude para titular cadastrado para esta filial no mes de referencia ...`). Esse texto pode ser mostrado ao usuário.

### 2. Limite de tentativas no login (novo `429`)

`POST /api/valida-usuario`: 5 tentativas por minuto por usuário+IP e 30 por minuto por IP (qualquer usuário). Ao exceder:

```
HTTP 429
Retry-After: 42
```
```json
{
  "mensagem": "muitas tentativas de login - aguarde alguns instantes e tente novamente",
  "segundos para tentar novamente": 42
}
```

## O que o front deve fazer

- **Tela de login:** em `429`, mostrar a `mensagem` e desabilitar o botão por `"segundos para tentar novamente"` segundos (ou pelo cabeçalho `Retry-After`), com contagem regressiva. Não reenviar sozinho.
- **Não repetir em laço:** login automático, refresh de sessão ou qualquer retry automático não pode reenviar `POST /api/valida-usuario` ao receber `429`, `401` ou `404`. Cada reenvio conta como tentativa.
- Mostrar `mensagem` do `500` como está (é genérica). Não faça parsing do texto depois de `erro ao ...`; quem dependia do trecho SQL (por exemplo, para detectar duplicidade) deve usar os `400` de validação, que não mudaram.
- Tratar o `429` como erro com a chave `mensagem` (não `message`).

## O que continua igual

- `401 {"mensagem": "senha incorreta"}` e `404 {"mensagem": "usuario nao encontrado"}` no login; ambos contam como tentativa.
- Login correto devolve `200` com token e zera o contador do usuário+IP.
- `400` (com `mensagem`/`erros`), `403`, `404` de negócio e todos os formatos de sucesso.
- A chave dos erros da API é `mensagem`.

## Atenção: respostas do próprio Laravel usam `message`

Não foram alteradas e continuam em inglês e com a chave `message`:

- `401 {"message": "Unauthenticated."}` (token ausente/inválido). Só vem como JSON se a requisição enviar `Accept: application/json`; sem esse cabeçalho o Laravel responde `302` (redirecionamento).
- `404` de rota inexistente e `405` de método não permitido: `{"message": "..."}`.

O front deve tratar `message` e `mensagem` ao exibir erros genéricos (ou apenas usar o status HTTP).
