-- PE27: insumos da Dinâmica 2 do workshop de 05/11/2026 (Clientes, Pessoas e
-- Acionistas), transcritos das fotos dos cartazes. Grupos conforme a folha
-- "Dinâmica 2 | Clientes, Pessoas e Acionistas" (Camila Gracioli, 03/11/2026):
-- sócios de área em negrito na folha (2 por grupo); Gustavo, Ricardo, Camila e
-- Zamboni ficaram fora dos grupos.
--
-- Ids determinísticos (md5 da chave) para a migration poder rodar de novo sem
-- duplicar. A transcrição mantém a palavra escrita; o que ficou em dúvida vai
-- em transcription_note para conferir no cartaz.

-- Grupos -------------------------------------------------------------------
insert into public.strategic_plan_groups (id, cycle, dynamic, dimension, name, poster_title, poster_path, sort)
values
  (md5('pe27:grupo:clientes')::uuid, 'PE27', 2, 'clientes', 'Grupo Clientes', 'Meta #01 – Cliente · alavanca x metas est.', 'workshop-05nov/dinamica2-clientes.jpg', 1),
  (md5('pe27:grupo:pessoas')::uuid, 'PE27', 2, 'pessoas', 'Grupo Pessoas', null, 'workshop-05nov/dinamica2-pessoas.jpg', 2),
  (md5('pe27:grupo:acionistas')::uuid, 'PE27', 2, 'acionistas', 'Grupo Acionistas', null, 'workshop-05nov/dinamica2-acionistas.jpg', 3)
on conflict (id) do nothing;

-- Participantes (employee_id pelo cadastro do RH) ---------------------------
insert into public.strategic_plan_group_members (id, group_id, employee_id, name, area, is_area_partner, sort)
select md5('pe27:membro:' || m.grupo || ':' || m.sort)::uuid,
       md5('pe27:grupo:' || m.grupo)::uuid,
       e.id,
       m.nome, m.area, m.socio, m.sort
from (values
  ('clientes', 1, 'Daniel Pressatto', 'Trabalhista', true, 'd488e6ec-879d-416b-99e5-561282277ae2'),
  ('clientes', 2, 'Wagner Armani', 'Societário e Contratos', true, 'f3271095-a672-4148-8d2d-c31d4e1fb6c4'),
  ('clientes', 3, 'Giovani de Freitas', 'Cível', false, '48b97ab8-1c8e-4199-8243-2a6700952832'),
  ('clientes', 4, 'Lígia Lopes', 'Reestruturação', false, '30a2e7e6-988c-4d0c-9ca8-e4e71733f21a'),
  ('clientes', 5, 'Lavínia Crispim', 'Reestruturação', false, 'd1c32ed4-259c-4981-91af-87eb8dd575c5'),
  ('clientes', 6, 'Lucca Martinelli', 'Recuperação de Crédito', false, '3c7bc2eb-5744-4a02-98c3-7d1705c4fc7c'),
  ('clientes', 7, 'Catharina Silva', 'Pessoas e Cultura', false, '23770994-2916-4deb-ada3-58df1ee5d57e'),
  ('clientes', 8, 'Rafael Denaro', 'Comercial', false, 'cc84cdda-68f0-4a85-a3da-38e5527a5205'),
  ('pessoas', 1, 'Felipe Camargo', 'Operações Legais', true, '54910190-8806-47be-90b7-80e0a91ddae6'),
  ('pessoas', 2, 'Renato Rossetti', 'Recuperação de Crédito', true, 'a860b484-a0c9-4552-b980-a6eb61f01cce'),
  ('pessoas', 3, 'Ana Clara Borba', 'Reestruturação', false, 'b5e3fa0c-9f60-4938-9269-759073caabdb'),
  ('pessoas', 4, 'Henrique Franco', 'Societário e Contratos', false, 'dbba50d3-ef85-445e-82f8-b1a50a3c7ebc'),
  ('pessoas', 5, 'Maria Caroline Thomé', 'Cível', false, 'ad8849ee-f4d6-453d-969b-74763214f50d'),
  ('pessoas', 6, 'Lucas Sebinel', 'Reestruturação', false, '9b37f2a0-8282-49a1-aef4-2d4d42593aae'),
  ('pessoas', 7, 'Leonardo Marques', 'Marketing e LexNext Lab', false, 'f4a32952-ba7e-4390-a502-27ec9e488eec'),
  ('pessoas', 8, 'Mariana Araújo', 'Reestruturação | Cível', false, '2958fb8f-c6ce-45c1-a9f7-3eab06783630'),
  ('acionistas', 1, 'Giancarlo Zotini', 'Cível', true, 'bf022af2-4bf8-496c-9162-34377d7c0ae6'),
  ('acionistas', 2, 'Leonardo Loureiro', 'Reestruturação', true, '9b96cd9c-894b-4c7a-9eec-7c72e0ef6fc6'),
  ('acionistas', 3, 'Caroline Abdalla', 'Trabalhista', false, 'e9705ed9-98bd-4648-aa2e-6faaf9bbe5e7'),
  ('acionistas', 4, 'Juliana Herculano', 'Financeiro', false, '6dd2776f-c5ff-44f2-a8f6-8c89d515c8d7'),
  ('acionistas', 5, 'Fernanda Voltarelli', 'Trabalhista', false, '0d79b3a8-9be3-4c1a-b920-62cd56cc61dc'),
  ('acionistas', 6, 'Maria Heloiza', 'Controladoria Jurídica', false, 'c01657b5-624c-434f-9e85-cabd498f02a8'),
  ('acionistas', 7, 'Samuel Willian', 'Operações Legais', false, 'e110e76d-0c25-4c44-8e7c-76ea39da42a8')
) as m(grupo, sort, nome, area, socio, employee)
left join public.hr_employees e on e.id = m.employee::uuid
on conflict (id) do nothing;

