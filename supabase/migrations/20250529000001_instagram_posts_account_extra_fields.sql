-- Metricas extras de post (Instagram Media Insights) + campos de perfil da conta.
alter table public.instagram_posts
  add column if not exists media_product_type text,
  add column if not exists follows integer not null default 0,
  add column if not exists profile_visits integer not null default 0,
  add column if not exists reposts integer not null default 0,
  add column if not exists profile_activity integer not null default 0,
  add column if not exists link_clicks integer not null default 0,
  add column if not exists reels_avg_watch_time double precision not null default 0,
  add column if not exists reels_total_watch_time bigint not null default 0;

comment on column public.instagram_posts.media_product_type is 'FEED | REELS | STORY | AD (surface do Meta)';
comment on column public.instagram_posts.follows is 'Seguidores ganhos atribuidos ao post (metric follows)';
comment on column public.instagram_posts.profile_visits is 'Visitas ao perfil geradas pelo post (metric profile_visits)';
comment on column public.instagram_posts.reposts is 'Reposts do post (metric reposts)';
comment on column public.instagram_posts.profile_activity is 'Total de acoes no perfil apos ver o post (metric profile_activity)';
comment on column public.instagram_posts.link_clicks is 'Cliques no link da bio atribuidos ao post (profile_activity bio_link_clicked)';
comment on column public.instagram_posts.reels_avg_watch_time is 'Tempo medio assistido do reel em ms (ig_reels_avg_watch_time)';
comment on column public.instagram_posts.reels_total_watch_time is 'Tempo total assistido do reel em ms (ig_reels_video_view_total_time)';

alter table public.instagram_account_stats
  add column if not exists profile_picture_url text,
  add column if not exists biography text,
  add column if not exists website text,
  add column if not exists follows_count integer,
  add column if not exists name text;
