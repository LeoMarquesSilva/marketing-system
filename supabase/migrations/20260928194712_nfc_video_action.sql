-- NFC Hub: ação "video" (abre um vídeo em tela cheia ao aproximar a etiqueta).
-- Os vídeos ficam em bucket PRIVADO; a página pública recebe URL assinada temporária
-- gerada no servidor a cada leitura (vídeos pessoais não ficam com link público fixo).

alter table public.nfc_tags
  drop constraint if exists nfc_tags_action_type_check;

alter table public.nfc_tags
  add constraint nfc_tags_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan', 'professional_profile', 'video'
    )
  );

alter table public.nfc_templates
  drop constraint if exists nfc_templates_action_type_check;

alter table public.nfc_templates
  add constraint nfc_templates_action_type_check
  check (
    action_type in (
      'url', 'custom_page', 'form', 'webhook', 'whatsapp',
      'menu', 'sequence', 'asset_loan', 'professional_profile', 'video'
    )
  );

-- Bucket privado, até 2 GB por arquivo. O limite efetivo também depende do
-- "Global file size limit" do Storage do projeto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'MARKETING-SYSTEM-NFC-VIDEOS',
  'MARKETING-SYSTEM-NFC-VIDEOS',
  false,
  2147483648,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_nfc_manager_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/nfc' = any (coalesce(u.permissions, array[]::text[]))
      )
  );
$$;

revoke execute on function public.has_nfc_manager_access() from public, anon;
grant execute on function public.has_nfc_manager_access() to authenticated, service_role;

drop policy if exists "NFC managers read MARKETING-SYSTEM-NFC-VIDEOS" on storage.objects;
drop policy if exists "NFC managers insert MARKETING-SYSTEM-NFC-VIDEOS" on storage.objects;
drop policy if exists "NFC managers update MARKETING-SYSTEM-NFC-VIDEOS" on storage.objects;
drop policy if exists "NFC managers delete MARKETING-SYSTEM-NFC-VIDEOS" on storage.objects;

-- Leitura só para gestores (necessária ao upload retomável com upsert); o público
-- assiste via URL assinada criada pelo servidor.
create policy "NFC managers read MARKETING-SYSTEM-NFC-VIDEOS"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-NFC-VIDEOS'
    and (select public.has_nfc_manager_access())
  );

create policy "NFC managers insert MARKETING-SYSTEM-NFC-VIDEOS"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'MARKETING-SYSTEM-NFC-VIDEOS'
    and (storage.foldername(name))[1] = 'tags'
    and (select public.has_nfc_manager_access())
  );

create policy "NFC managers update MARKETING-SYSTEM-NFC-VIDEOS"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-NFC-VIDEOS'
    and (select public.has_nfc_manager_access())
  )
  with check (
    bucket_id = 'MARKETING-SYSTEM-NFC-VIDEOS'
    and (storage.foldername(name))[1] = 'tags'
    and (select public.has_nfc_manager_access())
  );

create policy "NFC managers delete MARKETING-SYSTEM-NFC-VIDEOS"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'MARKETING-SYSTEM-NFC-VIDEOS'
    and (select public.has_nfc_manager_access())
  );
