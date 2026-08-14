-- Nomenclatura visível do uso protegido (slug oficial permanece).

update public.photo_usage_types
set label = 'Foto dos sistemas do escritório'
where slug = 'oficial'
  and label is distinct from 'Foto dos sistemas do escritório';

comment on table public.photo_usage_types is
  'Usos que o colaborador pode marcar (Foto dos sistemas do escritório é sistema; demais o MTK edita).';

create or replace function public.protect_official_photo_usage_type()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_official or old.is_system then
      raise exception 'O uso Foto dos sistemas do escritório não pode ser apagado.';
    end if;
    return old;
  end if;

  if old.is_official or old.is_system then
    if new.is_official is distinct from old.is_official
       or new.is_system is distinct from old.is_system
       or new.is_active = false then
      raise exception 'O uso Foto dos sistemas do escritório não pode ser desativado nem alterado.';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_official_photo_usage_type() is
  'Impede apagar, desativar ou alterar o uso Foto dos sistemas do escritório; a regra protegida não muda.';
