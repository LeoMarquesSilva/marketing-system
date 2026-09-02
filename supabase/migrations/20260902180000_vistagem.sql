-- Vistagem BP no ORQESTRAI — domínio apenas.
-- Sem profiles / app_role / triggers de auth. Acesso via requireOperacoesLegaisAccess + service_role.
-- NÃO aplicar no remoto sem confirmação explícita.

create type public.publication_status as enum (
  'CAPTURADA',
  'MATCH_PENDENTE',
  'JURIDICO_VISTAR',
  'PRAZO_PENDENTE',
  'AGENDAR',
  'AGENDANDO',
  'SIM_OK',
  'SIM_OK_AJUSTE',
  'ERRO',
  'SKIP'
);

create type public.schedule_job_status as enum (
  'queued',
  'running',
  'done',
  'failed',
  'dry_run'
);

create table public.diario_map (
  id uuid primary key default gen_random_uuid(),
  from_text text not null unique,
  to_text text not null,
  created_at timestamptz not null default now()
);

create table public.process_vinculos (
  ci text primary key,
  vinculo text not null,
  updated_at timestamptz not null default now()
);

create table public.process_base_rows (
  id uuid primary key default gen_random_uuid(),
  ci text not null,
  cnj text,
  area text,
  cliente text,
  escritorio_responsavel text,
  acao text,
  situacao text,
  fase text,
  advogado_responsavel text,
  processo_encerrado text,
  data_cadastro date,
  motivo_encerramento text,
  titulo text,
  grupo text,
  vinculo text,
  demanda_risco text,
  data_encerramento date,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index process_base_cnj_idx on public.process_base_rows (cnj);
create index process_base_ci_idx on public.process_base_rows (ci);
create index process_base_snapshot_idx on public.process_base_rows (snapshot_date);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  capture_date date not null,
  origem text not null default 'KURRIER',
  source_filename text,
  data_recebimento text,
  advogado_localizado text,
  data_divulgacao date,
  data_publicacao date,
  diario_divisao text,
  pasta text,
  numero_processo text,
  publicacao text,
  responsavel_principal text,
  escritorio_responsavel text,
  grupo text,
  cliente_principal text,
  natureza text,
  status_processo text,
  acao text,
  fase text,
  processo_encerrado text,
  motivo_encerramento text,
  titulo text,
  demanda_risco boolean not null default false,
  prioridade_agendamento boolean not null default false,
  juridico_texto text,
  controladoria_texto text,
  tipo_agendamento_id uuid,
  tipo_agendamento_label text,
  data_conclusao date,
  data_limite date,
  data_fatal date,
  hora_inicio time,
  hora_fim time,
  status public.publication_status not null default 'CAPTURADA',
  ci text,
  vios_pxe_id text,
  schedule_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publications_status_idx on public.publications (status);
create index publications_escritorio_idx on public.publications (escritorio_responsavel);
create index publications_cnj_idx on public.publications (numero_processo);
create index publications_capture_date_idx on public.publications (capture_date);
create unique index publications_idempotency_uidx
  on public.publications (idempotency_key)
  where idempotency_key is not null;

create table public.publication_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  event_type text not null,
  from_status public.publication_status,
  to_status public.publication_status,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index publication_events_pub_idx on public.publication_events (publication_id, created_at desc);

create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_vios text not null,
  kind text not null default 'prazo'
    check (kind in ('prazo', 'compromisso', 'skip')),
  requires_hora boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.task_type_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  task_type_id uuid not null references public.task_types (id) on delete cascade
);

alter table public.publications
  add constraint publications_tipo_agendamento_fk
  foreign key (tipo_agendamento_id) references public.task_types (id);

create table public.task_flows (
  id uuid primary key default gen_random_uuid(),
  task_type_id uuid not null references public.task_types (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  unique (task_type_id, name)
);

create table public.task_flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.task_flows (id) on delete cascade,
  step_order int not null,
  step_code text not null,
  label text not null,
  offset_rule text not null,
  notes text,
  unique (flow_id, step_order)
);

create table public.schedule_jobs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  status public.schedule_job_status not null default 'queued',
  dry_run boolean not null default false,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);

create index schedule_jobs_status_idx on public.schedule_jobs (status);

create table public.schedule_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.schedule_jobs (id) on delete cascade,
  attempt_no int not null default 1,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  success boolean,
  created_at timestamptz not null default now()
);

