-- Estúdio de peças: posts, carrosséis e stories montados a partir dos modelos do
-- Illustrator (/conteudo/estudio). Cada slide guarda o modelo e os valores dos
-- campos; a arte é desenhada na tela e exportada em PNG. Só a service role acessa
-- (as rotas /api/estudio/* checam se a pessoa é do Marketing).

create table if not exists public.studio_pieces (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  titulo text not null default '',
  tipo text not null check (tipo in ('feed', 'carrossel', 'stories')),
  slides jsonb not null default '[]'::jsonb,
  legenda text not null default '',
  request_id uuid references public.marketing_requests(id) on delete set null,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_pieces_updated on public.studio_pieces(updated_at desc);

alter table public.studio_pieces enable row level security;
revoke all on public.studio_pieces from anon, authenticated;
grant all on public.studio_pieces to service_role;

comment on table public.studio_pieces is 'Peças do Estúdio (modelos do Illustrator + campos editáveis). Acesso só pelas rotas /api/estudio.';
