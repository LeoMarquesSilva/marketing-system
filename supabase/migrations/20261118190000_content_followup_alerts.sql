-- Gerador de conteúdo: quando a busca acha um desdobramento (fato novo) de um assunto
-- que alguém já postou, avisa essa pessoa para fazer a continuação. Ex.: Lavinia postou
-- sobre a RJ da Casas Bahia em 21/08; o processamento autorizado gera um aviso para ela.
create table if not exists public.content_followup_alerts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  roteiro_id uuid not null references public.content_roteiros(id) on delete cascade,
  ref jsonb not null,
  note text,
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'dispensado')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (recipient_id, roteiro_id)
);

create index if not exists content_followup_alerts_recipient_idx
  on public.content_followup_alerts (recipient_id, status, created_at desc);

alter table public.content_followup_alerts enable row level security;

comment on table public.content_followup_alerts is 'Aviso de desdobramento para quem fez o post original (pendente → feito quando alguém escolhe a matéria, ou dispensado).';