-- Alavancas ------------------------------------------------------------------
insert into public.strategic_plan_levers (id, cycle, dimension, group_id, position, title, original_title, transcription_note)
select md5('pe27:alavanca:' || a.grupo || ':' || a.pos)::uuid,
       'PE27', a.grupo, md5('pe27:grupo:' || a.grupo)::uuid, a.pos, a.titulo, a.titulo, a.nota
from (values
  ('clientes', 1, 'Atendimento personalizado',
    'No cartaz, as três metas estão numa linha só: "NPS e índice de manutenção/agenda positiva (meta de execução)".'),
  ('clientes', 2, 'Resultado', '"Resumo" riscado antes de "resultado".'),
  ('clientes', 3, 'Impulsionamento da marca', null),
  ('clientes', 4, 'Aproximação de parceiros', null),
  ('clientes', 5, 'Reputação dos profissionais',
    'Um traço liga este item também a "índice de conversão + política comercial (comissão)", da alavanca 4.'),
  ('pessoas', 1, 'Atrair e reter', null),
  ('pessoas', 2, 'Diversidade e inclusão (%)', null),
  ('pessoas', 3, 'Desenvolvimento', '"Liderança" riscado antes de "Desenvolvimento".'),
  ('pessoas', 4, 'Clima organizacional', null),
  ('acionistas', 1, 'Crescimento financeiro', null),
  ('acionistas', 2, 'Tecnologia e inovação', null),
  ('acionistas', 3, 'Reputação', null),
  ('acionistas', 4, 'Organograma', null)
) as a(grupo, pos, titulo, nota)
on conflict (id) do nothing;

-- Metas sugeridas ------------------------------------------------------------
insert into public.strategic_plan_goals (id, lever_id, position, text, original_text, transcription_note)
select md5('pe27:meta:' || g.grupo || ':' || g.alavanca || ':' || g.pos)::uuid,
       md5('pe27:alavanca:' || g.grupo || ':' || g.alavanca)::uuid,
       g.pos, g.texto, g.texto, g.nota
from (values
  ('clientes', 1, 1, 'NPS', null),
  ('clientes', 1, 2, 'Índice de manutenção', null),
  ('clientes', 1, 3, 'Agenda positiva (meta de execução)', null),
  ('clientes', 2, 1, 'Êxito', null),
  ('clientes', 3, 1, 'Reconhecimento em mídia/evento', '"Agend…" riscado antes de "reconhecimento".'),
  ('clientes', 4, 1, 'Índice de conversão + política comercial (comissão)', null),
  ('clientes', 4, 2, 'Metas de agenda positiva com parceiros', 'Anotação menor, acima do índice de conversão, ligada por um traço.'),
  ('clientes', 5, 1, 'Contratação, confiança', 'Leitura incerta da letra; conferir no cartaz.'),
  ('pessoas', 1, 1, 'Reputação (%)', '"Cultura e" riscado: era "Cultura e reputação".'),
  ('pessoas', 1, 2, 'Turnover', null),
  ('pessoas', 1, 3, 'Benefícios', 'Sai de uma seta ao lado de "Turnover".'),
  ('pessoas', 1, 4, 'Selo', null),
  ('pessoas', 2, 1, '% Liderança feminina', null),
  ('pessoas', 2, 2, 'Representação minorias', null),
  ('pessoas', 2, 3, 'Ação social', null),
  ('pessoas', 3, 1, 'Plano de carreira', null),
  ('pessoas', 3, 2, '% Engajamento', null),
  ('pessoas', 4, 1, 'Monitoramento de horas trabalhadas', 'Marcado com asterisco; "(NPS)" riscado no fim.'),
  ('pessoas', 4, 2, 'NPS + pesquisas internas', null),
  ('acionistas', 1, 1, 'X% líquido + inflação', null),
  ('acionistas', 1, 2, 'Limite de inadimplência X%', null),
  ('acionistas', 1, 3, 'Controle/construção orçamento por área', null),
  ('acionistas', 1, 4, 'Não estourar X% do orçamento pré-estabelecido', null),
  ('acionistas', 1, 5, 'Desenvolvimento real da área tributária', null),
  ('acionistas', 2, 1, 'Automatizar em X% determinadas atividades', null),
  ('acionistas', 2, 2, 'Economia de X horas com ferramentas de IA', null),
  ('acionistas', 3, 1, 'Eventos', null),
  ('acionistas', 3, 2, 'Parcerias', null),
  ('acionistas', 3, 3, 'Congressos', null),
  ('acionistas', 3, 4, 'Promover eventos', null),
  ('acionistas', 3, 5, 'Rankings', null),
  ('acionistas', 3, 6, 'NPS', null),
  ('acionistas', 3, 7, 'Controle de qualidade', null),
  ('acionistas', 4, 1, 'Regras cotas da sociedade / partnership', null)
) as g(grupo, alavanca, pos, texto, nota)
on conflict (id) do nothing;
