-- Amplia a regra automática de visualização de férias para a nomenclatura
-- atual de cargos do RH (planilha de colaboradores de 18/08/2026).

create or replace function private.resolve_user_ferias_view_enabled(
  target_user_id uuid,
  access_mode text,
  area_scope text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when access_mode = 'disabled' then false
    when access_mode = 'custom' then coalesce(cardinality(area_scope), 0) > 0
    else exists (
      select 1
      from public.hr_employees h
      where h.user_id = target_user_id
        and lower(
          translate(trim(coalesce(h.position, '')), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç',
                    'AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc')
        ) in (
          'gerente',
          'coordenador',
          'coordenador comercial',
          'supervisor',
          'socio',
          'socio de area',
          'socio patrimonial'
        )
    )
  end;
$$;

update public.users u
set ferias_view_enabled = private.resolve_user_ferias_view_enabled(
  u.id,
  u.ferias_access_mode,
  u.ferias_area_scope
);
