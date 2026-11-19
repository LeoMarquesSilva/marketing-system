-- Gerador de conteúdo: registra quem descartou cada matéria (antes só ficava "rejeitado", sem autor).
-- Quem escolheu já fica em approved_by_*; com isto a tela de Escolhas mostra as duas decisões.
alter table public.content_roteiros
  add column if not exists rejected_by_id uuid,
  add column if not exists rejected_by_name text,
  add column if not exists rejected_at timestamptz;

comment on column public.content_roteiros.rejected_by_id is 'Quem descartou a matéria (users.id). Limpo quando ela volta para a lista.';
comment on column public.content_roteiros.rejected_at is 'Quando a matéria foi descartada.';
