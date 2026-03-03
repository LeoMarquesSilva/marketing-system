# Contexto do Projeto — Sistema de Eficiência de Marketing

> Documento de referência para o assistente de IA manter contexto entre conversas.
> Última atualização: 02/03/2026 (sessão 3)

---

## Visão Geral

Sistema web interno para gestão de solicitações de marketing, controle de tempo e métricas de eficiência. Usado por designers e gestores da equipe de marketing.

**Stack:**
- Next.js 14 (App Router, Server + Client Components)
- TypeScript
- Tailwind CSS + Shadcn UI + Radix UI
- Supabase (banco de dados + autenticação + RLS)
- @dnd-kit (drag and drop Kanban)
- date-fns (formatação de datas, locale pt-BR)

---

## Estrutura de Arquivos Relevantes

```
src/
├── app/
│   ├── layout.tsx                     # Root layout com AuthProvider + AppLayout
│   ├── globals.css                    # CSS global, custom properties (--primary: #101f2e)
│   ├── planner/
│   │   ├── page.tsx                   # Server component: busca requests, designers, users
│   │   ├── planner-client.tsx         # Client: orquestra Kanban, busca commentStats
│   │   └── loading.tsx                # Skeleton SSR
│   └── solicitacoes/
│       └── ...
│   # REMOVIDO: /nova-solicitacao (page.tsx deletado — criar via modal no Planner)
├── components/
│   ├── layout/
│   │   ├── app-layout.tsx             # Layout: Sidebar + Header + TimerProvider + FloatingTimer
│   │   ├── sidebar.tsx                # Sidebar #101f2e, glassmorphism, tooltips, avatar usuário, logout
│   │   └── header.tsx                 # Header minimalista: breadcrumb por rota + search (sem perfil/logout)
│   ├── planner/
│   │   ├── kanban-board.tsx           # DndContext, passa props para KanbanColumn
│   │   ├── kanban-column.tsx          # Coluna de cards
│   │   ├── kanban-card.tsx            # Card draggável com glassmorphism, live timer, popover de comentários
│   │   ├── kanban-card-detail.tsx     # Modal de detalhes: comentários, alterações, timesheet com cronômetro
│   │   ├── kanban-card-overlay.tsx    # Overlay drag
│   │   └── new-request-dialog.tsx     # Dialog para nova solicitação (substitui /nova-solicitacao)
│   ├── timer/
│   │   └── floating-timer.tsx         # Widget flutuante: running=verde, paused=âmbar, idle=oculto
│   ├── solicitacoes/
│   │   └── request-form.tsx           # Formulário de criação/edição de solicitações
│   └── ui/                            # Shadcn components customizados
├── contexts/
│   ├── auth-context.tsx               # AuthProvider: profile, user, signIn, signOut
│   └── timer-context.tsx              # TimerProvider: status (idle|running|paused), start/pause/resume/stop
├── hooks/
│   └── use-stopwatch.ts               # Hook: retorna string HH:MM:SS atualizada a cada segundo
└── lib/
    ├── marketing-requests.ts          # CRUD requests (KANBAN_SELECT projection)
    ├── request-comments.ts            # Comentários e alterações (fetchCommentStats RPC)
    ├── time-entries.ts                # Timesheet: start/pause/end + user_name join no fetch
    ├── users.ts                       # fetchDesigners (filtra role=designer no SQL)
    ├── type-icons.tsx                 # Ícones e cores por tipo de solicitação
    ├── area-icons.tsx                 # Ícones por área
    └── constants.ts                   # WORKFLOW_STAGES, COMPLETION_TYPES
```

---

## Design System

**Cor primária:** `#101f2e` (azul escuro)
- Em todos os lugares que usam azul, usar `#101f2e`
- Gradiente escuro: `from-[#101f2e] to-[#0a141c]`
- CSS vars: `--primary-dark-from: #101f2e`, `--primary-dark-to: #0a141c`

**Estética:** Glassmorphism premium (inspirado em Supabase, Vercel, Stripe, Airbnb)
- Cards: `bg-gradient-to-br from-white/90 via-white/70 to-white/50`, `backdrop-blur-xl`, `border border-white/60`
- Shadows suaves: `shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]`
- Hover: `-translate-y-1 scale-[1.015]` + sombra mais forte
- Modal: `rounded-2xl`, `backdrop-blur-xl`, shadow profundo

---

## Banco de Dados (Supabase)

### Tabelas principais

**`marketing_requests`**
```sql
id, title, description, request_type, requesting_area,
workflow_stage, completion_type,
assignee, assignee_id,          -- designer atribuído
solicitante, solicitante_id,    -- quem solicitou
requested_at, delivered_at,
priority TEXT ('urgente'|'alta'|'normal'|'baixa'),  -- adicionado
deadline DATE,                                       -- adicionado
stage_changed_at TIMESTAMPTZ                         -- adicionado + trigger
```

**`request_comments`**
```sql
id, request_id, user_id, body, is_alteration BOOLEAN,
created_at,
resolved_at TIMESTAMPTZ,         -- quando designer resolveu
resolved_by_user_id UUID         -- quem resolveu
```

