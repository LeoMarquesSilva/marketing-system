-- Mantém o status exibido em Férias alinhado ao botão Ativar/Desativar da
-- administração de usuários.

create or replace function private.sync_user_status_to_hr_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hr_employees
  set is_active = coalesce(new.is_active, true)
  where user_id = new.id
    and is_active is distinct from coalesce(new.is_active, true);

  return new;
end;
$$;

drop trigger if exists users_sync_status_to_hr_employee on public.users;
create trigger users_sync_status_to_hr_employee
after insert or update of is_active
on public.users
for each row execute function private.sync_user_status_to_hr_employee();

-- Corrige divergências existentes, inclusive a de Gabriela Consul.
update public.hr_employees h
set is_active = coalesce(u.is_active, true)
from public.users u
where u.id = h.user_id
  and h.is_active is distinct from coalesce(u.is_active, true);
