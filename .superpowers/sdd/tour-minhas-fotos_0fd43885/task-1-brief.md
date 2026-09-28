# Task 1 — Domínio e testes do tour de Minhas fotos

## Objetivo
Criar a configuração e a lógica pura de elegibilidade/passos do tour de “Minhas fotos”, seguindo o padrão existente em `src/lib/newsletter-tour.ts`.

## Requisitos
- Trabalhar com TDD: criar primeiro testes falhando e depois a implementação mínima.
- Criar `src/lib/minhas-fotos-tour.ts`.
- Criar o respectivo arquivo de testes no padrão da suíte Vitest do projeto.
- Cobrir explicitamente:
  - primeiro acesso com fotos: abre automaticamente;
  - tutorial já concluído: não abre automaticamente;
  - reabertura manual/forçada: abre mesmo quando concluído;
  - usuário que precisa trocar a senha: não abre automaticamente;
  - galeria vazia: não abre automaticamente e permanece elegível para um acesso futuro com fotos.
- Definir a configuração dos 7 passos aprovados:
  1. boas-vindas;
  2. cabeçalho;
  3. galeria;
  4. sessão;
  5. opções de uso;
  6. “Foto dos sistemas do escritório”;
  7. ações/finalização.
- A lógica deve permitir filtrar passos condicionais cujos targets não existam, sem quebrar a sequência.
- Não implementar UI, endpoint, persistência ou migration nesta tarefa.

## Restrições globais
- Preservar a semântica interna `slug = oficial` e `is_official`.
- Não editar o arquivo do plano.
- Não criar commit; as alterações devem permanecer na working tree.
- Não alterar arquivos fora do escopo sem necessidade comprovada.

## Verificação
- Executar apenas os testes novos/relacionados nesta tarefa.
- Registrar no relatório o ciclo RED e GREEN, comandos e resultados.
