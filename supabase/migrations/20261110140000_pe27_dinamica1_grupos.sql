-- PE27: integrantes dos grupos da Dinâmica 1, conforme a folha "Dinâmica 1 |
-- Missão, Visão, Propósito e Valores" (Camila Gracioli, 03/11/2026). Grupos
-- diferentes dos da Dinâmica 2; sócios de área em negrito na folha; nenhum
-- sócio de área fica no grupo de pessoas do próprio time; Gustavo, Ricardo,
-- Camila e Zamboni ficaram fora. "Insolvência" aparece como Reestruturação.

update public.strategic_plan_groups set name = 'Grupo 1 · Missão' where id = md5('pe27:d1:grupo:missao')::uuid;
update public.strategic_plan_groups set name = 'Grupo 2 · Visão' where id = md5('pe27:d1:grupo:visao')::uuid;
update public.strategic_plan_groups set name = 'Grupo 3 · Propósito' where id = md5('pe27:d1:grupo:proposito')::uuid;
update public.strategic_plan_groups set name = 'Grupo 4 · Valores' where id = md5('pe27:d1:grupo:valores')::uuid;

insert into public.strategic_plan_group_members (id, group_id, employee_id, name, area, is_area_partner, sort)
select md5('pe27:d1:membro:' || m.grupo || ':' || m.sort)::uuid,
       md5('pe27:d1:grupo:' || m.grupo)::uuid,
       e.id,
       m.nome, m.area, m.socio, m.sort
from (values
  ('missao', 1, 'Daniel Pressatto', 'Trabalhista', true, 'd488e6ec-879d-416b-99e5-561282277ae2'),
  ('missao', 2, 'Giancarlo Zotini', 'Cível', true, 'bf022af2-4bf8-496c-9162-34377d7c0ae6'),
  ('missao', 3, 'Catharina Silva', 'Pessoas e Cultura', false, '23770994-2916-4deb-ada3-58df1ee5d57e'),
  ('missao', 4, 'Lígia Lopes', 'Reestruturação', false, '30a2e7e6-988c-4d0c-9ca8-e4e71733f21a'),
  ('missao', 5, 'Lucca Martinelli', 'Recuperação de Crédito', false, '3c7bc2eb-5744-4a02-98c3-7d1705c4fc7c'),
  ('missao', 6, 'Samuel Willian', 'Operações Legais', false, 'e110e76d-0c25-4c44-8e7c-76ea39da42a8'),
  ('visao', 1, 'Wagner Armani', 'Societário e Contratos', true, 'f3271095-a672-4148-8d2d-c31d4e1fb6c4'),
  ('visao', 2, 'Ana Clara Borba', 'Reestruturação', false, 'b5e3fa0c-9f60-4938-9269-759073caabdb'),
  ('visao', 3, 'Caroline Abdalla', 'Trabalhista', false, 'e9705ed9-98bd-4648-aa2e-6faaf9bbe5e7'),
  ('visao', 4, 'Maria Heloiza', 'Controladoria Jurídica', false, 'c01657b5-624c-434f-9e85-cabd498f02a8'),
  ('visao', 5, 'Mariana Araújo', 'Reestruturação | Cível', false, '2958fb8f-c6ce-45c1-a9f7-3eab06783630'),
  ('proposito', 1, 'Felipe Camargo', 'Operações Legais', true, '54910190-8806-47be-90b7-80e0a91ddae6'),
  ('proposito', 2, 'Fernanda Voltarelli', 'Trabalhista', false, '0d79b3a8-9be3-4c1a-b920-62cd56cc61dc'),
  ('proposito', 3, 'Henrique Franco', 'Societário e Contratos', false, 'dbba50d3-ef85-445e-82f8-b1a50a3c7ebc'),
  ('proposito', 4, 'Lavínia Crispim', 'Reestruturação', false, 'd1c32ed4-259c-4981-91af-87eb8dd575c5'),
  ('proposito', 5, 'Lucas Sebinel', 'Reestruturação', false, '9b37f2a0-8282-49a1-aef4-2d4d42593aae'),
  ('proposito', 6, 'Maria Caroline Thomé', 'Cível', false, 'ad8849ee-f4d6-453d-969b-74763214f50d'),
  ('valores', 1, 'Leonardo Loureiro', 'Reestruturação', true, '9b96cd9c-894b-4c7a-9eec-7c72e0ef6fc6'),
  ('valores', 2, 'Renato Rossetti', 'Recuperação de Crédito', true, 'a860b484-a0c9-4552-b980-a6eb61f01cce'),
  ('valores', 3, 'Giovani de Freitas', 'Cível', false, '48b97ab8-1c8e-4199-8243-2a6700952832'),
  ('valores', 4, 'Juliana Herculano', 'Financeiro', false, '6dd2776f-c5ff-44f2-a8f6-8c89d515c8d7'),
  ('valores', 5, 'Leonardo Marques', 'Marketing e LexNext Lab', false, 'f4a32952-ba7e-4390-a502-27ec9e488eec'),
  ('valores', 6, 'Rafael Denaro', 'Comercial', false, 'cc84cdda-68f0-4a85-a3da-38e5527a5205')
) as m(grupo, sort, nome, area, socio, employee)
left join public.hr_employees e on e.id = m.employee::uuid
on conflict (id) do nothing;
