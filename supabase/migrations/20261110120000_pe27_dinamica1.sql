-- PE27: Dinâmica 1 do workshop de 05/11/2026 — "O que fizemos em 2026 que nos
-- aproximou e nos afastou da Missão, Visão, Valores e Propósito?". Cada um dos
-- 4 grupos ficou com um tema e entregou um cartaz (fonte principal) e
-- rascunhos na folha impressa (detalhe dos itens e itens que não foram para o
-- cartaz). Quem estava em cada grupo não veio com as fotos.
--
-- strategic_plan_groups ganha o tema (Dinâmica 1), a proposta escrita pelo
-- grupo (ex.: proposta de missão), anotações e as fotos dos rascunhos.
-- strategic_plan_reflections guarda cada item da matriz aproximou × afastou.

alter table public.strategic_plan_groups
  add column if not exists theme text check (theme in ('visao', 'missao', 'valores', 'proposito')),
  add column if not exists proposal text,
  add column if not exists notes text,
  add column if not exists sketch_paths text[] not null default '{}';

create table if not exists public.strategic_plan_reflections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.strategic_plan_groups(id) on delete cascade,
  direction text not null check (direction in ('aproximou', 'afastou')),
  position smallint not null default 0,
  text text not null,
  -- Como o item aparece no rascunho, quando diz mais que o cartaz.
  detail text,
  -- Recorte dentro do tema (Valores: a letra do CIVIL).
  facet text,
  -- 'cartaz' = está no cartaz final; 'rascunho' = só na folha de rascunho.
  source text not null default 'cartaz' check (source in ('cartaz', 'rascunho')),
  transcription_note text,
  created_at timestamptz not null default now()
);

create index if not exists strategic_plan_reflections_group_idx
  on public.strategic_plan_reflections (group_id, direction, position);

alter table public.strategic_plan_reflections enable row level security;
revoke all on public.strategic_plan_reflections from anon, authenticated;
grant select, insert, update, delete on public.strategic_plan_reflections to service_role;

-- Grupos ---------------------------------------------------------------------
insert into public.strategic_plan_groups (id, cycle, dynamic, dimension, theme, name, poster_title, poster_path, sketch_paths, proposal, notes, sort)
values
  (md5('pe27:d1:grupo:visao')::uuid, 'PE27', 1, null, 'visao', 'Grupo Visão', 'BOPE! Pega a Visão!!',
    'workshop-05nov/dinamica1-visao-cartaz.jpg',
    array['workshop-05nov/dinamica1-visao-rascunho.jpg'],
    null, null, 1),
  (md5('pe27:d1:grupo:missao')::uuid, 'PE27', 1, null, 'missao', 'Grupo Missão', 'Missão · Acertos x Erros',
    'workshop-05nov/dinamica1-missao-cartaz.jpg',
    array[
      'workshop-05nov/dinamica1-missao-rascunho-1.jpg',
      'workshop-05nov/dinamica1-missao-rascunho-2.jpg',
      'workshop-05nov/dinamica1-missao-rascunho-3.jpg',
      'workshop-05nov/dinamica1-missao-rascunho-4.jpg',
      'workshop-05nov/dinamica1-missao-rascunho-5.jpg'
    ],
    'Impactar a sociedade por meio dos clientes com atendimento humanizado, personalizado e eficiente, visando impacto sócio-econômico no país.',
    'Nos rascunhos, as ideias que levaram à proposta: estabilidade do negócio; impacto na sociedade e desenvolvimento (preservação da empresa e do emprego); foco em pessoas; advocacia de resultados. O grupo também anotou "Missão – Propósito: por que acordamos todos os dias?".',
    2),
  (md5('pe27:d1:grupo:valores')::uuid, 'PE27', 1, null, 'valores', 'Grupo Valores', 'CIVIL · + e −',
    'workshop-05nov/dinamica1-valores-cartaz.jpg', '{}', null, null, 3),
  (md5('pe27:d1:grupo:proposito')::uuid, 'PE27', 1, null, 'proposito', 'Grupo Propósito', 'Afastou · Aproximou',
    'workshop-05nov/dinamica1-proposito-cartaz.jpg',
    array['workshop-05nov/dinamica1-proposito-rascunho.jpg'],
    null, null, 4)
on conflict (id) do nothing;

-- Itens ----------------------------------------------------------------------
insert into public.strategic_plan_reflections (id, group_id, direction, position, text, detail, facet, source, transcription_note)
select md5('pe27:d1:item:' || r.tema || ':' || r.dir || ':' || r.pos)::uuid,
       md5('pe27:d1:grupo:' || r.tema)::uuid,
       r.dir, r.pos, r.texto, r.detalhe, r.recorte, r.fonte, r.nota
