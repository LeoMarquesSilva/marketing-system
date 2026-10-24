-- Planner de Operações Legais (Operações Legais > Planner).
--
-- Um espaço por equipe de Operações Legais do organograma (slug = team_key de
-- src/lib/rh/org-chart.ts), com listas, tarefas, rotinas recorrentes e alarmes.
-- Substitui o Planner da Controladoria, o ClickUp de Facilities/RH e a planilha
-- Quadro_Ciclo_Pessoas e Cultura. O Planner de Marketing (marketing_requests)
-- continua à parte: as solicitações dele só aparecem em Minhas tarefas e na Gestão.
--
-- Acesso: tudo passa pelas APIs /api/operacoes-legais/planner (service role).
-- authenticated só lê as próprias linhas de ops_space_members (indicador de menu).

-- ------------------------------------------------------------------ espaços

create table if not exists public.ops_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) > 0),
  description text,
  color text not null default '#3e84a8',
  -- Planilha do RH: "Até 3 atividades em andamento por pessoa". Só avisa, não bloqueia.
  wip_limit smallint not null default 3 check (wip_limit between 1 and 20),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

drop trigger if exists ops_spaces_set_updated_at on public.ops_spaces;
create trigger ops_spaces_set_updated_at
before update on public.ops_spaces
for each row execute function public.set_ferias_updated_at();

-- gestor: vê e administra todos os espaços em que está (Gerente e Coordenador da divisão).
-- lider: administra o espaço (membros, listas, limite). membro: vê e trabalha no espaço.
create table if not exists public.ops_space_members (
  space_id uuid not null references public.ops_spaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'membro' check (role in ('gestor', 'lider', 'membro')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists ops_space_members_user_idx on public.ops_space_members (user_id);

create table if not exists public.ops_lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ops_spaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists ops_lists_space_name_uidx
  on public.ops_lists (space_id, lower(name))
  where archived_at is null;

-- ------------------------------------------------------------------ rotinas

-- Regra de recorrência (motor em src/lib/ops-planner/recurrence.ts):
--   diaria   a cada every_n dias (only_business_days pula fim de semana e feriado)
--   semanal  a cada every_n semanas, nos weekdays (0 = domingo)
--   mensal   a cada every_n meses: dia_do_mes (month_day, -1 = último dia),
--            dia_util (business_day_n, ex.: 5º dia útil; -1 = último dia útil)
--            ou semana_do_mes (week_of_month + weekday, ex.: 1ª segunda-feira)
--   anual    no month, com o mesmo monthly_mode
-- shift_non_business move a data que cai em fim de semana/feriado.
-- lead_days: quantos dias antes do vencimento a tarefa aparece.
create table if not exists public.ops_routines (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ops_spaces(id) on delete cascade,
  list_id uuid references public.ops_lists(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  priority text not null default 'media' check (priority in ('urgente', 'alta', 'media', 'baixa')),
  tipo text not null default 'operacional' check (tipo in ('operacional', 'projeto', 'plano_acao')),
  assignee_ids uuid[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  due_time time,
  frequency text not null check (frequency in ('diaria', 'semanal', 'mensal', 'anual')),
  every_n smallint not null default 1 check (every_n between 1 and 36),
  weekdays smallint[] not null default '{}',
  only_business_days boolean not null default false,
  monthly_mode text check (monthly_mode in ('dia_do_mes', 'dia_util', 'semana_do_mes')),
  month_day smallint check (month_day between -1 and 31 and month_day <> 0),
  business_day_n smallint check (business_day_n between -1 and 23 and business_day_n <> 0),
  week_of_month smallint check (week_of_month in (-1, 1, 2, 3, 4)),
  weekday smallint check (weekday between 0 and 6),
  month smallint check (month between 1 and 12),
  shift_non_business text not null default 'manter'
    check (shift_non_business in ('manter', 'antecipar', 'adiar')),
  lead_days smallint not null default 0 check (lead_days between 0 and 60),
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  last_occurrence_date date,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_on is null or ends_on >= starts_on),
  check (frequency not in ('mensal', 'anual') or monthly_mode is not null),
  check (frequency <> 'anual' or month is not null)
);

create index if not exists ops_routines_space_idx on public.ops_routines (space_id) where archived_at is null;

drop trigger if exists ops_routines_set_updated_at on public.ops_routines;
create trigger ops_routines_set_updated_at
before update on public.ops_routines
for each row execute function public.set_ferias_updated_at();

-- ------------------------------------------------------------------ tarefas

create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.ops_spaces(id) on delete cascade,
  list_id uuid references public.ops_lists(id) on delete set null,
  parent_task_id uuid references public.ops_tasks(id) on delete cascade,
  routine_id uuid references public.ops_routines(id) on delete set null,
  occurrence_date date,
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'aguardando', 'concluida', 'cancelada')),
  priority text not null default 'media' check (priority in ('urgente', 'alta', 'media', 'baixa')),
  tipo text not null default 'operacional' check (tipo in ('operacional', 'projeto', 'plano_acao')),
  assignee_ids uuid[] not null default '{}',
  requested_by uuid references public.users(id) on delete set null,
  start_date date,
  due_date date,
  due_time time,
  next_step text,
  -- "Bloqueio: mova para Aguardando com quem e desde quando" (planilha do RH).
  waiting_on text,
  waiting_since date,
  -- "Atraso: registre novo prazo e motivo e some 1 em Reprogramações".
  reschedule_count smallint not null default 0 check (reschedule_count >= 0),
  sort_order double precision not null default 0,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  -- Uma tarefa por ocorrência da rotina: a geração pelo cron é idempotente.
  unique (routine_id, occurrence_date)
);

