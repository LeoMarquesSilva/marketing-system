-- Tours de novidades: quem já viu cada um (um registro por pessoa e tour).
-- Evita uma coluna nova em users a cada novidade; o 1º é o do Gerador de conteúdo (18/11/2026).
create table if not exists public.user_tour_views (
  user_id uuid not null,
  tour_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);

alter table public.user_tour_views enable row level security;

comment on table public.user_tour_views is 'Tours de novidades já vistos (user_id = users.id). Lido e gravado só pelo servidor.';
