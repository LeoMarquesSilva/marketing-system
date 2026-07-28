-- Liga fotos do perfil ao avatar do usuário do sistema.
-- Backfill dos rascunhos já importados + importação passa a copiar avatar_url.

update public.professional_profiles pp
set photo_url = u.avatar_url,
    updated_at = now()
from public.users u
where u.id = pp.user_id
  and pp.photo_url is null
  and nullif(btrim(coalesce(u.avatar_url, '')), '') is not null;