create table public.schedule_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.schedule_jobs (id) on delete cascade,
  publication_id uuid not null references public.publications (id) on delete cascade,
  vios_pxe_id text,
  review_status text not null,
  review_notes text,
  chain_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_vistagem_updated_at()
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

create trigger publications_updated_at
  before update on public.publications
  for each row execute function public.set_vistagem_updated_at();

alter table public.diario_map enable row level security;
alter table public.process_vinculos enable row level security;
alter table public.process_base_rows enable row level security;
alter table public.publications enable row level security;
alter table public.publication_events enable row level security;
alter table public.task_types enable row level security;
alter table public.task_type_aliases enable row level security;
alter table public.task_flows enable row level security;
alter table public.task_flow_steps enable row level security;
alter table public.schedule_jobs enable row level security;
alter table public.schedule_attempts enable row level security;
alter table public.schedule_results enable row level security;
alter table public.audit_events enable row level security;

-- Sem policy para authenticated: só service_role (bypass RLS) depois do gate de Operações Legais.

insert into storage.buckets (id, name, public)
values
  ('kurrier-inbox', 'kurrier-inbox', false),
  ('vios-base-inbox', 'vios-base-inbox', false)
on conflict (id) do nothing;

-- Seed: mapa diário, tipos VIOS e fluxos básicos

insert into public.diario_map (from_text, to_text) values
  ('DJSP_Caderno 2', 'DJSP'),
  ('DJSP_Caderno 4', 'DJSP'),
  ('DJSP_Caderno 3', 'DJSP'),
  ('DJES_TRT_Trabalhista', 'TRT17 - ES'),
  ('DJMG_Judiciário', 'DJMG'),
  ('DJSP_TRT15_Trabalhista', 'TRT15 - SP'),
  ('DJPR_Trabalhista', 'TRT9 - PR'),
  ('DJMG_FED_TRT_Trabalhista', 'TRT3 - MG'),
  ('DJMT_TRT_Trabalhista', 'TRT23 - MT'),
  ('DJSP_Caderno 5', 'DJSP'),
  ('TRT - 2 REGIAO _TRT2', 'TRT2 - SP'),
  ('DJMS_Judiciário', 'DJMS'),
  ('DJPA_AP_TRT_Trabalhista', 'TRT8 - PA'),
  ('TRT - 1 REGIAO_TRT1', 'TRT1 - RJ'),
  ('TRT - 10 REGIAO_TRT 10', 'TRT10 - TO'),
  ('DJRJ_Judiciário', 'DJRJ'),
  ('DJPE_TRT_Trabalhista', 'DJPE'),
  ('DJRS_Estadual', 'DJRS'),
  ('TRF 3_DJEN_FEDERAL', 'TRF3'),
  ('DJMS_TRT_Trabalhista', 'TRT24 - MS'),
  ('DJBA_TRT_Trabalhista', 'TRT5 - BA'),
  ('TJDF_Tribunal', 'TJDF'),
  ('DJGO_TRT_Trabalhista', 'TRT18 - GO'),
  ('DJRS_TRT', 'TRT4 - RS'),
  ('TJMT_DJEN_ESTADUAL', 'TJMT'),
  ('TJDFT_DJEN_DISTRITAL', 'TJDF'),
  ('STJ_STJ', 'STJ'),
  ('TST_TST', 'TST'),
  ('DJAM_Justiça', 'DJAM'),
  ('DJGO_Suplemento', 'DJGO'),
  ('TJPR_DJEN_ESTADUAL', 'TJPR'),
  ('DJSC_Judiciário', 'DJSC'),
  ('TJPA_DJEN_ESTADUAL', 'TJPA'),
  ('DJPE_PJE_INTIMACOES', 'DJPE'),
  ('DJAL_TRT_Trabalhista', 'TRT19 - AL'),
  ('DJBA_Judiciário', 'TJBA'),
  ('DJAL_Judiciário', 'TJAL'),
  ('DJCE_Judiciário', 'TJCE'),
  ('DJRN_TRT_Trabalhista', 'TRT21 - RN'),
  ('TJSP_DJEN_ESTADUAL', 'TJSP')
on conflict (from_text) do update set to_text = excluded.to_text;

