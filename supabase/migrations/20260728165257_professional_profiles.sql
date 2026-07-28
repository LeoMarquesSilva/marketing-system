-- Perfis NFC: domínio de perfis profissionais 1:1 com public.users.
-- Migration aditiva; não altera tabelas, papéis ou permissões existentes.
--
-- Privacidade: nenhuma tabela guarda data de nascimento, IP, user-agent,
-- referrer, telefone do visitante ou qualquer identificador do visitante.
-- Leitura pública nunca passa por policy anon: usa o client admin server-side
-- com projeção de colunas explícita.

-- ---------------------------------------------------------------------------
-- Perfil e localizações
-- ---------------------------------------------------------------------------

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  photo_url text,
  oab text,
  joined_on date,
  professional_email text,
  professional_phone text,
  linkedin_url text,
  website_url text,
  show_tenure boolean not null default true,
  show_email boolean not null default false,
  show_whatsapp boolean not null default false,
  show_linkedin boolean not null default true,
  show_website boolean not null default true,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_profile_localizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  locale text not null check (locale in ('pt-BR', 'en')),
  is_approved boolean not null default false,
  display_name text,
  role text,
  practice_area text,
  tagline text,
  bio text,
  unique (profile_id, locale)
);

-- ---------------------------------------------------------------------------
-- Seções ordenadas, entradas localizadas e overrides de conteúdo
-- ---------------------------------------------------------------------------

create table if not exists public.professional_profile_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  section_key text not null check (
    section_key in ('practice', 'education', 'knowledge', 'highlights', 'timeline')
  ),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  unique (profile_id, section_key)
);

create table if not exists public.professional_profile_entries (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.professional_profile_sections(id) on delete cascade,
  entry_type text not null,
  link_url text,
  image_url text,
  occurred_on date,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

create table if not exists public.professional_profile_entry_localizations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.professional_profile_entries(id) on delete cascade,
  locale text not null check (locale in ('pt-BR', 'en')),
  title text not null,
  subtitle text,
  description text,
  unique (entry_id, locale)
);

create table if not exists public.professional_profile_content_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  source_type text not null check (source_type in ('instagram', 'linkedin', 'reel_studio')),
  source_id text not null,
  is_hidden boolean not null default true,
  unique (profile_id, source_type, source_id)
);

-- ---------------------------------------------------------------------------
-- Cartões, redirects de slug, eventos e campanha
-- ---------------------------------------------------------------------------

create table if not exists public.professional_profile_cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  nfc_tag_id uuid unique references public.nfc_tags(id) on delete set null,
  code text not null unique,
  label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'replaced', 'inactive')),
  replaced_card_id uuid references public.professional_profile_cards(id) on delete set null,
  issued_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.professional_profile_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  old_slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.professional_profile_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  card_id uuid references public.professional_profile_cards(id) on delete set null,
  event_type text not null check (event_type in (
    'profile_view', 'nfc_scan', 'qr_scan', 'contact_download', 'share',
    'whatsapp_click', 'email_click', 'linkedin_click', 'website_click'
  )),
  source text not null default 'direct'
    check (source in ('direct', 'nfc', 'qr', 'share')),
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  occurred_at timestamptz not null default now()
);

