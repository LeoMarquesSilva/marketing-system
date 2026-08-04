-- Nota de relevância para boletim (1–5), atribuída pelo sócio/revisor ao
-- avaliar se a notícia merece entrar no informativo da área.

ALTER TABLE public.content_roteiros
  ADD COLUMN IF NOT EXISTS boletim_score smallint
    CHECK (boletim_score IS NULL OR (boletim_score BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS boletim_scored_by_name text,
  ADD COLUMN IF NOT EXISTS boletim_scored_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_content_roteiros_boletim_score
  ON public.content_roteiros (area, boletim_score DESC NULLS LAST, published_at DESC);
