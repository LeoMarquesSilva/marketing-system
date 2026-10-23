-- Fotos das ocorrências de boas práticas (RH > Boas práticas).
--
-- Evidência do que foi visto (a caneca na mesa, a geladeira, a sala). Ficam
-- num bucket PRIVADO: o navegador sobe direto por URL assinada gerada no
-- servidor (só para quem tem acesso ao RH) e vê por link temporário.
-- A foto é regravada no navegador antes do envio (WebP, até 1920 px), o que
-- também descarta os metadados (GPS). taken_at = data da foto lida do EXIF,
-- quando a câmera gravou.

create table if not exists public.hr_good_practice_feedback_photos (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.hr_good_practice_feedbacks(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  width integer,
  height integer,
  taken_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hr_good_practice_feedback_photos_feedback_idx
  on public.hr_good_practice_feedback_photos (feedback_id, created_at);

alter table public.hr_good_practice_feedback_photos enable row level security;

revoke all on public.hr_good_practice_feedback_photos from anon;
grant select on public.hr_good_practice_feedback_photos to authenticated;
grant select, insert, update, delete on public.hr_good_practice_feedback_photos to service_role;

drop policy if exists "hr reads good practice photos" on public.hr_good_practice_feedback_photos;
create policy "hr reads good practice photos"
on public.hr_good_practice_feedback_photos for select to authenticated
using ((select public.has_hr_access()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'RH-BOAS-PRATICAS',
  'RH-BOAS-PRATICAS',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
