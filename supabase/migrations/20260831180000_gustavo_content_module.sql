-- Módulo de Posicionamento Digital do Gustavo Bismarchi.
-- Domínio isolado: não usa content_roteiros / content_topics.
-- Acesso: role = admin OU linha em gustavo_content_members.
-- Escritas do app passam pela API com service role após validar o usuário.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.gustavo_content_members (
  user_id uuid primary key references public.users(id) on delete cascade,
  member_role text not null default 'editor'
    check (member_role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

create table if not exists public.gustavo_content_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rss_query text not null,
  is_active boolean not null default true,
  months_back integer not null default 4,
  item_limit integer not null default 20,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gustavo_content_theses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  thesis text not null,
  explanation text,
  business_importance text,
  counterpoint text,
  applications text[] not null default '{}',
  tags text[] not null default '{}',
  conviction text not null default 'contextual'
    check (conviction in ('strong', 'contextual', 'discussion')),
  status text not null default 'pending'
    check (status in ('validated', 'pending', 'disabled')),
  gustavo_phrases text[] not null default '{}',
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gustavo_content_voice_samples (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual'
    check (source_type in ('linkedin', 'manual', 'transcript', 'other')),
  source_url text,
  published_at timestamptz,
  original_text text not null,
  content_type text,
  tone text,
  analysis jsonb,
  performance jsonb,
  authenticity text not null default 'unknown'
    check (authenticity in ('gustavo_original', 'marketing_revised', 'ai_assisted', 'unknown')),
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gustavo_content_items (
  id uuid primary key default gen_random_uuid(),
  source text not null
    check (source in ('rss', 'manual_link', 'manual_idea', 'thesis')),
  topic_id uuid references public.gustavo_content_topics(id) on delete set null,
  title text,
  link text,
  content_snippet text,
  published_at timestamptz,
  image_url text,
  source_context jsonb,
  editorial_score integer,
  score_breakdown jsonb,
  score_reason text,
  business_problem text,
  angles jsonb,
  selected_angle jsonb,
  thesis_id uuid references public.gustavo_content_theses(id) on delete set null,
  thesis_snapshot text,
  opinion_status text
    check (opinion_status is null or opinion_status in ('validated', 'needs_gustavo')),
  gustavo_questions jsonb,
  gustavo_answers jsonb,
  recommended_channels jsonb,
  linkedin_post text,
  original_linkedin_post text,
  reel_script text,
  original_reel_script text,
  alternative_hooks jsonb,
  compliance_flags jsonb,
  factual_flags jsonb,
  status text not null default 'radar'
    check (status in (
      'radar',
      'sugestao',
      'aguardando_opiniao',
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'enviado_mkt',
      'publicado',
      'rejeitado',
      'arquivado'
    )),
  rejection_reason text,
  has_alterations boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_by_name text,
  edited_by uuid references public.users(id) on delete set null,
  edited_by_name text,
  edited_at timestamptz,
  submitted_to_gustavo_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  approval_kind text
    check (approval_kind is null or approval_kind in ('gustavo', 'admin_exception')),
  marketing_request_linkedin_id uuid references public.marketing_requests(id) on delete set null,
  marketing_request_reel_id uuid references public.marketing_requests(id) on delete set null,
  linkedin_published_url text,
  instagram_published_url text,
  linkedin_published_at timestamptz,
  instagram_published_at timestamptz,
  performance jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gustavo_content_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  topics_count integer not null default 0,
  items_seen integer not null default 0,
  discarded_under_55 integer not null default 0,
  radar_created integer not null default 0,
  suggestions_created integer not null default 0,
  duplicates integer not null default 0,
  error_count integer not null default 0,
  errors jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists gustavo_content_items_status_idx
  on public.gustavo_content_items (status);
create index if not exists gustavo_content_items_created_at_idx
  on public.gustavo_content_items (created_at desc);
create index if not exists gustavo_content_items_published_at_idx
  on public.gustavo_content_items (published_at desc);
create index if not exists gustavo_content_items_thesis_id_idx
  on public.gustavo_content_items (thesis_id);
create index if not exists gustavo_content_items_topic_id_idx
  on public.gustavo_content_items (topic_id);
create index if not exists gustavo_content_theses_status_idx
  on public.gustavo_content_theses (status);
create index if not exists gustavo_content_topics_active_idx
  on public.gustavo_content_topics (is_active);
create index if not exists gustavo_content_fetch_runs_started_idx
  on public.gustavo_content_fetch_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_gustavo_content_updated_at()
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

drop trigger if exists gustavo_content_topics_set_updated_at on public.gustavo_content_topics;
create trigger gustavo_content_topics_set_updated_at
before update on public.gustavo_content_topics
for each row execute function public.set_gustavo_content_updated_at();

drop trigger if exists gustavo_content_theses_set_updated_at on public.gustavo_content_theses;
create trigger gustavo_content_theses_set_updated_at
before update on public.gustavo_content_theses
for each row execute function public.set_gustavo_content_updated_at();

drop trigger if exists gustavo_content_voice_set_updated_at on public.gustavo_content_voice_samples;
create trigger gustavo_content_voice_set_updated_at
before update on public.gustavo_content_voice_samples
for each row execute function public.set_gustavo_content_updated_at();

drop trigger if exists gustavo_content_items_set_updated_at on public.gustavo_content_items;
create trigger gustavo_content_items_set_updated_at
before update on public.gustavo_content_items
for each row execute function public.set_gustavo_content_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: conta real do Gustavo Bismarchi Motta
-- ---------------------------------------------------------------------------

insert into public.gustavo_content_members (user_id, member_role)
select id, 'owner'
from public.users
where id = '9394f718-5e3a-4b2a-ae53-84faefcd4c7e'
  and name = 'Gustavo Bismarchi Motta'
on conflict (user_id) do nothing;

-- Temas RSS enxutos (queries no formato do Google News do módulo institucional).
insert into public.gustavo_content_topics (name, rss_query, priority)
values
  (
    'Recuperação empresarial',
    '("recuperação judicial" OR "recuperação extrajudicial" OR "reestruturação empresarial" OR "reestruturação de dívida")',
    100
  ),
  (
    'Dívida e liquidez',
    '("dívida corporativa" OR "renegociação de dívida" OR "crise de liquidez" OR "capital de giro" OR "default empresa" OR "covenant dívida")',
    90
  ),
  (
    'Distressed / Special Situations',
    '("distressed assets" OR "special situations" OR "ativos estressados" OR "venda de ativos recuperação judicial")',
    80
  ),
  (
    'Instrumentos',
    '("DIP financing" OR "financiamento DIP" OR "stay period" OR "UPI recuperação judicial" OR "unidade produtiva isolada")',
    70
  ),
  (
    'Casos internacionais',
    '("Chapter 11" empresa Brasil OR "Chapter 11" "Brazilian company")',
    40
  ),
  (
    'Crédito e ambiente empresarial',
    '("crédito empresas" OR "inadimplência corporativa" OR "endividamento empresas Brasil")',
    50
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.gustavo_content_members enable row level security;
alter table public.gustavo_content_topics enable row level security;
alter table public.gustavo_content_theses enable row level security;
alter table public.gustavo_content_voice_samples enable row level security;
alter table public.gustavo_content_items enable row level security;
alter table public.gustavo_content_fetch_runs enable row level security;

revoke all on public.gustavo_content_members from anon, public;
revoke all on public.gustavo_content_topics from anon, public;
revoke all on public.gustavo_content_theses from anon, public;
revoke all on public.gustavo_content_voice_samples from anon, public;
revoke all on public.gustavo_content_items from anon, public;
revoke all on public.gustavo_content_fetch_runs from anon, public;

grant select on public.gustavo_content_members to authenticated, service_role;
grant select on public.gustavo_content_topics to authenticated, service_role;
grant select on public.gustavo_content_theses to authenticated, service_role;
grant select on public.gustavo_content_voice_samples to authenticated, service_role;
grant select on public.gustavo_content_items to authenticated, service_role;
grant select on public.gustavo_content_fetch_runs to authenticated, service_role;

grant insert, update, delete on public.gustavo_content_members to service_role;
grant insert, update, delete on public.gustavo_content_topics to service_role;
grant insert, update, delete on public.gustavo_content_theses to service_role;
grant insert, update, delete on public.gustavo_content_voice_samples to service_role;
grant insert, update, delete on public.gustavo_content_items to service_role;
grant insert, update, delete on public.gustavo_content_fetch_runs to service_role;

create or replace function public.has_gustavo_content_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or exists (
          select 1
          from public.gustavo_content_members m
          where m.user_id = u.id
        )
      )
  );
$$;

revoke all on function public.has_gustavo_content_access() from public, anon;
grant execute on function public.has_gustavo_content_access() to authenticated, service_role;

create policy "gustavo_content_members_select"
on public.gustavo_content_members for select to authenticated
using ((select public.has_gustavo_content_access()));

create policy "gustavo_content_topics_select"
on public.gustavo_content_topics for select to authenticated
using ((select public.has_gustavo_content_access()));

create policy "gustavo_content_theses_select"
on public.gustavo_content_theses for select to authenticated
using ((select public.has_gustavo_content_access()));

create policy "gustavo_content_voice_select"
on public.gustavo_content_voice_samples for select to authenticated
using ((select public.has_gustavo_content_access()));

create policy "gustavo_content_items_select"
on public.gustavo_content_items for select to authenticated
using ((select public.has_gustavo_content_access()));

create policy "gustavo_content_runs_select"
on public.gustavo_content_fetch_runs for select to authenticated
using ((select public.has_gustavo_content_access()));

comment on table public.gustavo_content_members is
  'Membership explícita do módulo Posicionamento Gustavo. Admin tem bypass por role.';
comment on table public.gustavo_content_items is
  'Pautas e conteúdos pessoais do Gustavo. Não misturar com content_roteiros.';
