-- Arquivos finais das solicitações do planner: a designer sobe a arte direto na
-- tarefa em vez de mandar link. A página /entregas/<tag> (com login) lista as
-- peças de uma tag do título ("[OAB]") para quem vai postar baixar.

create table if not exists public.marketing_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  uploaded_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_request_files_request
  on public.marketing_request_files(request_id, sort_order, created_at);

alter table public.marketing_request_files enable row level security;

drop policy if exists "Authenticated users manage marketing request files" on public.marketing_request_files;
create policy "Authenticated users manage marketing request files"
  on public.marketing_request_files for all to authenticated
  using (true) with check (true);

-- Bucket privado: as páginas recebem URLs assinadas com a sessão do usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'MARKETING-SYSTEM-ARTES',
  'MARKETING-SYSTEM-ARTES',
  false,
  524288000,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'video/mp4', 'video/quicktime',
    'application/zip'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated read MARKETING-SYSTEM-ARTES" on storage.objects;
drop policy if exists "Authenticated insert MARKETING-SYSTEM-ARTES" on storage.objects;
drop policy if exists "Authenticated update MARKETING-SYSTEM-ARTES" on storage.objects;
drop policy if exists "Authenticated delete MARKETING-SYSTEM-ARTES" on storage.objects;

create policy "Authenticated read MARKETING-SYSTEM-ARTES"
  on storage.objects for select to authenticated
  using (bucket_id = 'MARKETING-SYSTEM-ARTES');

create policy "Authenticated insert MARKETING-SYSTEM-ARTES"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'MARKETING-SYSTEM-ARTES'
    and (storage.foldername(name))[1] = 'requests'
  );

create policy "Authenticated update MARKETING-SYSTEM-ARTES"
  on storage.objects for update to authenticated
  using (bucket_id = 'MARKETING-SYSTEM-ARTES')
  with check (
    bucket_id = 'MARKETING-SYSTEM-ARTES'
    and (storage.foldername(name))[1] = 'requests'
  );

create policy "Authenticated delete MARKETING-SYSTEM-ARTES"
  on storage.objects for delete to authenticated
  using (bucket_id = 'MARKETING-SYSTEM-ARTES');

comment on table public.marketing_request_files is
  'Arquivos finais da arte de uma solicitação do planner (substituem o link da arte).';
