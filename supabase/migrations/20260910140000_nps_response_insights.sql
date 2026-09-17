-- Insights dos campos abertos do NPS (Motivo / Melhoria).
-- Aditivo: não altera nps_responses. Classificação só via service role.

create table if not exists public.nps_response_insights (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.nps_responses(id) on delete cascade,
  campaign_id uuid not null references public.nps_campaigns(id) on delete cascade,
  client_group_id uuid not null references public.email_client_groups(id) on delete cascade,
  field text not null check (field in ('reason', 'improvement')),
  is_noise boolean not null default false,
  themes jsonb not null default '[]'::jsonb,
  actionable boolean not null default false,
  suggested_action text,
  mentions_partner boolean not null default false,
  source text not null default 'heuristic'
    check (source in ('llm', 'heuristic', 'noise')),
  taxonomy_version integer not null default 1,
  classified_at timestamptz not null default now(),
  unique (response_id, field)
);

create index if not exists nps_response_insights_campaign_idx
  on public.nps_response_insights(campaign_id);
create index if not exists nps_response_insights_response_idx
  on public.nps_response_insights(response_id);

alter table public.nps_response_insights enable row level security;

revoke all on public.nps_response_insights from anon;
grant select on public.nps_response_insights to authenticated;
grant select, insert, update, delete on public.nps_response_insights to service_role;

create policy "nps managers read insights"
on public.nps_response_insights for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/meus-clientes' = any(coalesce(u.permissions, '{}'::text[]))
      )
  )
);
