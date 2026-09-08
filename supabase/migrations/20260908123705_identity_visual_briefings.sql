alter table public.marketing_requests
  add column if not exists identity_briefing_enabled boolean not null default false,
  add column if not exists identity_briefing_status text,
  add column if not exists identity_briefing_submitted_at timestamptz;

alter table public.marketing_requests
  drop constraint if exists marketing_requests_identity_briefing_status_check;

alter table public.marketing_requests
  add constraint marketing_requests_identity_briefing_status_check
  check (identity_briefing_status is null or identity_briefing_status in ('pending', 'submitted'));

comment on column public.marketing_requests.identity_briefing_enabled is
  'Indica que a solicitação de identidade visual possui briefing estruturado.';
comment on column public.marketing_requests.identity_briefing_status is
  'Estado espelhado do briefing para sinalização rápida no Planner.';
comment on column public.marketing_requests.identity_briefing_submitted_at is
  'Data da resposta mais recente do briefing de identidade visual.';

create table if not exists public.identity_visual_briefings (
  request_id uuid primary key references public.marketing_requests(id) on delete cascade,
  respondent_user_id uuid not null references public.users(id),
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  form_version smallint not null default 1,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.identity_visual_briefings is
  'Respostas protegidas dos briefings de identidade visual vinculados às solicitações.';

create index if not exists identity_visual_briefings_respondent_idx
  on public.identity_visual_briefings (respondent_user_id);

alter table public.identity_visual_briefings enable row level security;

revoke all on table public.identity_visual_briefings from anon, authenticated;
grant select, insert, update on table public.identity_visual_briefings to authenticated;

drop policy if exists "identity briefing participants can read" on public.identity_visual_briefings;
create policy "identity briefing participants can read"
on public.identity_visual_briefings
for select
to authenticated
using (
  exists (
    select 1
    from public.users current_user_profile
    where current_user_profile.auth_id = (select auth.uid())
      and current_user_profile.is_active is not false
      and (
        current_user_profile.id = respondent_user_id
        or lower(coalesce(current_user_profile.role, '')) in ('admin', 'designer')
        or lower(trim(current_user_profile.department)) = 'marketing'
      )
  )
);

drop policy if exists "marketing can create identity briefings" on public.identity_visual_briefings;
create policy "marketing can create identity briefings"
on public.identity_visual_briefings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users current_user_profile
    where current_user_profile.auth_id = (select auth.uid())
      and current_user_profile.is_active is not false
      and (
        lower(coalesce(current_user_profile.role, '')) in ('admin', 'designer')
        or lower(trim(current_user_profile.department)) = 'marketing'
      )
  )
  and exists (
    select 1
    from public.marketing_requests request
    where request.id = request_id
      and lower(trim(coalesce(request.request_type, ''))) = 'identidade visual'
      and request.solicitante_id = respondent_user_id
      and request.identity_briefing_enabled = true
  )
);

drop policy if exists "respondent can update own identity briefing" on public.identity_visual_briefings;
create policy "respondent can update own identity briefing"
on public.identity_visual_briefings
for update
to authenticated
using (
  exists (
    select 1
    from public.users current_user_profile
    where current_user_profile.auth_id = (select auth.uid())
      and current_user_profile.is_active is not false
      and current_user_profile.id = respondent_user_id
  )
)
with check (
  exists (
    select 1
    from public.users current_user_profile
    where current_user_profile.auth_id = (select auth.uid())
      and current_user_profile.is_active is not false
      and current_user_profile.id = respondent_user_id
  )
  and exists (
    select 1
    from public.marketing_requests request
    where request.id = request_id
      and request.solicitante_id = respondent_user_id
      and request.identity_briefing_enabled = true
  )
);

create or replace function public.sync_identity_visual_briefing_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.marketing_requests
  set
    identity_briefing_status = new.status,
    identity_briefing_submitted_at = new.submitted_at,
    updated_at = now()
  where id = new.request_id;
  return new;
end;
$$;

revoke all on function public.sync_identity_visual_briefing_status() from public;

drop trigger if exists identity_visual_briefing_status_sync on public.identity_visual_briefings;
create trigger identity_visual_briefing_status_sync
after insert or update of status, submitted_at
on public.identity_visual_briefings
for each row
execute function public.sync_identity_visual_briefing_status();
