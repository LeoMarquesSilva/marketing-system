-- Vídeos nas ocorrências de boas práticas (RH > Boas práticas).
--
-- O vídeo fica na mesma tabela e no mesmo bucket privado das fotos (o tipo
-- vem de content_type). O navegador sobe o arquivo como veio do celular, mais
-- uma miniatura WebP tirada de um quadro do vídeo (poster_path) e a duração.
-- Limites do app: até 200 MB por vídeo, 3 vídeos e 10 arquivos por feedback.
alter table public.hr_good_practice_feedback_photos
  add column if not exists duration_seconds numeric(8, 2),
  add column if not exists poster_path text;

alter table public.hr_good_practice_feedback_photos
  drop constraint if exists hr_good_practice_feedback_photos_duration_check;

alter table public.hr_good_practice_feedback_photos
  add constraint hr_good_practice_feedback_photos_duration_check
  check (duration_seconds is null or duration_seconds >= 0);

comment on column public.hr_good_practice_feedback_photos.duration_seconds is
  'Duração do vídeo em segundos (null em foto ou quando o navegador não leu)';
comment on column public.hr_good_practice_feedback_photos.poster_path is
  'Miniatura WebP do vídeo no mesmo bucket; null em foto ou quando o navegador não gerou';

update storage.buckets
set file_size_limit = 209715200,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm'
    ]::text[]
where id = 'RH-BOAS-PRATICAS';
