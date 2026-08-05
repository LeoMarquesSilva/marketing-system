-- Impede o mesmo intervalo de recesso duas vezes no mesmo colaborador.
create unique index if not exists vacation_leaves_recesso_range_uidx
  on public.vacation_leaves (employee_id, start_date, end_date)
  where kind = 'recesso';

comment on index public.vacation_leaves_recesso_range_uidx is
  'Evita duplicar o mesmo intervalo de recesso para o mesmo colaborador.';
