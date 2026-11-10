-- BP Awards por hub: cada hub tem as suas 5 premiações do CIVIL e cada
-- colaborador só indica colegas do próprio hub.
--
--   empresarial    → Cível, Trabalhista, Contratos, Recuperação de Crédito e Tributário
--   reestruturacao → Reestruturação (antiga Insolvência)
--   operacoes      → Operações Legais (Ops + controladoria)
--
-- Os sócios patrimoniais (departamento "Sócio") não estão em hub: votam nos
-- três (15 indicações) e não concorrem. O mapa área → hub fica no código
-- (src/lib/rh/bp-awards/types.ts); aqui só a chave do hub em cada indicação
-- e em cada finalista. As tabelas estavam vazias (votação ainda sem datas).

alter table public.hr_award_nominations
  add column if not exists hub text not null default 'empresarial'
  check (hub in ('empresarial', 'reestruturacao', 'operacoes'));
alter table public.hr_award_nominations alter column hub drop default;

alter table public.hr_award_nominations drop constraint if exists hr_award_nominations_ballot_id_category_key;
alter table public.hr_award_nominations
  add constraint hr_award_nominations_ballot_hub_category_key unique (ballot_id, hub, category);

drop index if exists public.hr_award_nominations_edition_idx;
create index if not exists hr_award_nominations_edition_idx
  on public.hr_award_nominations (edition_id, hub, category, nominee_employee_id);

alter table public.hr_award_finalists
  add column if not exists hub text not null default 'empresarial'
  check (hub in ('empresarial', 'reestruturacao', 'operacoes'));
alter table public.hr_award_finalists alter column hub drop default;

alter table public.hr_award_finalists drop constraint if exists hr_award_finalists_edition_id_category_employee_id_key;
alter table public.hr_award_finalists
  add constraint hr_award_finalists_edition_hub_category_employee_key unique (edition_id, hub, category, employee_id);

drop index if exists public.hr_award_finalists_one_winner_idx;
create unique index if not exists hr_award_finalists_one_winner_idx
  on public.hr_award_finalists (edition_id, hub, category)
  where is_winner;
