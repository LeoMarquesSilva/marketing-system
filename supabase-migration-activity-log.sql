-- Activity log table for auditing workflow_stage changes
create table if not exists public.request_activity_log (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.marketing_requests(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  user_name    text,
  action       text not null, -- 'stage_changed', 'status_changed', 'assigned', etc.
  from_value   text,
  to_value     text,
  created_at   timestamptz not null default now()
);

-- Index for fast lookup by request
create index if not exists idx_activity_log_request_id on public.request_activity_log(request_id);

-- Enable RLS
alter table public.request_activity_log enable row level security;

-- All authenticated users can read logs for requests they can see
create policy "Users can read activity logs"
  on public.request_activity_log
  for select
  to authenticated
  using (true);

-- Only authenticated users can insert
create policy "Authenticated users can insert activity logs"
  on public.request_activity_log
  for insert
  to authenticated
  with check (true);