**`time_entries`**
```sql
id, request_id, user_id, started_at, ended_at, created_at
```

**`users`**
```sql
id, auth_id, name, email, department, role, avatar_url
```

### RPCs / Functions

**`comment_stats(request_ids uuid[])`** — conta comentários e alterações pendentes em batch:
```sql
returns table(request_id uuid, total_comments bigint, pending_alterations bigint)
```

### Trigger
`trg_stage_changed_at` — atualiza `stage_changed_at` automaticamente quando `workflow_stage` muda.

---

## Sistema de Timesheet / Cronômetro

### Quem pode usar
- **Designer atribuído** → inicia/pausa/finaliza, vê histórico
- **Admin** → idem (pode iniciar também), vê histórico com usuários de cada entrada
- Timesheet aparece para ambos no modal

### Fluxo
1. Admin ou designer abre o modal → clica "Iniciar cronômetro"
2. Cria `time_entries` row com `user_id = profile.id` e `ended_at = null`
3. Cronômetro live aparece em 3 lugares:
   - **No modal** (`KanbanCardDetail`): bloco verde `HH:MM:SS` com pulsing dot + Pausar + Finalizar em linha própria
   - **No card Kanban** (`KanbanCard`): substitui o total estático por live elapsed
   - **FloatingTimer** (canto inferior direito): widget global persistente em qualquer página
4. **Pausar** → define `ended_at`, FloatingTimer muda para âmbar com tempo congelado + botão Resume
5. **Retomar** → cria nova `time_entry`, cronômetro reinicia (total é soma de todas as entradas)
6. **Finalizar** → igual a Pausar mas limpa o contexto completamente (FloatingTimer some)

### Histórico no modal
Cada linha mostra: avatar do usuário, nome, data/hora de início, duração formatada. Identifica quem gravou cada sessão (relevante para admin ver trabalho de cada designer).

### Arquitetura do Timer
- **`TimerContext`** — `status: idle|running|paused`, expõe `start/pause/resume/stop`, `pausedDisplayTime` (tempo congelado no pause), restaura sessão ativa do DB no mount
- **`useStopwatch`** — atualiza a cada 1s retornando `HH:MM:SS`
- **`FloatingTimer`** — verde quando running, âmbar quando paused, oculto quando idle; collapsível
- `fetchTimeEntriesForRequest` faz join com `users(name, avatar_url)` para popular `user_name`/`user_avatar_url`
- `totalDurationForEntries()` soma todas as entradas (incluindo a ativa) para total acumulado

## Nova Solicitação
- **Página `/nova-solicitacao` removida** (deletada)
- Criar via modal `NewRequestDialog` no Planner (botão "Nova Solicitação" no `planner-client.tsx`)
- Nav item removido da sidebar

---

## KanbanCard — Informações exibidas

1. **Prioridade** (pill colorido: urgente=vermelho, alta=laranja, baixa=cinza claro, normal=oculto)
2. **Tipo** (badge arredondado)
3. **Título** (2 linhas max)
4. **Área solicitante** (ícone + texto)
5. **Data de solicitação** (dd/MM/yy)
6. **Tempo registrado** — ou **cronômetro live** `HH:MM:SS` se timer ativo
7. **Prazo** (CalendarX2, vermelho se vencido)
8. **Dias no estágio** (Flag, amarelo ≥4d, vermelho ≥7d)
9. **Descrição** (2 linhas max)
10. **Rodapé:** contagem de comentários (popover), badge alterações pendentes, avatares

---

## Fluxo de Alterações (Comentários)

- Qualquer usuário pode comentar em uma solicitação
- `is_alteration = true` → comentário registrado como alteração (badge âmbar)
- Designer atribuído ou admin pode marcar como resolvida → `resolved_at + resolved_by_user_id`
- Card mostra badge de alterações pendentes (âmbar) quando há não resolvidas
- Popover no card mostra preview dos últimos 5 comentários

---

## Roles de Usuários

- `admin` → edita todos os campos, atribuir designers, prioridade/deadline, **inicia/pausa timesheet**, vê histórico com user info
- `designer` → inicia/pausa timesheet nas tarefas atribuídas a ele, resolve alterações
- Outros → visualização e criação de solicitações

## Header e Sidebar

**Sidebar** (`w-16`, gradiente `#101f2e → #0a141c`):
- **Fênix** (`/fenix.png`, 28×28px, `<img>` nativo) como logo mark no topo — ícone da marca Bismarchi Pires
- Nav icon-only: Dashboard, Planner, Solicitações, Vincular Solicitantes, Usuários (**sem** Nova Solicitação)
- Item ativo = fundo branco + ícone `#101f2e`, hover = `bg-white/10`
- Tooltips ao hover (à direita, sem bibliotecas)
- Rodapé: avatar do usuário (dot online verde) → link `/perfil`, botão logout discreto

**Header** (`h-14`, `backdrop-blur-xl`):
- **Esquerda**: nome da página atual (breadcrumb dinâmico por pathname)
- **Centro**: search bar (`max-w-xs`, `rounded-xl`)
- **Direita**: logo horizontal Bismarchi Pires (`/LOGO HORIZONTAL AZUL.png`, `h-6`, `opacity-80`)
- Sem perfil, logout ou tabs

