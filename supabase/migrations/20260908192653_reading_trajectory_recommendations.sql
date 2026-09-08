-- Leituras que Formam Trajetórias
-- Conteúdo público da ação NFC e administração restrita a administradores ativos.

create table if not exists public.reading_trajectory_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  public_name text not null,
  practice_area text not null,
  role_override text,
  photo_override_url text,
  book_title text,
  book_author text,
  book_cover_url text,
  recommendation_text text,
  trajectory_note text,
  book_link text,
  display_order smallint not null,
  is_visible boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_trajectory_public_name_length check (char_length(public_name) between 1 and 180),
  constraint reading_trajectory_practice_area_length check (char_length(practice_area) between 1 and 180),
  constraint reading_trajectory_book_title_length check (book_title is null or char_length(book_title) <= 300),
  constraint reading_trajectory_book_author_length check (book_author is null or char_length(book_author) <= 240),
  constraint reading_trajectory_recommendation_length check (recommendation_text is null or char_length(recommendation_text) <= 12000),
  constraint reading_trajectory_note_length check (trajectory_note is null or char_length(trajectory_note) <= 3000),
  constraint reading_trajectory_order_positive check (display_order > 0)
);

create index if not exists reading_trajectory_recommendations_order_idx
  on public.reading_trajectory_recommendations(display_order);

comment on table public.reading_trajectory_recommendations is
  'Indicações editoriais da ação pública Leituras que Formam Trajetórias.';

create or replace function public.set_reading_trajectory_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reading_trajectory_set_updated_at
  on public.reading_trajectory_recommendations;
create trigger reading_trajectory_set_updated_at
before update on public.reading_trajectory_recommendations
for each row execute function public.set_reading_trajectory_updated_at();

alter table public.reading_trajectory_recommendations enable row level security;
revoke all on public.reading_trajectory_recommendations from anon, authenticated;
grant select, insert, update, delete on public.reading_trajectory_recommendations to authenticated;

drop policy if exists "active admins manage reading trajectories"
  on public.reading_trajectory_recommendations;
create policy "active admins manage reading trajectories"
on public.reading_trajectory_recommendations
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active = true
      and lower(coalesce(u.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active = true
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reading-trajectories',
  'reading-trajectories',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "active admins manage reading trajectory media" on storage.objects;
create policy "active admins manage reading trajectory media"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'reading-trajectories'
  and exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active = true
      and lower(coalesce(u.role, '')) = 'admin'
  )
)
with check (
  bucket_id = 'reading-trajectories'
  and exists (
    select 1 from public.users u
    where u.auth_id = (select auth.uid())
      and u.is_active = true
      and lower(coalesce(u.role, '')) = 'admin'
  )
);

with seed (
  email,
  public_name,
  practice_area,
  book_title,
  book_author,
  book_cover_url,
  recommendation_text,
  trajectory_note,
  book_link,
  display_order
) as (
  values
    (
      'gustavo@bismarchipires.com.br',
      'Gustavo Bismarchi',
      'Reestruturação',
      'Naturalismo Jurídico no Pensamento Brasileiro',
      null,
      'https://images-na.ssl-images-amazon.com/images/P/8502216228.01.LZZZZZZZ.jpg',
      $recommendation$Esse é um livro que gosto bastante de recomendar a quem está começando a aprofundar os estudos de teoria e história do direito. O livro reconstrói como os juristas brasileiros, sobretudo na passagem do Império para a República, foram aos poucos abandonando um jusnaturalismo mais tradicional e incorporando leituras sociológicas do direito, em diálogo direto com o que se discutia na Europa e nos Estados Unidos naquele momento. É um tipo de leitura que ajuda a preencher uma lacuna que a graduação costuma deixar em aberto, já que normalmente se passa direto do direito romano para o positivismo do século XX sem entender como se formou, de fato, uma cultura jurídica própria no Brasil.

Recomendo especialmente para quem quer entender de onde vêm certos debates que hoje parecem óbvios nos manuais. É leitura densa, mas que muda a forma como se enxerga o próprio raciocínio jurídico que usamos no dia a dia.

Desejo-lhe uma ótima leitura.$recommendation$,
      null,
      'https://www.amazon.com.br/Naturalismo-Jur%C3%ADdico-Pensamento-Brasileiro-Hist%C3%B3ria/dp/8502216228',
      1
    ),
    ('ricardo@bismarchipires.com.br', 'Ricardo Viscardi Pires', 'Direito Empresarial', null, null, null, null, null, null, 2),
    ('leonardo@bismarchipires.com.br', 'Leonardo Loureiro', 'Reestruturação', null, null, null, null, null, null, 3),
    (
      'daniel@bismarchipires.com.br',
      'Daniel Pressatto',
      'Trabalhista',
      'Manual do CEO',
      'Josh Kaufman',
      'https://covers.openlibrary.org/b/id/6713257-L.jpg',
      $recommendation$Leitura imprescindível para quem advoga para empresas.

Como o próprio prefácio destaca, o livro funciona quase como um MBA: apresenta, de forma prática e objetiva, os principais conceitos de negócios e gestão.

Mais do que entender de negócios, o livro ajuda o advogado a falar a língua do empresário. E, a partir disso, traduzir o juridiquês, ser mais objetivo e conectar o Direito às necessidades reais da empresa.

Uma habilidade fundamental para quem quer atender grandes empresas e atuar de forma verdadeiramente estratégica.$recommendation$,
      'Gustavo me indicou esse livro quando entrei no escritório. Me ajudou bastante.',
      null,
      4
    ),
    (
      'giancarlo@bismarchipires.com.br',
      'Giancarlo Zotini',
      'Cível',
      'Como Fazer Amigos e Influenciar Pessoas',
      'Dale Carnegie',
      'https://covers.openlibrary.org/b/id/13314878-L.jpg',
      $recommendation$Foi um dos últimos livros que li e que certamente mudou a forma como encarei a minha carreira.

As habilidades de ouvir, negociar e construir confiança com clientes, colegas e até com a parte contrária são skills indispensáveis para quem quer crescer profissionalmente.

Recomendo a leitura para quem está começando porque mostra que a capacidade de se comunicar pesa tanto quanto, ou até mais que, o conhecimento técnico na hora de conquistar espaço.$recommendation$,
      null,
      null,
      5
    ),
    ('wagner.armani@bismarchipires.com.br', 'Wagner Armani', 'Societário e Contratos', null, null, null, null, null, null, 6),
    ('renato@bismarchipires.com.br', 'Renato Rossetti', 'Recuperação de Crédito', null, null, null, null, null, null, 7),
    ('felipe@bismarchipires.com.br', 'Felipe Camargo', 'Operações Legais', null, null, null, null, null, null, 8)
)
insert into public.reading_trajectory_recommendations (
  user_id,
  public_name,
  practice_area,
  book_title,
  book_author,
  book_cover_url,
  recommendation_text,
  trajectory_note,
  book_link,
  display_order,
  is_visible
)
select
  u.id,
  seed.public_name,
  seed.practice_area,
  seed.book_title,
  seed.book_author,
  seed.book_cover_url,
  seed.recommendation_text,
  seed.trajectory_note,
  seed.book_link,
  seed.display_order,
  true
from seed
join public.users u on lower(u.email) = lower(seed.email)
on conflict (user_id) do nothing;
