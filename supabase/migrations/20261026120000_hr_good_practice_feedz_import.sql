-- Importação do relatório de feedbacks do Feedz (RH > Boas práticas).
--
-- O RH exporta do Feedz o relatório de feedbacks enviados aos gestores e
-- importa aqui: cada linha é ligada a um registro do módulo e atualiza a
-- visualização (viewed / viewed_on). feedz_key identifica a linha do Feedz
-- (destinatário + data/hora de envio) para a reimportação não duplicar nem
-- precisar adivinhar de novo. A mensagem enviada fica guardada para consulta.

alter table public.hr_good_practice_feedbacks
  add column if not exists feedz_key text,
  add column if not exists feedz_sent_at timestamptz,
  add column if not exists feedz_viewed_at timestamptz,
  add column if not exists feedz_message text,
  add column if not exists feedz_synced_at timestamptz;

create unique index if not exists hr_good_practice_feedbacks_feedz_key_uidx
  on public.hr_good_practice_feedbacks (feedz_key)
  where feedz_key is not null;

create table if not exists public.hr_good_practice_feedz_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  rows_total integer not null default 0,
  rows_linked integer not null default 0,
  rows_updated integer not null default 0,
  rows_unmatched integer not null default 0,
  period_start date,
  period_end date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hr_good_practice_feedz_imports_created_idx
  on public.hr_good_practice_feedz_imports (created_at desc);

alter table public.hr_good_practice_feedz_imports enable row level security;

revoke all on public.hr_good_practice_feedz_imports from anon;
grant select on public.hr_good_practice_feedz_imports to authenticated;
grant select, insert, update, delete on public.hr_good_practice_feedz_imports to service_role;

drop policy if exists "hr reads feedz imports" on public.hr_good_practice_feedz_imports;
create policy "hr reads feedz imports"
on public.hr_good_practice_feedz_imports for select to authenticated
using ((select public.has_hr_access()));
