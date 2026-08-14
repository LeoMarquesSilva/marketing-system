drop policy if exists "own delete collaborator photos" on public.collaborator_photos;
create policy "own delete collaborator photos"
on public.collaborator_photos for delete to authenticated
using (user_id = (select public.current_app_user_id()));
