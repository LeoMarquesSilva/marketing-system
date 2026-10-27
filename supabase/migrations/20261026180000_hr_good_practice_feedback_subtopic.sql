-- Feedbacks de boas práticas: categorias passam a ser os capítulos do Manual de Boas Práticas 2025.
-- Uso da cozinha e Uso consciente da sala de reunião ganham subtema opcional
-- (lista em src/lib/rh/boas-praticas/types.ts; validado no servidor).
alter table public.hr_good_practice_feedbacks
  add column if not exists subtopic text;

alter table public.hr_good_practice_feedbacks
  drop constraint if exists hr_good_practice_feedbacks_subtopic_length;

alter table public.hr_good_practice_feedbacks
  add constraint hr_good_practice_feedbacks_subtopic_length
  check (subtopic is null or char_length(subtopic) between 1 and 80);

comment on column public.hr_good_practice_feedbacks.subtopic is
  'Subtema da categoria (ex.: Geladeira e alimentos em Uso da cozinha); null = sem subtema';
