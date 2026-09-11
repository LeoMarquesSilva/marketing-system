do $$
declare
  matching_slots integer;
  unexpected_dates integer;
begin
  select count(*)
  into matching_slots
  from public.content_schedule_slots
  where format = 'reel'
    and source_key in (
      'cronograma-bp-2026:Cível:64',
      'cronograma-bp-2026:Legal Ops:48',
      'cronograma-bp-2026:Reestruturação:63',
      'cronograma-bp-2026:Societário e Contratos:61',
      'cronograma-bp-2026:Trabalhista:69'
    );

  if matching_slots <> 5 then
    raise exception 'Expected 5 September Reel slots, found %', matching_slots;
  end if;

  select count(*)
  into unexpected_dates
  from public.content_schedule_slots
  where format = 'reel'
    and source_key in (
      'cronograma-bp-2026:Cível:64',
      'cronograma-bp-2026:Legal Ops:48',
      'cronograma-bp-2026:Reestruturação:63',
      'cronograma-bp-2026:Societário e Contratos:61',
      'cronograma-bp-2026:Trabalhista:69'
    )
    and due_date not in (date '2026-09-16', date '2026-09-23');

  if unexpected_dates > 0 then
    raise exception 'September Reel slots contain unexpected dates';
  end if;

  update public.content_schedule_slots
  set
    due_date = date '2026-09-23',
    updated_at = now()
  where format = 'reel'
    and due_date = date '2026-09-16'
    and source_key in (
      'cronograma-bp-2026:Cível:64',
      'cronograma-bp-2026:Legal Ops:48',
      'cronograma-bp-2026:Reestruturação:63',
      'cronograma-bp-2026:Societário e Contratos:61',
      'cronograma-bp-2026:Trabalhista:69'
    );
end
$$;
