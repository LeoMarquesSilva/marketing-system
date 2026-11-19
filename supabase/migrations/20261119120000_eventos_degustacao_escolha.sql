-- Degustação de drinks: proposta para a escolha final (ex.: o sócio escolhe os drinks da festa).

ALTER TABLE event_tasting_drinks
  ADD COLUMN IF NOT EXISTS is_volante boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chosen_at timestamptz,
  ADD COLUMN IF NOT EXISTS chosen_by uuid;

COMMENT ON COLUMN event_tasting_drinks.is_volante IS 'Drink volante (servido circulando, fora dos drinks do bar).';
COMMENT ON COLUMN event_tasting_drinks.included IS 'Já incluso no combinado com a casa (não conta entre os drinks à escolha).';
COMMENT ON COLUMN event_tasting_drinks.chosen_at IS 'Escolhido para a festa na página de proposta (null = não escolhido).';
COMMENT ON COLUMN event_tasting_drinks.chosen_by IS 'Quem escolheu (users.id).';

ALTER TABLE event_tastings
  ADD COLUMN IF NOT EXISTS highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS choice_limit integer;

COMMENT ON COLUMN event_tastings.highlights IS 'Pontos fortes da casa, mostrados na proposta (lista de textos).';
COMMENT ON COLUMN event_tastings.choice_limit IS 'Quantos drinks entram à escolha (ex.: 4), além dos já inclusos.';
