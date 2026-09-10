# Calendário e Associação de Responsáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o calendário a entrada padrão do cronograma e oferecer aos gestores uma visão segura para associar nomes abreviados ou reatribuir tarefas de pessoas inativas.

**Architecture:** A classificação de pendências será uma função pura testável, alimentada pelo cronograma importado e pelo cadastro ativo/inativo do RH. Uma API autenticada retornará pendências do ano e fará associação em lote com regras diferentes para identidade histórica e substituição futura. A interface será dividida em calendário, lista e responsáveis, preservando os filtros e o editor existentes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase service-side, Radix/shadcn, Lucide e Vitest.

## Global Constraints

- O calendário abre por padrão; a lista continua disponível.
- Desktop usa grade mensal de segunda a domingo; mobile usa agenda agrupada por dia.
- Associação de nome abreviado a uma pessoa ativa atualiza tarefas passadas e futuras daquele nome, pois confirma uma identidade.
- Ex-colaborador, pessoa que mudou de área e “a definir” só podem ser substituídos em tarefas futuras não canceladas; histórico não é reatribuído.
- Marketing/admin vê todas as áreas; gestores veem e alteram somente seus escopos do Férias; colaboradores sem gestão não veem a aba de responsáveis.
- Nenhuma sugestão é aplicada automaticamente. O gestor confirma a pessoa e vê a quantidade afetada.
- Não criar dependências novas nem alterar a publicação Git/Vercel.

---

### Task 1: Classificação de pendências de responsável

**Files:**
- Create: `src/lib/content-schedule/assignee-issues.ts`
- Create: `src/lib/content-schedule/assignee-issues.test.ts`
- Modify: `src/lib/content-schedule/types.ts`

**Interfaces:**
- Consumes: slots importados, usuários e colaboradores do RH.
- Produces: `classifyScheduleAssigneeIssues(input): ContentScheduleAssigneeIssue[]` com `reason`, contagens passadas/futuras e sugestão opcional.

- [x] Escrever testes para nome abreviado com candidato ativo único, ex-colaborador, mudança de área, placeholder e ambiguidade.
- [x] Executar o teste e confirmar falha antes da implementação.
- [x] Implementar normalização de nomes, associação conservadora e agrupamento por área+nome original.
- [x] Executar testes e lint do domínio.

### Task 2: API segura de consulta e associação em lote

**Files:**
- Modify: `src/lib/content-schedule/server.ts`
- Create: `src/app/api/content-schedule/assignees/route.ts`
- Create: `src/app/api/content-schedule/assignees/route.test.ts`

**Interfaces:**
- Produces: `GET /api/content-schedule/assignees?year=2026` e `POST /api/content-schedule/assignees`.
- POST: `{ area, source_name, collaborator_id, mode: "identity" | "future_replacement" }`.

- [x] Escrever testes de validação, acesso por área e diferença entre associação histórica e substituição futura.
- [x] Implementar consulta do ano, classificação e resposta apenas para áreas gerenciáveis.
- [x] Implementar atualização condicional apenas em slots sem responsável e não cancelados; em `future_replacement`, exigir `due_date >= hoje`.
- [x] Validar no servidor que o destino está ativo e pertence à área.
- [x] Executar testes, TypeScript e lint do backend.

### Task 3: Calendário como visão padrão

**Files:**
- Create: `src/components/conteudo/content-schedule-calendar.tsx`
- Create: `src/components/conteudo/content-schedule-calendar.test.tsx`
- Modify: `src/components/conteudo/content-schedule-client.tsx`

**Interfaces:**
- Consumes: `ScheduleSlot[]`, mês e callbacks do cliente existente.
- Produces: grade mensal desktop e agenda mobile, com cartões de formato, área, avatar e alerta de responsável.

- [x] Escrever testes da matriz de dias, tarefas no dia correto e fallback mobile.
- [x] Implementar segunda–domingo, dias externos atenuados, cartões compactos e contador quando houver excesso.
- [x] Adicionar controle `Calendário | Lista | Responsáveis`, iniciando em `calendar` a cada entrada.
- [x] Reusar filtros, indicadores, `AreaMark` e `CollaboratorAvatar` existentes.
- [x] Executar testes de renderização e lint.

### Task 4: Visão de responsáveis pendentes

**Files:**
- Create: `src/components/conteudo/content-schedule-assignee-review.tsx`
- Create: `src/components/conteudo/content-schedule-assignee-review.test.tsx`
- Modify: `src/components/conteudo/content-schedule-client.tsx`

**Interfaces:**
- Consumes: endpoint `/api/content-schedule/assignees` e lista de colaboradores permitidos.
- Produces: cartões agrupados por área com motivo, datas, sugestão e confirmação em lote.

- [x] Escrever testes para textos e ações distintas: “Associar identidade” e “Reatribuir próximas”.
- [x] Implementar estados de carregamento, vazio, erro e sucesso.
- [x] Exibir aviso forte para inativo, aviso de área para transferido e sugestão consultiva para abreviado.
- [x] Após confirmar, recarregar calendário e pendências sem sair da visão.
- [x] Executar testes e lint.

### Task 5: Verificação integrada

**Files:**
- Modify: `docs/content-schedule.md`

- [x] Rodar todos os testes específicos do cronograma.
- [x] Rodar lint dos arquivos alterados e `tsc --noEmit`, registrando falhas preexistentes separadamente.
- [x] Rodar `npm run build` se o restante da árvore estiver compilável.
- [x] Conferir que calendário é a visão inicial, gestores não atravessam áreas e histórico de ex-colaborador não é reatribuído.
- [x] Documentar o novo fluxo e a distinção entre associação e substituição.
