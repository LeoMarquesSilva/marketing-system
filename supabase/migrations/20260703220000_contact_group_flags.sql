-- Contatos por grupo + flags NPS / festa (substituem is_socio na UI)

ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS nps_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS party_invite boolean NOT NULL DEFAULT false;

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS nps_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS party_invite boolean NOT NULL DEFAULT false;

-- Quem era marcado como sócio/decisor vira convite festa (melhor aproximação)
UPDATE email_people SET party_invite = true WHERE is_socio = true AND party_invite = false;
UPDATE email_contacts SET party_invite = true WHERE is_socio = true AND party_invite = false;

-- Vincula contatos existentes ao grupo da empresa (deixam de ser por empresa)
UPDATE email_contacts c
SET client_group_id = co.client_group_id
FROM email_companies co
WHERE c.company_id = co.id
  AND c.client_group_id IS NULL
  AND co.client_group_id IS NOT NULL;

COMMENT ON COLUMN email_people.nps_eligible IS 'Gestor marcou: elegível ao NPS';
COMMENT ON COLUMN email_people.party_invite IS 'Gestor marcou: convidar para festa de 10 anos';
COMMENT ON COLUMN email_contacts.nps_eligible IS 'Gestor marcou: elegível ao NPS';
COMMENT ON COLUMN email_contacts.party_invite IS 'Gestor marcou: convidar para festa de 10 anos';
