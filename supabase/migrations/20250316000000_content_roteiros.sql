-- content_topics: temas RSS configuráveis
CREATE TABLE content_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rss_query text NOT NULL,
  legal_area text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- content_roteiros: roteiros gerados a partir de notícias
CREATE TABLE content_roteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  link text,
  content_snippet text,
  area text NOT NULL,
  post text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_aprovacao' CHECK (status IN ('aguardando_aprovacao', 'aprovado', 'rejeitado')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_roteiros_topic_id ON content_roteiros(topic_id);
CREATE INDEX idx_content_roteiros_status ON content_roteiros(status);
CREATE INDEX idx_content_roteiros_created_at ON content_roteiros(created_at DESC);

-- RLS
ALTER TABLE content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_roteiros ENABLE ROW LEVEL SECURITY;

-- Leitura para usuários autenticados
CREATE POLICY "content_topics_select_authenticated" ON content_topics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "content_roteiros_select_authenticated" ON content_roteiros
  FOR SELECT TO authenticated USING (true);

-- Escrita via service role (API usa service role)
CREATE POLICY "content_topics_all_service" ON content_topics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "content_roteiros_all_service" ON content_roteiros
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin pode atualizar status dos roteiros (PATCH)
CREATE POLICY "content_roteiros_update_authenticated" ON content_roteiros
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE content_topics IS 'Temas RSS configuráveis para busca de notícias';
COMMENT ON TABLE content_roteiros IS 'Roteiros de carrossel gerados a partir de notícias';
