-- Pesquisas com a equipe (Operações Legais > Pesquisas com a equipe).
--
-- Primeiro uso: os embaixadores de Operações Legais ouvem o time antes do
-- Workshop de Planejamento Estratégico 2027 (PE27). As perguntas são escritas
-- na tela (sem código): ficam em `questions` (jsonb, com ids estáveis para as
-- respostas não se perderem quando o texto muda).
--
-- Responder exige login (só quem está no público responde, uma vez). Por
-- padrão a resposta é identificada. Em pesquisa anônima, quem respondeu fica em team_survey_participants (para saber
-- quem falta) e a resposta fica em team_survey_responses sem nome e só com o
-- dia, para não dar para cruzar uma com a outra. Em pesquisa identificada a
-- resposta guarda o usuário.
--
-- Tudo é lido e gravado só pelo servidor (service role).

create table if not exists public.team_surveys (
  id uuid primary key default gen_random_uuid(),
  -- Link de resposta: /pesquisa/<slug>.
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 80),
  title text not null check (length(trim(title)) > 0 and length(title) <= 160),
  intro text not null default '' check (length(intro) <= 4000),
  -- Identidade do cabeçalho da página de resposta (null = ORQESTRAI).
  brand text check (brand is null or brand in ('pe27')),
  -- Departamentos do RH (hr_employees.department) que respondem; vazio = todos os colaboradores ativos.
  audience_departments text[] not null default '{}',
  -- Identificada por padrão (decisão dos embaixadores do PE27); anônima é opção da tela.
  anonymous boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho', 'aberta', 'encerrada')),
  closes_at timestamptz,
  opened_at timestamptz,
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  -- Síntese da IA para o workshop (temas, citações, pontos de atenção).
  ai_summary jsonb,
  ai_summary_at timestamptz,
  ai_summary_responses integer,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_survey_participants (
  survey_id uuid not null references public.team_surveys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  employee_id uuid references public.hr_employees(id) on delete set null,
  submitted_at timestamptz not null default now(),
  primary key (survey_id, user_id)
);

create table if not exists public.team_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.team_surveys(id) on delete cascade,
  -- Só em pesquisa identificada.
  respondent_user_id uuid references public.users(id) on delete set null,
  respondent_employee_id uuid references public.hr_employees(id) on delete set null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  -- Em pesquisa anônima, só o dia (meia-noite de Brasília).
  submitted_at timestamptz not null default now()
);

create index if not exists team_survey_responses_survey_idx on public.team_survey_responses (survey_id);

drop trigger if exists team_surveys_set_updated_at on public.team_surveys;
create trigger team_surveys_set_updated_at
before update on public.team_surveys
for each row execute function public.set_ferias_updated_at();

/**
 * Registra a participação e a resposta na mesma transação: a chave de
 * team_survey_participants impede responder duas vezes.
 */
create or replace function public.submit_team_survey_response(
  p_survey_id uuid,
  p_user_id uuid,
  p_employee_id uuid,
  p_answers jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_anonymous boolean;
  v_status text;
  v_closes_at timestamptz;
begin
  select anonymous, status, closes_at into v_anonymous, v_status, v_closes_at
  from public.team_surveys where id = p_survey_id for share;
  if not found then
    raise exception 'survey_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'aberta' or (v_closes_at is not null and v_closes_at <= now()) then
    raise exception 'survey_closed' using errcode = 'P0001';
  end if;

  insert into public.team_survey_participants (survey_id, user_id, employee_id)
  values (p_survey_id, p_user_id, p_employee_id);

  insert into public.team_survey_responses (survey_id, respondent_user_id, respondent_employee_id, answers, submitted_at)
  values (
    p_survey_id,
    case when v_anonymous then null else p_user_id end,
    case when v_anonymous then null else p_employee_id end,
    p_answers,
    case
      when v_anonymous then (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
      else now()
    end
  );
end;
$$;

alter table public.team_surveys enable row level security;
alter table public.team_survey_participants enable row level security;
alter table public.team_survey_responses enable row level security;

revoke all on public.team_surveys from anon, authenticated;
revoke all on public.team_survey_participants from anon, authenticated;
revoke all on public.team_survey_responses from anon, authenticated;
revoke all on function public.submit_team_survey_response(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

grant select, insert, update, delete on public.team_surveys to service_role;
grant select, insert, update, delete on public.team_survey_participants to service_role;
grant select, insert, update, delete on public.team_survey_responses to service_role;
grant execute on function public.submit_team_survey_response(uuid, uuid, uuid, jsonb) to service_role;
