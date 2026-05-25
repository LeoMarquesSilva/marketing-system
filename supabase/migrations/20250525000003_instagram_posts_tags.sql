-- Tags automáticas e manuais nos posts do Instagram
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_instagram_posts_tags ON instagram_posts USING GIN (tags);

COMMENT ON COLUMN instagram_posts.tags IS 'Tags automáticas (ex: Newsletter) e manuais';
