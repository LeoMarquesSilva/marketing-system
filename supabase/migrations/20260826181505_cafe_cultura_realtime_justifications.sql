-- Café com Cultura: justificativas completas do RESPONSUM e painel Realtime para admins.

alter table public.event_participants
  add column if not exists responsum_justifications jsonb not null default '[]'::jsonb;

alter table public.event_participants
  drop constraint if exists event_participants_responsum_justifications_array;
alter table public.event_participants
  add constraint event_participants_responsum_justifications_array
  check (jsonb_typeof(responsum_justifications) = 'array');

comment on column public.event_participants.responsum_justifications is
  'Snapshot dos títulos e textos das justificativas sincronizadas do RESPONSUM.';

-- Postgres Changes respeita RLS: somente administradores ativos podem ler os registros.
grant select on public.event_participants to authenticated;

drop policy if exists "active admins read cafe participants" on public.event_participants;
create policy "active admins read cafe participants"
on public.event_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active = true
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_participants'
  ) then
    alter publication supabase_realtime add table public.event_participants;
  end if;
end
$$;