create table if not exists public.professional_profile_campaign (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  title_pt text not null default 'Dia da Advocacia 2026',
  title_en text not null default 'Lawyers'' Day 2026',
  message_pt text not null default 'A advocacia começa pela escuta.',
  message_en text not null default 'Advocacy begins with listening.',
  call_to_action_pt text,
  call_to_action_en text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.professional_profile_campaign (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Índices (inclui todas as FKs sem índice de cobertura)
-- ---------------------------------------------------------------------------

create index if not exists professional_profiles_status_idx
  on public.professional_profiles(status);
create index if not exists professional_profiles_slug_idx
  on public.professional_profiles(slug);
create index if not exists professional_profiles_created_by_idx
  on public.professional_profiles(created_by);
create index if not exists professional_profiles_updated_by_idx
  on public.professional_profiles(updated_by);

create index if not exists professional_profile_entries_section_order_idx
  on public.professional_profile_entries(section_id, sort_order);

create index if not exists professional_profile_cards_profile_idx
  on public.professional_profile_cards(profile_id);
create index if not exists professional_profile_cards_status_idx
  on public.professional_profile_cards(status);
create index if not exists professional_profile_cards_replaced_card_idx
  on public.professional_profile_cards(replaced_card_id);

create index if not exists professional_profile_slug_redirects_profile_idx
  on public.professional_profile_slug_redirects(profile_id);

create index if not exists professional_profile_events_profile_time_idx
  on public.professional_profile_events(profile_id, occurred_at desc);
create index if not exists professional_profile_events_profile_type_time_idx
  on public.professional_profile_events(profile_id, event_type, occurred_at desc);
create index if not exists professional_profile_events_card_idx
  on public.professional_profile_events(card_id);

create index if not exists professional_profile_content_overrides_source_idx
  on public.professional_profile_content_overrides(source_type, source_id);

create index if not exists professional_profile_campaign_updated_by_idx
  on public.professional_profile_campaign(updated_by);

-- ---------------------------------------------------------------------------
-- Trigger de updated_at (mesma convenção do NFC Hub)
-- ---------------------------------------------------------------------------

create or replace function public.set_professional_profile_updated_at()
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

drop trigger if exists professional_profiles_set_updated_at on public.professional_profiles;
create trigger professional_profiles_set_updated_at
before update on public.professional_profiles
for each row execute function public.set_professional_profile_updated_at();

drop trigger if exists professional_profile_campaign_set_updated_at on public.professional_profile_campaign;
create trigger professional_profile_campaign_set_updated_at
before update on public.professional_profile_campaign
for each row execute function public.set_professional_profile_updated_at();

-- ---------------------------------------------------------------------------
-- Registro de eventos: única função de escrita, sem dados do visitante
-- ---------------------------------------------------------------------------

create or replace function public.record_professional_profile_event(
  p_profile_id uuid,
  p_event_type text,
  p_source text default 'direct',
  p_locale text default 'pt-BR',
  p_card_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_count integer;
begin
  -- Listas fechadas: qualquer valor fora delas é descartado silenciosamente,
  -- para que uma falha de métrica nunca quebre a navegação pública.
  if p_event_type is null or p_event_type not in (
    'profile_view', 'nfc_scan', 'qr_scan', 'contact_download', 'share',
    'whatsapp_click', 'email_click', 'linkedin_click', 'website_click'
  ) then
    return false;
  end if;

  if coalesce(p_source, 'direct') not in ('direct', 'nfc', 'qr', 'share') then
    return false;
  end if;

  if coalesce(p_locale, 'pt-BR') not in ('pt-BR', 'en') then
    return false;
  end if;

  if not exists (
    select 1 from public.professional_profiles pp where pp.id = p_profile_id
  ) then
    return false;
  end if;

  -- Teto grosseiro por perfil/tipo/minuto. Não identifica o visitante:
  -- serve apenas para conter escrita abusiva na mesma janela.
  select count(*) into v_recent_count
  from public.professional_profile_events e
  where e.profile_id = p_profile_id
    and e.event_type = p_event_type
    and e.occurred_at > now() - interval '1 minute';

  if v_recent_count >= 300 then
    return false;
  end if;

  insert into public.professional_profile_events
    (profile_id, card_id, event_type, source, locale)
  values (
    p_profile_id,
    p_card_id,
    p_event_type,
    coalesce(p_source, 'direct'),
    coalesce(p_locale, 'pt-BR')
  );

  return true;
end;
$$;

revoke all on function public.record_professional_profile_event(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_professional_profile_event(uuid, text, text, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Importação atômica de colaboradores
-- ---------------------------------------------------------------------------

create or replace function public.apply_professional_profile_import(
  p_rows jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_email text;
  v_slug_base text;
  v_slug text;
  v_suffix integer;
  v_user_id uuid;
  v_profile_id uuid;
  v_overwrite boolean;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_unmatched integer := 0;
  v_touched boolean;
begin
  -- Contexto: apenas o papel de serviço do app ou um usuário admin autenticado.
  if not (
    current_user in ('service_role', 'postgres', 'supabase_admin')
    or exists (
      select 1 from public.users u
      where u.auth_id = (select auth.uid())
        and lower(coalesce(u.role, '')) = 'admin'
    )
  ) then
    raise exception 'apply_professional_profile_import requires an admin context'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object(
      'created', 0, 'updated', 0, 'skipped', 0, 'unmatched', 0
    );
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_email := lower(btrim(coalesce(v_row->>'email', '')));
    v_overwrite := coalesce((v_row->>'overwrite')::boolean, false);

    if v_email = '' then
      v_unmatched := v_unmatched + 1;
      continue;
    end if;

    -- Trava o usuário correspondente para evitar corrida entre importações.
    select u.id into v_user_id
    from public.users u
    where lower(btrim(coalesce(u.email, ''))) = v_email
    limit 1
    for update;

    if v_user_id is null then
      v_unmatched := v_unmatched + 1;
      continue;
    end if;

    select pp.id into v_profile_id
    from public.professional_profiles pp
    where pp.user_id = v_user_id;

    if v_profile_id is null then
      -- Slug determinístico: sufixo numérico em vez de sobrescrever outro perfil.
      v_slug_base := nullif(btrim(coalesce(v_row->>'slug', '')), '');
      if v_slug_base is null then
        v_unmatched := v_unmatched + 1;
        continue;
      end if;

      v_slug := v_slug_base;
      v_suffix := 1;
      while exists (
        select 1 from public.professional_profiles pp where pp.slug = v_slug
      ) or exists (
        select 1 from public.professional_profile_slug_redirects r where r.old_slug = v_slug
      ) loop
        v_suffix := v_suffix + 1;
        v_slug := v_slug_base || '-' || v_suffix::text;
      end loop;

      insert into public.professional_profiles (
        user_id, slug, status, professional_email, professional_phone,
        joined_on, created_by, updated_by
      )
      values (
        v_user_id,
        v_slug,
        'draft', -- importação nunca publica
        nullif(btrim(coalesce(v_row->>'email', '')), ''),
        nullif(btrim(coalesce(v_row->>'phone', '')), ''),
        nullif(btrim(coalesce(v_row->>'joinedOn', '')), '')::date,
        p_actor_id,
        p_actor_id
      )
      returning id into v_profile_id;

      insert into public.professional_profile_localizations
        (profile_id, locale, is_approved, display_name, role, practice_area)
      values (
        v_profile_id,
        'pt-BR',
        true,
        nullif(btrim(coalesce(v_row->>'name', '')), ''),
        nullif(btrim(coalesce(v_row->>'role', '')), ''),
        nullif(btrim(coalesce(v_row->>'area', '')), '')
      )
      on conflict (profile_id, locale) do nothing;

      insert into public.professional_profile_sections (profile_id, section_key, enabled, sort_order)
      values
        (v_profile_id, 'practice', true, 0),
        (v_profile_id, 'education', true, 1),
        (v_profile_id, 'knowledge', true, 2),
        (v_profile_id, 'highlights', true, 3),
        (v_profile_id, 'timeline', true, 4)
      on conflict (profile_id, section_key) do nothing;

      v_created := v_created + 1;
    else
      -- Re-importação: só preenche o que está vazio, salvo overwrite explícito.
      v_touched := false;

      update public.professional_profiles pp
      set
        professional_email = case
          when v_overwrite or nullif(btrim(coalesce(pp.professional_email, '')), '') is null
            then coalesce(nullif(btrim(coalesce(v_row->>'email', '')), ''), pp.professional_email)
          else pp.professional_email
        end,
        professional_phone = case
          when v_overwrite or nullif(btrim(coalesce(pp.professional_phone, '')), '') is null
            then coalesce(nullif(btrim(coalesce(v_row->>'phone', '')), ''), pp.professional_phone)
          else pp.professional_phone
        end,
        joined_on = case
          when v_overwrite or pp.joined_on is null
            then coalesce(nullif(btrim(coalesce(v_row->>'joinedOn', '')), '')::date, pp.joined_on)
          else pp.joined_on
        end,
        updated_by = p_actor_id
      where pp.id = v_profile_id
        and (
          v_overwrite
          or nullif(btrim(coalesce(pp.professional_email, '')), '') is null
          or nullif(btrim(coalesce(pp.professional_phone, '')), '') is null
          or pp.joined_on is null
        );

      if found then
        v_touched := true;
      end if;

      insert into public.professional_profile_localizations
        (profile_id, locale, is_approved, display_name, role, practice_area)
      values (
        v_profile_id,
        'pt-BR',
        true,
        nullif(btrim(coalesce(v_row->>'name', '')), ''),
        nullif(btrim(coalesce(v_row->>'role', '')), ''),
        nullif(btrim(coalesce(v_row->>'area', '')), '')
      )
      on conflict (profile_id, locale) do update
      set
        display_name = case
          when v_overwrite or nullif(btrim(coalesce(public.professional_profile_localizations.display_name, '')), '') is null
            then coalesce(excluded.display_name, public.professional_profile_localizations.display_name)
          else public.professional_profile_localizations.display_name
        end,
        role = case
          when v_overwrite or nullif(btrim(coalesce(public.professional_profile_localizations.role, '')), '') is null
            then coalesce(excluded.role, public.professional_profile_localizations.role)
          else public.professional_profile_localizations.role
        end,
        practice_area = case
          when v_overwrite or nullif(btrim(coalesce(public.professional_profile_localizations.practice_area, '')), '') is null
            then coalesce(excluded.practice_area, public.professional_profile_localizations.practice_area)
          else public.professional_profile_localizations.practice_area
        end;

      -- Garante as seções padrão mesmo em perfis criados antes desta versão.
      insert into public.professional_profile_sections (profile_id, section_key, enabled, sort_order)
      values
        (v_profile_id, 'practice', true, 0),
        (v_profile_id, 'education', true, 1),
        (v_profile_id, 'knowledge', true, 2),
        (v_profile_id, 'highlights', true, 3),
        (v_profile_id, 'timeline', true, 4)
      on conflict (profile_id, section_key) do nothing;

      if v_touched then
        v_updated := v_updated + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end if;
  end loop;

  -- Nunca toca em users.is_active, users.role ou users.permissions.
  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'unmatched', v_unmatched
  );
end;
$$;

revoke all on function public.apply_professional_profile_import(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_professional_profile_import(jsonb, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS: admin autenticado administra; leitura pública só via client server-side
-- ---------------------------------------------------------------------------

alter table public.professional_profiles enable row level security;
alter table public.professional_profile_localizations enable row level security;
alter table public.professional_profile_sections enable row level security;
alter table public.professional_profile_entries enable row level security;
alter table public.professional_profile_entry_localizations enable row level security;
alter table public.professional_profile_content_overrides enable row level security;
alter table public.professional_profile_cards enable row level security;
alter table public.professional_profile_slug_redirects enable row level security;
alter table public.professional_profile_events enable row level security;
alter table public.professional_profile_campaign enable row level security;

revoke all on public.professional_profiles from anon;
revoke all on public.professional_profile_localizations from anon;
revoke all on public.professional_profile_sections from anon;
revoke all on public.professional_profile_entries from anon;
revoke all on public.professional_profile_entry_localizations from anon;
revoke all on public.professional_profile_content_overrides from anon;
revoke all on public.professional_profile_cards from anon;
revoke all on public.professional_profile_slug_redirects from anon;
revoke all on public.professional_profile_events from anon;
revoke all on public.professional_profile_campaign from anon;

grant select, insert, update, delete on public.professional_profiles to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_localizations to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_sections to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_entries to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_entry_localizations to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_content_overrides to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_cards to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_slug_redirects to authenticated, service_role;
grant select, insert, update, delete on public.professional_profile_campaign to authenticated, service_role;
grant select on public.professional_profile_events to authenticated;
grant select, insert, update, delete on public.professional_profile_events to service_role;

-- Perfis: administração exige papel admin (a permissão /nfc não basta).
create policy "profile admins read profiles"
on public.professional_profiles for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "profile admins insert profiles"
on public.professional_profiles for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "profile admins update profiles"
on public.professional_profiles for update to authenticated
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

create policy "profile admins delete profiles"
on public.professional_profiles for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "profile admins manage localizations"
on public.professional_profile_localizations for all to authenticated
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

create policy "profile admins manage sections"
on public.professional_profile_sections for all to authenticated
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

create policy "profile admins manage entries"
on public.professional_profile_entries for all to authenticated
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

create policy "profile admins manage entry localizations"
on public.professional_profile_entry_localizations for all to authenticated
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

create policy "profile admins manage content overrides"
on public.professional_profile_content_overrides for all to authenticated
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

create policy "profile admins manage cards"
on public.professional_profile_cards for all to authenticated
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

create policy "profile admins manage slug redirects"
on public.professional_profile_slug_redirects for all to authenticated
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

-- Eventos são somente leitura para admin; escrita só pela função dedicada.
create policy "profile admins read events"
on public.professional_profile_events for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "profile admins read campaign"
on public.professional_profile_campaign for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "profile admins update campaign"
on public.professional_profile_campaign for update to authenticated
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
