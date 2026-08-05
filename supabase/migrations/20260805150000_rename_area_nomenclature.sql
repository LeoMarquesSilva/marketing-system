-- Nomenclatura oficial de áreas:
--   Insolvência → Reestruturação
--   Contratos → Societário e Contratos

-- ---------------------------------------------------------------------------
-- email_area_managers (evitar duplicata user_id + area após rename)
-- ---------------------------------------------------------------------------
-- Colapsa aliases legados que viram o mesmo nome canônico.
delete from public.email_area_managers eam
where eam.area in ('Cível | Insolvência', 'Reestruturação (Insolvência)')
  and exists (
    select 1
    from public.email_area_managers x
    where x.user_id = eam.user_id
      and x.area in ('Insolvência', 'Reestruturação')
  );

delete from public.email_area_managers eam
where eam.area = 'Insolvência'
  and exists (
    select 1
    from public.email_area_managers x
    where x.user_id = eam.user_id
      and x.area = 'Reestruturação'
  );

update public.email_area_managers
set area = 'Reestruturação'
where area in ('Insolvência', 'Cível | Insolvência', 'Reestruturação (Insolvência)');

delete from public.email_area_managers eam
where eam.area = 'Societário e Contrato'
  and exists (
    select 1
    from public.email_area_managers x
    where x.user_id = eam.user_id
      and x.area in ('Contratos', 'Societário e Contratos')
  );

delete from public.email_area_managers eam
where eam.area = 'Contratos'
  and exists (
    select 1
    from public.email_area_managers x
    where x.user_id = eam.user_id
      and x.area = 'Societário e Contratos'
  );

update public.email_area_managers
set area = 'Societário e Contratos'
where area in ('Contratos', 'Societário e Contrato');

-- ---------------------------------------------------------------------------
-- legal_areas em grupos / empresas
-- ---------------------------------------------------------------------------
update public.email_client_groups
set legal_areas = (
  select coalesce(array_agg(distinct new_area order by new_area), '{}'::text[])
  from unnest(legal_areas) as old_area
  cross join lateral (
    select case
      when old_area in ('Insolvência', 'Cível | Insolvência', 'Reestruturação (Insolvência)')
        then 'Reestruturação'
      when old_area in ('Contratos', 'Societário e Contrato')
        then 'Societário e Contratos'
      else old_area
    end as new_area
  ) mapped
)
where legal_areas && array[
  'Insolvência',
  'Cível | Insolvência',
  'Reestruturação (Insolvência)',
  'Contratos',
  'Societário e Contrato'
]::text[];

update public.email_companies
set legal_areas = (
  select coalesce(array_agg(distinct new_area order by new_area), '{}'::text[])
  from unnest(legal_areas) as old_area
  cross join lateral (
    select case
      when old_area in ('Insolvência', 'Cível | Insolvência', 'Reestruturação (Insolvência)')
        then 'Reestruturação'
      when old_area in ('Contratos', 'Societário e Contrato')
        then 'Societário e Contratos'
      else old_area
    end as new_area
  ) mapped
)
where legal_areas is not null
  and legal_areas && array[
    'Insolvência',
    'Cível | Insolvência',
    'Reestruturação (Insolvência)',
    'Contratos',
    'Societário e Contrato'
  ]::text[];

-- ---------------------------------------------------------------------------
-- Usuários / cadastros de área
-- ---------------------------------------------------------------------------
update public.users
set department = 'Reestruturação'
where department in ('Insolvência', 'Reestruturação (Insolvência)');

update public.users
set department = 'Societário e Contratos'
where department in ('Contratos', 'Societário e Contrato');

update public.areas
set name = 'Reestruturação'
where name in ('Insolvência', 'Reestruturação (Insolvência)')
  and not exists (select 1 from public.areas a2 where a2.name = 'Reestruturação');

update public.areas
set name = 'Societário e Contratos'
where name in ('Contratos', 'Societário e Contrato')
  and not exists (select 1 from public.areas a2 where a2.name = 'Societário e Contratos');

delete from public.areas
where name in (
  'Insolvência',
  'Reestruturação (Insolvência)',
  'Contratos',
  'Societário e Contrato'
);

-- ---------------------------------------------------------------------------
-- Conteúdo
-- ---------------------------------------------------------------------------
update public.content_roteiros
set area = 'Reestruturação'
where area in ('Insolvência', 'Reestruturação (Insolvência)');

update public.content_roteiros
set area = 'Societário e Contratos'
where area in ('Contratos', 'Societário e Contrato');

update public.content_topics
set legal_area = 'Reestruturação'
where legal_area in ('Insolvência', 'Reestruturação (Insolvência)');

update public.content_topics
set legal_area = 'Societário e Contratos'
where legal_area in ('Contratos', 'Societário e Contrato');

update public.content_newsletters
set area = 'Reestruturação'
where area in ('Insolvência', 'Reestruturação (Insolvência)');

update public.content_newsletters
set area = 'Societário e Contratos'
where area in ('Contratos', 'Societário e Contrato');

-- Pessoas SIOE com área avulsa
update public.email_people
set area = 'Reestruturação'
where area in ('Insolvência', 'Cível | Insolvência', 'Reestruturação (Insolvência)');

update public.email_people
set area = 'Societário e Contratos'
where area in ('Contratos', 'Societário e Contrato');

-- Férias / RH
update public.hr_employees
set department = 'Reestruturação'
where department in ('Insolvência', 'Reestruturação (Insolvência)');

update public.hr_employees
set department = 'Societário e Contratos'
where department in ('Contratos', 'Societário e Contrato');
