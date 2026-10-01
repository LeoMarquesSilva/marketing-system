# Orçamento e convidados do evento

A descrição da despesa passa a ser a informação principal do orçamento. Fornecedor e categorias específicas aparecem como contexto; categorias genéricas não ocupam uma coluna repetitiva. Busca considera descrição, categoria e fornecedor, com filtro por pagamento. Os valores e registros financeiros permanecem intactos.

Convidados recebe duas entradas com revisão da seleção: colaboradores ativos do cadastro de RH (incluindo pessoas sem conta de acesso) e pessoas/contatos marcados com `partyInvite` em Meus Clientes. O segundo fluxo reutiliza o serviço e as regras de escopo de Meus Clientes: somente administradores recebem a visão completa. Não altera a classificação na origem e não envia convites.

O endpoint exige autenticação ativa, acesso ao módulo Eventos e existência do evento pela sessão. Aceita somente origem e identificadores; nomes e contatos são recarregados da fonte autorizada antes da escrita. Preserva convidados existentes, detecta duplicados por origem/e-mail ou nome completo e empresa quando não há e-mail. IDs determinísticos por evento e origem evitam sobrescrita nas repetições e nas importações simultâneas da mesma origem. Não há alteração de esquema ou políticas de acesso.

Validação: testes de deduplicação, seleção explícita para a festa, permissões, origem alterada, falhas de persistência, colaboradores sem conta, avatares e identificadores estáveis. Interface local com dados fictícios: seleção do escritório inteiro, inclusão em lote, preservação de confirmação anterior, erro de importação mantendo seleção, importação de clientes, busca sem acentos e abertura de edição da despesa. Conferência responsiva em 390 px. Build de produção e ESLint.

Referência de persistência: https://supabase.com/docs/reference/javascript/insert
