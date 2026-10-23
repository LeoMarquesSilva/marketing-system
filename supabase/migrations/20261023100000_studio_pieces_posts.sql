-- Estúdio de peças: coleção de posts do escritório (Bismarchi | Pires).
-- A peça pode nascer de um post do Gerador de conteúdo (content_roteiros), e as
-- fotos de capa e logos de clientes ficam num bucket privado, lido só pelas rotas
-- /api/estudio/imagens (com login do Marketing).

alter table public.studio_pieces
  add column if not exists roteiro_id uuid references public.content_roteiros(id) on delete set null;

create index if not exists idx_studio_pieces_roteiro on public.studio_pieces(roteiro_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ESTUDIO-PECAS', 'ESTUDIO-PECAS', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

comment on column public.studio_pieces.roteiro_id is 'Post do Gerador de conteúdo que deu origem à peça (coleção BP).';
