-- Critério do convite para festa de 10 anos

ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS party_invite_tipo text
    CHECK (
      party_invite_tipo IS NULL
      OR party_invite_tipo IN (
        'estrategico',
        'relacionamento',
        'potencial',
        'historico',
        'institucional'
      )
    );

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS party_invite_tipo text
    CHECK (
      party_invite_tipo IS NULL
      OR party_invite_tipo IN (
        'estrategico',
        'relacionamento',
        'potencial',
        'historico',
        'institucional'
      )
    );

COMMENT ON COLUMN email_people.party_invite_tipo IS
  'Critério do convite para festa de 10 anos (Estratégico, Relacionamento, etc.).';
COMMENT ON COLUMN email_contacts.party_invite_tipo IS
  'Critério do convite para festa de 10 anos (Estratégico, Relacionamento, etc.).';
