# PED — tarefas no Bitrix24: o que o front precisa implementar

Quando um **dado externo** ou um **dashboard** é salvo e precisa da TI, o back cria uma tarefa no fluxo **"Dpto TI - Criação de novos indicadores"** do Bitrix24. O front **não** fala com o Bitrix: só chama os endpoints do PED e mostra o resultado.

> Não existe "pedido de indicador": indicadores continuam sendo cadastrados direto por Admin e Validador. O nome do fluxo no Bitrix é só o nome.

---

## 1. Quando uma tarefa é criada

| Ação na tela | Quem | Tarefa |
|---|---|---|
| Cadastrar **dado externo** | **Validador ou Preenchedor** | Sim: `[PED] Construir dado externo: <nome>`. O dado nasce `em_construcao`. |
| Cadastrar **dado externo** | **Admin** | **Não.** O Admin cadastra já `ativo`, com identificador. |
| Cadastrar **dashboard** | Admin e Validador | Sim, sempre: `[PED] Construir dashboard: <nome>`. O dashboard nasce `em_construcao`. |
| **Editar** dashboard com `"enviar tarefa ti": true` | Admin e Validador | Sim: `[PED] Modificar dashboard: <nome>`. O dashboard vai para `em_modificacao`. |
| Editar dashboard sem `"enviar tarefa ti"` | — | Não. |

**Front:** no formulário de dashboard, manter o checkbox **"Enviar tarefa à TI"** na edição. No formulário de dado externo, para Validador e Preenchedor, avisar que "ao salvar, será aberta uma tarefa para a equipe de TI".

---

## 2. O que o back faz ao salvar

1. Grava o dado ou dashboard e registra a tarefa localmente.
2. **Na mesma chamada**, tenta criar a tarefa no Bitrix (espera no máximo 5 segundos).
3. Se o Bitrix estiver fora do ar ou demorar, **o salvamento não falha**: a tarefa fica na fila e uma rotina reenvia a cada 5 minutos, até dar certo.

Por isso a resposta pode trazer a tarefa **já enviada** ou **ainda na fila**. O front deve tratar os dois casos.

### Resposta do cadastro

`POST /api/ped/dados-externos-cadastro` (Validador/Preenchedor), `POST /api/ped/dashboards` e `PUT /api/ped/dashboards/{id}` (com tarefa) trazem o objeto `tarefa`:

```json
{
  "mensagem": "dado externo cadastrado; construcao pedida a TI",
  "id": 42,
  "situacao": "em_construcao",
  "tarefa": {
    "titulo": "[PED] Construir dado externo: Faturamento líquido",
    "descricao": "Sistema de origem: ...\nCampo ou calculo: ...",
    "status": "enviada",
    "id bitrix": "328169"
  }
}
```

| `status` | Significado | `id bitrix` |
|---|---|---|
| `enviada` | A tarefa já foi criada no Bitrix. | número da tarefa |
| `aguardando_envio` | Salvo no PED; o envio ao Bitrix está na fila e será feito em até 5 minutos. | `null` |

Quando não há tarefa (dado externo cadastrado pelo Admin, edição de dashboard sem o checkbox), `tarefa` vem `null`.

**Front:** mostrar uma confirmação como:
- `enviada`: "Tarefa **#328169** criada no Bitrix para a equipe de TI."
- `aguardando_envio`: "Salvo. A tarefa para a TI será criada no Bitrix em instantes." (sem número).

---

## 3. Como mostrar a tarefa nas listagens e no histórico

Dados externos (`GET /api/ped/dados-externos-cadastro`) e dashboards (`GET /api/ped/dashboards`, `GET /api/ped/dashboards/{id}/tarefas`, histórico) já trazem a tarefa mais recente:

```json
"tarefa bitrix": { "id": "328169", "status": "enviada", "titulo": "[PED] Construir dashboard: Vendas" }
```

- `id` é o **número da tarefa no Bitrix**. Enquanto a tarefa não foi enviada, vem `null`.
- `status` do PED: `aguardando_envio` → `enviada` → `concluida`. A `concluida` hoje é marcada **pelo Admin no PED**, ao concluir a construção ou modificação (botão "Concluir"); **não** vem do Bitrix.
- Mostrar o número como `#328169` junto da situação, e um rótulo para `aguardando_envio` (por exemplo "Aguardando envio ao Bitrix"). Se o número for `null`, não montar link.
- Link para abrir no Bitrix, se quiserem: `https://gcm.bitrix24.com.br/company/personal/user/<seu id>/tasks/task/view/<id>/`.

### Dashboards com várias tarefas

Um dashboard acumula tarefas (construção e depois cada modificação). `GET /api/ped/dashboards/{id}/tarefas` lista todas, da mais recente para a mais antiga, com `id`, `status` e `titulo`.

---

## 4. O que **ainda não** existe (não implementar agora)

- **Status vindo do Bitrix** (pendente, em andamento, concluída lá): o back já sabe ler, mas **não devolve** esse dado na API e **não** muda dashboard nem dado externo por causa dele. A conclusão continua sendo manual pelo Admin. Quando a regra for decidida, este documento será atualizado.
- **Aviso do Bitrix para o PED** quando a tarefa muda: previsto, não feito.

---

## 5. Mensagens e casos de borda

- **Bitrix desligado ou fora do ar:** nada muda para o usuário; `tarefa.status` vem `aguardando_envio` e o número aparece depois, na próxima consulta.
- **Reenvio:** nunca cria tarefa duplicada; uma tarefa já enviada não é enviada de novo.
- **Atualizar a tela:** se o front quiser mostrar o número assim que o envio da fila acontecer, basta recarregar a listagem depois de alguns minutos (não há notificação em tempo real).
- **Responsável e prazo:** definidos pelo fluxo do Bitrix; o PED não escolhe. A tarefa aparece como criada por "SISTEMA".
