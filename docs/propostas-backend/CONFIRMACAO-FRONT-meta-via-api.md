# PED — meta do indicador via API: confirmação do front

Resposta à `RESPOSTA-FINAL-meta-via-api.md`, 10/11/2026. **OK do front para a fase 1.** O front já está adequando a tela ao contrato final.

## Os quatro pontos da seção 7

1. **Enum `fonte da meta`** (`dado_externo` / `integracao`) no lugar do booleano: **atende.**
   - Na tela, o checkbox "Buscar metas via API" continua o mesmo.
   - Quando o dado externo escolhido tem `fornece meta: true`, aparece a opção **"Meta vinda do dado externo"**, marcada por padrão. Ela envia `dado_externo`; desmarcada, envia `integracao`.
   - Com apontamentos, o envio é sempre `integracao`.
2. **`aguardando_consulta` e a `tarefa` na listagem: atende.** A listagem mostra:
   - uma etiqueta para cada estado de `situacao da meta via api`: "Integração pendente (TI)", "Aguardando primeira consulta", "Erro na consulta da meta" e "Sem meta no mês";
   - a tarefa do Bitrix como nos dados externos: "#N" ou "Aguardando envio ao Bitrix";
   - a etiqueta "Meta pendente em N filiais" para as `filiais sem meta`.
3. **`meta via api.integracao` basta: atende.** Com `false`, o cadastro com a fonte `integracao` mostra o aviso: "A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá ser configurada; a meta chegará quando a consulta for liberada."
4. **Saída em lista: atende**, nas duas modais de integração, a do dado externo e a do indicador.
   - **Validação local:** a saída precisa ser uma lista, e cada item precisa de `filial` e de `valor` (dado externo) ou `meta` (indicador).
   - **"Inserir modelo":** gera uma lista de exemplo com o campo certo para cada caso.
   - **Na modal:** um texto orienta o formato.

## Também adequado

- **Fonte `dado_externo` (Admin):** a ação **"Ver integração do dado externo"** abre a integração do dado externo só para leitura.
- **Menus e etiquetas da integração:** "Preencher integração" / "Configurações" e a etiqueta "Integração pendente (TI)" ficam só na fonte `integracao`.
- **Variáveis:** `%empresa%` e `%empresas%` entram na lista vinda da API. Os valores de exemplo da prévia são `1` e `1,6,7,8,9`, e `%empresas%` não entra em conta.
- **Formulário de dashboard:** um indicador da fonte `integracao` sem integração salva, ou ainda sem a primeira consulta, aparece **indisponível** com o motivo. O `400` do back-end com o motivo também é exibido.
- **"Editar metas":** o `403` será tratado quando a janela for implementada (F9.9).
- **`tipo de servico`:** não é enviado, porque o back-end assume `soap`.
