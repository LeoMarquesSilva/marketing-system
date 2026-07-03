-- Módulo de Organização de Eventos

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  name text NOT NULL,
  month_label text,
  commemorative_date date,
  event_date date,
  gifts_notes text,
  organization_team text,
  status text NOT NULL DEFAULT 'nao_iniciada'
    CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida', 'cancelada')),
  objectives text,
  budget_planned numeric(12, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, name)
);

CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

CREATE TABLE IF NOT EXISTS event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  phase text CHECK (phase IS NULL OR phase IN ('pre_evento', 'dia_evento', 'pos_evento')),
  sort_order int NOT NULL DEFAULT 0,
  marketing_request_id uuid REFERENCES marketing_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_assignee_id ON event_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_due_date ON event_tasks(due_date);

CREATE TABLE IF NOT EXISTS event_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'outros',
  description text,
  vendor_name text,
  amount_planned numeric(12, 2) NOT NULL DEFAULT 0,
  amount_actual numeric(12, 2),
  payment_status text NOT NULL DEFAULT 'pendente'
    CHECK (payment_status IN ('pendente', 'parcial', 'pago')),
  due_date date,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_event_id ON event_budget_items(event_id);

CREATE OR REPLACE FUNCTION trg_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_updated_at();

DROP TRIGGER IF EXISTS trg_event_tasks_updated_at ON event_tasks;
CREATE TRIGGER trg_event_tasks_updated_at
  BEFORE UPDATE ON event_tasks
  FOR EACH ROW EXECUTE FUNCTION trg_events_updated_at();

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler events"
  ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir events"
  ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar events"
  ON events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar events"
  ON events FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_tasks"
  ON event_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_tasks"
  ON event_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_tasks"
  ON event_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_tasks"
  ON event_tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ler event_budget_items"
  ON event_budget_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem inserir event_budget_items"
  ON event_budget_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar event_budget_items"
  ON event_budget_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem deletar event_budget_items"
  ON event_budget_items FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE events IS 'Instâncias anuais de eventos institucionais BP';
COMMENT ON TABLE event_tasks IS 'Tarefas por evento com responsável e vínculo opcional ao Planner';
COMMENT ON TABLE event_budget_items IS 'Linhas de orçamento por evento';
