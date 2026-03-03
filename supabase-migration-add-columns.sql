-- Execute este SQL se a tabela marketing_requests JÁ EXISTE
-- Adiciona as colunas solicitante e request_type (alinhadas ao Excel)

ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS solicitante TEXT;
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS request_type TEXT;

CREATE INDEX IF NOT EXISTS idx_marketing_requests_request_type ON marketing_requests(request_type);
