-- Índices para as chaves estrangeiras do módulo LinkedIn Insights.
create index if not exists linkedin_daily_metrics_source_import_idx
  on public.linkedin_daily_metrics (source_import_id);
create index if not exists linkedin_imports_imported_by_idx
  on public.linkedin_imports (imported_by);
create index if not exists linkedin_post_snapshots_import_idx
  on public.linkedin_post_snapshots (import_id);
create index if not exists linkedin_posts_latest_import_idx
  on public.linkedin_posts (latest_import_id);
