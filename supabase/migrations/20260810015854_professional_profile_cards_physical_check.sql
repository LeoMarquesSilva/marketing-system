-- Confirmação de que a etiqueta NFC foi fisicamente gravada.
--
-- Independente do status digital do cartão (pending/active/inactive/replaced,
-- que controla se o toque redireciona): aqui é só um checklist manual do
-- administrador para acompanhar a produção física das etiquetas.

alter table public.professional_profile_cards
  add column if not exists physically_activated_at timestamptz;

create index if not exists professional_profile_cards_physically_activated_idx
  on public.professional_profile_cards(physically_activated_at);
