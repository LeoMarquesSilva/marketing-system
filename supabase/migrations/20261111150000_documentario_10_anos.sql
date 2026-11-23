-- Minidocumentário dos 10 anos ("O que construímos juntos") e futuros projetos de vídeo.
-- Conteúdo do projeto no banco (editável e com versões), aprovação com os sócios,
-- gravações, roteiro de perguntas para o dia, checklist e acervo histórico.
--
-- Acesso: o documento contém tópicos biográficos. As tabelas só são lidas e escritas
-- pelo servidor (service role), depois de conferir admin ou a chave /documentario
-- em users.permissions. O bucket é privado: arquivos só por link assinado.

create table if not exists public.documentary_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  eyebrow text,
  title text not null,
  subtitle text,
  tagline text,
  signature text,
  version_label text not null default '1.0',
  status_label text,
  usage_note text,
  access_note text,
  event_id uuid references public.events(id) on delete set null,
  event_task_id uuid references public.event_tasks(id) on delete set null,
  festa_target_seconds integer,
  extended_target_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documentary_projects is
  'Projeto de vídeo/documentário. O primeiro é o minidocumentário dos 10 anos, ligado ao evento da festa.';

-- Protagonistas e quem aprova (Ricardo e Gustavo). A chave (ricardo, gustavo) liga perguntas e decisões.
create table if not exists public.documentary_people (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  key text not null,
  name text not null,
  short_name text not null,
  user_id uuid references public.users(id) on delete set null,
  is_approver boolean not null default true,
  sort integer not null default 0,
  unique (project_id, key)
);

-- Seções do documento (texto em markdown), com versão atual.
create table if not exists public.documentary_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  slug text not null,
  number text,
  title text not null,
  body text not null default '',
  sort integer not null default 0,
  version integer not null default 1,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

-- Cada versão salva de uma seção (a 1 é o documento original).
create table if not exists public.documentary_section_versions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.documentary_sections(id) on delete cascade,
  version integer not null,
  title text not null,
  body text not null,
  note text,
  project_version text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (section_id, version)
);

-- Versões do projeto como um todo (1.0, 1.1…), com o que mudou.
create table if not exists public.documentary_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  version_label text not null,
  note text,
  section_versions jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version_label)
);

-- Comentários nas seções (sócios e equipe melhorando a proposta).
create table if not exists public.documentary_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  section_id uuid references public.documentary_sections(id) on delete cascade,
  body text not null,
  author_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Itens que os sócios aprovam (seção 19 antes da gravação; seção 18 depois da montagem).
create table if not exists public.documentary_approval_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  stage text not null check (stage in ('validacao', 'editorial', 'producao')),
  sort integer not null default 0,
  title text not null,
  context text,
  sensitive boolean not null default false,
  approvers text[] not null default array['ricardo', 'gustavo']::text[],
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.documentary_approval_items.stage is
  'validacao = antes da gravação (seção 19); editorial e producao = critérios de aprovação do filme (seção 18).';

-- Histórico de decisões: a mais recente de cada pessoa vale.
create table if not exists public.documentary_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.documentary_approval_items(id) on delete cascade,
  person_key text not null,
  status text not null check (status in ('pendente', 'aprovado', 'ajustar', 'recusado')),
  note text,
  decided_on date,
  project_version text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists documentary_approval_decisions_item_idx
  on public.documentary_approval_decisions (item_id, person_key, created_at desc);

-- Gravações: pré-entrevistas, entrevistas, conversa conjunta, B-roll. Datas só quando marcadas.
create table if not exists public.documentary_shoots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  kind text not null check (kind in ('pre_entrevista', 'entrevista', 'conversa_conjunta', 'broll', 'outro')),
  title text not null,
  person_keys text[] not null default array[]::text[],
  estimate text,
  optional boolean not null default false,
  scheduled_date date,
  start_time time,
  end_time time,
  location text,
  participants jsonb not null default '[]'::jsonb,
  status text not null default 'a_marcar' check (status in ('a_marcar', 'marcada', 'realizada', 'cancelada')),
  notes text,
  timer_started_at timestamptz,
  timer_elapsed_seconds integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.documentary_shoots.participants is
  'Quem participa: [{"name": "...", "user_id": "uuid|null", "role": "entrevistador|filmmaker|..."}].';

