-- Capa da notícia (og:image) extraída na geração, exibida no card do post.
alter table public.content_roteiros
  add column if not exists image_url text;

comment on column public.content_roteiros.image_url is
  'Capa da notícia (og:image) extraída no momento da geração, exibida no card.';
