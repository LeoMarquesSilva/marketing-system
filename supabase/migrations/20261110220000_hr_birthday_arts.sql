-- Artes de aniversário (da pessoa e de empresa) que o Marketing sobe para a tela inicial.
-- Uma arte por pessoa, tipo e ano; o arquivo fica em bucket PRIVADO (link assinado).
create table if not exists public.hr_birthday_arts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  kind text not null check (kind in ('aniversario', 'empresa')),
  year integer not null check (year between 2020 and 2100),
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, kind, year)
);

create index if not exists hr_birthday_arts_year_idx on public.hr_birthday_arts (year, kind);

-- Leitura e escrita só pelo servidor (service role): a tela inicial entrega o link assinado.
alter table public.hr_birthday_arts enable row level security;
revoke all on public.hr_birthday_arts from anon, authenticated;
grant select, insert, update, delete on public.hr_birthday_arts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'RH-ANIVERSARIOS',
  'RH-ANIVERSARIOS',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
