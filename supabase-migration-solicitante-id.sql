-- Execute APÓS criar a tabela users e popular com dados
-- Adiciona a coluna solicitante_id em marketing_requests para vincular ao usuário

ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS solicitante_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_marketing_requests_solicitante_id ON marketing_requests(solicitante_id);
