-- Francisco Zanin fica fora da visão e do controle de férias do RH.
update public.hr_employees
set
  vacation_exempt = true,
  notes = coalesce(nullif(trim(notes), ''), 'Fora do controle de férias'),
  updated_at = now()
where public.normalize_hr_email(email) = public.normalize_hr_email('francisco.zanin@bismarchipires.com.br');
