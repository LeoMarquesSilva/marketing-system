-- Carga inicial do Planner de Operações Legais (idempotente).
--
-- Espaços: as equipes de Operações Legais de src/lib/rh/org-chart.ts.
-- Membros: quem está posicionado nessas equipes no organograma (org_chart_members),
-- ligado ao login por hr_employees.user_id. Tier 0 da equipe vira líder; os líderes
-- da divisão (Gerente e Coordenador) viram gestores de todos os espaços.
-- Quem não tem login fica de fora; depois os líderes ajustam pela tela do espaço.

insert into public.ops_spaces (slug, name, description, color, sort_order)
values
  ('controladoria', 'Controladoria Jurídica',
   'Agenda e revisa prazos, protocola peças e opera as centrais de solicitações.', '#3e84a8', 0),
  ('financeiro', 'Financeiro',
   'Contas a pagar e a receber, faturamento de honorários e cobrança.', '#347796', 1),
  ('lexnext-lab', 'LexNext Lab',
   'Processos, dados e tecnologia aplicados à operação, como Responsum e SIOE.', '#48466e', 2),
  ('marketing', 'Marketing',
   'Comunicação, identidade visual, conteúdo, site e eventos institucionais.', '#2f9c9f', 3),
  ('comercial', 'Comercial',
   'Relacionamento com clientes e desenvolvimento de novos negócios.', '#285f7a', 4),
  ('pessoas-e-cultura', 'Pessoas e Cultura',
   'Admissão, remuneração, benefícios, clima e cultura organizacional.', '#6b6990', 5),
  ('facilities', 'Adm e Facilities',
   'Infraestrutura, materiais, equipamentos, salas de reunião e reembolsos.', '#4f8fa8', 6)
on conflict (slug) do nothing;

insert into public.ops_space_members (space_id, user_id, role)
select distinct on (s.id, e.user_id)
  s.id,
  e.user_id,
  case when m.tier = 0 then 'lider' else 'membro' end
from public.org_chart_members m
join public.hr_employees e on e.id = m.employee_id
join public.ops_spaces s on s.slug = m.team_key
where m.placement = 'team'
  and m.division_key = 'operacoes-legais'
  and e.user_id is not null
order by s.id, e.user_id, m.tier
on conflict (space_id, user_id) do nothing;

insert into public.ops_space_members (space_id, user_id, role)
select distinct s.id, e.user_id, 'gestor'
from public.org_chart_members m
join public.hr_employees e on e.id = m.employee_id
cross join public.ops_spaces s
where m.placement = 'division_leader'
  and m.division_key = 'operacoes-legais'
  and e.user_id is not null
on conflict (space_id, user_id) do update set role = 'gestor';

-- Pessoas e Cultura começa com os Temas da planilha do ritual; os demais com "Geral".
insert into public.ops_lists (space_id, name, sort_order)
select s.id, v.name, v.sort_order
from public.ops_spaces s
join (values
  ('pessoas-e-cultura', 'Recrutamento e seleção', 0),
  ('pessoas-e-cultura', 'Departamento Pessoal', 1),
  ('pessoas-e-cultura', 'Benefícios', 2),
  ('pessoas-e-cultura', 'Treinamento e desenvolvimento', 3),
  ('pessoas-e-cultura', 'Clima e engajamento', 4),
  ('pessoas-e-cultura', 'Remuneração', 5),
  ('pessoas-e-cultura', 'Saúde e segurança', 6),
  ('pessoas-e-cultura', 'Outros', 7)
) as v(slug, name, sort_order) on v.slug = s.slug
where not exists (select 1 from public.ops_lists l where l.space_id = s.id);

insert into public.ops_lists (space_id, name, sort_order)
select s.id, 'Geral', 0
from public.ops_spaces s
where not exists (select 1 from public.ops_lists l where l.space_id = s.id);
