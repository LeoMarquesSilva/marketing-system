-- Fontes do Estúdio de peças enviadas pela tela (Gotham, Neulis…): o arquivo fica no
-- bucket ESTUDIO-PECAS (pasta fontes/) e a página monta o @font-face com a família e o
-- peso daqui. Uma fonte por família + peso + estilo (enviar de novo substitui).
-- Só a service role acessa (as rotas /api/estudio/* checam se a pessoa é do Marketing).

create table if not exists public.studio_fonts (
  id uuid primary key default gen_random_uuid(),
  familia text not null,
  peso int not null check (peso between 100 and 900),
  estilo text not null default 'normal' check (estilo in ('normal', 'italic')),
  arquivo text not null,
  formato text not null check (formato in ('otf', 'ttf', 'woff', 'woff2')),
  nome_original text not null default '',
  -- nome PostScript do arquivo ("Gotham-Book"), para casar com as fontes do .ai
  postscript text,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_studio_fonts_face on public.studio_fonts(familia, peso, estilo);

alter table public.studio_fonts enable row level security;
revoke all on public.studio_fonts from anon, authenticated;
grant all on public.studio_fonts to service_role;

comment on table public.studio_fonts is 'Fontes enviadas no Estúdio de peças (arquivo no bucket ESTUDIO-PECAS/fontes). Acesso só pelas rotas /api/estudio.';

-- o bucket das peças passa a aceitar arquivos de fonte
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'font/otf', 'font/ttf', 'font/woff', 'font/woff2']
where id = 'ESTUDIO-PECAS';
