-- Modelos do Estúdio de peças criados na tela Modelos (/conteudo/estudio/modelos), a
-- partir de uma prancheta do Illustrator: fundo limpo no bucket ESTUDIO-PECAS
-- (<TAG>/modelos/) + caixas de texto/imagem com posição, fonte, cor e tamanho.
-- As coleções novas (campanhas) ficam ao lado das que estão no código.
-- Só a service role acessa (as rotas /api/estudio/* checam se a pessoa é do Marketing).

create table if not exists public.studio_collections (
  tag text primary key check (tag ~ '^[A-Z0-9]{2,12}$'),
  nome text not null,
  contexto text not null default '',
  planner text not null default 'tag' check (planner in ('tag', 'posts')),
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_templates (
  id text primary key check (id ~ '^m-[a-z0-9-]{3,60}$'),
  tag text not null,
  nome text not null,
  descricao text not null default '',
  formato text not null check (formato in ('feed', 'story')),
  uso text[] not null default array['feed', 'carrossel'],
  fundo text not null,
  caixas jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_templates_tag on public.studio_templates(tag);

alter table public.studio_collections enable row level security;
alter table public.studio_templates enable row level security;
revoke all on public.studio_collections from anon, authenticated;
revoke all on public.studio_templates from anon, authenticated;
grant all on public.studio_collections to service_role;
grant all on public.studio_templates to service_role;

comment on table public.studio_collections is 'Coleções (campanhas) do Estúdio criadas na tela Modelos. As do código ficam em src/lib/estudio/templates.ts.';
comment on table public.studio_templates is 'Modelos do Estúdio criados na tela Modelos: fundo limpo + caixas. Acesso só pelas rotas /api/estudio.';
