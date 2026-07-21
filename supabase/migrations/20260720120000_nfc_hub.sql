-- NFC Hub: etiquetas físicas com URL permanente e execução segura server-side.
-- Migration aditiva; não altera tabelas ou funcionalidades existentes.

create table if not exists public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  public_token text not null unique,
  name text not null,
  description text,
  environment text,
  location text,
  category text,
  responsible_user_id uuid references public.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  access_mode text not null default 'public'
    check (access_mode in ('public', 'public_confirmation', 'authenticated', 'admin', 'selected_users')),
  action_type text not null default 'url'
    check (action_type in ('url', 'custom_page', 'form', 'webhook', 'whatsapp', 'menu', 'sequence')),
  action_config jsonb not null default '{}'::jsonb,
  cooldown_seconds integer not null default 0 check (cooldown_seconds between 0 and 86400),
  total_scans integer not null default 0 check (total_scans >= 0),
  last_scanned_at timestamptz,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.nfc_tag_allowed_users (
  tag_id uuid not null references public.nfc_tags(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tag_id, user_id)
);

create table if not exists public.nfc_tag_scans (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  scanned_at timestamptz not null default now(),
  authenticated_user_id uuid references public.users(id) on delete set null,
  anonymous_session_id text,
  user_agent text,
  platform text,
  referrer text,
  ip_hash text,
  result_status text not null default 'received'
    check (result_status in (
      'received', 'confirmation_required', 'completed', 'error',
      'rate_limited', 'cooldown', 'inactive', 'access_denied'
    )),
  execution_time_ms integer check (execution_time_ms is null or execution_time_ms >= 0),
  error_code text
);

create table if not exists public.nfc_action_executions (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  scan_id uuid references public.nfc_tag_scans(id) on delete set null,
  action_type text not null,
  status text not null check (status in ('pending', 'running', 'success', 'error', 'skipped')),
  idempotency_key text not null unique,
  request_metadata jsonb,
  response_status integer,
  execution_time_ms integer check (execution_time_ms is null or execution_time_ms >= 0),
  error_code text,
  error_message_sanitized text,
  created_at timestamptz not null default now()
);

create table if not exists public.nfc_form_submissions (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  scan_id uuid references public.nfc_tag_scans(id) on delete set null,
  submitted_by uuid references public.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nfc_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  action_type text not null
    check (action_type in ('url', 'custom_page', 'form', 'webhook', 'whatsapp', 'menu', 'sequence')),
  action_config jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nfc_tag_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nfc_tags_public_token_idx on public.nfc_tags(public_token);
create index if not exists nfc_tags_status_idx on public.nfc_tags(status) where deleted_at is null;
create index if not exists nfc_tags_category_idx on public.nfc_tags(category);
create index if not exists nfc_tags_environment_idx on public.nfc_tags(environment);
create index if not exists nfc_tags_deleted_at_idx on public.nfc_tags(deleted_at);
create index if not exists nfc_tag_scans_tag_id_idx on public.nfc_tag_scans(tag_id);
create index if not exists nfc_tag_scans_scanned_at_idx on public.nfc_tag_scans(scanned_at desc);
create index if not exists nfc_tag_scans_ip_hash_idx on public.nfc_tag_scans(ip_hash, scanned_at desc);
create index if not exists nfc_action_executions_tag_id_idx on public.nfc_action_executions(tag_id);
create index if not exists nfc_action_executions_scan_id_idx on public.nfc_action_executions(scan_id);
create index if not exists nfc_action_executions_created_at_idx on public.nfc_action_executions(created_at desc);
create index if not exists nfc_form_submissions_tag_id_idx on public.nfc_form_submissions(tag_id);
create index if not exists nfc_tag_audit_logs_tag_id_idx on public.nfc_tag_audit_logs(tag_id, created_at desc);

create or replace function public.set_nfc_updated_at()
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

create or replace function public.increment_nfc_tag_scan_count(p_tag_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.nfc_tags
  set total_scans = total_scans + 1,
      last_scanned_at = now()
  where id = p_tag_id;
$$;

revoke all on function public.increment_nfc_tag_scan_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_nfc_tag_scan_count(uuid) to service_role;

drop trigger if exists nfc_tags_set_updated_at on public.nfc_tags;
create trigger nfc_tags_set_updated_at
before update on public.nfc_tags
for each row execute function public.set_nfc_updated_at();

drop trigger if exists nfc_templates_set_updated_at on public.nfc_templates;
create trigger nfc_templates_set_updated_at
before update on public.nfc_templates
for each row execute function public.set_nfc_updated_at();

alter table public.nfc_tags enable row level security;
alter table public.nfc_tag_allowed_users enable row level security;
alter table public.nfc_tag_scans enable row level security;
alter table public.nfc_action_executions enable row level security;
alter table public.nfc_form_submissions enable row level security;
alter table public.nfc_templates enable row level security;
alter table public.nfc_tag_audit_logs enable row level security;

-- Novas tabelas não são mais expostas automaticamente pela Data API.
revoke all on public.nfc_tags from anon;
revoke all on public.nfc_tag_allowed_users from anon;
revoke all on public.nfc_tag_scans from anon;
revoke all on public.nfc_action_executions from anon;
revoke all on public.nfc_form_submissions from anon;
revoke all on public.nfc_templates from anon;
revoke all on public.nfc_tag_audit_logs from anon;

grant select, insert, update, delete on public.nfc_tags to authenticated, service_role;
grant select, insert, update, delete on public.nfc_tag_allowed_users to authenticated, service_role;
grant select, insert, update, delete on public.nfc_templates to authenticated, service_role;
grant select, insert, update, delete on public.nfc_tag_scans to service_role;
grant select, insert, update, delete on public.nfc_action_executions to service_role;
grant select, insert, update, delete on public.nfc_form_submissions to service_role;
grant select, insert, update, delete on public.nfc_tag_audit_logs to service_role;

create policy "nfc managers read tags"
on public.nfc_tags for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers insert tags"
on public.nfc_tags for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers update tags"
on public.nfc_tags for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers delete tags"
on public.nfc_tags for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

create policy "nfc managers manage allowed users"
on public.nfc_tag_allowed_users for all to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers read templates"
on public.nfc_templates for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers insert templates"
on public.nfc_templates for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or '/nfc' = any(coalesce(u.permissions, '{}'::text[])))
  )
);

