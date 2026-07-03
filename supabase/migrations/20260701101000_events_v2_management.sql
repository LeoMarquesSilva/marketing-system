-- Evolução do módulo de eventos para gestão completa (faseada)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_size text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS requesting_area text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS participants_expected int,
  ADD COLUMN IF NOT EXISTS participants_actual int,
  ADD COLUMN IF NOT EXISTS stage_status text NOT NULL DEFAULT 'ideia_cadastrada'
    CHECK (
      stage_status IN (
        'ideia_cadastrada',
        'em_validacao',
        'aprovado',
        'orcando',
        'em_producao',
        'em_comunicacao',
        'pronto_para_execucao',
        'realizado',
        'pos_evento',
        'arquivado'
      )
    ),
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'baixo'
    CHECK (risk_level IN ('baixo', 'medio', 'alto'));

ALTER TABLE event_budget_items
  ADD COLUMN IF NOT EXISTS amount_quoted numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS payment_paid_date date,
  ADD COLUMN IF NOT EXISTS invoice_link text,
  ADD COLUMN IF NOT EXISTS receipt_link text,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS event_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'outros',
  contact_name text,
  phone text,
  email text,
  rating numeric(3, 2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_suppliers_category ON event_suppliers(category);
CREATE INDEX IF NOT EXISTS idx_event_suppliers_active ON event_suppliers(active);

CREATE TABLE IF NOT EXISTS event_supplier_event_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES event_suppliers(id) ON DELETE CASCADE,
  role_label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_usage_event_id ON event_supplier_event_usage(event_id);
CREATE INDEX IF NOT EXISTS idx_supplier_usage_supplier_id ON event_supplier_event_usage(supplier_id);

CREATE TABLE IF NOT EXISTS event_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES event_suppliers(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'outros',
  quoted_value numeric(12, 2),
  final_value numeric(12, 2),
  included_items text,
  proposal_status text NOT NULL DEFAULT 'pendente'
    CHECK (proposal_status IN ('pendente', 'aprovada', 'descartada')),
  attached_file_link text,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_supplier_quotes_event_id ON event_supplier_quotes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_supplier_quotes_status ON event_supplier_quotes(proposal_status);

CREATE TABLE IF NOT EXISTS event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  guest_type text NOT NULL DEFAULT 'convidado_externo'
    CHECK (guest_type IN ('colaborador', 'cliente', 'prospect', 'parceiro', 'convidado_externo')),
  invite_status text NOT NULL DEFAULT 'nao_enviado'
    CHECK (invite_status IN ('nao_enviado', 'enviado', 'erro_envio')),
  confirmation_status text NOT NULL DEFAULT 'sem_resposta'
    CHECK (confirmation_status IN ('sem_resposta', 'confirmado', 'recusado')),
  attended boolean,
  dietary_restrictions text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_guest_type ON event_invites(guest_type);

CREATE TABLE IF NOT EXISTS event_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel text NOT NULL
    CHECK (channel IN ('feedz', 'whatsapp', 'email', 'linkedin', 'instagram', 'convite_impresso', 'outro')),
  title text NOT NULL,
  content text,
  responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  planned_date date,
  published_date date,
  status text NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada', 'em_producao', 'publicada', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_communications_event_id ON event_communications(event_id);
CREATE INDEX IF NOT EXISTS idx_event_communications_status ON event_communications(status);

CREATE TABLE IF NOT EXISTS event_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  related_entity text,
  related_id uuid,
  file_type text NOT NULL DEFAULT 'arquivo_geral',
  title text NOT NULL,
  url text NOT NULL,
  storage_path text,
  provider text NOT NULL DEFAULT 'external_link',
  uploaded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id ON event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_related ON event_attachments(related_entity, related_id);

CREATE TABLE IF NOT EXISTS event_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  what_worked text,
  what_failed text,
  improvements text,
  overall_rating int CHECK (overall_rating IS NULL OR (overall_rating >= 0 AND overall_rating <= 10)),
  nps int CHECK (nps IS NULL OR (nps >= -100 AND nps <= 100)),
  participants_expected int,
  participants_actual int,
  cost_per_participant numeric(12, 2),
  reuse_supplier_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_label text NOT NULL,
  payload jsonb,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_event_history_created_at ON event_history(created_at DESC);

CREATE TABLE IF NOT EXISTS event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES event_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  offset_days int NOT NULL DEFAULT 0,
  phase text CHECK (phase IN ('pre_evento', 'dia_evento', 'pos_evento')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_template_tasks_template_id ON event_template_tasks(template_id);

ALTER TABLE event_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_supplier_event_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler event_suppliers"
  ON event_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_suppliers"
  ON event_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_suppliers"
  ON event_suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_suppliers"
  ON event_suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_supplier_event_usage"
  ON event_supplier_event_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_supplier_event_usage"
  ON event_supplier_event_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_supplier_event_usage"
  ON event_supplier_event_usage FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_supplier_event_usage"
  ON event_supplier_event_usage FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_supplier_quotes"
  ON event_supplier_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_supplier_quotes"
  ON event_supplier_quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_supplier_quotes"
  ON event_supplier_quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_supplier_quotes"
  ON event_supplier_quotes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_invites"
  ON event_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_invites"
  ON event_invites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_invites"
  ON event_invites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_invites"
  ON event_invites FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_communications"
  ON event_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_communications"
  ON event_communications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_communications"
  ON event_communications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_communications"
  ON event_communications FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_attachments"
  ON event_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_attachments"
  ON event_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_attachments"
  ON event_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_attachments"
  ON event_attachments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_postmortems"
  ON event_postmortems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_postmortems"
  ON event_postmortems FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_postmortems"
  ON event_postmortems FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_postmortems"
  ON event_postmortems FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_history"
  ON event_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_history"
  ON event_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_history"
  ON event_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_history"
  ON event_history FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_templates"
  ON event_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_templates"
  ON event_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_templates"
  ON event_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_templates"
  ON event_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_template_tasks"
  ON event_template_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_template_tasks"
  ON event_template_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_template_tasks"
  ON event_template_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_template_tasks"
  ON event_template_tasks FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE event_suppliers IS 'Cadastro central de fornecedores para eventos';
COMMENT ON TABLE event_supplier_quotes IS 'Comparativo de propostas e orçamentos por evento';
COMMENT ON TABLE event_invites IS 'Convidados e confirmação de presença por evento';
COMMENT ON TABLE event_communications IS 'Plano e execução de comunicação de eventos';
COMMENT ON TABLE event_attachments IS 'Links de anexos de eventos (preparado para storage futuro)';
COMMENT ON TABLE event_postmortems IS 'Lições aprendidas e indicadores pós-evento';
COMMENT ON TABLE event_history IS 'Histórico funcional de ações do evento';
COMMENT ON TABLE event_templates IS 'Templates de eventos para geração de tarefas padrão';
COMMENT ON TABLE event_template_tasks IS 'Tarefas padrão de template com prazo relativo';
