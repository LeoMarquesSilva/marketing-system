-- Reels editados: o Marketing sobe o vídeo pós-edição ligado a uma vaga de reel do
-- cronograma, as pessoas que gravaram aprovam ou pedem ajuste e, depois da aprovação,
-- o Marketing prepara capa e legenda até o reel ficar pronto para publicar.

create table if not exists public.reel_deliveries (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references public.content_schedule_slots(id) on delete set null,
  area text not null check (char_length(trim(area)) between 1 and 120),
  due_date date,
  title text not null check (char_length(trim(title)) between 3 and 240),
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'changes_requested', 'approved', 'ready', 'published')),
  caption text check (caption is null or char_length(caption) <= 2200),
  cover_path text,
  approved_at timestamptz,
  ready_at timestamptz,
  published_at timestamptz,
  created_by_id uuid references public.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reel_deliveries_slot_unique
  on public.reel_deliveries(slot_id) where slot_id is not null;
create index if not exists reel_deliveries_status_idx
  on public.reel_deliveries(status, due_date);

create table if not exists public.reel_delivery_participants (
  delivery_id uuid not null references public.reel_deliveries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  user_name text not null,
  created_at timestamptz not null default now(),
  primary key (delivery_id, user_id)
);

create index if not exists reel_delivery_participants_user_idx
  on public.reel_delivery_participants(user_id);

create table if not exists public.reel_delivery_versions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.reel_deliveries(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  video_path text not null,
  file_name text not null,
  size_bytes bigint not null check (size_bytes > 0),
  content_type text not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  uploaded_by_id uuid references public.users(id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  unique (delivery_id, version_number)
);

create table if not exists public.reel_delivery_decisions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.reel_deliveries(id) on delete cascade,
  version_id uuid not null references public.reel_delivery_versions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text not null,
  decision text not null check (decision in ('approved', 'changes_requested')),
  comment text check (comment is null or char_length(comment) <= 2000),
  recorded_by_id uuid references public.users(id) on delete set null,
  recorded_by_name text,
  created_at timestamptz not null default now(),
  unique (version_id, user_id),
  constraint reel_delivery_decision_comment_required check (
    decision = 'approved' or char_length(trim(coalesce(comment, ''))) > 0
  )
);

create index if not exists reel_delivery_decisions_delivery_idx
  on public.reel_delivery_decisions(delivery_id, created_at);

create or replace function public.set_reel_delivery_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reel_deliveries_updated_at on public.reel_deliveries;
create trigger reel_deliveries_updated_at before update on public.reel_deliveries
for each row execute function public.set_reel_delivery_updated_at();

