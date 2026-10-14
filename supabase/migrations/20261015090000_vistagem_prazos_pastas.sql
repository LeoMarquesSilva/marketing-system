-- Vistagem: prazo com data fatal (contada em dias úteis) e pastas do VIOS com
-- vínculo e auxiliar (do relatório "Processos Lista" no SharePoint da Controladoria).

-- PRAZO: o vistador escolhe a data fatal (ou 5/10/15/30/60/90/180 dias úteis após a
-- publicação); para o VIOS vai a data do protocolo (fatal − 1 dia útil), em "data".
alter table public.vistagem_agendamentos
  add column if not exists data_fatal date,
  add column if not exists dias_prazo integer check (dias_prazo is null or dias_prazo > 0);

comment on column public.vistagem_agendamentos.data_fatal is
  'PRAZO: data fatal. A tarefa vai ao VIOS com a data do protocolo (fatal − 1 dia útil), gravada em data.';
comment on column public.vistagem_agendamentos.dias_prazo is
  'PRAZO: quantidade de dias úteis escolhida nos atalhos (null quando a data fatal foi escolhida no calendário).';

create table if not exists public.vistagem_pastas_vios (
  ci text primary key,
  vinculo text,
  auxiliar_sigla text,
  advogado text,
  atualizado_em timestamptz not null default now()
);

alter table public.vistagem_pastas_vios enable row level security;
revoke all on public.vistagem_pastas_vios from anon, authenticated;
grant select, insert, update, delete on public.vistagem_pastas_vios to service_role;

comment on table public.vistagem_pastas_vios is
  'Espelho diário do "Processos Lista" do VIOS: vínculo (PROCESSO PRINCIPAL/RECURSO/INCIDENTE) e sigla do auxiliar por CI.';
