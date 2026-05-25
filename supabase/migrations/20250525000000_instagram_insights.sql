-- Posts do Instagram sincronizados via Meta Graph API
CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_media_id text UNIQUE NOT NULL,
  caption text,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  area text,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  reach int NOT NULL DEFAULT 0,
  views int NOT NULL DEFAULT 0,
  saves int NOT NULL DEFAULT 0,
  shares int NOT NULL DEFAULT 0,
  total_interactions int NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_instagram_posts_published_at ON instagram_posts(published_at DESC);
CREATE INDEX idx_instagram_posts_area ON instagram_posts(area);

-- Snapshot da conta (atualizado a cada sync)
CREATE TABLE instagram_account_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  followers_count int NOT NULL DEFAULT 0,
  media_count int NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_account_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instagram_posts_select_authenticated" ON instagram_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "instagram_posts_update_authenticated" ON instagram_posts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "instagram_posts_all_service" ON instagram_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "instagram_account_stats_select_authenticated" ON instagram_account_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "instagram_account_stats_all_service" ON instagram_account_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE instagram_posts IS 'Posts do Instagram com métricas e área atribuída';
COMMENT ON TABLE instagram_account_stats IS 'Snapshot das métricas da conta Instagram';
