-- Metricas adicionais de stories disponiveis na Graph API (Instagram Media Insights)
-- views substitui o antigo impressions (descontinuado em 21/04/2025).
alter table public.instagram_stories
  add column if not exists shares integer not null default 0,
  add column if not exists total_interactions integer not null default 0,
  add column if not exists follows integer not null default 0,
  add column if not exists profile_visits integer not null default 0,
  add column if not exists nav_taps_forward integer not null default 0,
  add column if not exists nav_taps_back integer not null default 0,
  add column if not exists nav_exits integer not null default 0,
  add column if not exists nav_swipe_forward integer not null default 0;

comment on column public.instagram_stories.shares is 'Compartilhamentos do story (metric shares)';
comment on column public.instagram_stories.total_interactions is 'Total de interacoes do story (metric total_interactions)';
comment on column public.instagram_stories.follows is 'Seguidores ganhos pelo story (metric follows)';
comment on column public.instagram_stories.profile_visits is 'Visitas ao perfil pelo story (metric profile_visits)';
comment on column public.instagram_stories.nav_taps_forward is 'navigation breakdown TAP_FORWARD';
comment on column public.instagram_stories.nav_taps_back is 'navigation breakdown TAP_BACK';
comment on column public.instagram_stories.nav_exits is 'navigation breakdown TAP_EXIT';
comment on column public.instagram_stories.nav_swipe_forward is 'navigation breakdown SWIPE_FORWARD (next story)';
