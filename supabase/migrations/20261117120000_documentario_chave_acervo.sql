-- Minidocumentário: chave só do acervo (/documentario/acervo/enviar), junto com a de ver
-- (/documentario). Quem tem as duas sobe arquivos para a pasta acervo/ do bucket privado,
-- sem poder editar o documento, as gravações ou as decisões dos sócios (isso continua
-- exigindo admin ou /documentario/editar, conferido na API).

create or replace function public.has_documentary_editor_access()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and coalesce(u.is_active, true)
      and (
        lower(coalesce(u.role, '')) = 'admin'
        or '/documentario/editar' = any (coalesce(u.permissions, array[]::text[]))
        or (
          '/documentario/acervo/enviar' = any (coalesce(u.permissions, array[]::text[]))
          and '/documentario' = any (coalesce(u.permissions, array[]::text[]))
        )
      )
  );
$$;

revoke all on function public.has_documentary_editor_access() from public, anon;
grant execute on function public.has_documentary_editor_access() to authenticated;
