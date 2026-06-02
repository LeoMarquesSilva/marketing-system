-- Novo fluxo: a validar -> em revisão -> revisor aprovou -> enviado ao MKT.
alter table public.content_roteiros
  drop constraint if exists content_roteiros_status_check;

alter table public.content_roteiros
  add constraint content_roteiros_status_check
  check (status = any (array[
    'aguardando_aprovacao'::text,
    'em_revisao'::text,
    'aprovado_revisor'::text,
    'enviado_mkt'::text,
    'aprovado'::text,
    'rejeitado'::text
  ]));

alter table public.content_roteiros
  add column if not exists reviewer_approved_at timestamptz,
  add column if not exists sent_to_mkt_at timestamptz,
  add column if not exists sent_to_mkt_by_name text,
  add column if not exists marketing_request_id uuid references public.marketing_requests(id) on delete set null;

comment on column public.content_roteiros.marketing_request_id is
  'Card do Planner (marketing_requests) criado quando o post foi enviado ao marketing.';
