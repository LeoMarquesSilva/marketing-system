-- WhatsApp: saúde da conexão da instância Evolution. Antes disso não havia
-- nenhuma forma de saber se o número desconectou (logout, QR expirado etc)
-- além de um humano notar que pararam de chegar mensagens.

create table if not exists public.whatsapp_instance_status (
  instance_name text primary key,
  state text not null default 'unknown',
  status_reason text,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_instance_status enable row level security;

grant select on public.whatsapp_instance_status to authenticated;
grant all on public.whatsapp_instance_status to service_role;
revoke all on public.whatsapp_instance_status from anon;

create policy whatsapp_instance_status_select_authenticated
  on public.whatsapp_instance_status for select to authenticated using (true);
create policy whatsapp_instance_status_all_service
  on public.whatsapp_instance_status for all to service_role using (true) with check (true);

comment on table public.whatsapp_instance_status is
  'Último estado de conexão conhecido de cada instância Evolution (evento CONNECTION_UPDATE)';
