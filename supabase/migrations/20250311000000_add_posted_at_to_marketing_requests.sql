-- Add posted_at to marketing_requests (date when post was published)
ALTER TABLE marketing_requests
ADD COLUMN IF NOT EXISTS posted_at timestamptz;

COMMENT ON COLUMN marketing_requests.posted_at IS 'Date/time when the post was published (for Post Redes Sociais with completion_type postagem_feita).';
