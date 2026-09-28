-- Uma publicação real do Instagram só pode comprovar uma entrega do cronograma.
create unique index if not exists content_schedule_slots_instagram_post_unique
  on public.content_schedule_slots(instagram_post_id)
  where instagram_post_id is not null;