-- Perguntas por sócio, comuns e de aprofundamento; prioridade é a seleção de 8 a 12.
create table if not exists public.documentary_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  audience text not null check (audience in ('ricardo', 'gustavo', 'comum', 'aprofundamento')),
  sort integer not null default 0,
  text text not null,
  note text,
  sensitive boolean not null default false,
  approval_item_id uuid references public.documentary_approval_items(id) on delete set null,
  priority boolean not null default false,
  added_on_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O que aconteceu com cada pergunta em cada gravação (feita, tempo, trecho forte).
create table if not exists public.documentary_question_takes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.documentary_questions(id) on delete cascade,
  shoot_id uuid not null references public.documentary_shoots(id) on delete cascade,
  asked boolean not null default false,
  asked_at timestamptz,
  time_mark text,
  strong boolean not null default false,
  note text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (question_id, shoot_id)
);

-- Checklist operacional (Anexo A). As fases antes, montagem e festa marcam no item;
-- "No dia da captação" marca por gravação (documentary_shoot_checks).
create table if not exists public.documentary_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  phase text not null check (phase in ('antes', 'dia', 'montagem', 'festa')),
  sort integer not null default 0,
  text text not null,
  done_at timestamptz,
  done_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.documentary_shoot_checks (
  shoot_id uuid not null references public.documentary_shoots(id) on delete cascade,
  item_id uuid not null references public.documentary_checklist_items(id) on delete cascade,
  done_at timestamptz not null default now(),
  done_by uuid references public.users(id) on delete set null,
  primary key (shoot_id, item_id)
);

-- Acervo histórico (seção 13): um registro por arquivo enviado.
create table if not exists public.documentary_archive_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.documentary_projects(id) on delete cascade,
  seq bigint generated always as identity,
  storage_path text not null,
  thumb_path text,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  kind text not null default 'foto' check (kind in ('foto', 'video', 'audio', 'documento')),
  width integer,
  height integer,
  year integer check (year is null or (year between 1900 and 2100)),
  year_approx boolean not null default true,
  date_note text,
  description text,
  people jsonb not null default '[]'::jsonb,
  category text,
  source text,
  authorization_status text not null default 'pendente'
    check (authorization_status in ('pendente', 'autorizado', 'nao_autorizado', 'nao_precisa')),
  allowed_uses text[] not null default array[]::text[],
  chapters text[] not null default array[]::text[],
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'nao_utilizavel')),
  status_note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documentary_archive_items_project_idx
  on public.documentary_archive_items (project_id, year, seq);

comment on column public.documentary_archive_items.allowed_uses is
  'Usos autorizados, um a um (a autorização para a festa não vale para redes, site ou propostas): festa, versao_estendida, redes, site, propostas, arquivo_interno.';

-- updated_at automático (mesma função do resto do sistema).
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'documentary_projects', 'documentary_sections', 'documentary_approval_items',
    'documentary_shoots', 'documentary_questions', 'documentary_archive_items'
  ] loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$I', tabela);
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I for each row execute function public.set_ferias_updated_at()',
      tabela
    );
  end loop;
end $$;

-- Só o servidor lê e escreve (o acesso é conferido na API).
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'documentary_projects', 'documentary_people', 'documentary_sections', 'documentary_section_versions',
    'documentary_project_versions', 'documentary_comments', 'documentary_approval_items',
    'documentary_approval_decisions', 'documentary_shoots', 'documentary_questions',
    'documentary_question_takes', 'documentary_checklist_items', 'documentary_shoot_checks',
    'documentary_archive_items'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on public.%I from anon, authenticated', tabela);
    execute format('grant select, insert, update, delete on public.%I to service_role', tabela);
  end loop;
end $$;

-- Quem pode enviar arquivos ao acervo: admin ou a chave de edição do documentário.
create or replace function public.has_documentary_editor_access()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and coalesce(u.is_active, true)
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/documentario/editar' = any (coalesce(u.permissions, array[]::text[]))
      )
  );
$$;

revoke all on function public.has_documentary_editor_access() from public, anon;
grant execute on function public.has_documentary_editor_access() to authenticated;

-- Bucket privado do acervo (fotos e vídeos antigos). Leitura só por link assinado do servidor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('MARKETING-SYSTEM-DOCUMENTARIO', 'MARKETING-SYSTEM-DOCUMENTARIO', false, 2147483648)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "Documentário: equipe envia ao acervo" on storage.objects;
create policy "Documentário: equipe envia ao acervo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'MARKETING-SYSTEM-DOCUMENTARIO'
    and (storage.foldername(name))[1] = 'acervo'
    and (select public.has_documentary_editor_access())
  );
