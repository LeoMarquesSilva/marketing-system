-- Fotos de eventos: link de convidado (sem login) para um álbum.
-- Ex.: clientes que participaram do Café com Cultura veem e baixam as fotos por /galeria/<token>.
-- Só o servidor (service role) lê esta tabela: a página pública recebe o álbum já montado.

create table if not exists public.event_photo_album_shares (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.event_photo_albums(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  label text not null check (length(trim(label)) between 1 and 120),
  logo_url text,
  allow_download boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  open_count integer not null default 0,
  last_opened_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_photo_album_shares_album_idx
  on public.event_photo_album_shares (album_id, created_at desc);

comment on table public.event_photo_album_shares is
  'Links de convidado de um álbum de fotos de evento (/galeria/<token>, sem login). Revogar = revoked_at.';
comment on column public.event_photo_album_shares.label is
  'Para quem é o link (ex.: Pague Menos). Aparece na página do convidado.';
comment on column public.event_photo_album_shares.open_count is
  'Aberturas da página (uma por sessão do navegador; prévia do escritório não conta).';

alter table public.event_photo_album_shares enable row level security;
revoke all on public.event_photo_album_shares from anon, authenticated;
grant select, insert, update, delete on public.event_photo_album_shares to service_role;

-- Conta a abertura sem ler e regravar a linha inteira.
create or replace function public.event_photo_share_opened(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.event_photo_album_shares
     set open_count = open_count + 1,
         last_opened_at = now()
   where token = p_token
     and revoked_at is null;
$$;

revoke all on function public.event_photo_share_opened(text) from public, anon, authenticated;
grant execute on function public.event_photo_share_opened(text) to service_role;