insert into public.task_types (code, label_vios, kind, requires_hora, notes) values
  ('AUD_INSTRUCAO', 'AUD. INSTRUÇÃO', 'compromisso', true, null),
  ('AUD_CONCILIACAO', 'AUD. CONCILIAÇÃO', 'compromisso', true, null),
  ('AUD_UNA', 'AUDIÊNCIA UNA/INICIAL', 'compromisso', true, 'Gera cadeia prot/defesa'),
  ('AUD_JULGAMENTO', 'AUDIÊNCIA DE JULGAMENTO', 'compromisso', true, null),
  ('PERICIA', 'PERÍCIA', 'compromisso', true, null),
  ('IMPUGNACAO_LAUDO', 'IMPUGNAÇÃO AO LAUDO', 'prazo', false, null),
  ('COMPROVAR_PAGAMENTO', 'COMPROVAR PAGAMENTO', 'prazo', false, null),
  ('MANIFESTACAO_D1', 'MANIFESTAÇÃO - FLUXO D1', 'prazo', false, null),
  ('MANIFESTACAO_LAUDO', 'MANIFESTAÇÃO SOBRE LAUDO PERICIAL', 'prazo', false, null),
  ('APRESENTAR_IMPUGNAR_CALCULOS', 'APRESENTAR/IMPUGNAR CÁLCULOS', 'prazo', false, null),
  ('RAZOES_FINAIS', 'RAZÕES FINAIS', 'prazo', false, null),
  ('CONTESTACAO', 'CONTESTAÇÃO', 'skip', false, 'NÃO AGENDAR — nasce da UNA')
on conflict (code) do nothing;

insert into public.task_type_aliases (alias, task_type_id)
select v.alias, t.id
from (
  values
    ('Aud. de instrução', 'AUD_INSTRUCAO'),
    ('Audiência de instrução', 'AUD_INSTRUCAO'),
    ('Aud. de conciliação', 'AUD_CONCILIACAO'),
    ('Aud. UNA / inicial', 'AUD_UNA'),
    ('AUDIÊNCIA UNA/INICIAL', 'AUD_UNA'),
    ('Impugnação ao laudo', 'IMPUGNACAO_LAUDO'),
    ('Comprovar pagamento', 'COMPROVAR_PAGAMENTO'),
    ('Manifestação fluxo D1', 'MANIFESTACAO_D1'),
    ('Contestação', 'CONTESTACAO')
) as v(alias, code)
join public.task_types t on t.code = v.code
on conflict (alias) do nothing;

insert into public.task_flows (task_type_id, name)
select id, 'UNA padrão' from public.task_types where code = 'AUD_UNA'
on conflict do nothing;

insert into public.task_flow_steps (flow_id, step_order, step_code, label, offset_rule, notes)
select f.id, s.step_order, s.step_code, s.label, s.offset_rule, s.notes
from public.task_flows f
join public.task_types t on t.id = f.task_type_id and t.code = 'AUD_UNA'
cross join (
  values
    (1, 'ROOT', 'AUDIÊNCIA UNA/INICIAL', 'anchor_aud', 'Hora fim = início + 1h'),
    (2, 'PROTOCOLAR', '3. PROTOCOLAR (contestação)', 'una_prot_d2_or_fatal_m1', 'D-2 úteis; se = FATAL então FATAL-1 útil'),
    (3, 'ENVIAR_DEFESA', 'ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE', 'una_defesa_d4', 'D-4 úteis; conclusão=limite')
) as s(step_order, step_code, label, offset_rule, notes)
on conflict do nothing;

insert into public.task_flows (task_type_id, name)
select id, 'Prazo com FATAL' from public.task_types where code = 'IMPUGNACAO_LAUDO'
on conflict do nothing;

insert into public.task_flow_steps (flow_id, step_order, step_code, label, offset_rule, notes)
select f.id, s.step_order, s.step_code, s.label, s.offset_rule, s.notes
from public.task_flows f
join public.task_types t on t.id = f.task_type_id and t.code = 'IMPUGNACAO_LAUDO' and f.name = 'Prazo com FATAL'
cross join (
  values
    (1, 'ROOT', 'Tarefa principal', 'data_conclusao', 'conclusao = limite'),
    (2, 'REVISAR', '2. REVISAR', 'root_plus_1', null),
    (3, 'PROTOCOLAR', '3. PROTOCOLAR', 'fatal_minus_1_util', 'Alinhar ao FATAL-1 útil')
) as s(step_order, step_code, label, offset_rule, notes)
on conflict do nothing;
