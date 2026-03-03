-- Tabela de comentários e alterações por solicitação (métricas designers)
-- Execute no SQL Editor do Supabase

create table if not exists public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketing_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  is_alteration boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_comments_request_id on public.request_comments(request_id);
create index if not exists idx_request_comments_created_at on public.request_comments(created_at desc);

comment on table public.request_comments is 'Comentários e alterações nas solicitações de marketing (métricas designers)';
comment on column public.request_comments.is_alteration is 'true = alteração registrada, false = comentário';

-- RLS
alter table public.request_comments enable row level security;

create policy "Usuários autenticados podem ler comentários das solicitações"
  on public.request_comments for select
  using (true);

create policy "Usuários autenticados podem inserir comentários"
  on public.request_comments for insert
  with check (true);

create policy "Autor pode atualizar próprio comentário"
  on public.request_comments for update
  using (auth.uid() is not null and user_id::text in (
    select id::text from public.users where auth_id = auth.uid()
  ));

create policy "Autor pode deletar próprio comentário"
  on public.request_comments for delete
  using (auth.uid() is not null and user_id::text in (
    select id::text from public.users where auth_id = auth.uid()
  ));
