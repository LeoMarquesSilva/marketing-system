-- Classificação NPS/Festa separada do enriquecimento geral (cargo, telefone, etc.)

ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS invites_classified_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS invites_classified_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_people_invites_classified_by
  ON email_people(invites_classified_by_user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_invites_classified_by
  ON email_contacts(invites_classified_by_user_id);

-- Quem já marcou NPS ou Festa antes desta coluna: considerar classificado
UPDATE email_people
SET invites_classified_by_user_id = enriched_by_user_id
WHERE invites_classified_by_user_id IS NULL
  AND enriched_by_user_id IS NOT NULL
  AND (nps_eligible OR party_invite);

UPDATE email_contacts
SET invites_classified_by_user_id = enriched_by_user_id
WHERE invites_classified_by_user_id IS NULL
  AND enriched_by_user_id IS NOT NULL
  AND (nps_eligible OR party_invite);

COMMENT ON COLUMN email_people.invites_classified_by_user_id IS 'Gestor confirmou classificação NPS/Festa (Meus Clientes).';
COMMENT ON COLUMN email_contacts.invites_classified_by_user_id IS 'Gestor confirmou classificação NPS/Festa (Meus Clientes).';
