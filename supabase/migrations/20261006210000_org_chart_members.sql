-- Organograma do escritório (RH > Organograma).
--
-- A estrutura (áreas executivas e equipes) fica no código
-- (src/lib/rh/org-chart.ts); aqui fica onde cada colaborador aparece.
-- Cada linha liga um colaborador de hr_employees a uma posição. Colaborador
-- ativo sem nenhuma linha = pendente de posicionar (vira aviso para a RH).
-- placement = 'hidden' marca quem foi deliberadamente deixado de fora.

create table if not exists public.org_chart_members (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null default '',
  placement text not null
    check (placement in ('partner', 'division_leader', 'team', 'committee', 'hidden')),
  division_key text,
  team_key text,
  group_label text,
  tier smallint not null default 0 check (tier >= 0),
  sort_order smallint not null default 0,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  check (placement <> 'division_leader' or division_key is not null),
  check (placement <> 'team' or (division_key is not null and team_key is not null)),
  check (placement <> 'committee' or team_key is not null)
);

create unique index if not exists org_chart_members_position_uidx
  on public.org_chart_members (employee_id, placement, coalesce(division_key, ''), coalesce(team_key, ''));

create index if not exists org_chart_members_employee_idx
  on public.org_chart_members (employee_id);

drop trigger if exists org_chart_members_set_updated_at on public.org_chart_members;
create trigger org_chart_members_set_updated_at
before update on public.org_chart_members
for each row execute function public.set_ferias_updated_at();

alter table public.org_chart_members enable row level security;

revoke all on public.org_chart_members from anon;
grant select on public.org_chart_members to authenticated;
grant select, insert, update, delete on public.org_chart_members to service_role;

drop policy if exists "hr reads org chart" on public.org_chart_members;
create policy "hr reads org chart"
on public.org_chart_members for select to authenticated
using ((select public.has_hr_access()));

-- Carga inicial: onboarding de setembro/2026 + sócios patrimoniais,
-- Tributário (Felipe Zanin) e Comercial (Rafael Denaro). Ignora quem não
-- existir em hr_employees (ambiente novo).
insert into public.org_chart_members
  (employee_id, display_name, role, placement, division_key, team_key, group_label, tier, sort_order, photo_url)
select v.employee_id::uuid, v.display_name, v.role, v.placement, v.division_key, v.team_key, v.group_label,
       v.tier::smallint, v.sort_order::smallint, v.photo_url
