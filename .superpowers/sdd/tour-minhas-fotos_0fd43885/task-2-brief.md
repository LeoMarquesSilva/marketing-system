# Task 2 — Interface do tour de Minhas fotos

## Objetivo
Implementar o tour interativo com spotlight, targets e botão “Ver guia”, montado localmente no módulo `Minhas fotos`.

## Requisitos
- Seguir o padrão visual e de interação já usado pelo tour da Newsletter no projeto.
- Criar `src/components/collaborator-photos/minhas-fotos-tour.tsx`.
- Montar o tour em `src/components/collaborator-photos/minhas-fotos-client.tsx`.
- Adicionar os targets `data-tour` definidos em `src/lib/minhas-fotos-tour.ts`:
  - `mf-header` no cabeçalho do módulo;
  - `mf-gallery` na grade;
  - `mf-session` no elemento de sessão do primeiro card;
  - `mf-usage-options` no conjunto de opções de uso do primeiro card;
  - `mf-official-usage` na opção interna `oficial` do primeiro card;
  - `mf-actions` nas ações do primeiro card.
- Adicionar botão visível “Ver guia” no cabeçalho para reabertura manual.
- O tour deve:
  - usar os 7 passos do domínio;
  - exibir passo atual/total, avançar, voltar, pular e concluir;
  - aceitar Escape para fechar/pular;
  - destacar o target e posicionar o card de forma responsiva;
  - rolar até o target quando necessário;
  - restaurar o foco ao encerrar;
  - filtrar ou aguardar targets condicionais, nunca apontando para elemento ausente;
  - iniciar automaticamente somente depois de fotos e tipos de uso terminarem de carregar e a elegibilidade retornar verdadeira;
  - não iniciar automaticamente com galeria vazia;
  - permitir reabertura manual pelo botão “Ver guia”.
- Nesta tarefa, expor callbacks de conclusão/pulo e encerrar apenas o estado local. A chamada persistente ao endpoint será ligada na Tarefa 3.
- Preservar o comportamento atual de seleção, download, exclusão e usos das fotos.

## Arquivos de referência
- `src/components/content/newsletter-tour.tsx` ou o componente equivalente do tour de Newsletter.
- `src/components/collaborator-photos/minhas-fotos-client.tsx`.
- `src/app/minhas-fotos/page.tsx`.
- `src/components/collaborator-photos/photo-gallery-grid.tsx`.
- `src/lib/minhas-fotos-tour.ts`.

## Restrições globais
- Preservar a semântica interna `slug = oficial` e `is_official`.
- Não editar o arquivo do plano.
- Não criar commit.
- Não implementar migration nem endpoint nesta tarefa.

## Verificação
- Executar testes direcionados existentes e TypeScript ou lint dos arquivos alterados quando viável.
- Registrar arquivos, comandos, resultados e auto-revisão em `task-2-report.md`.
