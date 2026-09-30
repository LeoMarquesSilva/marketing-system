# Event Planner Implementation Plan

**Goal:** Implementar o Planner aprovado por evento e a visão consolidada no Planner geral.

**Architecture:** Reutilizar EventoTarefasTab e EventoTaskEditor sobre event_tasks. Componentes separados para quadro, calendário e carregamento consolidado; gravações utilizam CRUD existente e sessão do usuário.

**Tech Stack:** Next.js, React, TypeScript, dnd-kit, Supabase existente, Vitest.

## Constraints

Preservar alterações alheias, dados de produção e permissões. Não copiar participantes nem documentos para Git. Não criar solicitações de marketing automaticamente.

## Tasks

- [x] Acrescentar filtro de etapa e funções de calendário; testar limites mensais, bissexto e combinação de filtros.
- [x] Criar quadro acessível com dnd-kit, detalhes e mudança de status por select. Atualizar estado apenas depois de gravação bem-sucedida.
- [x] Criar calendário mensal com navegação, data do evento, abertura do editor e tarefas sem prazo.
- [x] Integrar visões na aba Planner do evento, anexos vinculados e atualização ao voltar à tela.
- [x] Adicionar leitura paginada com RLS no Planner geral e aba Eventos reutilizando a mesma interface. Permitir criação somente com evento selecionado.
- [x] Executar Vitest focado, ESLint, TypeScript e verificação visual com dados fictícios.

## Verificação

Nove testes focados passaram. Suíte completa: 163 arquivos e 1.175 testes passaram; um teste externo permanece marcado como skipped. Lint dos arquivos alterados, TypeScript e build de produção passaram. O build mantém somente o aviso preexistente de importação dinâmica do face-api. Prévia em memória confirmou arrastar entre colunas, alternativa por select, falha de gravação sem movimento, rascunho preservado, calendário de outubro e responsividade em 390 px. A publicação deve conter somente estes arquivos e ser conferida no domínio final.
