create table if not exists public.hr_qualification_requirement_history (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('activated', 'deactivated')),
  scopes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(scopes) = 'array'),
  selected_count integer not null default 0 check (selected_count >= 0),
  affected_count integer not null default 0 check (affected_count >= 0),
  already_complete_count integer not null default 0
    check (already_complete_count >= 0),
  performed_by uuid references public.users(id) on delete set null,
  performed_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists hr_qualification_requirement_history_created_idx
  on public.hr_qualification_requirement_history(created_at desc);

alter table public.hr_qualification_requirement_history enable row level security;

revoke all on public.hr_qualification_requirement_history from anon;
revoke insert, update, delete on public.hr_qualification_requirement_history
  from authenticated;
grant select on public.hr_qualification_requirement_history to authenticated;
grant select, insert, update, delete
  on public.hr_qualification_requirement_history to service_role;

create policy "hr managers read qualification requirement history"
on public.hr_qualification_requirement_history
for select
to authenticated
using ((select public.has_hr_access()));

comment on table public.hr_qualification_requirement_history is
  'Auditoria das ativações e desativações da obrigatoriedade de qualificação.';
comment on column public.hr_qualification_requirement_history.scopes is
  'Snapshot das áreas e cargos selecionados no momento da alteração.';
