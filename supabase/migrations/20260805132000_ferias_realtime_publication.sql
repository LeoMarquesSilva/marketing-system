-- Habilita Realtime nas tabelas do módulo de Férias.
alter publication supabase_realtime add table public.hr_employees;
alter publication supabase_realtime add table public.vacation_periods;
alter publication supabase_realtime add table public.vacation_leaves;
alter publication supabase_realtime add table public.company_recess;
alter publication supabase_realtime add table public.hr_vios_employees;
