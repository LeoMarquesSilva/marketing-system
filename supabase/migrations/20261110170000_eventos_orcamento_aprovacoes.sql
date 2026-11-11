-- Eventos: orçamento separado por quem cuida, pontos de atenção, pagamentos e aprovações.

-- Linha do orçamento: quem cuida (pacote da produtora ou o escritório, direto), situação e ponto de atenção.
ALTER TABLE event_budget_items
  ADD COLUMN IF NOT EXISTS managed_by text NOT NULL DEFAULT 'escritorio'
    CHECK (managed_by IN ('produtora', 'escritorio')),
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'aprovado'
    CHECK (approval_status IN ('em_analise', 'aprovado', 'descartado')),
  ADD COLUMN IF NOT EXISTS attention_note text;

COMMENT ON COLUMN event_budget_items.managed_by IS
  'produtora = vem no pacote da produtora do evento (ela contrata e coordena); escritorio = contratamos direto.';
COMMENT ON COLUMN event_budget_items.approval_status IS
  'em_analise = cotado, aguardando aprovação; aprovado = entra no comprometido; descartado = não vamos fazer.';
COMMENT ON COLUMN event_budget_items.attention_note IS
  'Ponto de atenção curto, mostrado em destaque no orçamento (ex.: entrega depois do evento).';

-- Despesa cobrada por veículo (transporte): o custo sobe em degraus, conforme a lotação.
ALTER TABLE event_budget_items
  ADD COLUMN IF NOT EXISTS unit_amount numeric(12, 2) CHECK (unit_amount IS NULL OR unit_amount >= 0),
  ADD COLUMN IF NOT EXISTS unit_seats integer CHECK (unit_seats IS NULL OR unit_seats > 0);

COMMENT ON COLUMN event_budget_items.unit_amount IS
  'Valor de cada veículo. Com unit_seats, o orçamento calcula quantos veículos os pedidos de transporte exigem.';
COMMENT ON COLUMN event_budget_items.unit_seats IS
  'Quantas pessoas cada veículo leva.';

-- Calendário de pagamentos do evento (parcelas do pacote, sinais, extras).
CREATE TABLE IF NOT EXISTS event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_name text,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  due_date date,
  paid boolean NOT NULL DEFAULT false,
  paid_date date,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_payments_event_idx ON event_payments (event_id, due_date);

-- Aprovações: o que precisa de decisão, de quem, e o que foi decidido.
CREATE TABLE IF NOT EXISTS event_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  context text,
  approver_name text NOT NULL,
  approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'ajustar', 'reprovado')),
  decision_note text,
  decided_on date,
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES event_tasks(id) ON DELETE SET NULL,
  amount numeric(12, 2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_approvals_event_idx ON event_approvals (event_id, status);

COMMENT ON COLUMN event_approvals.status IS
  'pendente; aprovado; ajustar = aprovado com ajuste; reprovado = não segue.';
COMMENT ON COLUMN event_approvals.task_id IS
  'Tarefa do checklist com o detalhe e os anexos (as imagens aparecem no cartão da aprovação).';

-- Atalho do cartão: tela do sistema ("/convites-festa") ou endereço https, com o texto do botão.
ALTER TABLE event_approvals
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_label text;

-- Mesmo acesso das outras tabelas do módulo de eventos.
ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_approvals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['event_payments', 'event_approvals'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem ler %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem inserir %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem atualizar %1$s" ON %1$I', tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem deletar %1$s" ON %1$I', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem ler %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem inserir %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem atualizar %1$s" ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tabela);
    EXECUTE format('CREATE POLICY "Usuários autenticados podem deletar %1$s" ON %1$I FOR DELETE TO authenticated USING (true)', tabela);
  END LOOP;
END $$;
