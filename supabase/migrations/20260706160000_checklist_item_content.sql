-- Conteúdo salvo por item de checklist (legenda, capa, mensagem do grupo)

ALTER TABLE marketing_request_checklist_items
  ADD COLUMN IF NOT EXISTS content text;

COMMENT ON COLUMN marketing_request_checklist_items.content IS
  'Conteúdo do item (legenda, link da capa, mensagem do grupo, etc.).';
