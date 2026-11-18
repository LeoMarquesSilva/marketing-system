-- Gerador de conteúdo: linha editorial por área (ex.: Reestruturação "subir a prateleira",
-- pedido do Ricardo em 18/11/2026) e escritórios de referência/concorrentes, cujos posts
-- públicos vêm da Business Discovery da API do Instagram.

alter table public.content_generator_settings
  add column if not exists area_guidelines jsonb not null default '{}'::jsonb;

update public.content_generator_settings
set area_guidelines = jsonb_build_object(
  'Reestruturação',
  'Público: empresários, CFOs, credores, bancos, fundos e investidores de special situations que já conhecem o básico. ' ||
  'Não explique o que é recuperação judicial, recuperação extrajudicial ou falência. Mostre domínio do assunto: leitura estratégica do caso ' ||
  '(classes de credores, cram down, DIP, venda de UPI, trava bancária, essencialidade de bens, consolidação substancial, créditos extraconcursais), ' ||
  'precedentes do STJ e das varas especializadas, números do caso e o que a decisão sinaliza para as próximas negociações. ' ||
  'Tom de quem conduz casos assim, não de quem explica o conceito.'
)
where id = 'default' and area_guidelines = '{}'::jsonb;

create table if not exists public.content_reference_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  followers_count integer,
  media_count integer,
  profile_picture_url text,
  kind text not null default 'referencia' check (kind in ('referencia', 'concorrente')),
  focus_area text not null default 'Geral',
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_reference_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.content_reference_accounts(id) on delete cascade,
  ig_media_id text not null unique,
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  media_url text,
  published_at timestamptz,
  like_count integer,
  comments_count integer,
  followers_at_sync integer,
  synced_at timestamptz not null default now()
);

create index if not exists content_reference_posts_account_published_idx
  on public.content_reference_posts (account_id, published_at desc);

alter table public.content_reference_accounts enable row level security;
alter table public.content_reference_posts enable row level security;

-- Ponto de partida: perfis Business que a API conseguiu ler em 18/11/2026. O Marketing ajusta na tela.
insert into public.content_reference_accounts (username, kind, focus_area, created_by_name) values
  ('tozzinifreire', 'referencia', 'Geral', 'Sugestão inicial'),
  ('felsbergadvogados', 'referencia', 'Geral', 'Sugestão inicial'),
  ('veiranoadvogados', 'referencia', 'Geral', 'Sugestão inicial'),
  ('stoccheforbes', 'referencia', 'Geral', 'Sugestão inicial')
on conflict (username) do nothing;
