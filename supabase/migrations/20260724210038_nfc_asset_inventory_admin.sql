-- NFC Hub: inventário administrativo de itens emprestáveis.
-- Mantém o número do item como snapshot no histórico e usa asset_id
-- para garantir que somente itens cadastrados possam ser movimentados.

create table if not exists public.nfc_assets (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags(id) on delete restrict,
  asset_number text not null check (char_length(asset_number) between 1 and 80),
  label text not null default 'Item' check (char_length(label) between 1 and 80),
  status text not null default 'available'
    check (status in ('available', 'loaned', 'maintenance', 'inactive')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.nfc_assets is
  'Inventário de itens físicos controlados por etiquetas NFC.';
comment on column public.nfc_assets.asset_number is
  'Identificador visível e único do item dentro de uma etiqueta NFC.';

create unique index if not exists nfc_assets_tag_number_unique_idx
on public.nfc_assets(tag_id, lower(asset_number));

create index if not exists nfc_assets_tag_status_idx
on public.nfc_assets(tag_id, status, asset_number);

create index if not exists nfc_assets_created_by_idx
on public.nfc_assets(created_by)
where created_by is not null;

create index if not exists nfc_assets_updated_by_idx
on public.nfc_assets(updated_by)
where updated_by is not null;

drop trigger if exists nfc_assets_set_updated_at on public.nfc_assets;
create trigger nfc_assets_set_updated_at
before update on public.nfc_assets
for each row execute function public.set_nfc_updated_at();

alter table public.nfc_assets enable row level security;

revoke all on public.nfc_assets from public, anon, authenticated;
grant select, insert, update, delete on public.nfc_assets to service_role;

drop policy if exists "nfc service role manages assets" on public.nfc_assets;
create policy "nfc service role manages assets"
on public.nfc_assets
for all
to service_role
using (true)
with check (true);

alter table public.nfc_asset_loans
  add column if not exists asset_id uuid references public.nfc_assets(id) on delete restrict,
  add column if not exists return_notes text
    check (return_notes is null or char_length(return_notes) <= 1000);

-- Compatibilidade com ambientes que já possuam histórico antes do inventário.
insert into public.nfc_assets (
  tag_id,
  asset_number,
  label,
  status,
  created_by,
  updated_by
)
select distinct on (loan.tag_id, lower(loan.asset_number))
  loan.tag_id,
  loan.asset_number,
  coalesce(nullif(tag.action_config->>'assetLabel', ''), 'Item'),
  case
    when exists (
      select 1
      from public.nfc_asset_loans open_loan
      where open_loan.tag_id = loan.tag_id
        and lower(open_loan.asset_number) = lower(loan.asset_number)
        and open_loan.returned_at is null
    ) then 'loaned'
    else 'available'
  end,
  loan.checked_out_by,
  coalesce(loan.returned_by, loan.checked_out_by)
from public.nfc_asset_loans loan
join public.nfc_tags tag on tag.id = loan.tag_id
where not exists (
  select 1
  from public.nfc_assets asset
  where asset.tag_id = loan.tag_id
    and lower(asset.asset_number) = lower(loan.asset_number)
)
order by loan.tag_id, lower(loan.asset_number), loan.checked_out_at;

update public.nfc_asset_loans loan
set asset_id = asset.id
from public.nfc_assets asset
where loan.asset_id is null
  and asset.tag_id = loan.tag_id
  and lower(asset.asset_number) = lower(loan.asset_number);

alter table public.nfc_asset_loans
  alter column asset_id set not null;

create index if not exists nfc_asset_loans_asset_id_idx
on public.nfc_asset_loans(asset_id);

create or replace function public.nfc_checkout_asset(
  p_tag_id uuid,
  p_asset_number text,
  p_borrower_user_id uuid,
  p_checked_out_by uuid,
  p_checkout_scan_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset public.nfc_assets%rowtype;
  v_loan_id uuid;
begin
  select asset.*
  into v_asset
  from public.nfc_assets asset
  where asset.tag_id = p_tag_id
    and lower(asset.asset_number) = lower(trim(p_asset_number))
  for update;

  if not found then
    raise exception using message = 'ASSET_NOT_REGISTERED';
  end if;

  if v_asset.status = 'loaned' then
    raise exception using message = 'ASSET_ALREADY_CHECKED_OUT';
  elsif v_asset.status = 'maintenance' then
    raise exception using message = 'ASSET_IN_MAINTENANCE';
  elsif v_asset.status = 'inactive' then
    raise exception using message = 'ASSET_INACTIVE';
  end if;

  insert into public.nfc_asset_loans (
    asset_id,
    tag_id,
    asset_number,
    borrower_user_id,
    checked_out_by,
    checkout_scan_id
  )
  values (
    v_asset.id,
    p_tag_id,
    v_asset.asset_number,
    p_borrower_user_id,
    p_checked_out_by,
    p_checkout_scan_id
  )
  returning id into v_loan_id;

  update public.nfc_assets
  set status = 'loaned',
      updated_by = p_checked_out_by
  where id = v_asset.id;

  return v_loan_id;
end;
$$;

revoke all on function public.nfc_checkout_asset(uuid, text, uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.nfc_checkout_asset(uuid, text, uuid, uuid, uuid)
to service_role;

create or replace function public.nfc_return_asset(
  p_tag_id uuid,
  p_asset_number text,
  p_returned_by uuid,
  p_return_scan_id uuid,
  p_return_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_loan_id uuid;
  v_asset_id uuid;
begin
  select loan.id, loan.asset_id
  into v_loan_id, v_asset_id
  from public.nfc_asset_loans loan
  where loan.tag_id = p_tag_id
    and lower(loan.asset_number) = lower(trim(p_asset_number))
    and loan.returned_at is null
  for update;

  if not found then
    raise exception using message = 'ASSET_NOT_CHECKED_OUT';
  end if;

  update public.nfc_asset_loans
  set returned_at = now(),
      returned_by = p_returned_by,
      return_scan_id = p_return_scan_id,
      return_notes = nullif(trim(p_return_notes), '')
  where id = v_loan_id;

  update public.nfc_assets
  set status = 'available',
      updated_by = p_returned_by
  where id = v_asset_id;

  return v_loan_id;
end;
$$;

revoke all on function public.nfc_return_asset(uuid, text, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.nfc_return_asset(uuid, text, uuid, uuid, text)
to service_role;

create or replace function public.nfc_update_asset(
  p_asset_id uuid,
  p_label text,
  p_status text,
  p_notes text,
  p_updated_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_status text;
begin
  if p_status is not null
    and p_status not in ('available', 'maintenance', 'inactive') then
    raise exception using message = 'ASSET_STATUS_INVALID';
  end if;

  select asset.status
  into v_current_status
  from public.nfc_assets asset
  where asset.id = p_asset_id
  for update;

  if not found then
    raise exception using message = 'ASSET_NOT_FOUND';
  end if;

  if v_current_status = 'loaned' and p_status is not null then
    raise exception using message = 'ASSET_HAS_OPEN_LOAN';
  end if;

  update public.nfc_assets
  set label = trim(p_label),
      status = coalesce(p_status, v_current_status),
      notes = nullif(trim(p_notes), ''),
      updated_by = p_updated_by
  where id = p_asset_id;

  return p_asset_id;
end;
$$;

revoke all on function public.nfc_update_asset(uuid, text, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.nfc_update_asset(uuid, text, text, text, uuid)
to service_role;
