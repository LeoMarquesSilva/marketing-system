-- Permite gestores atualizarem fotos (ex.: mudar session_id em lote).
drop policy if exists "managers update collaborator photos" on public.collaborator_photos;

create policy "managers update collaborator photos"
on public.collaborator_photos for update to authenticated
using ((select public.has_collaborator_photos_manager_access()))
with check ((select public.has_collaborator_photos_manager_access()));
