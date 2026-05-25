-- Tipo de conteúdo para vínculo (separado da área jurídica)
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS content_type text;

CREATE INDEX IF NOT EXISTS idx_instagram_posts_content_type ON instagram_posts(content_type);

COMMENT ON COLUMN instagram_posts.content_type IS 'Tipo de conteúdo para vínculo (Post, Reel, Newsletter, etc.)';