-- Recalcula o status de aprovação a partir da versão mais recente, com a entrega
-- travada para que duas aprovações simultâneas não deixem o status desatualizado.
-- Etapas posteriores (pronto/publicado) só voltam para aprovação quando chega versão nova.
create or replace function public.refresh_reel_delivery_status(p_delivery_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.reel_deliveries%rowtype;
  v_version_id uuid;
  v_participants integer;
  v_approved integer;
  v_changes integer;
  v_status text;
begin
  select * into v_delivery from public.reel_deliveries where id = p_delivery_id for update;
  if not found then return null; end if;

  select id into v_version_id
    from public.reel_delivery_versions
   where delivery_id = p_delivery_id
   order by version_number desc
   limit 1;

  select count(*) into v_participants
    from public.reel_delivery_participants where delivery_id = p_delivery_id;

  select count(*) filter (where d.decision = 'approved'),
         count(*) filter (where d.decision = 'changes_requested')
    into v_approved, v_changes
    from public.reel_delivery_decisions d
    join public.reel_delivery_participants p
      on p.delivery_id = d.delivery_id and p.user_id = d.user_id
   where d.version_id = v_version_id;

  if v_version_id is null then
    v_status := 'awaiting_approval';
  elsif v_changes > 0 then
    v_status := 'changes_requested';
  elsif v_participants > 0 and v_approved >= v_participants then
    v_status := case when v_delivery.status in ('ready', 'published') then v_delivery.status else 'approved' end;
  else
    v_status := 'awaiting_approval';
  end if;

  update public.reel_deliveries
     set status = v_status,
         approved_at = case
           when v_status in ('approved', 'ready', 'published') then coalesce(v_delivery.approved_at, now())
           else null
         end,
         ready_at = case when v_status in ('ready', 'published') then v_delivery.ready_at else null end,
         published_at = case when v_status = 'published' then v_delivery.published_at else null end
   where id = p_delivery_id;

  return v_status;
end;
$$;

revoke execute on function public.refresh_reel_delivery_status(uuid) from public, anon, authenticated;
grant execute on function public.refresh_reel_delivery_status(uuid) to service_role;

alter table public.reel_deliveries enable row level security;
alter table public.reel_delivery_participants enable row level security;
alter table public.reel_delivery_versions enable row level security;
alter table public.reel_delivery_decisions enable row level security;

-- Autorização recalculada no servidor (mesmo contrato do cronograma).
revoke all on public.reel_deliveries from anon, authenticated;
revoke all on public.reel_delivery_participants from anon, authenticated;
revoke all on public.reel_delivery_versions from anon, authenticated;
revoke all on public.reel_delivery_decisions from anon, authenticated;
grant all on public.reel_deliveries to service_role;
grant all on public.reel_delivery_participants to service_role;
grant all on public.reel_delivery_versions to service_role;
grant all on public.reel_delivery_decisions to service_role;

drop policy if exists reel_deliveries_service_role on public.reel_deliveries;
create policy reel_deliveries_service_role on public.reel_deliveries
  for all to service_role using (true) with check (true);
drop policy if exists reel_delivery_participants_service_role on public.reel_delivery_participants;
create policy reel_delivery_participants_service_role on public.reel_delivery_participants
  for all to service_role using (true) with check (true);
drop policy if exists reel_delivery_versions_service_role on public.reel_delivery_versions;
create policy reel_delivery_versions_service_role on public.reel_delivery_versions
  for all to service_role using (true) with check (true);
drop policy if exists reel_delivery_decisions_service_role on public.reel_delivery_decisions;
create policy reel_delivery_decisions_service_role on public.reel_delivery_decisions
  for all to service_role using (true) with check (true);

-- Bucket PRIVADO: vídeos e capas. Quem aprova assiste por URL assinada do servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'MARKETING-SYSTEM-REELS',
  'MARKETING-SYSTEM-REELS',
  false,
  1073741824,
  array[
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
    'image/jpeg', 'image/png', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Mesmo critério de "Marketing" do cronograma: admin, designer ou departamento Marketing.
create or replace function public.has_content_manager_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active is not false
      and (
        lower(coalesce(u.role, '')) in ('admin', 'designer')
        or lower(trim(coalesce(u.department, ''))) = 'marketing'
      )
  );
$$;

revoke execute on function public.has_content_manager_access() from public, anon;
grant execute on function public.has_content_manager_access() to authenticated, service_role;

drop policy if exists "Content managers read MARKETING-SYSTEM-REELS" on storage.objects;
drop policy if exists "Content managers insert MARKETING-SYSTEM-REELS" on storage.objects;
drop policy if exists "Content managers update MARKETING-SYSTEM-REELS" on storage.objects;
drop policy if exists "Content managers delete MARKETING-SYSTEM-REELS" on storage.objects;

-- Leitura é necessária ao upload retomável com upsert; os demais assistem por URL assinada.
create policy "Content managers read MARKETING-SYSTEM-REELS"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-REELS'
    and (select public.has_content_manager_access())
  );

create policy "Content managers insert MARKETING-SYSTEM-REELS"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'MARKETING-SYSTEM-REELS'
    and (storage.foldername(name))[1] = 'deliveries'
    and (select public.has_content_manager_access())
  );

create policy "Content managers update MARKETING-SYSTEM-REELS"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-REELS'
    and (select public.has_content_manager_access())
  )
  with check (
    bucket_id = 'MARKETING-SYSTEM-REELS'
    and (storage.foldername(name))[1] = 'deliveries'
    and (select public.has_content_manager_access())
  );

create policy "Content managers delete MARKETING-SYSTEM-REELS"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-REELS'
    and (select public.has_content_manager_access())
  );

comment on table public.reel_deliveries is
  'Reels editados enviados para aprovação de quem gravou, com capa e legenda preparadas pelo Marketing.';
