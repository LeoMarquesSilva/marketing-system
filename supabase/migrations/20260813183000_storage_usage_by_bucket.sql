-- Uso agregado do Storage por bucket, para a barra de cota do projeto.

create or replace function public.storage_usage_by_bucket()
returns table(bucket_id text, files bigint, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.bucket_id,
    count(*)::bigint as files,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as bytes
  from storage.objects o
  group by o.bucket_id;
$$;

revoke all on function public.storage_usage_by_bucket() from public, anon, authenticated;
grant execute on function public.storage_usage_by_bucket() to service_role;

comment on function public.storage_usage_by_bucket() is
  'Uso do Storage por bucket (service_role). Cota do plano Pro é no projeto, não no bucket.';
