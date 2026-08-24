# Café com Cultura NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar edições mensais, roster, sincronização de ausências do RESPONSUM, check-in autenticado via etiqueta NFC permanente e painel administrativo.

**Architecture:** Reusar `events`/`event_series`, adicionar participantes estruturados e manter o NFC genérico como porta autenticada para uma página dedicada. Toda mutação passa por rotas server-side, com cron idempotente para gerar edições e sincronizar exceções.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vitest, Tailwind/shadcn.

**Spec:** `docs/superpowers/specs/2026-08-24-cafe-com-cultura-nfc-design.md`

## Global Constraints

- A etiqueta é permanente e aponta para `https://marketing-system-xi.vercel.app/cafe-com-cultura`.
- Edições usam a última sexta-feira do mês e janela padrão 09h–12h em `America/Sao_Paulo`.
- Colaborador autenticado só registra a própria presença; APIs administrativas exigem `admin`.
- Não copiar a descrição/motivo do ticket do RESPONSUM.
- Não expor service role, PAT ou qualquer segredo ao navegador ou à configuração NFC.
- Novas tabelas públicas usam RLS e não concedem acesso a `anon`.
- Alterações manuais e sincronizações são auditáveis e idempotentes.

---

### Task 1: Domínio de datas e estados

**Files:**
- Create: `src/lib/cafe-cultura/types.ts`
- Create: `src/lib/cafe-cultura/dates.ts`
- Test: `src/lib/cafe-cultura/dates.test.ts`

**Interfaces:**
- Produces: `lastFridayOfMonth(year, monthIndex)`, `buildCafeWindow(date)`, `getCheckinWindowState(now, opensAt, closesAt)` e `extractCafeEventDate(text, referenceYear)`.

- [ ] Escrever testes para última sexta-feira, virada de ano, extração `DD/MM` e estados antes/aberto/depois.
- [ ] Executar `npx vitest run src/lib/cafe-cultura/dates.test.ts` e confirmar falha.
- [ ] Implementar funções puras sem dependência nova.
- [ ] Reexecutar o teste e confirmar sucesso.

### Task 2: Schema e políticas

**Files:**
- Create: `supabase/migrations/20260824203203_cafe_cultura_attendance.sql`

**Interfaces:**
- Produces: campos de check-in em `events`, tabelas `event_participants` e `event_attendance_sync_runs`, índices, triggers, constraints e RLS.

- [ ] Descobrir a CLI com `supabase --help`; se indisponível, usar `npx supabase --help`.
- [ ] Criar a migration com `supabase migration new cafe_cultura_attendance`.
- [ ] Adicionar schema, RLS restritiva, série `cafe-com-cultura` e template NFC autenticado.
- [ ] Aplicar a SQL em ambiente remoto controlado e executar consultas de verificação.
- [ ] Rodar advisors de segurança/performance e corrigir achados aplicáveis.

### Task 3: Serviço mensal e roster

**Files:**
- Create: `src/lib/cafe-cultura/server.ts`
- Test: `src/lib/cafe-cultura/server.test.ts`

**Interfaces:**
- Consumes: funções de datas e schema da Task 2.
- Produces: `ensureCafeEditions()`, `ensureEventRoster(eventId)`, `getCurrentCafeForUser(profileId, now)` e `registerCafeCheckin(profileId, now, source)`.

- [ ] Escrever testes com cliente Supabase simulado para criação idempotente, roster e check-in repetido.
- [ ] Confirmar falha dos testes.
- [ ] Implementar cliente admin server-only, criação do mês atual/seguinte, lookup de edição e check-in com validação de janela.
- [ ] Atualizar `events.participants_expected` e `participants_actual` após reconciliações.
- [ ] Confirmar sucesso dos testes.

### Task 4: Adaptador e sincronização RESPONSUM

**Files:**
- Create: `src/lib/cafe-cultura/responsum.ts`
- Test: `src/lib/cafe-cultura/responsum.test.ts`

**Interfaces:**
- Produces: `fetchResponsumAbsenceTickets()` e `syncResponsumAbsences(eventId, trigger, actorUserId?)`.

- [ ] Escrever testes de filtro por `cafe_com_cultura`/`justificativa_de_ausencia`, vínculo UUID, fallback por e-mail, tickets duplicados e ticket sem data.
- [ ] Confirmar falha dos testes.
- [ ] Implementar cliente server-only com `RESPONSUM_SUPABASE_URL` e `RESPONSUM_SUPABASE_SERVICE_KEY`.
- [ ] Reconciliar somente expectativa/origem e IDs externos; não persistir descrição.
- [ ] Registrar resumo sanitizado em `event_attendance_sync_runs` e confirmar sucesso dos testes.

### Task 5: APIs do colaborador

