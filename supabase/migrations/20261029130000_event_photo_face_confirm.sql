-- Fotos de eventos: marcações em duas faixas.
-- Distância < 0,45 (ver FACE_SURE_THRESHOLD) aparece direto em "Em que eu apareço";
-- entre 0,45 e 0,5 fica em "Talvez seja você" até a pessoa confirmar ("Sou eu") ou recusar ("Não sou eu").

alter table public.event_photo_face_matches
  add column if not exists confirmed_at timestamptz;

comment on column public.event_photo_face_matches.confirmed_at is
  'Quando a pessoa confirmou "Sou eu" numa marcação da faixa "Talvez seja você".';
