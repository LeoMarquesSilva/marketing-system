# SDD ledger — plan: docs/superpowers/plans/2026-07-28-perfil-publico-framer-motion.md

Baseline: 37/37 focused profile tests passing.
Workspace: current feature branch, explicitly approved by user because profile changes are uncommitted.
Commit policy: do not create commits unless the user explicitly asks.

Task 1: minor (deferred): relatório chama o teste de pré-existente, embora ele tenha sido criado pelo agente interrompido da mesma task.
Task 1: complete (sem commits, review clean; 2/2 testes passando).
Task 2: fix round 1/5 (2 addressed, 0 open — contraste dourado 5,21:1; halo 0.11; sem commits).
Task 2: complete (sem commits, review clean; 17/17 testes passando).
Task 3: fix round 1/5 (1 addressed, 0 open — movimento reduzido neutralizado em cards e seta; sem commits).
Task 3: complete (sem commits, review clean; 39/39 testes passando).
Task 4: minor (deferred): posição acima da dobra inferida estaticamente, sem medição real de viewport.
Task 4: complete (sem commits, review clean; lint/build/41 testes/HTTP 200 verificados).
Final review: fix wave corrigiu SSR, foco duplicado, movimento reduzido, AuthGuard público e overflow; 46/46 testes, lint e build passando.
Final review: BLOCKED — correção de SSR tornou os wrappers Framer Motion visualmente inertes; decisão necessária entre restaurar movimento progressivo pós-hidratação ou remover a camada.
Human decision: restaurar movimento progressivo pós-hidratação com SSR visível.
Final resolution: complete (47/47 testes, lint/build, Edge 320/390/1440 e reduced motion; final re-review Ready: Yes).

