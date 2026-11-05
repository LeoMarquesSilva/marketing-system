-- Vistagem: Hora final do Compromisso (audiência, sessão de julgamento, perícia…). Sem ela o VIOS gravava 00:00
-- (CI 934918: sessão das 09:30 até 00:00). O jurídico escolhe na vistagem; por padrão, 1 hora depois da inicial.
alter table public.vistagem_agendamentos
  add column if not exists hora_fim text
    check (hora_fim is null or hora_fim ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

comment on column public.vistagem_agendamentos.hora_fim is
  'Compromisso: Hora final no VIOS (HH:MM). Null nos antigos e nas outras classes.';
