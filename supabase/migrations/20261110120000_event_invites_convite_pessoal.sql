-- Convite pessoal dos clientes (1º uso: festa de 10 anos, /convite/<token>).
-- Cada convidado cliente tem um link próprio, sem login; um remetente do escritório
-- (sócio da área ou sócio patrimonial) envia a mensagem pronta pelo próprio WhatsApp.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guest_rsvp_closes_at timestamptz;

COMMENT ON COLUMN events.guest_rsvp_closes_at IS
  'Prazo da confirmação dos convidados externos pelo link pessoal. Nulo = sem prazo na mensagem.';

ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS invite_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_channel text
    CHECK (sent_channel IS NULL OR sent_channel IN ('whatsapp', 'copia', 'manual')),
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plus_one boolean,
  ADD COLUMN IF NOT EXISTS plus_one_name text;

COMMENT ON COLUMN event_invites.invite_token IS 'Segredo do link pessoal do convite (/convite/<token>).';
COMMENT ON COLUMN event_invites.sender_user_id IS 'Quem do escritório envia o convite a este convidado.';
COMMENT ON COLUMN event_invites.sent_channel IS 'whatsapp (abriu a conversa pelo sistema), copia (copiou a mensagem) ou manual (marcado à mão).';
COMMENT ON COLUMN event_invites.opened_at IS 'Primeira vez que o convidado abriu o link pessoal.';
COMMENT ON COLUMN event_invites.plus_one IS 'O convidado vai levar 1 acompanhante.';

CREATE INDEX IF NOT EXISTS event_invites_sender_idx
  ON event_invites (event_id, sender_user_id)
  WHERE sender_user_id IS NOT NULL;

-- Link pessoal para os clientes já convidados.
UPDATE event_invites
SET invite_token = translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/', '-_')
WHERE guest_type = 'cliente' AND invite_token IS NULL;
