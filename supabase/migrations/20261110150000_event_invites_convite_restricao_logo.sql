-- Convite pessoal: restrição alimentar por opção (convidado e acompanhante) e logo da empresa.

ALTER TABLE event_invites
  ADD COLUMN IF NOT EXISTS dietary_info jsonb,
  ADD COLUMN IF NOT EXISTS show_company_logo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN event_invites.dietary_info IS
  'Restrição alimentar escolhida no convite pessoal: {"guest":{"restrictions":[],"notes":null},"plusOne":{...}}. O resumo em texto continua em dietary_restrictions.';
COMMENT ON COLUMN event_invites.show_company_logo IS
  'Mostra a logo da empresa do convidado (icp_group_profiles) no convite pessoal.';
