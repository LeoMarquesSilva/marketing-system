-- Dias em que a Meta não tem o detalhe (ex.: ganhos/perdas antes de 2026) ficam
-- NULOS ("sem dado"), em vez de zero: zero falso distorcia somas e gráficos.
alter table public.instagram_account_insights
  alter column follows drop not null,
  alter column unfollows drop not null,
  alter column reach_followers drop not null,
  alter column reach_non_followers drop not null,
  alter column new_followers drop not null,
  alter column views_reels drop not null,
  alter column views_stories drop not null,
  alter column views_carousel drop not null,
  alter column views_posts drop not null;
