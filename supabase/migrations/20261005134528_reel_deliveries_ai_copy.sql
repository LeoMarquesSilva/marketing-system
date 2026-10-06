-- Aprovação de Reels: o envio não pede mais título. Título e subtítulo da capa
-- ficam na etapa de capa e legenda, e podem ser gerados por IA a partir da
-- transcrição do vídeo seguindo o guia editorial do escritório.

alter table public.reel_deliveries alter column title drop not null;
alter table public.reel_deliveries drop constraint if exists reel_deliveries_title_check;
alter table public.reel_deliveries add constraint reel_deliveries_title_check
  check (title is null or char_length(trim(title)) between 3 and 240);

alter table public.reel_deliveries
  add column if not exists cover_title text
    check (cover_title is null or char_length(cover_title) <= 160),
  add column if not exists cover_subtitle text
    check (cover_subtitle is null or char_length(cover_subtitle) <= 240),
  add column if not exists transcript text
    check (transcript is null or char_length(transcript) <= 30000),
  add column if not exists ai_status text
    check (ai_status is null or ai_status in ('processing', 'done', 'failed')),
  add column if not exists ai_error text,
  add column if not exists ai_updated_at timestamptz;

-- Áudio extraído no navegador (WAV mono 16 kHz) para a transcrição; é apagado depois.
update storage.buckets
   set allowed_mime_types = array[
     'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
     'image/jpeg', 'image/png', 'image/webp',
     'audio/wav'
   ]::text[]
 where id = 'MARKETING-SYSTEM-REELS';
