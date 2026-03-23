-- Adiciona meses e limite configuráveis por tema
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS months_back integer NOT NULL DEFAULT 4;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS item_limit integer NOT NULL DEFAULT 20;
COMMENT ON COLUMN content_topics.months_back IS 'Meses para trás na busca de notícias (1-12)';
COMMENT ON COLUMN content_topics.item_limit IS 'Quantidade máxima de notícias a processar por execução';
