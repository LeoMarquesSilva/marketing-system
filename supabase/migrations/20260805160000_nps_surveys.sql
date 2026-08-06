-- NPS surveys: campanhas, links por grupo e respostas.
-- Leitura/escrita pública só via service role no Next.js (sem policy anon).

create table if not exists public.nps_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo uma campanha ativa por vez.
create unique index if not exists nps_campaigns_one_active_idx
  on public.nps_campaigns ((status))
  where status = 'active';

create index if not exists nps_campaigns_status_idx on public.nps_campaigns(status);

create table if not exists public.nps_survey_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.nps_campaigns(id) on delete cascade,
  client_group_id uuid not null references public.email_client_groups(id) on delete cascade,
  token text not null unique,
  created_by_user_id uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  opens_count integer not null default 0 check (opens_count >= 0),
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, client_group_id)
);

create index if not exists nps_survey_links_token_idx on public.nps_survey_links(token);
create index if not exists nps_survey_links_campaign_idx on public.nps_survey_links(campaign_id);
create index if not exists nps_survey_links_group_idx on public.nps_survey_links(client_group_id);

create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.nps_campaigns(id) on delete cascade,
  link_id uuid not null references public.nps_survey_links(id) on delete cascade,
  client_group_id uuid not null references public.email_client_groups(id) on delete cascade,
  respondent_kind text not null check (respondent_kind in ('contact', 'person')),
  contact_id uuid references public.email_contacts(id) on delete set null,
  person_id uuid references public.email_people(id) on delete set null,
  respondent_name text not null,
  respondent_email text,
  respondent_cargo text,
  score_recommend integer not null check (score_recommend between 0 and 10),
  reason text,
  score_availability integer not null check (score_availability between 0 and 10),
  score_communication integer not null check (score_communication between 0 and 10),
  score_innovation integer not null check (score_innovation between 0 and 10),
  score_technical integer not null check (score_technical between 0 and 10),
  improvement text,
  submitted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  constraint nps_responses_respondent_chk check (
    (respondent_kind = 'contact' and contact_id is not null)
    or (respondent_kind = 'person' and person_id is not null)
  )
);

-- Uma resposta por contato/pessoa por campanha.
create unique index if not exists nps_responses_campaign_contact_uidx
  on public.nps_responses (campaign_id, contact_id)
  where contact_id is not null;

create unique index if not exists nps_responses_campaign_person_uidx
  on public.nps_responses (campaign_id, person_id)
  where person_id is not null;

create index if not exists nps_responses_campaign_idx on public.nps_responses(campaign_id);
create index if not exists nps_responses_group_idx on public.nps_responses(client_group_id);
create index if not exists nps_responses_link_idx on public.nps_responses(link_id);
create index if not exists nps_responses_submitted_idx on public.nps_responses(submitted_at desc);

create or replace function public.set_nps_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nps_campaigns_set_updated_at on public.nps_campaigns;
create trigger nps_campaigns_set_updated_at
before update on public.nps_campaigns
for each row execute function public.set_nps_updated_at();

drop trigger if exists nps_survey_links_set_updated_at on public.nps_survey_links;
create trigger nps_survey_links_set_updated_at
before update on public.nps_survey_links
for each row execute function public.set_nps_updated_at();

alter table public.nps_campaigns enable row level security;
alter table public.nps_survey_links enable row level security;
alter table public.nps_responses enable row level security;

revoke all on public.nps_campaigns from anon;
revoke all on public.nps_survey_links from anon;
revoke all on public.nps_responses from anon;

grant select, insert, update, delete on public.nps_campaigns to authenticated, service_role;
grant select, insert, update, delete on public.nps_survey_links to authenticated, service_role;
grant select on public.nps_responses to authenticated;
grant select, insert, update, delete on public.nps_responses to service_role;

-- Leitura/escrita de campanhas e links para quem tem /meus-clientes (ou admin).
create policy "nps managers read campaigns"
on public.nps_campaigns for select to authenticated
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

create policy "nps admins write campaigns"
on public.nps_campaigns for all to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "nps managers read links"
on public.nps_survey_links for select to authenticated
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

create policy "nps managers insert links"
on public.nps_survey_links for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/meus-clientes' = any(coalesce(u.permissions, '{}'::text[]))
      )
  )
);

create policy "nps managers update links"
on public.nps_survey_links for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/meus-clientes' = any(coalesce(u.permissions, '{}'::text[]))
      )
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/meus-clientes' = any(coalesce(u.permissions, '{}'::text[]))
      )
  )
);

create policy "nps managers read responses"
on public.nps_responses for select to authenticated
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
