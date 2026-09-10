-- Cronograma editorial: vagas definidas pelo Marketing e preenchidas pelos gestores.
-- Versão alinhada ao histórico remoto após aplicação via Supabase MCP.
create table if not exists public.content_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  area text not null check (char_length(trim(area)) between 1 and 120),
  due_date date not null,
  format text not null check (format in ('post', 'reel')),
  collaborator_id uuid references public.users(id) on delete set null,
  source_key text not null unique,
  source_name text,
  source_status text,
  source_notes text,
  cancelled boolean not null default false,
  content_roteiro_id uuid references public.content_roteiros(id) on delete set null,
  reel_studio_id uuid references public.reel_studio_items(id) on delete set null,
  instagram_post_id uuid references public.instagram_posts(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_schedule_slot_source_check check (
    format = 'reel' or reel_studio_id is null
  )
);

create unique index if not exists content_schedule_slots_roteiro_unique
  on public.content_schedule_slots(content_roteiro_id, collaborator_id)
  where format = 'post' and content_roteiro_id is not null;
create unique index if not exists content_schedule_slots_reel_unique
  on public.content_schedule_slots(reel_studio_id, collaborator_id);
create index if not exists content_schedule_slots_month_area_idx
  on public.content_schedule_slots(due_date, area, format);
create index if not exists content_schedule_slots_collaborator_idx
  on public.content_schedule_slots(collaborator_id, due_date)
  where collaborator_id is not null;

create table if not exists public.content_schedule_links (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.users(id) on delete cascade,
  area text not null,
  format text not null check (format in ('post', 'reel')),
  event_date date not null,
  content_roteiro_id uuid references public.content_roteiros(id) on delete cascade,
  reel_studio_id uuid references public.reel_studio_items(id) on delete cascade,
  reason text not null check (reason in ('no_slot', 'ambiguous', 'race_lost')),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  resolved_slot_id uuid references public.content_schedule_slots(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_schedule_link_source_check check (
    (format = 'post' and content_roteiro_id is not null and reel_studio_id is null)
    or (format = 'reel' and reel_studio_id is not null)
  )
);

create unique index if not exists content_schedule_links_roteiro_unique
  on public.content_schedule_links(content_roteiro_id, collaborator_id)
  where format = 'post' and content_roteiro_id is not null;
create unique index if not exists content_schedule_links_reel_unique
  on public.content_schedule_links(reel_studio_id, collaborator_id);
create index if not exists content_schedule_links_pending_idx
  on public.content_schedule_links(status, event_date)
  where status = 'pending';

alter table public.reel_studio_items
  add column if not exists source_content_id uuid references public.content_roteiros(id) on delete set null,
  add column if not exists generation_key uuid;
create unique index if not exists reel_studio_items_generation_key_unique
  on public.reel_studio_items(generation_key);

create or replace function public.set_content_schedule_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_schedule_slots_updated_at on public.content_schedule_slots;
create trigger content_schedule_slots_updated_at before update on public.content_schedule_slots
for each row execute function public.set_content_schedule_updated_at();
drop trigger if exists content_schedule_links_updated_at on public.content_schedule_links;
create trigger content_schedule_links_updated_at before update on public.content_schedule_links
for each row execute function public.set_content_schedule_updated_at();

alter table public.content_schedule_slots enable row level security;
alter table public.content_schedule_links enable row level security;

-- O módulo recalcula autorização no servidor. Clientes autenticados não escrevem direto.
revoke all on public.content_schedule_slots from anon, authenticated;
revoke all on public.content_schedule_links from anon, authenticated;
grant all on public.content_schedule_slots to service_role;
grant all on public.content_schedule_links to service_role;

drop policy if exists content_schedule_slots_service_role on public.content_schedule_slots;
create policy content_schedule_slots_service_role on public.content_schedule_slots
  for all to service_role using (true) with check (true);
drop policy if exists content_schedule_links_service_role on public.content_schedule_links;
create policy content_schedule_links_service_role on public.content_schedule_links
  for all to service_role using (true) with check (true);

comment on table public.content_schedule_slots is
  'Vagas do cronograma editorial. Datas e formato são definidos pelo Marketing.';
comment on table public.content_schedule_links is
  'Eventos de conteúdo que não puderam ser ligados automaticamente a uma única vaga.';
