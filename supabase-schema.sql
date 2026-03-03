-- Execute este SQL no painel do Supabase (SQL Editor)
-- Tabela: marketing_requests - Sistema de Eficiência de Marketing
-- Estrutura alinhada ao Excel "Solicitações Marketing"

CREATE TABLE marketing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  requesting_area TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  assignee TEXT,
  solicitante TEXT,
  request_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_marketing_requests_status ON marketing_requests(status);
CREATE INDEX idx_marketing_requests_requesting_area ON marketing_requests(requesting_area);
CREATE INDEX idx_marketing_requests_requested_at ON marketing_requests(requested_at);
CREATE INDEX idx_marketing_requests_request_type ON marketing_requests(request_type);

-- RLS (Row Level Security) - habilitar se necessário
ALTER TABLE marketing_requests ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura/escrita (ajustar conforme autenticação)
CREATE POLICY "Allow all for anon" ON marketing_requests FOR ALL USING (true) WITH CHECK (true);

-- Se a tabela já existir, execute apenas o ALTER para adicionar as novas colunas:
-- ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS solicitante TEXT;
-- ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
