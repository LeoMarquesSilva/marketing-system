-- Remove o fallback para a chave de permissão legada '/ferias' em has_hr_access().
-- Confirmado com dados reais antes de aplicar: os únicos 3 usuários que ainda
-- tinham '/ferias' no array já tinham '/rh' também — ninguém perde acesso.
-- Os gestores/sócios com visualização automática de Férias usam um mecanismo
-- por cargo (ferias_access_mode = 'auto'), independente desta chave.

create or replace function public.has_hr_access()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/rh' = any (coalesce(u.permissions, array[]::text[]))
      )
  );
$$;

-- Limpeza de dado: remove a chave legada de quem ainda a tinha (todos já com '/rh').
update public.users
set permissions = array_remove(permissions, '/ferias')
where '/ferias' = any(coalesce(permissions, array[]::text[]));