## Páginas do Sistema

| Rota | Tipo | Acesso | Descrição |
|---|---|---|---|
| `/` | Dashboard | todos | KPIs + gráficos por área/status/tipo + ChartTimesheet |
| `/planner` | Kanban | todos | Board drag-and-drop + aba Concluídos |
| `/solicitacoes` | Tabela | todos | Lista de solicitações + aba Concluídos por Área |
| `/vincular-solicitantes` | Admin | admin | Liga registros de solicitante (string) a usuários do sistema |
| `/usuarios` | Admin | admin | CRUD de usuários: criar, editar, deletar, ativar/desativar |
| `/perfil` | Client | autenticado | Editar nome, e-mail, foto (URL), departamento |
| `/login` | Público | não autenticado | Split-screen: painel dark com logo + formulário branco |

## Componentes não mapeados anteriormente

**`request-edit-dialog.tsx`** — Dialog para editar solicitações existentes na tabela de Solicitações. Campos: tipo, solicitante, status, workflow_stage, área, título, descrição, link, referências, advogado, data.

**`auth-guard.tsx`** — HOC que redireciona para `/login` se não autenticado.

**`areas.ts` (lib)** — `fetchAreas()`, `createArea()` — áreas criadas dinamicamente no sistema.

**`area-select-with-create.tsx`** — Select de área com opção de criar nova inline (usado em `UserFormDialog`).

**`user-select.tsx` / `user-select-compact.tsx`** — Reusable: busca e seleciona usuário do banco. Usado em request-edit-dialog.

**`VincularSolicitantesTable`** — Lista solicitações sem `solicitante_id` (string legacy), permite vincular a usuário via `linkSolicitante()` / batch via `linkSolicitantesBatch()`.

**`UsersTable`** — Tabela de gestão de usuários com CRUD completo: `createUser`, `updateUser`, `deleteUser`, `toggleUserActive`.

---

## Performance

- `KANBAN_SELECT` projection no `fetchMarketingRequestsForAuth` — apenas colunas necessárias
- `comment_stats` RPC — agrega counts em uma query (substituiu N+1 queries)
- `unstable_cache` para `fetchDesigners` e `fetchActiveUsers` no server
- `loading.tsx` com skeleton para SSR
- `fetchDesigners` filtra `role = 'designer'` no SQL (não em JS)
- Timer verificado no mount do contexto via `getActiveTimeEntryForUser` — restaura sessões ativas

---

## Dashboard / Analytics

**Componentes existentes:**
- `KpiCards` — 4 métricas: total, mês, concluídas, tempo médio
- `ChartByArea` — barras horizontais custom por área solicitante
- `ChartByStatus` — donut Recharts (pendente/em andamento/concluído)
- `ChartByType` — barras horizontais custom por tipo de solicitação
- `ChartTimesheet` (**novo**) — visão de gestão do timesheet:
  - Busca próprios dados client-side via `fetchTimesheetForDashboard(30days)`
  - 3 KPI mini-cards: total de horas, média por solicitação, designer mais ativo
  - BarChart horizontal (Recharts): horas por designer — sorted desc, color `#101f2e`
  - AreaChart (Recharts): tendência diária 14 dias — gradiente `#101f2e`
  - Designers veem apenas seus próprios dados; admins veem todos
  - Estado vazio e skeleton de loading incluídos

**`fetchTimesheetForDashboard(days=30)`** em `time-entries.ts`:
- Busca entries com join `users(name)` + `marketing_requests(title)`
- Retorna `TimesheetRawEntry[]` para o componente agregar

## Tabela de Solicitações (requests-table.tsx)

**Colunas atuais:**
Tipo | Solicitante | Área | Título (+ descrição abaixo) | Prioridade | Status | Conclusão | Prazo/Dias | Responsável | Ações

**Melhorias aplicadas:**
- `completion_type` mapeado para badges: Design (azul escuro), Postagem (verde), Conteúdo (violeta)
- `priority` exibida como pill com dot colorido (urgente/alta/normal/baixa)
- "Prazo": se concluído mostra dias que levou (`delivered_at - requested_at`); senão mostra deadline
- "Título" com descrição em segunda linha, truncada
- Responsável: avatar pequeno + primeiro nome
- Linhas concluídas com fundo verde sutil (`bg-emerald-50/30`)
- Empty state inline na tabela
- Design: `rounded-2xl`, `backdrop-blur-sm`, `bg-white/70`, filtros com `rounded-xl`

## Convenções de Código

- Glassmorphism: sempre usar `backdrop-blur-xl`, gradientes brancos, bordas `white/60`
- Azul: sempre `#101f2e`, nunca outros azuis padrão do Tailwind
- Arredondamento: `rounded-2xl` para cards/modais, `rounded-xl` para seções, `rounded-full` para pills/badges
- Animações: `transition-all duration-200 ease-out`, hover `-translate-y-1 scale-[1.015]`
- Comentários: sem comentários óbvios, apenas intenção/trade-offs
