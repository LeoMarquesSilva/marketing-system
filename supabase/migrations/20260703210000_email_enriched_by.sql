-- Rastreia qual usuário (gestor) preencheu/ajustou cada contato ou pessoa.

ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS enriched_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS enriched_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_people_enriched_by ON email_people(enriched_by_user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_enriched_by ON email_contacts(enriched_by_user_id);

COMMENT ON COLUMN email_people.enriched_by_user_id IS 'Usuário que preencheu/ajustou os dados desta pessoa (Meus Clientes).';
COMMENT ON COLUMN email_contacts.enriched_by_user_id IS 'Usuário que preencheu/ajustou os dados deste contato (Meus Clientes).';
