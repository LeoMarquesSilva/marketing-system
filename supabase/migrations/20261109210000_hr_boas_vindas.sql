-- Boas-vindas de colaborador novo (Pessoas e Cultura › Dados cadastrais › Boas-vindas).
--
-- 1. hr_welcome_links: links que o colaborador encontra em Meus links, mantidos
--    pelo RH na tela (sem código). Público = todos, uma divisão ou uma equipe do
--    organograma. O e-mail de boas-vindas não lista links: só leva ao acesso.
-- 2. hr_onboarding_completions: o marco "onboarding concluído" (quem concluiu e
--    quando) e o envio do e-mail de boas-vindas.
-- 3. account_setup_tokens: link de primeiro acesso ao ORQESTRAI (7 dias, uso
--    único), para a pessoa criar a própria senha sem senha padrão.
--
-- Tudo passa pelo servidor com a service role; o navegador não lê nem grava
-- estas tabelas direto.

-- 1. Links ----------------------------------------------------------------------

create table if not exists public.hr_welcome_links (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  url text not null check (url ~* '^https?://'),
  description text,
  -- Informação extra para quem vê o link em Meus links. Ex.: senha padrão.
  internal_note text,
  -- 'todos', chave de divisão (ex.: 'juridica') ou de equipe (ex.: 'civel') do organograma.
  audience text not null default 'todos',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

create index if not exists hr_welcome_links_audience_idx
  on public.hr_welcome_links (audience, sort_order);

-- 2. Onboarding concluído -------------------------------------------------------

create table if not exists public.hr_onboarding_completions (
  employee_id uuid primary key references public.hr_employees(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.users(id) on delete set null,
  -- Equipe (ou divisão) escolhida pelo RH; vale até a pessoa entrar no organograma.
  audience_key text,
  email_to text,
  email_sent_at timestamptz,
  email_send_count integer not null default 0,
  last_sent_by uuid references public.users(id) on delete set null,
  last_error text,
  updated_at timestamptz not null default now()
);

-- 3. Primeiro acesso ------------------------------------------------------------

create table if not exists public.account_setup_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- SHA-256 do token; o token em si só existe no link do e-mail.
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create index if not exists account_setup_tokens_user_idx
  on public.account_setup_tokens (user_id);

-- Acesso: só a service role -----------------------------------------------------

alter table public.hr_welcome_links enable row level security;
alter table public.hr_onboarding_completions enable row level security;
alter table public.account_setup_tokens enable row level security;

revoke all on public.hr_welcome_links from anon, authenticated;
revoke all on public.hr_onboarding_completions from anon, authenticated;
revoke all on public.account_setup_tokens from anon, authenticated;

grant select, insert, update, delete on public.hr_welcome_links to service_role;
grant select, insert, update, delete on public.hr_onboarding_completions to service_role;
grant select, insert, update, delete on public.account_setup_tokens to service_role;

-- Carga inicial: links do ticket da Isadora (Responsum, set/2026) --------------
-- O ORQESTRAI não entra na lista: a pessoa vê os links já dentro dele.
-- As explicações são o ponto de partida; o RH ajusta na tela.

insert into public.hr_welcome_links (title, url, description, internal_note, audience, sort_order)
select * from (values
  ('VIOS', 'https://bp.vios.com.br/?pag=sys/agenda/calendario.php&menu_lateral=true',
    'Sistema jurídico do escritório: agenda, prazos e processos.', null, 'todos', 10),
  ('Responsum', 'https://www.responsum.com.br/tickets',
    'Central de chamados para pedir apoio às áreas internas do escritório.',
    'Senha padrão do primeiro acesso: 123456789. Troque depois de entrar.', 'todos', 20),
  ('Feedz', 'https://app.feedz.com.br/perfil',
    'Plataforma de Pessoas e Cultura: feedbacks, reconhecimentos e pesquisas.', null, 'todos', 30),
  ('Intranet', 'https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES',
    'Portal do escritório no SharePoint, com comunicados, documentos e listas.', null, 'todos', 40),
  ('Senhas dos tribunais', 'https://bpplaw2.sharepoint.com/:x:/s/Controladoria/IQCHoDWuskLpQ7CgsgIT_N1eAXMBNk0whq7RL0MUj5VhNKI?e=e6skEV',
    'Planilha da Controladoria com os acessos aos sistemas dos tribunais.', null, 'todos', 50),
  ('Tarefas automáticas VIOS', 'https://bpplaw2-my.sharepoint.com/:x:/g/personal/controladoria_bpplaw_com_br/IQAkiBshvBRmSYsyPhSko6u5AeZsdbMr3j6dHO9VJ5sltgw?e=iO3lQH',
    'Planilha das movimentações processuais que geram tarefas automáticas no VIOS.', null, 'juridica', 10),
  ('Fluxo de responsáveis da Reestruturação', 'https://bpplaw2.sharepoint.com/:x:/s/Reestruturao/IQAc2BKZOWuKTaNnAIvHOTniAV9KwKpIjuaFtbFVfB3_oB8?e=E6ccwt',
    'Quem responde por cada cliente e pasta da Reestruturação.', null, 'reestruturacao', 10),
  ('Fluxo de responsáveis do Cível', 'https://bpplaw2.sharepoint.com/:x:/s/EquipeCivel/IQC0oQcBA6r0QLQgDAbPZeC4AfE9U2Pg9eigAWLIfcmq_k0?e=Wt0O2M',
    'Controle de clientes do Cível: responsável de cada pasta e fluxo de agendamento.', null, 'civel', 10),
  ('Pauta trabalhista', 'https://bpplaw2.sharepoint.com/:x:/s/GestoTrabalhista/IQB0yxdykX4iQ7DoGxy8MXNKAZvFEjjOr4WhqGCFTCsV2Uc?e=zQzdqx',
    'Planilha da pauta da equipe Trabalhista.', null, 'trabalhista', 10),
  ('Clientes inativos', 'https://bpplaw2.sharepoint.com/:x:/s/Controladoria/IQAop8MkB2OuQ5scDXzuCDKLAf29ZKlnJxD9H-5MAjmX-EI?e=2uMRdG',
    'Lista dos clientes inativos do escritório.', null, 'operacoes-legais', 10),
  ('Presentes de Operações Legais', 'https://bpplaw2.sharepoint.com/:x:/s/Controladoria/IQDEQORYsFAISaCCLVI6O_D7AQdYjv2nZLySEs6pMirnCQ8?e=GFmgzg',
    'Planilha de aniversários e presentes de Operações Legais.', null, 'operacoes-legais', 20),
  ('Kanban de tarefas de Operações Legais', 'https://planner.cloud.microsoft/webui/plan/-JYc8mM5w0m2k8mj9LCHmmUACBmf/view/board?tid=5411b7aa-53ee-4f05-bb25-dfca7a522fc2',
    'Quadro do Planner com as tarefas da equipe.', null, 'controladoria', 10),
  ('Central de publicações', 'https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES/Lists/VISTAGEM%20DE%20PUBLICAES/DUPLICIDADES%20%20TRABALHISTAS.aspx?viewid=06798e04%2D1753%2D425e%2D9af8%2Db88c5b90100d',
    'Lista do SharePoint com a vistagem de publicações.', null, 'controladoria', 20),
  ('Central de agendamentos e pastas', 'https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/SOLICITAO%20DE%20AGENDAMENTOS%20E%20REAGENDAMENTOS/CONTROLADORIA%20%20PENDENTES%20NOVO.aspx',
    'Lista do SharePoint com os pedidos de agendamento e reagendamento.', null, 'controladoria', 30),
  ('Central de protocolos', 'https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/CONTROLE%20DE%20PROTOCOLOS/PAINELPROTOCOLO.aspx?viewid=f62ded86%2D86e2%2D4d12%2D9196%2Dada5558d3458',
    'Painel do SharePoint com o controle de protocolos.', null, 'controladoria', 40),
  ('Legis', 'https://quoti.cloud/bismarchipires/app/solicitacoeslist',
    'Lista de solicitações no Legis.', null, 'controladoria', 50)
) as seed(title, url, description, internal_note, audience, sort_order)
where not exists (select 1 from public.hr_welcome_links);
