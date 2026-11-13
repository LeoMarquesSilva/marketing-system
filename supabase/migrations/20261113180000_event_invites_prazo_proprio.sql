-- Confirmação da equipe: prazo próprio de um convite (prorrogação individual).
-- Vale só quando a confirmação do evento está ligada (events.rsvp_closes_at) e só se for mais longo.
ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS rsvp_closes_at timestamptz;

COMMENT ON COLUMN event_invites.rsvp_closes_at IS
  'Prazo próprio para esta pessoa responder (prorrogação individual). Nulo = prazo do evento. Não reabre uma confirmação desligada no evento.';