create policy "nfc managers update own templates"
on public.nfc_templates for update to authenticated
using (
  is_system = false and exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or u.id = nfc_templates.created_by)
  )
)
with check (
  is_system = false and exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (lower(coalesce(u.role, '')) = 'admin' or u.id = nfc_templates.created_by)
  )
);

insert into public.nfc_templates (name, description, category, action_type, action_config, is_system)
values
  ('Abrir ticket de equipamento', 'Formulário rápido para registrar um problema e acionar o fluxo responsável.', 'Equipamento', 'form', '{"title":"Abrir ticket","description":"Conte o que aconteceu com o equipamento.","fields":[{"id":"problema","label":"Descreva o problema","type":"long_text","required":true}],"workflowKey":"abrir-ticket-equipamento"}', true),
  ('Solicitar reposição de estoque', 'Registra uma solicitação de reposição vinculada ao item físico.', 'Estoque', 'form', '{"title":"Solicitar reposição","fields":[{"id":"quantidade","label":"Quantidade necessária","type":"number","required":true}],"workflowKey":"reposicao-estoque"}', true),
  ('Check-in em evento', 'Confirma presença por meio de uma página simples.', 'Evento', 'form', '{"title":"Check-in","fields":[{"id":"nome","label":"Seu nome","type":"short_text","required":true}],"workflowKey":"checkin-evento"}', true),
  ('Registrar presença em treinamento', 'Registra presença e horário do participante.', 'Evento', 'form', '{"title":"Registrar presença","fields":[{"id":"nome","label":"Nome","type":"short_text","required":true}],"workflowKey":"presenca-treinamento"}', true),
  ('Abrir material de reunião', 'Abre uma URL de pauta, apresentação ou documentos.', 'Marketing', 'url', '{"destinationUrl":"https://","openImmediately":true}', true),
  ('Capturar ideia de Marketing', 'Formulário curto para registrar uma ideia no momento em que surgir.', 'Marketing', 'form', '{"title":"Nova ideia","fields":[{"id":"ideia","label":"Descreva sua ideia","type":"long_text","required":true}],"workflowKey":"capturar-ideia-marketing"}', true),
  ('Registrar retirada de equipamento', 'Solicita identificação e confirmação antes do registro.', 'Equipamento', 'form', '{"title":"Retirada de equipamento","fields":[{"id":"responsavel","label":"Responsável","type":"short_text","required":true}],"workflowKey":"retirada-equipamento","sensitive":true}', true),
  ('Abrir lista de compras', 'Atalho permanente para uma lista compartilhada.', 'Automação pessoal', 'url', '{"destinationUrl":"https://","openImmediately":true}', true),
  ('Iniciar rotina pessoal', 'Aciona um fluxo previamente configurado no n8n.', 'Automação pessoal', 'webhook', '{"workflowKey":"iniciar-rotina-pessoal","requireConfirmation":true}', true),
  ('Enviar formulário de feedback', 'Coleta uma avaliação e comentários opcionais.', 'Marketing', 'form', '{"title":"Feedback","fields":[{"id":"nota","label":"Nota","type":"number","required":true},{"id":"comentario","label":"Comentário","type":"long_text","required":false}]}', true),
  ('Abrir URL simples', 'Redireciona para uma URL HTTPS configurada.', 'Outro', 'url', '{"destinationUrl":"https://","openImmediately":true}', true),
  ('Chamar fluxo do n8n', 'Executa um workflow seguro identificado por chave.', 'Automação', 'webhook', '{"workflowKey":"meu-fluxo","requireConfirmation":true}', true)
on conflict do nothing;
