-- Créditos: dia trabalhado no recesso / nas férias (devolvem saldo).
alter table public.vacation_leaves drop constraint if exists vacation_leaves_kind_check;

alter table public.vacation_leaves
  add constraint vacation_leaves_kind_check
  check (kind in ('ferias', 'recesso', 'abono', 'trabalho_recesso', 'trabalho_ferias'));

comment on column public.vacation_leaves.kind is
  'ferias/recesso/abono consomem saldo; trabalho_recesso/trabalho_ferias creditam dias de volta.';
