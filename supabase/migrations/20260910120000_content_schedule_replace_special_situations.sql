delete from public.content_schedule_slots
where area = 'Special Situations';

insert into public.content_schedule_slots (
  area,
  due_date,
  format,
  collaborator_id,
  source_key
)
values
  ('Recuperação de Crédito', '2026-10-09', 'post', null, 'recovery-credit-2026:2026-10-09:post'),
  ('Recuperação de Crédito', '2026-10-14', 'reel', null, 'recovery-credit-2026:2026-10-14:reel'),
  ('Recuperação de Crédito', '2026-10-21', 'post', null, 'recovery-credit-2026:2026-10-21:post'),
  ('Recuperação de Crédito', '2026-11-11', 'post', null, 'recovery-credit-2026:2026-11-11:post'),
  ('Recuperação de Crédito', '2026-11-11', 'reel', null, 'recovery-credit-2026:2026-11-11:reel'),
  ('Recuperação de Crédito', '2026-11-19', 'post', null, 'recovery-credit-2026:2026-11-19:post'),
  ('Recuperação de Crédito', '2026-12-10', 'post', null, 'recovery-credit-2026:2026-12-10:post'),
  ('Recuperação de Crédito', '2026-12-16', 'post', null, 'recovery-credit-2026:2026-12-16:post'),
  ('Recuperação de Crédito', '2026-12-16', 'reel', null, 'recovery-credit-2026:2026-12-16:reel')
on conflict (source_key) do nothing;
