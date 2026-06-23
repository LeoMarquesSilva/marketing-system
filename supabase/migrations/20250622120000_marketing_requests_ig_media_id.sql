-- Vincula solicitações do Planner a posts sincronizados do Instagram
ALTER TABLE marketing_requests
  ADD COLUMN IF NOT EXISTS ig_media_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_requests_ig_media_id
  ON marketing_requests (ig_media_id)
  WHERE ig_media_id IS NOT NULL;

COMMENT ON COLUMN marketing_requests.ig_media_id IS
  'ID do media no Instagram (Meta Graph API) quando importado ou vinculado manualmente.';
