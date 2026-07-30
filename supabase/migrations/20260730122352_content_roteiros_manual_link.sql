-- Permite criar roteiro a partir de um link avulso colado pelo usuário.
--
-- topic_id passa a aceitar null: uma notícia enviada manualmente não vem de
-- nenhum tema/RSS cadastrado. A coluna só era usada como filtro opcional de
-- leitura, então nada quebra ao afrouxar a restrição.
--
-- `source` distingue a origem para a interface e para relatórios.

alter table public.content_roteiros
  alter column topic_id drop not null;

alter table public.content_roteiros
  add column if not exists source text not null default 'rss'
    check (source in ('rss', 'manual'));

-- Quem criou o roteiro manual (auditoria simples; nulo para os vindos de RSS).
alter table public.content_roteiros
  add column if not exists created_by_id uuid references public.users(id) on delete set null;

alter table public.content_roteiros
  add column if not exists created_by_name text;

create index if not exists content_roteiros_source_idx
  on public.content_roteiros(source);

create index if not exists content_roteiros_created_by_idx
  on public.content_roteiros(created_by_id);
