# Diário de Implementação — PED

## 04/11/2026

**Resumo:** Revisão de qualidade e commit da Fase 4 (aba Apontamentos) e implementação da Fase 5 (aba Dados Externos), com componentização da lógica comum, novo menu de ações, correção do POST contra a API real e aceleração da suíte de testes. Dois commits enviados ao GitHub (`cab66d2` e `aa6018f`).

### Implementações
- Aba Apontamentos (F4.1–F4.6): serviço, listagem com etiquetas e histórico de situação, filtros (busca, situação e tipo, com contagem), cadastro, ativar/desativar e exclusão com bloqueio quando compõe indicador.
- Infraestrutura de consulta e ações (F1.13*): `useConsulta`, `useAcaoConfirmada`, `EstadoCarga`, permissões de ação (`podeAcao`) e prop `obrigatorio` nos campos.
- Aba Dados Externos (F5.1–F5.9): serviço, listagem, filtros pela API, cadastro pelo Admin, pedido de construção à TI, Concluir construção, ativar/desativar e excluir.
- Hooks genéricos `useFiltrosConsulta` e `useAcoesSituacaoExclusao`, além da função `correspondeASituacao` (F1.14*).
- Componente reutilizável `MenuAcoes` (menu de três pontos acessível) (F1.16*).
- Função `limparIdentificador` (só A–Z, 0–9 e "_", em maiúsculas).
- Auxiliares de teste `usuarioRapido()` e `colar()` (`src/test/usuario.ts`) e `src/test/menuAcoes.ts`.

### Modificações
- Busca com espera de 500 ms após a última tecla, e item que deixa de corresponder ao filtro de situação saindo da lista na hora.
- Limites de tempo dos testes: `testTimeout` de 15 s e `asyncUtilTimeout` de 3 s.
- Aba Tipos migrada para `EstadoCarga` e `useAcaoConfirmada`, sem mudança de comportamento.
- Abas Apontamentos e Dados Externos migradas para os hooks genéricos (Apontamentos com −87 linhas).
- 59 arquivos de teste migrados para a digitação sem atraso (suíte de 284 s para 235 s, sem timeouts).
- Correção (F4.7*): POST de apontamento com 2xx passa a significar "gravado", e a lista é sempre recarregada.
- Correção (F5.11*): mesma regra no POST de dado externo, com retorno `{dadoExterno|null, tarefa|null}`.
- Correção: texto duplicado (`<strong>`) no diálogo Concluir construção.
- Diálogos "Novo apontamento" e "Novo dado externo" mais largos (`.dialogo--largo`, 800 px) (F1.15*).
- Tabela de Dados Externos enxuta: cinco colunas foram para os detalhes expandidos, e as ações e o "Ver detalhes" foram para o menu de três pontos.
- Prop `expandidas` (expansão controlada) no componente `Tabela`.
- Cadastro de dado externo: o campo ou cálculo passou a aparecer e ser obrigatório também para o Admin.
- Identificador do dado externo sem acento, espaço ou caractere especial, sem transliteração.
- Aba Apontamentos: as ações foram para o menu "Ações do apontamento X".
- `requisitos.json` e `docs/plano-implementacao.md` atualizados (progresso: 43/102 atividades, 40 requisitos `implementado`).

### Pendências
- Confirmar com o back-end o formato das respostas de POST/PUT/DELETE que seguem estritas (`alterarSituacao`, `concluirConstrucao`, `alterarSituacaoDadoExterno`, `excluirDadoExterno`, criar e editar em `tiposService`).
- Decisões da revisão da F5: botão de fechar no aviso de indicador criado, plural "usado por N dado(s)", aviso sem tipos no formulário e lacunas de teste (`SugestoesIdentificador`).
- Próxima fase: F6 (Indicadores), começando pelo serviço F6.1. Confirmar se a aba usa o `MenuAcoes` e a tabela enxuta.
- Itens bloqueados: F2.7 (A-01), F3.4 e F3.5 (A-02), F5.10 (A-11) e F6.7 (A-09).

---