**Files:**
- Create: `src/app/api/cafe-com-cultura/current/route.ts`
- Create: `src/app/api/cafe-com-cultura/check-in/route.ts`
- Test: `src/app/api/cafe-com-cultura/check-in/route.test.ts`

**Interfaces:**
- Consumes: `requireAuthenticatedUser`, lookup do perfil e serviço da Task 3.
- Produces: JSON do estado mensal e POST idempotente.

- [ ] Testar 401, usuário inativo, janela fechada, ausência de edição, sucesso e repetição.
- [ ] Implementar respostas estáveis e mensagens em português.
- [ ] Confirmar que nenhum `userId` vindo do cliente é aceito.
- [ ] Executar testes das rotas.

### Task 6: Página mobile de check-in

**Files:**
- Create: `src/app/cafe-com-cultura/page.tsx`
- Create: `src/components/cafe-cultura/cafe-checkin-client.tsx`
- Test: `src/components/cafe-cultura/cafe-checkin-client.test.tsx`

**Interfaces:**
- Consumes: APIs da Task 5.
- Produces: experiência mobile-first com estados de carregamento, autenticação, janela e sucesso.

- [ ] Testar textos/ações dos estados aberto, futuro, encerrado e já registrado.
- [ ] Implementar shell visual, dados do encontro e botão de 44px ou maior.
- [ ] Redirecionar sessão ausente para `/login?next=/cafe-com-cultura`.
- [ ] Confirmar acessibilidade básica e comportamento responsivo.

### Task 7: APIs administrativas e CSV

**Files:**
- Create: `src/app/api/eventos/[id]/attendance/route.ts`
- Create: `src/app/api/eventos/[id]/attendance/roster/route.ts`
- Create: `src/app/api/eventos/[id]/attendance/sync-responsum/route.ts`
- Create: `src/app/api/eventos/[id]/attendance/export/route.ts`
- Test: `src/app/api/eventos/[id]/attendance/route.test.ts`

**Interfaces:**
- Produces: consulta agregada, configuração de janela/corte, correções administrativas, refresh de roster, sync manual e CSV UTF-8 BOM.

- [ ] Testar exigência de admin, validação temporal, correção auditada e escaping CSV.
- [ ] Implementar endpoints com `requireAuthenticatedUser` + `requireAdminUser`.
- [ ] Garantir que a alteração de data não sobrescreva horários customizados sem solicitação.
- [ ] Executar testes das rotas.

### Task 8: Aba administrativa no Evento

**Files:**
- Create: `src/components/eventos/evento-presencas-tab.tsx`
- Modify: `src/lib/eventos.ts`
- Modify: `src/components/eventos/evento-detail-client.tsx`

**Interfaces:**
- Consumes: APIs da Task 7 e `OrgEvent.seriesSlug`.
- Produces: aba condicional `Presenças` para a série `cafe-com-cultura`.

- [ ] Incluir `slug` no relacionamento `event_series` e no tipo `OrgEvent`.
- [ ] Criar KPIs, configuração, busca/filtros, lista com avatar, ações, sync, roster e exportação.
- [ ] Renderizar tabela em desktop e cartões no celular.
- [ ] Tratar 401/403/erro de sync sem expor detalhes técnicos.
- [ ] Executar lint focado e testes existentes de Eventos.

### Task 9: Cron e configuração NFC

**Files:**
- Create: `src/app/api/cron/cafe-cultura-sync/route.ts`
- Modify: `vercel.json`
- Modify: `src/components/nfc/nfc-tag-form.tsx`
- Test: `src/app/api/cron/cafe-cultura-sync/route.test.ts`

**Interfaces:**
- Consumes: geração mensal, roster e sync das Tasks 3–4.
- Produces: rotina protegida por `CRON_SECRET` e template visual no cadastro NFC.

- [ ] Testar cron não autorizado, execução idempotente e falha sanitizada.
- [ ] Implementar cron e agendamento regular.
- [ ] Substituir o modelo genérico de check-in do Café com Cultura pelo destino permanente autenticado.
- [ ] Confirmar que a URL canônica não usa localhost.

### Task 10: Verificação e entrega

**Files:**
- Modify: `.env.example` se existir
- Modify: documentação operacional em `docs/cafe-com-cultura.md`

**Interfaces:**
- Produces: configuração e evidências de funcionamento.

- [ ] Configurar credenciais server-only do RESPONSUM sem imprimi-las.
- [ ] Rodar testes focados e depois `npm test`.
- [ ] Rodar `npx tsc --noEmit`, `npm run lint` e `npm run build`.
- [ ] Consultar banco para verificar edição, roster, RLS, template e contagens.
- [ ] Fazer smoke test móvel do fluxo login → retorno → check-in e do painel admin.
- [ ] Revisar diff, preservar arquivos não relacionados e preparar commit apenas do escopo.

