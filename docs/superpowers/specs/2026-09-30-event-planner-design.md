# Planner por evento

Desenho aprovado pelo usuário em 30/09/2026: quadro, lista e calendário próprios em cada evento, compartilhando tarefas com o Planner geral.

## Comportamento

A aba Tarefas passa a se chamar Planner. Quadro inicial com Pendente, Em andamento e Concluída; arrastar altera apenas status, com alternativa por select. Lista preserva detalhes, edição e exclusão existentes. Calendário mensal inclui tarefas com prazo e a data do evento; tarefas sem prazo ficam numa seção própria. Busca, responsável, status e etapa filtram as três visões. Cartões abrem detalhes editáveis e mostram anexos já vinculados à tarefa, com acesso aos Arquivos do evento.

O Planner geral recebe uma aba Eventos com filtro de evento e as mesmas três visões. A criação exige escolher um evento. As duas telas leem e atualizam event_tasks usando a sessão do usuário e RLS existentes; nenhuma solicitação de marketing é criada automaticamente. O fluxo anterior de solicitar marketing continua opcional e claramente identificado. Recarregar ao voltar à tela ou pelo botão Atualizar evita dados desatualizados entre telas sem depender de Realtime habilitado.

## Integridade e validação

Não alterar dados do evento durante desenvolvimento, não duplicar tarefas, não mudar permissões nem esquema. Falhas de persistência preservam o cartão na coluna anterior e o formulário preenchido. Calendário usa datas locais sem conversão UTC e a referência de hoje de São Paulo. Testar filtros combinados, virada de ano, fevereiro bissexto, tarefas sem prazo, erro de gravação e telas pequenas. Build, TypeScript e lint devem passar antes da publicação autorizada.