from (values
  ('3da9c5f0-cf80-4743-aea9-76ec5c80ddb2', 'Gustavo Bismarchi Motta', 'Sócio Patrimonial', 'partner', null, null, null, 0, 0, '/rh/organograma/gustavo-bismarchi-motta.webp'),
  ('1948ec31-133f-402d-9f66-27b6b5eea093', 'Ricardo Viscardi Pires', 'Sócio Patrimonial', 'partner', null, null, null, 0, 1, '/rh/organograma/ricardo-viscardi-pires.webp'),
  ('54910190-8806-47be-90b7-80e0a91ddae6', 'Felipe Camargo', 'Gerente', 'division_leader', 'operacoes-legais', null, null, 0, 0, '/rh/organograma/felipe-camargo.webp'),
  ('e110e76d-0c25-4c44-8e7c-76ea39da42a8', 'Samuel Willian', 'Coordenador', 'division_leader', 'operacoes-legais', null, null, 1, 0, '/rh/organograma/samuel-willian.webp'),
  ('c01657b5-624c-434f-9e85-cabd498f02a8', 'Maria Heloiza', 'Supervisora', 'team', 'operacoes-legais', 'controladoria', null, 0, 0, '/rh/organograma/maria-heloiza.webp'),
  ('683b053a-d76e-41df-885a-83d6a0243fac', 'Isadora Godoy', 'Advogada Pleno', 'team', 'operacoes-legais', 'controladoria', null, 1, 0, '/rh/organograma/isadora-godoy.webp'),
  ('53132369-5795-4886-9326-d0eb4133fe1e', 'Giovanna Souza', 'Advogada Júnior', 'team', 'operacoes-legais', 'controladoria', null, 2, 0, '/rh/organograma/giovanna-souza.webp'),
  ('b6ae3637-5fe7-4dfd-aa7f-4f1994f8a2b5', 'Natalia Borges Breve', 'Estagiária', 'team', 'operacoes-legais', 'controladoria', null, 3, 0, '/rh/organograma/natalia-borges-breve.webp'),
  ('ad7eb688-bd51-42cf-b8da-8cac26ba4231', 'Maria Julia Pereira', 'Estagiária', 'team', 'operacoes-legais', 'controladoria', null, 3, 1, '/rh/organograma/maria-julia-pereira.webp'),
  ('4c179bf9-722e-445c-a386-2d93eac5d134', 'Marina Silva Pinelli', 'Estagiária', 'team', 'operacoes-legais', 'controladoria', null, 3, 2, '/rh/organograma/marina-silva-pinelli.webp'),
  ('6dd2776f-c5ff-44f2-a8f6-8c89d515c8d7', 'Juliana Herculano', 'Coordenadora Financeiro', 'team', 'operacoes-legais', 'financeiro', null, 0, 0, '/rh/organograma/juliana-herculano.webp'),
  ('189b9647-b19c-4c30-9318-ea51cb09aa78', 'Isabela Araújo Lopes', 'Analista Financeiro Júnior', 'team', 'operacoes-legais', 'financeiro', null, 1, 0, '/rh/organograma/isabela-araujo-lopes.webp'),
  ('65930615-040b-4848-83fc-7399f1e1b27a', 'Graziane Mauch', 'Assistente Financeiro', 'team', 'operacoes-legais', 'financeiro', null, 2, 0, '/rh/organograma/graziane-mauch.webp'),
  ('464db4b9-1d2e-4bff-b1f4-d9647afe3063', 'Vinicius Schmockel', 'Analista de Processos Gerenciais', 'team', 'operacoes-legais', 'lexnext-lab', null, 0, 0, '/rh/organograma/vinicius-schmockel.webp'),
  ('f4a32952-ba7e-4390-a502-27ec9e488eec', 'Leonardo Marques', 'Analista de Desenvolvimento de Soluções', 'team', 'operacoes-legais', 'lexnext-lab', null, 0, 1, '/rh/organograma/leonardo-marques.webp'),
  ('f4a32952-ba7e-4390-a502-27ec9e488eec', 'Leonardo Marques', 'Analista de Desenvolvimento de Soluções', 'team', 'operacoes-legais', 'marketing', null, 0, 0, '/rh/organograma/leonardo-marques.webp'),
  ('23b23535-ef5a-4655-bb3f-dc02d84ff5b5', 'Valentina Iacovacci', 'Estagiária', 'team', 'operacoes-legais', 'marketing', null, 1, 0, '/rh/organograma/valentina-iacovacci.webp'),
  ('cc84cdda-68f0-4a85-a3da-38e5527a5205', 'Rafael Denaro', 'Consultor', 'team', 'operacoes-legais', 'comercial', null, 0, 0, null),
  ('23770994-2916-4deb-ada3-58df1ee5d57e', 'Catharina Silva', 'Analista Júnior de Pessoas e Cultura', 'team', 'operacoes-legais', 'pessoas-e-cultura', null, 0, 0, '/rh/organograma/catharina-silva.webp'),
  ('adb05317-35b7-40e2-b297-0dc443f7c775', 'Andressa Silva', 'Assistente de Pessoas e Cultura', 'team', 'operacoes-legais', 'pessoas-e-cultura', null, 1, 0, '/rh/organograma/andressa-silva.webp'),
  ('bc41cb0a-cbc4-4ffd-bacc-6aa18433ab6b', 'Letícia Maria dos Santos', 'Assistente Administrativo', 'team', 'operacoes-legais', 'facilities', null, 0, 0, '/rh/organograma/leticia-maria-dos-santos.webp'),
  ('213c2f22-e33b-4d09-b32c-e90c69b2bb83', 'Cristiana Pereira', 'Auxiliar de Limpeza', 'team', 'operacoes-legais', 'facilities', null, 1, 0, '/rh/organograma/cristiana-pereira.webp'),
  ('d488e6ec-879d-416b-99e5-561282277ae2', 'Daniel Pressatto', 'Sócio de Área', 'team', 'juridica', 'trabalhista', null, 0, 0, '/rh/organograma/daniel-pressatto.webp'),
  ('e9705ed9-98bd-4648-aa2e-6faaf9bbe5e7', 'Caroline Abdalla', 'Advogada Sênior Coordenadora I', 'team', 'juridica', 'trabalhista', null, 1, 0, '/rh/organograma/caroline-abdalla.webp'),
  ('00ba91d6-0664-48be-8b20-77a8a1380179', 'Pamela Klava', 'Advogada Pleno', 'team', 'juridica', 'trabalhista', null, 2, 0, '/rh/organograma/pamela-klava.webp'),
  ('2fb91766-7af8-4e0f-8809-7298ceec291c', 'Larissa de Oliveira', 'Advogada Pleno Controller', 'team', 'juridica', 'trabalhista', null, 2, 1, '/rh/organograma/larissa-de-oliveira.webp'),
  ('0d79b3a8-9be3-4c1a-b920-62cd56cc61dc', 'Fernanda Arnoni', 'Advogada Pleno', 'team', 'juridica', 'trabalhista', null, 2, 2, '/rh/organograma/fernanda-arnoni.webp'),
  ('380771c1-2af2-4b95-8ea7-00383b06dfd1', 'Lorena Lourenço', 'Advogada Júnior', 'team', 'juridica', 'trabalhista', null, 3, 0, '/rh/organograma/lorena-lourenco.webp'),
  ('8ca54604-44d2-43c8-abc0-bb99b878fd87', 'Letícia Zamarion', 'Advogada Júnior', 'team', 'juridica', 'trabalhista', null, 3, 1, '/rh/organograma/leticia-zamarion.webp'),
  ('c4e6f1ba-da67-4eb5-a6e7-31ea4a094b7a', 'Vanessa Sellani', 'Advogada Júnior', 'team', 'juridica', 'trabalhista', null, 3, 2, '/rh/organograma/vanessa-sellani.webp'),
  ('0ce7a2b9-7723-4870-9e7d-5110e594b015', 'Manoela Angotti', 'Estagiária', 'team', 'juridica', 'trabalhista', null, 4, 0, '/rh/organograma/manoela-angotti.webp'),
  ('bf022af2-4bf8-496c-9162-34377d7c0ae6', 'Giancarlo Zotini', 'Sócio de Área', 'team', 'juridica', 'civel', null, 0, 0, '/rh/organograma/giancarlo-zotini.webp'),
  ('ad8849ee-f4d6-453d-969b-74763214f50d', 'Maria Caroline Thomé', 'Advogada Sênior Coordenadora I', 'team', 'juridica', 'civel', null, 1, 0, '/rh/organograma/maria-caroline-thome.webp'),
  ('48b97ab8-1c8e-4199-8243-2a6700952832', 'Giovani P. de Freitas', 'Advogado Sênior Consultor I', 'team', 'juridica', 'civel', null, 2, 0, '/rh/organograma/giovani-de-freitas.webp'),
  ('9dcd9049-b8e6-4d10-a975-1a5d20314580', 'Midian Barbosa', 'Advogada Pleno', 'team', 'juridica', 'civel', null, 2, 1, '/rh/organograma/midian-barbosa.webp'),
  ('23eff27f-338d-4a87-8c66-43322234a684', 'Raíssa Alni Minari', 'Advogada Júnior', 'team', 'juridica', 'civel', null, 2, 2, '/rh/organograma/raissa-alni-minari.webp'),
  ('9b96cd9c-894b-4c7a-9eec-7c72e0ef6fc6', 'Leonardo Loureiro', 'Gerente', 'team', 'juridica', 'reestruturacao', null, 0, 0, '/rh/organograma/leonardo-loureiro.webp'),
  ('30a2e7e6-988c-4d0c-9ca8-e4e71733f21a', 'Lígia Lopes', 'Coordenadora Comercial', 'team', 'juridica', 'reestruturacao', null, 1, 0, '/rh/organograma/ligia-lopes.webp'),
  ('b5e3fa0c-9f60-4938-9269-759073caabdb', 'Ana Clara Borba', 'Coordenadora Jurídica', 'team', 'juridica', 'reestruturacao', null, 1, 1, '/rh/organograma/ana-clara-borba.webp'),
  ('d1c32ed4-259c-4981-91af-87eb8dd575c5', 'Lavínia Crispim', 'Especialista em Gestão Operacional', 'team', 'juridica', 'reestruturacao', null, 1, 2, '/rh/organograma/lavinia-crispim.webp'),
  ('37df2579-bb25-499c-a051-4a37058186ab', 'Gabriela Bossi', 'Advogada Pleno', 'team', 'juridica', 'reestruturacao', 'Insolvência', 2, 0, '/rh/organograma/gabriela-bossi.webp'),
  ('007918dc-3afe-4a70-a11d-b594f0f592e0', 'Pedro Rossi', 'Advogado Pleno', 'team', 'juridica', 'reestruturacao', 'Insolvência', 2, 1, '/rh/organograma/pedro-rossi.webp'),
  ('9b37f2a0-8282-49a1-aef4-2d4d42593aae', 'Lucas Sebinel', 'Advogado Pleno', 'team', 'juridica', 'reestruturacao', 'Insolvência', 2, 2, '/rh/organograma/lucas-sebinel.webp'),
  ('32502e0d-e7b7-4490-a094-cdf3d105c934', 'Daniela Lagoeiro', 'Advogada Júnior', 'team', 'juridica', 'reestruturacao', 'Insolvência', 3, 0, '/rh/organograma/daniela-lagoeiro.webp'),
  ('2d241f2a-30be-4056-a9a7-6249c33942de', 'Manuela Lutke', 'Advogada Júnior', 'team', 'juridica', 'reestruturacao', 'Insolvência', 3, 1, '/rh/organograma/manuela-lutke.webp'),
  ('63b37ec1-268f-42ae-bb47-68d81b8a1310', 'Fernanda Camolesi', 'Advogada Júnior', 'team', 'juridica', 'reestruturacao', 'Insolvência', 3, 2, '/rh/organograma/fernanda-camolesi.webp'),
  ('7465926b-7f4f-460e-9344-be3fb68f988d', 'Vinícius Hecksher', 'Estagiário', 'team', 'juridica', 'reestruturacao', 'Insolvência', 4, 0, '/rh/organograma/vinicius-hecksher.webp'),
  ('fa4d816b-a965-413c-8811-5dc00949e45c', 'Julia Morel', 'Estagiária', 'team', 'juridica', 'reestruturacao', 'Insolvência', 4, 1, '/rh/organograma/julia-morel.webp'),
  ('81e1277b-3b79-4b82-9ac6-06a99681feea', 'Laura Puente', 'Estagiária', 'team', 'juridica', 'reestruturacao', 'Insolvência', 4, 2, '/rh/organograma/laura-puente.webp'),
  ('2958fb8f-c6ce-45c1-a9f7-3eab06783630', 'Mariana Araújo', 'Advogada Pleno', 'team', 'juridica', 'reestruturacao', 'Cível Insolvência', 2, 0, '/rh/organograma/mariana-araujo.webp'),
  ('ce7ac5cb-5484-42df-86ca-cd84ee40c627', 'Gabriela Assumpção', 'Advogada Pleno', 'team', 'juridica', 'reestruturacao', 'Cível Insolvência', 2, 1, '/rh/organograma/gabriela-assumpcao.webp'),
  ('a25f9dd0-dda2-428f-a447-99c7dadd7f58', 'Thayná Cabalin', 'Advogada Pleno', 'team', 'juridica', 'reestruturacao', 'Cível Insolvência', 2, 2, '/rh/organograma/thayna-cabalin.webp'),
  ('a860b484-a0c9-4552-b980-a6eb61f01cce', 'Renato Rossetti Vallim de Castro', 'Sócio de Área', 'team', 'juridica', 'recuperacao-de-credito', null, 0, 0, '/rh/organograma/renato-rossetti.webp'),
  ('3c7bc2eb-5744-4a02-98c3-7d1705c4fc7c', 'Lucca Martinelli dos Santos Mattos', 'Advogado Pleno', 'team', 'juridica', 'recuperacao-de-credito', null, 1, 0, '/rh/organograma/lucca-martinelli.webp'),
  ('86b68aa0-b0e3-4a8a-9222-bd3abfd03fec', 'Nicole Donadão Costa Camargo', 'Advogada Júnior', 'team', 'juridica', 'recuperacao-de-credito', null, 2, 0, '/rh/organograma/nicole-donadao.webp'),
  ('771c9aa7-4110-44df-b2d2-3771b8a32dc2', 'Ana Nunes Galvão', 'Advogada Júnior', 'team', 'juridica', 'recuperacao-de-credito', null, 2, 1, '/rh/organograma/ana-nunes-galvao.webp'),
  ('f3271095-a672-4148-8d2d-c31d4e1fb6c4', 'Wagner Armani', 'Sócio de Área', 'team', 'juridica', 'societario-e-contratos', null, 0, 0, '/rh/organograma/wagner-armani.webp'),
  ('dbba50d3-ef85-445e-82f8-b1a50a3c7ebc', 'Henrique Franco', 'Coordenador', 'team', 'juridica', 'societario-e-contratos', null, 1, 0, '/rh/organograma/henrique-franco.webp'),
  ('2f6783d9-42df-488b-947a-13273da0d0f7', 'Letícia Rodrigues', 'Advogada Júnior', 'team', 'juridica', 'societario-e-contratos', null, 2, 0, '/rh/organograma/leticia-rodrigues.webp'),
  ('a4056dca-85c7-41c7-b558-9ed9c0a77c30', 'Caio Augusto', 'Assistente Jurídico', 'team', 'juridica', 'societario-e-contratos', null, 3, 0, '/rh/organograma/caio-augusto.webp'),
  ('8ad23cbd-9b5c-4c5b-8b4b-2f013347b8c4', 'Felipe Zanin', 'Sócio de Área', 'team', 'juridica', 'tributario', null, 0, 0, '/rh/organograma/felipe-zanin.webp'),
  ('ad8849ee-f4d6-453d-969b-74763214f50d', 'Maria Caroline Thomé', 'Advogada Sênior Coordenadora I', 'committee', null, 'clima', null, 0, 0, '/rh/organograma/maria-caroline-thome.webp'),
  ('9dcd9049-b8e6-4d10-a975-1a5d20314580', 'Midian Barbosa', 'Advogada Pleno', 'committee', null, 'clima', null, 0, 1, '/rh/organograma/midian-barbosa.webp'),
  ('f4a32952-ba7e-4390-a502-27ec9e488eec', 'Leonardo Marques', 'Analista de Desenvolvimento de Soluções', 'committee', null, 'clima', null, 0, 2, '/rh/organograma/leonardo-marques.webp'),
  ('2f6783d9-42df-488b-947a-13273da0d0f7', 'Letícia Rodrigues', 'Advogada Júnior', 'committee', null, 'clima', null, 0, 3, '/rh/organograma/leticia-rodrigues.webp'),
  ('bbf67cb5-be21-4856-a189-3cb297272ed1', 'Fênix Agendador', 'Robô de agendamento', 'hidden', null, null, null, 0, 0, null)
) as v (employee_id, display_name, role, placement, division_key, team_key, group_label, tier, sort_order, photo_url)
join public.hr_employees e on e.id = v.employee_id::uuid
on conflict do nothing;