from (values
  -- Visão
  ('visao', 'aproximou', 1, 'Clientes', 'Diversificação do perfil de cliente', null, 'cartaz', null),
  ('visao', 'aproximou', 2, 'Inclusão', 'Inclusão dos colaboradores na tomada de decisão + compartilhamento da visão e valores', null, 'cartaz', null),
  ('visao', 'aproximou', 3, 'Profissionalização', 'Profissionalização do escritório', null, 'cartaz', null),
  ('visao', 'aproximou', 4, 'Automação', null, null, 'cartaz', null),
  ('visao', 'aproximou', 5, 'PDI', 'PDI (one a one + feedbacks), aprimoramento de competências', null, 'cartaz',
    'No rascunho, embaixo de "competências" há uma palavra pouco legível (parece "skills").'),
  ('visao', 'aproximou', 6, 'Proximidade dos sócios ("Meu patrão!")', 'Proximidade dos sócios com as equipes', null, 'cartaz', null),
  ('visao', 'afastou', 1, 'Clientes', 'Manutenção de clientes não pagantes, que não integra valor no escritório', null, 'cartaz', null),
  ('visao', 'afastou', 2, 'Aproximação das equipes', 'Ferramentas para aproximar as equipes híbridas', null, 'cartaz',
    '"Híbridas" é a leitura provável da letra no rascunho.'),
  ('visao', 'afastou', 3, 'Eventos', 'Promoção de meios para os colaboradores participarem mais de eventos (financeiramente e tempo)', null, 'cartaz', null),
  ('visao', 'afastou', 4, 'Múltiplas plataformas', 'Muitas plataformas diferentes', null, 'cartaz', null),
  ('visao', 'afastou', 5, 'Quantidade de metas', null, null, 'cartaz', null),
  -- Missão (cartaz "Acertos x Erros")
  ('missao', 'aproximou', 1, 'Desenvolvimento de pessoas', null, null, 'cartaz', null),
  ('missao', 'aproximou', 2, 'Desenvolvimento de sistemas', 'Inovação de sistemas (automatizações)', null, 'cartaz', null),
  ('missao', 'aproximou', 3, 'Automatização de procedimentos', null, null, 'cartaz', null),
  ('missao', 'aproximou', 4, 'Rotinas e estratégias de fidelização dos clientes', null, null, 'cartaz', null),
  ('missao', 'aproximou', 5, 'Composição das equipes (novas contratações)', null, null, 'rascunho', null),
  ('missao', 'afastou', 1, 'Falha de comunicação', 'Comunicação prejudicada em detrimento do cargo', null, 'cartaz', null),
  ('missao', 'afastou', 2, 'Mudanças repentinas e bruscas (rotas e procedimento estratégico)', 'Mudanças repentinas de rotas, procedimentos e estratégia', null, 'cartaz', null),
  -- Valores (cartaz CIVIL com + e −)
  ('valores', 'aproximou', 1, 'NPS', null, 'C · Cliente no centro', 'cartaz', null),
  ('valores', 'aproximou', 2, 'Área comercial', null, 'C · Cliente no centro', 'cartaz', null),
  ('valores', 'aproximou', 3, 'Agenda positiva (existente)', null, 'C · Cliente no centro', 'cartaz', null),
  ('valores', 'aproximou', 4, 'Empatia com o cliente', null, 'C · Cliente no centro', 'cartaz', null),
  ('valores', 'aproximou', 5, 'LexNext Lab', null, 'I · Inovação constante', 'cartaz', null),
  ('valores', 'aproximou', 6, 'Englobar áreas internas', null, 'I · Inovação constante', 'cartaz', null),
  ('valores', 'aproximou', 7, 'Área de Pessoas e Cultura', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'aproximou', 8, 'Implementação de avaliações e pesquisas internas', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'aproximou', 9, 'Soluções personalizadas', null, 'I · Inteligência em resultados', 'cartaz', null),
  ('valores', 'aproximou', 10, 'Engajamento e autonomia interna para metas estratégicas', null, 'L · Liberdade para criar', 'cartaz', null),
  ('valores', 'afastou', 1, 'Agenda positiva sem controle por área/cliente', null, 'C · Cliente no centro', 'cartaz', null),
  ('valores', 'afastou', 2, 'Adesão interna', null, 'I · Inovação constante', 'cartaz', null),
  ('valores', 'afastou', 3, 'Comercialização', null, 'I · Inovação constante', 'cartaz', null),
  ('valores', 'afastou', 4, 'Comunicação', null, 'I · Inovação constante', 'cartaz', null),
  ('valores', 'afastou', 5, 'Ausência de plano de carreira (cargos e salários)', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'afastou', 6, 'Adesão às pesquisas internas', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'afastou', 7, 'Orçamento para treinamentos', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'afastou', 8, 'Falta de clareza em escopos', null, 'V · Valorização de pessoas', 'cartaz', null),
  ('valores', 'afastou', 9, 'Gestão de prioridades', null, 'I · Inteligência em resultados', 'cartaz', null),
  ('valores', 'afastou', 10, 'Falta de representatividade e inclusão da equipe operacional em comitês e projetos internos', null, 'L · Liberdade para criar', 'cartaz', null),
  -- Propósito
  ('proposito', 'aproximou', 1, 'Criação do planejamento estratégico', null, null, 'cartaz', null),
  ('proposito', 'aproximou', 2, 'Estruturação de processos e fluxos', null, null, 'cartaz', null),
  ('proposito', 'aproximou', 3, 'Estruturação do financeiro e das equipes', null, null, 'cartaz', null),
  ('proposito', 'afastou', 1, 'Falta de participação no PE', 'Falta de participação da equipe no planejamento estratégico', null, 'cartaz', null),
  ('proposito', 'afastou', 2, 'Falta de preparação da liderança', 'Preparo da liderança / comunicação', null, 'cartaz', null),
  ('proposito', 'afastou', 3, 'Falta de clareza no plano de carreira', null, null, 'cartaz', null),
  ('proposito', 'afastou', 4, 'Burocratização de procedimentos', null, null, 'cartaz', null),
  ('proposito', 'afastou', 5, 'Demora em soluções estratégicas', null, null, 'rascunho', null)
) as r(tema, dir, pos, texto, detalhe, recorte, fonte, nota)
on conflict (id) do nothing;
