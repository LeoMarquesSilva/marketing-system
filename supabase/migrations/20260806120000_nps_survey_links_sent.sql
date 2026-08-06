-- Track first "NPS enviado" mark per survey link (campaign + group).
alter table public.nps_survey_links
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by_user_id uuid references public.users(id) on delete set null;

create index if not exists nps_survey_links_sent_at_idx
  on public.nps_survey_links(sent_at)
  where sent_at is not null;

create index if not exists nps_survey_links_campaign_sent_idx
  on public.nps_survey_links(campaign_id)
  where sent_at is not null;