create index if not exists ops_tasks_space_status_idx
  on public.ops_tasks (space_id, status)
  where archived_at is null;

create index if not exists ops_tasks_assignees_idx on public.ops_tasks using gin (assignee_ids);

create index if not exists ops_tasks_open_due_idx
  on public.ops_tasks (due_date)
  where archived_at is null and status not in ('concluida', 'cancelada');

create index if not exists ops_tasks_parent_idx on public.ops_tasks (parent_task_id) where parent_task_id is not null;

drop trigger if exists ops_tasks_set_updated_at on public.ops_tasks;
create trigger ops_tasks_set_updated_at
before update on public.ops_tasks
for each row execute function public.set_ferias_updated_at();

create table if not exists public.ops_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ops_tasks(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  sort_order smallint not null default 0,
  done_at timestamptz,
  done_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ops_task_checklist_task_idx on public.ops_task_checklist_items (task_id, sort_order);

create table if not exists public.ops_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ops_tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists ops_task_comments_task_idx on public.ops_task_comments (task_id, created_at);

-- Histórico de todas as mudanças da tarefa (status, prazo, responsáveis...).
create table if not exists public.ops_task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ops_tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ops_task_activity_task_idx on public.ops_task_activity (task_id, created_at);

create table if not exists public.ops_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ops_tasks(id) on delete cascade,
  kind text not null check (kind in ('link', 'file')),
  name text not null check (length(trim(name)) > 0),
  url text,
  storage_path text unique,
  content_type text,
  size_bytes bigint,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null) or (kind = 'file' and storage_path is not null))
);

create index if not exists ops_task_attachments_task_idx on public.ops_task_attachments (task_id, created_at);

-- ------------------------------------------------------------------ alarmes

create table if not exists public.ops_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.ops_tasks(id) on delete cascade,
  routine_id uuid references public.ops_routines(id) on delete set null,
  kind text not null check (kind in (
    'rotina_gerada', 'vence_amanha', 'vence_hoje', 'atrasada', 'escalada', 'atribuida', 'comentario'
  )),
  title text not null,
  body text,
  -- Ex.: "vence_hoje:<task>:<data>:<destinatário>"; repetir o cron não duplica aviso.
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz
);

create index if not exists ops_notifications_unread_idx
  on public.ops_notifications (recipient_id, created_at desc)
  where read_at is null;

create index if not exists ops_notifications_recipient_idx
  on public.ops_notifications (recipient_id, created_at desc);

create table if not exists public.ops_notification_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  email_digest boolean not null default true,
  manager_digest boolean not null default true,
  -- Último resumo enviado: rodar o cron de novo no mesmo dia não reenvia o e-mail.
  last_digest_on date,
  updated_at timestamptz not null default now()
);

drop trigger if exists ops_notification_prefs_set_updated_at on public.ops_notification_prefs;
create trigger ops_notification_prefs_set_updated_at
before update on public.ops_notification_prefs
for each row execute function public.set_ferias_updated_at();

-- ------------------------------------------------------------------ acesso

alter table public.ops_spaces enable row level security;
alter table public.ops_space_members enable row level security;
alter table public.ops_lists enable row level security;
alter table public.ops_routines enable row level security;
alter table public.ops_tasks enable row level security;
alter table public.ops_task_checklist_items enable row level security;
alter table public.ops_task_comments enable row level security;
alter table public.ops_task_activity enable row level security;
alter table public.ops_task_attachments enable row level security;
alter table public.ops_notifications enable row level security;
alter table public.ops_notification_prefs enable row level security;

revoke all on public.ops_spaces, public.ops_space_members, public.ops_lists, public.ops_routines,
  public.ops_tasks, public.ops_task_checklist_items, public.ops_task_comments, public.ops_task_activity,
  public.ops_task_attachments, public.ops_notifications, public.ops_notification_prefs
  from anon, authenticated;

grant all on public.ops_spaces, public.ops_space_members, public.ops_lists, public.ops_routines,
  public.ops_tasks, public.ops_task_checklist_items, public.ops_task_comments, public.ops_task_activity,
  public.ops_task_attachments, public.ops_notifications, public.ops_notification_prefs
  to service_role;

-- O menu precisa saber se o usuário logado é membro de algum espaço (auth-context).
grant select on public.ops_space_members to authenticated;

drop policy if exists "ops members read own memberships" on public.ops_space_members;
create policy "ops members read own memberships"
on public.ops_space_members for select to authenticated
using (user_id in (select u.id from public.users u where u.auth_id = (select auth.uid())));

-- Anexos: bucket privado, só service role (upload por URL assinada criada na API).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'MARKETING-SYSTEM-OPS',
  'MARKETING-SYSTEM-OPS',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'text/plain',
    'application/zip',
    'message/rfc822', 'application/vnd.ms-outlook'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.ops_spaces is
  'Espaços do Planner de Operações Legais: um por equipe do organograma (slug = team_key).';
comment on table public.ops_tasks is
  'Tarefas do Planner de Operações Legais. Status, prioridade e tipo são os mesmos em todos os espaços.';
comment on table public.ops_routines is
  'Rotinas recorrentes do Planner de Operações Legais; o cron /api/cron/ops-planner gera as tarefas.';
