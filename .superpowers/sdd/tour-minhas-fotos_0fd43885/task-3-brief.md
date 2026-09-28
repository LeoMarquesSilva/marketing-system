# Task 3 — Persistência do tour de Minhas fotos

## Objetivo
Persistir conclusão ou pulo do tour por usuário, expor o campo no perfil autenticado e integrar a UI ao endpoint.

## Requisitos de código
- Criar `POST /api/account/minhas-fotos-tutorial-completed`, seguindo as rotas de conclusão de Newsletter/Meus clientes.
- Autenticar com o cliente server-side; retornar `401` sem usuário.
- Não expor a service role ao cliente.
- Atualizar somente a linha de `public.users` cujo `auth_id` corresponda ao usuário autenticado.
- Persistir `minhas_fotos_tutorial_completed_at` com timestamp ISO e devolvê-lo na resposta.
- Adicionar `minhas_fotos_tutorial_completed_at?: string | null` ao `AuthProfile` e a outros tipos de usuário relevantes.
- Incluir o campo no `select` de `fetchProfile`.
- Em `MinhasFotosClient`, usar o mesmo fluxo para “Pular” e “Concluir”: fechar localmente, fazer `POST` com `credentials: "include"` e chamar `refreshProfile`.
- Uma falha de persistência não deve bloquear o uso do módulo nem deixar o tour preso.
- Adicionar teste direcionado para a rota/persistência, cobrindo pelo menos usuário não autenticado, sucesso e erro de banco/configuração coerente com o padrão existente.

## Migration local
- Criar `supabase/migrations/20260814170000_users_minhas_fotos_tutorial_completed_at.sql`.
- SQL idempotente:
  - adicionar `public.users.minhas_fotos_tutorial_completed_at timestamptz` com `IF NOT EXISTS`;
  - adicionar comentário descritivo na coluna.
- Este arquivo documenta a alteração remota. A aplicação no banco será feita exclusivamente pelo MCP `user-ORQESTRAI` pelo controlador.

## Restrições globais
- Não alterar o slug interno `oficial`, `is_official` nem projeções de avatar/NFC.
- Não editar o arquivo do plano.
- Não criar commit.
- Não aplicar SQL por CLI nem usar outro projeto Supabase.

## Verificação
- TDD para a rota: RED antes da implementação e GREEN depois.
- Executar testes direcionados, TypeScript e lint dos arquivos alterados.
- Registrar RED/GREEN, arquivos, comandos, resultados e auto-revisão em `task-3-report.md`.
