-- Tabela de usuários (sincronizada com app_c009c0e4f1_users_rows)
-- Usada para Solicitante e Área no Sistema de Eficiência de Marketing

CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_name ON users(name);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Adiciona solicitante_id em marketing_requests (execute APÓS criar users e marketing_requests)
-- ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS solicitante_id UUID REFERENCES users(id);
-- CREATE INDEX IF NOT EXISTS idx_marketing_requests_solicitante_id ON marketing_requests(solicitante_id);
