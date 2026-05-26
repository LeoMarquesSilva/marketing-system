-- Collab: múltiplas áreas e autores; institucional pode concluir sem participante
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS solicitantes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS skip_participants boolean NOT NULL DEFAULT false;

UPDATE instagram_posts
SET areas = ARRAY[area]
WHERE area IS NOT NULL
  AND (areas IS NULL OR areas = '{}');

UPDATE instagram_posts
SET solicitantes = jsonb_build_array(
  jsonb_build_object('id', solicitante_id::text, 'name', COALESCE(solicitante, ''))
)
WHERE solicitante_id IS NOT NULL
  AND (solicitantes IS NULL OR solicitantes = '[]'::jsonb);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_areas ON instagram_posts USING GIN (areas);

COMMENT ON COLUMN instagram_posts.areas IS 'Áreas vinculadas ao post (collab suportado)';
COMMENT ON COLUMN instagram_posts.solicitantes IS 'Autores/solicitantes [{id, name}]';
COMMENT ON COLUMN instagram_posts.skip_participants IS 'Institucional concluído sem participante';

-- Posts institucionais já vinculados sem participante permanecem concluídos
UPDATE instagram_posts
SET skip_participants = true
WHERE skip_participants = false
  AND (
    (areas = ARRAY['Institucional']::text[])
    OR (areas = '{}' AND area = 'Institucional')
  )
  AND (
    solicitantes = '[]'::jsonb
    OR solicitantes IS NULL
  )
  AND solicitante_id IS NULL;
