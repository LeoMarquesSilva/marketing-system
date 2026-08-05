-- Supabase bloqueia DELETE sem WHERE; ajusta a RPC de import VIOS.
create or replace function public.import_hr_vios_employees(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sync_at timestamptz := now();
  v_imported integer := 0;
  v_result jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows deve ser um array JSON';
  end if;

  delete from public.hr_vios_employees where true;

  insert into public.hr_vios_employees (
    ci,
    company,
    department,
    cost_center,
    full_name,
    position,
    profile,
    email,
    phone,
    mobile,
    situation,
    is_active,
    synced_at
  )
  select
    nullif(trim(coalesce(r->>'ci', r->>'CI', '')), ''),
    nullif(trim(coalesce(r->>'company', r->>'Empresa', '')), ''),
    nullif(trim(coalesce(r->>'department', r->>'Departamento', '')), ''),
    nullif(trim(coalesce(r->>'cost_center', r->>'Rateio', '')), ''),
    coalesce(
      nullif(trim(coalesce(r->>'full_name', r->>'Nome', '')), ''),
      'Sem nome'
    ),
    nullif(trim(coalesce(r->>'position', r->>'Função', r->>'Funcao', '')), ''),
    nullif(trim(coalesce(r->>'profile', r->>'Perfil', '')), ''),
    nullif(trim(coalesce(r->>'email', r->>'E-mail', r->>'Email', '')), ''),
    nullif(trim(coalesce(r->>'phone', r->>'Telefone', '')), ''),
    nullif(trim(coalesce(r->>'mobile', r->>'Celular', '')), ''),
    nullif(trim(coalesce(r->>'situation', r->>'Situação', r->>'Situacao', '')), ''),
    public.vios_situation_is_active(
      coalesce(r->>'situation', r->>'Situação', r->>'Situacao', '')
    ),
    v_sync_at
  from jsonb_array_elements(p_rows) as r
  where nullif(trim(coalesce(r->>'ci', r->>'CI', '')), '') is not null;

  get diagnostics v_imported = row_count;

  v_result := public.sync_hr_employees_from_vios();
  return v_result || jsonb_build_object('imported', v_imported);
end;
$$;

revoke all on function public.import_hr_vios_employees(jsonb) from public, anon, authenticated;
grant execute on function public.import_hr_vios_employees(jsonb) to service_role;
