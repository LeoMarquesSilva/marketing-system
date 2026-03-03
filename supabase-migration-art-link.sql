-- Campo "Link da arte" para o designer informar onde acessar a arte ao enviar para revisão.
-- Preferência: aplicar via MCP Supabase (user-supabase-marketing-system). Senão, executar no SQL Editor do Supabase.

ALTER TABLE marketing_requests
ADD COLUMN IF NOT EXISTS art_link TEXT;

COMMENT ON COLUMN marketing_requests.art_link IS 'Link para acessar a arte (preenchido ao enviar para Revisão)';
