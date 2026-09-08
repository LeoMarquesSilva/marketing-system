create index if not exists reading_trajectory_recommendations_created_by_idx
  on public.reading_trajectory_recommendations(created_by);

create index if not exists reading_trajectory_recommendations_updated_by_idx
  on public.reading_trajectory_recommendations(updated_by);
