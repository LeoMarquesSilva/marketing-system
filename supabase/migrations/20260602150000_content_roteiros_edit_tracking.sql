-- Rastreio de edição do post pelo colaborador (confirmação "ficar com este texto").
alter table public.content_roteiros
  add column if not exists original_post text,
  add column if not exists edited_by_id uuid,
  add column if not exists edited_by_name text,
  add column if not exists edited_at timestamptz;

comment on column public.content_roteiros.original_post is
  'Texto original gerado pela IA, preservado quando o colaborador edita o post.';
comment on column public.content_roteiros.edited_by_name is
  'Nome do colaborador que confirmou/alterou o texto do post.';
