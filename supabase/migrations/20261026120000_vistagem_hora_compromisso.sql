-- Vistagem: o Compromisso (audiência, perícia, sessão…) leva o horário, informado pelo jurídico.
alter table public.vistagem_agendamentos add column if not exists hora text;
alter table public.vistagem_agendamentos drop constraint if exists vistagem_agendamentos_hora_check;
alter table public.vistagem_agendamentos
  add constraint vistagem_agendamentos_hora_check check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
comment on column public.vistagem_agendamentos.hora is
  'COMPROMISSO: horário HH:MM (obrigatório na vistagem). Vai para o VIOS junto com a data.';
