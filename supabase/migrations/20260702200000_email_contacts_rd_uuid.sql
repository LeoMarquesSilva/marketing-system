-- Vínculo com RD Station Marketing API

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS rd_uuid uuid,
  ADD COLUMN IF NOT EXISTS rd_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_contacts_rd_uuid
  ON email_contacts(rd_uuid)
  WHERE rd_uuid IS NOT NULL;

COMMENT ON COLUMN email_contacts.rd_uuid IS 'UUID do contato no RD Station Marketing';
COMMENT ON COLUMN email_contacts.rd_synced_at IS 'Última sincronização com a API do RD Station';
