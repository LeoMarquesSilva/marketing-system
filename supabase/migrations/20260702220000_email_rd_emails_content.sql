-- Conteúdo migrado do editor Bee (RD Station)

ALTER TABLE email_rd_emails
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS html_body text,
  ADD COLUMN IF NOT EXISTS editor_json jsonb;

COMMENT ON COLUMN email_rd_emails.subject IS 'Assunto extraído do JSON do editor Bee';
COMMENT ON COLUMN email_rd_emails.html_body IS 'HTML renderizado a partir do JSON Bee (migração RD)';
COMMENT ON COLUMN email_rd_emails.editor_json IS 'JSON original do editor Bee (backup)';
