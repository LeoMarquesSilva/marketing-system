-- Adiciona solicitante aos posts do Instagram
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS solicitante text;

CREATE INDEX IF NOT EXISTS idx_instagram_posts_solicitante_id ON instagram_posts(solicitante_id);

COMMENT ON COLUMN instagram_posts.solicitante_id IS 'Usuário solicitante responsável pelo post';
COMMENT ON COLUMN instagram_posts.solicitante IS 'Nome do solicitante (desnormalizado)';
