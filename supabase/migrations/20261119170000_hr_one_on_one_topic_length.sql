-- Pauta trazida do Feedz: o pessoal usa o tópico como ata (até ~13 mil caracteres).
-- Tópico novo digitado no ORQESTRAI continua limitado a 500 pela API.
alter table public.hr_one_on_one_topics drop constraint if exists hr_one_on_one_topics_title_check;
alter table public.hr_one_on_one_topics
  add constraint hr_one_on_one_topics_title_check check (char_length(btrim(title)) between 1 and 20000);
