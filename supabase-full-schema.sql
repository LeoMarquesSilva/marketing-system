-- Schema completo: Sistema de Eficiência de Marketing
-- Tipos padronizados + marketing_requests + users

-- 1. Tabela de tipos de solicitação (padrão para select)
CREATE TABLE request_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "order" INT DEFAULT 0
);

INSERT INTO request_types (name, "order") VALUES
  ('Comunicado', 1),
  ('PPT', 2),
  ('Post Redes Sociais', 3),
  ('Aplicação de Identidade', 4),
  ('Certificados', 5),
  ('E-book', 6),
  ('Identidade Visual', 7),
  ('Newsletter', 8),
  ('Material Impresso', 9),
  ('Relatório', 10),
  ('Apresentação', 11);

-- 2. Tabela de usuários
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
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabela de solicitações
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
  solicitante_id UUID REFERENCES users(id),
  request_type TEXT NOT NULL CHECK (request_type IN (
    'Comunicado', 'PPT', 'Post Redes Sociais', 'Aplicação de Identidade',
    'Certificados', 'E-book', 'Identidade Visual', 'Newsletter',
    'Material Impresso', 'Relatório', 'Apresentação'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketing_requests_status ON marketing_requests(status);
CREATE INDEX idx_marketing_requests_requesting_area ON marketing_requests(requesting_area);
CREATE INDEX idx_marketing_requests_requested_at ON marketing_requests(requested_at);
CREATE INDEX idx_marketing_requests_request_type ON marketing_requests(request_type);
CREATE INDEX idx_marketing_requests_solicitante_id ON marketing_requests(solicitante_id);

ALTER TABLE marketing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for marketing_requests" ON marketing_requests FOR ALL USING (true) WITH CHECK (true);
