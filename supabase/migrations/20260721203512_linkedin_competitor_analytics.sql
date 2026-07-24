-- LinkedIn Insights: snapshots recorrentes de benchmarking competitivo.

alter table public.linkedin_imports
  add column if not exists competitor_rows integer not null default 0;

alter table public.linkedin_imports
  drop constraint if exists linkedin_imports_report_type_check;

alter table public.linkedin_imports
  add constraint linkedin_imports_report_type_check
  check (report_type in ('content', 'followers', 'visitors', 'competitors'));

create table if not exists public.linkedin_competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.linkedin_imports(id) on delete cascade,
  page_name text not null,
  new_followers integer not null default 0 check (new_followers >= 0),
  publications integer not null default 0 check (publications >= 0),
  comments integer not null default 0 check (comments >= 0),
  comments_per_day numeric not null default 0 check (comments_per_day >= 0),
  reactions integer not null default 0 check (reactions >= 0),
  period_from date not null,
  period_to date not null,
  captured_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (import_id, page_name),
  check (period_to >= period_from)
);

create index if not exists linkedin_competitor_import_idx
  on public.linkedin_competitor_snapshots (import_id);
create index if not exists linkedin_competitor_period_idx
  on public.linkedin_competitor_snapshots (period_to desc, reactions desc);

alter table public.linkedin_competitor_snapshots enable row level security;

grant select on public.linkedin_competitor_snapshots to authenticated;
grant all on public.linkedin_competitor_snapshots to service_role;
revoke all on public.linkedin_competitor_snapshots from anon;

create policy linkedin_competitor_select_authenticated
  on public.linkedin_competitor_snapshots for select to authenticated using (true);
create policy linkedin_competitor_all_service
  on public.linkedin_competitor_snapshots for all to service_role using (true) with check (true);

comment on table public.linkedin_competitor_snapshots is
  'Benchmark por página concorrente e período, preservado por arquivo importado';
