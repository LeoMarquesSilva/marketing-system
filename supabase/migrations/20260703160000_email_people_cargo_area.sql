-- Campos editáveis pelos gestores de área

ALTER TABLE email_people
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS area text;

COMMENT ON COLUMN email_people.cargo IS 'Cargo/função preenchido pelo gestor da área';
COMMENT ON COLUMN email_people.area IS 'Área de atuação preenchida pelo gestor';
